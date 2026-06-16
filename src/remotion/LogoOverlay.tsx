import React from "react";
import { Img, staticFile } from "remotion";
import type { LogoCorner } from "./types";

const cornerStyle: Record<LogoCorner, React.CSSProperties> = {
  "top-left": { top: 36, left: 36 },
  "top-right": { top: 36, right: 36 },
  "bottom-left": { bottom: 36, left: 36 },
  "bottom-right": { bottom: 36, right: 36 },
};

export const LogoOverlay: React.FC<{
  logoImage: string;
  position: LogoCorner;
}> = ({ logoImage, position }) => {
  if (!logoImage) return null;

  return (
    <Img
      src={staticFile(logoImage)}
      style={{
        position: "absolute",
        ...cornerStyle[position],
        width: 180,
        maxHeight: 110,
        objectFit: "contain",
        filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.45))",
      }}
    />
  );
};
