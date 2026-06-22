"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Download, Save } from "lucide-react";
import { Button, Dialog, IconButton, ProgressBar, Field, TextField } from "../design-system/components";
import { cn } from "@/lib/utils";
import { useAdStore } from "../store/useAdStore";
import { useProjectsStore } from "../store/useProjectsStore";
import { toast } from "../store/useToastStore";
import { formatIcon } from "../lib/exportFormats";
import { FORMAT_DIMENSIONS, type ExportFormat } from "../remotion/types";
import type { ExportProgress } from "../global";

const FORMAT_ICONS: Record<ExportFormat, React.ReactNode> = {
  tv: formatIcon("tv", 18),
  instagram: formatIcon("instagram", 18),
  stories: formatIcon("stories", 18),
  tiktok: formatIcon("tiktok", 18),
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
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={exporting} onClick={() => onExport(selected)} icon={<Download size={14} />}>
            {exporting ? "Renderizando…" : "Renderizar"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(FORMAT_DIMENSIONS) as ExportFormat[]).map((id) => {
          const f = FORMAT_DIMENSIONS[id];
          const active = selected === id;
          return (
            <button
              key={id}
              className={cn(
                "relative flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/30",
              )}
              onClick={() => setSelected(id)}
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {FORMAT_ICONS[id]}
              </span>
              <div>
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-muted-foreground">{f.dims}</div>
              </div>
              {active && <Check size={16} className="absolute right-3 top-3 text-primary" />}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
};

const SaveDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const config = useAdStore((s) => s.config);
  const currentProjectName = useAdStore((s) => s.currentProjectName);
  const setCurrentProjectName = useAdStore((s) => s.setCurrentProjectName);
  const save = useProjectsStore((s) => s.save);
  const [name, setName] = useState(currentProjectName ?? config.storeName ?? "");

  useEffect(() => {
    if (open) setName(currentProjectName ?? config.storeName ?? "");
  }, [open, config.storeName, currentProjectName]);

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
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} icon={<Save size={14} />}>
            Salvar
          </Button>
        </>
      }
    >
      <Field label="Nome do projeto">
        <TextField value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()} />
      </Field>
    </Dialog>
  );
};

export const EditorHeader: React.FC<{
  exporting: boolean;
  progress: ExportProgress | null;
  exportMessage: string | null;
  onExport: (format?: ExportFormat) => void;
  exportDisabled: boolean;
}> = ({ exporting, progress, exportMessage, onExport, exportDisabled }) => {
  const router = useRouter();
  const [exportOpen, setExportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  return (
    <>
      <header
        className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4"
        style={{ paddingRight: "max(1rem, var(--win-controls-w, 0px))" }}
      >
        <div className="flex items-center gap-2">
          <IconButton label="Voltar ao dashboard" onClick={() => router.push("/")}>
            <ArrowLeft size={15} />
          </IconButton>
          <span className="text-sm font-semibold">Editor de anúncio</span>
        </div>

        <div className="mx-auto min-w-0 max-w-sm flex-1">
          {exporting && progress ? (
            <ProgressBar progress={progress.progress} label={progress.phase === "bundling" ? "Preparando" : "Renderizando"} />
          ) : exportMessage ? (
            <span className="block truncate text-center text-xs text-muted-foreground">{exportMessage}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Save size={14} />} onClick={() => setSaveOpen(true)} disabled={exportDisabled}>
            Salvar
          </Button>
          <Button variant="primary" disabled={exporting || exportDisabled} onClick={() => setExportOpen(true)} icon={<Download size={14} />}>
            {exporting ? "Renderizando…" : "Renderizar MP4"}
          </Button>
        </div>
      </header>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={(format) => {
          setExportOpen(false);
          onExport(format);
        }}
        exporting={exporting}
      />
      <SaveDialog open={saveOpen} onClose={() => setSaveOpen(false)} />
    </>
  );
};
