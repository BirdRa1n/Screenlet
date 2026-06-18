import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Image, Search, Trash2, Video } from "lucide-react";
import { Button, IconButton } from "../design-system/components";
import { useMediaStore } from "../store/useMediaStore";
import { toast } from "../store/useToastStore";
import type { MediaAsset } from "../types/media";
import "../styles/pages/MediaHub.css";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MediaHub: React.FC = () => {
  const { assets, loading, refresh, importAsset, removeAsset } = useMediaStore();
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [search, setSearch] = useState("");

  useEffect(() => { refresh(); }, [refresh]);

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
    <div className="vt-mediahub">
      <div className="vt-mediahub__header">
        <div>
          <h1 className="vt-mediahub__title">Media Hub</h1>
          <p className="vt-mediahub__sub">Gerencie imagens e vídeos importados.</p>
        </div>
        <div className="vt-mediahub__header-actions">
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
            icon={<Image size={14} />}
            onClick={async () => {
              const asset = await importAsset("image");
              if (asset) toast.success(`"${asset.originalName}" importado.`);
            }}
          >
            Importar imagem
          </Button>
        </div>
      </div>

      <div className="vt-mediahub__stats">
        <div className="vt-mediahub__stat">
          <span className="vt-mediahub__stat-val">{imageCount}</span>
          <span className="vt-mediahub__stat-label">Imagens</span>
        </div>
        <div className="vt-mediahub__stat">
          <span className="vt-mediahub__stat-val">{videoCount}</span>
          <span className="vt-mediahub__stat-label">Vídeos</span>
        </div>
        <div className="vt-mediahub__stat">
          <span className="vt-mediahub__stat-val">{formatBytes(totalSize)}</span>
          <span className="vt-mediahub__stat-label">Total</span>
        </div>
      </div>

      <div className="vt-mediahub__toolbar">
        <div className="vt-mediahub__filters">
          {(["all", "image", "video"] as const).map((f) => (
            <button
              key={f}
              className={`vt-mediahub__filter${filter === f ? " vt-mediahub__filter--active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Todos" : f === "image" ? "Imagens" : "Vídeos"}
            </button>
          ))}
        </div>
        <div className="vt-mediahub__search-wrap">
          <Search size={14} className="vt-mediahub__search-icon" />
          <input
            className="vt-mediahub__search"
            placeholder="Buscar arquivo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="vt-mediahub__empty">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="vt-mediahub__empty">
          <div className="vt-mediahub__empty-icon">
            {filter === "video" ? <Video size={24} /> : <Image size={24} />}
          </div>
          <p className="vt-mediahub__empty-title">
            {assets.length === 0 ? "Nenhuma mídia importada" : "Nenhum resultado"}
          </p>
          {assets.length === 0 && (
            <p className="vt-mediahub__empty-text">
              Importe imagens e vídeos para usá-los nos seus anúncios.
            </p>
          )}
        </div>
      ) : (
        <div className="vt-mediahub__grid">
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
    </div>
  );
};

const MediaCard: React.FC<{
  asset: MediaAsset;
  onDelete: () => void;
}> = ({ asset, onDelete }) => (
  <motion.div
    className="vt-mediahub__card"
    whileHover={{ y: -2 }}
    transition={{ duration: 0.15 }}
  >
    <div className="vt-mediahub__card-thumb">
      {asset.type === "image" ? (
        <img src={asset.filename} alt={asset.originalName} />
      ) : (
        <div className="vt-mediahub__card-video-icon">
          <Video size={28} />
        </div>
      )}
      <span className={`vt-mediahub__card-badge vt-mediahub__card-badge--${asset.type}`}>
        {asset.type === "image" ? "IMG" : "VID"}
      </span>
    </div>
    <div className="vt-mediahub__card-body">
      <div className="vt-mediahub__card-name" title={asset.originalName}>
        {asset.originalName}
      </div>
      <div className="vt-mediahub__card-meta">{formatBytes(asset.size)}</div>
    </div>
    <div className="vt-mediahub__card-actions">
      <IconButton label="Remover do catálogo" variant="danger" onClick={onDelete}>
        <Trash2 size={13} />
      </IconButton>
    </div>
  </motion.div>
);
