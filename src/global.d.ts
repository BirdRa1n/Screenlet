export type ExportProgress = {
  phase: "bundling" | "rendering";
  progress: number;
};

export type ExportResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

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
      copyFile: (srcPath: string) => Promise<string>;
      selectCsv: () => Promise<string | null>;

      // Projects
      projectsList: () => Promise<ProjectMeta[]>;

      projectsSave: (config: unknown, name: string) => Promise<string>;
      projectsLoad: (id: string) => Promise<unknown>;
      projectsDelete: (id: string) => Promise<void>;
      projectsRename: (id: string, name: string) => Promise<void>;

      // Library
      libraryList: () => Promise<import("./store/useLibraryStore").LibraryProduct[]>;
      librarySave: (product: import("./store/useLibraryStore").LibraryProduct) => Promise<void>;
      libraryDelete: (id: string) => Promise<void>;

      // Export
      exportVideo: (config: unknown, suggestedName?: string) => Promise<ExportResult>;
      onExportProgress: (callback: (data: ExportProgress) => void) => () => void;
    };
  }
}
