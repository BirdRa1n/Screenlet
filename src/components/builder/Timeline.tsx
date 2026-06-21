"use client";

import { Fragment, useCallback, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Timer } from "lucide-react";
import { IconButton } from "../../design-system/components";
import { cn } from "@/lib/utils";
import type { Template, TemplateLayer, TemplateScene } from "../../remotion/template-types";

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
  const pxPerFrame = 2;

  const frameToX = (f: number) => f * pxPerFrame;
  const xToFrame = (x: number) => Math.round(x / pxPerFrame);

  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      onSeekFrame(Math.max(0, Math.min(totalFrames - 1, xToFrame(x))));
    },
    [totalFrames, onSeekFrame],
  );

  const clipDragRef = useRef<{
    layerId: string;
    startX: number;
    origStart: number;
    origDuration: number;
    mode: "move" | "resize-l" | "resize-r";
  } | null>(null);

  const startClipDrag = (e: React.PointerEvent, layer: TemplateLayer, mode: "move" | "resize-l" | "resize-r") => {
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

  const onClipPointerUp = () => {
    clipDragRef.current = null;
  };

  const ticks: number[] = [];
  const tickInterval = fps >= 24 ? fps : 15;
  for (let f = 0; f <= totalFrames; f += tickInterval) ticks.push(f);

  const totalWidth = frameToX(totalFrames);
  const sortedLayers = [...currentScene.layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="flex flex-col border-t border-border bg-card/40">
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Timer size={12} />
        <span className="font-medium text-foreground">Timeline — {currentScene.name}</span>
        <span>
          {(currentFrame / fps).toFixed(2)}s / {(totalFrames / fps).toFixed(1)}s
        </span>
        <div className="ml-auto">
          <IconButton label={collapsed ? "Expandir" : "Recolher"} onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </IconButton>
        </div>
      </div>

      {!collapsed && (
        <div className="max-h-48 overflow-auto">
          {/* Ruler */}
          <div className="flex">
            <div className="w-32 shrink-0 border-r border-border" />
            <div
              ref={rulerRef}
              className="relative h-6 cursor-pointer border-b border-border"
              style={{ width: totalWidth, minWidth: "100%" }}
              onClick={handleRulerClick}
            >
              {ticks.map((f) => (
                <Fragment key={f}>
                  <div className="absolute bottom-0 top-0 w-px bg-border" style={{ left: frameToX(f) }} />
                  <span className="absolute top-0.5 text-[10px] text-muted-foreground" style={{ left: frameToX(f) + 2 }}>
                    {(f / fps).toFixed(1)}s
                  </span>
                </Fragment>
              ))}
              <div className="absolute bottom-0 top-0 z-10 w-0.5 bg-primary" style={{ left: frameToX(currentFrame) }} />
            </div>
          </div>

          {/* Tracks */}
          <div onPointerMove={onClipPointerMove} onPointerUp={onClipPointerUp}>
            {sortedLayers.map((layer) => {
              const layerStart = (layer as unknown as { startFrame?: number }).startFrame ?? 0;
              const layerEnd = (layer as unknown as { endFrame?: number }).endFrame ?? totalFrames;
              const clipLeft = frameToX(layerStart);
              const clipWidth = Math.max(8, frameToX(layerEnd - layerStart));
              const isSelected = layer.id === selectedLayerId;
              const color = LAYER_COLORS[layer.type] ?? "#6e56f8";

              return (
                <div key={layer.id} className="flex border-b border-border/50">
                  <button
                    className={cn(
                      "flex w-32 shrink-0 items-center gap-1.5 border-r border-border px-2 py-1.5 text-left text-xs transition-colors",
                      isSelected ? "bg-accent/50" : "hover:bg-accent/30",
                    )}
                    onClick={() => onSelectLayer(layer.id)}
                  >
                    <span
                      className="flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                      style={{ background: color + "33", color }}
                    >
                      {layer.type[0].toUpperCase()}
                    </span>
                    <span className="truncate">{layer.name}</span>
                  </button>
                  <div className="relative h-8 flex-1" style={{ minWidth: totalWidth }}>
                    <div className="absolute bottom-0 top-0 z-10 w-0.5 bg-primary" style={{ left: frameToX(currentFrame) }} />
                    <div
                      className="absolute top-1 flex h-6 cursor-move items-center overflow-hidden rounded border px-1 text-[10px] text-white"
                      style={{
                        left: clipLeft,
                        width: clipWidth,
                        background: isSelected ? color : color + "88",
                        borderColor: color,
                      }}
                      onPointerDown={(e) => startClipDrag(e, layer, "move")}
                    >
                      <div className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize" onPointerDown={(e) => startClipDrag(e, layer, "resize-l")} />
                      <span className="truncate pointer-events-none px-1">{layer.name}</span>
                      <div className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize" onPointerDown={(e) => startClipDrag(e, layer, "resize-r")} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
