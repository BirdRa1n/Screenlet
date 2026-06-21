"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { staticFile } from "remotion";
import { Layers, ZoomIn, ZoomOut } from "lucide-react";
import { IconButton } from "../../design-system/components";
import { resolveString } from "../../remotion/template-utils";
import type {
  TemplateLayer,
  TemplateScene,
  TemplateValues,
  TextLayer,
  ImageLayer,
  ShapeLayer,
  BadgeLayer,
} from "../../remotion/template-types";

type ResizeHandle = "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";

type DragState = {
  type: "move" | "resize";
  handle?: ResizeHandle;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
};

type Props = {
  scene: TemplateScene;
  values: TemplateValues;
  currentFrame?: number;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (layerId: string, patch: Partial<TemplateLayer>) => void;
};

const HANDLES: ResizeHandle[] = ["tl", "tc", "tr", "ml", "mr", "bl", "bc", "br"];

// Position (as % of layer box) and cursor for each resize handle.
const HANDLE_POS: Record<ResizeHandle, { left: string; top: string; cursor: string }> = {
  tl: { left: "0%", top: "0%", cursor: "nwse-resize" },
  tc: { left: "50%", top: "0%", cursor: "ns-resize" },
  tr: { left: "100%", top: "0%", cursor: "nesw-resize" },
  ml: { left: "0%", top: "50%", cursor: "ew-resize" },
  mr: { left: "100%", top: "50%", cursor: "ew-resize" },
  bl: { left: "0%", top: "100%", cursor: "nesw-resize" },
  bc: { left: "50%", top: "100%", cursor: "ns-resize" },
  br: { left: "100%", top: "100%", cursor: "nwse-resize" },
};

