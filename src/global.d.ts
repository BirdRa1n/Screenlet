export type ExportProgress = {
  phase: "bundling" | "rendering";
  progress: number;
};

export type ExportResult =
  | { ok: true; filename: string }
  | { ok: false; error: string };

export type ExportedVideo = {
  filename: string;
  name: string;
  size: number;
  createdAt: string;
};

export type ProjectMeta = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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

      // IPTV Server
      iptvStatus: () => Promise<import("./store/useIptvStore").IptvStatus>;
      iptvStart: () => Promise<import("./store/useIptvStore").IptvStatus>;
      iptvStop: () => Promise<import("./store/useIptvStore").IptvStatus>;
      iptvSetIp: (ip: string) => Promise<import("./store/useIptvStore").IptvStatus>;

      // Platform info
      platform: NodeJS.Platform;
      setTitleBarTheme: (isDark: boolean) => Promise<void>;

      // Storage location
      storageGetDir: () => Promise<string>;
      storageChooseDir: () => Promise<string | null>;
      storageMigrate: (newDir: string, copyFiles: boolean) => Promise<{ success: boolean; reason?: string }>;
      storageOpenDir: () => Promise<void>;
    };
  }
}
