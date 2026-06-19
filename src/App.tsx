import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAdStore } from "./store/useAdStore";
import { useTemplateStore } from "./store/useTemplateStore";
import { useNavigationStore } from "./store/useNavigationStore";
import { useTemplateInstanceStore } from "./store/useTemplateInstanceStore";
import { toast } from "./store/useToastStore";
import { Sidebar } from "./layout/Sidebar";
import { EditorHeader } from "./layout/Header";
import { ToastContainer } from "./design-system/components";
import { SceneListPanel } from "./layout/SceneListPanel";
import { PreviewPanel } from "./layout/PreviewPanel";
import { InspectorPanel } from "./layout/InspectorPanel";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { Library } from "./pages/Library";
import { MediaHub } from "./pages/MediaHub";
import { Wizard } from "./pages/Wizard";
import { Settings } from "./pages/Settings";
import { Templates } from "./pages/Templates";
import { TemplateBuilder } from "./pages/TemplateBuilder";
import { TemplateWizard } from "./pages/TemplateWizard";
import { Channels } from "./pages/Channels";
import { Devices } from "./pages/Devices";
import { Renders } from "./pages/Renders";
import { IptvServer } from "./pages/IptvServer";
import { Button, Dialog, Field, TextField } from "./design-system/components";
import { FORMAT_DIMENSIONS, type ExportFormat, type AdConfig } from "./remotion/types";
import type { ExportProgress } from "./global";
import "./styles/app.css";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: "easeIn" as const } },
};

type FpsDialogState = { payload: unknown; suggestedName: string };

