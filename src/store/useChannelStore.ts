import { create } from "zustand";
import type { Channel } from "../types/channel";

type ChannelStore = {
  channels: Channel[];
  loading: boolean;
  refresh: () => Promise<void>;
  save: (channel: Channel) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;
};

export const useChannelStore = create<ChannelStore>((set, get) => ({
  channels: [],
  loading: false,

  refresh: async () => {
    set({ loading: true });
    const channels = await window.adFrame.channelList();
    set({ channels, loading: false });
  },

  save: async (channel) => {
    const updated = { ...channel, updatedAt: new Date().toISOString() };
    await window.adFrame.channelSave(updated);
    await get().refresh();
  },

  remove: async (id) => {
    await window.adFrame.channelDelete(id);
    set((s) => ({ channels: s.channels.filter((c) => c.id !== id) }));
  },

  toggle: async (id) => {
    const channel = get().channels.find((c) => c.id === id);
    if (!channel) return;
    await get().save({ ...channel, enabled: !channel.enabled });
  },
}));
