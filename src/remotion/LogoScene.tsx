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
import type { LogoSceneConfig } from "./types";

export const LogoScene: React.FC<{
  scene: LogoSceneConfig;
  logoImage: string;
}> = ({ scene, logoImage }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.6 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.3, 1]);
  const logoOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(frame, [18, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  const taglineTranslate = interpolate(frame, [18, 30], [30, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: scene.bg,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 40,
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {logoImage ? (
        <Img
          src={staticFile(logoImage)}
          style={{
            width: 720,
            maxHeight: 420,
            objectFit: "contain",
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.4))",
          }}
        />
      ) : null}
      <div
        style={{
          color: scene.taglineColor,
          fontSize: 46,
          fontWeight: 700,
          letterSpacing: 1,
          textAlign: "center",
          padding: "0 80px",
          opacity: taglineOpacity,
          transform: `translateY(${taglineTranslate}px)`,
        }}
      >
        {scene.tagline}
      </div>
    </AbsoluteFill>
  );
};
