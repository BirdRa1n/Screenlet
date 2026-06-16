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
  const { fps } = useVideoConfig();

  const imageSpring = spring({
    frame,
    fps,
    config: { damping: 200, mass: 0.6 },
  });
  const imageScale = interpolate(imageSpring, [0, 1], [0.6, 1]);
  const imageOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const textSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 200, mass: 0.5 },
  });
  const textTranslate = interpolate(textSpring, [0, 1], [80, 0]);
  const textOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  const priceSpring = spring({
    frame: frame - 25,
    fps,
    config: { damping: 12, mass: 0.5 },
  });
  const priceScale = interpolate(priceSpring, [0, 1], [0, 1]);

  const pulse = 1 + Math.sin(frame / 6) * 0.03;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: scene.bg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {scene.showLogoOverlay ? (
        <LogoOverlay logoImage={logoImage} position={scene.logoPosition} />
      ) : null}

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        {scene.image ? (
          <Img
            src={staticFile(scene.image)}
            style={{
              height: "75%",
              maxWidth: "88%",
              objectFit: "contain",
              transform: `scale(${imageScale})`,
              opacity: imageOpacity,
              filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.45))",
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: 24,
          transform: `translateX(${textTranslate}px)`,
          opacity: textOpacity,
          paddingRight: 80,
        }}
      >
        <div
          style={{
            color: scene.productNameColor,
            fontSize: 56,
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
            gap: 4,
            transform: `scale(${priceScale})`,
            transformOrigin: "left center",
          }}
        >
          {scene.priceMode === "offer" ? (
            <div
              style={{
                color: scene.oldPriceColor,
                fontSize: 36,
                textDecoration: "line-through",
                opacity: 0.75,
              }}
            >
              De R$ {scene.oldPrice}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              transform: `scale(${pulse})`,
              transformOrigin: "left center",
            }}
          >
            {scene.priceMode === "offer" ? (
              <span
                style={{
                  color: scene.accentColor,
                  fontSize: 38,
                  fontWeight: 700,
                }}
              >
                por
              </span>
            ) : null}
            <span
              style={{
                color: scene.accentColor,
                fontSize: 130,
                fontWeight: 900,
                lineHeight: 1,
                textShadow: "0 6px 18px rgba(0,0,0,0.5)",
              }}
            >
              R$ {scene.newPrice}
              {scene.priceSuffix ? (
                <span style={{ fontSize: 44 }}>{scene.priceSuffix}</span>
              ) : null}
            </span>
          </div>
        </div>

        {scene.badgeText ? (
          <div
            style={{
              backgroundColor: scene.badgeColor,
              color: scene.badgeTextColor,
              fontSize: 30,
              fontWeight: 800,
              padding: "10px 28px",
              borderRadius: 999,
              textTransform: "uppercase",
              boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
            }}
          >
            {scene.badgeText}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
