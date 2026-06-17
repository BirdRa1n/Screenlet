const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

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

  // app:// protocol handler — serves app bundle + user uploads from the right locations
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);

    // User-uploaded files → userData/uploads/
    if (pathname.startsWith("/uploads/")) {
      const filePath = path.join(app.getPath("userData"), pathname);
      return net.fetch(`file://${filePath}`);
    }

    // App bundle assets → dist/
    const distPath = path.join(__dirname, "..", "dist", pathname);
    return net.fetch(`file://${distPath}`);
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

  // publicDir tells Remotion's webpack server where to find uploads/
  // Dev: project/public/ — Prod: userData/ (contains uploads/ subdir)
  const publicDir = isDev
    ? path.join(__dirname, "..", "public")
    : app.getPath("userData");

  const bundleLocation = await bundle({
    entryPoint: entry,
    publicDir,
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
