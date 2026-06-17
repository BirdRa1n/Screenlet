import React from "react";
import { staticFile, Img, OffthreadVideo } from "remotion";
import type { TemplateLayer } from "./template-types";
import { resolveLayerAnimations } from "./animations";

type Props = {
  layer: TemplateLayer;
  logoSrc?: string;
  sceneFrame: number;
  values?: Record<string, string>;
};

export const LayerRenderer: React.FC<Props> = ({ layer, logoSrc, sceneFrame, values = {} }) => {
  if (!layer.visible) return null;

  const animStyles = resolveLayerAnimations(sceneFrame, layer.animations, layer.opacity);

  // glow animation — adds drop-shadow filter on top of transform styles
  const glowAnim = layer.animations.find((a) => a.type === "glow");
  if (glowAnim && sceneFrame >= glowAnim.startFrame && sceneFrame <= glowAnim.startFrame + glowAnim.durationInFrames) {
    const elapsed = sceneFrame - glowAnim.startFrame;
    const intensity = 0.5 + 0.5 * Math.sin((elapsed / glowAnim.durationInFrames) * Math.PI * 6);
    const blur = Math.round(8 + intensity * 16);
    animStyles.filter = `drop-shadow(0 0 ${blur}px rgba(255,255,255,0.7))`;
  }

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    zIndex: layer.zIndex,
    rotate: layer.rotation ? `${layer.rotation}deg` : undefined,
    ...animStyles,
  };

  switch (layer.type) {
    case "shape":
      return (
        <div
          style={{
            ...baseStyle,
            background: layer.fill,
            borderRadius: layer.shape === "circle" ? "50%" : (layer.borderRadius ?? 0),
            border: layer.border,
          }}
        />
      );

    case "text": {
      // typewriter: reveal characters based on sceneFrame progress through the animation
      const twAnim = layer.animations.find((a) => a.type === "typewriter");
      let displayText = layer.text;
      if (twAnim) {
        const elapsed = Math.max(0, sceneFrame - twAnim.startFrame);
        const charsPerFrame = layer.text.length / twAnim.durationInFrames;
        const visibleChars = Math.min(layer.text.length, Math.floor(elapsed * charsPerFrame));
        displayText = layer.text.slice(0, visibleChars);
      }
      return (
        <div
          style={{
            ...baseStyle,
            fontSize: layer.fontSize,
            fontWeight: layer.fontWeight,
            color: layer.color,
            textAlign: layer.align,
            lineHeight: layer.lineHeight ?? 1.2,
            letterSpacing: layer.letterSpacing,
            display: "flex",
            alignItems: "center",
            justifyContent:
              layer.align === "left" ? "flex-start" : layer.align === "right" ? "flex-end" : "center",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {displayText}
        </div>
      );
    }

    case "badge":
      return (
        <div
          style={{
            ...baseStyle,
            background: layer.bg,
            borderRadius: layer.borderRadius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              color: layer.textColor,
              fontSize: layer.fontSize,
              fontWeight: 700,
              fontFamily: "Inter, sans-serif",
              textAlign: "center",
              padding: "0 16px",
            }}
          >
            {layer.text}
          </span>
        </div>
      );

    case "image": {
      const src = layer.src ? staticFile(layer.src) : null;
      if (!src) return null;
      const flipTransform = [layer.flipX ? "scaleX(-1)" : "", layer.flipY ? "scaleY(-1)" : ""].filter(Boolean).join(" ") || undefined;
      return (
        <div style={{ ...baseStyle, overflow: "hidden" }}>
          <Img
            src={src}
            style={{ width: "100%", height: "100%", objectFit: layer.fit, transform: flipTransform }}
          />
        </div>
      );
    }

    case "logo": {
      const src = logoSrc ? staticFile(logoSrc) : null;
      if (!src) return null;
      const flipTransform = [layer.flipX ? "scaleX(-1)" : "", layer.flipY ? "scaleY(-1)" : ""].filter(Boolean).join(" ") || undefined;
      return (
        <div style={{ ...baseStyle, overflow: "hidden" }}>
          <Img
            src={src}
            style={{ width: "100%", height: "100%", objectFit: layer.fit, transform: flipTransform }}
          />
        </div>
      );
    }

    case "price": {
      const isOffer = layer.priceMode === "offer";
      return (
        <div
          style={{
            ...baseStyle,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {isOffer && layer.oldPrice && (
            <span
              style={{
                fontSize: layer.fontSize * 0.45,
                color: layer.oldPriceColor,
                textDecoration: "line-through",
                opacity: 0.75,
              }}
            >
              R$ {layer.oldPrice}
            </span>
          )}
          <span
            style={{
              fontSize: layer.fontSize,
              fontWeight: 900,
              color: layer.accentColor,
              lineHeight: 1,
            }}
          >
            R$ {layer.newPrice}
            {layer.suffix && (
              <span style={{ fontSize: layer.fontSize * 0.4, color: layer.textColor }}>
                {" "}{layer.suffix}
              </span>
            )}
          </span>
        </div>
      );
    }

    case "video": {
      const src = layer.src ? staticFile(layer.src) : null;
      if (!src) return null;
      return (
        <div style={{ ...baseStyle, overflow: "hidden" }}>
          <OffthreadVideo
            src={src}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            volume={layer.volume}
            startFrom={layer.startFrom}
          />
        </div>
      );
    }

    default:
      return null;
  }
};
