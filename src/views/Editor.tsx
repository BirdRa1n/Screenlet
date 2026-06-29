"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAdStore } from "../store/useAdStore";
import { useTemplateStore } from "../store/useTemplateStore";
import { toast } from "../store/useToastStore";
import { EditorHeader } from "../layout/Header";
import { SceneListPanel } from "../layout/SceneListPanel";
import { PreviewPanel } from "../layout/PreviewPanel";
import { InspectorPanel } from "../layout/InspectorPanel";
import { Button, Dialog, Field, TextField } from "../design-system/components";
import { cn } from "@/lib/utils";
import { FORMAT_DIMENSIONS, type ExportFormat, type LibraryProductSnapshot, type ProductSceneConfig } from "../remotion/types";
import { libraryDriftPatch, librarySnapshotOf } from "@/lib/libraryScene";
import type { ExportProgress } from "../global";

type FpsDialogState = { payload: unknown; defaultBase: string };

// An imported product scene that drifted from its library product.
type DriftItem = {
  sceneId: string;
  name: string;
  changed: string[];
  patch: Partial<ProductSceneConfig>;
  snapshot: LibraryProductSnapshot;
};

export const Editor: React.FC = () => {
  const config = useAdStore((s) => s.config);
  const updateScene = useAdStore((s) => s.updateScene);
  const currentProjectName = useAdStore((s) => s.currentProjectName);
  const allTemplates = useTemplateStore((s) => s.templates);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const [fpsDialog, setFpsDialog] = useState<FpsDialogState | null>(null);
  const [selectedFps, setSelectedFps] = useState<30 | 60>(30);
  const [renderName, setRenderName] = useState("");

  const [drift, setDrift] = useState<DriftItem[]>([]);
  const [driftOpen, setDriftOpen] = useState(false);

  useEffect(() => {
    return window.adFrame?.onExportProgress((data) => setProgress(data));
  }, []);

  // On opening the project, check whether any product scene imported from the
  // library is now outdated (image/price/description/etc. changed in the
  // library since import) and offer to refresh them — only for imported scenes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const scenes = useAdStore.getState().config.scenes;
      if (!scenes.some((s) => s.type === "product" && s.libraryProductId)) return;
      const products = await window.adFrame?.libraryList();
      if (cancelled || !products) return;
      const byId = new Map(products.map((p) => [p.id, p]));
      const items: DriftItem[] = [];
      for (const scene of scenes) {
        if (scene.type !== "product" || !scene.libraryProductId) continue;
        const product = byId.get(scene.libraryProductId);
        if (!product) continue; // removido da biblioteca — nada a sincronizar
        const result = libraryDriftPatch(scene, product);
        if (result) {
          items.push({
            sceneId: scene.id,
            name: product.name || scene.productName,
            changed: result.changed,
            patch: result.patch,
            snapshot: librarySnapshotOf(product),
          });
        }
      }
      if (!cancelled && items.length) {
        setDrift(items);
        setDriftOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyDrift = () => {
    const scenes = useAdStore.getState().config.scenes;
    let count = 0;
    for (const item of drift) {
      const scene = scenes.find((s) => s.id === item.sceneId);
      if (!scene || scene.type !== "product") continue;
      updateScene(scene.id, { ...scene, ...item.patch, librarySnapshot: item.snapshot });
      count += 1;
    }
    setDriftOpen(false);
    setDrift([]);
    if (count) toast.success(`${count} cena(s) atualizada(s) com a biblioteca.`);
  };

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
        for (const channel of result.updatedChannels ?? []) {
          toast.info(
            `O conteúdo antigo do canal "${channel.name}" foi atualizado — as telas estão sendo sincronizadas.`,
          );
        }
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
    setRenderName("");
    // When the field is left blank, fall back to the project name (e.g.
    // "projeto.mp4"); only if there's no open project use the format-based name.
    const defaultBase = currentProjectName?.trim() || suggestedName.replace(/\.mp4$/i, "") || "projeto";
    setFpsDialog({ payload, defaultBase });
  };

  const confirmRender = async () => {
    if (!fpsDialog) return;
    const d = fpsDialog;
    const filename = (renderName.trim() || d.defaultBase) + ".mp4";
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
        open={driftOpen}
        onClose={() => setDriftOpen(false)}
        title="Produtos desatualizados"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDriftOpen(false)}>
              Agora não
            </Button>
            <Button variant="primary" icon={<RefreshCw size={14} />} onClick={applyDrift}>
              Atualizar {drift.length} {drift.length > 1 ? "cenas" : "cena"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Estes produtos importados da biblioteca foram alterados depois que entraram no projeto.
            Atualize para refletir os dados atuais da biblioteca — suas demais edições nas cenas são mantidas.
          </p>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {drift.map((item) => (
              <li key={item.sceneId} className="flex flex-col gap-0.5 px-3 py-2">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground">Mudou: {item.changed.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      </Dialog>

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
          <Field
            label="Nome do arquivo (.mp4)"
            hint={`Em branco usa o nome do projeto — "${fpsDialog?.defaultBase ?? "projeto"}.mp4". Se já existir, será substituído.`}
          >
            <TextField
              value={renderName}
              onChange={(e) => setRenderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !exporting && confirmRender()}
              placeholder={fpsDialog?.defaultBase ?? "projeto"}
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
