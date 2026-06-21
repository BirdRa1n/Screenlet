"use client";

import { useAdStore, useSelectedScene } from "../store/useAdStore";
import {
  Checkbox,
  ColorField,
  Field,
  SelectField,
  Tabs,
  TextField,
} from "../design-system/components";
import {
  logoCornerLabels,
  type LogoCorner,
  type LogoSceneConfig,
  type ProductSceneConfig,
  type TemplateSceneConfig,
  type VideoSceneConfig,
} from "../remotion/types";
import { useTemplateStore } from "../store/useTemplateStore";
import { MediaPicker } from "../components/media/MediaPicker";

const PRODUCT_TABS = [
  { value: "content", label: "Conteúdo" },
  { value: "style", label: "Estilo" },
  { value: "logo", label: "Logo" },
];

export const InspectorPanel: React.FC = () => {
  const scene = useSelectedScene();
  const updateScene = useAdStore((s) => s.updateScene);

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-card/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Propriedades da cena
      </h2>

      {scene ? (
        scene.type === "logo" ? (
          <LogoInspector scene={scene} onChange={(s) => updateScene(scene.id, s)} />
        ) : scene.type === "template" ? (
          <TemplateInspector scene={scene} onChange={(s) => updateScene(scene.id, s)} />
        ) : scene.type === "video" ? (
          <VideoInspector scene={scene} onChange={(s) => updateScene(scene.id, s)} />
        ) : (
          <ProductInspector scene={scene} onChange={(s) => updateScene(scene.id, s)} />
        )
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
          Selecione uma cena na lista para editar
        </div>
      )}
    </aside>
  );
};

const LogoInspector: React.FC<{
  scene: LogoSceneConfig;
  onChange: (scene: LogoSceneConfig) => void;
}> = ({ scene, onChange }) => (
  <div className="flex flex-col gap-4">
    <Field label="Texto / Chamada">
      <TextField value={scene.tagline} onChange={(e) => onChange({ ...scene, tagline: e.target.value })} />
    </Field>
    <div className="grid grid-cols-2 gap-3">
      <ColorField label="Fundo" value={scene.bg} onChange={(v) => onChange({ ...scene, bg: v })} />
      <ColorField label="Cor do texto" value={scene.taglineColor} onChange={(v) => onChange({ ...scene, taglineColor: v })} />
    </div>
    <Field label="Duração (segundos)">
      <TextField
        type="number"
        min={1}
        step={0.5}
        value={scene.durationInFrames / 30}
        onChange={(e) => onChange({ ...scene, durationInFrames: Math.round(Number(e.target.value) * 30) })}
      />
    </Field>
  </div>
);

const TemplateInspector: React.FC<{
  scene: TemplateSceneConfig;
  onChange: (scene: TemplateSceneConfig) => void;
}> = ({ scene, onChange }) => {
  const templates = useTemplateStore((s) => s.templates);
  const template = templates.find((t) => t.id === scene.templateId);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Template">
        <SelectField
          value={scene.templateId}
          onChange={(e) => onChange({ ...scene, templateId: e.target.value, values: {} })}
        >
          <option value="">Selecionar template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
      </Field>

      {template?.variables.map((v) => (
        <Field key={v.key} label={v.label + (v.required ? " *" : "")}>
          <TextField
            value={scene.values[v.key] ?? v.defaultValue ?? ""}
            onChange={(e) => onChange({ ...scene, values: { ...scene.values, [v.key]: e.target.value } })}
            placeholder={v.defaultValue || v.label}
          />
        </Field>
      ))}

      <Field label="Duração (segundos)">
        <TextField
          type="number"
          min={1}
          step={0.5}
          value={scene.durationInFrames / 30}
          onChange={(e) => onChange({ ...scene, durationInFrames: Math.round(Number(e.target.value) * 30) })}
        />
      </Field>
    </div>
  );
};

