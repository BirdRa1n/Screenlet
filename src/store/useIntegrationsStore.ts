import { create } from "zustand";
import {
  STOCKEASY_DEFAULT_BASE_URL,
  type IntegrationsConfig,
  type StockEasySetPayload,
} from "../types/integration";

type IntegrationsStore = {
  config: IntegrationsConfig;
  loaded: boolean;
  refresh: () => Promise<void>;
  setStockEasy: (payload: StockEasySetPayload) => Promise<void>;
};

const DEFAULT_CONFIG: IntegrationsConfig = {
  stockeasy: {
    enabled: false,
    baseUrl: STOCKEASY_DEFAULT_BASE_URL,
    selectedStore: null,
    hasApiKey: false,
  },
};

export const useIntegrationsStore = create<IntegrationsStore>((set) => ({
  config: DEFAULT_CONFIG,
  loaded: false,

  refresh: async () => {
    const config = await window.adFrame.integrationsGet();
    set({ config, loaded: true });
  },

  setStockEasy: async (payload) => {
    const config = await window.adFrame.integrationsSetStockEasy(payload);
    set({ config });
  },
}));
