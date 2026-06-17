import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Player } from "@remotion/player";
import { FolderOpen, LayoutTemplate, MoreHorizontal, Pencil, Plus, Trash2, Video } from "lucide-react";
import { Button, Dialog, IconButton, TextField, Field } from "../design-system/components";
import { useNavigationStore } from "../store/useNavigationStore";
import { useAdStore } from "../store/useAdStore";
import { useProjectsStore } from "../store/useProjectsStore";
import { useTemplateStore } from "../store/useTemplateStore";
import { useTemplateInstanceStore } from "../store/useTemplateInstanceStore";
import { toast } from "../store/useToastStore";
import { TemplateRenderer } from "../remotion/TemplateRenderer";
import { templateTotalFrames, defaultValues } from "../remotion/template-utils";
import type { Template } from "../remotion/template-types";
import type { ProjectMeta } from "../global";
import "../styles/pages/Dashboard.css";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } } as const;
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" as const } } } as const;

export const Dashboard: React.FC = () => {
  const navigate = useNavigationStore((s) => s.navigate);
  const { projects, refresh } = useProjectsStore();
  const { templates, refresh: refreshTemplates } = useTemplateStore();
  const setTemplateInstance = useTemplateInstanceStore((s) => s.setTemplate);

  useEffect(() => { refresh(); refreshTemplates(); }, [refresh, refreshTemplates]);

  // Show at most 4 builtin templates on dashboard
  const featuredTemplates = templates.filter((t) => t.builtin).slice(0, 4);

  return (
    <motion.div className="vt-dash" variants={container} initial="hidden" animate="show">
      {/* Hero */}
      <motion.section className="vt-dash__hero" variants={item}>
        <h1 className="vt-dash__greeting">
          Crie anúncios <span>profissionais</span><br />em minutos.
        </h1>
        <p className="vt-dash__subheading">
          Escolha um template, adicione seus produtos e exporte para TV ou redes sociais.
        </p>
        <div className="vt-dash__hero-actions">
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => navigate("wizard")}>
            Criar novo anúncio
          </Button>
        </div>
      </motion.section>

      {/* Stats */}
      <motion.div className="vt-dash__stats" variants={item}>
        <StatCard icon={<FolderOpen size={17} />} iconClass="primary" value={String(projects.length)} label="Projetos salvos" />
        <StatCard icon={<Video size={17} />} iconClass="success" value="0" label="Vídeos exportados" />
        <StatCard icon={<LayoutTemplate size={17} />} iconClass="warning" value={String(templates.length)} label="Templates disponíveis" />
      </motion.div>

      {/* Templates */}
      <motion.section className="vt-dash__section" variants={item}>
        <div className="vt-dash__section-header">
          <h2 className="vt-dash__section-title">Templates prontos</h2>
          <Button variant="secondary" size="sm" onClick={() => navigate("templates")}>
            Ver todos
          </Button>
        </div>
        <div className="vt-dash__templates">
          {featuredTemplates.map((tpl) => (
            <TemplateCardItem
              key={tpl.id}
              template={tpl}
              onClick={() => { setTemplateInstance(tpl); navigate("template-wizard"); }}
            />
          ))}
        </div>
      </motion.section>

      {/* Recent Projects */}
      <motion.section className="vt-dash__section" variants={item}>
        <div className="vt-dash__section-header">
          <h2 className="vt-dash__section-title">Projetos recentes</h2>
        </div>
        {projects.length === 0 ? (
          <div className="vt-dash__empty">
            <div className="vt-dash__empty-icon"><FolderOpen size={22} /></div>
            <p className="vt-dash__empty-title">Nenhum projeto ainda</p>
            <p className="vt-dash__empty-text">Seus projetos aparecem aqui após serem salvos no editor.</p>
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => navigate("wizard")}>
              Criar primeiro anúncio
            </Button>
          </div>
        ) : (
          <div className="vt-dash__projects">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onRefresh={refresh} />
            ))}
          </div>
        )}
      </motion.section>
    </motion.div>
  );
};

/* ---- Project Card ---- */

const ProjectCard: React.FC<{ project: ProjectMeta; onRefresh: () => void }> = ({ project, onRefresh }) => {
  const navigate = useNavigationStore((s) => s.navigate);
  const loadConfig = useAdStore((s) => s.loadConfig);
  const { load, remove, rename } = useProjectsStore();
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleOpen = async () => {
    const config = await load(project.id);
    if (!config) return toast.error("Projeto não encontrado.");
    loadConfig(config);
    navigate("editor");
    toast.success(`Projeto "${project.name}" aberto.`);
  };

  const handleDelete = async () => {
    await remove(project.id);
    toast.info(`Projeto "${project.name}" removido.`);
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    await rename(project.id, newName.trim());
    setRenameOpen(false);
    onRefresh();
    toast.success("Projeto renomeado.");
  };

  const date = new Date(project.updatedAt).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <>
      <div className="vt-dash__project-card" onClick={handleOpen}>
        <div className="vt-dash__project-icon">📁</div>
        <div className="vt-dash__project-info">
          <div className="vt-dash__project-name">{project.name}</div>
          <div className="vt-dash__project-date">Editado em {date}</div>
        </div>
        <div className="vt-dash__project-actions" onClick={(e) => e.stopPropagation()}>
          <div style={{ position: "relative" }}>
            <IconButton label="Opções" onClick={() => setMenuOpen((v) => !v)}>
              <MoreHorizontal size={14} />
            </IconButton>
            {menuOpen && (
              <div className="vt-dash__project-menu" onMouseLeave={() => setMenuOpen(false)}>
                <button className="vt-dash__project-menu-item" onClick={() => { setMenuOpen(false); setRenameOpen(true); }}>
                  <Pencil size={13} /> Renomear
                </button>
                <button className="vt-dash__project-menu-item vt-dash__project-menu-item--danger" onClick={() => { setMenuOpen(false); handleDelete(); }}>
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Renomear projeto"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleRename}>Salvar</Button>
          </>
        }
      >
        <Field label="Novo nome">
          <TextField value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRename()} />
        </Field>
      </Dialog>
    </>
  );
};

/* ---- Static sub-components ---- */

const StatCard: React.FC<{ icon: React.ReactNode; iconClass: "primary" | "success" | "warning"; value: string; label: string }> = ({ icon, iconClass, value, label }) => (
  <div className="vt-dash__stat-card">
    <div className={`vt-dash__stat-icon vt-dash__stat-icon--${iconClass}`}>{icon}</div>
    <div className="vt-dash__stat-value">{value}</div>
    <div className="vt-dash__stat-label">{label}</div>
  </div>
);

const TemplateCardItem: React.FC<{ template: Template; onClick: () => void }> = ({ template, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const totalFrames = templateTotalFrames(template);
  const values = defaultValues(template);
  const previewFrame = Math.min((template.scenes[0]?.durationInFrames ?? 0) + 30, Math.max(totalFrames - 1, 0));

  return (
    <motion.div
      className="vt-dash__template-card"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <div className="vt-dash__template-preview" style={{ overflow: "hidden", padding: 0, background: "#000" }}>
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
      </div>
      <div className="vt-dash__template-info">
        <div className="vt-dash__template-name">{template.name}</div>
        <div className="vt-dash__template-desc">{template.description}</div>
      </div>
    </motion.div>
  );
};
