import { create } from "zustand";
import type { PlayerDevice } from "../types/playerDevice";

type PlayerDeviceStore = {
  devices: PlayerDevice[];
  loading: boolean;
  refresh: () => Promise<void>;
  claim: (id: string, channelId: string, name?: string) => Promise<void>;
  unpair: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const usePlayerDeviceStore = create<PlayerDeviceStore>((set, get) => ({
  devices: [],
  loading: false,

  refresh: async () => {
    set({ loading: true });
    const devices = await window.adFrame.playerDeviceList();
    set({ devices, loading: false });
  },

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