export default function App() {
  const page = useNavigationStore((s) => s.page);
  const editingTemplateId = useNavigationStore((s) => s.editingTemplateId);
  const config = useAdStore((s) => s.config);
  const allTemplates = useTemplateStore((s) => s.templates);
  const navigate = useNavigationStore((s) => s.navigate);

  const instanceTemplate = useTemplateInstanceStore((s) => s.template);
  const instanceValues = useTemplateInstanceStore((s) => s.values);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // FPS selection dialog
  const [fpsDialog, setFpsDialog] = useState<FpsDialogState | null>(null);
  const [selectedFps, setSelectedFps] = useState<30 | 60>(30);
  const [renderName, setRenderName] = useState("");

  useEffect(() => {
    return window.adFrame.onExportProgress((data) => setProgress(data));
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
        setExportMessage(`Salvo em Vídeos renderizados.`);
        if (page === "wizard") navigate("editor");
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

  const handleExport = async (formatOrConfig?: ExportFormat | AdConfig, overrideConfig?: AdConfig) => {
    let cfg = overrideConfig ?? config;
    let format: ExportFormat = "tv";
    if (typeof formatOrConfig === "string") {
      format = formatOrConfig;
    } else if (formatOrConfig && "scenes" in formatOrConfig) {
      cfg = formatOrConfig;
    }
    const { width, height } = FORMAT_DIMENSIONS[format];
    const hasTemplateScenes = cfg.scenes.some((s) => s.type === "template");
    const payload = hasTemplateScenes ? { ...cfg, width, height, templates: allTemplates } : { ...cfg, width, height };
    openFpsDialog(payload, `anuncio-${format}.mp4`);
  };

  const handleTemplateExport = async (format: ExportFormat) => {
    if (!instanceTemplate) return;
    const { width, height } = FORMAT_DIMENSIONS[format];
    openFpsDialog(
      { template: instanceTemplate, values: instanceValues, width, height },
      `${instanceTemplate.name.toLowerCase().replace(/\s+/g, "-")}-${format}.mp4`
    );
  };

  return (
    <div className="vt-app">
      <Sidebar />

      <div className="vt-app__main">
        <AnimatePresence mode="wait">
          {page === "dashboard" && (
            <motion.div key="dashboard" className="vt-app__main" {...pageVariants}>
              <Dashboard />
            </motion.div>
          )}
          {page === "projects" && (
            <motion.div key="projects" className="vt-app__main" {...pageVariants}>
              <Projects />
            </motion.div>
          )}
          {page === "library" && (
            <motion.div key="library" className="vt-app__main" {...pageVariants}>
              <Library />
            </motion.div>
          )}
          {page === "media-hub" && (
            <motion.div key="media-hub" className="vt-app__main" {...pageVariants}>
              <MediaHub />
            </motion.div>
          )}
          {page === "renders" && (
            <motion.div key="renders" className="vt-app__main" {...pageVariants}>
              <Renders />
            </motion.div>
          )}
          {page === "templates" && (
            <motion.div key="templates" className="vt-app__main" {...pageVariants}>
              <Templates />
            </motion.div>
          )}
          {page === "template-builder" && (
            <motion.div key={`template-builder-${editingTemplateId ?? "new"}`} className="vt-app__main" {...pageVariants}>
              <TemplateBuilder templateId={editingTemplateId ?? undefined} />
            </motion.div>
          )}
          {page === "template-wizard" && (
            <motion.div key="template-wizard" className="vt-app__main" {...pageVariants}>
              <TemplateWizard
                onExport={handleTemplateExport}
                exporting={exporting}
              />
            </motion.div>
          )}
          {page === "channels" && (
            <motion.div key="channels" className="vt-app__main" {...pageVariants}>
              <Channels />
            </motion.div>
          )}
          {page === "devices" && (
            <motion.div key="devices" className="vt-app__main" {...pageVariants}>
              <Devices />
            </motion.div>
          )}
          {page === "iptv" && (
            <motion.div key="iptv" className="vt-app__main" {...pageVariants}>
              <IptvServer />
            </motion.div>
          )}
          {page === "settings" && (
            <motion.div key="settings" className="vt-app__main" {...pageVariants}>
              <Settings />
            </motion.div>
          )}
          {page === "wizard" && (
            <motion.div key="wizard" className="vt-app__main" {...pageVariants}>
              <Wizard onExport={(cfg) => handleExport(cfg)} exporting={exporting} />
            </motion.div>
          )}
          {page === "editor" && (
            <motion.div key="editor" className="vt-app__main" {...pageVariants}>
              <EditorHeader
                exporting={exporting}
                progress={progress}
                exportMessage={exportMessage}
                onExport={(format) => handleExport(format ?? "tv")}
                exportDisabled={config.scenes.length === 0}
              />
              <div className="vt-app__editor">
                <SceneListPanel />
                <PreviewPanel />
                <InspectorPanel />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ToastContainer />

      {/* FPS selection dialog */}
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
        <div className="vt-app__fps-dialog">
          <Field label="Nome do arquivo (.mp4)">
            <TextField
              value={renderName}
              onChange={(e) => setRenderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !exporting && confirmRender()}
              placeholder="meu-video"
            />
          </Field>
          <p className="vt-app__fps-dialog-desc">
            Escolha a taxa de quadros do vídeo exportado. O arquivo será salvo automaticamente em <strong>Vídeos renderizados</strong>.
          </p>
          <div className="vt-app__fps-options">
            <label className={`vt-app__fps-option${selectedFps === 30 ? " vt-app__fps-option--active" : ""}`}>
              <input type="radio" name="fps" value="30" checked={selectedFps === 30} onChange={() => setSelectedFps(30)} />
              <div>
                <span className="vt-app__fps-label">30 fps</span>
                <span className="vt-app__fps-desc">Recomendado — menor tamanho de arquivo</span>
              </div>
            </label>
            <label className={`vt-app__fps-option${selectedFps === 60 ? " vt-app__fps-option--active" : ""}`}>
              <input type="radio" name="fps" value="60" checked={selectedFps === 60} onChange={() => setSelectedFps(60)} />
              <div>
                <span className="vt-app__fps-label">60 fps</span>
                <span className="vt-app__fps-desc">Maior fluidez — arquivo maior</span>
              </div>
            </label>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
