import React, { useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { staticFile } from "remotion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Clapperboard,
  Monitor,
  Square,
  Smartphone,
  ImageIcon,
} from "lucide-react";
import { Button, IconButton } from "../design-system/components";
import { MediaPickerDialog } from "../components/media/MediaPicker";
import { TemplateRenderer } from "../remotion/TemplateRenderer";
import { templateTotalFrames } from "../remotion/template-utils";
import { useTemplateInstanceStore } from "../store/useTemplateInstanceStore";
import { useNavigationStore } from "../store/useNavigationStore";
import { toast } from "../store/useToastStore";
import type { TemplateVariable } from "../remotion/template-types";
import type { ExportFormat } from "../remotion/types";
import "../styles/pages/TemplateWizard.css";

const STEPS = ["Variáveis", "Preview", "Exportar"];

const FORMAT_OPTIONS: Array<{
  id: ExportFormat;
  label: string;
  res: string;
  icon: React.ReactNode;
  aspect: string;
}> = [
  { id: "tv", label: "TV / YouTube", res: "1920 × 1080", icon: <Monitor size={22} />, aspect: "16/9" },
  { id: "instagram", label: "Instagram", res: "1080 × 1080", icon: <Square size={22} />, aspect: "1/1" },
  { id: "stories", label: "Stories", res: "1080 × 1920", icon: <Smartphone size={22} />, aspect: "9/16" },
  { id: "tiktok", label: "TikTok", res: "1080 × 1920", icon: <Smartphone size={22} />, aspect: "9/16" },
];

