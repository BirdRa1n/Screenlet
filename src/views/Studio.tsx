"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CalendarClock, ChevronLeft, Film, List, Pause, Play, PlayCircle, Plus, X } from "lucide-react";
import { Button, Checkbox, IconButton } from "../design-system/components";
import { ProgrammingTimeline } from "../components/programming/ProgrammingTimeline";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assetUrl";
import { useRendersStore } from "../store/useRendersStore";
import type { ExportedVideo } from "../global";
import type { Channel, PlaylistItem, TransitionType } from "../types/channel";
import type { ProgrammingRule } from "../types/programming";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Tab = "playlist" | "preview" | "schedule";

type Props = {
  channel: Channel;
  onClose: () => void;
  onSave: (updated: Channel) => Promise<void>;
};

const drag = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

export const Studio: React.FC<Props> = ({ channel, onClose, onSave }) => {
  const { videos, refresh: refreshVideos } = useRendersStore();
  const [playlist, setPlaylist] = useState<PlaylistItem[]>(channel.playlist ?? []);
  const [loop, setLoop] = useState(channel.loop ?? false);
  const [rules, setRules] = useState<ProgrammingRule[]>(channel.rules ?? []);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("playlist");

  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(true);

  useEffect(() => {
    refreshVideos();
  }, [refreshVideos]);

  useEffect(() => {
    if (tab === "preview") {
      setPreviewIndex(0);
      setPreviewPlaying(true);
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== "preview") return;
    if (previewPlaying) videoRef.current?.play().catch(() => {});
    else videoRef.current?.pause();
  }, [tab, previewIndex, previewPlaying]);

  const previewItem = playlist[previewIndex];

  const handlePreviewEnded = () => {
    setPreviewIndex((idx) => {
      const next = idx + 1;
      if (next < playlist.length) return next;
      if (loop) return 0;
      setPreviewPlaying(false);
      return idx;
    });
  };

  const jumpToPreviewItem = (idx: number) => {
    setPreviewIndex(idx);
    setPreviewPlaying(true);
  };

  const addVideo = (video: ExportedVideo) => {
    setPlaylist((prev) => [
      ...prev,
      { id: crypto.randomUUID(), filename: video.filename, name: video.name, transition: "cut" },
    ]);
  };

  const removeItem = (id: string) => setPlaylist((prev) => prev.filter((i) => i.id !== id));

  const moveItem = (id: string, dir: -1 | 1) => {
    setPlaylist((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const setTransition = (id: string, transition: TransitionType) => {
    setPlaylist((prev) => prev.map((i) => (i.id === id ? { ...i, transition } : i)));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...channel, playlist, loop, rules, updatedAt: new Date().toISOString() });
    setSaving(false);
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "playlist", label: "Playlist", icon: <List size={13} /> },
    { id: "preview", label: "Pré-visualizar", icon: <PlayCircle size={13} /> },
    { id: "schedule", label: "Horários", icon: <CalendarClock size={13} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4 pl-20" style={drag}>
        <button
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={onClose}
          style={noDrag}
        >
          <ChevronLeft size={16} />
          Canais
        </button>
        <h1 className="truncate text-sm font-semibold">Studio — {channel.name}</h1>

        <div className="ml-auto flex gap-1 rounded-lg border border-border bg-card p-1" style={noDrag}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <IconButton label="Fechar" onClick={onClose} style={noDrag}>
          <X size={16} />
        </IconButton>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "playlist" && (
          <div className="grid h-full grid-cols-1 gap-px overflow-hidden bg-border lg:grid-cols-[340px_1fr]">
            {/* Library */}
            <aside className="flex flex-col gap-2 overflow-y-auto bg-background p-4">
              <h2 className="text-sm font-semibold">Biblioteca</h2>
              <p className="text-xs text-muted-foreground">Vídeos renderizados disponíveis</p>
              {videos.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <Film size={20} />
                  <span>Nenhum vídeo renderizado ainda.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {videos.map((v) => (
                    <div key={v.filename} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                        <Film size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium" title={v.name}>
                          {v.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{formatBytes(v.size)}</div>
                      </div>
                      <IconButton label="Adicionar à playlist" onClick={() => addVideo(v)}>
                        <Plus size={13} />
                      </IconButton>
                    </div>
                  ))}
                </div>
              )}
            </aside>

            {/* Playlist editor */}
            <main className="flex flex-col gap-2 overflow-y-auto bg-background p-4">
              <h2 className="text-sm font-semibold">Sequência</h2>
              <p className="text-xs text-muted-foreground">
                {playlist.length === 0
                  ? "Adicione vídeos da biblioteca para montar a grade"
                  : `${playlist.length} vídeo${playlist.length !== 1 ? "s" : ""} na sequência`}
              </p>
              {playlist.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
                  <Film size={22} />
                  <span>Nenhum vídeo adicionado.</span>
                  <span className="text-xs">Clique em + na biblioteca para começar.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {playlist.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                        <Film size={14} />
                      </div>
                      <div className="min-w-0 flex-1 truncate text-sm font-medium" title={item.name}>
                        {item.name}
                      </div>
                      <select
                        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        value={item.transition}
                        onChange={(e) => setTransition(item.id, e.target.value as TransitionType)}
                      >
                        <option value="cut">Corte</option>
                        <option value="fade">Fade</option>
                      </select>
                      <div className="flex shrink-0 gap-1">
                        <IconButton label="Mover para cima" onClick={() => moveItem(item.id, -1)} disabled={idx === 0}>
                          <ArrowUp size={12} />
                        </IconButton>
                        <IconButton label="Mover para baixo" onClick={() => moveItem(item.id, 1)} disabled={idx === playlist.length - 1}>
                          <ArrowDown size={12} />
                        </IconButton>
                        <IconButton label="Remover" variant="danger" onClick={() => removeItem(item.id)}>
                          <X size={12} />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>
          </div>
        )}

        {tab === "preview" && (
          <div className="grid h-full grid-cols-1 gap-px overflow-hidden bg-border lg:grid-cols-[1fr_300px]">
            <main className="flex flex-col items-center justify-center gap-4 overflow-y-auto bg-background p-6">
              {playlist.length === 0 ? (
                <div className="flex flex-col items-center gap-1 text-center text-sm text-muted-foreground">
                  <PlayCircle size={22} />
                  <span>Nenhum vídeo na sequência.</span>
                  <span className="text-xs">Adicione vídeos na aba Playlist para pré-visualizar.</span>
                </div>
              ) : (
                <>
                  <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-black">
                    <video
                      ref={videoRef}
                      key={previewItem?.id}
                      className="w-full"
                      src={previewItem ? assetUrl(`exports/${previewItem.filename}`) : undefined}
                      onEnded={handlePreviewEnded}
                      controls
                      autoPlay
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <IconButton label={previewPlaying ? "Pausar" : "Reproduzir"} onClick={() => setPreviewPlaying((p) => !p)}>
                      {previewPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </IconButton>
                    <span className="text-sm text-muted-foreground">
                      {previewIndex + 1} / {playlist.length} — {previewItem?.name}
                    </span>
                  </div>
                </>
              )}
            </main>
            {playlist.length > 0 && (
              <aside className="flex flex-col gap-2 overflow-y-auto bg-background p-4">
                <h2 className="text-sm font-semibold">Sequência</h2>
                <p className="text-xs text-muted-foreground">Clique para saltar para um item</p>
                <div className="flex flex-col gap-1.5">
                  {playlist.map((item, idx) => (
                    <button
                      key={item.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition-colors",
                        idx === previewIndex
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-accent/40",
                      )}
                      onClick={() => jumpToPreviewItem(idx)}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <span className="truncate" title={item.name}>
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </aside>
            )}
          </div>
        )}

        {tab === "schedule" && (
          <div className="mx-auto h-full max-w-3xl overflow-y-auto p-6">
            <ProgrammingTimeline rules={rules} exports={videos} onChange={setRules} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex h-16 shrink-0 items-center justify-between border-t border-border px-4">
        {tab === "playlist" ? (
          <Checkbox checked={loop} onChange={setLoop} label="Repetir playlist em loop" />
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar programação"}
          </Button>
        </div>
      </div>
    </div>
  );
};
