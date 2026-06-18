import { create } from "zustand";
import type { Schedule } from "../types/schedule";

type ScheduleStore = {
  schedules: Schedule[];
  loading: boolean;
  refresh: () => Promise<void>;
  save: (schedule: Schedule) => Promise<void>;
  remove: (id: string) => Promise<void>;
  byChannel: (channelId: string) => Schedule[];
};

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  schedules: [],
  loading: false,

  refresh: async () => {
    set({ loading: true });
    const schedules = await window.adFrame.scheduleList();
    set({ schedules, loading: false });
  },

  save: async (schedule) => {
    const updated = { ...schedule, updatedAt: new Date().toISOString() };
    await window.adFrame.scheduleSave(updated);
    await get().refresh();
  },

  remove: async (id) => {
    await window.adFrame.scheduleDelete(id);
    set((s) => ({ schedules: s.schedules.filter((sc) => sc.id !== id) }));
  },

  byChannel: (channelId) => {
    return get().schedules.filter((s) => s.channelId === channelId);
  },
}));
