import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Player } from "@remotion/player";
import { Clock, Clapperboard, Copy, Download, Play, Plus, Trash2, Tv2, SquareIcon, Smartphone, Upload, Pencil } from "lucide-react";
import { Button, IconButton } from "../design-system/components";
import { ContextMenu, useContextMenu } from "../design-system/components/ContextMenu";
import { TemplateRenderer } from "../remotion/TemplateRenderer";
import { templateTotalFrames, defaultValues } from "../remotion/template-utils";
import { useTemplateStore } from "../store/useTemplateStore";
import { useNavigationStore } from "../store/useNavigationStore";
import { useTemplateInstanceStore } from "../store/useTemplateInstanceStore";
import { toast } from "../store/useToastStore";
import type { Template } from "../remotion/template-types";
import "../styles/pages/Templates.css";

const ALL_TAGS = ["Geral", "Varejo", "Açougue", "Sazonal"];

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  tv: <Tv2 size={12} />,
  instagram: <SquareIcon size={12} />,
  stories: <Smartphone size={12} />,
  tiktok: <Smartphone size={12} />,
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
} as const;

const cardVariant = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" as const } },
} as const;

export const Templates: React.FC = () => {
  const { templates, refresh, duplicate, remove, importTemplate } = useTemplateStore();
  const navigateToBuilder = useNavigationStore((s) => s.navigateToBuilder);
  const [activeTag, setActiveTag] = useState<string>("Todos");

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = activeTag === "Todos"
    ? templates
    : templates.filter((t) => t.tags.includes(activeTag));

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.adframe.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        await importTemplate(text);
        toast.success("Template importado com sucesso!");
      } catch {
        toast.error("Arquivo inválido. Use um arquivo .adframe.json.");
      }
    };
    input.click();
  };

  return (
    <div className="vt-templates">
      <div className="vt-templates__header">
        <div>
          <h1 className="vt-templates__title">Templates</h1>
          <p className="vt-templates__sub">
            {templates.length} template{templates.length !== 1 ? "s" : ""} disponíve{templates.length !== 1 ? "is" : "l"}.
            Todos são personalizáveis.
          </p>
        </div>
        <div className="vt-templates__header-actions">
          <Button variant="secondary" icon={<Upload size={14} />} onClick={handleImport}>
            Importar
          </Button>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => navigateToBuilder()}>
            Novo template
          </Button>
        </div>
      </div>

      <div className="vt-templates__filters">
        {(["Todos", ...ALL_TAGS]).map((tag) => (
          <button
            key={tag}
            className={`vt-templates__filter${activeTag === tag ? " vt-templates__filter--active" : ""}`}
            onClick={() => setActiveTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <motion.div
        className="vt-templates__grid"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {filtered.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            onDuplicate={() => { duplicate(tpl.id); toast.success(`"${tpl.name}" duplicado.`); }}
            onDelete={() => { remove(tpl.id); toast.info(`"${tpl.name}" removido.`); }}
          />
        ))}
      </motion.div>
    </div>
  );
};