const VideoInspector: React.FC<{
  scene: VideoSceneConfig;
  onChange: (scene: VideoSceneConfig) => void;
}> = ({ scene, onChange }) => {
  const handleUpload = async () => {
    const path = await window.adFrame.selectVideo();
    if (path) onChange({ ...scene, src: path });
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Arquivo de vídeo">
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpload}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            {scene.src ? "Trocar vídeo" : "Selecionar vídeo"}
          </button>
          {scene.src && (
            <span className="truncate text-xs text-muted-foreground">{scene.src.split("/").pop()}</span>
          )}
        </div>
      </Field>

      <Field label="Volume">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={scene.volume}
          onChange={(e) => onChange({ ...scene, volume: Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <span className="text-xs text-muted-foreground">{Math.round(scene.volume * 100)}%</span>
      </Field>

      <Field label="Duração (segundos)">
        <TextField
          type="number"
          min={1}
          step={0.5}
          value={scene.durationInFrames / 30}
          onChange={(e) => onChange({ ...scene, durationInFrames: Math.round(Number(e.target.value) * 30) })}
        />
      </Field>
    </div>
  );
};

const ProductInspector: React.FC<{
  scene: ProductSceneConfig;
  onChange: (scene: ProductSceneConfig) => void;
}> = ({ scene, onChange }) => (
  <Tabs tabs={PRODUCT_TABS} defaultValue="content">
    {(active) => (
      <div className="flex flex-col gap-4">
        {active === "content" && (
          <>
            <Field label="Imagem do produto">
              <MediaPicker
                value={scene.image}
                onChange={(path) => onChange({ ...scene, image: path })}
                accept="image"
                height={130}
              />
            </Field>
            <Field label="Nome do produto">
              <TextField value={scene.productName} onChange={(e) => onChange({ ...scene, productName: e.target.value })} />
            </Field>
            <Field label="Tipo de anúncio">
              <SelectField
                value={scene.priceMode}
                onChange={(e) => onChange({ ...scene, priceMode: e.target.value as "offer" | "single" })}
              >
                <option value="offer">Oferta (de / por)</option>
                <option value="single">Preço único</option>
              </SelectField>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {scene.priceMode === "offer" && (
                <Field label="Preço de">
                  <TextField placeholder="0,00" value={scene.oldPrice} onChange={(e) => onChange({ ...scene, oldPrice: e.target.value })} />
                </Field>
              )}
              <Field label={scene.priceMode === "offer" ? "Preço por" : "Preço"}>
                <TextField placeholder="0,00" value={scene.newPrice} onChange={(e) => onChange({ ...scene, newPrice: e.target.value })} />
              </Field>
            </div>
            <Field label="Sufixo (ex: /kg, /un)">
              <TextField value={scene.priceSuffix} onChange={(e) => onChange({ ...scene, priceSuffix: e.target.value })} />
            </Field>
            <Field label="Texto do selo">
              <TextField value={scene.badgeText} onChange={(e) => onChange({ ...scene, badgeText: e.target.value })} />
            </Field>
            <Field label="Duração (segundos)">
              <TextField
                type="number"
                min={1}
                step={0.5}
                value={scene.durationInFrames / 30}
                onChange={(e) => onChange({ ...scene, durationInFrames: Math.round(Number(e.target.value) * 30) })}
              />
            </Field>
          </>
        )}

        {active === "style" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Fundo" value={scene.bg} onChange={(v) => onChange({ ...scene, bg: v })} />
              <ColorField label="Nome" value={scene.productNameColor} onChange={(v) => onChange({ ...scene, productNameColor: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {scene.priceMode === "offer" && (
                <ColorField label="Preço antigo" value={scene.oldPriceColor} onChange={(v) => onChange({ ...scene, oldPriceColor: v })} />
              )}
              <ColorField label="Destaque" value={scene.accentColor} onChange={(v) => onChange({ ...scene, accentColor: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Selo" value={scene.badgeColor} onChange={(v) => onChange({ ...scene, badgeColor: v })} />
              <ColorField label="Texto do selo" value={scene.badgeTextColor} onChange={(v) => onChange({ ...scene, badgeTextColor: v })} />
            </div>
          </>
        )}

        {active === "logo" && (
          <>
            <Checkbox
              label="Mostrar a logo nesta cena"
              checked={scene.showLogoOverlay}
              onChange={(checked) => onChange({ ...scene, showLogoOverlay: checked })}
            />
            {scene.showLogoOverlay && (
              <Field label="Posição da logo">
                <SelectField
                  value={scene.logoPosition}
                  onChange={(e) => onChange({ ...scene, logoPosition: e.target.value as LogoCorner })}
                >
                  {(Object.keys(logoCornerLabels) as LogoCorner[]).map((c) => (
                    <option key={c} value={c}>
                      {logoCornerLabels[c]}
                    </option>
                  ))}
                </SelectField>
              </Field>
            )}
          </>
        )}
      </div>
    )}
  </Tabs>
);
