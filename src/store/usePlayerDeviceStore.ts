import { create } from "zustand";
import type { PlayerDevice } from "../types/playerDevice";

type PlayerDeviceStore = {
  devices: PlayerDevice[];
  loading: boolean;
  scanning: boolean;
  refresh: () => Promise<void>;
  scan: () => Promise<void>;
  claim: (id: string, channelId: string, name?: string) => Promise<void>;
  unpair: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const usePlayerDeviceStore = create<PlayerDeviceStore>((set, get) => ({
  devices: [],
  loading: false,
  scanning: false,

  refresh: async () => {
    set({ loading: true });
    const devices = await window.adFrame.playerDeviceList();
    set({ devices, loading: false });
  },

  // Active LAN sweep — finds devices that have never heartbeated (never
  // given -studio-url). Slower than refresh() (probes the local subnet),
  // so it's a deliberate user action, not part of the polling loop.
  scan: async () => {
    set({ scanning: true });
    try {
      const devices = await window.adFrame.playerDeviceScan();
      set({ devices });
    } finally {
      set({ scanning: false });
    }
  },

  // May reject (e.g. device unreachable, or claimed by another Studio
  // instance in the meantime) — callers should catch and surface this.
  claim: async (id, channelId, name) => {
    await window.adFrame.playerDeviceClaim({ id, channelId, name });
    await get().refresh();
  },

  unpair: async (id) => {
    await window.adFrame.playerDeviceUnpair(id);
    await get().refresh();
  },

  remove: async (id) => {
    await window.adFrame.playerDeviceDelete(id);
    set((s) => ({ devices: s.devices.filter((d) => d.id !== id) }));
  },
}));
