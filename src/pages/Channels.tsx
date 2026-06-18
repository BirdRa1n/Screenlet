import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Plus, Repeat2, Trash2, Tv2 } from "lucide-react";
import { Button, Checkbox, Dialog, Field, IconButton, TextField } from "../design-system/components";
import { useChannelStore } from "../store/useChannelStore";
import { toast } from "../store/useToastStore";
import type { Channel } from "../types/channel";
import "../styles/pages/Channels.css";

export const Channels: React.FC = () => {
  const { channels, refresh } = useChannelStore();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="vt-channels">
      <div className="vt-channels__header">
        <div>
          <h1 className="vt-channels__title">Canais</h1>
          <p className="vt-channels__sub">Gerencie os canais da sua rede de exibição.</p>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
          Novo canal
        </Button>
      </div>

      <div className="vt-channels__grid">
        {channels.length === 0 ? (
          <div className="vt-channels__empty">
            <div className="vt-channels__empty-icon"><Tv2 size={22} /></div>
            <p className="vt-channels__empty-title">Nenhum canal criado</p>
            <p className="vt-channels__empty-text">
              Crie um canal para começar a montar a grade de programação das suas TVs.
            </p>
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              Criar canal
            </Button>
          </div>
        ) : (
          channels.map((c) => (
            <ChannelCard key={c.id} channel={c} onRefresh={refresh} />
          ))
        )}
      </div>

      <ChannelDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
};

const ChannelCard: React.FC<{ channel: Channel; onRefresh: () => void }> = ({ channel, onRefresh }) => {
  const { remove, toggle } = useChannelStore();
  const [editOpen, setEditOpen] = useState(false);

  const handleDelete = async () => {
    await remove(channel.id);
    toast.info(`"${channel.name}" removido.`);
  };

  const handleToggle = async () => {
    await toggle(channel.id);
    toast.success(channel.enabled ? `"${channel.name}" desativado.` : `"${channel.name}" ativado.`);
  };

  const loopFilename = channel.loopSourceId
    ? channel.loopSourceId.split("/").pop()
    : null;

  return (
    <>
      <motion.div
        className={`vt-channels__card${channel.enabled ? "" : " vt-channels__card--disabled"}`}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
      >
        <div className="vt-channels__card-header">
          <div className="vt-channels__card-logo">
            {channel.logo ? <img src={channel.logo} alt="" /> : <Tv2 size={18} />}
          </div>
          <div className="vt-channels__card-info">
            <div className="vt-channels__card-name">{channel.name}</div>
            {channel.description && (
              <div className="vt-channels__card-desc">{channel.description}</div>
            )}
          </div>
        </div>

        <div className="vt-channels__card-tags">
          <div
            className={`vt-channels__card-badge ${channel.enabled ? "vt-channels__card-badge--on" : "vt-channels__card-badge--off"}`}
            onClick={handleToggle}
            style={{ cursor: "pointer" }}
          >
            <span className="vt-channels__card-badge-dot" />
            {channel.enabled ? "Ativo" : "Inativo"}
          </div>

          {loopFilename && (
            <div className="vt-channels__card-badge vt-channels__card-badge--loop" title={loopFilename}>
              <Repeat2 size={10} />
              Loop
            </div>
          )}
        </div>

        <div className="vt-channels__card-actions">
          <IconButton label="Editar" onClick={() => setEditOpen(true)}>
            <Pencil size={13} />
          </IconButton>
          <IconButton label="Excluir" variant="danger" onClick={handleDelete}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      </motion.div>

      <ChannelDialog
        open={editOpen}
        channel={channel}
        onClose={() => setEditOpen(false)}
        onSaved={onRefresh}
      />
    </>
  );
};

const ChannelDialog: React.FC<{
  open: boolean;
  channel?: Channel;
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, channel, onClose, onSaved }) => {
  const { save } = useChannelStore();
  const isEdit = !!channel;

  const [name, setName] = useState(channel?.name ?? "");
  const [description, setDescription] = useState(channel?.description ?? "");
  const [loopEnabled, setLoopEnabled] = useState(!!(channel?.loopSourceId));
  const [loopSourceId, setLoopSourceId] = useState(channel?.loopSourceId ?? "");

  useEffect(() => {
    if (open) {
      setName(channel?.name ?? "");
      setDescription(channel?.description ?? "");
      setLoopEnabled(!!(channel?.loopSourceId));
      setLoopSourceId(channel?.loopSourceId ?? "");
    }
  }, [open, channel]);

  const handlePickVideo = async () => {
    const result = await window.adFrame.selectVideo();
    if (result) setLoopSourceId(result);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const updated: Channel = {
      id: channel?.id ?? crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      logo: channel?.logo ?? "",
      enabled: channel?.enabled ?? true,
      loopSourceId: loopEnabled && loopSourceId ? loopSourceId : null,
      loopSourceType: loopEnabled && loopSourceId ? "video" : null,
      createdAt: channel?.createdAt ?? now,
      updatedAt: now,
    };
    await save(updated);
    toast.success(isEdit ? "Canal atualizado." : "Canal criado.");
    onSaved();
    onClose();
  };

  const loopFilename = loopSourceId ? loopSourceId.split("/").pop() : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar canal" : "Novo canal"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave}>Salvar</Button>
        </>
      }
    >
      <div className="vt-channels__form">
        <Field label="Nome do canal">
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Ex: Canal Principal"
          />
        </Field>

        <Field label="Descrição (opcional)">
          <TextField
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição opcional"
          />
        </Field>

        <div className="vt-channels__form-divider" />

        <Checkbox
          checked={loopEnabled}
          onChange={(v) => {
            setLoopEnabled(v);
            if (!v) setLoopSourceId("");
          }}
          label="Reproduzir conteúdo em loop"
        />

        {loopEnabled && (
          <div className="vt-channels__loop-section">
            <div className="vt-channels__loop-picker">
              <div className="vt-channels__loop-file">
                {loopFilename
                  ? <span className="vt-channels__loop-filename">{loopFilename}</span>
                  : <span className="vt-channels__loop-placeholder">Nenhum vídeo selecionado</span>
                }
              </div>
              <Button variant="secondary" size="sm" onClick={handlePickVideo}>
                {loopFilename ? "Trocar vídeo" : "Selecionar vídeo"}
              </Button>
            </div>
            <p className="vt-channels__loop-hint">
              O vídeo selecionado será reproduzido continuamente neste canal, ignorando a grade de programação.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
};
