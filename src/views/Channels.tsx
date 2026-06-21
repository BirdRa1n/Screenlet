"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Pencil, Plus, Repeat2, Trash2, Tv2 } from "lucide-react";
import { Button, Dialog, Field, IconButton, TextField } from "../design-system/components";
import { PageContainer, PageHeader, EmptyState } from "../layout/PageShell";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/assetUrl";
import { useChannelStore } from "../store/useChannelStore";
import { toast } from "../store/useToastStore";
import { Studio } from "./Studio";
import type { Channel } from "../types/channel";

export const Channels: React.FC = () => {
  const { channels, refresh, save } = useChannelStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [studioChannel, setStudioChannel] = useState<Channel | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (studioChannel) {
    return (
      <Studio
        channel={studioChannel}
        onClose={() => setStudioChannel(null)}
        onSave={async (updated) => {
          await save(updated);
          toast.success("Programação salva.");
          setStudioChannel(null);
        }}
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Canais"
        subtitle="Gerencie os canais da sua rede de exibição."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            Novo canal
          </Button>
        }
      />

      {channels.length === 0 ? (
        <EmptyState
          icon={<Tv2 size={22} />}
          title="Nenhum canal criado"
          text="Crie um canal para começar a montar a grade de programação das suas TVs."
          action={
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              Criar canal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => (
            <ChannelCard key={c.id} channel={c} onRefresh={refresh} onOpenStudio={setStudioChannel} />
          ))}
        </div>
      )}

      <ChannelDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={refresh} />
    </PageContainer>
  );
};

const ChannelCard: React.FC<{
  channel: Channel;
  onRefresh: () => void;
  onOpenStudio: (channel: Channel) => void;
}> = ({ channel, onRefresh, onOpenStudio }) => {
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

  const itemCount = channel.playlist?.length ?? 0;

  return (
    <>
      <div
        className={cn(
          "group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
          !channel.enabled && "opacity-60",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
            {channel.logo ? <img src={assetUrl(channel.logo)} alt="" className="size-full object-cover" /> : <Tv2 size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{channel.name}</div>
            {channel.description && (
              <div className="truncate text-xs text-muted-foreground">{channel.description}</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleToggle}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              channel.enabled
                ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                channel.enabled ? "bg-[color:var(--success)]" : "bg-muted-foreground/50",
              )}
            />
            {channel.enabled ? "Ativo" : "Inativo"}
          </button>

          {itemCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <Repeat2 size={11} />
              {itemCount} vídeo{itemCount !== 1 ? "s" : ""}
              {channel.loop ? " · loop" : ""}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            icon={<Clapperboard size={13} />}
            onClick={() => onOpenStudio(channel)}
          >
            Studio
          </Button>
          <IconButton label="Editar" onClick={() => setEditOpen(true)}>
            <Pencil size={13} />
          </IconButton>
          <IconButton label="Excluir" variant="danger" onClick={handleDelete}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>

      <ChannelDialog open={editOpen} channel={channel} onClose={() => setEditOpen(false)} onSaved={onRefresh} />
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

  useEffect(() => {
    if (open) {
      setName(channel?.name ?? "");
      setDescription(channel?.description ?? "");
    }
  }, [open, channel]);

  const handleSave = async () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const updated: Channel = {
      id: channel?.id ?? crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      logo: channel?.logo ?? "",
      enabled: channel?.enabled ?? true,
      playlist: channel?.playlist ?? [],
      loop: channel?.loop ?? false,
      createdAt: channel?.createdAt ?? now,
      updatedAt: now,
    };
    await save(updated);
    toast.success(isEdit ? "Canal atualizado." : "Canal criado.");
    onSaved();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar canal" : "Novo canal"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
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
      </div>
    </Dialog>
  );
};
