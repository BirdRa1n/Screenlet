const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("adFrame", {
  // Files
  selectImage: () => ipcRenderer.invoke("select-image"),
  copyFile: (srcPath) => ipcRenderer.invoke("copy-file", srcPath),
  selectVideo: () => ipcRenderer.invoke("select-video"),
  selectCsv: () => ipcRenderer.invoke("select-csv"),

  // Projects
  projectsList: () => ipcRenderer.invoke("projects-list"),
  projectsSave: (config, name) => ipcRenderer.invoke("projects-save", config, name),
  projectsLoad: (id) => ipcRenderer.invoke("projects-load", id),
  projectsDelete: (id) => ipcRenderer.invoke("projects-delete", id),
  projectsRename: (id, name) => ipcRenderer.invoke("projects-rename", id, name),

  // Templates
  templateList: () => ipcRenderer.invoke("template-list"),
  templateSave: (template) => ipcRenderer.invoke("template-save", template),
  templateDelete: (id) => ipcRenderer.invoke("template-delete", id),

  // Library
  libraryList: () => ipcRenderer.invoke("library-list"),
  librarySave: (product) => ipcRenderer.invoke("library-save", product),
  libraryDelete: (id) => ipcRenderer.invoke("library-delete", id),

  // Channels
  channelList: () => ipcRenderer.invoke("channel-list"),
  channelSave: (channel) => ipcRenderer.invoke("channel-save", channel),
  channelDelete: (id) => ipcRenderer.invoke("channel-delete", id),

  // Rendered exports
  exportsList: () => ipcRenderer.invoke("exports-list"),
  exportsDelete: (filename) => ipcRenderer.invoke("exports-delete", filename),
  exportsReveal: (filename) => ipcRenderer.invoke("exports-reveal", filename),

  // IPTV Server
  iptvStatus: () => ipcRenderer.invoke("iptv-status"),
  iptvStart: () => ipcRenderer.invoke("iptv-start"),
  iptvStop: () => ipcRenderer.invoke("iptv-stop"),
  iptvSetIp: (ip) => ipcRenderer.invoke("iptv-set-ip", ip),

  // Export / render
  exportVideo: (config, suggestedName, fps) =>
    ipcRenderer.invoke("export-video", config, suggestedName, fps),
  onExportProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("export-progress", listener);
    return () => ipcRenderer.removeListener("export-progress", listener);
  },

  // Media catalog
  mediaCatalog: () => ipcRenderer.invoke("media-catalog"),
  mediaImport: (type) => ipcRenderer.invoke("media-import", type),
  mediaDelete: (id) => ipcRenderer.invoke("media-delete", id),

  // Platform info
  platform: process.platform,
  setTitleBarTheme: (isDark) => ipcRenderer.invoke("set-titlebar-theme", isDark),

  // Storage location
  storageGetDir: () => ipcRenderer.invoke("storage-get-dir"),
  storageChooseDir: () => ipcRenderer.invoke("storage-choose-dir"),
  storageMigrate: (newDir, copyFiles) => ipcRenderer.invoke("storage-migrate", newDir, copyFiles),
  storageOpenDir: () => ipcRenderer.invoke("storage-open-dir"),

  // Kodi Devices
  deviceList: () => ipcRenderer.invoke("device-list"),
  deviceSave: (device) => ipcRenderer.invoke("device-save", device),
  deviceDelete: (id) => ipcRenderer.invoke("device-delete", id),
  // Ping and restart use deviceId only — passwords stay in main process.
  kodiPing: (deviceId) => ipcRenderer.invoke("kodi-ping", deviceId),
  kodiRestartAndOpen: (deviceId) => ipcRenderer.invoke("kodi-restart-and-open", deviceId),
  // Channel list accepts temp creds from form (device not yet saved).
  kodiListChannels: (creds) => ipcRenderer.invoke("kodi-list-channels", creds),
});
