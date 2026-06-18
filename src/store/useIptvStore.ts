import { create } from "zustand";

export type IptvStatus = {
  running: boolean;
  port: number;
  ips: string[];
  ffmpegAvailable: boolean;
};

type IptvStore = {
  status: IptvStatus;
  refresh: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

const DEFAULT_STATUS: IptvStatus = { running: false, port: 7095, ips: [], ffmpegAvailable: false };

export const useIptvStore = create<IptvStore>((set) => ({
  status: DEFAULT_STATUS,

  refresh: async () => {
    const status = await window.adFrame.iptvStatus();
    set({ status });
  },

  start: async () => {
    const status = await window.adFrame.iptvStart();
    set({ status });
  },

  stop: async () => {
    const status = await window.adFrame.iptvStop();
    set({ status });
  },
}));
