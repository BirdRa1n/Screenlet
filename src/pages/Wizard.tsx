import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Trash2 } from "lucide-react";
import { Player } from "@remotion/player";
import {
  Button,
  ColorField,
  Field,
  IconButton,
  SelectField,
  TextField,
  UploadZone,
} from "../design-system/components";
import { useNavigationStore } from "../store/useNavigationStore";
import { useAdStore } from "../store/useAdStore";
import {
  useWizardStore,
  wizardToAdConfig,
  type ExportFormat,
} from "../store/useWizardStore";
import { toast } from "../store/useToastStore";
import { formatIcon } from "../lib/exportFormats";
import { DynamicAd } from "../remotion/DynamicAd";
import { buildPreset, type PresetId } from "../remotion/presets";
import "../styles/pages/Wizard.css";

const STEPS = [
  { num: 1 as const, label: "Loja" },
  { num: 2 as const, label: "Produtos" },
  { num: 3 as const, label: "Template" },
  { num: 4 as const, label: "Preview" },
  { num: 5 as const, label: "Renderizar" },
];

type TemplateOption = {
  id: PresetId;
  name: string;
  desc: string;
  emoji: string;
  gradient: string;
};

const TEMPLATES: TemplateOption[] = [
  {
    id: "generico",
    name: "Genérico",
    desc: "Produtos do dia a dia",
    emoji: "🛒",
    gradient: "linear-gradient(135deg, #4a30b8, #6e56f8)",
  },
  {
    id: "carnes",
    name: "Açougue",
    desc: "Promoções de carnes",
    emoji: "🥩",
    gradient: "linear-gradient(135deg, #b91c1c, #ef4444)",
  },
  {
    id: "natal",
    name: "Natal",
    desc: "Especial de fim de ano",
    emoji: "🎄",
    gradient: "linear-gradient(135deg, #166534, #16a34a)",
  },
  {
    id: "pascoa",
    name: "Páscoa",
    desc: "Especial de Páscoa",
    emoji: "🐣",
    gradient: "linear-gradient(135deg, #7e22ce, #a855f7)",
  },
];

type FormatOption = {
  id: ExportFormat;
  name: string;
  dims: string;
  icon: React.ReactNode;
  available: boolean;
};

const FORMATS: FormatOption[] = [
  { id: "tv", name: "TV / Monitor", dims: "1920 × 1080", icon: formatIcon("tv", 20), available: true },
  { id: "instagram", name: "Instagram", dims: "1080 × 1080", icon: formatIcon("instagram", 20), available: true },
  { id: "stories", name: "Stories", dims: "1080 × 1920", icon: formatIcon("stories", 20), available: true },
  { id: "tiktok", name: "TikTok", dims: "1080 × 1920", icon: formatIcon("tiktok", 20), available: true },
];

const paneVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 32 }),
  animate: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -32 }),
};

