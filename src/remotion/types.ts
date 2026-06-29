export type LogoCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type LogoSceneConfig = {
  type: "logo";
  id: string;
  tagline: string;
  taglineColor: string;
  bg: string;
  durationInFrames: number;
};

// Snapshot of a library product's data fields, taken when a product is imported
// as a scene (or last synced). Used to detect when the library changed since
// import without flagging the user's own scene edits. Keys mirror the matching
// ProductSceneConfig field names.
export type LibraryProductSnapshot = {
  image: string;
  productName: string;
  priceMode: "offer" | "single";
  oldPrice: string;
  newPrice: string;
  priceSuffix: string;
  badgeText: string;
};

export type ProductSceneConfig = {
  type: "product";
  id: string;
  // Set when this scene was imported from a library product — links it back so
  // the editor can detect when the library product is updated. Undefined for
  // scenes created manually or via the wizard.
  libraryProductId?: string;
  // Library data as it was at import/last-sync, for drift detection.
  librarySnapshot?: LibraryProductSnapshot;
  image: string;
  productName: string;
  productNameColor: string;
  /** "offer" mostra preço antigo cortado + novo preço. "single" mostra só um preço. */
  priceMode: "offer" | "single";
  oldPrice: string;
  oldPriceColor: string;
  newPrice: string;
  priceSuffix: string;
  bg: string;
  accentColor: string;
  badgeColor: string;
  badgeText: string;
  badgeTextColor: string;
  durationInFrames: number;
  showLogoOverlay: boolean;
  logoPosition: LogoCorner;
};

export type TemplateSceneConfig = {
  type: "template";
  id: string;
  templateId: string;
  values: Record<string, string>;
  durationInFrames: number;
};

export type VideoSceneConfig = {
  type: "video";
  id: string;
  src: string;
  volume: number;
  durationInFrames: number;
};

export type SceneConfig = LogoSceneConfig | ProductSceneConfig | TemplateSceneConfig | VideoSceneConfig;

export type AdConfig = {
  logoImage: string;
  storeName?: string;
  fps: number;
  width: number;
  height: number;
  scenes: SceneConfig[];
  templates?: import("./template-types").Template[];
};

export type ExportFormat = "tv" | "instagram" | "stories" | "tiktok";

export const FORMAT_DIMENSIONS: Record<ExportFormat, { width: number; height: number; label: string; dims: string }> = {
  tv:        { width: 1920, height: 1080, label: "TV / Monitor",  dims: "1920 × 1080 · 16:9" },
  instagram: { width: 1080, height: 1080, label: "Instagram",     dims: "1080 × 1080 · 1:1"  },
  stories:   { width: 1080, height: 1920, label: "Stories",       dims: "1080 × 1920 · 9:16" },
  tiktok:    { width: 1080, height: 1920, label: "TikTok",        dims: "1080 × 1920 · 9:16" },
};

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const logoCornerLabels: Record<LogoCorner, string> = {
  "top-left": "Superior esquerdo",
  "top-right": "Superior direito",
  "bottom-left": "Inferior esquerdo",
  "bottom-right": "Inferior direito",
};

export function totalDuration(scenes: SceneConfig[]): number {
  return scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const defaultLogoScene = (): LogoSceneConfig => ({
  type: "logo",
  id: makeId(),
  tagline: "Ofertas imperdíveis para você!",
  taglineColor: "#ffffff",
  bg: "#0B5E1F",
  durationInFrames: 60,
});

export const defaultTemplateScene = (templateId = ""): TemplateSceneConfig => ({
  type: "template",
  id: makeId(),
  templateId,
  values: {},
  durationInFrames: 150,
});

export const defaultVideoScene = (): VideoSceneConfig => ({
  type: "video",
  id: makeId(),
  src: "",
  volume: 1,
  durationInFrames: 150,
});

export const defaultProductScene = (): ProductSceneConfig => ({
  type: "product",
  id: makeId(),
  image: "",
  productName: "Nome do Produto",
  productNameColor: "#ffffff",
  priceMode: "offer",
  oldPrice: "0,00",
  oldPriceColor: "#ffffff",
  newPrice: "0,00",
  priceSuffix: "",
  bg: "#1A1A1A",
  accentColor: "#FFD500",
  badgeColor: "#E10600",
  badgeText: "Oferta por tempo limitado",
  badgeTextColor: "#ffffff",
  durationInFrames: 150,
  showLogoOverlay: false,
  logoPosition: "top-right",
});
