import { create } from "zustand";
import type { ExportedVideo } from "../global";

type RendersStore = {
  videos: ExportedVideo[];
  loading: boolean;
  refresh: () => Promise<void>;
  remove: (filename: string) => Promise<void>;
};

export const useRendersStore = create<RendersStore>((set) => ({
  videos: [],
  loading: false,

  refresh: async () => {
    set({ loading: true });
    const videos = await window.adFrame.exportsList();
    set({ videos, loading: false });
  },

  remove: async (filename) => {
    await window.adFrame.exportsDelete(filename);
    set((s) => ({ videos: s.videos.filter((v) => v.filename !== filename) }));
  },
}));
