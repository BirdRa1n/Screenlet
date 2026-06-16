import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ProductSceneConfig } from "./types";
import { LogoOverlay } from "./LogoOverlay";

export const ProductScene: React.FC<{
  scene: ProductSceneConfig;
  logoImage: string;
}> = ({ scene, logoImage }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Scale factor — everything sized for 1920×1080, scale proportionally
  const sc = Math.min(width / 1920, height / 1080);
  const isPortrait = height > width;
  const isSquare = width === height;

  const imageSpring = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
  const imageScale = interpolate(imageSpring, [0, 1], [0.6, 1]);
  const imageOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const textSpring = spring({ frame: frame - 10, fps, config: { damping: 200, mass: 0.5 } });
  const textTranslate = interpolate(textSpring, [0, 1], [80 * sc, 0]);
  const textOpacity = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: "clamp" });

  const priceSpring = spring({ frame: frame - 25, fps, config: { damping: 12, mass: 0.5 } });
  const priceScale = interpolate(priceSpring, [0, 1], [0, 1]);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;

  // Portrait/square: stack vertically; landscape: side by side
  const isVertical = isPortrait || isSquare;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: scene.bg,
        flexDirection: isVertical ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {scene.showLogoOverlay && (
        <LogoOverlay logoImage={logoImage} position={scene.logoPosition} />
      )}

      {/* Image */}
      <div
        style={{
          flex: isVertical ? "0 0 45%" : 1,
          width: isVertical ? "100%" : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: isVertical ? "45%" : "100%",
        }}
      >
        {scene.image && (
          <Img
            src={staticFile(scene.image)}
            style={{
              height: isPortrait ? "80%" : "75%",
              maxWidth: "90%",
              objectFit: "contain",
              transform: `scale(${imageScale})`,
              opacity: imageOpacity,
              filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.45))",
            }}
          />
        )}
      </div>

      {/* Text */}
      <div
        style={{
          flex: isVertical ? "0 0 50%" : 1,
          width: isVertical ? "100%" : undefined,
          display: "flex",
          flexDirection: "column",
          alignItems: isVertical ? "center" : "flex-start",
          justifyContent: "center",
          gap: 24 * sc,
          transform: `translateX(${isVertical ? 0 : textTranslate}px) translateY(${isVertical ? textTranslate : 0}px)`,
          opacity: textOpacity,
          padding: isVertical ? `0 ${60 * sc}px` : `0 ${80 * sc}px 0 0`,
          textAlign: isVertical ? "center" : "left",
        }}
      >
        <div
          style={{
            color: scene.productNameColor,
            fontSize: 56 * sc,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 1,
            textShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {scene.productName}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4 * sc,
            transform: `scale(${priceScale})`,
            transformOrigin: isVertical ? "center center" : "left center",
          }}
        >
          {scene.priceMode === "offer" && (
            <div style={{ color: scene.oldPriceColor, fontSize: 36 * sc, textDecoration: "line-through", opacity: 0.75 }}>
              De R$ {scene.oldPrice}
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: isVertical ? "center" : "flex-start",
              gap: 16 * sc,
              transform: `scale(${pulse})`,
              transformOrigin: isVertical ? "center center" : "left center",
            }}
          >
            {scene.priceMode === "offer" && (
              <span style={{ color: scene.accentColor, fontSize: 38 * sc, fontWeight: 700 }}>por</span>
            )}
            <span style={{ color: scene.accentColor, fontSize: 130 * sc, fontWeight: 900, lineHeight: 1, textShadow: "0 6px 18px rgba(0,0,0,0.5)" }}>
              R$ {scene.newPrice}
              {scene.priceSuffix && <span style={{ fontSize: 44 * sc }}>{scene.priceSuffix}</span>}
            </span>
          </div>
        </div>

        {scene.badgeText && (
          <div
            style={{
              backgroundColor: scene.badgeColor,
              color: scene.badgeTextColor,
              fontSize: 30 * sc,
              fontWeight: 800,
              padding: `${10 * sc}px ${28 * sc}px`,
              borderRadius: 999,
              textTransform: "uppercase",
              boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
            }}
          >
            {scene.badgeText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
