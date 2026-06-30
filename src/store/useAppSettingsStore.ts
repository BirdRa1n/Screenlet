import { create } from "zustand";

export type VideoCodec = "h264" | "h265";
export type VideoQuality = "high" | "medium" | "low";

export type AppSettings = {
  launchAtLogin: boolean;
  autoStartIptvOnLaunch: boolean;
  videoCodec: VideoCodec;
  videoQuality: VideoQuality;
  hardwareAcceleration: boolean;
  // Set true once the user acknowledges the Terms of Service on first launch.
  termsAcknowledged: boolean;
};

type AppSettingsStore = {
  settings: AppSettings;
  loaded: boolean;
  refresh: () => Promise<void>;
  setLaunchAtLogin: (value: boolean) => Promise<void>;
  setAutoStartIptv: (value: boolean) => Promise<void>;
  setVideoCodec: (value: VideoCodec) => Promise<void>;
  setVideoQuality: (value: VideoQuality) => Promise<void>;
  setHardwareAcceleration: (value: boolean) => Promise<void>;
  acknowledgeTerms: () => Promise<void>;
};

const DEFAULT_SETTINGS: AppSettings = {
  launchAtLogin: false,
  autoStartIptvOnLaunch: true,
  videoCodec: "h264",
  videoQuality: "medium",
  hardwareAcceleration: true,
  termsAcknowledged: false,
};

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

  setVideoCodec: async (value) => {
    const settings = await window.adFrame.appSettingsSetVideoCodec(value);
    set({ settings });
  },

  setVideoQuality: async (value) => {
    const settings = await window.adFrame.appSettingsSetVideoQuality(value);
    set({ settings });
  },

  setHardwareAcceleration: async (value) => {
    const settings = await window.adFrame.appSettingsSetHardwareAcceleration(value);
    set({ settings });
  },

  acknowledgeTerms: async () => {
    const settings = await window.adFrame.appSettingsSetTermsAcknowledged(true);
    set({ settings });
  },
}));
