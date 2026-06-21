"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Player, type PlayerRef } from "@remotion/player";
import { staticFile } from "remotion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Type,
  ImageIcon,
  Square,
  Tag,
  Save,
  Copy,
  Eye,
  Layers,
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
} from "lucide-react";
import { Button, IconButton } from "../design-system/components";
import { MediaPickerDialog } from "../components/media/MediaPicker";
import { CanvasEditor } from "../components/builder/CanvasEditor";
import { Timeline } from "../components/builder/Timeline";
import { cn } from "@/lib/utils";
import { TemplateRenderer } from "../remotion/TemplateRenderer";
import { templateTotalFrames, defaultValues } from "../remotion/template-utils";
import { useTemplateStore } from "../store/useTemplateStore";
import { toast } from "../store/useToastStore";
import type {
  Template,
  TemplateScene,
  TemplateLayer,
  TextLayer,
  ShapeLayer,
  BadgeLayer,
  ImageLayer,
  LayerAnimation,
} from "../remotion/template-types";
import {
  defaultTextLayer,
  defaultImageLayer,
  defaultShapeLayer,
  defaultBadgeLayer,
} from "../remotion/template-types";

const inputCls =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
const labelCls = "text-[11px] font-medium text-muted-foreground";
const sectionTitleCls = "mb-2 text-xs font-semibold text-foreground";

const LAYER_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  image: "Imagem",
  logo: "Logo",
  price: "Preço",
  shape: "Forma",
  badge: "Badge",
  video: "Vídeo",
};

function newScene(index: number): TemplateScene {
  return {
    id: crypto.randomUUID(),
    name: `Cena ${index}`,
    durationInFrames: 90,
    backgroundColor: "#1a1a2e",
    layers: [],
  };
}

function emptyTemplate(): Template {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Novo Template",
    description: "",
    category: "Geral",
    tags: ["Geral"],
    thumbnail: "",
    version: "1.0",
    fps: 30,
    width: 1920,
    height: 1080,
    createdAt: now,
    updatedAt: now,
    variables: [],
    scenes: [newScene(1)],
    builtin: false,
  };
}

