"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  HardDrive,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { Button, Dialog, Field, TextField } from "../design-system/components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdStore } from "../store/useAdStore";
import { useProjectsStore } from "../store/useProjectsStore";
import { useTemplateStore } from "../store/useTemplateStore";
import { useTemplateInstanceStore } from "../store/useTemplateInstanceStore";
import { useMediaStore } from "../store/useMediaStore";
import { useRendersStore } from "../store/useRendersStore";
import { toast } from "../store/useToastStore";
import { RemotionPlayer } from "../components/RemotionPlayer";
import { TemplateRenderer } from "../remotion/TemplateRenderer";
import { templateTotalFrames, defaultValues } from "../remotion/template-utils";
import type { Template } from "../remotion/template-types";
import type { ProjectMeta } from "../global";

export const Dashboard: React.FC = () => {
  const router = useRouter();
  const { projects, refresh } = useProjectsStore();
  const { templates, refresh: refreshTemplates } = useTemplateStore();
  const setTemplateInstance = useTemplateInstanceStore((s) => s.setTemplate);
  const { assets, refresh: refreshMedia } = useMediaStore();
  const { videos, refresh: refreshRenders } = useRendersStore();

  useEffect(() => {
    refresh();
    refreshTemplates();
    refreshMedia();
    refreshRenders();
  }, [refresh, refreshTemplates, refreshMedia, refreshRenders]);

  const featuredTemplates = templates.filter((t) => t.builtin).slice(0, 4);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-8 py-10">
      {/* Hero */}
      <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-10">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
          Crie anúncios <span className="text-primary">profissionais</span>
          <br />
          em minutos.
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Escolha um template, adicione seus produtos e exporte para TV ou redes
          sociais.
        </p>
        <Button
          variant="primary"
          icon={<Plus size={15} />}
          onClick={() => router.push("/wizard")}
        >
          Criar novo anúncio
        </Button>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<FolderOpen size={18} />} tone="primary" value={projects.length} label="Projetos salvos" />
        <StatCard icon={<Video size={18} />} tone="success" value={videos.length} label="Vídeos exportados" />
        <StatCard icon={<LayoutTemplate size={18} />} tone="warning" value={templates.length} label="Templates disponíveis" />
        <StatCard icon={<HardDrive size={18} />} tone="info" value={assets.length} label="Mídias no catálogo" />
      </div>

      {/* Templates */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Templates prontos</h2>
          <Button variant="secondary" size="sm" onClick={() => router.push("/templates")}>
            Ver todos
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredTemplates.map((tpl) => (
            <TemplateCardItem
              key={tpl.id}
              template={tpl}
              onClick={() => {
                setTemplateInstance(tpl);
                router.push("/templates/wizard");
              }}
            />
          ))}
        </div>
      </section>

      {/* Recent Projects */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Projetos recentes</h2>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FolderOpen size={22} />
            </div>
            <div>
              <p className="font-medium">Nenhum projeto ainda</p>
              <p className="text-sm text-muted-foreground">
                Seus projetos aparecem aqui após serem salvos no editor.
              </p>
            </div>
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => router.push("/wizard")}>
              Criar primeiro anúncio
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onRefresh={refresh} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

/* ---- Project Card ---- */

const ProjectCard: React.FC<{ project: ProjectMeta; onRefresh: () => void }> = ({
  project,
  onRefresh,
}) => {
  const router = useRouter();
  const loadConfig = useAdStore((s) => s.loadConfig);
  const { load, remove, rename } = useProjectsStore();
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(project.name);

  const handleOpen = async () => {
    const config = await load(project.id);
    if (!config) return toast.error("Projeto não encontrado.");
    loadConfig(config);
    router.push("/editor");
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
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <div
        className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
        onClick={handleOpen}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
          📁
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{project.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            Editado em {date}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Opções"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Pencil size={14} /> Renomear
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                <Trash2 size={14} /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

/* ---- Sub-components ---- */

const TONE_MAP = {
  primary: "bg-primary/15 text-primary",
  success: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  warning: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
  info: "bg-chart-5/15 text-chart-5",
} as const;

const StatCard: React.FC<{
  icon: React.ReactNode;
  tone: keyof typeof TONE_MAP;
  value: number;
  label: string;
}> = ({ icon, tone, value, label }) => (
  <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
    <div className={`flex size-10 items-center justify-center rounded-lg ${TONE_MAP[tone]}`}>
      {icon}
    </div>
    <div className="text-2xl font-bold tabular-nums">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

const TemplateCardItem: React.FC<{ template: Template; onClick: () => void }> = ({
  template,
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);
  const totalFrames = templateTotalFrames(template);
  const values = defaultValues(template);
  const previewFrame = Math.min(
    (template.scenes[0]?.durationInFrames ?? 0) + 30,
    Math.max(totalFrames - 1, 0),
  );

  return (
    <button
      type="button"
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-md"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="aspect-video w-full overflow-hidden bg-black">
        <RemotionPlayer
          component={TemplateRenderer}
          inputProps={{ template, values }}
          durationInFrames={Math.max(totalFrames, 1)}
          fps={template.fps}
          compositionWidth={template.width}
          compositionHeight={template.height}
          style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
          initialFrame={previewFrame}
          autoPlay={hovered}
          loop
          acknowledgeRemotionLicense
        />
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="truncate text-sm font-semibold">{template.name}</div>
        <div className="line-clamp-2 text-xs text-muted-foreground">
          {template.description}
        </div>
      </div>
    </button>
  );
};
