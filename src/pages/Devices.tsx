import React, { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  MonitorPlay,
  Pencil,
  Plus,
  RefreshCw,
  Terminal,
  Trash2,
  Tv2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button, Dialog, Field, IconButton, SelectField, TextField } from "../design-system/components";
import { useDeviceStore } from "../store/useDeviceStore";
import { useChannelStore } from "../store/useChannelStore";
import { toast } from "../store/useToastStore";
import type { KodiChannel, KodiDevice } from "../types/device";
import "../styles/pages/Devices.css";

// ─── Tutorial ──────────────────────────────────────────────────────────────────

const TUTORIAL_STEPS = [
  {
    step: "1",
    title: "Habilitar servidor HTTP do Kodi",
    code: null,
    text: 'Acesse Configurações → Serviços → Controle e ative "Permitir controle remoto pelo HTTP". Anote a porta (padrão 8080), usuário e senha.',
  },
  {
    step: "2",
    title: "Verificar credenciais da API",
    code: `grep -i webserver /storage/.kodi/userdata/guisettings.xml`,
    text: "Execute no terminal do dispositivo. A saída mostrará porta, usuário e senha configurados.",
  },
  {
    step: "3",
    title: "Testar acesso à API",
    code: `curl -u kodi:SENHA \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","method":"JSONRPC.Version","id":1}' \\\n  http://IP:8080/jsonrpc`,
    text: 'Substitua SENHA e IP. Se retornar a versão do JSON-RPC, a API está funcionando.',
  },
  {
    step: "4",
    title: "Descobrir o ID do canal IPTV",
    code: `curl -u kodi:SENHA \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","method":"PVR.GetChannels","params":{"channelgroupid":"alltv"},"id":1}' \\\n  http://IP:8080/jsonrpc`,
    text: 'Anote o "channelid" do canal que deseja abrir automaticamente. No Screenlet, use o botão "Buscar canais" no formulário.',
  },
];

