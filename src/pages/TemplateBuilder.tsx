import React, { useState, useCallback, useRef, useEffect } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { staticFile } from "remotion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Type,
  Image,
  Square,
  Tag,
  Save,
  Copy,
  Eye,
  Layers,
  Upload,
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
} from "lucide-react";
import { Button, IconButton } from "../design-system/components";
import { CanvasEditor } from "../components/builder/CanvasEditor";
import { Timeline } from "../components/builder/Timeline";
import { TemplateRenderer } from "../remotion/TemplateRenderer";
import { templateTotalFrames, defaultValues } from "../remotion/template-utils";
import { useTemplateStore } from "../store/useTemplateStore";
import { useNavigationStore } from "../store/useNavigationStore";
import { useTemplateInstanceStore } from "../store/useTemplateInstanceStore";
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
import "../styles/pages/TemplateBuilder.css";

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
  const navigate = useNavigationStore((s) => s.navigate);
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

  // Sync timeline seek → Player
  useEffect(() => {
    if (centerTab === "preview" && playerRef.current) {
      // Compute absolute frame: offset of selected scene + currentFrame
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
      updateTemplate((t) => ({
        ...t,
        scenes: t.scenes.map((s) => (s.id === sceneId ? updater(s) : s)),
      }));
    },
    [updateTemplate]
  );

  const updateLayer = useCallback(
    (sceneId: string, layerId: string, patch: Partial<TemplateLayer>) => {
      updateScene(sceneId, (scene) => ({
        ...scene,
        layers: scene.layers.map((l) =>
          l.id === layerId ? { ...l, ...patch } as TemplateLayer : l
        ),
      }));
    },
    [updateScene]
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

    updateScene(selectedSceneId, (s) => ({
      ...s,
      layers: [...s.layers, { ...layer, zIndex: s.layers.length }],
    }));
    setSelectedLayerId(layer.id);
  };

  const removeLayer = (layerId: string) => {
    updateScene(selectedSceneId, (s) => ({
      ...s,
      layers: s.layers.filter((l) => l.id !== layerId),
    }));
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
    <div className="vt-tb">
      {/* Top bar */}
      <div className="vt-tb__topbar">
        <IconButton label="Voltar" onClick={() => navigate("templates")}>
          <ArrowLeft size={15} />
        </IconButton>
        <div className="vt-tb__title">
          <input
            value={template.name}
            onChange={(e) => updateTemplate((t) => ({ ...t, name: e.target.value }))}
            placeholder="Nome do template"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Copy size={13} />}
          onClick={async () => {
            await save({ ...template, updatedAt: new Date().toISOString() });
            await duplicate(template.id);
            toast.success("Template duplicado.");
            navigate("templates");
          }}
        >
          Duplicar
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<Save size={13} />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="vt-tb__workspace">
        <div className="vt-tb__panels">
          {/* Left: scenes + layers */}
          <div className="vt-tb__left">
            <div className="vt-tb__panel-header">
              Cenas
              <IconButton label="Adicionar cena" onClick={addScene}>
                <Plus size={12} />
              </IconButton>
            </div>
            <div className="vt-tb__scene-list">
              {template.scenes.map((scene) => (
                <div
                  key={scene.id}
                  className={`vt-tb__scene-item${scene.id === selectedSceneId ? " vt-tb__scene-item--active" : ""}`}
                  onClick={() => {
                    setSelectedSceneId(scene.id);
                    setSelectedLayerId(null);
                  }}
                >
                  <div className="vt-tb__scene-icon" style={{ background: scene.backgroundColor }} />
                  <span className="vt-tb__scene-name">{scene.name}</span>
                  <span className="vt-tb__scene-dur">
                    {(scene.durationInFrames / template.fps).toFixed(1)}s
                  </span>
                  {template.scenes.length > 1 && (
                    <IconButton
                      label="Remover"
                      variant="default"
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

            <div className="vt-tb__panel-header">
              <Layers size={11} /> Layers
              <div style={{ display: "flex", gap: 2 }}>
                <IconButton label="Texto" onClick={() => addLayer("text")}><Type size={11} /></IconButton>
                <IconButton label="Imagem" onClick={() => addLayer("image")}><Image size={11} /></IconButton>
                <IconButton label="Forma" onClick={() => addLayer("shape")}><Square size={11} /></IconButton>
                <IconButton label="Badge" onClick={() => addLayer("badge")}><Tag size={11} /></IconButton>
              </div>
            </div>
            <div className="vt-tb__layer-list">
              {selectedScene && selectedScene.layers.length === 0 && (
                <div className="vt-tb__empty" style={{ minHeight: 60 }}>Nenhum layer</div>
              )}
              {selectedScene?.layers
                .slice()
                .sort((a, b) => b.zIndex - a.zIndex)
                .map((layer) => (
                  <div
                    key={layer.id}
                    className={`vt-tb__layer-item${layer.id === selectedLayerId ? " vt-tb__layer-item--active" : ""}`}
                    onClick={() => setSelectedLayerId(layer.id)}
                  >
                    <span className="vt-tb__layer-type">
                      {LAYER_TYPE_LABELS[layer.type] ?? layer.type}
                    </span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {layer.name}
                    </span>
                    <IconButton
                      label="Remover"
                      variant="default"
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

          {/* Center: canvas / preview tabs */}
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", padding: "0 12px", background: "var(--surface-1)", flexShrink: 0 }}>
              {(["canvas", "preview"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCenterTab(tab)}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 500,
                    border: "none",
                    background: "transparent",
                    color: centerTab === tab ? "var(--text-primary)" : "var(--text-tertiary)",
                    borderBottom: centerTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {tab === "canvas" ? <Layers size={13} /> : <Eye size={13} />}
                  {tab === "canvas" ? "Editor" : "Preview"}
                </button>
              ))}
            </div>

            {/* Canvas editor */}
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

            {/* Live preview */}
            {centerTab === "preview" && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                <div style={{ width: "min(640px, 100%)", boxShadow: "0 4px 32px rgba(0,0,0,0.32)", borderRadius: 6, overflow: "hidden" }}>
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
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: properties */}
          <div className="vt-tb__right">
            <div className="vt-tb__panel-header">Propriedades</div>
            <div className="vt-tb__props">
              {!selectedLayer && selectedScene && (
                <SceneProps
                  scene={selectedScene}
                  fps={template.fps}
                  onChange={(updated) => updateScene(selectedSceneId, () => updated)}
                />
              )}
              {selectedLayer && selectedScene && (
                <LayerProps
                  layer={selectedLayer}
                  onChange={(updated) => updateLayer(selectedSceneId, selectedLayer.id, updated as Partial<TemplateLayer>)}
                  sceneDuration={selectedScene.durationInFrames}
                  fps={template.fps}
                />
              )}
              {!selectedScene && (
                <div className="vt-tb__empty">Selecione uma cena</div>
              )}
            </div>

            <div className="vt-tb__panel-header">Variáveis</div>
            <div className="vt-tb__vars">
              {template.variables.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "4px 0" }}>
                  Nenhuma variável definida.
                </div>
              )}
              {template.variables.map((v) => (
                <div key={v.key} className="vt-tb__var-item">
                  <span className="vt-tb__var-name">{`{{${v.key}}}`}</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline — below main row */}
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

/* ── Scene properties panel ────────────────────────────────────────────────── */

const SceneProps: React.FC<{
  scene: TemplateScene;
  fps: number;
  onChange: (s: TemplateScene) => void;
}> = ({ scene, fps, onChange }) => (
  <>
    <div>
      <div className="vt-tb__section-title">Cena</div>
      <div className="vt-tb__field-row">
        <label className="vt-tb__field-label">Nome</label>
        <input
          className="vt-tb__field-input"
          value={scene.name}
          onChange={(e) => onChange({ ...scene, name: e.target.value })}
        />
      </div>
      <div className="vt-tb__field-row" style={{ marginTop: 8 }}>
        <label className="vt-tb__field-label">Duração (frames)</label>
        <input
          className="vt-tb__field-input"
          type="number"
          min={1}
          value={scene.durationInFrames}
          onChange={(e) => onChange({ ...scene, durationInFrames: Math.max(1, parseInt(e.target.value) || 1) })}
        />
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
          {(scene.durationInFrames / fps).toFixed(2)}s a {fps}fps
        </span>
      </div>
      <div className="vt-tb__field-row" style={{ marginTop: 8 }}>
        <label className="vt-tb__field-label">Cor de fundo</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="color"
            value={scene.backgroundColor}
            onChange={(e) => onChange({ ...scene, backgroundColor: e.target.value })}
            style={{ width: 32, height: 28, border: "none", borderRadius: 4, cursor: "pointer" }}
          />
          <input
            className="vt-tb__field-input"
            value={scene.backgroundColor}
            onChange={(e) => onChange({ ...scene, backgroundColor: e.target.value })}
            style={{ flex: 1 }}
          />
        </div>
      </div>
    </div>
  </>
);

/* ── Animation presets ──────────────────────────────────────────────────────── */

const ANIM_PRESETS: Array<{ label: string; anim: Omit<LayerAnimation, "startFrame"> & { startFrame: number } }> = [
  { label: "Fade In",     anim: { type: "fadeIn",     startFrame: 0, durationInFrames: 15, easing: "easeOut" } },
  { label: "Slide ←",    anim: { type: "slideLeft",  startFrame: 0, durationInFrames: 20, easing: "easeOut" } },
  { label: "Slide →",    anim: { type: "slideRight", startFrame: 0, durationInFrames: 20, easing: "easeOut" } },
  { label: "Slide ↑",    anim: { type: "slideUp",    startFrame: 0, durationInFrames: 20, easing: "easeOut" } },
  { label: "Slide ↓",    anim: { type: "slideDown",  startFrame: 0, durationInFrames: 20, easing: "easeOut" } },
  { label: "Zoom In",    anim: { type: "zoomIn",     startFrame: 0, durationInFrames: 20, easing: "easeOut" } },
  { label: "Pulse",      anim: { type: "pulse",      startFrame: 0, durationInFrames: 30, easing: "easeInOut" } },
  { label: "Bounce",     anim: { type: "bounce",     startFrame: 0, durationInFrames: 30, easing: "easeInOut" } },
  { label: "Girar",      anim: { type: "rotate",     startFrame: 0, durationInFrames: 30, easing: "easeOut" } },
  { label: "Glow",       anim: { type: "glow",       startFrame: 0, durationInFrames: 60, easing: "easeInOut" } },
  { label: "Shake",      anim: { type: "shake",      startFrame: 0, durationInFrames: 15, easing: "linear" } },
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

  const applyPreset = (preset: typeof ANIM_PRESETS[0]) => {
    if (appliedTypes.has(preset.anim.type)) return;
    onChange({ animations: [...layer.animations, { ...preset.anim }] });
  };

  const removeAnim = (type: string) => {
    onChange({ animations: layer.animations.filter((a) => a.type !== type) });
  };

  return (
    <div>
      <div className="vt-tb__section-title">Animações</div>

      {/* Applied animations */}
      {layer.animations.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
          {layer.animations.map((a) => (
            <div key={a.type} style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "var(--accent)", borderRadius: 4, padding: "3px 8px",
              fontSize: 10, color: "#fff", fontWeight: 600,
            }}>
              <span>{ANIM_LABELS[a.type] ?? a.type}</span>
              <span style={{ opacity: 0.7, fontSize: 9 }}>{(a.startFrame / fps).toFixed(1)}s</span>
              <button
                onClick={() => removeAnim(a.type)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", padding: 0, lineHeight: 1, marginLeft: 2, fontSize: 11 }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Preset buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {ANIM_PRESETS.filter((p) => p.anim.type !== "typewriter" || layer.type === "text").map((preset) => {
          const active = appliedTypes.has(preset.anim.type);
          return (
            <button
              key={preset.anim.type}
              onClick={() => active ? removeAnim(preset.anim.type) : applyPreset(preset)}
              style={{
                padding: "5px 4px", borderRadius: 5, fontSize: 10, fontWeight: 500,
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                background: active ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "var(--surface-2)",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer", textAlign: "center",
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {layer.animations.length > 0 && (
        <button
          onClick={() => onChange({ animations: [] })}
          style={{ marginTop: 8, fontSize: 10, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Limpar todas animações
        </button>
      )}
    </div>
  );
};

/* ── Layer properties panel ─────────────────────────────────────────────────── */

const LayerProps: React.FC<{
  layer: TemplateLayer;
  onChange: (patch: Partial<TemplateLayer>) => void;
  sceneDuration: number;
  fps: number;
}> = ({ layer, onChange, sceneDuration, fps }) => {
  const [localName, setLocalName] = React.useState(layer.name);
  const layerIdRef = React.useRef(layer.id);
  React.useEffect(() => {
    if (layer.id !== layerIdRef.current) { layerIdRef.current = layer.id; setLocalName(layer.name); }
  });

  return (
  <>
    <div>
      <div className="vt-tb__section-title">Layer — {LAYER_TYPE_LABELS[layer.type]}</div>
      <div className="vt-tb__field-row">
        <label className="vt-tb__field-label">Nome</label>
        <input
          className="vt-tb__field-input"
          value={localName}
          onChange={(e) => { setLocalName(e.target.value); onChange({ name: e.target.value }); }}
        />
      </div>
    </div>

    <div>
      <div className="vt-tb__section-title">Posição & Tamanho</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {(["x", "y", "width", "height"] as const).map((prop) => (
          <div key={prop} className="vt-tb__field-row">
            <label className="vt-tb__field-label">{prop.toUpperCase()}</label>
            <input
              className="vt-tb__field-input"
              type="number"
              value={(layer as unknown as Record<string, number>)[prop]}
              onChange={(e) => onChange({ [prop]: parseFloat(e.target.value) || 0 })}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
        <div className="vt-tb__field-row">
          <label className="vt-tb__field-label">Opacidade</label>
          <input
            className="vt-tb__field-input"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            onChange={(e) => onChange({ opacity: parseFloat(e.target.value) })}
          />
        </div>
        <div className="vt-tb__field-row">
          <label className="vt-tb__field-label">Z-Index</label>
          <input
            className="vt-tb__field-input"
            type="number"
            value={layer.zIndex}
            onChange={(e) => onChange({ zIndex: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>

    {/* Alignment buttons */}
    <div>
      <div className="vt-tb__section-title">Alinhar na cena</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
        {[
          { label: "Esquerda",   icon: <AlignStartVertical size={13} />,           x: 0,                             y: undefined },
          { label: "H. Centro",  icon: <AlignHorizontalJustifyCenter size={13} />, x: Math.round((1920 - layer.width) / 2), y: undefined },
          { label: "Direita",    icon: <AlignEndVertical size={13} />,             x: 1920 - layer.width,            y: undefined },
          { label: "Centro",     icon: <AlignCenter size={13} />,                  x: Math.round((1920 - layer.width) / 2),  y: Math.round((1080 - layer.height) / 2) },
          { label: "Topo",       icon: <AlignStartHorizontal size={13} />,         x: undefined,                     y: 0 },
          { label: "V. Centro",  icon: <AlignVerticalJustifyCenter size={13} />,   x: undefined,                     y: Math.round((1080 - layer.height) / 2) },
          { label: "Baixo",      icon: <AlignEndHorizontal size={13} />,           x: undefined,                     y: 1080 - layer.height },
        ].map(({ label, icon, x, y }) => (
          <button
            key={label}
            title={label}
            onClick={() => onChange({ ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) })}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "6px 4px", borderRadius: 5, border: "1px solid var(--border)",
              background: "var(--surface-2)", cursor: "pointer", color: "var(--text-secondary)",
              fontSize: 9, fontWeight: 500,
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>

    {/* Timing */}
    <div>
      <div className="vt-tb__section-title">Timing</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div className="vt-tb__field-row">
          <label className="vt-tb__field-label">Início (frame)</label>
          <input
            className="vt-tb__field-input"
            type="number" min={0} max={sceneDuration - 1}
            value={layer.startFrame ?? 0}
            onChange={(e) => onChange({ startFrame: Math.max(0, parseInt(e.target.value) || 0) })}
          />
        </div>
        <div className="vt-tb__field-row">
          <label className="vt-tb__field-label">Fim (frame)</label>
          <input
            className="vt-tb__field-input"
            type="number" min={1} max={sceneDuration}
            value={layer.endFrame ?? sceneDuration}
            onChange={(e) => onChange({ endFrame: Math.min(sceneDuration, parseInt(e.target.value) || sceneDuration) })}
          />
        </div>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
        {((layer.startFrame ?? 0) / fps).toFixed(2)}s → {((layer.endFrame ?? sceneDuration) / fps).toFixed(2)}s de {(sceneDuration / fps).toFixed(2)}s
      </div>
      {(layer.startFrame !== undefined || layer.endFrame !== undefined) && (
        <button
          onClick={() => onChange({ startFrame: undefined, endFrame: undefined })}
          style={{ fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: "4px 0 0" }}
        >
          ↩ Usar duração completa da cena
        </button>
      )}
    </div>

    {/* Animations */}
    <AnimationsSection layer={layer} onChange={onChange} fps={fps} />

    {layer.type === "text" && <TextLayerProps layer={layer as TextLayer} onChange={onChange} />}
    {layer.type === "shape" && <ShapeLayerProps layer={layer as ShapeLayer} onChange={onChange} />}
    {layer.type === "badge" && <BadgeLayerProps layer={layer as BadgeLayer} onChange={onChange} />}
    {layer.type === "image" && <ImageLayerProps layer={layer as ImageLayer} onChange={onChange} />}
  </>
  );
};

const TextLayerProps: React.FC<{ layer: TextLayer; onChange: (p: Partial<TemplateLayer>) => void }> = ({ layer, onChange }) => {
  const [localText, setLocalText] = React.useState(layer.text);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined as unknown as ReturnType<typeof setTimeout>);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  // Reset local text only when a different layer is selected
  const layerIdRef = React.useRef(layer.id);
  if (layer.id !== layerIdRef.current) {
    layerIdRef.current = layer.id;
    setLocalText(layer.text);
  }

  React.useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div>
      <div className="vt-tb__section-title">Texto</div>
      <div className="vt-tb__field-row">
        <label className="vt-tb__field-label">Conteúdo</label>
        <input
          className="vt-tb__field-input"
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
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
        <div className="vt-tb__field-row">
          <label className="vt-tb__field-label">Tamanho</label>
          <input className="vt-tb__field-input" type="number" value={layer.fontSize} onChange={(e) => onChange({ fontSize: parseInt(e.target.value) || 24 } as Partial<TextLayer>)} />
        </div>
        <div className="vt-tb__field-row">
          <label className="vt-tb__field-label">Peso</label>
          <input className="vt-tb__field-input" type="number" step={100} min={100} max={900} value={layer.fontWeight} onChange={(e) => onChange({ fontWeight: parseInt(e.target.value) || 400 } as Partial<TextLayer>)} />
        </div>
      </div>
      <div className="vt-tb__field-row" style={{ marginTop: 6 }}>
        <label className="vt-tb__field-label">Cor</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="color" value={layer.color} onChange={(e) => onChange({ color: e.target.value } as Partial<TextLayer>)} style={{ width: 32, height: 28, border: "none", borderRadius: 4 }} />
          <input className="vt-tb__field-input" value={layer.color} onChange={(e) => onChange({ color: e.target.value } as Partial<TextLayer>)} style={{ flex: 1 }} />
        </div>
      </div>
      <div className="vt-tb__field-row" style={{ marginTop: 6 }}>
        <label className="vt-tb__field-label">Alinhamento</label>
        <select className="vt-tb__field-input" value={layer.align} onChange={(e) => onChange({ align: e.target.value as TextLayer["align"] } as Partial<TextLayer>)}>
          <option value="left">Esquerda</option>
          <option value="center">Centro</option>
          <option value="right">Direita</option>
        </select>
      </div>
    </div>
  );
};

const ShapeLayerProps: React.FC<{ layer: ShapeLayer; onChange: (p: Partial<TemplateLayer>) => void }> = ({ layer, onChange }) => (
  <div>
    <div className="vt-tb__section-title">Forma</div>
    <div className="vt-tb__field-row">
      <label className="vt-tb__field-label">Tipo</label>
      <select className="vt-tb__field-input" value={layer.shape} onChange={(e) => onChange({ shape: e.target.value as ShapeLayer["shape"] } as Partial<ShapeLayer>)}>
        <option value="rect">Retângulo</option>
        <option value="circle">Círculo</option>
      </select>
    </div>
    <div className="vt-tb__field-row" style={{ marginTop: 6 }}>
      <label className="vt-tb__field-label">Preenchimento</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="color" value={layer.fill} onChange={(e) => onChange({ fill: e.target.value } as Partial<ShapeLayer>)} style={{ width: 32, height: 28, border: "none", borderRadius: 4 }} />
        <input className="vt-tb__field-input" value={layer.fill} onChange={(e) => onChange({ fill: e.target.value } as Partial<ShapeLayer>)} style={{ flex: 1 }} />
      </div>
    </div>
    {layer.shape === "rect" && (
      <div className="vt-tb__field-row" style={{ marginTop: 6 }}>
        <label className="vt-tb__field-label">Border Radius</label>
        <input className="vt-tb__field-input" type="number" value={layer.borderRadius ?? 0} onChange={(e) => onChange({ borderRadius: parseInt(e.target.value) || 0 } as Partial<ShapeLayer>)} />
      </div>
    )}
  </div>
);

const BadgeLayerProps: React.FC<{ layer: BadgeLayer; onChange: (p: Partial<TemplateLayer>) => void }> = ({ layer, onChange }) => {
  const [localText, setLocalText] = React.useState(layer.text);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined as unknown as ReturnType<typeof setTimeout>);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const layerIdRef = React.useRef(layer.id);
  if (layer.id !== layerIdRef.current) {
    layerIdRef.current = layer.id;
    setLocalText(layer.text);
  }
  React.useEffect(() => () => clearTimeout(timerRef.current), []);
  return (
  <div>
    <div className="vt-tb__section-title">Badge</div>
    <div className="vt-tb__field-row">
      <label className="vt-tb__field-label">Texto</label>
      <input className="vt-tb__field-input" value={localText}
        onChange={(e) => {
          const val = e.target.value;
          setLocalText(val);
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => onChangeRef.current({ text: val } as Partial<BadgeLayer>), 300);
        }}
        onBlur={(e) => { clearTimeout(timerRef.current); onChangeRef.current({ text: e.target.value } as Partial<BadgeLayer>); }}
      />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
      <div className="vt-tb__field-row">
        <label className="vt-tb__field-label">Fundo</label>
        <input type="color" value={layer.bg} onChange={(e) => onChange({ bg: e.target.value } as Partial<BadgeLayer>)} style={{ width: "100%", height: 28, border: "none", borderRadius: 4 }} />
      </div>
      <div className="vt-tb__field-row">
        <label className="vt-tb__field-label">Cor texto</label>
        <input type="color" value={layer.textColor} onChange={(e) => onChange({ textColor: e.target.value } as Partial<BadgeLayer>)} style={{ width: "100%", height: 28, border: "none", borderRadius: 4 }} />
      </div>
    </div>
    <div className="vt-tb__field-row" style={{ marginTop: 6 }}>
      <label className="vt-tb__field-label">Tamanho fonte</label>
      <input className="vt-tb__field-input" type="number" value={layer.fontSize} onChange={(e) => onChange({ fontSize: parseInt(e.target.value) || 28 } as Partial<BadgeLayer>)} />
    </div>
  </div>
  );
};

const ImageLayerProps: React.FC<{ layer: ImageLayer; onChange: (p: Partial<TemplateLayer>) => void }> = ({ layer, onChange }) => {
  const displaySrc = layer.src && !layer.src.startsWith("{{")
    ? (layer.src.startsWith("http") ? layer.src : staticFile(layer.src))
    : null;

  const handleUpload = async () => {
    const path = await window.adFrame.selectImage();
    if (path) onChange({ src: path } as Partial<ImageLayer>);
  };

  return (
    <div>
      <div className="vt-tb__section-title">Imagem</div>

      {/* Thumbnail + upload */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 6, border: "1px solid var(--border)",
          background: "var(--surface-2)", overflow: "hidden", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {displaySrc ? (
            <img src={displaySrc} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <Image size={22} style={{ color: "var(--text-tertiary)" }} />
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={handleUpload}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 10px",
              borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)",
              color: "var(--text-primary)", fontSize: 12, cursor: "pointer", fontWeight: 500,
            }}
          >
            <Upload size={13} />
            {layer.src ? "Trocar imagem" : "Selecionar imagem"}
          </button>
          {layer.src && (
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", wordBreak: "break-all" }}>
              {layer.src}
            </span>
          )}
        </div>
      </div>

      {/* Variable hint */}
      <div className="vt-tb__field-row">
        <label className="vt-tb__field-label">Variável (opcional)</label>
        <input
          className="vt-tb__field-input"
          value={layer.src.startsWith("{{") ? layer.src : ""}
          onChange={(e) => onChange({ src: e.target.value } as Partial<ImageLayer>)}
          placeholder="Ex: {{PRODUCT_IMAGE}}"
        />
      </div>

      <div className="vt-tb__field-row" style={{ marginTop: 6 }}>
        <label className="vt-tb__field-label">Encaixe</label>
        <select className="vt-tb__field-input" value={layer.fit}
          onChange={(e) => onChange({ fit: e.target.value as ImageLayer["fit"] } as Partial<ImageLayer>)}>
          <option value="contain">Contain — preserva proporção</option>
          <option value="cover">Cover — preenche tudo</option>
        </select>
      </div>

      {/* Flip */}
      <div style={{ marginTop: 8 }}>
        <div className="vt-tb__section-title" style={{ marginBottom: 6 }}>Inverter imagem</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => onChange({ flipX: !layer.flipX } as Partial<ImageLayer>)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "7px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 500,
              border: `1px solid ${layer.flipX ? "var(--accent)" : "var(--border)"}`,
              background: layer.flipX ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "var(--surface-2)",
              color: layer.flipX ? "var(--accent)" : "var(--text-primary)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 1v12M1 4l3 3-3 3M13 4l-3 3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Horizontal
          </button>
          <button
            onClick={() => onChange({ flipY: !layer.flipY } as Partial<ImageLayer>)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "7px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 500,
              border: `1px solid ${layer.flipY ? "var(--accent)" : "var(--border)"}`,
              background: layer.flipY ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "var(--surface-2)",
              color: layer.flipY ? "var(--accent)" : "var(--text-primary)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 7h12M4 1l3 3 3-3M4 13l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Vertical
          </button>
        </div>
      </div>
    </div>
  );
};
