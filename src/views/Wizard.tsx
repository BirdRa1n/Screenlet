"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Store, Trash2 } from "lucide-react";
import {
  Button,
  ColorField,
  Dialog,
  Field,
  IconButton,
  SelectField,
  TextField,
  UploadZone,
} from "../design-system/components";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assetUrl";
import { useAdStore } from "../store/useAdStore";
import { useStoreProfileStore, type StoreProfile } from "../store/useStoreProfileStore";
import {
  useWizardStore,
  wizardToAdConfig,
  type ExportFormat,
  type WizardProduct,
} from "../store/useWizardStore";
import { toast } from "../store/useToastStore";
import { formatIcon } from "../lib/exportFormats";
import { RemotionPlayer } from "../components/RemotionPlayer";
import { DynamicAd } from "../remotion/DynamicAd";
import { buildPreset, type PresetId } from "../remotion/presets";
import { FORMAT_DIMENSIONS } from "../remotion/types";
import type { ExportProgress } from "../global";

const STEPS = [
  { num: 1 as const, label: "Loja" },
  { num: 2 as const, label: "Produtos" },
  { num: 3 as const, label: "Template" },
  { num: 4 as const, label: "Preview" },
  { num: 5 as const, label: "Renderizar" },
];

const TEMPLATES: Array<{ id: PresetId; name: string; desc: string }> = [
  { id: "generico", name: "Genérico", desc: "Produtos do dia a dia" },
  { id: "carnes", name: "Açougue", desc: "Promoções de carnes" },
  { id: "natal", name: "Natal", desc: "Especial de fim de ano" },
  { id: "pascoa", name: "Páscoa", desc: "Especial de Páscoa" },
];

const FORMATS: Array<{ id: ExportFormat; name: string; dims: string; icon: React.ReactNode }> = [
  { id: "tv", name: "TV / Monitor", dims: "1920 × 1080", icon: formatIcon("tv", 20) },
  { id: "instagram", name: "Instagram", dims: "1080 × 1080", icon: formatIcon("instagram", 20) },
  { id: "stories", name: "Stories", dims: "1080 × 1920", icon: formatIcon("stories", 20) },
  { id: "tiktok", name: "TikTok", dims: "1080 × 1920", icon: formatIcon("tiktok", 20) },
];

