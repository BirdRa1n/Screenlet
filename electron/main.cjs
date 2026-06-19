const { app, BrowserWindow, ipcMain, dialog, protocol, net, globalShortcut, shell, nativeTheme, safeStorage } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");
const http = require("node:http");
const { spawn, execSync } = require("node:child_process");
const { Client: SshClient } = require("ssh2");

// Remotion needs HOME to create ~/.remotion cache.
// os.userInfo().homedir reads /etc/passwd directly, bypassing the HOME env var.
try {
  const userHome = os.userInfo().homedir;
  if (!process.env.HOME || process.env.HOME === "/") {
    process.env.HOME = userHome || os.tmpdir();
  }
} catch {
  if (!process.env.HOME || process.env.HOME === "/") {
    process.env.HOME = os.tmpdir();
  }
}

const isDev = !app.isPackaged;

// ── Remotion browser management ──────────────────────────────────────────────
// Chrome is cached in userData/remotion-root/node_modules/.remotion so it
// survives app updates (the app bundle's node_modules gets replaced on update).
let cachedBrowserExecutable = null;

function computeConcurrency() {
  const ramGb = os.totalmem() / 1024 / 1024 / 1024;
  const cpus  = os.cpus().length;
  // Each Remotion worker consumes ~600 MB. Reserve 2 GB for OS + app.
  const byRam = Math.floor((ramGb - 2) / 0.6);
  const byCpu = Math.max(1, Math.floor(cpus / 2));
  return Math.max(1, Math.min(byRam, byCpu, 8));
}

async function warmRemotionBrowser() {
  try {
    const userData = app.getPath("userData");
    const remotionRoot = path.join(userData, "remotion-root");
    ensureDir(remotionRoot);
    // Remotion walks cwd upward until it finds package.json, then stores
    // Chrome at {dir}/node_modules/.remotion — using userData as that root
    // makes the cache survive app reinstalls/updates.
    const pkgPath = path.join(remotionRoot, "package.json");
    if (!fs.existsSync(pkgPath)) {
      fs.writeFileSync(pkgPath, JSON.stringify({ name: "screenlet-cache", version: "1.0.0" }));
    }
    const origCwd = process.cwd();
    process.chdir(remotionRoot);
    const { ensureBrowser } = await import("@remotion/renderer");
    const result = await ensureBrowser({ logLevel: "verbose" });
    cachedBrowserExecutable = result.path;
    process.chdir(origCwd);
    console.log("[Screenlet] Browser ready:", cachedBrowserExecutable);
  } catch (err) {
    // Non-fatal — renderMedia will download Chrome on-demand if this fails
    console.warn("[Screenlet] Browser pre-warm failed:", err.message);
  }
}

// Allow the user to override the default storage location.
// The custom path is persisted in userData (app config), not in Documents.
function loadStorageDir() {
  const configFile = path.join(app.getPath("userData"), "storage-config.json");
  try {
    if (fs.existsSync(configFile)) {
      const { baseDir } = JSON.parse(fs.readFileSync(configFile, "utf8"));
      if (baseDir) return baseDir;
    }
  } catch {}
  return path.join(app.getPath("documents"), "Screenlet");
}

// All user data lives in ~/Documents/Screenlet (or user-chosen folder) so it
// survives reinstalls, shows up in Finder, and syncs via iCloud / OneDrive.
const SCREENLET_DIR = loadStorageDir();

const UPLOADS_DIR  = path.join(SCREENLET_DIR, "assets");
const PROJECTS_DIR = path.join(SCREENLET_DIR, "projects");
const EXPORTS_DIR  = path.join(SCREENLET_DIR, "exports");

// Register app:// BEFORE app is ready (Electron requirement)
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } },
]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyIntoUploads(srcPath) {
  ensureDir(UPLOADS_DIR);
  const ext = path.extname(srcPath);
  const base = path
    .basename(srcPath, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 40);
  const filename = `${Date.now()}-${base}${ext}`;
  fs.copyFileSync(srcPath, path.join(UPLOADS_DIR, filename));
  return `uploads/${filename}`;
}

let mainWindow;

// Colors must match --neutral-950 (dark bg) and --neutral-50 (light bg) in tokens.css.
const OVERLAY_DARK  = { color: "#0a0b0e", symbolColor: "#f7f8fa" };
const OVERLAY_LIGHT = { color: "#f7f8fa", symbolColor: "#0a0b0e" };

function updateTitleBarOverlay(isDark) {
  if (process.platform === "darwin" || !mainWindow) return;
  const colors = isDark ? OVERLAY_DARK : OVERLAY_LIGHT;
  mainWindow.setTitleBarOverlay({ height: 36, ...colors });
}

function createWindow() {
  const isMac = process.platform === "darwin";
  const darkMode = nativeTheme.shouldUseDarkColors;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    // macOS: custom inset title bar with traffic lights over the sidebar header.
    // Windows/Linux: hidden title bar with a native overlay that keeps ─ □ ✕ controls.
    ...(isMac
      ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: 10 } }
      : {
          titleBarStyle: "hidden",
          titleBarOverlay: { height: 36, ...(darkMode ? OVERLAY_DARK : OVERLAY_LIGHT) },
          autoHideMenuBar: true,
        }),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // Load via app:// so staticFile('/uploads/x') resolves correctly inside Remotion Player
    mainWindow.loadURL("app://index.html");
  }
}

