"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Clapperboard, Copy, Download, Play, Plus, Trash2, Upload, Pencil } from "lucide-react";
import { Button, IconButton } from "../design-system/components";
import { ContextMenu, useContextMenu } from "../design-system/components/ContextMenu";
import { PageContainer, PageHeader } from "../layout/PageShell";
import { cn } from "@/lib/utils";
import { RemotionPlayer } from "../components/RemotionPlayer";
import { TemplateRenderer } from "../remotion/TemplateRenderer";
import { templateTotalFrames, defaultValues } from "../remotion/template-utils";
import { useTemplateStore } from "../store/useTemplateStore";
import { useTemplateInstanceStore } from "../store/useTemplateInstanceStore";
import { toast } from "../store/useToastStore";
import { formatIcon, type ExportFormatId } from "../lib/exportFormats";
import type { Template } from "../remotion/template-types";

const ALL_TAGS = ["Geral", "Varejo", "Açougue", "Sazonal"];

export const Templates: React.FC = () => {
  const { templates, refresh, duplicate, remove, importTemplate } = useTemplateStore();
  const router = useRouter();
  const [activeTag, setActiveTag] = useState<string>("Todos");

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered =
    activeTag === "Todos" ? templates : templates.filter((t) => t.tags.includes(activeTag));

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
    <PageContainer>
      <PageHeader
        title="Templates"
        subtitle={`${templates.length} template${templates.length !== 1 ? "s" : ""} disponíve${
          templates.length !== 1 ? "is" : "l"
        }. Todos são personalizáveis.`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Upload size={14} />} onClick={handleImport}>
              Importar
            </Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => router.push("/templates/builder")}>
              Novo template
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {["Todos", ...ALL_TAGS].map((tag) => (
          <button
            key={tag}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              activeTag === tag
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            onDuplicate={() => {
              duplicate(tpl.id);
              toast.success(`"${tpl.name}" duplicado.`);
            }}
            onDelete={() => {
              remove(tpl.id);
              toast.info(`"${tpl.name}" removido.`);
            }}
          />
        ))}
      </div>
    </PageContainer>
  );
};

const TemplateCard: React.FC<{
  template: Template;
  onDuplicate: () => void;
  onDelete: () => void;
}> = ({ template, onDuplicate, onDelete }) => {
  const router = useRouter();
  const setTemplateInstance = useTemplateInstanceStore((s) => s.setTemplate);
  const { exportTemplate } = useTemplateStore();
  const { menuProps, handleContextMenu, close } = useContextMenu();
  const [hovered, setHovered] = useState(false);

  const totalFrames = templateTotalFrames(template);
  const values = defaultValues(template);
  const firstSceneDuration = template.scenes[0]?.durationInFrames ?? 0;
  const previewFrame = Math.min(firstSceneDuration + 30, Math.max(totalFrames - 1, 0));

  const handleOpenEditor = () => router.push(`/templates/builder?id=${template.id}`);
  const handleUse = () => {
    setTemplateInstance(template);
    router.push("/templates/wizard");
  };

  const durationSec = Math.round(totalFrames / template.fps);
  const isUser = !template.builtin;

  return (
    <>
      <div
        className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={handleContextMenu}
      >
        {/* Preview */}
        <div className="relative aspect-video overflow-hidden bg-black">
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
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {template.tags.map((tag) => (
              <span key={tag} className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {tag}
              </span>
            ))}
            {template.builtin && (
              <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                Oficial
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold">{template.name}</h3>
            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {isUser && (
                <IconButton label="Editar" onClick={handleOpenEditor}>
                  <Pencil size={13} />
                </IconButton>
              )}
              <IconButton label="Duplicar" onClick={onDuplicate}>
                <Copy size={13} />
              </IconButton>
              {isUser && (
                <IconButton label="Excluir" variant="danger" onClick={onDelete}>
                  <Trash2 size={13} />
                </IconButton>
              )}
            </div>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{template.description}</p>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clapperboard size={12} />
              {template.scenes.length} cenas
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />~{durationSec}s
            </span>
            <span>{template.variables.length} variáveis</span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {(["tv", "instagram", "stories", "tiktok"] as const satisfies readonly ExportFormatId[]).map((f) => (
              <span key={f} className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {formatIcon(f, 12)}
                {f === "tv" ? "TV" : f === "instagram" ? "Instagram" : f === "stories" ? "Stories" : "TikTok"}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-border p-3">
          <Button variant="secondary" size="sm" className="flex-1" icon={<Download size={13} />} onClick={() => exportTemplate(template.id)}>
            Exportar
          </Button>
          <Button variant="primary" size="sm" className="flex-1" onClick={handleUse}>
            Usar template
          </Button>
        </div>
      </div>

      {menuProps.open && (
        <ContextMenu
          x={menuProps.x}
          y={menuProps.y}
          onClose={close}
          items={[
            { type: "item", label: "Usar template", icon: <Play size={13} />, onClick: handleUse },
            { type: "item", label: "Duplicar", icon: <Copy size={13} />, onClick: onDuplicate },
            { type: "item", label: "Exportar .json", icon: <Download size={13} />, onClick: () => exportTemplate(template.id) },
            ...(isUser
              ? [
                  { type: "separator" as const },
                  { type: "item" as const, label: "Excluir", icon: <Trash2 size={13} />, onClick: onDelete, danger: true },
                ]
              : []),
          ]}
        />
      )}
    </>
  );
};