export const Wizard: React.FC = () => {
  const router = useRouter();
  const loadConfig = useAdStore((s) => s.loadConfig);
  const upsertStoreProfile = useStoreProfileStore((s) => s.upsert);
  const w = useWizardStore();

  // Persist the store info so it can be reused in future projects (step 1).
  const saveStoreProfile = () => {
    if (w.storeName.trim()) {
      upsertStoreProfile({ name: w.storeName, logoPath: w.logoPath, brandColor: w.brandColor });
    }
  };

  const goNext = () => {
    if (w.step === 1) saveStoreProfile();
    w.nextStep();
  };

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [fpsDialog, setFpsDialog] = useState<{ payload: unknown; name: string } | null>(null);
  const [selectedFps, setSelectedFps] = useState<30 | 60>(30);
  const [renderName, setRenderName] = useState("");

  useEffect(() => {
    return window.adFrame?.onExportProgress((data) => setProgress(data));
  }, []);

  const handleFinish = () => {
    saveStoreProfile();
    const config = wizardToAdConfig(w);
    loadConfig(config);
    w.reset();
    router.push("/editor");
    toast.success("Projeto criado! Fine-tune no editor.");
  };

  const handleExportNow = () => {
    const config = wizardToAdConfig(w);
    const { width, height } = FORMAT_DIMENSIONS[w.exportFormat];
    setSelectedFps(30);
    setRenderName(`anuncio-${w.exportFormat}`);
    setFpsDialog({ payload: { ...config, width, height }, name: `anuncio-${w.exportFormat}` });
  };

  const confirmRender = async () => {
    if (!fpsDialog) return;
    const filename = (renderName.trim() || "render") + ".mp4";
    const payload = fpsDialog.payload;
    setFpsDialog(null);
    setExporting(true);
    setProgress(null);
    try {
      const result = await window.adFrame.exportVideo(payload, filename, selectedFps);
      if (!result.ok) {
        toast.error(`Erro ao renderizar: ${result.error}`);
      } else {
        toast.success("Vídeo renderizado com sucesso!");
        saveStoreProfile();
        loadConfig(wizardToAdConfig(w));
        w.reset();
        router.push("/editor");
      }
    } catch (err) {
      toast.error(`Erro ao renderizar: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const progressPct = ((w.step - 1) / (STEPS.length - 1)) * 100;
  const adConfig = wizardToAdConfig(w);
  const totalFrames = adConfig.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 px-8 py-5">
        {STEPS.map((s, i) => {
          const done = w.step > s.num;
          const active = w.step === s.num;
          return (
            <Fragment key={s.num}>
              {i > 0 && <div className="h-px w-8 bg-border" />}
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                    active && "bg-primary text-primary-foreground",
                    done && "bg-[color:var(--success)] text-white",
                    !active && !done && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check size={11} /> : s.num}
                </div>
                <span
                  className={cn(
                    "text-sm",
                    active ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* Content */}
      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-8 pb-6">
        {w.step === 1 && <StepLoja />}
        {w.step === 2 && <StepProdutos />}
        {w.step === 3 && <StepTemplate />}
        {w.step === 4 && <StepPreview config={adConfig} totalFrames={totalFrames} />}
        {w.step === 5 && <StepExportar />}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-8 py-4">
        <Button
          variant="ghost"
          onClick={() => {
            w.reset();
            router.push("/");
          }}
        >
          Cancelar
        </Button>
        <div className="flex gap-2">
          {w.step > 1 && (
            <Button variant="secondary" onClick={w.prevStep}>
              Anterior
            </Button>
          )}
          {w.step >= 2 && w.step <= 4 && (
            <Button variant="secondary" onClick={handleFinish}>
              Ir para o editor
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
              <Button variant="primary" disabled={exporting} onClick={handleExportNow}>
                {exporting ? "Renderizando…" : "Renderizar MP4"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={!!fpsDialog}
        onClose={() => !exporting && setFpsDialog(null)}
        title="Qualidade de renderização"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFpsDialog(null)} disabled={exporting}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmRender} disabled={exporting}>
              {exporting ? "Renderizando…" : "Renderizar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Nome do arquivo (.mp4)">
            <TextField value={renderName} onChange={(e) => setRenderName(e.target.value)} placeholder="meu-video" />
          </Field>
          {progress && exporting && (
            <p className="text-xs text-muted-foreground">
              {progress.phase === "bundling" ? "Preparando" : "Renderizando"} — {Math.round(progress.progress * 100)}%
            </p>
          )}
          <div className="flex flex-col gap-2">
            {([30, 60] as const).map((fps) => (
              <label
                key={fps}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                  selectedFps === fps ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30",
                )}
              >
                <input type="radio" name="wfps" checked={selectedFps === fps} onChange={() => setSelectedFps(fps)} className="accent-primary" />
                <div>
                  <span className="block text-sm font-medium">{fps} fps</span>
                  <span className="block text-xs text-muted-foreground">
                    {fps === 30 ? "Recomendado — menor tamanho" : "Maior fluidez — arquivo maior"}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

function PaneHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

const StepLoja: React.FC = () => {
  const w = useWizardStore();
  const { profiles, refresh } = useStoreProfileStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pick = (p: StoreProfile) => {
    setSelectedId(p.id);
    w.setStoreName(p.name);
    w.setLogoPath(p.logoPath);
    w.setBrandColor(p.brandColor);
  };

  const startNew = () => {
    setSelectedId("new");
    w.setStoreName("");
    w.setLogoPath("");
    w.setBrandColor("#6e56f8");
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <PaneHeader title="Informações da loja" sub="Esses dados aparecem na abertura do vídeo e identificam sua marca." />

      {profiles.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Reutilizar loja cadastrada</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-2 text-left transition-colors",
                  selectedId === p.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                  {p.logoPath ? (
                    <img src={assetUrl(p.logoPath)} alt="" className="size-full object-contain" />
                  ) : (
                    <Store size={14} className="text-muted-foreground" />
                  )}
                </span>
                <span className="truncate text-sm font-medium">{p.name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={startNew}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border border-dashed p-2 text-sm font-medium transition-colors",
                selectedId === "new" ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Plus size={14} /> Nova loja
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Field label="Nome da empresa">
          <TextField placeholder="Ex: Supermercado Central" value={w.storeName} onChange={(e) => w.setStoreName(e.target.value)} />
        </Field>
        <Field label="Logo da empresa">
          <UploadZone value={w.logoPath || null} onUpload={w.setLogoPath} label="Clique ou arraste a logo" hint="PNG com fundo transparente" height={120} previewFit="contain" />
        </Field>
        <Field label="Cor principal da marca">
          <ColorField label="Cor da marca" value={w.brandColor} onChange={w.setBrandColor} />
        </Field>
      </div>
    </div>
  );
};

function parseCsv(raw: string): Array<Partial<WizardProduct>> {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines
    .slice(1)
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });
      return {
        productName: row["nome"] || row["name"] || row["produto"] || "",
        oldPrice: row["preco_de"] || row["de"] || row["preco_antigo"] || "",
        newPrice: row["preco_por"] || row["por"] || row["preco"] || row["price"] || "",
        priceSuffix: row["sufixo"] || row["unidade"] || "",
        badgeText: row["selo"] || row["badge"] || "Oferta por tempo limitado",
        priceMode: row["preco_de"] || row["de"] ? ("offer" as const) : ("single" as const),
      };
    })
    .filter((p) => p.productName);
}

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
    <div>
      <PaneHeader title="Adicione seus produtos" sub="Cada produto vira uma cena no vídeo. Você pode editar mais detalhes depois, no editor." />
      <div className="flex flex-col gap-4">
        {w.products.map((p, i) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Produto {i + 1}</span>
              {w.products.length > 1 && (
                <IconButton label="Remover produto" variant="danger" onClick={() => w.removeProduct(p.id)}>
                  <Trash2 size={13} />
                </IconButton>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
              <UploadZone value={p.image || null} onUpload={(path) => w.updateProduct(p.id, { image: path })} label="Imagem" hint="PNG" height={120} previewFit="contain" />
              <div className="flex flex-col gap-3">
                <Field label="Nome do produto">
                  <TextField placeholder="Ex: Arroz Integral 1kg" value={p.productName} onChange={(e) => w.updateProduct(p.id, { productName: e.target.value })} />
                </Field>
                <Field label="Tipo de anúncio">
                  <SelectField value={p.priceMode} onChange={(e) => w.updateProduct(p.id, { priceMode: e.target.value as "offer" | "single" })}>
                    <option value="offer">Oferta (de / por)</option>
                    <option value="single">Preço único</option>
                  </SelectField>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  {p.priceMode === "offer" && (
                    <Field label="Preço de">
                      <TextField placeholder="0,00" value={p.oldPrice} onChange={(e) => w.updateProduct(p.id, { oldPrice: e.target.value })} />
                    </Field>
                  )}
                  <Field label={p.priceMode === "offer" ? "Preço por" : "Preço"}>
                    <TextField placeholder="0,00" value={p.newPrice} onChange={(e) => w.updateProduct(p.id, { newPrice: e.target.value })} />
                  </Field>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <Button variant="secondary" icon={<Plus size={14} />} onClick={w.addProduct}>
            Adicionar produto
          </Button>
          <Button variant="ghost" onClick={handleCsvImport}>
            Importar CSV
          </Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        CSV esperado: <code className="rounded bg-muted px-1">nome, preco_de, preco_por, sufixo</code>
      </p>
    </div>
  );
};

const StepTemplate: React.FC = () => {
  const { selectedPreset, setPreset } = useWizardStore();
  return (
    <div>
      <PaneHeader title="Escolha o template" sub="O template define o visual e as cores do seu vídeo." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TEMPLATES.map((tpl) => {
          const selected = tpl.id === selectedPreset;
          const preset = buildPreset(tpl.id);
          const total = preset.scenes.reduce((s, c) => s + c.durationInFrames, 0);
          const logoFrames = preset.scenes[0]?.durationInFrames ?? 0;
          return (
            <button
              key={tpl.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-xl border text-left transition-all",
                selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
              )}
              onClick={() => setPreset(tpl.id)}
            >
              <div className="relative aspect-video bg-black">
                <RemotionPlayer
                  component={DynamicAd}
                  inputProps={preset}
                  durationInFrames={Math.max(total, 1)}
                  fps={30}
                  compositionWidth={1920}
                  compositionHeight={1080}
                  style={{ width: "100%", height: "100%", pointerEvents: "none", display: "block" }}
                  initialFrame={Math.min(logoFrames + 30, Math.max(total - 1, 0))}
                  autoPlay
                  loop
                  acknowledgeRemotionLicense
                />
                {selected && (
                  <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check size={12} />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-0.5 p-3">
                <div className="text-sm font-semibold">{tpl.name}</div>
                <div className="text-xs text-muted-foreground">{tpl.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const StepPreview: React.FC<{
  config: ReturnType<typeof wizardToAdConfig>;
  totalFrames: number;
}> = ({ config, totalFrames }) => (
  <div>
    <PaneHeader title="Prévia do vídeo" sub="Este é o resultado com os seus dados. Continue para escolher o formato de exportação." />
    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-border bg-black">
      {totalFrames > 0 ? (
        <RemotionPlayer
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
        <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
          Adicione pelo menos um produto para visualizar.
        </div>
      )}
    </div>
  </div>
);

const StepExportar: React.FC = () => {
  const { exportFormat, setExportFormat } = useWizardStore();
  return (
    <div>
      <PaneHeader title="Formato de exportação" sub="Escolha o destino do vídeo — TV, Instagram, Stories e TikTok já estão disponíveis." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {FORMATS.map((f) => {
          const selected = f.id === exportFormat;
          return (
            <button
              key={f.id}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/30",
              )}
              onClick={() => setExportFormat(f.id)}
            >
              <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">{f.icon}</div>
              <div className="text-sm font-medium">{f.name}</div>
              <div className="text-xs text-muted-foreground">{f.dims}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
