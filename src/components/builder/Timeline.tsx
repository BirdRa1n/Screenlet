import React, { useCallback, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Timer } from "lucide-react";
import { IconButton } from "../../design-system/components";
import type { Template, TemplateLayer, TemplateScene } from "../../remotion/template-types";
import "../../styles/components/Timeline.css";

const LAYER_COLORS: Record<string, string> = {
  text: "#6e56f8",
  image: "#0ea5e9",
  logo: "#f59e0b",
  price: "#22c55e",
  shape: "#ec4899",
  badge: "#ef4444",
  video: "#8b5cf6",
};

type Props = {
  template: Template;
  currentScene: TemplateScene;
  selectedLayerId: string | null;
  currentFrame: number;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (sceneId: string, layerId: string, patch: Partial<TemplateLayer>) => void;
  onSeekFrame: (frame: number) => void;
};

export const Timeline: React.FC<Props> = ({
  template,
  currentScene,
  selectedLayerId,
  currentFrame,
  onSelectLayer,
  onUpdateLayer,
  onSeekFrame,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const rulerRef = useRef<HTMLDivElement>(null);

  const totalFrames = currentScene.durationInFrames;
  const fps = template.fps;
  const pxPerFrame = 2; // each frame = 2px

  const frameToX = (f: number) => f * pxPerFrame;
  const xToFrame = (x: number) => Math.round(x / pxPerFrame);

  /* Ruler click → seek */
  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      onSeekFrame(Math.max(0, Math.min(totalFrames - 1, xToFrame(x))));
    },
    [totalFrames, onSeekFrame, xToFrame]
  );

  /* Clip drag (start frame) */
  const clipDragRef = useRef<{
    layerId: string;
    startX: number;
    origStart: number;
    origDuration: number;
    mode: "move" | "resize-l" | "resize-r";
  } | null>(null);

  const startClipDrag = (
    e: React.PointerEvent,
    layer: TemplateLayer,
    mode: "move" | "resize-l" | "resize-r"
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    clipDragRef.current = {
      layerId: layer.id,
      startX: e.clientX,
      origStart: (layer as unknown as { startFrame?: number }).startFrame ?? 0,
      origDuration: currentScene.durationInFrames,
      mode,
    };
    onSelectLayer(layer.id);
  };

  const onClipPointerMove = (e: React.PointerEvent) => {
    const d = clipDragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const deltaFrames = xToFrame(dx);
    const layer = currentScene.layers.find((l) => l.id === d.layerId);
    if (!layer) return;
    const layerStart = (layer as unknown as { startFrame?: number }).startFrame ?? 0;

    if (d.mode === "move") {
      const newStart = Math.max(0, Math.min(d.origStart + deltaFrames, totalFrames - 1));
      onUpdateLayer(currentScene.id, d.layerId, { startFrame: newStart } as Partial<TemplateLayer>);
    }
    if (d.mode === "resize-r") {
      const newEnd = Math.max(layerStart + 1, Math.min(d.origDuration + deltaFrames, totalFrames));
      onUpdateLayer(currentScene.id, d.layerId, { endFrame: newEnd } as Partial<TemplateLayer>);
    }
    if (d.mode === "resize-l") {
      const newStart = Math.max(0, Math.min(d.origStart + deltaFrames, totalFrames - 1));
      onUpdateLayer(currentScene.id, d.layerId, { startFrame: newStart } as Partial<TemplateLayer>);
    }
  };

  const onClipPointerUp = () => { clipDragRef.current = null; };

  /* Tick marks */
  const ticks: number[] = [];
  const tickInterval = fps >= 24 ? fps : 15; // every second (or every 15 frames)
  for (let f = 0; f <= totalFrames; f += tickInterval) ticks.push(f);

  const totalWidth = frameToX(totalFrames);
  const sortedLayers = [...currentScene.layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="vt-timeline" style={{ minHeight: collapsed ? 36 : 120 }}>
      <div className="vt-timeline__header">
        <Timer size={12} />
        Timeline — {currentScene.name}
        <span style={{ marginLeft: 8 }}>
          {(currentFrame / fps).toFixed(2)}s / {(totalFrames / fps).toFixed(1)}s
        </span>
        <div className="vt-timeline__toggle">
          <IconButton label={collapsed ? "Expandir" : "Recolher"} variant="ghost" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </IconButton>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Ruler */}
          <div className="vt-timeline__ruler-row">
            <div className="vt-timeline__label-col" />
            <div
              ref={rulerRef}
              className="vt-timeline__ruler"
              style={{ width: totalWidth, minWidth: "100%" }}
              onClick={handleRulerClick}
            >
              {ticks.map((f) => (
                <React.Fragment key={f}>
                  <div className="vt-timeline__tick" style={{ left: frameToX(f) }} />
                  <span className="vt-timeline__tick-label" style={{ left: frameToX(f) }}>
                    {(f / fps).toFixed(1)}s
                  </span>
                </React.Fragment>
              ))}
              {/* Playhead in ruler */}
              <div className="vt-timeline__playhead" style={{ left: frameToX(currentFrame) }} />
            </div>
          </div>

          {/* Tracks */}
          <div
            className="vt-timeline__tracks"
            onPointerMove={onClipPointerMove}
            onPointerUp={onClipPointerUp}
          >
            {sortedLayers.map((layer) => {
              const layerStart = (layer as unknown as { startFrame?: number }).startFrame ?? 0;
              const layerEnd = (layer as unknown as { endFrame?: number }).endFrame ?? totalFrames;
              const clipLeft = frameToX(layerStart);
              const clipWidth = Math.max(8, frameToX(layerEnd - layerStart));
              const isSelected = layer.id === selectedLayerId;
              const color = LAYER_COLORS[layer.type] ?? "var(--accent)";

              return (
                <div key={layer.id} className="vt-timeline__track">
                  <div
                    className={`vt-timeline__track-label${isSelected ? " vt-timeline__track-label--selected" : ""}`}
                    onClick={() => onSelectLayer(layer.id)}
                  >
                    <span
                      className="vt-timeline__track-label-type"
                      style={{ background: color + "33", color }}
                    >
                      {layer.type[0].toUpperCase()}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{layer.name}</span>
                  </div>
                  <div className="vt-timeline__track-area" style={{ minWidth: totalWidth }}>
                    {/* Playhead */}
                    <div className="vt-timeline__playhead" style={{ left: frameToX(currentFrame) }} />
                    {/* Clip */}
                    <div
                      className={`vt-timeline__clip${isSelected ? " vt-timeline__clip--selected" : ""}`}
                      style={{
                        left: clipLeft,
                        width: clipWidth,
                        background: isSelected ? color : color + "88",
                        borderColor: color,
                      }}
                      onPointerDown={(e) => startClipDrag(e, layer, "move")}
                    >
                      <div
                        className="vt-timeline__clip-resize-l"
                        onPointerDown={(e) => startClipDrag(e, layer, "resize-l")}
                      />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none" }}>
                        {layer.name}
                      </span>
                      <div
                        className="vt-timeline__clip-resize-r"
                        onPointerDown={(e) => startClipDrag(e, layer, "resize-r")}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
