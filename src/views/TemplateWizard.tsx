"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { staticFile } from "remotion";
import { ArrowLeft, ArrowRight, Check, Clock, Clapperboard, ImageIcon } from "lucide-react";
import { Button, Dialog, Field, IconButton, TextField } from "../design-system/components";
import { MediaPickerDialog } from "../components/media/MediaPicker";
import { cn } from "@/lib/utils";
import { RemotionPlayer } from "../components/RemotionPlayer";
import { TemplateRenderer } from "../remotion/TemplateRenderer";
import { templateTotalFrames } from "../remotion/template-utils";
import { useTemplateInstanceStore } from "../store/useTemplateInstanceStore";
import { toast } from "../store/useToastStore";
import { formatIcon } from "../lib/exportFormats";
import { FORMAT_DIMENSIONS, type ExportFormat } from "../remotion/types";
import type { Template, TemplateVariable } from "../remotion/template-types";
import type { ExportProgress } from "../global";

const STEPS = ["Variáveis", "Preview", "Exportar"];

const FORMAT_OPTIONS: Array<{ id: ExportFormat; label: string; res: string; icon: React.ReactNode }> = [
  { id: "tv", label: "TV / YouTube", res: "1920 × 1080", icon: formatIcon("tv", 22) },
  { id: "instagram", label: "Instagram", res: "1080 × 1080", icon: formatIcon("instagram", 22) },
  { id: "stories", label: "Stories", res: "1080 × 1920", icon: formatIcon("stories", 22) },
  { id: "tiktok", label: "TikTok", res: "1080 × 1920", icon: formatIcon("tiktok", 22) },
];

