import { create } from "zustand";
import type { KodiDevice } from "../types/device";

type DeviceStore = {
  devices: KodiDevice[];
  loading: boolean;
  refresh: () => Promise<void>;
  save: (device: KodiDevice) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  devices: [],
  loading: false,

  refresh: async () => {
    set({ loading: true });
    const devices = await window.adFrame.deviceList();
    set({ devices, loading: false });
  },

  save: async (device) => {
    const updated = { ...device, updatedAt: new Date().toISOString() };
    await window.adFrame.deviceSave(updated);
    await get().refresh();
  },

  remove: async (id) => {
    await window.adFrame.deviceDelete(id);
    set((s) => ({ devices: s.devices.filter((d) => d.id !== id) }));
  },
}));
