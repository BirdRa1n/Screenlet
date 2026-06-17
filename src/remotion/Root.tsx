import React from "react";
import { Composition, registerRoot } from "remotion";
import { DynamicAd } from "./DynamicAd";
import { TemplateRenderer } from "./TemplateRenderer";
import { buildPreset } from "./presets";
import { templateTotalFrames } from "./template-utils";
import { BUILTIN_TEMPLATES } from "../templates";
import { FPS, HEIGHT, WIDTH, totalDuration } from "./types";

const defaultConfig = buildPreset("generico");
const defaultTemplate = BUILTIN_TEMPLATES[0];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Legacy — kept for backwards compat with saved projects */}
      <Composition
        id="DynamicAd"
        component={DynamicAd}
        durationInFrames={totalDuration(defaultConfig.scenes)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={defaultConfig}
      />
      {/* New template-based composition */}
      <Composition
        id="TemplateAd"
        component={TemplateRenderer}
        durationInFrames={templateTotalFrames(defaultTemplate)}
        fps={defaultTemplate.fps}
        width={defaultTemplate.width}
        height={defaultTemplate.height}
        defaultProps={{ template: defaultTemplate, values: {} }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