export const TemplateWizard: React.FC = () => {
  const { template, values, step, setValue, setStep, reset } = useTemplateInstanceStore();
  const router = useRouter();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("tv");

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [fpsDialog, setFpsDialog] = useState<{ payload: unknown } | null>(null);
  const [selectedFps, setSelectedFps] = useState<30 | 60>(30);
  const [renderName, setRenderName] = useState("");

  useEffect(() => {
    return window.adFrame?.onExportProgress((data) => setProgress(data));
  }, []);

  useEffect(() => {
    if (!template) router.replace("/templates");
  }, [template, router]);

  if (!template) return null;

  const totalFrames = templateTotalFrames(template);
  const durationSec = Math.round(totalFrames / template.fps);
  const missingRequired = template.variables
    .filter((v) => v.required && !values[v.key]?.trim())
    .map((v) => v.label);
  const canProceed = step === 0 ? missingRequired.length === 0 : true;

  const handleBack = () => {
    if (step === 0) {
      reset();
      router.push("/templates");
    } else {
      setStep(step - 1);
    }
  };

  const startExport = (format: ExportFormat) => {
    const { width, height } = FORMAT_DIMENSIONS[format];
    const base = template.name.toLowerCase().replace(/\s+/g, "-");
    setSelectedFps(30);
    setRenderName(`${base}-${format}`);
    setFpsDialog({ payload: { template, values, width, height } });
  };

  const handleNext = () => {
    if (!canProceed) {
      toast.error(`Preencha: ${missingRequired.join(", ")}`);
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else startExport(selectedFormat);
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
      if (!result.ok) toast.error(`Erro ao renderizar: ${result.error}`);
      else toast.success("Vídeo renderizado com sucesso!");
    } catch (err) {
      toast.error(`Erro ao renderizar: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const textVars = template.variables.filter((v) => v.type === "text" || v.type === "number");
  const imageVars = template.variables.filter((v) => v.type === "image");
  const colorVars = template.variables.filter((v) => v.type === "color");

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <IconButton label="Voltar" onClick={handleBack}>
          <ArrowLeft size={15} />
        </IconButton>
        <span className="text-sm font-semibold">{template.name}</span>
        <span className="text-xs text-muted-foreground">
          {template.scenes.length} cenas · ~{durationSec}s
        </span>
      </div>

      {/* Steps */}
      <div className="flex shrink-0 items-center justify-center gap-2 py-4">
        {STEPS.map((label, i) => {
          const state = i < step ? "done" : i === step ? "active" : "idle";
          return (
            <Fragment key={label}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                    state === "active" && "bg-primary text-primary-foreground",
                    state === "done" && "bg-[color:var(--success)] text-white",
                    state === "idle" && "bg-muted text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check size={13} /> : i + 1}
                </div>
                <span className={cn("text-sm", state === "active" ? "font-medium" : "text-muted-foreground")}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className="h-px w-8 bg-border" />}
            </Fragment>
          );
        })}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {step === 0 && (
          <VariablesStep
            textVars={textVars}
            imageVars={imageVars}
            colorVars={colorVars}
            values={values}
            template={template}
            onValueChange={setValue}
          />
        )}
        {step === 1 && <PreviewStep template={template} values={values} totalFrames={totalFrames} />}
        {step === 2 && <ExportStep selectedFormat={selectedFormat} onSelectFormat={setSelectedFormat} />}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-6 py-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {step === 0 && missingRequired.length > 0 && (
            <span className="text-destructive">Obrigatório: {missingRequired.join(", ")}</span>
          )}
          {step === 0 && missingRequired.length === 0 && (
            <span className="flex items-center gap-1 text-[color:var(--success)]">
              <Check size={12} /> Pronto para continuar
            </span>
          )}
          {step === 1 && (
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clapperboard size={13} /> {template.scenes.length} cenas
              </span>
              <span className="flex items-center gap-1">
                <Clock size={13} /> ~{durationSec}s
              </span>
            </span>
          )}
          {step === 2 && <span>Selecione o formato e clique em Exportar</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleBack}>
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          <Button
            variant="primary"
            icon={step === STEPS.length - 1 ? undefined : <ArrowRight size={14} />}
            onClick={handleNext}
            disabled={!canProceed || exporting}
          >
            {step === STEPS.length - 1 ? (exporting ? "Exportando…" : "Exportar") : "Continuar"}
          </Button>
        </div>
      </div>

      {/* FPS dialog */}
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
                <input type="radio" name="twfps" checked={selectedFps === fps} onChange={() => setSelectedFps(fps)} className="accent-primary" />
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

const VariablesStep: React.FC<{
  textVars: TemplateVariable[];
  imageVars: TemplateVariable[];
  colorVars: TemplateVariable[];
  values: Record<string, string>;
  template: Template;
  onValueChange: (key: string, value: string) => void;
}> = ({ textVars, imageVars, colorVars, values, template, onValueChange }) => {
  const totalFrames = templateTotalFrames(template);
  const firstSceneDuration = template.scenes[0]?.durationInFrames ?? 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        {textVars.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informações do anúncio</div>
            {textVars.map((v) => (
              <Field key={v.key} label={v.label + (v.required ? " *" : "")}>
                <TextField value={values[v.key] ?? ""} onChange={(e) => onValueChange(v.key, e.target.value)} placeholder={v.defaultValue || v.label} />
              </Field>
            ))}
          </div>
        )}
        {imageVars.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Imagens</div>
            {imageVars.map((v) => (
              <ImageVarField key={v.key} variable={v} value={values[v.key] ?? ""} onChange={(val) => onValueChange(v.key, val)} />
            ))}
          </div>
        )}
        {colorVars.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cores</div>
            {colorVars.map((v) => (
              <Field key={v.key} label={v.label}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
                    value={values[v.key] ?? "#ffffff"}
                    onChange={(e) => onValueChange(v.key, e.target.value)}
                  />
                  <TextField value={values[v.key] ?? "#ffffff"} onChange={(e) => onValueChange(v.key, e.target.value)} placeholder="#ffffff" />
                </div>
              </Field>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-black">
          <RemotionPlayer
            component={TemplateRenderer}
            inputProps={{ template, values }}
            durationInFrames={Math.max(totalFrames, 1)}
            fps={template.fps}
            compositionWidth={template.width}
            compositionHeight={template.height}
            style={{ width: "100%", aspectRatio: "16/9", display: "block" }}
            initialFrame={Math.min(firstSceneDuration + 30, Math.max(totalFrames - 1, 0))}
            autoPlay
            loop
            acknowledgeRemotionLicense
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">Preview ao vivo — atualiza conforme você preenche</p>
      </div>
    </div>
  );
};

const ImageVarField: React.FC<{
  variable: TemplateVariable;
  value: string;
  onChange: (v: string) => void;
}> = ({ variable, value, onChange }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const displaySrc = value ? (value.startsWith("http") ? value : staticFile(value)) : null;

  return (
    <Field label={variable.label + (variable.required ? " *" : "")}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="group relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30"
          onClick={() => setPickerOpen(true)}
        >
          {displaySrc ? (
            <img src={displaySrc} className="size-full object-contain p-1" alt={variable.label} onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <ImageIcon size={16} className="text-muted-foreground" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            Alterar
          </div>
        </button>
        {value && <span className="truncate text-xs text-muted-foreground">{value.split("/").pop()}</span>}
      </div>
      <MediaPickerDialog
        open={pickerOpen}
        accept="image"
        currentValue={value}
        onSelect={(path) => {
          onChange(path);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Field>
  );
};

const PreviewStep: React.FC<{
  template: Template;
  values: Record<string, string>;
  totalFrames: number;
}> = ({ template, values, totalFrames }) => (
  <div className="mx-auto flex max-w-2xl flex-col gap-4">
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      <RemotionPlayer
        component={TemplateRenderer}
        inputProps={{ template, values }}
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
    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Clapperboard size={13} /> {template.scenes.length} cenas
      </span>
      <span className="flex items-center gap-1">
        <Clock size={13} /> ~{Math.round(totalFrames / template.fps)}s
      </span>
      <span>
        {template.fps}fps · {template.width}×{template.height}
      </span>
    </div>
  </div>
);

const ExportStep: React.FC<{
  selectedFormat: ExportFormat;
  onSelectFormat: (f: ExportFormat) => void;
}> = ({ selectedFormat, onSelectFormat }) => (
  <div className="mx-auto flex max-w-2xl flex-col gap-6">
    <div className="text-center">
      <h2 className="text-lg font-semibold">Escolha o formato de exportação</h2>
      <p className="mt-1 text-sm text-muted-foreground">O layout se adapta automaticamente ao formato escolhido.</p>
    </div>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {FORMAT_OPTIONS.map((f) => (
        <button
          key={f.id}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-colors",
            selectedFormat === f.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/30",
          )}
          onClick={() => onSelectFormat(f.id)}
        >
          <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">{f.icon}</div>
          <span className="text-sm font-medium">{f.label}</span>
          <span className="text-xs text-muted-foreground">{f.res}</span>
        </button>
      ))}
    </div>
  </div>
);