export const TemplateWizard: React.FC<{
  onExport: (format: ExportFormat) => void;
  exporting: boolean;
}> = ({ onExport, exporting }) => {
  const { template, values, step, setValue, setStep, reset } = useTemplateInstanceStore();
  const navigate = useNavigationStore((s) => s.navigate);
  const playerRef = useRef<PlayerRef>(null);
  const [selectedFormat, setSelectedFormat] = React.useState<ExportFormat>("tv");

  if (!template) {
    navigate("templates");
    return null;
  }

  const totalFrames = templateTotalFrames(template);
  const durationSec = Math.round(totalFrames / template.fps);
  const missingRequired = template.variables
    .filter((v) => v.required && !values[v.key]?.trim())
    .map((v) => v.label);

  const canProceed = step === 0 ? missingRequired.length === 0 : true;

  const handleBack = () => {
    if (step === 0) {
      reset();
      navigate("templates");
    } else {
      setStep(step - 1);
    }
  };

  const handleNext = () => {
    if (!canProceed) {
      toast.error(`Preencha: ${missingRequired.join(", ")}`);
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onExport(selectedFormat);
    }
  };

  // Group variables by type
  const textVars = template.variables.filter((v) => v.type === "text" || v.type === "number");
  const imageVars = template.variables.filter((v) => v.type === "image");
  const colorVars = template.variables.filter((v) => v.type === "color");

  return (
    <div className="vt-twiz">
      {/* Top bar */}
      <div className="vt-twiz__topbar">
        <IconButton label="Voltar" onClick={handleBack}>
          <ArrowLeft size={15} />
        </IconButton>
        <span className="vt-twiz__tpl-name">{template.name}</span>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          {template.scenes.length} cenas · ~{durationSec}s
        </span>
      </div>

      {/* Steps */}
      <div className="vt-twiz__steps">
        {STEPS.map((label, i) => {
          const state = i < step ? "done" : i === step ? "active" : "idle";
          return (
            <React.Fragment key={label}>
              <div className={`vt-twiz__step vt-twiz__step--${state}`}>
                <div className="vt-twiz__step-dot">
                  {state === "done" ? <Check size={13} /> : i + 1}
                </div>
                <span className="vt-twiz__step-label">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`vt-twiz__step-line${state === "done" ? " vt-twiz__step-line--done" : ""}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Body */}
      <div className="vt-twiz__body">
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
        {step === 1 && (
          <PreviewStep
            template={template}
            values={values}
            totalFrames={totalFrames}
            playerRef={playerRef}
          />
        )}
        {step === 2 && (
          <ExportStep
            selectedFormat={selectedFormat}
            onSelectFormat={setSelectedFormat}
          />
        )}
      </div>

      {/* Footer */}
      <div className="vt-twiz__footer">
        <div className="vt-twiz__footer-left">
          {step === 0 && missingRequired.length > 0 && (
            <span style={{ color: "var(--danger, #ef4444)" }}>
              Obrigatório: {missingRequired.join(", ")}
            </span>
          )}
          {step === 0 && missingRequired.length === 0 && (
            <span style={{ color: "var(--success, #22c55e)" }}>
              <Check size={12} style={{ display: "inline", marginRight: 4 }} />
              Pronto para continuar
            </span>
          )}
          {step === 1 && (
            <>
              <Clapperboard size={13} />
              {template.scenes.length} cenas
              <Clock size={13} style={{ marginLeft: 8 }} />
              ~{durationSec}s
            </>
          )}
          {step === 2 && (
            <span>Selecione o formato e clique em Exportar</span>
          )}
        </div>
        <div className="vt-twiz__footer-actions">
          <Button variant="secondary" onClick={handleBack}>
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          <Button
            variant="primary"
            icon={step === STEPS.length - 1 ? undefined : <ArrowRight size={14} />}
            onClick={handleNext}
            disabled={!canProceed || exporting}
          >
            {step === STEPS.length - 1
              ? exporting ? "Exportando…" : "Exportar"
              : "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ── Step 1: Variables ───────────────────────────────────────────────────── */

const VariablesStep: React.FC<{
  textVars: TemplateVariable[];
  imageVars: TemplateVariable[];
  colorVars: TemplateVariable[];
  values: Record<string, string>;
  template: import("../remotion/template-types").Template;
  onValueChange: (key: string, value: string) => void;
}> = ({ textVars, imageVars, colorVars, values, template, onValueChange }) => {
  const totalFrames = templateTotalFrames(template);
  const firstSceneDuration = template.scenes[0]?.durationInFrames ?? 0;

  return (
    <div className="vt-twiz__vars-layout">
      <div className="vt-twiz__vars-form">
        {textVars.length > 0 && (
          <div className="vt-twiz__var-group">
            <div className="vt-twiz__section-heading">Informações do anúncio</div>
            {textVars.map((v) => (
              <VarField key={v.key} variable={v} value={values[v.key] ?? ""} onChange={(val) => onValueChange(v.key, val)} />
            ))}
          </div>
        )}
        {imageVars.length > 0 && (
          <div className="vt-twiz__var-group">
            <div className="vt-twiz__section-heading">Imagens</div>
            {imageVars.map((v) => (
              <ImageVarField key={v.key} variable={v} value={values[v.key] ?? ""} onChange={(val) => onValueChange(v.key, val)} />
            ))}
          </div>
        )}
        {colorVars.length > 0 && (
          <div className="vt-twiz__var-group">
            <div className="vt-twiz__section-heading">Cores</div>
            {colorVars.map((v) => (
              <ColorVarField key={v.key} variable={v} value={values[v.key] ?? "#ffffff"} onChange={(val) => onValueChange(v.key, val)} />
            ))}
          </div>
        )}
      </div>

      <div className="vt-twiz__vars-preview">
        <div style={{ width: "100%", maxWidth: 600 }}>
          <Player
            component={TemplateRenderer}
            inputProps={{ template, values }}
            durationInFrames={Math.max(totalFrames, 1)}
            fps={template.fps}
            compositionWidth={template.width}
            compositionHeight={template.height}
            style={{ width: "100%", aspectRatio: "16/9", display: "block", borderRadius: 6, overflow: "hidden" }}
            initialFrame={Math.min(firstSceneDuration + 30, Math.max(totalFrames - 1, 0))}
            autoPlay
            loop
            acknowledgeRemotionLicense
          />
          <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>
            Preview ao vivo — atualiza conforme você preenche
          </p>
        </div>
      </div>
    </div>
  );
};

const VarField: React.FC<{
  variable: TemplateVariable;
  value: string;
  onChange: (v: string) => void;
}> = ({ variable, value, onChange }) => (
  <div className="vt-twiz__var-field">
    <label className="vt-twiz__var-label">
      {variable.label}
      {variable.required && <span className="vt-twiz__var-required">*</span>}
    </label>
    <input
      className="vt-twiz__var-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={variable.defaultValue || variable.label}
    />
  </div>
);

const ImageVarField: React.FC<{
  variable: TemplateVariable;
  value: string;
  onChange: (v: string) => void;
}> = ({ variable, value, onChange }) => {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const displaySrc = value ? (value.startsWith("http") ? value : staticFile(value)) : null;

  return (
    <div className="vt-twiz__var-field">
      <label className="vt-twiz__var-label">
        {variable.label}
        {variable.required && <span className="vt-twiz__var-required">*</span>}
      </label>
      <div className="vt-twiz__var-upload">
        <button
          type="button"
          className="vt-twiz__var-thumb-btn"
          onClick={() => setPickerOpen(true)}
        >
          {displaySrc ? (
            <img src={displaySrc} className="vt-twiz__var-thumb" alt={variable.label} onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <div className="vt-twiz__var-thumb-placeholder">
              <ImageIcon size={16} />
            </div>
          )}
          <div className="vt-twiz__var-thumb-overlay">Alterar</div>
        </button>
        {value && (
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
            {value.split("/").pop()}
          </span>
        )}
      </div>
      <MediaPickerDialog
        open={pickerOpen}
        accept="image"
        currentValue={value}
        onSelect={(path) => { onChange(path); setPickerOpen(false); }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
};

const ColorVarField: React.FC<{
  variable: TemplateVariable;
  value: string;
  onChange: (v: string) => void;
}> = ({ variable, value, onChange }) => (
  <div className="vt-twiz__var-field">
    <label className="vt-twiz__var-label">{variable.label}</label>
    <div className="vt-twiz__var-color-row">
      <input
        type="color"
        className="vt-twiz__var-color-swatch"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="vt-twiz__var-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#ffffff"
        style={{ flex: 1 }}
      />
    </div>
  </div>
);

/* ── Step 2: Preview ─────────────────────────────────────────────────────── */

const PreviewStep: React.FC<{
  template: import("../remotion/template-types").Template;
  values: Record<string, string>;
  totalFrames: number;
  playerRef: React.RefObject<PlayerRef | null>;
}> = ({ template, values, totalFrames }) => (
  <div className="vt-twiz__preview-layout">
    <div className="vt-twiz__preview-wrap">
      <Player
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
    <div className="vt-twiz__preview-meta">
      <span><Clapperboard size={13} style={{ display: "inline", marginRight: 4 }} />{template.scenes.length} cenas</span>
      <span><Clock size={13} style={{ display: "inline", marginRight: 4 }} />~{Math.round(totalFrames / template.fps)}s</span>
      <span>{template.fps}fps · {template.width}×{template.height}</span>
    </div>
  </div>
);

/* ── Step 3: Export ──────────────────────────────────────────────────────── */

const ExportStep: React.FC<{
  selectedFormat: ExportFormat;
  onSelectFormat: (f: ExportFormat) => void;
}> = ({ selectedFormat, onSelectFormat }) => (
  <div className="vt-twiz__export-layout">
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", textAlign: "center", marginBottom: 8 }}>
        Escolha o formato de exportação
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
        Você pode exportar nos 4 formatos após fechar essa tela.
      </p>
    </div>
    <div className="vt-twiz__format-grid">
      {FORMAT_OPTIONS.map((f) => (
        <button
          key={f.id}
          className={`vt-twiz__format-card${selectedFormat === f.id ? " vt-twiz__format-card--active" : ""}`}
          onClick={() => onSelectFormat(f.id)}
        >
          <div className="vt-twiz__format-icon">{f.icon}</div>
          <span className="vt-twiz__format-name">{f.label}</span>
          <span className="vt-twiz__format-res">{f.res}</span>
        </button>
      ))}
    </div>
  </div>
);
