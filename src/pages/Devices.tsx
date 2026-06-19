import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
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

const TUTORIAL_GROUPS = [
  {
    group: "Instalar o cliente IPTV",
    steps: [
      {
        title: "Instalar o add-on PVR IPTV Simple Client",
        text: 'No Kodi: Configurações → Add-ons → Instalar de repositório → Add-ons de clientes PVR → "PVR IPTV Simple Client" → Instalar. Depois habilite o add-on.',
      },
      {
        title: "Apontar para a playlist do Screenlet",
        text: 'Abra a configuração do add-on (aba "Geral") → em "Localização M3U" escolha Remoto (URL) e cole o endereço da página "Servidor IPTV" (ex: http://192.168.x.x:7095/playlist.m3u).',
      },
      {
        title: "Apontar para o guia de programação (opcional)",
        text: 'Na aba "EPG" → em "Localização XMLTV" escolha Remoto (URL) e cole a URL do epg.xml, também disponível na página "Servidor IPTV".',
      },
      {
        title: "Salvar e reiniciar o Kodi",
        text: 'Confirme a configuração do add-on e reinicie o Kodi. Os canais do Screenlet aparecerão em "TV ao vivo" no menu principal.',
      },
    ],
  },
  {
    group: "Habilitar controle remoto via HTTP",
    steps: [
      {
        title: "Ativar o servidor de controle",
        text: 'Configurações → Serviços → Controle → ative "Permitir controle remoto via HTTP".',
      },
      {
        title: "Definir porta e credenciais",
        text: "Defina a porta (padrão 8080), usuário e senha. Essas credenciais são o que o Screenlet usa para reiniciar o Kodi e trocar de canal remotamente.",
      },
    ],
  },
];

const TutorialPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  let n = 0;

  return (
    <div className="vt-devices__tutorial">
      <button className="vt-devices__tutorial-toggle" onClick={() => setOpen((v) => !v)}>
        <Terminal size={14} />
        <span>Como instalar o cliente IPTV e habilitar o controle HTTP</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="vt-devices__tutorial-body">
          {TUTORIAL_GROUPS.map((g) => (
            <div key={g.group} className="vt-devices__tutorial-group">
              <div className="vt-devices__tutorial-group-title">{g.group}</div>
              {g.steps.map((s) => {
                n += 1;
                return (
                  <div key={s.title} className="vt-devices__tutorial-step">
                    <div className="vt-devices__tutorial-num">{n}</div>
                    <div className="vt-devices__tutorial-content">
                      <div className="vt-devices__tutorial-title">{s.title}</div>
                      <p className="vt-devices__tutorial-text">{s.text}</p>
                    </div>
                  </div>
                );
              })}
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

// ─── Form wizard ──────────────────────────────────────────────────────────────

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
    sshPassword: "",
    kodiHttpPort: String(d.kodiHttpPort),
    kodiHttpUser: d.kodiHttpUser,
    kodiHttpPassword: "",
    defaultChannelId: d.defaultChannelId ?? "",
    kodiChannelId: d.kodiChannelId != null ? String(d.kodiChannelId) : "",
    restartDelaySecs: String(d.restartDelaySecs),
  };
}

const WIZARD_STEPS = [
  { num: 1 as const, label: "Acesso", sub: "SSH" },
  { num: 2 as const, label: "Kodi HTTP", sub: "API" },
  { num: 3 as const, label: "Programação", sub: "Canal" },
];

type WizardStep = 1 | 2 | 3;

const DeviceDialog: React.FC<{
  open: boolean;
  device?: KodiDevice;
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, device, onClose, onSaved }) => {
  const { save } = useDeviceStore();
  const { channels } = useChannelStore();
  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [detected, setDetected] = useState(false);
  const [fetchingChannels, setFetchingChannels] = useState(false);
  const [fetchingConfig, setFetchingConfig] = useState(false);
  const [kodiChannels, setKodiChannels] = useState<KodiChannel[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setDetected(false);
      setKodiChannels([]);
      setForm(device ? deviceToForm(device) : EMPTY_FORM);
    }
  }, [open, device]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (["ip", "sshPort", "sshUser", "sshPassword"].includes(key)) setDetected(false);
  };

  const sshCredsReady = !!(
    form.ip.trim() && form.sshUser.trim() &&
    (form.sshPassword.trim() || device?.hasSshPassword)
  );

  const step1Valid = !!(form.name.trim() && form.ip.trim());

  const handleFetchKodiConfig = async () => {
    setFetchingConfig(true);
    const result = await window.adFrame.kodiFetchConfig({
      ip: form.ip.trim(),
      sshPort: Number(form.sshPort) || 22,
      sshUser: form.sshUser.trim(),
      sshPassword: form.sshPassword,
    });
    setFetchingConfig(false);
    if (!result.ok) {
      toast.error(`Falha ao ler configuração: ${result.error}`);
      return;
    }
    setForm((prev) => ({
      ...prev,
      kodiHttpPort: String(result.port),
      kodiHttpUser: result.user,
      kodiHttpPassword: result.password,
    }));
    setDetected(true);
    setStep(2);
  };

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
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.ip.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    await save({
      id: device?.id ?? crypto.randomUUID(),
      name: form.name.trim(),
      ip: form.ip.trim(),
      sshPort: Number(form.sshPort) || 22,
      sshUser: form.sshUser.trim(),
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
    });
    toast.success(device ? "Dispositivo atualizado." : "Dispositivo cadastrado.");
    setSaving(false);
    onSaved();
    onClose();
  };

  const goNext = () => setStep((s) => Math.min(s + 1, 3) as WizardStep);
  const goBack = () => setStep((s) => Math.max(s - 1, 1) as WizardStep);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={device ? "Editar dispositivo" : "Novo dispositivo"}
      footer={
        <div className="vt-devices__wizard-nav">
          {step > 1
            ? <Button variant="secondary" onClick={goBack} disabled={saving}>Voltar</Button>
            : <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          }
          {step < 3
            ? <Button variant="primary" onClick={goNext} disabled={step === 1 && !step1Valid}>Continuar</Button>
            : <Button variant="primary" onClick={handleSave} disabled={saving || !step1Valid}>{saving ? "Salvando…" : "Salvar"}</Button>
          }
        </div>
      }
    >
      {/* Step indicator */}
      <div className="vt-devices__wizard">
        {WIZARD_STEPS.map((s, i) => {
          const done = step > s.num;
          const active = step === s.num;
          return (
            <React.Fragment key={s.num}>
              <div className={`vt-devices__wizard-step${active ? " vt-devices__wizard-step--active" : ""}${done ? " vt-devices__wizard-step--done" : ""}`}>
                <div className="vt-devices__wizard-circle">
                  {done ? <Check size={12} strokeWidth={3} /> : s.num}
                </div>
                <div className="vt-devices__wizard-label">{s.label}</div>
                <div className="vt-devices__wizard-sub">{s.sub}</div>
              </div>
              {i < WIZARD_STEPS.length - 1 && (
                <div className={`vt-devices__wizard-conn${done ? " vt-devices__wizard-conn--done" : ""}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: SSH + identification */}
      {step === 1 && (
        <div className="vt-devices__step-content">
          <Field label="Nome do dispositivo">
            <TextField value={form.name} onChange={set("name")} placeholder="TV Recepção" autoFocus />
          </Field>
          <div className="vt-devices__form-row">
            <Field label="Endereço IP">
              <TextField value={form.ip} onChange={set("ip")} placeholder="192.168.1.100" />
            </Field>
            <Field label="Porta SSH">
              <TextField type="number" value={form.sshPort} onChange={set("sshPort")} className="vt-devices__port-field" />
            </Field>
          </div>
          <div className="vt-devices__form-row">
            <Field label="Usuário SSH">
              <TextField value={form.sshUser} onChange={set("sshUser")} placeholder="root" />
            </Field>
            <Field label="Senha SSH" hint={device?.hasSshPassword ? "Deixe em branco para manter." : undefined}>
              <TextField
                type="password"
                value={form.sshPassword}
                onChange={set("sshPassword")}
                placeholder={device?.hasSshPassword ? "•••• (salva no Keychain)" : "••••••"}
                autoComplete="new-password"
              />
            </Field>
          </div>
          <div className="vt-devices__detect-action">
            <Button
              variant="secondary"
              size="sm"
              icon={fetchingConfig ? <RefreshCw size={12} className="vt-devices__spin" /> : <Terminal size={12} />}
              onClick={handleFetchKodiConfig}
              disabled={fetchingConfig || !sshCredsReady}
            >
              {fetchingConfig ? "Conectando…" : "Ler configuração Kodi via SSH"}
            </Button>
            <span className="vt-devices__detect-hint">
              Preenche a etapa 2 automaticamente
            </span>
          </div>
        </div>
      )}

      {/* Step 2: Kodi HTTP credentials */}
      {step === 2 && (
        <div className="vt-devices__step-content">
          {detected && (
            <div className="vt-devices__detected-banner">
              <Check size={13} strokeWidth={2.5} />
              Configuração detectada via SSH — campos preenchidos automaticamente.
            </div>
          )}
          <Field label="Porta HTTP">
            <TextField type="number" value={form.kodiHttpPort} onChange={set("kodiHttpPort")} placeholder="8080" className="vt-devices__port-field" />
          </Field>
          <div className="vt-devices__form-row">
            <Field label="Usuário Kodi">
              <TextField value={form.kodiHttpUser} onChange={set("kodiHttpUser")} placeholder="kodi" />
            </Field>
            <Field label="Senha Kodi HTTP" hint={device?.hasKodiPassword ? "Deixe em branco para manter." : undefined}>
              <TextField
                type="password"
                value={form.kodiHttpPassword}
                onChange={set("kodiHttpPassword")}
                placeholder={device?.hasKodiPassword ? "•••• (salva no Keychain)" : "••••••"}
                autoComplete="new-password"
              />
            </Field>
          </div>
        </div>
      )}

      {/* Step 3: channel assignment */}
      {step === 3 && (
        <div className="vt-devices__step-content">
          <div className="vt-devices__form-row">
            <Field label="Canal Screenlet padrão" hint="Kodi reinicia ao atualizar este canal.">
              <SelectField value={form.defaultChannelId} onChange={set("defaultChannelId")}>
                <option value="">— Nenhum —</option>
                {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </SelectField>
            </Field>
            <Field label="Delay após reiniciar (s)" hint="Espera N s antes de abrir o canal.">
              <TextField type="number" value={form.restartDelaySecs} onChange={set("restartDelaySecs")} placeholder="20" />
            </Field>
          </div>
          <div className="vt-devices__kodi-channel-row">
            <Field label="ID do canal Kodi (PVR)">
              <TextField type="number" value={form.kodiChannelId} onChange={set("kodiChannelId")} placeholder="Ex: 1" />
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
            <Field label="Selecionar canal do Kodi">
              <SelectField value={form.kodiChannelId} onChange={set("kodiChannelId")}>
                <option value="">— Selecione —</option>
                {kodiChannels.map((ch) => (
                  <option key={ch.channelid} value={ch.channelid}>#{ch.channelid} — {ch.label}</option>
                ))}
              </SelectField>
            </Field>
          )}
        </div>
      )}
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
