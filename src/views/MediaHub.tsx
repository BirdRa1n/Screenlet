"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Play, Search, Trash2, Video } from "lucide-react";
import { Button, IconButton } from "../design-system/components";
import { PageContainer, PageHeader, EmptyState } from "../layout/PageShell";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assetUrl";
import { useMediaStore } from "../store/useMediaStore";
import { toast } from "../store/useToastStore";
import type { MediaAsset } from "../types/media";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MediaHub: React.FC = () => {
  const { assets, loading, refresh, importAsset, removeAsset } = useMediaStore();
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? assets : assets.filter((a) => a.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.originalName.toLowerCase().includes(q));
    }
    return list;
  }, [assets, filter, search]);

  const imageCount = assets.filter((a) => a.type === "image").length;
  const videoCount = assets.filter((a) => a.type === "video").length;
  const totalSize = assets.reduce((sum, a) => sum + a.size, 0);

  return (
    <PageContainer>
      <PageHeader
        title="Media Hub"
        subtitle="Gerencie imagens e vídeos importados."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={<Video size={14} />}
              onClick={async () => {
                const asset = await importAsset("video");
                if (asset) toast.success(`"${asset.originalName}" importado.`);
              }}
            >
              Importar vídeo
            </Button>
            <Button
              variant="primary"
              icon={<ImageIcon size={14} />}
              onClick={async () => {
                const asset = await importAsset("image");
                if (asset) toast.success(`"${asset.originalName}" importado.`);
              }}
            >
              Importar imagem
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <Stat value={String(imageCount)} label="Imagens" />
        <Stat value={String(videoCount)} label="Vídeos" />
        <Stat value={formatBytes(totalSize)} label="Total" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {(["all", "image", "video"] as const).map((f) => (
            <button
              key={f}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Todos" : f === "image" ? "Imagens" : "Vídeos"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-64 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            placeholder="Buscar arquivo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <EmptyState icon={<ImageIcon size={22} />} title="Carregando…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={filter === "video" ? <Video size={22} /> : <ImageIcon size={22} />}
          title={assets.length === 0 ? "Nenhuma mídia importada" : "Nenhum resultado"}
          text={assets.length === 0 ? "Importe imagens e vídeos para usá-los nos seus anúncios." : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {filtered.map((asset) => (
            <MediaCard
              key={asset.id}
              asset={asset}
              onDelete={async () => {
                await removeAsset(asset.id);
                toast.info(`"${asset.originalName}" removido do catálogo.`);
              }}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// Generates a thumbnail from the video's own frame, client-side — avoids needing
// ffmpeg or a backend thumbnail cache for a one-off canvas capture.
const VideoThumbnail: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    setThumb(null);
    const video = document.createElement("video");
    video.src = src;
    video.muted = true;
    video.preload = "metadata";

    const capture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx || !canvas.width || !canvas.height) return;
      ctx.drawImage(video, 0, 0);
      setThumb(canvas.toDataURL("image/jpeg", 0.7));
    };

    const onLoadedData = () => {
      try {
        video.currentTime = Math.min(1, (video.duration || 2) / 2);
      } catch {
        capture();
      }
    };
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("seeked", capture);

    return () => {
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("seeked", capture);
      video.src = "";
    };
  }, [src]);

  return (
    <div className="relative flex size-full items-center justify-center">
      {thumb ? (
        <img src={thumb} alt={alt} className="size-full object-cover" />
      ) : (
        <Video size={28} className="text-muted-foreground" />
      )}
      <Play size={16} className="absolute bottom-2 right-2 rounded-full bg-black/60 p-0.5 text-white" />
    </div>
  );
};

const MediaCard: React.FC<{ asset: MediaAsset; onDelete: () => void }> = ({ asset, onDelete }) => (
  <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
    <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted">
      {asset.type === "image" ? (
        <img src={assetUrl(asset.filename)} alt={asset.originalName} className="size-full object-cover" />
      ) : (
        <VideoThumbnail src={assetUrl(asset.filename)} alt={asset.originalName} />
      )}
      <span
        className={cn(
          "absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white",
          asset.type === "image" ? "bg-chart-5" : "bg-primary",
        )}
      >
        {asset.type === "image" ? "IMG" : "VID"}
      </span>
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <IconButton label="Remover do catálogo" variant="danger" onClick={onDelete} className="bg-card/80 backdrop-blur">
          <Trash2 size={13} />
        </IconButton>
      </div>
    </div>
    <div className="flex flex-col gap-0.5 p-2.5">
      <div className="truncate text-xs font-medium" title={asset.originalName}>
        {asset.originalName}
      </div>
      <div className="text-[11px] text-muted-foreground">{formatBytes(asset.size)}</div>
    </div>
  </div>
);
