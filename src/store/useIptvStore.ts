import { create } from "zustand";

export type IptvStatus = {
  running: boolean;
  port: number;
  ips: string[];
  selectedIp: string;
  ffmpegAvailable: boolean;
};

type IptvStore = {
  status: IptvStatus;
  refresh: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  setIp: (ip: string) => Promise<void>;
};

const DEFAULT_STATUS: IptvStatus = { running: false, port: 7095, ips: [], selectedIp: "127.0.0.1", ffmpegAvailable: false };

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

  setIp: async (ip) => {
    const status = await window.adFrame.iptvSetIp(ip);
    set({ status });
  },
}));
