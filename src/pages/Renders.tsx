import React, { useEffect, useState } from "react";
import { Film, FolderOpen, Play, RefreshCw, Trash2 } from "lucide-react";
import { Button, Dialog, IconButton } from "../design-system/components";
import { useRendersStore } from "../store/useRendersStore";
import { toast } from "../store/useToastStore";
import type { ExportedVideo } from "../global";
import "../styles/pages/Renders.css";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export const Renders: React.FC = () => {
  const { videos, loading, refresh, remove } = useRendersStore();
  const [previewVideo, setPreviewVideo] = useState<ExportedVideo | null>(null);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (video: ExportedVideo) => {
    await remove(video.filename);
    toast.info(`"${video.name}" removido.`);
  };

  const handleReveal = (video: ExportedVideo) => {
    window.adFrame.exportsReveal(video.filename);
  };

  return (
    <div className="vt-renders">
      <div className="vt-renders__header">
        <div>
          <h1 className="vt-renders__title">Vídeos renderizados</h1>
          <p className="vt-renders__sub">
            {loading ? "Carregando…" : `${videos.length} vídeo${videos.length !== 1 ? "s" : ""} na biblioteca`}
          </p>
        </div>
        <div className="vt-renders__header-actions">
          <Button variant="secondary" size="sm" icon={<FolderOpen size={13} />} onClick={() => window.adFrame.storageOpenDir()}>
            Abrir pasta
          </Button>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={refresh}>
            Atualizar
          </Button>
        </div>
      </div>

      {!loading && videos.length === 0 ? (
        <div className="vt-renders__empty">
          <div className="vt-renders__empty-icon"><Film size={22} /></div>
          <p className="vt-renders__empty-title">Nenhum vídeo renderizado</p>
          <p className="vt-renders__empty-text">
            Clique em "Renderizar" em qualquer projeto para gerar seu primeiro vídeo.
          </p>
        </div>
      ) : (
        <div className="vt-renders__grid">
          {videos.map((v) => (
            <div key={v.filename} className="vt-renders__card">
              <div className="vt-renders__card-icon">
                <Film size={22} />
              </div>
              <div className="vt-renders__card-info">
                <div className="vt-renders__card-name" title={v.name}>{v.name}</div>
                <div className="vt-renders__card-meta">
                  <span>{formatBytes(v.size)}</span>
                  <span className="vt-renders__card-dot" />
                  <span>{formatDate(v.createdAt)}</span>
                </div>
              </div>
              <div className="vt-renders__card-actions">
                <IconButton label="Reproduzir" onClick={() => setPreviewVideo(v)}>
                  <Play size={13} />
                </IconButton>
                <IconButton label="Revelar no Finder" onClick={() => handleReveal(v)}>
                  <FolderOpen size={13} />
                </IconButton>
                <IconButton label="Excluir" variant="danger" onClick={() => handleDelete(v)}>
                  <Trash2 size={13} />
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
            className="vt-renders__preview-video"
            src={`exports/${previewVideo.filename}`}
            controls
            autoPlay
          />
        )}
      </Dialog>
    </div>
  );
};