export const TemplateBuilder: React.FC<{ templateId?: string }> = ({ templateId }) => {
  const { templates, save, duplicate } = useTemplateStore();
  const router = useRouter();
  const playerRef = useRef<PlayerRef>(null);

  const existing = templateId ? templates.find((t) => t.id === templateId) : null;
  const [template, setTemplate] = useState<Template>(existing ?? emptyTemplate());
  const [selectedSceneId, setSelectedSceneId] = useState<string>(template.scenes[0]?.id ?? "");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [centerTab, setCenterTab] = useState<"canvas" | "preview">("canvas");
  const [currentFrame, setCurrentFrame] = useState(0);

  const selectedScene = template.scenes.find((s) => s.id === selectedSceneId);
  const selectedLayer = selectedScene?.layers.find((l) => l.id === selectedLayerId) ?? null;

  useEffect(() => {
    if (centerTab === "preview" && playerRef.current) {
      let sceneOffset = 0;
      for (const s of template.scenes) {
        if (s.id === selectedSceneId) break;
        sceneOffset += s.durationInFrames;
      }
      playerRef.current.seekTo(sceneOffset + currentFrame);
    }
  }, [currentFrame, centerTab, selectedSceneId, template.scenes]);

  const updateTemplate = useCallback((updater: (t: Template) => Template) => {
    setTemplate((prev) => updater(prev));
  }, []);

  const updateScene = useCallback(
    (sceneId: string, updater: (s: TemplateScene) => TemplateScene) => {
      updateTemplate((t) => ({ ...t, scenes: t.scenes.map((s) => (s.id === sceneId ? updater(s) : s)) }));
    },
    [updateTemplate],
  );

  const updateLayer = useCallback(
    (sceneId: string, layerId: string, patch: Partial<TemplateLayer>) => {
      updateScene(sceneId, (scene) => ({
        ...scene,
        layers: scene.layers.map((l) => (l.id === layerId ? ({ ...l, ...patch } as TemplateLayer) : l)),
      }));
    },
    [updateScene],
  );

  const addScene = () => {
    const scene = newScene(template.scenes.length + 1);
    updateTemplate((t) => ({ ...t, scenes: [...t.scenes, scene] }));
    setSelectedSceneId(scene.id);
    setSelectedLayerId(null);
  };

  const removeScene = (id: string) => {
    if (template.scenes.length <= 1) return;
    const remaining = template.scenes.filter((s) => s.id !== id);
    updateTemplate((t) => ({ ...t, scenes: remaining }));
    if (selectedSceneId === id) {
      setSelectedSceneId(remaining[0]?.id ?? "");
      setSelectedLayerId(null);
    }
  };

  const addLayer = (type: TemplateLayer["type"]) => {
    if (!selectedScene) return;
    let layer: TemplateLayer;
    if (type === "text") layer = defaultTextLayer();
    else if (type === "image") layer = defaultImageLayer();
    else if (type === "shape") layer = defaultShapeLayer();
    else layer = defaultBadgeLayer();

    updateScene(selectedSceneId, (s) => ({ ...s, layers: [...s.layers, { ...layer, zIndex: s.layers.length }] }));
    setSelectedLayerId(layer.id);
  };

  const removeLayer = (layerId: string) => {
    updateScene(selectedSceneId, (s) => ({ ...s, layers: s.layers.filter((l) => l.id !== layerId) }));
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ ...template, updatedAt: new Date().toISOString() });
      toast.success("Template salvo!");
    } catch {
      toast.error("Erro ao salvar template.");
    } finally {
      setSaving(false);
    }
  };

  const totalFrames = templateTotalFrames(template);
  const previewValues = defaultValues(template);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <IconButton label="Voltar" onClick={() => router.push("/templates")}>
          <ArrowLeft size={15} />
        </IconButton>
        <input
          className="flex-1 bg-transparent text-sm font-semibold outline-none"
          value={template.name}
          onChange={(e) => updateTemplate((t) => ({ ...t, name: e.target.value }))}
          placeholder="Nome do template"
        />
        <Button
          variant="secondary"
          size="sm"
          icon={<Copy size={13} />}
          onClick={async () => {
            await save({ ...template, updatedAt: new Date().toISOString() });
            await duplicate(template.id);
            toast.success("Template duplicado.");
            router.push("/templates");
          }}
        >
          Duplicar
        </Button>
        <Button variant="primary" size="sm" icon={<Save size={13} />} onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_280px]">
          {/* Left: scenes + layers */}
          <div className="flex flex-col overflow-y-auto border-r border-border">
            <PanelHeader>
              Cenas
              <IconButton label="Adicionar cena" onClick={addScene}>
                <Plus size={12} />
              </IconButton>
            </PanelHeader>
            <div className="flex flex-col gap-1 p-2">
              {template.scenes.map((scene) => (
                <div
                  key={scene.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors",
                    scene.id === selectedSceneId ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent/40",
                  )}
                  onClick={() => {
                    setSelectedSceneId(scene.id);
                    setSelectedLayerId(null);
                  }}
                >
                  <div className="size-4 shrink-0 rounded" style={{ background: scene.backgroundColor }} />
                  <span className="flex-1 truncate">{scene.name}</span>
                  <span className="text-muted-foreground">{(scene.durationInFrames / template.fps).toFixed(1)}s</span>
                  {template.scenes.length > 1 && (
                    <IconButton
                      label="Remover"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeScene(scene.id);
                      }}
                    >
                      <Trash2 size={11} />
                    </IconButton>
                  )}
                </div>
              ))}
            </div>

            <PanelHeader>
              <span className="flex items-center gap-1">
                <Layers size={11} /> Layers
              </span>
              <span className="flex gap-0.5">
                <IconButton label="Texto" onClick={() => addLayer("text")}>
                  <Type size={11} />
                </IconButton>
                <IconButton label="Imagem" onClick={() => addLayer("image")}>
                  <ImageIcon size={11} />
                </IconButton>
                <IconButton label="Forma" onClick={() => addLayer("shape")}>
                  <Square size={11} />
                </IconButton>
                <IconButton label="Badge" onClick={() => addLayer("badge")}>
                  <Tag size={11} />
                </IconButton>
              </span>
            </PanelHeader>
            <div className="flex flex-col gap-1 p-2">
              {selectedScene && selectedScene.layers.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">Nenhum layer</div>
              )}
              {selectedScene?.layers
                .slice()
                .sort((a, b) => b.zIndex - a.zIndex)
                .map((layer) => (
                  <div
                    key={layer.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors",
                      layer.id === selectedLayerId ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent/40",
                    )}
                    onClick={() => setSelectedLayerId(layer.id)}
                  >
                    <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                      {LAYER_TYPE_LABELS[layer.type] ?? layer.type}
                    </span>
                    <span className="flex-1 truncate">{layer.name}</span>
                    <IconButton
                      label="Remover"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLayer(layer.id);
                      }}
                    >
                      <Trash2 size={11} />
                    </IconButton>
                  </div>
                ))}
            </div>
          </div>

          {/* Center: canvas / preview */}
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex shrink-0 gap-1 border-b border-border px-3">
              {(["canvas", "preview"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCenterTab(tab)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                    centerTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab === "canvas" ? <Layers size={13} /> : <Eye size={13} />}
                  {tab === "canvas" ? "Editor" : "Preview"}
                </button>
              ))}
            </div>

            {centerTab === "canvas" && selectedScene && (
              <CanvasEditor
                scene={selectedScene}
                values={previewValues}
                currentFrame={currentFrame}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
                onUpdateLayer={(layerId, patch) => updateLayer(selectedSceneId, layerId, patch)}
              />
            )}

            {centerTab === "preview" && (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="w-[min(640px,100%)] overflow-hidden rounded-lg shadow-lg">
                  <Player
                    ref={playerRef}
                    component={TemplateRenderer}
                    inputProps={{ template, values: previewValues }}
                    durationInFrames={Math.max(totalFrames, 1)}
                    fps={template.fps}
                    compositionWidth={template.width}
                    compositionHeight={template.height}
                    style={{ width: "100%", aspectRatio: "16/9", display: "block" }}
                    controls
                    loop
                    acknowledgeRemotionLicense
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: properties */}
          <div className="flex flex-col overflow-y-auto border-l border-border">
            <PanelHeader>Propriedades</PanelHeader>
            <div className="flex flex-col gap-5 p-3">
              {!selectedLayer && selectedScene && (
                <SceneProps scene={selectedScene} fps={template.fps} onChange={(updated) => updateScene(selectedSceneId, () => updated)} />
              )}
              {selectedLayer && selectedScene && (
                <LayerProps
                  layer={selectedLayer}
                  onChange={(updated) => updateLayer(selectedSceneId, selectedLayer.id, updated as Partial<TemplateLayer>)}
                  sceneDuration={selectedScene.durationInFrames}
                  fps={template.fps}
                />
              )}
              {!selectedScene && <div className="text-xs text-muted-foreground">Selecione uma cena</div>}
            </div>

            <PanelHeader>Variáveis</PanelHeader>
            <div className="flex flex-col gap-1 p-3">
              {template.variables.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma variável definida.</div>}
              {template.variables.map((v) => (
                <div key={v.key} className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-muted px-1 font-mono text-[10px] text-primary">{`{{${v.key}}}`}</span>
                  <span className="text-muted-foreground">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {selectedScene && (
          <Timeline
            template={template}
            currentScene={selectedScene}
            selectedLayerId={selectedLayerId}
            currentFrame={currentFrame}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={updateLayer}
            onSeekFrame={setCurrentFrame}
          />
        )}
      </div>
    </div>
  );
};

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

const SceneProps: React.FC<{
  scene: TemplateScene;
  fps: number;
  onChange: (s: TemplateScene) => void;
}> = ({ scene, fps, onChange }) => (
  <div>
    <div className={sectionTitleCls}>Cena</div>
    <div className="flex flex-col gap-3">
      <FieldRow label="Nome">
        <input className={inputCls} value={scene.name} onChange={(e) => onChange({ ...scene, name: e.target.value })} />
      </FieldRow>
      <FieldRow label="Duração (frames)">
        <input
          className={inputCls}
          type="number"
          min={1}
          value={scene.durationInFrames}
          onChange={(e) => onChange({ ...scene, durationInFrames: Math.max(1, parseInt(e.target.value) || 1) })}
        />
        <span className="text-[10px] text-muted-foreground">{(scene.durationInFrames / fps).toFixed(2)}s a {fps}fps</span>
      </FieldRow>
      <FieldRow label="Cor de fundo">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={scene.backgroundColor}
            onChange={(e) => onChange({ ...scene, backgroundColor: e.target.value })}
            className="size-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
          />
          <input className={inputCls} value={scene.backgroundColor} onChange={(e) => onChange({ ...scene, backgroundColor: e.target.value })} />
        </div>
      </FieldRow>
    </div>
  </div>
);

const ANIM_PRESETS: Array<{ label: string; anim: Omit<LayerAnimation, "startFrame"> & { startFrame: number } }> = [
  { label: "Fade In", anim: { type: "fadeIn", startFrame: 0, durationInFrames: 15, easing: "easeOut" } },
  { label: "Slide ←", anim: { type: "slideLeft", startFrame: 0, durationInFrames: 20, easing: "easeOut" } },
  { label: "Slide →", anim: { type: "slideRight", startFrame: 0, durationInFrames: 20, easing: "easeOut" } },
  { label: "Slide ↑", anim: { type: "slideUp", startFrame: 0, durationInFrames: 20, easing: "easeOut" } },
  { label: "Slide ↓", anim: { type: "slideDown", startFrame: 0, durationInFrames: 20, easing: "easeOut" } },
  { label: "Zoom In", anim: { type: "zoomIn", startFrame: 0, durationInFrames: 20, easing: "easeOut" } },
  { label: "Pulse", anim: { type: "pulse", startFrame: 0, durationInFrames: 30, easing: "easeInOut" } },
  { label: "Bounce", anim: { type: "bounce", startFrame: 0, durationInFrames: 30, easing: "easeInOut" } },
  { label: "Girar", anim: { type: "rotate", startFrame: 0, durationInFrames: 30, easing: "easeOut" } },
  { label: "Glow", anim: { type: "glow", startFrame: 0, durationInFrames: 60, easing: "easeInOut" } },
  { label: "Shake", anim: { type: "shake", startFrame: 0, durationInFrames: 15, easing: "linear" } },
  { label: "Typewriter", anim: { type: "typewriter", startFrame: 0, durationInFrames: 60, easing: "linear" } },
];

const ANIM_LABELS: Record<string, string> = {
  fadeIn: "Fade In", slideLeft: "Slide ←", slideRight: "Slide →",
  slideUp: "Slide ↑", slideDown: "Slide ↓", zoomIn: "Zoom In",
  pulse: "Pulse", bounce: "Bounce", rotate: "Girar",
  glow: "Glow", shake: "Shake", typewriter: "Typewriter",
  fadeOut: "Fade Out", slideOut: "Slide Out", zoomOut: "Zoom Out", scale: "Scale",
};

const AnimationsSection: React.FC<{
  layer: TemplateLayer;
  onChange: (patch: Partial<TemplateLayer>) => void;
  fps: number;
}> = ({ layer, onChange, fps }) => {
  const appliedTypes = new Set(layer.animations.map((a) => a.type));

  const applyPreset = (preset: (typeof ANIM_PRESETS)[0]) => {
    if (appliedTypes.has(preset.anim.type)) return;
    onChange({ animations: [...layer.animations, { ...preset.anim }] });
  };
  const removeAnim = (type: string) => onChange({ animations: layer.animations.filter((a) => a.type !== type) });

  return (
    <div>
      <div className={sectionTitleCls}>Animações</div>
      {layer.animations.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1">
          {layer.animations.map((a) => (
            <div key={a.type} className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              <span>{ANIM_LABELS[a.type] ?? a.type}</span>
              <span className="opacity-70">{(a.startFrame / fps).toFixed(1)}s</span>
              <button onClick={() => removeAnim(a.type)} className="ml-0.5 leading-none">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-1">
        {ANIM_PRESETS.filter((p) => p.anim.type !== "typewriter" || layer.type === "text").map((preset) => {
          const active = appliedTypes.has(preset.anim.type);
          return (
            <button
              key={preset.anim.type}
              onClick={() => (active ? removeAnim(preset.anim.type) : applyPreset(preset))}
              className={cn(
                "rounded-md border px-1 py-1.5 text-[10px] font-medium transition-colors",
                active ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      {layer.animations.length > 0 && (
        <button onClick={() => onChange({ animations: [] })} className="mt-2 text-[10px] text-muted-foreground hover:text-foreground">
          Limpar todas animações
        </button>
      )}
    </div>
  );
};

const LayerProps: React.FC<{
  layer: TemplateLayer;
  onChange: (patch: Partial<TemplateLayer>) => void;
  sceneDuration: number;
  fps: number;
}> = ({ layer, onChange, sceneDuration, fps }) => {
  const [localName, setLocalName] = useState(layer.name);
  const layerIdRef = useRef(layer.id);
  useEffect(() => {
    if (layer.id !== layerIdRef.current) {
      layerIdRef.current = layer.id;
      setLocalName(layer.name);
    }
  });

  const ALIGN = [
    { label: "Esquerda", icon: <AlignStartVertical size={13} />, x: 0, y: undefined as number | undefined },
    { label: "H. Centro", icon: <AlignHorizontalJustifyCenter size={13} />, x: Math.round((1920 - layer.width) / 2), y: undefined },
    { label: "Direita", icon: <AlignEndVertical size={13} />, x: 1920 - layer.width, y: undefined },
    { label: "Centro", icon: <AlignCenter size={13} />, x: Math.round((1920 - layer.width) / 2), y: Math.round((1080 - layer.height) / 2) },
    { label: "Topo", icon: <AlignStartHorizontal size={13} />, x: undefined, y: 0 },
    { label: "V. Centro", icon: <AlignVerticalJustifyCenter size={13} />, x: undefined, y: Math.round((1080 - layer.height) / 2) },
    { label: "Baixo", icon: <AlignEndHorizontal size={13} />, x: undefined, y: 1080 - layer.height },
  ];

  return (
    <>
      <div>
        <div className={sectionTitleCls}>Layer — {LAYER_TYPE_LABELS[layer.type]}</div>
        <FieldRow label="Nome">
          <input
            className={inputCls}
            value={localName}
            onChange={(e) => {
              setLocalName(e.target.value);
              onChange({ name: e.target.value });
            }}
          />
        </FieldRow>
      </div>

      <div>
        <div className={sectionTitleCls}>Posição & Tamanho</div>
        <div className="grid grid-cols-2 gap-2">
          {(["x", "y", "width", "height"] as const).map((prop) => (
            <FieldRow key={prop} label={prop.toUpperCase()}>
              <input
                className={inputCls}
                type="number"
                value={(layer as unknown as Record<string, number>)[prop]}
                onChange={(e) => onChange({ [prop]: parseFloat(e.target.value) || 0 })}
              />
            </FieldRow>
          ))}
          <FieldRow label="Opacidade">
            <input className={inputCls} type="number" min={0} max={1} step={0.05} value={layer.opacity} onChange={(e) => onChange({ opacity: parseFloat(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Z-Index">
            <input className={inputCls} type="number" value={layer.zIndex} onChange={(e) => onChange({ zIndex: parseInt(e.target.value) || 0 })} />
          </FieldRow>
        </div>
      </div>

      <div>
        <div className={sectionTitleCls}>Alinhar na cena</div>
        <div className="grid grid-cols-4 gap-1">
          {ALIGN.map(({ label, icon, x, y }) => (
            <button
              key={label}
              title={label}
              onClick={() => onChange({ ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) })}
              className="flex flex-col items-center gap-1 rounded-md border border-border bg-card px-1 py-1.5 text-[9px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={sectionTitleCls}>Timing</div>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Início (frame)">
            <input
              className={inputCls}
              type="number"
              min={0}
              max={sceneDuration - 1}
              value={layer.startFrame ?? 0}
              onChange={(e) => onChange({ startFrame: Math.max(0, parseInt(e.target.value) || 0) })}
            />
          </FieldRow>
          <FieldRow label="Fim (frame)">
            <input
              className={inputCls}
              type="number"
              min={1}
              max={sceneDuration}
              value={layer.endFrame ?? sceneDuration}
              onChange={(e) => onChange({ endFrame: Math.min(sceneDuration, parseInt(e.target.value) || sceneDuration) })}
            />
          </FieldRow>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          {((layer.startFrame ?? 0) / fps).toFixed(2)}s → {((layer.endFrame ?? sceneDuration) / fps).toFixed(2)}s de {(sceneDuration / fps).toFixed(2)}s
        </div>
        {(layer.startFrame !== undefined || layer.endFrame !== undefined) && (
          <button onClick={() => onChange({ startFrame: undefined, endFrame: undefined })} className="mt-1 text-[10px] text-primary hover:underline">
            ↩ Usar duração completa da cena
          </button>
        )}
      </div>

      <AnimationsSection layer={layer} onChange={onChange} fps={fps} />

      {layer.type === "text" && <TextLayerProps layer={layer as TextLayer} onChange={onChange} />}
      {layer.type === "shape" && <ShapeLayerProps layer={layer as ShapeLayer} onChange={onChange} />}
      {layer.type === "badge" && <BadgeLayerProps layer={layer as BadgeLayer} onChange={onChange} />}
      {layer.type === "image" && <ImageLayerProps layer={layer as ImageLayer} onChange={onChange} />}
    </>
  );
};

const TextLayerProps: React.FC<{ layer: TextLayer; onChange: (p: Partial<TemplateLayer>) => void }> = ({ layer, onChange }) => {
  const [localText, setLocalText] = useState(layer.text);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined as unknown as ReturnType<typeof setTimeout>);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const layerIdRef = useRef(layer.id);
  if (layer.id !== layerIdRef.current) {
    layerIdRef.current = layer.id;
    setLocalText(layer.text);
  }
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div>
      <div className={sectionTitleCls}>Texto</div>
      <FieldRow label="Conteúdo">
        <input
          className={inputCls}
          value={localText}
          onChange={(e) => {
            const val = e.target.value;
            setLocalText(val);
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => onChangeRef.current({ text: val } as Partial<TextLayer>), 300);
          }}
          onBlur={(e) => {
            clearTimeout(timerRef.current);
            onChangeRef.current({ text: e.target.value } as Partial<TextLayer>);
          }}
          placeholder="Use {{VAR}} para variáveis"
        />
      </FieldRow>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <FieldRow label="Tamanho">
          <input className={inputCls} type="number" value={layer.fontSize} onChange={(e) => onChange({ fontSize: parseInt(e.target.value) || 24 } as Partial<TextLayer>)} />
        </FieldRow>
        <FieldRow label="Peso">
          <input className={inputCls} type="number" step={100} min={100} max={900} value={layer.fontWeight} onChange={(e) => onChange({ fontWeight: parseInt(e.target.value) || 400 } as Partial<TextLayer>)} />
        </FieldRow>
      </div>
      <div className="mt-2">
        <FieldRow label="Cor">
          <div className="flex items-center gap-2">
            <input type="color" value={layer.color} onChange={(e) => onChange({ color: e.target.value } as Partial<TextLayer>)} className="size-8 shrink-0 cursor-pointer rounded border border-border bg-transparent" />
            <input className={inputCls} value={layer.color} onChange={(e) => onChange({ color: e.target.value } as Partial<TextLayer>)} />
          </div>
        </FieldRow>
      </div>
      <div className="mt-2">
        <FieldRow label="Alinhamento">
          <select className={inputCls} value={layer.align} onChange={(e) => onChange({ align: e.target.value as TextLayer["align"] } as Partial<TextLayer>)}>
            <option value="left">Esquerda</option>
            <option value="center">Centro</option>
            <option value="right">Direita</option>
          </select>
        </FieldRow>
      </div>
    </div>
  );
};

const ShapeLayerProps: React.FC<{ layer: ShapeLayer; onChange: (p: Partial<TemplateLayer>) => void }> = ({ layer, onChange }) => (
  <div>
    <div className={sectionTitleCls}>Forma</div>
    <FieldRow label="Tipo">
      <select className={inputCls} value={layer.shape} onChange={(e) => onChange({ shape: e.target.value as ShapeLayer["shape"] } as Partial<ShapeLayer>)}>
        <option value="rect">Retângulo</option>
        <option value="circle">Círculo</option>
      </select>
    </FieldRow>
    <div className="mt-2">
      <FieldRow label="Preenchimento">
        <div className="flex items-center gap-2">
          <input type="color" value={layer.fill} onChange={(e) => onChange({ fill: e.target.value } as Partial<ShapeLayer>)} className="size-8 shrink-0 cursor-pointer rounded border border-border bg-transparent" />
          <input className={inputCls} value={layer.fill} onChange={(e) => onChange({ fill: e.target.value } as Partial<ShapeLayer>)} />
        </div>
      </FieldRow>
    </div>
    {layer.shape === "rect" && (
      <div className="mt-2">
        <FieldRow label="Border Radius">
          <input className={inputCls} type="number" value={layer.borderRadius ?? 0} onChange={(e) => onChange({ borderRadius: parseInt(e.target.value) || 0 } as Partial<ShapeLayer>)} />
        </FieldRow>
      </div>
    )}
  </div>
);

const BadgeLayerProps: React.FC<{ layer: BadgeLayer; onChange: (p: Partial<TemplateLayer>) => void }> = ({ layer, onChange }) => {
  const [localText, setLocalText] = useState(layer.text);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined as unknown as ReturnType<typeof setTimeout>);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const layerIdRef = useRef(layer.id);
  if (layer.id !== layerIdRef.current) {
    layerIdRef.current = layer.id;
    setLocalText(layer.text);
  }
  useEffect(() => () => clearTimeout(timerRef.current), []);
  return (
    <div>
      <div className={sectionTitleCls}>Badge</div>
      <FieldRow label="Texto">
        <input
          className={inputCls}
          value={localText}
          onChange={(e) => {
            const val = e.target.value;
            setLocalText(val);
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => onChangeRef.current({ text: val } as Partial<BadgeLayer>), 300);
          }}
          onBlur={(e) => {
            clearTimeout(timerRef.current);
            onChangeRef.current({ text: e.target.value } as Partial<BadgeLayer>);
          }}
        />
      </FieldRow>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <FieldRow label="Fundo">
          <input type="color" value={layer.bg} onChange={(e) => onChange({ bg: e.target.value } as Partial<BadgeLayer>)} className="h-8 w-full cursor-pointer rounded border border-border bg-transparent" />
        </FieldRow>
        <FieldRow label="Cor texto">
          <input type="color" value={layer.textColor} onChange={(e) => onChange({ textColor: e.target.value } as Partial<BadgeLayer>)} className="h-8 w-full cursor-pointer rounded border border-border bg-transparent" />
        </FieldRow>
      </div>
      <div className="mt-2">
        <FieldRow label="Tamanho fonte">
          <input className={inputCls} type="number" value={layer.fontSize} onChange={(e) => onChange({ fontSize: parseInt(e.target.value) || 28 } as Partial<BadgeLayer>)} />
        </FieldRow>
      </div>
    </div>
  );
};

const ImageLayerProps: React.FC<{ layer: ImageLayer; onChange: (p: Partial<TemplateLayer>) => void }> = ({ layer, onChange }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const displaySrc =
    layer.src && !layer.src.startsWith("{{") ? (layer.src.startsWith("http") ? layer.src : staticFile(layer.src)) : null;

  return (
    <div>
      <div className={sectionTitleCls}>Imagem</div>

      <div className="mb-3 flex items-start gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {displaySrc ? (
            <img src={displaySrc} alt="" className="size-full object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <ImageIcon size={22} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <ImageIcon size={13} />
            {layer.src ? "Trocar imagem" : "Selecionar imagem"}
          </button>
          {layer.src && <span className="break-all text-[10px] text-muted-foreground">{layer.src}</span>}
        </div>
      </div>

      <MediaPickerDialog
        open={pickerOpen}
        accept="image"
        currentValue={layer.src}
        onSelect={(path) => {
          onChange({ src: path } as Partial<ImageLayer>);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />

      <FieldRow label="Variável (opcional)">
        <input
          className={inputCls}
          value={layer.src.startsWith("{{") ? layer.src : ""}
          onChange={(e) => onChange({ src: e.target.value } as Partial<ImageLayer>)}
          placeholder="Ex: {{PRODUCT_IMAGE}}"
        />
      </FieldRow>

      <div className="mt-2">
        <FieldRow label="Encaixe">
          <select className={inputCls} value={layer.fit} onChange={(e) => onChange({ fit: e.target.value as ImageLayer["fit"] } as Partial<ImageLayer>)}>
            <option value="contain">Contain — preserva proporção</option>
            <option value="cover">Cover — preenche tudo</option>
          </select>
        </FieldRow>
      </div>

      <div className="mt-3">
        <div className={sectionTitleCls}>Inverter imagem</div>
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ flipX: !layer.flipX } as Partial<ImageLayer>)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
              layer.flipX ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-foreground hover:bg-accent",
            )}
          >
            Horizontal
          </button>
          <button
            onClick={() => onChange({ flipY: !layer.flipY } as Partial<ImageLayer>)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
              layer.flipY ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-foreground hover:bg-accent",
            )}
          >
            Vertical
          </button>
        </div>
      </div>
    </div>
  );
};
