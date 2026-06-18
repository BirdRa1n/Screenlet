import React, { useEffect, useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Dialog, Field, IconButton, TextField } from "../design-system/components";
import { useChannelStore } from "../store/useChannelStore";
import { useScheduleStore } from "../store/useScheduleStore";
import { useNavigationStore } from "../store/useNavigationStore";
import { toast } from "../store/useToastStore";
import type { Schedule } from "../types/schedule";
import "../styles/pages/Schedules.css";

export const Schedules: React.FC = () => {
  const { channels, refresh: refreshChannels } = useChannelStore();
  const { schedules, refresh: refreshSchedules } = useScheduleStore();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    refreshChannels();
    refreshSchedules();
  }, [refreshChannels, refreshSchedules]);

  useEffect(() => {
    if (channels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);
  const channelSchedules = schedules.filter((s) => s.channelId === selectedChannelId);

  return (
    <div className="vt-schedules">
      <div className="vt-schedules__header">
        <div>
          <h1 className="vt-schedules__title">Programação</h1>
          <p className="vt-schedules__sub">Organize a grade de conteúdo dos seus canais.</p>
        </div>
        {selectedChannel && (
          <Button
            variant="primary"
            icon={<Plus size={14} />}
            onClick={() => setCreateOpen(true)}
          >
            Nova programação
          </Button>
        )}
      </div>

      {channels.length === 0 ? (
        <div className="vt-schedules__no-channel">
          <CalendarClock size={28} />
          <p>Nenhum canal disponível. Crie um canal primeiro.</p>
        </div>
      ) : (
        <>
          <div className="vt-schedules__channel-selector">
            <span className="vt-schedules__channel-label">Canal:</span>
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              style={{
                flex: 1,
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                padding: "6px 10px",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body)",
              }}
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {channelSchedules.length === 0 ? (
            <div className="vt-schedules__empty">
              <div className="vt-schedules__empty-icon"><CalendarClock size={22} /></div>
              <p className="vt-schedules__empty-title">Nenhuma programação</p>
              <p className="vt-schedules__empty-text">
                Crie uma programação para este canal e adicione vídeos, templates ou projetos.
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setCreateOpen(true)}
              >
                Criar programação
              </Button>
            </div>
          ) : (
            <div className="vt-schedules__list">
              {channelSchedules.map((s) => (
                <ScheduleItem key={s.id} schedule={s} onRefresh={refreshSchedules} />
              ))}
            </div>
          )}
        </>
      )}

      {selectedChannel && (
        <ScheduleDialog
          open={createOpen}
          channelId={selectedChannelId}
          onClose={() => setCreateOpen(false)}
          onSaved={refreshSchedules}
        />
      )}
    </div>
  );
};

const ScheduleItem: React.FC<{ schedule: Schedule; onRefresh: () => void }> = ({ schedule, onRefresh }) => {
  const { remove } = useScheduleStore();
  const navigateToSchedule = useNavigationStore((s) => s.navigateToSchedule);

  const handleDelete = async () => {
    await remove(schedule.id);
    toast.info(`"${schedule.name}" removida.`);
    onRefresh();
  };

  const date = new Date(schedule.updatedAt).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <div className="vt-schedules__item">
      <div className="vt-schedules__item-icon">
        <CalendarClock size={16} />
      </div>
      <div className="vt-schedules__item-info">
        <div className="vt-schedules__item-name">{schedule.name}</div>
        <div className="vt-schedules__item-meta">
          {schedule.items.length} {schedule.items.length === 1 ? "item" : "itens"} · Atualizado em {date}
        </div>
      </div>
      {schedule.items.length > 0 && (
        <div className="vt-schedules__items-section">
          <div className="vt-schedules__schedule-items">
            {schedule.items.slice(0, 3).map((item) => (
              <div key={item.id} className="vt-schedules__schedule-item">
                <span className="vt-schedules__schedule-item-time">{item.startTime}</span>
                <span className="vt-schedules__schedule-item-type">{item.type}</span>
                <span className="vt-schedules__schedule-item-id">{item.sourceId}</span>
                <span className="vt-schedules__schedule-item-dur">{item.duration}s</span>
              </div>
            ))}
            {schedule.items.length > 3 && (
              <div style={{ fontSize: "var(--text-caption)", color: "var(--text-tertiary)", padding: "4px 12px" }}>
                +{schedule.items.length - 3} itens
              </div>
            )}
          </div>
        </div>
      )}
      <div className="vt-schedules__item-actions">
        <IconButton label="Editar grade" onClick={() => navigateToSchedule(schedule.id)}>
          <Pencil size={13} />
        </IconButton>
        <IconButton label="Excluir" variant="danger" onClick={handleDelete}>
          <Trash2 size={13} />
        </IconButton>
      </div>
    </div>
  );
};

const ScheduleDialog: React.FC<{
  open: boolean;
  channelId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, channelId, onClose, onSaved }) => {
  const { save } = useScheduleStore();
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const schedule: Schedule = {
      id: crypto.randomUUID(),
      channelId,
      name: name.trim(),
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    await save(schedule);
    toast.success("Programação criada.");
    onSaved();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nova programação"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave}>Criar</Button>
        </>
      }
    >
      <div className="vt-schedules__form">
        <Field label="Nome da programação">
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Ex: Grade Segunda-feira"
          />
        </Field>
      </div>
    </Dialog>
  );
};
