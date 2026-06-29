// Integrations with external systems (PDV / ERP) for product data.
// Currently: StockEasy (https://stockeasy.birdra1n.com).

export const STOCKEASY_DEFAULT_BASE_URL = "https://stockeasy.birdra1n.com";

// Config as the renderer sees it — the API key itself never crosses IPC,
// only a boolean flag indicating one is stored (mirrors device passwords).
export type StockEasyConfig = {
  enabled: boolean;
  baseUrl: string;
  selectedStore: string | null;
  hasApiKey: boolean;
};

export type IntegrationsConfig = {
  stockeasy: StockEasyConfig;
};

// Payload for saving the StockEasy config. Fields are optional so callers can
// patch a single value. `apiKey`: a non-empty string sets/replaces the key,
// `null` clears it, `undefined` keeps the existing one.
export type StockEasySetPayload = {
  enabled?: boolean;
  baseUrl?: string;
  selectedStore?: string | null;
  apiKey?: string | null;
};

// Shape returned by the StockEasy product endpoint (only the fields we use).
export type StockEasyProduct = {
  referencia: number | string;
  descricao: string;
  ean: { id: string; tipo: string; [k: string]: unknown }[];
  estoque: { loja: string; quantidade: number }[];
  precos: { loja: string; preco: number; custo: number }[];
  compras: { fornecedor: string; documento: string; custo: number; [k: string]: unknown }[];
};

export type StockEasyLookupResult =
  | { ok: true; product: StockEasyProduct }
  | { ok: false; error: string };
