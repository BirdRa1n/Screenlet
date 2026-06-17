import React, { useCallback, useEffect, useRef, useState } from "react";
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
import "../../styles/components/CanvasEditor.css";

type ResizeHandle =
  | "tl" | "tc" | "tr"
  | "ml" | "mr"
  | "bl" | "bc" | "br";

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

  // Compute stage size from container (16:9, fit in container)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      const padH = 80;
      const padV = 60;
      const availW = width - padH;
      const availH = height - padV;
      const byW = availW;
      const byH = availW * (9 / 16);
      let stageW: number, stageH: number;
      if (byH <= availH) {
        stageW = byW;
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

  // scale: canvas coords → stage coords
  // template is always 1920×1080; stage is stageSize
  const scaleX = stageSize.w / 1920;
  const scaleY = stageSize.h / 1080;

  const toStage = (val: number, axis: "x" | "w") =>
    val * (axis === "x" ? scaleX : scaleX);
  const toTemplate = (val: number) => val / scaleX;

  const selectedLayer = scene.layers.find((l) => l.id === selectedLayerId) ?? null;

  /* ── Pointer events ──────────────────────────────────────────────────── */

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
    [scene.layers, onSelectLayer]
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
        // Snap guides: show when within 8px of center (1920×1080)
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

      // resize
      const h = drag.handle!;
      let nx = drag.startX;
      let ny = drag.startY;
      let nw = drag.startW;
      let nh = drag.startH;

      if (h.includes("r")) nw = Math.max(20, drag.startW + dx);
      if (h.includes("l")) { nw = Math.max(20, drag.startW - dx); nx = drag.startX + drag.startW - nw; }
      if (h.includes("b")) nh = Math.max(20, drag.startH + dy);
      if (h.includes("t")) { nh = Math.max(20, drag.startH - dy); ny = drag.startY + drag.startH - nh; }
      // pure mid handles
      if (h === "tc" || h === "bc") nx = drag.startX;
      if (h === "ml" || h === "mr") ny = drag.startY;

      onUpdateLayer(selectedLayerId, {
        x: Math.round(nx),
        y: Math.round(ny),
        width: Math.round(nw),
        height: Math.round(nh),
      });
    },
    [selectedLayerId, scaleX, scaleY, onUpdateLayer]
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
      className="vt-canvas"
      onClick={() => onSelectLayer(null)}
    >
      {/* Toolbar */}
      <div className="vt-canvas__toolbar">
        <IconButton label="Zoom out" variant="ghost" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}>
          <ZoomOut size={13} />
        </IconButton>
        <span className="vt-canvas__zoom">{Math.round(zoom * 100)}%</span>
        <IconButton label="Zoom in" variant="ghost" onClick={() => setZoom((z) => Math.min(4, z + 0.1))}>
          <ZoomIn size={13} />
        </IconButton>
        <div className="vt-canvas__toolbar-sep" />
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
          <Layers size={11} style={{ display: "inline", marginRight: 3 }} />
          {scene.layers.length} layers
        </span>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="vt-canvas__stage"
        style={{
          width: stageSize.w * zoom,
          height: stageSize.h * zoom,
          background: scene.backgroundColor ?? "#000",
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => { e.stopPropagation(); onSelectLayer(null); }}
      >
        {scene.layers.length === 0 && (
          <div className="vt-canvas__empty">
            <Layers size={24} />
            <span>Sem layers nesta cena</span>
            <span style={{ fontSize: 11 }}>Adicione layers no painel esquerdo</span>
          </div>
        )}

        {/* Center guides — shown during snap */}
        {guides.v && (
          <div className="vt-canvas__ruler-v" style={{ left: "50%" }} />
        )}
        {guides.h && (
          <div className="vt-canvas__ruler-h" style={{ top: "50%" }} />
        )}
        {/* Always-visible faint center crosshair */}
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />

        {sortedLayers.map((layer) => {
          if (!layer.visible) return null;
          const isSelected = layer.id === selectedLayerId;
          const sx = layer.x * scaleX;
          const sy = layer.y * scaleY;
          const sw = layer.width * scaleX;
          const sh = layer.height * scaleY;

          return (
            <div
              key={layer.id}
              className={`vt-canvas__layer vt-canvas__layer--${layer.type}${isSelected ? " vt-canvas__layer--selected" : ""}`}
              style={{
                left: sx,
                top: sy,
                width: sw,
                height: sh,
                opacity: layer.opacity,
                transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                zIndex: layer.zIndex,
              }}
              onPointerDown={(e) => startDrag(e, layer.id, "move")}
              onClick={(e) => e.stopPropagation()}
            >
              <LayerContent layer={layer} values={values} scale={scaleX} />

              {/* Resize handles */}
              {isSelected && (
                <div className="vt-canvas__handles">
                  {HANDLES.map((h) => (
                    <div
                      key={h}
                      className={`vt-canvas__handle vt-canvas__handle--${h}`}
                      onPointerDown={(e) => startDrag(e, layer.id, "resize", h)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Layer content renderers ─────────────────────────────────────────────── */

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
    const src = layer.type === "logo"
      ? (values["LOGO"] ?? "")
      : resolveString(l.src, values);
    const displaySrc = src
      ? src.startsWith("http") ? src : staticFile(src)
      : "";
    const flipTransform = [l.flipX ? "scaleX(-1)" : "", l.flipY ? "scaleY(-1)" : ""].filter(Boolean).join(" ") || undefined;
    return displaySrc ? (
      <img
        src={displaySrc}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: l.fit ?? "contain", pointerEvents: "none", transform: flipTransform }}
        draggable={false}
      />
    ) : (
      <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 * scale, color: "rgba(255,255,255,0.3)" }}>
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
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", fontSize: 12 * scale, color: "#fff", flexDirection: "column" }}>
        <span>Preço</span>
      </div>
    );
  }

  return null;
};
