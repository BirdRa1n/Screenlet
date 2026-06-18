const { app, BrowserWindow, ipcMain, dialog, protocol, net, globalShortcut, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");
const http = require("node:http");
const { spawn, execSync } = require("node:child_process");

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 10 },
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
});

ipcMain.handle("channel-delete", (_event, id) => {
  const file = path.join(CHANNELS_DIR, `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
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