app.whenReady().then(() => {
  ensureDir(SCREENLET_DIR);
  ensureDir(UPLOADS_DIR);
  ensureDir(PROJECTS_DIR);
  ensureDir(EXPORTS_DIR);

  // Cmd+Option+I (macOS) / Ctrl+Shift+I (Win/Linux) opens DevTools in any build
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    mainWindow?.webContents.toggleDevTools();
  });

  // app:// protocol handler — serves app bundle + user uploads from the right locations
  //
  // net.fetch("file://...") cannot read files inside .asar archives (electron-builder default).
  // fs.readFileSync CAN, because Electron patches the fs module to transparently handle .asar.
  // Uploads live outside the archive in userData, so they still use net.fetch via file://.
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);

    // User-uploaded files → UPLOADS_DIR (outside .asar, safe to use net.fetch)
    if (pathname.startsWith("/uploads/")) {
      const filePath = path.join(UPLOADS_DIR, path.basename(pathname));
      return net.fetch(`file://${filePath}`);
    }

    // App bundle assets → dist/ (may be inside .asar — use fs.readFileSync)
    const resolved = pathname === "/" ? "/index.html" : pathname;
    const distPath = path.join(__dirname, "..", "dist", resolved);
    const MIME = {
      html: "text/html; charset=utf-8",
      js:   "application/javascript",
      css:  "text/css",
      svg:  "image/svg+xml",
      png:  "image/png",
      jpg:  "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      ico:  "image/x-icon",
      woff: "font/woff",
      woff2:"font/woff2",
      ttf:  "font/ttf",
      json: "application/json",
    };
    try {
      const data = fs.readFileSync(distPath);
      const ext = path.extname(distPath).slice(1).toLowerCase();
      const mime = MIME[ext] || "application/octet-stream";
      return new Response(data, { headers: { "Content-Type": mime } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Pre-warm Chrome in the background so the first render doesn't trigger a download.
  warmRemotionBrowser();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/* ---- File utils ---- */

ipcMain.handle("copy-file", async (_event, srcPath) => {
  return copyIntoUploads(srcPath);
});

ipcMain.handle("select-image", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecionar imagem",
    properties: ["openFile"],
    filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return copyIntoUploads(result.filePaths[0]);
});

ipcMain.handle("select-video", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecionar vídeo",
    properties: ["openFile"],
    filters: [{ name: "Vídeos", extensions: ["mp4", "webm", "mov", "mkv"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return copyIntoUploads(result.filePaths[0]);
});

ipcMain.handle("select-csv", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Importar planilha",
    properties: ["openFile"],
    filters: [{ name: "Planilha CSV", extensions: ["csv", "txt"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return fs.readFileSync(result.filePaths[0], "utf8");
});

/* ---- Projects ---- */

ipcMain.handle("projects-list", () => {
  ensureDir(PROJECTS_DIR);
  return fs
    .readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), "utf8"));
        return { id: raw.id, name: raw.name, updatedAt: raw.updatedAt, createdAt: raw.createdAt };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
});

ipcMain.handle("projects-save", (_event, config, name) => {
  ensureDir(PROJECTS_DIR);
  const existing = fs
    .readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), "utf8")); } catch { return null; }
    })
    .find((p) => p?.name === name);

  const id = existing?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const data = { id, name, createdAt: existing?.createdAt ?? now, updatedAt: now, config };
  fs.writeFileSync(path.join(PROJECTS_DIR, `${id}.json`), JSON.stringify(data, null, 2));
  return id;
});

ipcMain.handle("projects-load", (_event, id) => {
  const file = path.join(PROJECTS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return data.config;
});

ipcMain.handle("projects-delete", (_event, id) => {
  const file = path.join(PROJECTS_DIR, `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
});

ipcMain.handle("projects-rename", (_event, id, newName) => {
  const file = path.join(PROJECTS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.name = newName;
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
});

/* ---- Library ---- */

const LIBRARY_DIR = path.join(SCREENLET_DIR, "library");

ipcMain.handle("library-list", () => {
  ensureDir(LIBRARY_DIR);
  return fs
    .readdirSync(LIBRARY_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, f), "utf8")); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

ipcMain.handle("library-save", (_event, product) => {
  ensureDir(LIBRARY_DIR);
  fs.writeFileSync(path.join(LIBRARY_DIR, `${product.id}.json`), JSON.stringify(product, null, 2));
});

ipcMain.handle("library-delete", (_event, id) => {
  const file = path.join(LIBRARY_DIR, `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
});

/* ---- Templates ---- */

const TEMPLATES_DIR = path.join(SCREENLET_DIR, "templates");

ipcMain.handle("template-list", () => {
  ensureDir(TEMPLATES_DIR);
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), "utf8")); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
});

ipcMain.handle("template-save", (_event, template) => {
  ensureDir(TEMPLATES_DIR);
  fs.writeFileSync(path.join(TEMPLATES_DIR, `${template.id}.json`), JSON.stringify(template, null, 2));
});

