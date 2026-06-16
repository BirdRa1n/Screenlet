import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAdStore } from "./store/useAdStore";
import { useNavigationStore } from "./store/useNavigationStore";
import { toast } from "./store/useToastStore";
import { Sidebar } from "./layout/Sidebar";
import { EditorHeader } from "./layout/Header";
import { ToastContainer } from "./design-system/components";
import { SceneListPanel } from "./layout/SceneListPanel";
import { PreviewPanel } from "./layout/PreviewPanel";
import { InspectorPanel } from "./layout/InspectorPanel";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { Wizard } from "./pages/Wizard";
import { Settings } from "./pages/Settings";
import type { ExportProgress } from "./global";
import type { AdConfig } from "./remotion/types";
import "./App.css";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: "easeIn" as const } },
};

export default function App() {
  const page = useNavigationStore((s) => s.page);
  const config = useAdStore((s) => s.config);
  const navigate = useNavigationStore((s) => s.navigate);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    return window.vitrineTV.onExportProgress((data) => setProgress(data));
  }, []);

  const handleExport = async (overrideConfig?: AdConfig) => {
    const cfg = overrideConfig ?? config;
    setExporting(true);
    setExportMessage(null);
    setProgress(null);
    try {
      const result = await window.vitrineTV.exportVideo(cfg, "anuncio-vitrinetv.mp4");
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

          {page === "settings" && (
            <motion.div key="settings" className="vt-app__main" {...pageVariants}>
              <Settings />
            </motion.div>
          )}

          {page === "wizard" && (
            <motion.div key="wizard" className="vt-app__main" {...pageVariants}>
              <Wizard onExport={handleExport} exporting={exporting} />
            </motion.div>
          )}

          {page === "editor" && (
            <motion.div key="editor" className="vt-app__main" {...pageVariants}>
              <EditorHeader
                exporting={exporting}
                progress={progress}
                exportMessage={exportMessage}
                onExport={() => handleExport()}
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
