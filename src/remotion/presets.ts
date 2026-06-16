import {
  FPS,
  HEIGHT,
  WIDTH,
  defaultLogoScene,
  defaultProductScene,
  type AdConfig,
  type LogoSceneConfig,
  type ProductSceneConfig,
} from "./types";

const LOGO = "assets/logo-popy.png";

export type PresetId = "generico" | "carnes" | "natal" | "pascoa";

export const presetLabels: Record<PresetId, string> = {
  generico: "Genérico",
  carnes: "Carnes / Açougue",
  natal: "Natal",
  pascoa: "Páscoa",
};

function logoScene(overrides: Partial<LogoSceneConfig>): LogoSceneConfig {
  return { ...defaultLogoScene(), ...overrides };
}

function productScene(
  overrides: Partial<ProductSceneConfig>
): ProductSceneConfig {
  return { ...defaultProductScene(), ...overrides };
}

export function buildPreset(id: PresetId): AdConfig {
  const base = { fps: FPS, width: WIDTH, height: HEIGHT, logoImage: LOGO };

  switch (id) {
    case "carnes":
      return {
        ...base,
        scenes: [
          logoScene({
            tagline: "Semana do Churrasco! Carnes selecionadas.",
            bg: "#0B5E1F",
            durationInFrames: 60,
          }),
          productScene({
            image: "assets/produtos/picanha_final.png",
            productName: "Picanha Bovina",
            priceMode: "offer",
            oldPrice: "79,90",
            newPrice: "69,90",
            priceSuffix: "/kg",
            bg: "#241312",
            accentColor: "#FF8A00",
            badgeColor: "#C81F1F",
            badgeText: "Oferta por tempo limitado",
            durationInFrames: 150,
          }),
          productScene({
            image: "assets/produtos/costela_final.png",
            productName: "Costela Bovina",
            priceMode: "offer",
            oldPrice: "39,90",
            newPrice: "34,90",
            priceSuffix: "/kg",
            bg: "#1c1c1c",
            accentColor: "#FF8A00",
            badgeColor: "#C81F1F",
            badgeText: "Oferta por tempo limitado",
            durationInFrames: 150,
          }),
          logoScene({
            tagline: "Garanta já a sua carne para o fim de semana!",
            bg: "#0B5E1F",
            durationInFrames: 60,
          }),
        ],
      };

    case "natal":
      return {
        ...base,
        scenes: [
          logoScene({
            tagline: "Feliz Natal! Ofertas especiais de fim de ano.",
            bg: "#7A0D0D",
            durationInFrames: 60,
          }),
          productScene({
            image: "assets/produtos/panetone_final.png",
            productName: "Panetone Tradicional",
            priceMode: "offer",
            oldPrice: "45,00",
            newPrice: "32,90",
            priceSuffix: "",
            bg: "#7A0D0D",
            accentColor: "#FFD700",
            badgeColor: "#0B5E1F",
            badgeText: "Oferta por tempo limitado",
            durationInFrames: 150,
          }),
          productScene({
            image: "assets/produtos/espumante_final.png",
            productName: "Espumante Brut",
            priceMode: "offer",
            oldPrice: "39,90",
            newPrice: "29,90",
            priceSuffix: "",
            bg: "#0B5E1F",
            accentColor: "#FFD700",
            badgeColor: "#7A0D0D",
            badgeText: "Oferta por tempo limitado",
            durationInFrames: 150,
          }),
          logoScene({
            tagline: "Boas festas! Venha celebrar com a gente.",
            bg: "#7A0D0D",
            durationInFrames: 60,
          }),
        ],
      };

    case "pascoa":
      return {
        ...base,
        scenes: [
          logoScene({
            tagline: "Feliz Páscoa! Doçura para toda a família.",
            bg: "#B07CC6",
            durationInFrames: 60,
          }),
          productScene({
            image: "assets/produtos/ovo_pascoa_final.png",
            productName: "Ovo de Chocolate",
            priceMode: "offer",
            oldPrice: "89,90",
            newPrice: "69,90",
            priceSuffix: "",
            bg: "#B07CC6",
            accentColor: "#FFF1A6",
            badgeColor: "#5B2A86",
            badgeText: "Oferta por tempo limitado",
            durationInFrames: 180,
          }),
          logoScene({
            tagline: "Aproveite as ofertas de Páscoa enquanto durarem!",
            bg: "#B07CC6",
            durationInFrames: 60,
          }),
        ],
      };

    case "generico":
    default:
      return {
        ...base,
        scenes: [
          logoScene({
            tagline: "Ofertas imperdíveis para você!",
            bg: "#0B5E1F",
            durationInFrames: 60,
          }),
          productScene({
            image: "assets/produtos/duracel.webp",
            productName: "Pilhas Duracell AA",
            priceMode: "offer",
            oldPrice: "14,00",
            newPrice: "12,95",
            priceSuffix: "",
            bg: "#1A1A1A",
            accentColor: "#FFD500",
            badgeColor: "#E10600",
            badgeText: "Oferta por tempo limitado",
            durationInFrames: 165,
          }),
          productScene({
            image: "assets/produtos/ninho.webp",
            productName: "Leite Ninho Fases 1+ 800g",
            priceMode: "offer",
            oldPrice: "65,00",
            newPrice: "59,95",
            priceSuffix: "",
            bg: "#C81F1F",
            accentColor: "#FFD500",
            badgeColor: "#E10600",
            badgeText: "Oferta por tempo limitado",
            durationInFrames: 165,
          }),
          logoScene({
            tagline: "Corra! Ofertas válidas enquanto durarem os estoques.",
            bg: "#0B5E1F",
            durationInFrames: 60,
          }),
        ],
      };
  }
}
