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

  // Schedules
  scheduleList: () => ipcRenderer.invoke("schedule-list"),
  scheduleSave: (schedule) => ipcRenderer.invoke("schedule-save", schedule),
  scheduleDelete: (id) => ipcRenderer.invoke("schedule-delete", id),

  // IPTV Server
  iptvStatus: () => ipcRenderer.invoke("iptv-status"),
  iptvStart: () => ipcRenderer.invoke("iptv-start"),
  iptvStop: () => ipcRenderer.invoke("iptv-stop"),

  // Export
  exportVideo: (config, suggestedName) =>
    ipcRenderer.invoke("export-video", config, suggestedName),
  onExportProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("export-progress", listener);
    return () => ipcRenderer.removeListener("export-progress", listener);
  },
});