const TemplateCard: React.FC<{
  template: Template;
  onDuplicate: () => void;
  onDelete: () => void;
}> = ({ template, onDuplicate, onDelete }) => {
  const navigate = useNavigationStore((s) => s.navigate);
  const navigateToBuilder = useNavigationStore((s) => s.navigateToBuilder);
  const setTemplateInstance = useTemplateInstanceStore((s) => s.setTemplate);
  const { exportTemplate } = useTemplateStore();
  const { menuProps, handleContextMenu, close } = useContextMenu();
  const [hovered, setHovered] = useState(false);

  const totalFrames = templateTotalFrames(template);
  const values = defaultValues(template);
  // Preview frame: skip first scene (logo/open) into first product scene
  const firstSceneDuration = template.scenes[0]?.durationInFrames ?? 0;
  const previewFrame = Math.min(firstSceneDuration + 30, Math.max(totalFrames - 1, 0));

  const handleOpenEditor = () => {
    navigateToBuilder(template.id);
  };

  const handleUse = () => {
    setTemplateInstance(template);
    navigate("template-wizard");
  };

  const durationSec = Math.round(totalFrames / template.fps);
  const isUser = !template.builtin;

  return (
    <>
      <motion.div
        className="vt-tpl-card"
        variants={cardVariant}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onContextMenu={handleContextMenu}
        style={{ "--tpl-accent": "#6e56f8" } as React.CSSProperties}
      >
        {/* Preview */}
        <div className="vt-tpl-card__preview">
          <Player
            component={TemplateRenderer}
            inputProps={{ template, values }}
            durationInFrames={Math.max(totalFrames, 1)}
            fps={template.fps}
            compositionWidth={template.width}
            compositionHeight={template.height}
            style={{ width: "100%", aspectRatio: "16/9", display: "block", pointerEvents: "none" }}
            initialFrame={previewFrame}
            autoPlay={hovered}
            loop
            acknowledgeRemotionLicense
          />
          <div className="vt-tpl-card__preview-overlay">
            <Play size={20} />
          </div>
          <div className="vt-tpl-card__tags">
            {template.tags.map((tag) => (
              <span key={tag} className="vt-tpl-card__tag">{tag}</span>
            ))}
            {template.builtin && <span className="vt-tpl-card__tag vt-tpl-card__tag--official">Oficial</span>}
          </div>
        </div>

        {/* Body */}
        <div className="vt-tpl-card__body">
          <div className="vt-tpl-card__name-row">
            <h3 className="vt-tpl-card__name">{template.name}</h3>
            {isUser && (
              <div className="vt-tpl-card__icon-actions">
                <IconButton label="Editar" onClick={handleOpenEditor}><Pencil size={13} /></IconButton>
                <IconButton label="Duplicar" onClick={onDuplicate}><Copy size={13} /></IconButton>
                <IconButton label="Excluir" variant="danger" onClick={onDelete}><Trash2 size={13} /></IconButton>
              </div>
            )}
            {!isUser && (
              <IconButton label="Duplicar" onClick={onDuplicate}><Copy size={13} /></IconButton>
            )}
          </div>
          <p className="vt-tpl-card__desc">{template.description}</p>

          <div className="vt-tpl-card__meta">
            <span className="vt-tpl-card__meta-item">
              <Clapperboard size={12} />
              {template.scenes.length} cenas
            </span>
            <span className="vt-tpl-card__meta-item">
              <Clock size={12} />
              ~{durationSec}s
            </span>
            <span className="vt-tpl-card__meta-item">
              {template.variables.length} variáveis
            </span>
          </div>

          <div className="vt-tpl-card__formats">
            {(["tv", "instagram", "stories", "tiktok"] as const).map((f) => (
              <span key={f} className="vt-tpl-card__format">
                {FORMAT_ICONS[f]}
                {f === "tv" ? "TV" : f === "instagram" ? "Instagram" : f === "stories" ? "Stories" : "TikTok"}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="vt-tpl-card__actions">
          <Button variant="secondary" size="sm" onClick={() => exportTemplate(template.id)}>
            <Download size={13} /> Exportar
          </Button>
          <Button variant="primary" size="sm" onClick={handleUse}>
            Usar template
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {menuProps.open && (
          <ContextMenu
            x={menuProps.x}
            y={menuProps.y}
            onClose={close}
            items={[
              { type: "item", label: "Usar template", icon: <Play size={13} />, onClick: handleUse },
              { type: "item", label: "Duplicar", icon: <Copy size={13} />, onClick: onDuplicate },
              { type: "item", label: "Exportar .json", icon: <Download size={13} />, onClick: () => exportTemplate(template.id) },
              ...(isUser ? [
                { type: "separator" as const },
                { type: "item" as const, label: "Excluir", icon: <Trash2 size={13} />, onClick: onDelete, danger: true },
              ] : []),
            ]}
          />
        )}
      </AnimatePresence>
    </>
  );
};
