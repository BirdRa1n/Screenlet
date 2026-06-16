import React from "react";
import { Composition, registerRoot } from "remotion";
import { DynamicAd } from "./DynamicAd";
import { buildPreset } from "./presets";
import { FPS, HEIGHT, WIDTH, totalDuration } from "./types";

const defaultConfig = buildPreset("generico");

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DynamicAd"
      component={DynamicAd}
      durationInFrames={totalDuration(defaultConfig.scenes)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={defaultConfig}
    />
  );
};

registerRoot(RemotionRoot);
