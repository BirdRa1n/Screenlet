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
import { Wizard } from "./pages/Wizard";
import { Settings } from "./pages/Settings";
import { Templates } from "./pages/Templates";
import { TemplateBuilder } from "./pages/TemplateBuilder";
import { TemplateWizard } from "./pages/TemplateWizard";
import { Channels } from "./pages/Channels";
import { Schedules } from "./pages/Schedules";
import { ScheduleBuilder } from "./pages/ScheduleBuilder";
import { IptvServer } from "./pages/IptvServer";
import { FORMAT_DIMENSIONS, type ExportFormat, type AdConfig } from "./remotion/types";
import type { ExportProgress } from "./global";
import "./styles/app.css";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: "easeIn" as const } },
};

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

  useEffect(() => {
    return window.adFrame.onExportProgress((data) => setProgress(data));
  }, []);

  const runExport = async (payload: unknown, suggestedName: string) => {
    setExporting(true);
    setExportMessage(null);
    setProgress(null);
    try {
      const result = await window.adFrame.exportVideo(payload, suggestedName);
      if (result.canceled) {
        toast.info("Exportação cancelada.");
        setExportMessage("Exportação cancelada.");
      } else {
        toast.success("Vídeo exportado com sucesso!");
        setExportMessage(`Salvo em: ${result.filePath}`);
        if (page === "wizard") navigate("editor");
      }
    } catch (err) {
      toast.error(`Erro ao exportar: ${(err as Error).message}`);
      setExportMessage(`Erro: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  // Legacy export for old Wizard / editor
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
    await runExport(payload, `anuncio-adframe-${format}.mp4`);
  };

  // Template-based export: sends { template, values, width, height } to main
  const handleTemplateExport = async (format: ExportFormat) => {
    if (!instanceTemplate) return;
    const { width, height } = FORMAT_DIMENSIONS[format];
    await runExport(
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
          {page === "schedules" && (
            <motion.div key="schedules" className="vt-app__main" {...pageVariants}>
              <Schedules />
            </motion.div>
          )}
          {page === "schedule-builder" && (
            <motion.div key="schedule-builder" className="vt-app__main" {...pageVariants}>
              <ScheduleBuilder />
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
    </div>
  );
}
