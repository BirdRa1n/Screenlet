import { create } from "zustand";
import { makeId } from "../remotion/types";

export type LibraryProduct = {
  id: string;
  name: string;
  category: string;
  image: string;
  priceMode: "offer" | "single";
  oldPrice: string;
  newPrice: string;
  priceSuffix: string;
  badgeText: string;
  createdAt: string;
};

type LibraryStore = {
  products: LibraryProduct[];
  refresh: () => Promise<void>;
  save: (product: Omit<LibraryProduct, "id" | "createdAt">, existingId?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useLibraryStore = create<LibraryStore>((set) => ({
  products: [],

  refresh: async () => {
    const list = await window.vitrineTV.libraryList();
    set({ products: list });
  },

  save: async (product, existingId) => {
    const existing = existingId
      ? useLibraryStore.getState().products.find((p) => p.id === existingId)
      : undefined;
    const item: LibraryProduct = {
      ...product,
      id: existing?.id ?? makeId(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    await window.vitrineTV.librarySave(item);
    const list = await window.vitrineTV.libraryList();
    set({ products: list });
  },

  remove: async (id) => {
    await window.vitrineTV.libraryDelete(id);
    set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
  },
}));
