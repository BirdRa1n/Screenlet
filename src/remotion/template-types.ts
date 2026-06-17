// ─── Animation ────────────────────────────────────────────────────────────────

export type AnimationType =
  | "fadeIn"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown"
  | "zoomIn"
  | "scale"
  | "rotate"
  | "fadeOut"
  | "slideOut"
  | "zoomOut"
  | "pulse"
  | "bounce"
  | "shake"
  | "glow"
  | "typewriter";

export type AnimationEasing = "linear" | "easeIn" | "easeOut" | "easeInOut";

export type LayerAnimation = {
  type: AnimationType;
  startFrame: number;
  durationInFrames: number;
  easing?: AnimationEasing;
};

// ─── Layers ───────────────────────────────────────────────────────────────────

type LayerBase = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  zIndex: number;
  rotation: number;
  animations: LayerAnimation[];
  visible: boolean;
  startFrame?: number;
  endFrame?: number;
};

export type TextLayer = LayerBase & {
  type: "text";
  text: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
};

export type ImageLayer = LayerBase & {
  type: "image";
  src: string;
  fit: "contain" | "cover";
  flipX?: boolean;
  flipY?: boolean;
};

export type LogoLayer = LayerBase & {
  type: "logo";
  fit: "contain" | "cover";
  flipX?: boolean;
  flipY?: boolean;
};

export type PriceLayer = LayerBase & {
  type: "price";
  priceMode: "offer" | "single";
  oldPrice: string;
  newPrice: string;
  suffix: string;
  accentColor: string;
  textColor: string;
  oldPriceColor: string;
  fontSize: number;
};

export type ShapeLayer = LayerBase & {
  type: "shape";
  shape: "rect" | "circle";
  fill: string;
  borderRadius?: number;
  border?: string;
};

export type BadgeLayer = LayerBase & {
  type: "badge";
  text: string;
  bg: string;
  textColor: string;
  borderRadius: number;
  fontSize: number;
};

export type VideoLayer = LayerBase & {
  type: "video";
  src: string;
  volume: number;
  loop: boolean;
  startFrom: number;
};

export type TemplateLayer =
  | TextLayer
  | ImageLayer
  | LogoLayer
  | PriceLayer
  | ShapeLayer
  | BadgeLayer
  | VideoLayer;

// ─── Scene ────────────────────────────────────────────────────────────────────

export type TemplateScene = {
  id: string;
  name: string;
  durationInFrames: number;
  backgroundColor: string;
  layers: TemplateLayer[];
};

// ─── Variables ────────────────────────────────────────────────────────────────

export type VariableType = "text" | "image" | "color" | "number";

export type TemplateVariable = {
  key: string;
  label: string;
  type: VariableType;
  defaultValue: string;
  required?: boolean;
};

export type TemplateValues = Record<string, string>;

// ─── Template ─────────────────────────────────────────────────────────────────

export type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail: string;
  version: string;
  fps: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  variables: TemplateVariable[];
  scenes: TemplateScene[];
  builtin?: boolean;
};

// ─── Instance (template + filled values) ──────────────────────────────────────

export type TemplateInstance = {
  template: Template;
  values: TemplateValues;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const defaultLayerBase = (): Omit<LayerBase, "type"> => ({
  id: crypto.randomUUID(),
  name: "Layer",
  x: 0,
  y: 0,
  width: 400,
  height: 100,
  opacity: 1,
  zIndex: 0,
  rotation: 0,
  animations: [],
  visible: true,
});

export const defaultTextLayer = (): TextLayer => ({
  ...defaultLayerBase(),
  type: "text",
  name: "Texto",
  text: "Texto aqui",
  fontSize: 48,
  fontWeight: 700,
  color: "#ffffff",
  align: "center",
});

export const defaultImageLayer = (): ImageLayer => ({
  ...defaultLayerBase(),
  type: "image",
  name: "Imagem",
  src: "",
  fit: "contain",
  width: 600,
  height: 600,
});

export const defaultShapeLayer = (): ShapeLayer => ({
  ...defaultLayerBase(),
  type: "shape",
  name: "Forma",
  shape: "rect",
  fill: "#6e56f8",
  width: 300,
  height: 80,
  borderRadius: 8,
});

export const defaultBadgeLayer = (): BadgeLayer => ({
  ...defaultLayerBase(),
  type: "badge",
  name: "Badge",
  text: "Oferta",
  bg: "#e10600",
  textColor: "#ffffff",
  borderRadius: 99,
  fontSize: 28,
  width: 260,
  height: 60,
});
