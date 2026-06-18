import React, { useEffect, useMemo, useState } from "react";
import { Image, Plus, Search, Upload, Video } from "lucide-react";
import { Button, Dialog } from "../../design-system/components";
import { useMediaStore } from "../../store/useMediaStore";
import type { MediaAsset, MediaAssetType } from "../../types/media";
import "../../styles/components/MediaPicker.css";

type Props = {
  value: string;
  onChange: (path: string) => void;
  accept?: MediaAssetType | "any";
  height?: number;
};

export const MediaPicker: React.FC<Props> = ({
  value,
  onChange,
  accept = "image",
  height = 120,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="vt-mpick">
      <button
        className="vt-mpick__preview"
        style={{ height }}
        onClick={() => setOpen(true)}
        type="button"
      >
        {value ? (
          accept === "video" ? (
            <div className="vt-mpick__video-thumb">
              <Video size={20} />
              <span className="vt-mpick__video-name">{value.split("/").pop()}</span>
            </div>
          ) : (
            <img src={value} alt="" className="vt-mpick__img" />
          )
        ) : (
          <div className="vt-mpick__empty">
            {accept === "video" ? <Video size={20} /> : <Image size={20} />}
            <span>Clique para selecionar</span>
          </div>
        )}
        <div className="vt-mpick__overlay">
          <span>Alterar</span>
        </div>
      </button>

      <MediaPickerDialog
        open={open}
        accept={accept}
        currentValue={value}
        onSelect={(path) => { onChange(path); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
};

export const MediaPickerDialog: React.FC<{
  open: boolean;
  accept: MediaAssetType | "any";
  currentValue: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}> = ({ open, accept, currentValue, onSelect, onClose }) => {
  const { assets, loading, refresh, importAsset } = useMediaStore();
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (open) { setSearch(""); refresh(); }
  }, [open, refresh]);

  const filtered = useMemo(() => {
    let list = accept === "any" ? assets : assets.filter((a) => a.type === accept);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.originalName.toLowerCase().includes(q));
    }
    return list;
  }, [assets, accept, search]);

  const handleImport = async () => {
    setImporting(true);
    const type = accept === "any" ? "image" : accept;
    const asset = await importAsset(type);
    setImporting(false);
    if (asset) onSelect(asset.filename);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={accept === "video" ? "Selecionar vídeo" : "Selecionar imagem"}
      size="xl"
    >
      <div className="vt-mpick-dialog">
        <div className="vt-mpick-dialog__toolbar">
          <div className="vt-mpick-dialog__search-wrap">
            <Search size={14} className="vt-mpick-dialog__search-icon" />
            <input
              className="vt-mpick-dialog__search"
              placeholder="Buscar arquivo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={13} />}
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? "Importando…" : "Importar arquivo"}
          </Button>
        </div>

        {loading ? (
          <div className="vt-mpick-dialog__empty">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="vt-mpick-dialog__empty">
            <p>{assets.filter((a) => accept === "any" || a.type === accept).length === 0
              ? "Nenhuma mídia importada ainda."
              : "Nenhum resultado encontrado."}</p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={handleImport}
              disabled={importing}
            >
              Importar arquivo
            </Button>
          </div>
        ) : (
          <div className="vt-mpick-dialog__grid">
            {filtered.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={asset.filename === currentValue}
                onSelect={() => onSelect(asset.filename)}
              />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
};

const AssetCard: React.FC<{
  asset: MediaAsset;
  selected: boolean;
  onSelect: () => void;
}> = ({ asset, selected, onSelect }) => (
  <button
    className={`vt-mpick-card${selected ? " vt-mpick-card--selected" : ""}`}
    onClick={onSelect}
    type="button"
  >
    <div className="vt-mpick-card__thumb">
      {asset.type === "image" ? (
        <img src={asset.filename} alt={asset.originalName} />
      ) : (
        <div className="vt-mpick-card__video-icon">
          <Video size={18} />
        </div>
      )}
    </div>
    <div className="vt-mpick-card__name" title={asset.originalName}>
      {asset.originalName}
    </div>
  </button>
);
