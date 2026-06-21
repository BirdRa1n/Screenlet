"use client";

import { useEffect, useState } from "react";
import { Film, FolderOpen, Play, RefreshCw, Trash2 } from "lucide-react";
import { Button, Dialog, IconButton } from "../design-system/components";
import { PageContainer, PageHeader, EmptyState } from "../layout/PageShell";
import { assetUrl } from "@/lib/assetUrl";
import { useRendersStore } from "../store/useRendersStore";
import { toast } from "../store/useToastStore";
import type { ExportedVideo } from "../global";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const Renders: React.FC = () => {
  const { videos, loading, refresh, remove } = useRendersStore();
  const [previewVideo, setPreviewVideo] = useState<ExportedVideo | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (video: ExportedVideo) => {
    await remove(video.filename);
    toast.info(`"${video.name}" removido.`);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Vídeos renderizados"
        subtitle={
          loading
            ? "Carregando…"
            : `${videos.length} vídeo${videos.length !== 1 ? "s" : ""} na biblioteca`
        }
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<FolderOpen size={13} />} onClick={() => window.adFrame.storageOpenDir()}>
              Abrir pasta
            </Button>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={refresh}>
              Atualizar
            </Button>
          </div>
        }
      />

      {!loading && videos.length === 0 ? (
        <EmptyState
          icon={<Film size={22} />}
          title="Nenhum vídeo renderizado"
          text='Clique em "Renderizar" em qualquer projeto para gerar seu primeiro vídeo.'
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {videos.map((v) => (
            <div
              key={v.filename}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Film size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium" title={v.name}>
                  {v.name}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{formatBytes(v.size)}</span>
                  <span className="size-1 rounded-full bg-muted-foreground/50" />
                  <span>{formatDate(v.createdAt)}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <IconButton label="Reproduzir" onClick={() => setPreviewVideo(v)}>
                  <Play size={14} />
                </IconButton>
                <IconButton label="Revelar no Finder" onClick={() => window.adFrame.exportsReveal(v.filename)}>
                  <FolderOpen size={14} />
                </IconButton>
                <IconButton label="Excluir" variant="danger" onClick={() => handleDelete(v)}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!previewVideo}
        onClose={() => setPreviewVideo(null)}
        size="lg"
        title={previewVideo?.name ?? ""}
      >
        {previewVideo && (
          // Relative path — resolves against the app:// page base, same as
          // Studio's preview tab and asset.filename for uploads.
          <video
            className="w-full rounded-lg bg-black"
            src={assetUrl(`exports/${previewVideo.filename}`)}
            controls
            autoPlay
          />
        )}
      </Dialog>
    </PageContainer>
  );
};
