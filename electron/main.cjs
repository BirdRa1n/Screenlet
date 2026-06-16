const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

const isDev = !app.isPackaged;
const PUBLIC_DIR = isDev
  ? path.join(__dirname, "..", "public")
  : path.join(process.resourcesPath, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const PROJECTS_DIR = path.join(app.getPath("userData"), "projects");

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
  const destPath = path.join(UPLOADS_DIR, filename);
  fs.copyFileSync(srcPath, destPath);
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
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  ensureDir(UPLOADS_DIR);
  ensureDir(PROJECTS_DIR);
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

/* ---- Export ---- */

ipcMain.handle("export-video", async (_event, config, suggestedName) => {
  const saveResult = await dialog.showSaveDialog(mainWindow, {
    title: "Exportar vídeo",
    defaultPath: suggestedName || "anuncio.mp4",
    filters: [{ name: "Vídeo MP4", extensions: ["mp4"] }],
  });
  if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

  const { bundle } = await import("@remotion/bundler");
  const { renderMedia, selectComposition } = await import("@remotion/renderer");

  const entry = isDev
    ? path.join(__dirname, "..", "src", "remotion", "Root.tsx")
    : path.join(process.resourcesPath, "remotion-entry", "Root.tsx");

  const bundleLocation = await bundle({
    entryPoint: entry,
    onProgress: (progress) => {
      mainWindow.webContents.send("export-progress", { phase: "bundling", progress });
    },
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "DynamicAd",
    inputProps: config,
  });

  const durationInFrames = config.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames,
      width: config.width ?? 1920,
      height: config.height ?? 1080,
    },
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: saveResult.filePath,
    inputProps: config,
    onProgress: ({ progress }) => {
      mainWindow.webContents.send("export-progress", { phase: "rendering", progress });
    },
  });

  return { canceled: false, filePath: saveResult.filePath };
});
