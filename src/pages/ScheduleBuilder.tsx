import React, { useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, Plus, Trash2 } from "lucide-react";
import { Button, Dialog, Field, IconButton, TextField } from "../design-system/components";
import { useNavigationStore } from "../store/useNavigationStore";
import { useScheduleStore } from "../store/useScheduleStore";
import { useChannelStore } from "../store/useChannelStore";
import { useTemplateStore } from "../store/useTemplateStore";
import { useProjectsStore } from "../store/useProjectsStore";
import { toast } from "../store/useToastStore";
import type { Schedule, ScheduleItem, ScheduleItemType } from "../types/schedule";
import "../styles/pages/ScheduleBuilder.css";

export const ScheduleBuilder: React.FC = () => {
  const navigate = useNavigationStore((s) => s.navigate);
  const scheduleId = useNavigationStore((s) => s.editingScheduleId);
  const { schedules, save: saveSchedule, refresh } = useScheduleStore();
  const { channels, refresh: refreshChannels } = useChannelStore();
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    refresh();
    refreshChannels();
  }, [refresh, refreshChannels]);

  const schedule = schedules.find((s) => s.id === scheduleId);
  const channel = channels.find((c) => c.id === schedule?.channelId);

  if (!schedule) {
    return (
      <div className="vt-schedule-builder">
        <p style={{ color: "var(--text-tertiary)" }}>Programação não encontrada.</p>
      </div>
    );
  }

  const handleDeleteItem = async (itemId: string) => {
    const updated: Schedule = {
      ...schedule,
      items: schedule.items.filter((i) => i.id !== itemId),
    };
    await saveSchedule(updated);
    toast.info("Item removido.");
  };

  const handleAddItem = async (item: ScheduleItem) => {
    const sorted = [...schedule.items, item].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
    const updated: Schedule = { ...schedule, items: sorted };
    await saveSchedule(updated);
    toast.success("Item adicionado.");
  };

  const sortedItems = [...schedule.items].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  return (
    <div className="vt-schedule-builder">
      <div className="vt-schedule-builder__header">
        <div className="vt-schedule-builder__header-left">
          <button
            className="vt-schedule-builder__back"
            onClick={() => navigate("schedules")}
            title="Voltar para Programação"
          >
            <ArrowLeft size={15} />
          </button>
          <div className="vt-schedule-builder__titles">
            <h1 className="vt-schedule-builder__title">{schedule.name}</h1>
            {channel && (
              <p className="vt-schedule-builder__sub">Canal: {channel.name}</p>
            )}
          </div>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
          Adicionar item
        </Button>
      </div>

      {sortedItems.length === 0 ? (
        <div className="vt-schedule-builder__empty">
          <div className="vt-schedule-builder__empty-icon"><CalendarClock size={22} /></div>
          <p className="vt-schedule-builder__empty-title">Nenhum item na grade</p>
          <p className="vt-schedule-builder__empty-text">
            Adicione vídeos, templates ou projetos para montar a programação deste canal.
          </p>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
            Adicionar item
          </Button>
        </div>
      ) : (
        <div className="vt-schedule-builder__items">
          {sortedItems.map((item) => (
            <ScheduleItemRow
              key={item.id}
              item={item}
              onDelete={() => handleDeleteItem(item.id)}
            />
          ))}
        </div>
      )}

      <AddItemDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddItem}
      />
    </div>
  );
};

const ScheduleItemRow: React.FC<{ item: ScheduleItem; onDelete: () => void }> = ({ item, onDelete }) => {
  const templates = useTemplateStore((s) => s.templates);
  const projects = useProjectsStore((s) => s.projects);

  const sourceLabel = (() => {
    if (item.type === "video") return item.sourceId.split("/").pop() ?? item.sourceId;
    if (item.type === "template") return templates.find((t) => t.id === item.sourceId)?.name ?? item.sourceId;
    if (item.type === "project") return projects.find((p) => p.id === item.sourceId)?.name ?? item.sourceId;
    return item.sourceId;
  })();

  const durLabel = item.duration >= 60
    ? `${Math.floor(item.duration / 60)}min${item.duration % 60 > 0 ? ` ${item.duration % 60}s` : ""}`
    : `${item.duration}s`;

  return (
    <div className="vt-schedule-builder__item">
      <span className="vt-schedule-builder__item-time">{item.startTime}</span>
      <span className={`vt-schedule-builder__item-type vt-schedule-builder__item-type--${item.type}`}>
        {item.type}
      </span>
      <span className="vt-schedule-builder__item-source" title={item.sourceId}>{sourceLabel}</span>
      <span className="vt-schedule-builder__item-dur">{durLabel}</span>
      <div className="vt-schedule-builder__item-actions">
        <IconButton label="Remover" variant="danger" onClick={onDelete}>
          <Trash2 size={13} />
        </IconButton>
      </div>
    </div>
  );
};

const AddItemDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onAdd: (item: ScheduleItem) => void;
}> = ({ open, onClose, onAdd }) => {
  const templates = useTemplateStore((s) => s.templates);
  const { projects, refresh: refreshProjects } = useProjectsStore();

  const [type, setType] = useState<ScheduleItemType>("video");
  const [sourceId, setSourceId] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [duration, setDuration] = useState(30);

  useEffect(() => {
    if (open) {
      setType("video");
      setSourceId("");
      setStartTime("08:00");
      setDuration(30);
      refreshProjects();
    }
  }, [open, refreshProjects]);

  const handlePickVideo = async () => {
    const result = await window.adFrame.selectVideo();
    if (result) setSourceId(result);
  };

  const handleAdd = () => {
    if (!sourceId) return;
    onAdd({
      id: crypto.randomUUID(),
      type,
      startTime,
      duration,
      sourceId,
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Adicionar item à grade"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleAdd} disabled={!sourceId}>
            Adicionar
          </Button>
        </>
      }
    >
      <div className="vt-schedule-builder__form">
        <Field label="Tipo de conteúdo">
          <select
            value={type}
            onChange={(e) => { setType(e.target.value as ScheduleItemType); setSourceId(""); }}
            className="ds-input ds-select"
          >
            <option value="video">Vídeo</option>
            <option value="template">Template</option>
            <option value="project">Projeto</option>
          </select>
        </Field>

        {type === "video" && (
          <Field label="Arquivo de vídeo">
            <div className="vt-schedule-builder__source-picker">
              <TextField
                value={sourceId}
                readOnly
                placeholder="Nenhum vídeo selecionado"
              />
              <Button variant="secondary" size="sm" onClick={handlePickVideo}>
                Selecionar
              </Button>
            </div>
          </Field>
        )}

        {type === "template" && (
          <Field label="Template">
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="ds-input ds-select"
            >
              <option value="">Selecione um template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
        )}

        {type === "project" && (
          <Field label="Projeto">
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="ds-input ds-select"
            >
              <option value="">Selecione um projeto…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
        )}

        <div className="vt-schedule-builder__form-row">
          <Field label="Horário de início">
            <TextField
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Field>
          <Field label="Duração (segundos)">
            <TextField
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
};
