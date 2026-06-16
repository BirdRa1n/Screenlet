import { create } from "zustand";
import { makeId, defaultProductScene, defaultLogoScene } from "../remotion/types";
import type { PresetId } from "../remotion/presets";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export type WizardProduct = {
  id: string;
  image: string;
  productName: string;
  priceMode: "offer" | "single";
  oldPrice: string;
  newPrice: string;
  priceSuffix: string;
  badgeText: string;
};

function defaultWizardProduct(): WizardProduct {
  return {
    id: makeId(),
    image: "",
    productName: "",
    priceMode: "offer",
    oldPrice: "",
    newPrice: "",
    priceSuffix: "",
    badgeText: "Oferta por tempo limitado",
  };
}

export type ExportFormat = "tv" | "instagram" | "stories" | "tiktok";

type WizardStore = {
  step: WizardStep;
  storeName: string;
  logoPath: string;
  brandColor: string;
  products: WizardProduct[];
  selectedPreset: PresetId;
  exportFormat: ExportFormat;

  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setStoreName: (v: string) => void;
  setLogoPath: (v: string) => void;
  setBrandColor: (v: string) => void;
  addProduct: () => void;
  updateProduct: (id: string, patch: Partial<WizardProduct>) => void;
  removeProduct: (id: string) => void;
  setPreset: (id: PresetId) => void;
  setExportFormat: (f: ExportFormat) => void;
  reset: () => void;
};

const INITIAL: Pick<
  WizardStore,
  | "step"
  | "storeName"
  | "logoPath"
  | "brandColor"
  | "products"
  | "selectedPreset"
  | "exportFormat"
> = {
  step: 1,
  storeName: "",
  logoPath: "",
  brandColor: "#6e56f8",
  products: [defaultWizardProduct()],
  selectedPreset: "generico",
  exportFormat: "tv",
};

export const useWizardStore = create<WizardStore>((set) => ({
  ...INITIAL,

  setStep: (step) => set({ step }),
  nextStep: () =>
    set((s) => ({ step: Math.min(s.step + 1, 5) as WizardStep })),
  prevStep: () =>
    set((s) => ({ step: Math.max(s.step - 1, 1) as WizardStep })),

  setStoreName: (storeName) => set({ storeName }),
  setLogoPath: (logoPath) => set({ logoPath }),
  setBrandColor: (brandColor) => set({ brandColor }),

  addProduct: () =>
    set((s) => ({ products: [...s.products, defaultWizardProduct()] })),

  updateProduct: (id, patch) =>
    set((s) => ({
      products: s.products.map((p) =>
        p.id === id ? { ...p, ...patch } : p
      ),
    })),

  removeProduct: (id) =>
    set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

  setPreset: (selectedPreset) => set({ selectedPreset }),
  setExportFormat: (exportFormat) => set({ exportFormat }),

  reset: () => set({ ...INITIAL, products: [defaultWizardProduct()] }),
}));

/** Converts wizard state → AdConfig for the editor/export */
export function wizardToAdConfig(w: WizardStore) {
  const logoScene = {
    ...defaultLogoScene(),
    tagline: w.storeName
      ? `${w.storeName} — ofertas imperdíveis!`
      : "Ofertas imperdíveis para você!",
    bg: w.brandColor,
    durationInFrames: 60,
  };

  const productScenes = w.products
    .filter((p) => p.productName || p.image)
    .map((p) => ({
      ...defaultProductScene(),
      id: p.id,
      image: p.image,
      productName: p.productName,
      priceMode: p.priceMode,
      oldPrice: p.oldPrice,
      newPrice: p.newPrice,
      priceSuffix: p.priceSuffix,
      badgeText: p.badgeText,
      accentColor: w.brandColor,
      showLogoOverlay: !!w.logoPath,
      logoPosition: "top-right" as const,
    }));

  return {
    logoImage: w.logoPath,
    storeName: w.storeName,
    fps: 30,
    width: 1920,
    height: 1080,
    scenes: [logoScene, ...productScenes],
  };
}