ipcMain.handle("template-delete", (_event, id) => {
  const file = path.join(TEMPLATES_DIR, `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
});

/* ---- Channels ---- */

const CHANNELS_DIR = path.join(SCREENLET_DIR, "channels");
const DEVICES_FILE = path.join(SCREENLET_DIR, "devices.json");

// ── Credential encryption (safeStorage → OS Keychain / DPAPI / Secret Service) ──
//
// Passwords are NEVER stored in plaintext. Each password is encrypted with
// safeStorage.encryptString() before hitting disk and decrypted only inside
// the main process, immediately before use. The renderer never sees passwords.
//
// On macOS  → AES-256-GCM key stored in Keychain under "Electron Safe Storage"
// On Windows → DPAPI (per-user encryption tied to the Windows login session)
// On Linux  → libsecret (GNOME Keyring / KWallet) with plaintext fallback only
//              when no secret service is available (logged as a warning).

function encryptPwd(plaintext) {
  if (!plaintext) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("safeStorage indisponível: não é possível armazenar senhas de forma segura neste sistema.");
  }
  return safeStorage.encryptString(plaintext).toString("base64");
}

function decryptPwd(b64) {
  if (!b64) return "";
  try {
    return safeStorage.decryptString(Buffer.from(b64, "base64"));
  } catch {
    // Encrypted blob is unreadable (key rotation, different user session, etc.)
    return "";
  }
}

// Raw records on disk use _enc suffix for encrypted blobs, never plain passwords.
function readRawDevices() {
  try {
    if (fs.existsSync(DEVICES_FILE)) return JSON.parse(fs.readFileSync(DEVICES_FILE, "utf8"));
  } catch {}
  return [];
}

// Returns devices with decrypted passwords — main process only, never IPC.
function readDevicesWithPasswords() {
  return readRawDevices().map((d) => ({
    ...d,
    sshPassword: decryptPwd(d.sshPassword_enc),
    kodiHttpPassword: decryptPwd(d.kodiHttpPassword_enc),
  }));
}

// Returns devices safe to send to renderer: no passwords, only boolean flags.
function readDevicesForRenderer() {
  return readRawDevices().map(({ sshPassword_enc, kodiHttpPassword_enc, ...rest }) => ({
    ...rest,
    hasSshPassword: !!sshPassword_enc,
    hasKodiPassword: !!kodiHttpPassword_enc,
  }));
}

// Writes devices to disk, encrypting any plain-text passwords received.
// Accepts the full device object (sshPassword / kodiHttpPassword) and
// converts them to encrypted _enc blobs before persisting.
function persistDevices(devices) {
  ensureDir(SCREENLET_DIR);
  const toStore = devices.map(({ sshPassword, kodiHttpPassword, hasSshPassword, hasKodiPassword, ...rest }) => {
    const raw = readRawDevices().find((d) => d.id === rest.id) || {};
    return {
      ...rest,
      // Encrypt if a new value was provided; otherwise keep existing encrypted blob.
      sshPassword_enc: sshPassword ? encryptPwd(sshPassword) : (raw.sshPassword_enc || null),
      kodiHttpPassword_enc: kodiHttpPassword ? encryptPwd(kodiHttpPassword) : (raw.kodiHttpPassword_enc || null),
    };
  });
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(toStore, null, 2));
}

function sshExec(device, command, { tolerant = false } = {}) {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    let output = "";
    const timer = setTimeout(() => { conn.end(); reject(new Error("SSH timeout (10s)")); }, 10_000);
    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); reject(err); return; }
        stream.on("close", (code) => {
          clearTimeout(timer); conn.end();
          if (tolerant || code === 0) resolve(output);
          else reject(new Error(`Código ${code}: ${output.trim()}`));
        });
        stream.on("data", (d) => { output += d.toString(); });
        stream.stderr.on("data", (d) => { output += d.toString(); });
      });
    });
    conn.on("error", (err) => { clearTimeout(timer); reject(err); });
    conn.connect({ host: device.ip, port: device.sshPort || 22, username: device.sshUser, password: device.sshPassword, readyTimeout: 10_000 });
  });
}

// Parses the output of `grep -i webserver guisettings.xml`
function parseKodiWebserverSettings(grepOutput) {
  const extract = (id) => {
    const m = grepOutput.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`));
    return m ? m[1].trim() : null;
  };
  const port     = parseInt(extract("services.webserverport") || "8080", 10);
  const user     = extract("services.webserverusername") || "kodi";
  const password = extract("services.webserverpassword") || "";
  const enabled  = extract("services.webserver");
  const auth     = extract("services.webserverauthentication");
  return { port, user, password, enabled: enabled !== "false", authEnabled: auth !== "false" };
}

function kodiRequest(device, method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: "2.0", method, params: params || {}, id: 1 });
    const auth = Buffer.from(`${device.kodiHttpUser}:${device.kodiHttpPassword}`).toString("base64");
    const req = http.request(
      { hostname: device.ip, port: device.kodiHttpPort || 8080, path: "/jsonrpc", method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Basic ${auth}`, "Content-Length": Buffer.byteLength(body) },
        timeout: 6_000 },
      (res) => {
        let data = "";
        res.on("data", (d) => { data += d; });
        res.on("end", () => { try { resolve(JSON.parse(data)); } catch { reject(new Error(`Resposta inválida: ${data.slice(0, 80)}`)); } });
      }
    );
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout — verifique IP e porta do Kodi")); });
    req.on("error", reject);
    req.write(body); req.end();
  });
}

async function kodiRestartAndOpen(device) {
  await sshExec(device, "systemctl restart kodi");
  console.log(`[kodi] reiniciado em ${device.name} (${device.ip})`);
  if (device.kodiChannelId != null) {
    setTimeout(async () => {
      try {
        await kodiRequest(device, "Player.Open", { item: { channelid: device.kodiChannelId } });
        console.log(`[kodi] canal ${device.kodiChannelId} aberto em ${device.name}`);
      } catch (err) { console.error(`[kodi] falha ao abrir canal em ${device.name}:`, err.message); }
    }, (device.restartDelaySecs ?? 20) * 1000);
  }
}

ipcMain.handle("channel-list", () => {
  ensureDir(CHANNELS_DIR);
  return fs
    .readdirSync(CHANNELS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(CHANNELS_DIR, f), "utf8")); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
});

ipcMain.handle("channel-save", (_event, channel) => {
  ensureDir(CHANNELS_DIR);
  fs.writeFileSync(path.join(CHANNELS_DIR, `${channel.id}.json`), JSON.stringify(channel, null, 2));
  // Fire-and-forget: restart Kodi on all devices assigned to this channel
  const affected = readDevicesWithPasswords().filter((d) => d.defaultChannelId === channel.id);
  for (const device of affected) {
    kodiRestartAndOpen(device).catch((err) =>
      console.error(`[kodi] Falha ao reiniciar ${device.name}:`, err.message)
    );
  }
});

ipcMain.handle("channel-delete", (_event, id) => {
  const file = path.join(CHANNELS_DIR, `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
});

/* ---- Kodi Devices ---- */

// Returns devices without passwords — renderer never receives credentials.
ipcMain.handle("device-list", () => readDevicesForRenderer());

// Accepts device with optional sshPassword / kodiHttpPassword (plain, from UI).
// Encrypts before persisting. Empty string = keep existing encrypted blob.
ipcMain.handle("device-save", (_event, device) => {
  const existing = readRawDevices();
  const idx = existing.findIndex((d) => d.id === device.id);
  if (idx >= 0) existing[idx] = device;
  else existing.push(device);
  persistDevices(existing);
});

ipcMain.handle("device-delete", (_event, id) => {
  persistDevices(readRawDevices().filter((d) => d.id !== id));
});

