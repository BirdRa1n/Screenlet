import React from "react";
import { useCurrentFrame, useVideoConfig, Sequence, AbsoluteFill } from "remotion";
import type { Template, TemplateValues } from "./template-types";
import { resolveTemplate } from "./template-utils";
import { LayerRenderer } from "./LayerRenderer";

type Props = {
  template: Template;
  values?: TemplateValues;
};

export const TemplateRenderer: React.FC<Props> = ({ template, values = {} }) => {
  const resolved = resolveTemplate(template, values);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  let offset = 0;

  return (
    <AbsoluteFill style={{ width, height, overflow: "hidden" }}>
      {resolved.scenes.map((scene) => {
        const sceneOffset = offset;
        offset += scene.durationInFrames;
        const sceneFrame = frame - sceneOffset;

        const logoValue = values["LOGO"] ?? template.variables.find(v => v.key === "LOGO")?.defaultValue ?? "";

        return (
          <Sequence
            key={scene.id}
            from={sceneOffset}
            durationInFrames={scene.durationInFrames}
          >
            <AbsoluteFill
              style={{
                background: scene.backgroundColor,
                width,
                height,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {[...scene.layers]
                .sort((a, b) => a.zIndex - b.zIndex)
                .filter((layer) => {
                  const start = layer.startFrame ?? 0;
                  const end = layer.endFrame ?? scene.durationInFrames;
                  return sceneFrame >= start && sceneFrame <= end;
                })
                .map((layer) => (
                  <LayerRenderer
                    key={layer.id}
                    layer={layer}
                    logoSrc={logoValue}
                    sceneFrame={sceneFrame}
                  />
                ))}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
