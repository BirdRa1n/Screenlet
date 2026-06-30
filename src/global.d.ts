export type ExportProgress = {
  phase: "bundling" | "rendering";
  progress: number;
};

export type ExportResult =
  | { ok: true; filename: string; updatedChannels?: { id: string; name: string }[] }
  | { ok: false; error: string };

export type ExportedVideo = {
  filename: string;
  name: string;
  size: number;
  createdAt: string;
};

export type SystemInfo = {
  platform: NodeJS.Platform;
  arch: string;
  osRelease: string;
  hostname: string;
  cpuModel: string;
  cpuCores: number;
  totalRamGb: number;
  freeRamGb: number;
  renderConcurrency: number;
  appVersion: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  screenletDir: string;
};

export type ProjectMeta = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // Relative path ("project-thumbs/x.jpg") resolving against the app://
  // page base, same convention as asset.filename for uploads — null until
  // the background render finishes (best-effort, generated on save).
  thumbnail: string | null;
};

declare global {
  interface Window {
    adFrame: {
      // Files
      selectImage: () => Promise<string | null>;
      selectVideo: () => Promise<string | null>;
      copyFile: (srcPath: string) => Promise<string>;
      selectCsv: () => Promise<string | null>;

      // Projects
      projectsList: () => Promise<ProjectMeta[]>;
      projectsSave: (config: unknown, name: string) => Promise<string>;
      projectsLoad: (id: string) => Promise<unknown>;
      projectsDelete: (id: string) => Promise<void>;
      projectsRename: (id: string, name: string) => Promise<void>;

      // Templates
      templateList: () => Promise<import("./remotion/template-types").Template[]>;
      templateSave: (template: import("./remotion/template-types").Template) => Promise<void>;
      templateDelete: (id: string) => Promise<void>;

      // Library
      libraryList: () => Promise<import("./store/useLibraryStore").LibraryProduct[]>;
      librarySave: (product: import("./store/useLibraryStore").LibraryProduct) => Promise<void>;
      libraryDelete: (id: string) => Promise<void>;

      // Integrations (external PDV/ERP) — API key never crosses IPC.
      integrationsGet: () => Promise<import("./types/integration").IntegrationsConfig>;
      integrationsSetStockEasy: (
        payload: import("./types/integration").StockEasySetPayload,
      ) => Promise<import("./types/integration").IntegrationsConfig>;
      stockeasyLookup: (
        codigo: string,
      ) => Promise<import("./types/integration").StockEasyLookupResult>;

      // Channels
      channelList: () => Promise<import("./types/channel").Channel[]>;
      channelSave: (channel: import("./types/channel").Channel) => Promise<void>;
      channelDelete: (id: string) => Promise<void>;

      // Rendered exports
      exportsList: () => Promise<ExportedVideo[]>;
      exportsDelete: (filename: string) => Promise<void>;
      exportsReveal: (filename: string) => Promise<void>;

      // Export / render
      exportVideo: (config: unknown, suggestedName: string, fps: 30 | 60) => Promise<ExportResult>;
      onExportProgress: (callback: (data: ExportProgress) => void) => () => void;

      // Media catalog
      mediaCatalog: () => Promise<import("./types/media").MediaAsset[]>;
      mediaImport: (type?: "image" | "video") => Promise<import("./types/media").MediaAsset | null>;
      mediaDelete: (id: string) => Promise<void>;

      // IPTV Server
      iptvStatus: () => Promise<import("./store/useIptvStore").IptvStatus>;
      iptvStart: () => Promise<import("./store/useIptvStore").IptvStatus>;
      iptvStop: () => Promise<import("./store/useIptvStore").IptvStatus>;
      iptvSetIp: (ip: string) => Promise<import("./store/useIptvStore").IptvStatus>;

      // App settings (launch at login, auto-start IPTV on launch — Windows)
      appSettingsGet: () => Promise<import("./store/useAppSettingsStore").AppSettings>;
      appSettingsSetLaunchAtLogin: (value: boolean) => Promise<import("./store/useAppSettingsStore").AppSettings>;
      appSettingsSetAutoStartIptv: (value: boolean) => Promise<import("./store/useAppSettingsStore").AppSettings>;
      appSettingsSetVideoCodec: (
        value: import("./store/useAppSettingsStore").VideoCodec,
      ) => Promise<import("./store/useAppSettingsStore").AppSettings>;
      appSettingsSetVideoQuality: (
        value: import("./store/useAppSettingsStore").VideoQuality,
      ) => Promise<import("./store/useAppSettingsStore").AppSettings>;
      appSettingsSetHardwareAcceleration: (
        value: boolean,
      ) => Promise<import("./store/useAppSettingsStore").AppSettings>;
      appSettingsSetTermsAcknowledged: (
        value: boolean,
      ) => Promise<import("./store/useAppSettingsStore").AppSettings>;

      // Open an external URL (https only) in the system browser.
      openExternal: (url: string) => Promise<boolean>;

      // Machine info + full data export (Settings page)
      systemInfoGet: () => Promise<SystemInfo>;
      dataExportAll: () => Promise<{ ok: true; filePath: string } | { ok: false; canceled?: boolean }>;

      // Kodi Devices — passwords never returned to renderer; only boolean flags.
      deviceList: () => Promise<import("./types/device").KodiDevice[]>;
      deviceSave: (device: import("./types/device").KodiDevice) => Promise<void>;
      deviceDelete: (id: string) => Promise<void>;
      // Ping/restart receive only deviceId; main decrypts credentials internally.
      kodiPing: (deviceId: string) => Promise<import("./types/device").KodiPingResult>;
      kodiRestartAndOpen: (deviceId: string) => Promise<{ ok: boolean; error?: string }>;
      // Channel list accepts temporary plaintext creds from form (device not yet saved).
      kodiListChannels: (creds: import("./types/device").KodiTestCreds) => Promise<import("./types/device").KodiChannel[]>;
      // Read Kodi HTTP config from guisettings.xml via SSH — fills form fields automatically.
      kodiFetchConfig: (sshCreds: import("./types/device").SshTestCreds) => Promise<import("./types/device").KodiFetchConfigResult>;

      // Screenlet Player devices
      playerDeviceList: () => Promise<import("./types/playerDevice").PlayerDevice[]>;
      // Sweeps the local network for unclaimed devices; throws nothing,
      // just returns whatever the (possibly empty) result is.
      playerDeviceScan: () => Promise<import("./types/playerDevice").PlayerDevice[]>;
      // May reject — device unreachable, or already claimed by another
      // Screenlet Studio instance.
      playerDeviceClaim: (payload: { id: string; channelId: string; name?: string }) => Promise<void>;
      playerDeviceUnpair: (id: string) => Promise<void>;
      playerDeviceDelete: (id: string) => Promise<void>;

      // Platform info
      platform: NodeJS.Platform;
      appGetVersion: () => Promise<string>;
      setTitleBarTheme: (isDark: boolean) => Promise<void>;

      // Storage location
      storageGetDir: () => Promise<string>;
      storageChooseDir: () => Promise<string | null>;
      storageMigrate: (newDir: string, copyFiles: boolean) => Promise<{ success: boolean; reason?: string }>;
      storageOpenDir: () => Promise<void>;
    };
  }
}
