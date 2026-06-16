import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Dialog, Field, IconButton, TextField } from "../design-system/components";
import { useNavigationStore } from "../store/useNavigationStore";
import { useAdStore } from "../store/useAdStore";
import { useProjectsStore } from "../store/useProjectsStore";
import { toast } from "../store/useToastStore";
import type { ProjectMeta } from "../global";
import "../styles/pages/Projects.css";

export const Projects: React.FC = () => {
  const navigate = useNavigationStore((s) => s.navigate);
  const { projects, refresh } = useProjectsStore();

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="vt-projects">
      <div className="vt-projects__header">
        <div>
          <h1 className="vt-projects__title">Projetos</h1>
          <p className="vt-projects__sub">Todos os seus anúncios salvos.</p>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => navigate("wizard")}>
          Novo anúncio
        </Button>
      </div>

      <div className="vt-projects__grid">
        {projects.length === 0 ? (
          <div className="vt-projects__empty">
            <div className="vt-projects__empty-icon"><FolderOpen size={22} /></div>
            <p className="vt-projects__empty-title">Nenhum projeto salvo</p>
            <p className="vt-projects__empty-text">
              Crie um anúncio e salve pelo editor para que ele apareça aqui.
            </p>
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => navigate("wizard")}>
              Criar anúncio
            </Button>
          </div>
        ) : (
          projects.map((p) => (
            <ProjectCard key={p.id} project={p} onRefresh={refresh} />
          ))
        )}
      </div>
    </div>
  );
};

const ProjectCard: React.FC<{ project: ProjectMeta; onRefresh: () => void }> = ({ project, onRefresh }) => {
  const navigate = useNavigationStore((s) => s.navigate);
  const loadConfig = useAdStore((s) => s.loadConfig);
  const { load, remove, rename } = useProjectsStore();
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(project.name);

  const handleOpen = async () => {
    const config = await load(project.id);
    if (!config) return toast.error("Projeto não encontrado.");
    loadConfig(config);
    navigate("editor");
    toast.success(`"${project.name}" aberto no editor.`);
  };

  const handleDelete = async () => {
    await remove(project.id);
    toast.info(`"${project.name}" removido.`);
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
      <motion.div
        className="vt-projects__card"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        onClick={handleOpen}
      >
        <div className="vt-projects__card-icon">📁</div>
        <div className="vt-projects__card-name">{project.name}</div>
        <div className="vt-projects__card-date">Editado em {date}</div>

        <div
          className="vt-projects__card-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton label="Renomear" onClick={() => setRenameOpen(true)}>
            <Pencil size={13} />
          </IconButton>
          <IconButton label="Excluir" variant="danger" onClick={handleDelete}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      </motion.div>

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
          <TextField
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
        </Field>
      </Dialog>
    </>
  );
};