// Ping uses stored (decrypted) credentials — renderer passes only deviceId.
ipcMain.handle("kodi-ping", async (_event, deviceId) => {
  const device = readDevicesWithPasswords().find((d) => d.id === deviceId);
  if (!device) return { ok: false, error: "Dispositivo não encontrado." };
  try {
    const res = await kodiRequest(device, "JSONRPC.Version", {});
    const v = res?.result?.version;
    return { ok: true, version: v ? `${v.major}.${v.minor}.${v.patch}` : "desconhecida" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Channel list during form setup: renderer passes temporary credentials (not yet saved).
// Acceptable — user just typed them, same threat level as any form submission.
ipcMain.handle("kodi-list-channels", async (_event, creds) => {
  try {
    const res = await kodiRequest(creds, "PVR.GetChannels", { channelgroupid: "alltv" });
    return (res?.result?.channels || []).map((c) => ({ channelid: c.channelid, label: c.label }));
  } catch {
    return [];
  }
});

// Restart uses stored (decrypted) credentials — renderer passes only deviceId.
ipcMain.handle("kodi-restart-and-open", async (_event, deviceId) => {
  const device = readDevicesWithPasswords().find((d) => d.id === deviceId);
  if (!device) return { ok: false, error: "Dispositivo não encontrado." };
  try {
    await kodiRestartAndOpen(device);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Fetch Kodi HTTP config from device via SSH — reads guisettings.xml directly.
// Accepts temporary SSH creds from form (device not yet saved); same threat model
// as any SSH operation initiated by the user with credentials they just typed.
ipcMain.handle("kodi-fetch-config", async (_event, sshCreds) => {
  // Try LibreELEC path first, fall back to standard Kodi path.
  // `tolerant: true` so grep exit code 1 (no matches) doesn't throw.
  const cmd = [
    'f=/storage/.kodi/userdata/guisettings.xml',
    '[ -f "$f" ] || f=$HOME/.kodi/userdata/guisettings.xml',
    'grep -i webserver "$f" 2>/dev/null',
  ].join('; ');
  try {
    const output = await sshExec(sshCreds, cmd, { tolerant: true });
    if (!output.includes('webserver')) {
      return { ok: false, error: 'Arquivo guisettings.xml não encontrado ou sem configurações de webserver.' };
    }
    const config = parseKodiWebserverSettings(output);
    if (!config.enabled) {
      return { ok: false, error: 'Servidor HTTP do Kodi está desativado. Ative em Configurações → Serviços → Controle.' };
    }
    return { ok: true, ...config };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ---- Screenlet Player Devices ---- */
//
// Counterpart to the Kodi bridge above, but for the native screenlet-player
// client (github.com/BirdRa1n/screenlet-player). Unlike Kodi devices, these
// are never configured by an admin typing IP/SSH credentials — the player
// announces itself by POSTing heartbeats to the IPTV server below, and an
// admin "claims" it from the Dispositivos panel once it shows up. See that
// repo's docs/PAIRING.md for the full design this mirrors.

const PLAYER_DEVICES_FILE = path.join(SCREENLET_DIR, "player-devices.json");

function readPlayerDevices() {
  try {
    if (fs.existsSync(PLAYER_DEVICES_FILE)) return JSON.parse(fs.readFileSync(PLAYER_DEVICES_FILE, "utf8"));
  } catch {}
  return [];
}

function writePlayerDevices(devices) {
  ensureDir(SCREENLET_DIR);
  fs.writeFileSync(PLAYER_DEVICES_FILE, JSON.stringify(devices, null, 2));
}

// Reads and JSON-parses a request body. handleIptvRequest's routes are
// otherwise synchronous (writeHead/end), so POST routes resolve this
// promise themselves before responding.
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

// A heartbeat is the only way Studio learns a screenlet-player device
// exists — there is no separate "announce" call. Upserts by deviceId
// whether or not the device has been claimed yet.
function upsertPlayerHeartbeat(body) {
  const { deviceId, hostname, pairingCode, playerVersion, playing, source } = body || {};
  if (!deviceId) return;
  const devices = readPlayerDevices();
  const now = new Date().toISOString();
  const idx = devices.findIndex((d) => d.deviceId === deviceId);
  if (idx >= 0) {
    devices[idx] = {
      ...devices[idx],
      hostname: hostname || devices[idx].hostname,
      pairingCode: pairingCode || devices[idx].pairingCode,
      playerVersion: playerVersion || devices[idx].playerVersion,
      playing: !!playing,
      source: source || null,
      lastSeenAt: now,
    };
  } else {
    devices.push({
      id: crypto.randomUUID(),
      deviceId,
      name: hostname || deviceId.slice(0, 8),
      hostname: hostname || "",
      pairingCode: pairingCode || "",
      playerVersion: playerVersion || "",
      channelId: null,
      paired: false,
      playing: !!playing,
      source: source || null,
      lastSeenAt: now,
      pairedAt: null,
      createdAt: now,
    });
  }
  writePlayerDevices(devices);
}

// What a paired device polls for. Mirrors the URL Kodi devices already use
// for playback — /channel/{id} below — so both bridges serve the exact
// same stream.
function getPlayerSyncResponse(deviceId) {
  if (!deviceId) return { paired: false };
  const device = readPlayerDevices().find((d) => d.deviceId === deviceId);
  if (!device || !device.paired || !device.channelId) return { paired: false };
  const channel = readAllChannels().find((c) => c.id === device.channelId);
  if (!channel) return { paired: false };
  const host = getSelectedIp();
  return {
    paired: true,
    channelId: channel.id,
    playlistUrl: `http://${host}:${IPTV_PORT}/channel/${channel.id}`,
    updatedAt: channel.updatedAt,
  };
}

ipcMain.handle("player-device-list", () => readPlayerDevices());

ipcMain.handle("player-device-claim", (_event, { id, channelId, name }) => {
  const devices = readPlayerDevices();
  const idx = devices.findIndex((d) => d.id === id);
  if (idx < 0) return;
  devices[idx] = {
    ...devices[idx],
    channelId,
    name: name?.trim() || devices[idx].name,
    paired: true,
    pairedAt: new Date().toISOString(),
  };
  writePlayerDevices(devices);
});

ipcMain.handle("player-device-unpair", (_event, id) => {
  const devices = readPlayerDevices();
  const idx = devices.findIndex((d) => d.id === id);
  if (idx < 0) return;
  devices[idx] = { ...devices[idx], paired: false, channelId: null, pairedAt: null };
  writePlayerDevices(devices);
});

ipcMain.handle("player-device-delete", (_event, id) => {
  writePlayerDevices(readPlayerDevices().filter((d) => d.id !== id));
});

/* ---- Media catalog ---- */

const MEDIA_CATALOG_FILE = path.join(UPLOADS_DIR, "media-catalog.json");
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const VIDEO_MEDIA_EXTS = [".mp4", ".webm", ".mov", ".mkv"];
const ALL_MEDIA_EXTS = [...IMAGE_EXTS, ...VIDEO_MEDIA_EXTS];

function loadMediaCatalog() {
  try {
    if (fs.existsSync(MEDIA_CATALOG_FILE)) {
      return JSON.parse(fs.readFileSync(MEDIA_CATALOG_FILE, "utf8"));
    }
  } catch {}
  return { version: 1, assets: [] };
}

function saveMediaCatalog(catalog) {
  ensureDir(UPLOADS_DIR);
  fs.writeFileSync(MEDIA_CATALOG_FILE, JSON.stringify(catalog, null, 2));
}

function guessMediaType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_MEDIA_EXTS.includes(ext) ? "video" : "image";
}

function computeSha256(filePath) {
  try {
    const hash = crypto.createHash("sha256");
    hash.update(fs.readFileSync(filePath));
    return hash.digest("hex");
  } catch {
    return undefined;
  }
}

// Scan UPLOADS_DIR and add any un-cataloged files automatically
function syncMediaCatalog() {
  ensureDir(UPLOADS_DIR);
  const catalog = loadMediaCatalog();
  const knownFilenames = new Set(catalog.assets.map((a) => a.filename));

  let changed = false;
  try {
    const files = fs.readdirSync(UPLOADS_DIR).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ALL_MEDIA_EXTS.includes(ext) && !f.startsWith(".");
    });

    for (const filename of files) {
      const uploadPath = `uploads/${filename}`;
      if (knownFilenames.has(uploadPath)) continue;
      const fullPath = path.join(UPLOADS_DIR, filename);
      try {
        const stat = fs.statSync(fullPath);
        catalog.assets.push({
          id: crypto.randomUUID(),
          filename: uploadPath,
          originalName: filename,
          type: guessMediaType(filename),
          size: stat.size,
          importedAt: (stat.birthtime || stat.mtime).toISOString(),
        });
        changed = true;
      } catch {}
    }
  } catch {}

  if (changed) saveMediaCatalog(catalog);
  return catalog.assets.sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));
}

ipcMain.handle("media-catalog", () => {
  return syncMediaCatalog();
});

ipcMain.handle("media-import", async (_event, type = "image") => {
  const isVideo = type === "video";
  const filters = isVideo
    ? [{ name: "Vídeos", extensions: ["mp4", "webm", "mov", "mkv"] }]
    : [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp"] }];

  const result = await dialog.showOpenDialog(mainWindow, {
    title: isVideo ? "Importar vídeo" : "Importar imagem",
    properties: ["openFile"],
    filters,
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const srcPath = result.filePaths[0];
  const sha256 = computeSha256(srcPath);

  const catalog = loadMediaCatalog();

  // Dedup: return existing asset if same file was already imported
  if (sha256) {
    const existing = catalog.assets.find((a) => a.sha256 === sha256);
    if (existing) return existing;
  }

  const uploadPath = copyIntoUploads(srcPath);
  const fullPath = path.join(UPLOADS_DIR, path.basename(uploadPath));
  let size = 0;
  try { size = fs.statSync(fullPath).size; } catch {}

  const asset = {
    id: crypto.randomUUID(),
    filename: uploadPath,
    originalName: path.basename(srcPath),
    type: isVideo ? "video" : "image",
    size,
    sha256,
    importedAt: new Date().toISOString(),
  };

  catalog.assets.push(asset);
  saveMediaCatalog(catalog);
  return asset;
});

ipcMain.handle("media-delete", (_event, id) => {
  const catalog = loadMediaCatalog();
  catalog.assets = catalog.assets.filter((a) => a.id !== id);
  saveMediaCatalog(catalog);
});

/* ---- Schedules ---- */

const SCHEDULES_DIR = path.join(SCREENLET_DIR, "schedules");

ipcMain.handle("schedule-list", () => {
  ensureDir(SCHEDULES_DIR);
  return fs
    .readdirSync(SCHEDULES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(SCHEDULES_DIR, f), "utf8")); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
});

ipcMain.handle("schedule-save", (_event, schedule) => {
  ensureDir(SCHEDULES_DIR);
  fs.writeFileSync(path.join(SCHEDULES_DIR, `${schedule.id}.json`), JSON.stringify(schedule, null, 2));
});

ipcMain.handle("schedule-delete", (_event, id) => {
  const file = path.join(SCHEDULES_DIR, `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
});

/* ---- Rendered exports ---- */

ipcMain.handle("exports-list", () => {
  ensureDir(EXPORTS_DIR);
  const VIDEO_EXTS = [".mp4", ".webm", ".mov", ".mkv"];
  return fs.readdirSync(EXPORTS_DIR)
    .filter((f) => VIDEO_EXTS.some((ext) => f.toLowerCase().endsWith(ext)))
    .map((filename) => {
      try {
        const filePath = path.join(EXPORTS_DIR, filename);
        const stat = fs.statSync(filePath);
        return {
          filename,
          name: path.basename(filename, path.extname(filename)),
          size: stat.size,
          createdAt: (stat.birthtime || stat.mtime).toISOString(),
        };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

ipcMain.handle("exports-delete", (_event, filename) => {
  const filePath = path.join(EXPORTS_DIR, path.basename(filename));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
});

ipcMain.handle("exports-reveal", (_event, filename) => {
  shell.showItemInFolder(path.join(EXPORTS_DIR, path.basename(filename)));
});

/* ---- IPTV Server ---- */

let iptvServer = null;
const IPTV_PORT = 7095;

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const all = Object.values(nets)
    .flat()
    .filter((n) => n.family === "IPv4" && !n.internal);

  // Rank so true private LAN addresses always come before VPN/Tailscale ranges.
  const rank = (ip) => {
    if (/^192\.168\./.test(ip)) return 0;
    if (/^10\./.test(ip)) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
    return 9; // Tailscale (100.x.x.x) and other VPN adapters last
  };

  return all.sort((a, b) => rank(a.address) - rank(b.address)).map((n) => n.address);
}

// ── IPTV config (selected IP preference) ─────────────────────────────────────
const IPTV_CONFIG_FILE = path.join(app.getPath("userData"), "iptv-config.json");

function loadIptvConfig() {
  try {
    if (fs.existsSync(IPTV_CONFIG_FILE)) return JSON.parse(fs.readFileSync(IPTV_CONFIG_FILE, "utf8"));
  } catch {}
  return {};
}

function saveIptvConfig(cfg) {
  try { fs.writeFileSync(IPTV_CONFIG_FILE, JSON.stringify(cfg)); } catch {}
}

let iptvConfig = loadIptvConfig();

// sourceId = "uploads/filename.mp4" — resolve to the correct directory for dev vs prod
function resolveUploadPath(sourceId) {
  return path.join(UPLOADS_DIR, path.basename(sourceId));
}

function findFfmpegBinary() {
  const candidates = process.platform === "win32"
    ? [
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe",
        path.join(os.homedir(), "ffmpeg", "bin", "ffmpeg.exe"),
        path.join(os.homedir(), "scoop", "apps", "ffmpeg", "current", "bin", "ffmpeg.exe"),
        "C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe",
      ]
    : [
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
      ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  try {
    const cmd = process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
    const result = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    const first = result.split(/\r?\n/)[0].trim();
    if (first) return first;
  } catch {
    // not in PATH
  }
  return null;
}

function readAllChannels() {
  ensureDir(CHANNELS_DIR);
  return fs
    .readdirSync(CHANNELS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(CHANNELS_DIR, f), "utf8")); } catch { return null; } })
    .filter(Boolean);
}

function readAllSchedules() {
  ensureDir(SCHEDULES_DIR);
  return fs
    .readdirSync(SCHEDULES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(SCHEDULES_DIR, f), "utf8")); } catch { return null; } })
    .filter(Boolean);
}

function getSelectedIp() {
  const ips = getLocalIPs();
  if (iptvConfig.selectedIp && ips.includes(iptvConfig.selectedIp)) return iptvConfig.selectedIp;
  return ips[0] || "127.0.0.1";
}

function generateM3u() {
  const channels = readAllChannels().filter((c) => c.enabled);
  const host = getSelectedIp();

  let m3u = `#EXTM3U x-tvg-url="http://${host}:${IPTV_PORT}/epg.xml"\n`;
  for (const ch of channels) {
    m3u += `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" group-title="Screenlet",${ch.name}\n`;
    if (ch.loop) m3u += `#EXTVLCOPT:input-repeat=65535\n`;
    m3u += `http://${host}:${IPTV_PORT}/channel/${ch.id}\n`;
  }
  return m3u;
}

function generateEpg() {
  const channels = readAllChannels();
  const schedules = readAllSchedules();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<!DOCTYPE tv SYSTEM "xmltv.dtd">\n';
  xml += '<tv generator-info-name="Screenlet">\n';

  for (const ch of channels) {
    xml += `  <channel id="${ch.id}">\n    <display-name>${ch.name}</display-name>\n  </channel>\n`;
  }

  for (const sched of schedules) {
    for (const item of (sched.items || [])) {
      const [h = "0", m = "0"] = (item.startTime || "00:00").split(":");
      const startTotalSec = parseInt(h) * 3600 + parseInt(m) * 60;
      const endTotalSec = startTotalSec + (item.duration || 0);
      const fmt = (sec) => {
        const hh = String(Math.floor(sec / 3600) % 24).padStart(2, "0");
        const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
        const ss = String(sec % 60).padStart(2, "0");
        return `${today}${hh}${mm}${ss} +0000`;
      };
      xml += `  <programme start="${fmt(startTotalSec)}" stop="${fmt(endTotalSec)}" channel="${sched.channelId}">\n`;
      xml += `    <title>${item.type}: ${item.sourceId}</title>\n`;
      xml += `  </programme>\n`;
    }
  }

  xml += "</tv>\n";
  return xml;
}

function handleIptvRequest(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const urlPath = req.url.split("?")[0];

  // --- screenlet-player: pairing + sync (see docs in that repo's docs/PAIRING.md) ---

  if (urlPath === "/api/player/heartbeat" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => { upsertPlayerHeartbeat(body); res.writeHead(204); res.end(); })
      .catch(() => { res.writeHead(400, { "Content-Type": "text/plain" }); res.end("invalid json"); });
    return;
  }

  if (urlPath === "/api/player/sync" && req.method === "GET") {
    const deviceId = new URL(req.url, "http://localhost").searchParams.get("deviceId");
    const result = getPlayerSyncResponse(deviceId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  if (urlPath === "/" || urlPath === "/playlist.m3u") {
    const m3u = generateM3u();
    res.writeHead(200, { "Content-Type": "application/x-mpegurl" });
    res.end(m3u);
    return;
  }

  if (urlPath === "/epg.xml") {
    const xml = generateEpg();
    res.writeHead(200, { "Content-Type": "text/xml; charset=utf-8" });
    res.end(xml);
    return;
  }

  const channelMatch = urlPath.match(/^\/channel\/([^/]+)$/);
  if (channelMatch) {
    const channelId = channelMatch[1];
    const channel = readAllChannels().find((c) => c.id === channelId);

    if (!channel) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Channel not found");
      return;
    }

    // --- Playlist mode: stream ordered videos (new format) ---
    const playlistItems = (channel.playlist || []).filter(
      (item) => item.filename && fs.existsSync(path.join(EXPORTS_DIR, item.filename))
    );

    if (playlistItems.length > 0) {
      const ffmpeg = findFfmpegBinary();
      if (!ffmpeg) {
        res.writeHead(503, { "Content-Type": "text/plain" });
        res.end("ffmpeg não encontrado — instale o ffmpeg para transmitir via IPTV");
        return;
      }

      // Write a concat file for ffmpeg
      const concatFile = path.join(os.tmpdir(), `screenlet-pl-${channelId}.txt`);
      const lines = ["ffconcat version 1.0"];
      for (const item of playlistItems) {
        const p = path.join(EXPORTS_DIR, item.filename).replace(/\\/g, "/");
        lines.push(`file '${p.replace(/'/g, "'\\''")}'`);
      }
      fs.writeFileSync(concatFile, lines.join("\n"));

      res.writeHead(200, {
        "Content-Type": "video/mp2t",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });

      let loopActive = true;
      let currentProc = null;

      const startPlaylist = () => {
        if (!loopActive || res.destroyed) return;
        currentProc = spawn(ffmpeg, [
          "-f", "concat", "-safe", "0", "-i", concatFile,
          "-c:v", "libx264", "-c:a", "aac",
          "-preset", "ultrafast", "-tune", "zerolatency",
          "-f", "mpegts", "pipe:1",
        ], { stdio: ["ignore", "pipe", "pipe"] });

        currentProc.stdout.pipe(res, { end: false });
        currentProc.stderr.on("data", (d) => {
          const line = d.toString().split("\n")[0].trim();
          if (line) console.log("[iptv-playlist]", line);
        });
        currentProc.on("close", () => {
          currentProc = null;
          if (loopActive && channel.loop && !res.destroyed) setImmediate(startPlaylist);
          else if (!channel.loop) { try { res.end(); } catch {} }
        });
        currentProc.on("error", (err) => {
          console.error("[iptv-playlist] error:", err.message);
          currentProc = null;
          if (loopActive && channel.loop && !res.destroyed) setTimeout(startPlaylist, 500);
        });
        currentProc.stdout.on("error", () => { if (currentProc) currentProc.kill("SIGTERM"); });
      };

      req.on("close", () => {
        loopActive = false;
        if (currentProc) currentProc.kill("SIGTERM");
        try { fs.unlinkSync(concatFile); } catch {}
      });

      startPlaylist();
      return;
    }

    // --- Legacy: single loop video (loopSourceId on old channel format) ---
    if (channel.loopSourceId) {
      const videoPath = resolveUploadPath(channel.loopSourceId);
      if (!fs.existsSync(videoPath)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Loop video file not found");
        return;
      }

      const ffmpeg = findFfmpegBinary();
      if (ffmpeg) {
        res.writeHead(200, {
          "Content-Type": "video/mp2t",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });

        let currentProc = null;
        let loopActive = true;

        const startFfmpegLoop = () => {
          if (!loopActive || res.destroyed) return;

          // Re-encode with libx264 so timestamps are monotonically increasing
          // across loop iterations. -c:v copy causes PTS discontinuities when
          // -stream_loop restarts, which makes players stop after the first pass.
          currentProc = spawn(ffmpeg, [
            "-re",
            "-stream_loop", "-1",
            "-i", videoPath,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-f", "mpegts",
            "pipe:1",
          ], { stdio: ["ignore", "pipe", "pipe"] });

          currentProc.stdout.pipe(res, { end: false });
          currentProc.stderr.on("data", (d) => {
            const line = d.toString().split("\n")[0].trim();
            if (line) console.log("[iptv-loop]", line);
          });

          currentProc.on("close", () => {
            currentProc = null;
            if (loopActive && !res.destroyed) setImmediate(startFfmpegLoop);
          });
          currentProc.on("error", (err) => {
            console.error("[iptv-loop] error:", err.message);
            currentProc = null;
            if (loopActive && !res.destroyed) setTimeout(startFfmpegLoop, 500);
          });
          currentProc.stdout.on("error", () => {
            if (currentProc) currentProc.kill("SIGTERM");
          });
        };

        req.on("close", () => {
          loopActive = false;
          if (currentProc) currentProc.kill("SIGTERM");
        });

        startFfmpegLoop();
      } else {
        // ffmpeg not available — serve the file once (client reconnects)
        const stat = fs.statSync(videoPath);
        const ext = path.extname(videoPath).toLowerCase();
        const MIME_VIDEO = { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska" };
        res.writeHead(200, {
          "Content-Type": MIME_VIDEO[ext] || "video/mp4",
          "Content-Length": stat.size,
          "Accept-Ranges": "bytes",
          "X-Loop-Fallback": "ffmpeg-not-found",
        });
        fs.createReadStream(videoPath).pipe(res);
      }
      return;
    }

    // --- Schedule mode: serve first scheduled video ---
    const schedules = readAllSchedules().filter((s) => s.channelId === channelId);
    const videoItems = schedules
      .flatMap((s) => (s.items || []))
      .filter((item) => item.type === "video" && item.sourceId);

    if (videoItems.length === 0) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("No video content scheduled for this channel");
      return;
    }

    const videoPath = resolveUploadPath(videoItems[0].sourceId);
    if (!fs.existsSync(videoPath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Video file not found");
      return;
    }

    const stat = fs.statSync(videoPath);
    const ext = path.extname(videoPath).toLowerCase();
    const MIME_VIDEO = { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska" };
    const mime = MIME_VIDEO[ext] || "video/mp4";

    const range = req.headers.range;
    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": mime,
      });
      fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": stat.size,
        "Content-Type": mime,
        "Accept-Ranges": "bytes",
      });
      fs.createReadStream(videoPath).pipe(res);
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}

function iptvStatus() {
  const ips = getLocalIPs();
  return {
    running: !!iptvServer,
    port: IPTV_PORT,
    ips,
    selectedIp: getSelectedIp(),
    ffmpegAvailable: !!findFfmpegBinary(),
  };
}

ipcMain.handle("iptv-status", () => iptvStatus());

ipcMain.handle("iptv-start", () => {
  if (iptvServer) return iptvStatus();
  return new Promise((resolve, reject) => {
    iptvServer = http.createServer(handleIptvRequest);
    iptvServer.once("error", (err) => {
      iptvServer = null;
      reject(err);
    });
    iptvServer.listen(IPTV_PORT, "0.0.0.0", () => resolve(iptvStatus()));
  });
});

ipcMain.handle("iptv-stop", () => {
  if (!iptvServer) return iptvStatus();
  return new Promise((resolve) => {
    iptvServer.close(() => {
      iptvServer = null;
      resolve(iptvStatus());
    });
  });
});

ipcMain.handle("iptv-set-ip", (_, ip) => {
  const ips = getLocalIPs();
  if (ips.includes(ip)) {
    iptvConfig.selectedIp = ip;
    saveIptvConfig(iptvConfig);
  }
  return iptvStatus();
});

// Sync title bar overlay color with app theme (Windows only).
// The renderer calls this whenever the resolved dark/light state changes.
ipcMain.handle("set-titlebar-theme", (_, isDark) => updateTitleBarOverlay(isDark));

// Also follow the OS theme when the user's app preference is "system".
nativeTheme.on("updated", () => updateTitleBarOverlay(nativeTheme.shouldUseDarkColors));

app.on("before-quit", () => {
  if (iptvServer) iptvServer.close();
});

/* ---- Export ---- */

ipcMain.handle("export-video", async (_event, payload, suggestedName, fps) => {
  ensureDir(EXPORTS_DIR);

  const baseName = (suggestedName || `screenlet-${Date.now()}.mp4`)
    .replace(/[^a-zA-Z0-9.\-_]/g, "_");
  let outputPath = path.join(EXPORTS_DIR, baseName);
  if (fs.existsSync(outputPath)) {
    const ext  = path.extname(baseName);
    const base = path.basename(baseName, ext);
    outputPath = path.join(EXPORTS_DIR, `${base}-${Date.now()}${ext}`);
  }

  const renderFps   = fps === 60 ? 60 : 30;
  const concurrency = computeConcurrency();

  let renderer;
  try {
    renderer = await import("@remotion/renderer");
  } catch (err) {
    const arch = process.arch;
    const plat = process.platform;
    return {
      ok: false,
      error: `Módulo Remotion não encontrado para ${plat}-${arch}. ` +
             `Verifique se "@remotion/compositor-${plat}-${arch}" está incluído no build. ` +
             `Detalhes: ${err.message}`,
    };
  }
  const { renderMedia, selectComposition } = renderer;

  // ── Bundle location ───────────────────────────────────────────────────────
  let bundleLocation;

  if (isDev) {
    // Sync assets so staticFile('uploads/x') resolves inside the dev bundle server.
    const devPublicUploads = path.join(__dirname, "..", "public", "uploads");
    ensureDir(devPublicUploads);
    if (fs.existsSync(UPLOADS_DIR)) {
      for (const file of fs.readdirSync(UPLOADS_DIR)) {
        const dst = path.join(devPublicUploads, file);
        if (!fs.existsSync(dst)) {
          try { fs.copyFileSync(path.join(UPLOADS_DIR, file), dst); } catch {}
        }
      }
    }
    const { bundle } = await import("@remotion/bundler");
    bundleLocation = await bundle({
      entryPoint: path.join(__dirname, "..", "src", "remotion", "Root.tsx"),
      publicDir: path.join(__dirname, "..", "public"),
      onProgress: (progress) => {
        mainWindow.webContents.send("export-progress", { phase: "bundling", progress });
      },
    });
  } else {
    bundleLocation = path.join(process.resourcesPath, "app", "dist", "remotion-bundle");

    // Sync user assets into the bundle so staticFile() resolves correctly.
    const bundleUploads = path.join(bundleLocation, "public", "uploads");
    if (fs.existsSync(UPLOADS_DIR)) {
      ensureDir(bundleUploads);
      for (const file of fs.readdirSync(UPLOADS_DIR)) {
        const dst = path.join(bundleUploads, file);
        if (!fs.existsSync(dst)) {
          try { fs.copyFileSync(path.join(UPLOADS_DIR, file), dst); } catch {}
        }
      }
    }
    mainWindow.webContents.send("export-progress", { phase: "bundling", progress: 1 });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isTemplatePayload = payload?.template?.scenes;
  const compositionId     = isTemplatePayload ? "TemplateAd" : "DynamicAd";
  const inputProps        = payload;

  const durationInFrames = isTemplatePayload
    ? payload.template.scenes.reduce((s, sc) => s + sc.durationInFrames, 0)
    : payload.scenes.reduce((s, sc) => s + sc.durationInFrames, 0);

  const width  = isTemplatePayload ? (payload.width ?? payload.template.width  ?? 1920) : (payload.width  ?? 1920);
  const height = isTemplatePayload ? (payload.height ?? payload.template.height ?? 1080) : (payload.height ?? 1080);

  const browserOptions = {
    browserExecutable: cachedBrowserExecutable ?? null,
    // noSandbox is required in packaged Electron apps on Linux/macOS.
    chromiumOptions: { noSandbox: !isDev, disableWebSecurity: false },
    timeoutInMilliseconds: 30_000,
  };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
    ...browserOptions,
  });

  await renderMedia({
    composition: { ...composition, durationInFrames, width, height, fps: renderFps },
    serveUrl: bundleLocation,
    codec: "h264",
    hardwareAcceleration: "if-possible",
    outputLocation: outputPath,
    inputProps,
    concurrency,
    timeoutInMilliseconds: 10 * 60_000,
    ...browserOptions,
    onProgress: ({ progress }) => {
      mainWindow.webContents.send("export-progress", { phase: "rendering", progress });
    },
  });

  return { ok: true, filename: path.basename(outputPath) };
});

/* ---- Storage location ---- */

ipcMain.handle("storage-get-dir", () => SCREENLET_DIR);

ipcMain.handle("storage-choose-dir", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Escolher pasta de armazenamento",
    defaultPath: SCREENLET_DIR,
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Selecionar pasta",
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle("storage-migrate", (_event, newDir, copyFiles) => {
  if (!newDir || newDir === SCREENLET_DIR) return { success: false, reason: "same" };
  try {
    fs.mkdirSync(newDir, { recursive: true });

    if (copyFiles) {
      const subDirs = ["projects", "assets", "templates", "library", "channels", "schedules"];
      for (const sub of subDirs) {
        const src = path.join(SCREENLET_DIR, sub);
        const dst = path.join(newDir, sub);
        if (fs.existsSync(src)) {
          fs.mkdirSync(dst, { recursive: true });
          for (const file of fs.readdirSync(src)) {
            const srcFile = path.join(src, file);
            if (fs.statSync(srcFile).isFile()) {
              fs.copyFileSync(srcFile, path.join(dst, file));
            }
          }
        }
      }
    }

    const configFile = path.join(app.getPath("userData"), "storage-config.json");
    fs.writeFileSync(configFile, JSON.stringify({ baseDir: newDir }, null, 2));

    app.relaunch();
    app.exit(0);
    return { success: true };
  } catch (err) {
    return { success: false, reason: err.message };
  }
});

ipcMain.handle("storage-open-dir", () => {
  shell.openPath(SCREENLET_DIR);
});
