import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile } from "remotion";
import type { AdConfig } from "./types";
import { LogoScene } from "./LogoScene";
import { ProductScene } from "./ProductScene";
import { TemplateRenderer } from "./TemplateRenderer";
import { useTemplateStore } from "../store/useTemplateStore";

export const DynamicAd: React.FC<AdConfig> = ({ scenes, logoImage, templates: propTemplates }) => {
  const storeTemplates = useTemplateStore((s) => s.templates);
  const templates = propTemplates ?? storeTemplates;

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
          ) : scene.type === "template" ? (
            <TemplateSceneRenderer
              templateId={scene.templateId}
              values={scene.values}
              templates={templates}
            />
          ) : scene.type === "video" ? (
            <VideoSceneRenderer src={scene.src} volume={scene.volume} />
          ) : (
            <ProductScene scene={scene} logoImage={logoImage} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const TemplateSceneRenderer: React.FC<{
  templateId: string;
  values: Record<string, string>;
  templates: import("./template-types").Template[];
}> = ({ templateId, values, templates }) => {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return null;
  return <TemplateRenderer template={template} values={values} />;
};

const VideoSceneRenderer: React.FC<{ src: string; volume: number }> = ({ src, volume }) => {
  if (!src) return null;
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile(src)}
        style={{ width: "100%", height: "100%" }}
        volume={volume}
      />
    </AbsoluteFill>
  );
};
