import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { AdConfig } from "./types";
import { LogoScene } from "./LogoScene";
import { ProductScene } from "./ProductScene";

export const DynamicAd: React.FC<AdConfig> = ({ scenes, logoImage }) => {
  let from = 0;
  const items = scenes.map((scene) => {
    const start = from;
    from += scene.durationInFrames;
    return { scene, start };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {items.map(({ scene, start }) => (
        <Sequence
          key={scene.id}
          from={start}
          durationInFrames={scene.durationInFrames}
        >
          {scene.type === "logo" ? (
            <LogoScene scene={scene} logoImage={logoImage} />
          ) : (
            <ProductScene scene={scene} logoImage={logoImage} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
