import { create } from "zustand";

export type AppSettings = {
  launchAtLogin: boolean;
  autoStartIptvOnLaunch: boolean;
};

type AppSettingsStore = {
  settings: AppSettings;
  loaded: boolean;
  refresh: () => Promise<void>;
  setLaunchAtLogin: (value: boolean) => Promise<void>;
  setAutoStartIptv: (value: boolean) => Promise<void>;
};

const DEFAULT_SETTINGS: AppSettings = { launchAtLogin: false, autoStartIptvOnLaunch: true };

export const useAppSettingsStore = create<AppSettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  refresh: async () => {
    const settings = await window.adFrame.appSettingsGet();
    set({ settings, loaded: true });
  },

  setLaunchAtLogin: async (value) => {
    const settings = await window.adFrame.appSettingsSetLaunchAtLogin(value);
    set({ settings });
  },

  setAutoStartIptv: async (value) => {
    const settings = await window.adFrame.appSettingsSetAutoStartIptv(value);
    set({ settings });
  },
}));