export const CanvasEditor: React.FC<Props> = ({
  scene,
  values,
  currentFrame = 0,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [stageSize, setStageSize] = useState({ w: 960, h: 540 });
  const [guides, setGuides] = useState<{ h: boolean; v: boolean }>({ h: false, v: false });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      const availW = width - 80;
      const availH = height - 60;
      const byH = availW * (9 / 16);
      let stageW: number, stageH: number;
      if (byH <= availH) {
        stageW = availW;
        stageH = byH;
      } else {
        stageH = availH;
        stageW = availH * (16 / 9);
      }
      setStageSize({ w: Math.floor(stageW), h: Math.floor(stageH) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const scaleX = stageSize.w / 1920;
  const scaleY = stageSize.h / 1080;

  const startDrag = useCallback(
    (e: React.PointerEvent, layerId: string, type: "move" | "resize", handle?: ResizeHandle) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const layer = scene.layers.find((l) => l.id === layerId);
      if (!layer) return;
      onSelectLayer(layerId);
      dragRef.current = {
        type,
        handle,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: layer.x,
        startY: layer.y,
        startW: layer.width,
        startH: layer.height,
      };
    },
    [scene.layers, onSelectLayer],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !selectedLayerId) return;

      const dx = (e.clientX - drag.startMouseX) / scaleX;
      const dy = (e.clientY - drag.startMouseY) / scaleY;

      if (drag.type === "move") {
        const layer = scene.layers.find((l) => l.id === selectedLayerId);
        const newX = Math.round(drag.startX + dx);
        const newY = Math.round(drag.startY + dy);
        const centerX = Math.round((1920 - (layer?.width ?? 0)) / 2);
        const centerY = Math.round((1080 - (layer?.height ?? 0)) / 2);
        const snapThreshold = 8;
        const snapH = Math.abs(newY - centerY) < snapThreshold;
        const snapV = Math.abs(newX - centerX) < snapThreshold;
        setGuides({ h: snapH, v: snapV });
        onUpdateLayer(selectedLayerId, {
          x: snapV ? centerX : newX,
          y: snapH ? centerY : newY,
        });
        return;
      }

      const h = drag.handle!;
      let nx = drag.startX;
      let ny = drag.startY;
      let nw = drag.startW;
      let nh = drag.startH;

      if (h.includes("r")) nw = Math.max(20, drag.startW + dx);
      if (h.includes("l")) {
        nw = Math.max(20, drag.startW - dx);
        nx = drag.startX + drag.startW - nw;
      }
      if (h.includes("b")) nh = Math.max(20, drag.startH + dy);
      if (h.includes("t")) {
        nh = Math.max(20, drag.startH - dy);
        ny = drag.startY + drag.startH - nh;
      }
      if (h === "tc" || h === "bc") nx = drag.startX;
      if (h === "ml" || h === "mr") ny = drag.startY;

      onUpdateLayer(selectedLayerId, {
        x: Math.round(nx),
        y: Math.round(ny),
        width: Math.round(nw),
        height: Math.round(nh),
      });
    },
    [selectedLayerId, scaleX, scaleY, onUpdateLayer, scene.layers],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setGuides({ h: false, v: false });
  }, []);

  const sortedLayers = [...scene.layers]
    .sort((a, b) => a.zIndex - b.zIndex)
    .filter((l) => {
      const start = l.startFrame ?? 0;
      const end = l.endFrame ?? scene.durationInFrames;
      return currentFrame >= start && currentFrame <= end;
    });

  return (
    <div
      ref={containerRef}
      className="relative flex size-full items-center justify-center overflow-hidden bg-muted/30"
      onClick={() => onSelectLayer(null)}
    >
      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2 py-1 backdrop-blur">
        <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}>
          <ZoomOut size={13} />
        </IconButton>
        <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.1))}>
          <ZoomIn size={13} />
        </IconButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Layers size={11} />
          {scene.layers.length} layers
        </span>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="relative shadow-lg"
        style={{
          width: stageSize.w * zoom,
          height: stageSize.h * zoom,
          background: scene.backgroundColor ?? "#000",
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => {
          e.stopPropagation();
          onSelectLayer(null);
        }}
      >
        {scene.layers.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/40">
            <Layers size={24} />
            <span className="text-sm">Sem layers nesta cena</span>
            <span className="text-xs">Adicione layers no painel esquerdo</span>
          </div>
        )}

        {guides.v && <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-primary" style={{ left: "50%" }} />}
        {guides.h && <div className="pointer-events-none absolute left-0 right-0 z-20 h-px bg-primary" style={{ top: "50%" }} />}
        <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-white/5" style={{ left: "50%" }} />
        <div className="pointer-events-none absolute left-0 right-0 h-px bg-white/5" style={{ top: "50%" }} />

        {sortedLayers.map((layer) => {
          if (!layer.visible) return null;
          const isSelected = layer.id === selectedLayerId;
          return (
            <div
              key={layer.id}
              className="absolute"
              style={{
                left: layer.x * scaleX,
                top: layer.y * scaleY,
                width: layer.width * scaleX,
                height: layer.height * scaleY,
                opacity: layer.opacity,
                transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                zIndex: layer.zIndex,
                outline: isSelected ? "2px solid var(--primary)" : undefined,
                cursor: "move",
              }}
              onPointerDown={(e) => startDrag(e, layer.id, "move")}
              onClick={(e) => e.stopPropagation()}
            >
              <LayerContent layer={layer} values={values} scale={scaleX} />

              {isSelected &&
                HANDLES.map((h) => {
                  const pos = HANDLE_POS[h];
                  return (
                    <div
                      key={h}
                      className="absolute z-30 size-2.5 rounded-sm border border-primary bg-background"
                      style={{
                        left: pos.left,
                        top: pos.top,
                        transform: "translate(-50%, -50%)",
                        cursor: pos.cursor,
                      }}
                      onPointerDown={(e) => startDrag(e, layer.id, "resize", h)}
                    />
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LayerContent: React.FC<{
  layer: TemplateLayer;
  values: TemplateValues;
  scale: number;
}> = ({ layer, values, scale }) => {
  if (layer.type === "text") {
    const l = layer as TextLayer;
    return (
      <span
        style={{
          fontSize: l.fontSize * scale,
          fontWeight: l.fontWeight,
          color: l.color,
          textAlign: l.align,
          lineHeight: l.lineHeight ?? 1.2,
          letterSpacing: l.letterSpacing,
          width: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      >
        {resolveString(l.text, values)}
      </span>
    );
  }

  if (layer.type === "image" || layer.type === "logo") {
    const l = layer as ImageLayer;
    const src = layer.type === "logo" ? values["LOGO"] ?? "" : resolveString(l.src, values);
    const displaySrc = src ? (src.startsWith("http") ? src : staticFile(src)) : "";
    const flipTransform =
      [l.flipX ? "scaleX(-1)" : "", l.flipY ? "scaleY(-1)" : ""].filter(Boolean).join(" ") || undefined;
    return displaySrc ? (
      <img
        src={displaySrc}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: l.fit ?? "contain", pointerEvents: "none", transform: flipTransform }}
        draggable={false}
      />
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11 * scale,
          color: "rgba(255,255,255,0.3)",
        }}
      >
        {layer.type === "logo" ? "Logo" : "Imagem"}
      </div>
    );
  }

  if (layer.type === "shape") {
    const l = layer as ShapeLayer;
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: l.fill,
          borderRadius: l.shape === "circle" ? "50%" : l.borderRadius ?? 0,
          pointerEvents: "none",
        }}
      />
    );
  }

  if (layer.type === "badge") {
    const l = layer as BadgeLayer;
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: l.bg,
          color: l.textColor,
          borderRadius: l.borderRadius ?? 99,
          fontSize: l.fontSize * scale,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {resolveString(l.text, values)}
      </div>
    );
  }

  if (layer.type === "price") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          fontSize: 12 * scale,
          color: "#fff",
          flexDirection: "column",
        }}
      >
        <span>Preço</span>
      </div>
    );
  }

  return null;
};
