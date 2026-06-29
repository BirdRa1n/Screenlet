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

  // Integrations (external PDV/ERP product data) — API key stays in main process.
  integrationsGet: () => ipcRenderer.invoke("integrations-get"),
  integrationsSetStockEasy: (payload) => ipcRenderer.invoke("integrations-set-stockeasy", payload),
  stockeasyLookup: (codigo) => ipcRenderer.invoke("stockeasy-lookup", codigo),

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

  // App settings (launch at login, auto-start IPTV on launch — Windows)
  appSettingsGet: () => ipcRenderer.invoke("app-settings-get"),
  appSettingsSetLaunchAtLogin: (value) => ipcRenderer.invoke("app-settings-set-launch-at-login", value),
  appSettingsSetAutoStartIptv: (value) => ipcRenderer.invoke("app-settings-set-auto-start-iptv", value),
  appSettingsSetVideoCodec: (value) => ipcRenderer.invoke("app-settings-set-video-codec", value),
  appSettingsSetVideoQuality: (value) => ipcRenderer.invoke("app-settings-set-video-quality", value),
  appSettingsSetHardwareAcceleration: (value) => ipcRenderer.invoke("app-settings-set-hardware-acceleration", value),

  // Machine info + full data export (Settings page)
  systemInfoGet: () => ipcRenderer.invoke("system-info-get"),
  dataExportAll: () => ipcRenderer.invoke("data-export-all"),

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
  appGetVersion: () => ipcRenderer.invoke("app-get-version"),
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
  // Read Kodi HTTP config directly from guisettings.xml via SSH.
  kodiFetchConfig: (sshCreds) => ipcRenderer.invoke("kodi-fetch-config", sshCreds),

  // Screenlet Player devices (native client, paired via heartbeat or
  // network scan — no SSH)
  playerDeviceList: () => ipcRenderer.invoke("player-device-list"),
  playerDeviceScan: () => ipcRenderer.invoke("player-device-scan"),
  playerDeviceClaim: (payload) => ipcRenderer.invoke("player-device-claim", payload),
  playerDeviceUnpair: (id) => ipcRenderer.invoke("player-device-unpair", id),
  playerDeviceDelete: (id) => ipcRenderer.invoke("player-device-delete", id),
});
