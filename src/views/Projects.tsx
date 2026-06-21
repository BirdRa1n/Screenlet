"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Dialog, Field, IconButton, TextField } from "../design-system/components";
import { PageContainer, PageHeader, EmptyState } from "../layout/PageShell";
import { assetUrl } from "@/lib/assetUrl";
import { useAdStore } from "../store/useAdStore";
import { useProjectsStore } from "../store/useProjectsStore";
import { toast } from "../store/useToastStore";
import type { ProjectMeta } from "../global";

export const Projects: React.FC = () => {
  const router = useRouter();
  const { projects, refresh } = useProjectsStore();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PageContainer>
      <PageHeader
        title="Projetos"
        subtitle="Todos os seus anúncios salvos."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => router.push("/wizard")}>
            Novo anúncio
          </Button>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={22} />}
          title="Nenhum projeto salvo"
          text="Crie um anúncio e salve pelo editor para que ele apareça aqui."
          action={
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => router.push("/wizard")}>
              Criar anúncio
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onRefresh={refresh} />
          ))}
        </div>
      )}
    </PageContainer>
  );
};

const ProjectCard: React.FC<{ project: ProjectMeta; onRefresh: () => void }> = ({
  project,
  onRefresh,
}) => {
  const router = useRouter();
  const loadConfig = useAdStore((s) => s.loadConfig);
  const setCurrentProjectName = useAdStore((s) => s.setCurrentProjectName);
  const { load, remove, rename } = useProjectsStore();
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(project.name);

  const handleOpen = async () => {
    const config = await load(project.id);
    if (!config) return toast.error("Projeto não encontrado.");
    loadConfig(config);
    setCurrentProjectName(project.name);
    router.push("/editor");
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
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <div
        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        onClick={handleOpen}
      >
        <div className="flex aspect-video items-center justify-center overflow-hidden bg-muted">
          {project.thumbnail ? (
            <img src={assetUrl(project.thumbnail)} alt="" className="size-full object-cover" />
          ) : (
            <FolderOpen size={24} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-0.5 p-3">
          <div className="truncate text-sm font-medium">{project.name}</div>
          <div className="truncate text-xs text-muted-foreground">Editado em {date}</div>
        </div>

        <div
          className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton label="Renomear" onClick={() => setRenameOpen(true)} className="bg-card/80 backdrop-blur">
            <Pencil size={13} />
          </IconButton>
          <IconButton label="Excluir" variant="danger" onClick={handleDelete} className="bg-card/80 backdrop-blur">
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>

      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Renomear projeto"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleRename}>
              Salvar
            </Button>
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