export const Wizard: React.FC<{
  onExport: (config: ReturnType<typeof wizardToAdConfig>) => Promise<void>;
  exporting: boolean;
}> = ({ onExport, exporting }) => {
  const navigate = useNavigationStore((s) => s.navigate);
  const loadConfig = useAdStore((s) => s.loadConfig);

  const w = useWizardStore();
  const [prevStep, setPrevStep] = useState(w.step);
  const dir = w.step > prevStep ? 1 : -1;

  const goNext = () => {
    setPrevStep(w.step);
    w.nextStep();
  };

  const goBack = () => {
    setPrevStep(w.step);
    w.prevStep();
  };

  const handleFinish = () => {
    const config = wizardToAdConfig(w);
    loadConfig(config);
    w.reset();
    navigate("editor");
    toast.success("Projeto criado! Fine-tune no editor.");
  };

  const handleExportNow = async () => {
    const config = wizardToAdConfig(w);
    await onExport(config);
  };

  const progress = ((w.step - 1) / (STEPS.length - 1)) * 100;
  const adConfig = wizardToAdConfig(w);
  const totalFrames = adConfig.scenes.reduce(
    (sum, s) => sum + s.durationInFrames,
    0
  );

  return (
    <div className="vt-wizard">
      {/* Progress */}
      <div className="vt-wizard__progress">
        <div
          className="vt-wizard__progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="vt-wizard__steps">
        {STEPS.map((s, i) => {
          const done = w.step > s.num;
          const active = w.step === s.num;
          return (
            <React.Fragment key={s.num}>
              {i > 0 && <div className="vt-wizard__step-sep" />}
              <div
                className={[
                  "vt-wizard__step-item",
                  active ? "vt-wizard__step-item--active" : "",
                  done ? "vt-wizard__step-item--done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="vt-wizard__step-bullet">
                  {done ? <Check size={11} /> : s.num}
                </div>
                <span className="vt-wizard__step-label">{s.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step content */}
      <div className="vt-wizard__body">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={w.step}
            className="vt-wizard__pane"
            custom={dir}
            variants={paneVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeOut" as const }}
          >
            {w.step === 1 && <StepLoja />}
            {w.step === 2 && <StepProdutos />}
            {w.step === 3 && <StepTemplate />}
            {w.step === 4 && (
              <StepPreview config={adConfig} totalFrames={totalFrames} />
            )}
            {w.step === 5 && <StepExportar />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer navigation */}
      <div className="vt-wizard__footer">
        <div className="vt-wizard__footer-left">
          <Button
            variant="ghost"
            onClick={() => {
              w.reset();
              navigate("dashboard");
            }}
          >
            Cancelar
          </Button>
        </div>
        <div className="vt-wizard__footer-right">
          {w.step > 1 && (
            <Button variant="secondary" onClick={goBack}>
              Anterior
            </Button>
          )}
          {w.step < 4 && (
            <Button variant="primary" onClick={goNext}>
              Próximo
            </Button>
          )}
          {w.step === 4 && (
            <Button variant="primary" onClick={goNext}>
              Escolher formato
            </Button>
          )}
          {w.step === 5 && (
            <>
              <Button variant="secondary" onClick={handleFinish}>
                Ir para o editor
              </Button>
              <Button
                variant="primary"
                disabled={exporting}
                onClick={handleExportNow}
              >
                {exporting ? "Renderizando…" : "Renderizar MP4"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---- Step 1: Loja ---- */

const StepLoja: React.FC = () => {
  const w = useWizardStore();
  return (
    <>
      <h2 className="vt-wizard__pane-title">Informações da loja</h2>
      <p className="vt-wizard__pane-sub">
        Esses dados aparecem na abertura do vídeo e identificam sua marca.
      </p>
      <div className="vt-wizard__fields">
        <Field label="Nome da empresa">
          <TextField
            placeholder="Ex: Supermercado Central"
            value={w.storeName}
            onChange={(e) => w.setStoreName(e.target.value)}
          />
        </Field>

        <Field label="Logo da empresa">
          <UploadZone
            value={w.logoPath || null}
            onUpload={w.setLogoPath}
            label="Clique ou arraste a logo"
            hint="PNG com fundo transparente"
            height={120}
            previewFit="contain"
          />
        </Field>

        <Field label="Cor principal da marca">
          <ColorField
            label="Cor da marca"
            value={w.brandColor}
            onChange={w.setBrandColor}
          />
        </Field>
      </div>
    </>
  );
};

/* ---- CSV parser ---- */

function parseCsv(raw: string): Array<Partial<import("../store/useWizardStore").WizardProduct>> {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
    return {
      productName: row["nome"] || row["name"] || row["produto"] || "",
      oldPrice: row["preco_de"] || row["de"] || row["preco_antigo"] || "",
      newPrice: row["preco_por"] || row["por"] || row["preco"] || row["price"] || "",
      priceSuffix: row["sufixo"] || row["unidade"] || "",
      badgeText: row["selo"] || row["badge"] || "Oferta por tempo limitado",
      priceMode: (row["preco_de"] || row["de"]) ? "offer" as const : "single" as const,
    };
  }).filter((p) => p.productName);
}

/* ---- Step 2: Produtos ---- */

const StepProdutos: React.FC = () => {
  const w = useWizardStore();

  const handleCsvImport = async () => {
    const raw = await window.adFrame.selectCsv();
    if (!raw) return;
    const parsed = parseCsv(raw);
    if (parsed.length === 0) {
      toast.error("CSV inválido. Verifique as colunas: nome, preco_de, preco_por, sufixo");
      return;
    }
    parsed.forEach((p) => {
      w.addProduct();
      const last = useWizardStore.getState().products.at(-1)!;
      w.updateProduct(last.id, p);
    });
    toast.success(`${parsed.length} produto(s) importado(s) do CSV.`);
  };

  return (
    <>
      <h2 className="vt-wizard__pane-title">Adicione seus produtos</h2>
      <p className="vt-wizard__pane-sub">
        Cada produto vira uma cena no vídeo. Você pode editar mais detalhes
        depois, no editor.
      </p>
      <div className="vt-wizard__products">
        {w.products.map((p, i) => (
          <div key={p.id} className="vt-wizard__product-card">
            <div className="vt-wizard__product-card-header">
              <span className="vt-wizard__product-num">Produto {i + 1}</span>
              {w.products.length > 1 && (
                <IconButton
                  label="Remover produto"
                  variant="danger"
                  onClick={() => w.removeProduct(p.id)}
                >
                  <Trash2 size={13} />
                </IconButton>
              )}
            </div>

            <div className="vt-wizard__product-layout">
              <UploadZone
                value={p.image || null}
                onUpload={(path) => w.updateProduct(p.id, { image: path })}
                label="Imagem"
                hint="PNG"
                height={120}
                previewFit="contain"
              />
              <div className="vt-wizard__fields">
                <Field label="Nome do produto">
                  <TextField
                    placeholder="Ex: Arroz Integral 1kg"
                    value={p.productName}
                    onChange={(e) =>
                      w.updateProduct(p.id, { productName: e.target.value })
                    }
                  />
                </Field>
                <Field label="Tipo de anúncio">
                  <SelectField
                    value={p.priceMode}
                    onChange={(e) =>
                      w.updateProduct(p.id, {
                        priceMode: e.target.value as "offer" | "single",
                      })
                    }
                  >
                    <option value="offer">Oferta (de / por)</option>
                    <option value="single">Preço único</option>
                  </SelectField>
                </Field>
                <div className="vt-wizard__row">
                  {p.priceMode === "offer" && (
                    <Field label="Preço de">
                      <TextField
                        placeholder="0,00"
                        value={p.oldPrice}
                        onChange={(e) =>
                          w.updateProduct(p.id, { oldPrice: e.target.value })
                        }
                      />
                    </Field>
                  )}
                  <Field label={p.priceMode === "offer" ? "Preço por" : "Preço"}>
                    <TextField
                      placeholder="0,00"
                      value={p.newPrice}
                      onChange={(e) =>
                        w.updateProduct(p.id, { newPrice: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="vt-wizard__product-actions-row">
          <Button variant="secondary" icon={<Plus size={14} />} onClick={w.addProduct}>
            Adicionar produto
          </Button>
          <Button variant="ghost" onClick={handleCsvImport}>
            Importar CSV
          </Button>
        </div>
      </div>
      <p className="vt-wizard__csv-hint">
        CSV esperado: <code>nome, preco_de, preco_por, sufixo</code>
      </p>
    </>
  );
};

/* ---- Step 3: Template ---- */

const StepTemplate: React.FC = () => {
  const { selectedPreset, setPreset } = useWizardStore();
  return (
    <>
      <h2 className="vt-wizard__pane-title">Escolha o template</h2>
      <p className="vt-wizard__pane-sub">
        O template define o visual e as cores do seu vídeo.
      </p>
      <div className="vt-wizard__templates">
        {TEMPLATES.map((tpl) => {
          const selected = tpl.id === selectedPreset;
          return (
            <motion.div
              key={tpl.id}
              className={`vt-wizard__tpl-card${selected ? " vt-wizard__tpl-card--selected" : ""}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setPreset(tpl.id)}
            >
              <div className="vt-wizard__tpl-preview">
                {(() => {
                  const preset = buildPreset(tpl.id);
                  const total = preset.scenes.reduce((s, c) => s + c.durationInFrames, 0);
                  const logoFrames = preset.scenes[0]?.durationInFrames ?? 0;
                  return (
                    <Player
                      component={DynamicAd}
                      inputProps={preset}
                      durationInFrames={Math.max(total, 1)}
                      fps={30}
                      compositionWidth={1920}
                      compositionHeight={1080}
                      style={{ width: "100%", aspectRatio: "16/9", pointerEvents: "none", display: "block" }}
                      initialFrame={Math.min(logoFrames + 30, Math.max(total - 1, 0))}
                      autoPlay
                      loop
                      acknowledgeRemotionLicense
                    />
                  );
                })()}
                {selected && (
                  <div className="vt-wizard__tpl-check">
                    <Check size={12} />
                  </div>
                )}
              </div>
              <div className="vt-wizard__tpl-info">
                <div className="vt-wizard__tpl-name">{tpl.name}</div>
                <div className="vt-wizard__tpl-desc">{tpl.desc}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
};

/* ---- Step 4: Preview ---- */

const StepPreview: React.FC<{
  config: ReturnType<typeof wizardToAdConfig>;
  totalFrames: number;
}> = ({ config, totalFrames }) => (
  <>
    <h2 className="vt-wizard__pane-title">Prévia do vídeo</h2>
    <p className="vt-wizard__pane-sub">
      Este é o resultado com os seus dados. Continue para escolher o formato de
      exportação.
    </p>
    <div className="vt-wizard__preview-wrap">
      {totalFrames > 0 ? (
        <Player
          component={DynamicAd}
          inputProps={config}
          durationInFrames={totalFrames}
          compositionWidth={1920}
          compositionHeight={1080}
          fps={30}
          style={{ width: "100%", aspectRatio: "16/9" }}
          controls
          loop
          autoPlay
          acknowledgeRemotionLicense
        />
      ) : (
        <div
          style={{
            aspectRatio: "16/9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-tertiary)",
            fontSize: "var(--text-body)",
          }}
        >
          Adicione pelo menos um produto para visualizar.
        </div>
      )}
    </div>
  </>
);

/* ---- Step 5: Exportar ---- */

const StepExportar: React.FC = () => {
  const { exportFormat, setExportFormat } = useWizardStore();
  return (
    <>
      <h2 className="vt-wizard__pane-title">Formato de exportação</h2>
      <p className="vt-wizard__pane-sub">
        Escolha o destino do vídeo — TV, Instagram, Stories e TikTok já estão disponíveis.
      </p>
      <div className="vt-wizard__formats">
        {FORMATS.map((f) => {
          const selected = f.id === exportFormat;
          return (
            <div
              key={f.id}
              className={[
                "vt-wizard__format-card",
                selected && f.available ? "vt-wizard__format-card--selected" : "",
                !f.available ? "vt-wizard__format-card--disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => f.available && setExportFormat(f.id)}
            >
              {!f.available && (
                <span className="vt-wizard__format-soon">Em breve</span>
              )}
              <div className="vt-wizard__format-icon" style={{ color: "var(--text-tertiary)" }}>
                {f.icon}
              </div>
              <div className="vt-wizard__format-name">{f.name}</div>
              <div className="vt-wizard__format-dim">{f.dims}</div>
            </div>
          );
        })}
      </div>
    </>
  );
};
