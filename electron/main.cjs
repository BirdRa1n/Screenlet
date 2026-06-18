const { app, BrowserWindow, ipcMain, dialog, protocol, net, globalShortcut } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");
const http = require("node:http");
const { spawn, execSync } = require("node:child_process");

// Remotion needs HOME to create ~/.remotion cache.
// os.homedir() reads HOME env var first — if it's empty it returns "".
// os.userInfo().homedir reads /etc/passwd directly, bypassing HOME.
// We use that as the authoritative fallback.
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


// Dev: uploads in project/public/ so Vite serves them for Remotion Player
// Prod: uploads in userData/ — persists across app updates, never inside asar
const UPLOADS_DIR = isDev
  ? path.join(__dirname, "..", "public", "uploads")
  : path.join(app.getPath("userData"), "uploads");

const PROJECTS_DIR = path.join(app.getPath("userData"), "projects");

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
  ensureDir(UPLOADS_DIR);
  ensureDir(PROJECTS_DIR);

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

    // User-uploaded files → userData/ (outside .asar, safe to use net.fetch)
    if (pathname.startsWith("/uploads/")) {
      const filePath = path.join(app.getPath("userData"), pathname);
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

const LIBRARY_DIR = path.join(app.getPath("userData"), "library");

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

const TEMPLATES_DIR = path.join(app.getPath("userData"), "templates");

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

const CHANNELS_DIR = path.join(app.getPath("userData"), "channels");

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

const SCHEDULES_DIR = path.join(app.getPath("userData"), "schedules");

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

/* ---- IPTV Server ---- */

let iptvServer = null;
const IPTV_PORT = 7095;

function getLocalIPs() {
  const nets = os.networkInterfaces();
  return Object.values(nets)
    .flat()
    .filter((n) => n.family === "IPv4" && !n.internal)
    .map((n) => n.address);
}

// sourceId = "uploads/filename.mp4" — resolve to the correct directory for dev vs prod
function resolveUploadPath(sourceId) {
  return path.join(UPLOADS_DIR, path.basename(sourceId));
}

function findFfmpegBinary() {
  // Common Homebrew paths on macOS
  const candidates = [
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Fall back to PATH
  try {
    const cmd = process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
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

function generateM3u() {
  const channels = readAllChannels().filter((c) => c.enabled);
  const ips = getLocalIPs();
  const host = ips[0] || "127.0.0.1";

  let m3u = `#EXTM3U x-tvg-url="http://${host}:${IPTV_PORT}/epg.xml"\n`;
  for (const ch of channels) {
    m3u += `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" group-title="Screenlet",${ch.name}\n`;
    // VLC loop directive for channels in loop mode
    if (ch.loopSourceId) {
      m3u += `#EXTVLCOPT:input-repeat=65535\n`;
    }
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

    // --- Loop mode: stream a single video infinitely via ffmpeg ---
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

        const proc = spawn(ffmpeg, [
          "-stream_loop", "-1",
          "-re",
          "-i", videoPath,
          "-c:v", "copy",
          "-c:a", "copy",
          "-f", "mpegts",
          "pipe:1",
        ], { stdio: ["ignore", "pipe", "ignore"] });

        proc.stdout.pipe(res, { end: false });

        req.on("close", () => proc.kill("SIGTERM"));
        proc.on("error", () => res.destroy());
        proc.stdout.on("error", () => proc.kill("SIGTERM"));
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
  return { running: !!iptvServer, port: IPTV_PORT, ips: getLocalIPs() };
}

ipcMain.handle("iptv-status", () => ({
  ...iptvStatus(),
  ffmpegAvailable: !!findFfmpegBinary(),
}));

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

app.on("before-quit", () => {
  if (iptvServer) iptvServer.close();
});

/* ---- Export ---- */

ipcMain.handle("export-video", async (_event, payload, suggestedName) => {
  const saveResult = await dialog.showSaveDialog(mainWindow, {
    title: "Exportar vídeo",
    defaultPath: suggestedName || "anuncio.mp4",
    filters: [{ name: "Vídeo MP4", extensions: ["mp4"] }],
  });
  if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

  const { renderMedia, selectComposition } = await import("@remotion/renderer");

  let bundleLocation;

  if (isDev) {
    const { bundle } = await import("@remotion/bundler");
    bundleLocation = await bundle({
      entryPoint: path.join(__dirname, "..", "src", "remotion", "Root.tsx"),
      publicDir: path.join(__dirname, "..", "public"),
      onProgress: (progress) => {
        mainWindow.webContents.send("export-progress", { phase: "bundling", progress });
      },
    });
  } else {
    // Use the pre-built Remotion bundle (asar:false → files are under resources/app/)
    bundleLocation = path.join(
      process.resourcesPath,
      "app",
      "dist",
      "remotion-bundle"
    );

    // Sync user uploads into the bundle dir so staticFile('/uploads/x') resolves correctly
    const userUploads = path.join(app.getPath("userData"), "uploads");
    // Remotion bundle injects window.remotion_staticBase = '/public/' so
    // staticFile('uploads/x') resolves to /public/uploads/x on the bundle server.
    const bundleUploads = path.join(bundleLocation, "public", "uploads");
    if (fs.existsSync(userUploads)) {
      ensureDir(bundleUploads);
      for (const file of fs.readdirSync(userUploads)) {
        const dst = path.join(bundleUploads, file);
        if (!fs.existsSync(dst)) {
          fs.copyFileSync(path.join(userUploads, file), dst);
        }
      }
    }

    mainWindow.webContents.send("export-progress", { phase: "bundling", progress: 1 });
  }

  // Detect payload type: template-based ({ template, values, width, height })
  // or legacy AdConfig ({ scenes, width, height })
  const isTemplatePayload = payload && payload.template && payload.template.scenes;

  const compositionId = isTemplatePayload ? "TemplateAd" : "DynamicAd";
  const inputProps = payload;

  const durationInFrames = isTemplatePayload
    ? payload.template.scenes.reduce((sum, s) => sum + s.durationInFrames, 0)
    : payload.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

  const width = isTemplatePayload ? (payload.width ?? payload.template.width ?? 1920) : (payload.width ?? 1920);
  const height = isTemplatePayload ? (payload.height ?? payload.template.height ?? 1080) : (payload.height ?? 1080);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });

  await renderMedia({
    composition: { ...composition, durationInFrames, width, height },
    serveUrl: bundleLocation,
    codec: "h264",
    hardwareAcceleration: "if-possible",
    outputLocation: saveResult.filePath,
    inputProps,
    onProgress: ({ progress }) => {
      mainWindow.webContents.send("export-progress", { phase: "rendering", progress });
    },
  });

  return { canceled: false, filePath: saveResult.filePath };
});
