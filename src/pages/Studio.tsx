import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CalendarClock, ChevronLeft, Film, List, Pause, Play, PlayCircle, Plus, X } from "lucide-react";
import { Button, Checkbox, IconButton } from "../design-system/components";
import { ProgrammingTimeline } from "../components/programming/ProgrammingTimeline";
import { useRendersStore } from "../store/useRendersStore";
import type { ExportedVideo } from "../global";
import type { Channel, PlaylistItem, TransitionType } from "../types/channel";
import type { ProgrammingRule } from "../types/programming";
import "../styles/pages/Studio.css";

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

export const Studio: React.FC<Props> = ({ channel, onClose, onSave }) => {
  const { videos, refresh: refreshVideos } = useRendersStore();
  const [playlist, setPlaylist] = useState<PlaylistItem[]>(channel.playlist ?? []);
  const [loop, setLoop] = useState(channel.loop ?? false);
  const [rules, setRules] = useState<ProgrammingRule[]>(channel.rules ?? []);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("playlist");

  // ── Preview player ──────────────────────────────────────────────────────
  // Plays through the in-memory playlist sequentially via the actual export
  // files ("exports/..." — relative, resolves against the page's app://
  // base the same way asset.filename does for uploads; an absolute
  // "app://exports/..." would put "exports" in the URL host instead of the
  // path and never match the protocol handler) — a rough approximation of
  // the real IPTV broadcast, which remuxes the same files with mpegts/ffmpeg
  // and isn't
  // playable in a plain <video> tag. Transitions aren't simulated, only order.
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

  return (
    <div className="vt-studio">
      <div className="vt-studio__header">
        <button className="vt-studio__back" onClick={onClose}>
          <ChevronLeft size={16} />
          Canais
        </button>
        <h1 className="vt-studio__title">Studio — {channel.name}</h1>
        <div className="vt-studio__tabs">
          <button
            className={`vt-studio__tab${tab === "playlist" ? " vt-studio__tab--active" : ""}`}
            onClick={() => setTab("playlist")}
          >
            <List size={13} /> Playlist
          </button>
          <button
            className={`vt-studio__tab${tab === "preview" ? " vt-studio__tab--active" : ""}`}
            onClick={() => setTab("preview")}
          >
            <PlayCircle size={13} /> Pré-visualizar
          </button>
          <button
            className={`vt-studio__tab${tab === "schedule" ? " vt-studio__tab--active" : ""}`}
            onClick={() => setTab("schedule")}
          >
            <CalendarClock size={13} /> Horários
          </button>
        </div>
        <button className="vt-studio__close" onClick={onClose} aria-label="Fechar">
          <X size={16} />
        </button>
      </div>

      {tab === "playlist" && (
        <div className="vt-studio__body">
          {/* Left: video library */}
          <aside className="vt-studio__library">
            <h2 className="vt-studio__panel-title">Biblioteca</h2>
            <p className="vt-studio__panel-sub">Vídeos renderizados disponíveis</p>

            {videos.length === 0 ? (
              <div className="vt-studio__library-empty">
                <Film size={20} />
                <span>Nenhum vídeo renderizado ainda.</span>
              </div>
            ) : (
              <div className="vt-studio__library-list">
                {videos.map((v) => (
                  <div key={v.filename} className="vt-studio__library-item">
                    <div className="vt-studio__library-icon"><Film size={14} /></div>
                    <div className="vt-studio__library-info">
                      <span className="vt-studio__library-name" title={v.name}>{v.name}</span>
                      <span className="vt-studio__library-meta">{formatBytes(v.size)}</span>
                    </div>
                    <button className="vt-studio__library-add" onClick={() => addVideo(v)} title="Adicionar à playlist">
                      <Plus size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Right: playlist editor */}
          <main className="vt-studio__playlist">
            <h2 className="vt-studio__panel-title">Sequência</h2>
            <p className="vt-studio__panel-sub">
              {playlist.length === 0
                ? "Adicione vídeos da biblioteca para montar a grade"
                : `${playlist.length} vídeo${playlist.length !== 1 ? "s" : ""} na sequência`}
            </p>

            {playlist.length === 0 ? (
              <div className="vt-studio__playlist-empty">
                <Film size={22} />
                <span>Nenhum vídeo adicionado.</span>
                <span className="vt-studio__playlist-empty-hint">Clique em + na biblioteca para começar.</span>
              </div>
            ) : (
              <div className="vt-studio__playlist-list">
                {playlist.map((item, idx) => (
                  <div key={item.id} className="vt-studio__playlist-item">
                    <span className="vt-studio__playlist-num">{idx + 1}</span>
                    <div className="vt-studio__playlist-icon"><Film size={14} /></div>
                    <div className="vt-studio__playlist-info">
                      <span className="vt-studio__playlist-name" title={item.name}>{item.name}</span>
                    </div>
                    <div className="vt-studio__playlist-transition">
                      <label className="vt-studio__transition-label">Transição</label>
                      <select
                        className="vt-studio__transition-select"
                        value={item.transition}
                        onChange={(e) => setTransition(item.id, e.target.value as TransitionType)}
                      >
                        <option value="cut">Corte</option>
                        <option value="fade">Fade</option>
                      </select>
                    </div>
                    <div className="vt-studio__playlist-actions">
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
        <div className="vt-studio__body vt-studio__body--preview">
          <main className="vt-studio__preview">
            {playlist.length === 0 ? (
              <div className="vt-studio__preview-empty">
                <PlayCircle size={22} />
                <span>Nenhum vídeo na sequência.</span>
                <span className="vt-studio__playlist-empty-hint">
                  Adicione vídeos na aba Playlist para pré-visualizar.
                </span>
              </div>
            ) : (
              <>
                <div className="vt-studio__preview-frame">
                  <video
                    ref={videoRef}
                    key={previewItem?.id}
                    className="vt-studio__preview-video"
                    src={previewItem ? `exports/${previewItem.filename}` : undefined}
                    onEnded={handlePreviewEnded}
                    controls
                    autoPlay
                  />
                </div>
                <div className="vt-studio__preview-controls">
                  <IconButton
                    label={previewPlaying ? "Pausar" : "Reproduzir"}
                    onClick={() => setPreviewPlaying((p) => !p)}
                  >
                    {previewPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </IconButton>
                  <span className="vt-studio__preview-now">
                    {previewIndex + 1} / {playlist.length} — {previewItem?.name}
                  </span>
                </div>
              </>
            )}
          </main>

          {playlist.length > 0 && (
            <aside className="vt-studio__preview-list">
              <h2 className="vt-studio__panel-title">Sequência</h2>
              <p className="vt-studio__panel-sub">Clique para saltar para um item</p>
              <div className="vt-studio__playlist-list">
                {playlist.map((item, idx) => (
                  <button
                    key={item.id}
                    className={`vt-studio__preview-item${idx === previewIndex ? " vt-studio__preview-item--active" : ""}`}
                    onClick={() => jumpToPreviewItem(idx)}
                  >
                    <span className="vt-studio__playlist-num">{idx + 1}</span>
                    <span className="vt-studio__playlist-name" title={item.name}>{item.name}</span>
                  </button>
                ))}
              </div>
            </aside>
          )}
        </div>
      )}

      {tab === "schedule" && (
        <div className="vt-studio__schedule-body">
          <ProgrammingTimeline
            rules={rules}
            exports={videos}
            onChange={setRules}
          />
        </div>
      )}

      <div className="vt-studio__footer">
        {tab === "playlist" && (
          <Checkbox checked={loop} onChange={setLoop} label="Repetir playlist em loop" />
        )}
        {tab === "schedule" && <div />}
        <div className="vt-studio__footer-actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar programação"}
          </Button>
        </div>
      </div>
    </div>
  );
};
