import React, { useEffect, useState } from "react";
import { ArrowLeft, Download, Save, Smartphone, Tv2 } from "lucide-react";
import { Button, Dialog, IconButton, ProgressBar, Field, TextField } from "../design-system/components";
import { useNavigationStore } from "../store/useNavigationStore";
import { useAdStore } from "../store/useAdStore";
import { useProjectsStore } from "../store/useProjectsStore";
import { toast } from "../store/useToastStore";
import { FORMAT_DIMENSIONS, type ExportFormat } from "../remotion/types";
import type { ExportProgress } from "../global";
import "../styles/layout/Header.css";

/* ---- Export format dialog ---- */

const FORMAT_ICONS: Record<ExportFormat, React.ReactNode> = {
  tv:        <Tv2 size={18} />,
  instagram: <Smartphone size={18} />,
  stories:   <Smartphone size={18} />,
  tiktok:    <Smartphone size={18} />,
};

const ExportDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat) => void;
  exporting: boolean;
}> = ({ open, onClose, onExport, exporting }) => {
  const [selected, setSelected] = useState<ExportFormat>("tv");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Renderizar vídeo"
      description="Escolha o formato de destino. O layout se adapta automaticamente."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={exporting}
            onClick={() => onExport(selected)}
            icon={<Download size={14} />}
          >
            {exporting ? "Renderizando…" : "Renderizar"}
          </Button>
        </>
      }
    >
      <div className="vt-export-formats">
        {(Object.keys(FORMAT_DIMENSIONS) as ExportFormat[]).map((id) => {
          const f = FORMAT_DIMENSIONS[id];
          return (
            <div
              key={id}
              className={[
                "vt-export-format",
                selected === id ? "vt-export-format--selected" : "",
              ].join(" ")}
              onClick={() => setSelected(id)}
            >
              <span className="vt-export-format__icon">{FORMAT_ICONS[id]}</span>
              <div>
                <div className="vt-export-format__name">{f.label}</div>
                <div className="vt-export-format__dims">{f.dims}</div>
              </div>
              {selected === id && <span className="vt-export-format__check">✓</span>}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
};

/* ---- Save dialog ---- */

const SaveDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const config = useAdStore((s) => s.config);
  const currentProjectName = useAdStore((s) => s.currentProjectName);
  const setCurrentProjectName = useAdStore((s) => s.setCurrentProjectName);
  const save = useProjectsStore((s) => s.save);
  const [name, setName] = useState(currentProjectName ?? config.storeName ?? "");

  useEffect(() => {
    if (open) setName(currentProjectName ?? config.storeName ?? "");
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    await save(config, name.trim());
    setCurrentProjectName(name.trim());
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
  onExport: (format?: ExportFormat) => void;
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
            {exporting ? "Renderizando…" : "Renderizar MP4"}
          </Button>
        </div>
      </header>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={(format) => { setExportOpen(false); onExport(format); }}
        exporting={exporting}
      />
      <SaveDialog open={saveOpen} onClose={() => setSaveOpen(false)} />
    </>
  );
};
