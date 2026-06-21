import { create } from "zustand";

export type StoreProfile = {
  id: string;
  name: string;
  logoPath: string;
  brandColor: string;
};

const KEY = "screenlet-store-profiles";

function load(): StoreProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoreProfile[]) : [];
  } catch {
    return [];
  }
}

function persist(list: StoreProfile[]) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(list));
}

type StoreProfileStore = {
  profiles: StoreProfile[];
  refresh: () => void;
  /** Upserts by id, or by case-insensitive name when no id is given. Returns the saved profile. */
  upsert: (p: { id?: string; name: string; logoPath: string; brandColor: string }) => StoreProfile;
  remove: (id: string) => void;
};

export const useStoreProfileStore = create<StoreProfileStore>((set, get) => ({
  profiles: [],
  refresh: () => set({ profiles: load() }),
  upsert: (p) => {
    if (!p.name.trim()) {
      return { id: "", name: p.name, logoPath: p.logoPath, brandColor: p.brandColor };
    }
    const list = get().profiles.length ? get().profiles : load();
    const existing = p.id
      ? list.find((x) => x.id === p.id)
      : list.find((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase());

    let result: StoreProfile;
    let next: StoreProfile[];
    if (existing) {
      result = { ...existing, name: p.name.trim(), logoPath: p.logoPath, brandColor: p.brandColor };
      next = list.map((x) => (x.id === existing.id ? result : x));
    } else {
      result = { id: crypto.randomUUID(), name: p.name.trim(), logoPath: p.logoPath, brandColor: p.brandColor };
      next = [...list, result];
    }
    persist(next);
    set({ profiles: next });
    return result;
  },
  remove: (id) => {
    const next = (get().profiles.length ? get().profiles : load()).filter((x) => x.id !== id);
    persist(next);
    set({ profiles: next });
  },
}));