const TutorialPanel: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="vt-devices__tutorial">
      <button className="vt-devices__tutorial-toggle" onClick={() => setOpen((v) => !v)}>
        <Terminal size={14} />
        <span>Como configurar o Kodi para controle remoto</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="vt-devices__tutorial-body">
          {TUTORIAL_STEPS.map((s) => (
            <div key={s.step} className="vt-devices__tutorial-step">
              <div className="vt-devices__tutorial-num">{s.step}</div>
              <div className="vt-devices__tutorial-content">
                <div className="vt-devices__tutorial-title">{s.title}</div>
                <p className="vt-devices__tutorial-text">{s.text}</p>
                {s.code && (
                  <pre className="vt-devices__tutorial-code">{s.code}</pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Device card ──────────────────────────────────────────────────────────────

type PingState = "idle" | "loading" | "online" | "offline";

const DeviceCard: React.FC<{
  device: KodiDevice;
  channelName: string | null;
  onEdit: () => void;
  onDeleted: () => void;
}> = ({ device, channelName, onEdit, onDeleted }) => {
  const { remove } = useDeviceStore();
  const [ping, setPing] = useState<PingState>("idle");
  const [restarting, setRestarting] = useState(false);

  const handlePing = async () => {
    setPing("loading");
    const result = await window.adFrame.kodiPing(device.id);
    setPing(result.ok ? "online" : "offline");
    if (!result.ok) toast.error(`${device.name}: ${result.error}`);
  };

  const handleRestart = async () => {
    setRestarting(true);
    const result = await window.adFrame.kodiRestartAndOpen(device.id);
    setRestarting(false);
    if (result.ok) {
      toast.success(
        `Kodi reiniciado em ${device.name}. Canal será aberto em ${device.restartDelaySecs}s.`
      );
    } else {
      toast.error(`Falha ao reiniciar ${device.name}: ${result.error}`);
    }
  };

  const handleDelete = async () => {
    await remove(device.id);
    toast.info(`"${device.name}" removido.`);
    onDeleted();
  };

  return (
    <motion.div
      className="vt-devices__card"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
    >
      <div className="vt-devices__card-header">
        <div className="vt-devices__card-icon">
          <MonitorPlay size={18} />
        </div>
        <div className="vt-devices__card-info">
          <div className="vt-devices__card-name">{device.name}</div>
          <div className="vt-devices__card-ip">{device.ip}:{device.sshPort}</div>
        </div>
        <div className={`vt-devices__ping-badge vt-devices__ping-badge--${ping}`}>
          {ping === "online" && <Wifi size={11} />}
          {ping === "offline" && <WifiOff size={11} />}
          {ping === "loading" && <RefreshCw size={11} className="vt-devices__spin" />}
          {ping === "idle" ? "—" : ping === "loading" ? "Verificando" : ping === "online" ? "Online" : "Offline"}
        </div>
      </div>

      <div className="vt-devices__card-tags">
        <span className="vt-devices__card-tag">
          <Tv2 size={10} />
          {channelName ? `Canal: ${channelName}` : "Sem canal padrão"}
        </span>
        {device.kodiChannelId != null && (
          <span className="vt-devices__card-tag vt-devices__card-tag--kodi">
            Kodi ID #{device.kodiChannelId}
          </span>
        )}
      </div>

      <div className="vt-devices__card-actions">
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={12} />}
          onClick={handleRestart}
          disabled={restarting}
        >
          {restarting ? "Reiniciando…" : "Reiniciar Kodi"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Wifi size={12} />}
          onClick={handlePing}
          disabled={ping === "loading"}
        >
          Testar
        </Button>
        <div className="vt-devices__card-icon-actions">
          <IconButton label="Editar" onClick={onEdit}>
            <Pencil size={13} />
          </IconButton>
          <IconButton label="Excluir" variant="danger" onClick={handleDelete}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Form dialog ──────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  ip: string;
  sshPort: string;
  sshUser: string;
  sshPassword: string;
  kodiHttpPort: string;
  kodiHttpUser: string;
  kodiHttpPassword: string;
  defaultChannelId: string;
  kodiChannelId: string;
  restartDelaySecs: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  ip: "",
  sshPort: "22",
  sshUser: "",
  sshPassword: "",
  kodiHttpPort: "8080",
  kodiHttpUser: "kodi",
  kodiHttpPassword: "",
  defaultChannelId: "",
  kodiChannelId: "",
  restartDelaySecs: "20",
};

function deviceToForm(d: KodiDevice): FormState {
  return {
    name: d.name,
    ip: d.ip,
    sshPort: String(d.sshPort),
    sshUser: d.sshUser,
    sshPassword: "",          // never pre-filled — credentials stay in OS keychain
    kodiHttpPort: String(d.kodiHttpPort),
    kodiHttpUser: d.kodiHttpUser,
    kodiHttpPassword: "",     // never pre-filled — credentials stay in OS keychain
    defaultChannelId: d.defaultChannelId ?? "",
    kodiChannelId: d.kodiChannelId != null ? String(d.kodiChannelId) : "",
    restartDelaySecs: String(d.restartDelaySecs),
  };
}

const DeviceDialog: React.FC<{
  open: boolean;
  device?: KodiDevice;
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, device, onClose, onSaved }) => {
  const { save } = useDeviceStore();
  const { channels } = useChannelStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fetchingChannels, setFetchingChannels] = useState(false);
  const [kodiChannels, setKodiChannels] = useState<KodiChannel[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(device ? deviceToForm(device) : EMPTY_FORM);
      setKodiChannels([]);
    }
  }, [open, device]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleFetchKodiChannels = async () => {
    setFetchingChannels(true);
    const result = await window.adFrame.kodiListChannels({
      ip: form.ip,
      kodiHttpPort: Number(form.kodiHttpPort) || 8080,
      kodiHttpUser: form.kodiHttpUser,
      kodiHttpPassword: form.kodiHttpPassword,
    });
    setFetchingChannels(false);
    if (result.length === 0) {
      toast.error("Nenhum canal encontrado. Verifique as credenciais do Kodi.");
    } else {
      setKodiChannels(result);
      toast.success(`${result.length} canal(is) encontrado(s) no Kodi.`);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.ip.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const updated: KodiDevice = {
      id: device?.id ?? crypto.randomUUID(),
      name: form.name.trim(),
      ip: form.ip.trim(),
      sshPort: Number(form.sshPort) || 22,
      sshUser: form.sshUser.trim(),
      // Only include password if user typed something — empty = keep existing blob.
      ...(form.sshPassword ? { sshPassword: form.sshPassword } : {}),
      hasSshPassword: device?.hasSshPassword ?? false,
      kodiHttpPort: Number(form.kodiHttpPort) || 8080,
      kodiHttpUser: form.kodiHttpUser.trim(),
      ...(form.kodiHttpPassword ? { kodiHttpPassword: form.kodiHttpPassword } : {}),
      hasKodiPassword: device?.hasKodiPassword ?? false,
      defaultChannelId: form.defaultChannelId || null,
      kodiChannelId: form.kodiChannelId !== "" ? Number(form.kodiChannelId) : null,
      restartDelaySecs: Number(form.restartDelaySecs) || 20,
      createdAt: device?.createdAt ?? now,
      updatedAt: now,
    };
    await save(updated);
    toast.success(device ? "Dispositivo atualizado." : "Dispositivo cadastrado.");
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={device ? "Editar dispositivo" : "Novo dispositivo"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !form.name.trim() || !form.ip.trim()}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="vt-devices__form">
        <div className="vt-devices__form-section">
          <div className="vt-devices__form-section-title">Identificação</div>
          <div className="vt-devices__form-row">
            <Field label="Nome do dispositivo">
              <TextField value={form.name} onChange={set("name")} placeholder="TV Recepção" />
            </Field>
          </div>
        </div>

        <div className="vt-devices__form-section">
          <div className="vt-devices__form-section-title">Conexão SSH</div>
          <div className="vt-devices__form-row vt-devices__form-row--3">
            <Field label="Endereço IP">
              <TextField value={form.ip} onChange={set("ip")} placeholder="192.168.1.100" />
            </Field>
            <Field label="Porta SSH">
              <TextField type="number" value={form.sshPort} onChange={set("sshPort")} placeholder="22" />
            </Field>
          </div>
          <div className="vt-devices__form-row">
            <Field label="Usuário SSH">
              <TextField value={form.sshUser} onChange={set("sshUser")} placeholder="root" />
            </Field>
            <Field
              label="Senha SSH"
              hint={device?.hasSshPassword ? "Senha configurada — deixe em branco para manter." : undefined}
            >
              <TextField
                type="password"
                value={form.sshPassword}
                onChange={set("sshPassword")}
                placeholder={device?.hasSshPassword ? "••••••  (salva no Keychain)" : "••••••"}
                autoComplete="new-password"
              />
            </Field>
          </div>
        </div>

        <div className="vt-devices__form-section">
          <div className="vt-devices__form-section-title">Kodi HTTP API</div>
          <div className="vt-devices__form-row vt-devices__form-row--3">
            <Field label="Porta HTTP">
              <TextField type="number" value={form.kodiHttpPort} onChange={set("kodiHttpPort")} placeholder="8080" />
            </Field>
          </div>
          <div className="vt-devices__form-row">
            <Field label="Usuário Kodi">
              <TextField value={form.kodiHttpUser} onChange={set("kodiHttpUser")} placeholder="kodi" />
            </Field>
            <Field
              label="Senha Kodi HTTP"
              hint={device?.hasKodiPassword ? "Senha configurada — deixe em branco para manter." : undefined}
            >
              <TextField
                type="password"
                value={form.kodiHttpPassword}
                onChange={set("kodiHttpPassword")}
                placeholder={device?.hasKodiPassword ? "••••••  (salva no Keychain)" : "••••••"}
                autoComplete="new-password"
              />
            </Field>
          </div>
        </div>

        <div className="vt-devices__form-section">
          <div className="vt-devices__form-section-title">Programação</div>
          <div className="vt-devices__form-row">
            <Field label="Canal Screenlet padrão" hint="Kodi será reiniciado automaticamente ao atualizar este canal.">
              <SelectField value={form.defaultChannelId} onChange={set("defaultChannelId")}>
                <option value="">— Nenhum —</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </SelectField>
            </Field>
            <Field label="Delay após reiniciar (s)" hint="Aguarda N segundos antes de abrir o canal.">
              <TextField type="number" value={form.restartDelaySecs} onChange={set("restartDelaySecs")} placeholder="20" />
            </Field>
          </div>

          <div className="vt-devices__kodi-channel-row">
            <Field label="ID do canal Kodi (PVR)">
              <TextField
                type="number"
                value={form.kodiChannelId}
                onChange={set("kodiChannelId")}
                placeholder="Ex: 1"
              />
            </Field>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={12} />}
              onClick={handleFetchKodiChannels}
              disabled={fetchingChannels || !form.ip.trim()}
            >
              {fetchingChannels ? "Buscando…" : "Buscar canais"}
            </Button>
          </div>

          {kodiChannels.length > 0 && (
            <div className="vt-devices__form-kodi-channels">
              <Field label="Selecionar canal do Kodi">
                <SelectField
                  value={form.kodiChannelId}
                  onChange={set("kodiChannelId")}
                >
                  <option value="">— Selecione —</option>
                  {kodiChannels.map((ch) => (
                    <option key={ch.channelid} value={ch.channelid}>
                      #{ch.channelid} — {ch.label}
                    </option>
                  ))}
                </SelectField>
              </Field>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const Devices: React.FC = () => {
  const { devices, refresh } = useDeviceStore();
  const { channels, refresh: refreshChannels } = useChannelStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<KodiDevice | null>(null);

  const loadAll = useCallback(async () => {
    await Promise.all([refresh(), refreshChannels()]);
  }, [refresh, refreshChannels]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const channelName = (id: string | null) =>
    id ? (channels.find((c) => c.id === id)?.name ?? null) : null;

  return (
    <div className="vt-devices">
      <div className="vt-devices__header">
        <div>
          <h1 className="vt-devices__title">Dispositivos</h1>
          <p className="vt-devices__sub">Gerencie TVs e players Kodi da rede.</p>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
          Novo dispositivo
        </Button>
      </div>

      <TutorialPanel />

      {devices.length === 0 ? (
        <div className="vt-devices__empty">
          <div className="vt-devices__empty-icon"><MonitorPlay size={24} /></div>
          <p className="vt-devices__empty-title">Nenhum dispositivo cadastrado</p>
          <p className="vt-devices__empty-text">
            Cadastre TVs ou players Kodi para controlar a reprodução remotamente.
          </p>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
            Adicionar dispositivo
          </Button>
        </div>
      ) : (
        <div className="vt-devices__grid">
          {devices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              channelName={channelName(d.defaultChannelId)}
              onEdit={() => setEditDevice(d)}
              onDeleted={refresh}
            />
          ))}
        </div>
      )}

      <DeviceDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={refresh}
      />
      <DeviceDialog
        open={!!editDevice}
        device={editDevice ?? undefined}
        onClose={() => setEditDevice(null)}
        onSaved={refresh}
      />
    </div>
  );
};
