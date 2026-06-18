import { create } from "zustand";
import type { MediaAsset } from "../types/media";

type MediaStore = {
  assets: MediaAsset[];
  loading: boolean;
  refresh: () => Promise<void>;
  importAsset: (type?: "image" | "video") => Promise<MediaAsset | null>;
  removeAsset: (id: string) => Promise<void>;
};

export const useMediaStore = create<MediaStore>((set, get) => ({
  assets: [],
  loading: false,

  refresh: async () => {
    set({ loading: true });
    const assets = await window.adFrame.mediaCatalog();
    set({ assets, loading: false });
  },

  importAsset: async (type = "image") => {
    const asset = await window.adFrame.mediaImport(type);
    if (asset) await get().refresh();
    return asset;
  },

  removeAsset: async (id) => {
    await window.adFrame.mediaDelete(id);
    set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }));
  },
}));
