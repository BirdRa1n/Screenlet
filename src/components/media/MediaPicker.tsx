"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Plus, Search, Upload, Video } from "lucide-react";
import { Button, Dialog } from "../../design-system/components";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assetUrl";
import { useMediaStore } from "../../store/useMediaStore";
import type { MediaAsset, MediaAssetType } from "../../types/media";

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
    <>
      <button
        className="group relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30 transition-colors hover:border-primary/60"
        style={{ height }}
        onClick={() => setOpen(true)}
        type="button"
      >
        {value ? (
          accept === "video" ? (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Video size={20} />
              <span className="max-w-[90%] truncate text-xs">{value.split("/").pop()}</span>
            </div>
          ) : (
            <img src={assetUrl(value)} alt="" className="size-full object-contain p-1" />
          )
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            {accept === "video" ? <Video size={20} /> : <ImageIcon size={20} />}
            <span className="text-xs">Clique para selecionar</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          Alterar
        </div>
      </button>

      <MediaPickerDialog
        open={open}
        accept={accept}
        currentValue={value}
        onSelect={(path) => {
          onChange(path);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
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
    if (open) {
      setSearch("");
      refresh();
    }
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
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              placeholder="Buscar arquivo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={handleImport} disabled={importing}>
            {importing ? "Importando…" : "Importar arquivo"}
          </Button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {assets.filter((a) => accept === "any" || a.type === accept).length === 0
                ? "Nenhuma mídia importada ainda."
                : "Nenhum resultado encontrado."}
            </p>
            <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={handleImport} disabled={importing}>
              Importar arquivo
            </Button>
          </div>
        ) : (
          <div className="grid max-h-[55vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4 lg:grid-cols-5">
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
    className={cn(
      "flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-primary/50",
      selected ? "border-primary ring-1 ring-primary" : "border-border",
    )}
    onClick={onSelect}
    type="button"
  >
    <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
      {asset.type === "image" ? (
        <img src={assetUrl(asset.filename)} alt={asset.originalName} className="size-full object-cover" />
      ) : (
        <Video size={18} className="text-muted-foreground" />
      )}
    </div>
    <div className="truncate p-1.5 text-[11px]" title={asset.originalName}>
      {asset.originalName}
    </div>
  </button>
);
