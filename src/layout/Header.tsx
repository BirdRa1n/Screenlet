import React, { useState } from "react";
import { ArrowLeft, Download, Save, Smartphone, Tv2 } from "lucide-react";
import { Button, Dialog, IconButton, ProgressBar, Field, TextField } from "../design-system/components";
import { useNavigationStore } from "../store/useNavigationStore";
import { useAdStore } from "../store/useAdStore";
import { useProjectsStore } from "../store/useProjectsStore";
import { toast } from "../store/useToastStore";
import type { ExportProgress } from "../global";
import "./Header.css";

/* ---- Export format dialog ---- */

type Format = { id: string; label: string; dims: string; icon: React.ReactNode; available: boolean };

const FORMATS: Format[] = [
  { id: "tv",        label: "TV / Monitor", dims: "1920 × 1080 · 16:9",  icon: <Tv2 size={18} />,       available: true  },
  { id: "instagram", label: "Instagram",    dims: "1080 × 1080 · 1:1",   icon: <Smartphone size={18} />, available: false },
  { id: "stories",   label: "Stories",      dims: "1080 × 1920 · 9:16",  icon: <Smartphone size={18} />, available: false },
  { id: "tiktok",    label: "TikTok",       dims: "1080 × 1920 · 9:16",  icon: <Smartphone size={18} />, available: false },
];

const ExportDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  exporting: boolean;
}> = ({ open, onClose, onExport, exporting }) => {
  const [selected, setSelected] = useState("tv");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Exportar vídeo"
      description="Escolha o formato de destino para o vídeo."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={exporting || selected !== "tv"}
            onClick={onExport}
            icon={<Download size={14} />}
          >
            {exporting ? "Exportando..." : "Exportar MP4"}
          </Button>
        </>
      }
    >
      <div className="vt-export-formats">
        {FORMATS.map((f) => (
          <div
            key={f.id}
            className={[
              "vt-export-format",
              selected === f.id && f.available ? "vt-export-format--selected" : "",
              !f.available ? "vt-export-format--disabled" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => f.available && setSelected(f.id)}
          >
            <span className="vt-export-format__icon">{f.icon}</span>
            <div>
              <div className="vt-export-format__name">{f.label}</div>
              <div className="vt-export-format__dims">{f.dims}</div>
            </div>
            {!f.available && <span className="vt-export-format__soon">Em breve</span>}
          </div>
        ))}
      </div>
    </Dialog>
  );
};

/* ---- Save dialog ---- */

const SaveDialog: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const config = useAdStore((s) => s.config);
  const save = useProjectsStore((s) => s.save);
  const [name, setName] = useState(config.storeName || "Meu anúncio");

  const handleSave = async () => {
    if (!name.trim()) return;
    await save(config, name.trim());
    toast.success(`Projeto "${name.trim()}" salvo.`);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Salvar projeto"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} icon={<Save size={14} />}>Salvar</Button>
        </>
      }
    >
      <Field label="Nome do projeto">
        <TextField
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
      </Field>
    </Dialog>
  );
};

/* ---- Editor header ---- */

export const EditorHeader: React.FC<{
  exporting: boolean;
  progress: ExportProgress | null;
  exportMessage: string | null;
  onExport: () => void;
  exportDisabled: boolean;
}> = ({ exporting, progress, exportMessage, onExport, exportDisabled }) => {
  const navigate = useNavigationStore((s) => s.navigate);
  const [exportOpen, setExportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  return (
    <>
      <header className="vt-header">
        <div className="vt-header__left">
          <IconButton label="Voltar ao dashboard" onClick={() => navigate("dashboard")}>
            <ArrowLeft size={15} />
          </IconButton>
          <span className="vt-header__page-title">Editor de anúncio</span>
        </div>

        <div className="vt-header__status">
          {exporting && progress ? (
            <ProgressBar
              progress={progress.progress}
              label={progress.phase === "bundling" ? "Preparando" : "Renderizando"}
            />
          ) : exportMessage ? (
            <span className="vt-header__message">{exportMessage}</span>
          ) : null}
        </div>

        <div className="vt-header__right">
          <Button variant="secondary" icon={<Save size={14} />} onClick={() => setSaveOpen(true)} disabled={exportDisabled}>
            Salvar
          </Button>
          <Button
            variant="primary"
            disabled={exporting || exportDisabled}
            onClick={() => setExportOpen(true)}
            icon={<Download size={14} />}
          >
            {exporting ? "Exportando..." : "Exportar MP4"}
          </Button>
        </div>
      </header>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={() => { setExportOpen(false); onExport(); }}
        exporting={exporting}
      />
      <SaveDialog open={saveOpen} onClose={() => setSaveOpen(false)} />
    </>
  );
};
