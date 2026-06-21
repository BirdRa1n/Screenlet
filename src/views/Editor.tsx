"use client";

import { useEffect, useState } from "react";
import { useAdStore } from "../store/useAdStore";
import { useTemplateStore } from "../store/useTemplateStore";
import { toast } from "../store/useToastStore";
import { EditorHeader } from "../layout/Header";
import { SceneListPanel } from "../layout/SceneListPanel";
import { PreviewPanel } from "../layout/PreviewPanel";
import { InspectorPanel } from "../layout/InspectorPanel";
import { Button, Dialog, Field, TextField } from "../design-system/components";
import { cn } from "@/lib/utils";
import { FORMAT_DIMENSIONS, type ExportFormat } from "../remotion/types";
import type { ExportProgress } from "../global";

type FpsDialogState = { payload: unknown; suggestedName: string };

export const Editor: React.FC = () => {
  const config = useAdStore((s) => s.config);
  const allTemplates = useTemplateStore((s) => s.templates);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const [fpsDialog, setFpsDialog] = useState<FpsDialogState | null>(null);
  const [selectedFps, setSelectedFps] = useState<30 | 60>(30);
  const [renderName, setRenderName] = useState("");

  useEffect(() => {
    return window.adFrame?.onExportProgress((data) => setProgress(data));
  }, []);

  const runExport = async (payload: unknown, suggestedName: string, fps: 30 | 60) => {
    setExporting(true);
    setExportMessage(null);
    setProgress(null);
    try {
      const result = await window.adFrame.exportVideo(payload, suggestedName, fps);
      if (!result.ok) {
        toast.error(`Erro ao renderizar: ${result.error}`);
        setExportMessage(`Erro: ${result.error}`);
      } else {
        toast.success("Vídeo renderizado com sucesso!");
        setExportMessage("Salvo em Vídeos renderizados.");
      }
    } catch (err) {
      toast.error(`Erro ao renderizar: ${(err as Error).message}`);
      setExportMessage(`Erro: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const openFpsDialog = (payload: unknown, suggestedName: string) => {
    setSelectedFps(30);
    setRenderName(suggestedName.replace(/\.mp4$/i, ""));
    setFpsDialog({ payload, suggestedName });
  };

  const confirmRender = async () => {
    if (!fpsDialog) return;
    const filename = (renderName.trim() || "render") + ".mp4";
    const d = fpsDialog;
    setFpsDialog(null);
    await runExport(d.payload, filename, selectedFps);
  };

  const handleExport = (format: ExportFormat = "tv") => {
    const { width, height } = FORMAT_DIMENSIONS[format];
    const hasTemplateScenes = config.scenes.some((s) => s.type === "template");
    const payload = hasTemplateScenes
      ? { ...config, width, height, templates: allTemplates }
      : { ...config, width, height };
    openFpsDialog(payload, `anuncio-${format}.mp4`);
  };

  return (
    <div className="flex h-full flex-col">
      <EditorHeader
        exporting={exporting}
        progress={progress}
        exportMessage={exportMessage}
        onExport={(format) => handleExport(format ?? "tv")}
        exportDisabled={config.scenes.length === 0}
      />
      <div className="flex min-h-0 flex-1">
        <SceneListPanel />
        <PreviewPanel />
        <InspectorPanel />
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
            <TextField
              value={renderName}
              onChange={(e) => setRenderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !exporting && confirmRender()}
              placeholder="meu-video"
            />
          </Field>
          <p className="text-sm text-muted-foreground">
            Escolha a taxa de quadros do vídeo exportado. O arquivo será salvo automaticamente em{" "}
            <strong>Vídeos renderizados</strong>.
          </p>
          <div className="flex flex-col gap-2">
            {([30, 60] as const).map((fps) => (
              <label
                key={fps}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                  selectedFps === fps ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30",
                )}
              >
                <input
                  type="radio"
                  name="fps"
                  value={fps}
                  checked={selectedFps === fps}
                  onChange={() => setSelectedFps(fps)}
                  className="accent-primary"
                />
                <div>
                  <span className="block text-sm font-medium">{fps} fps</span>
                  <span className="block text-xs text-muted-foreground">
                    {fps === 30 ? "Recomendado — menor tamanho de arquivo" : "Maior fluidez — arquivo maior"}
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
