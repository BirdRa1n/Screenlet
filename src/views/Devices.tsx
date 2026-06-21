"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Cast,
  Check,
  ChevronDown,
  ChevronUp,
  Link2,
  MonitorPlay,
  Pencil,
  Plus,
  RefreshCw,
  Terminal,
  Trash2,
  Tv2,
  Unlink2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button, Dialog, Field, IconButton, SelectField, TextField } from "../design-system/components";
import { PageContainer, PageHeader, EmptyState } from "../layout/PageShell";
import { cn } from "@/lib/utils";
import { useDeviceStore } from "../store/useDeviceStore";
import { usePlayerDeviceStore } from "../store/usePlayerDeviceStore";
import { useChannelStore } from "../store/useChannelStore";
import { toast } from "../store/useToastStore";
import type { KodiChannel, KodiDevice } from "../types/device";
import type { PlayerDevice } from "../types/playerDevice";

// ─── Tutorial ────────────────────────────────────────────────────────────────
const TUTORIAL_GROUPS = [
  {
    group: "Instalar o cliente IPTV",
    steps: [
      { title: "Instalar o add-on PVR IPTV Simple Client", text: 'No Kodi: Configurações → Add-ons → Instalar de repositório → Add-ons de clientes PVR → "PVR IPTV Simple Client" → Instalar. Depois habilite o add-on.' },
      { title: "Apontar para a playlist do Screenlet", text: 'Abra a configuração do add-on (aba "Geral") → em "Localização M3U" escolha Remoto (URL) e cole o endereço da página "Servidor IPTV" (ex: http://192.168.x.x:7095/playlist.m3u).' },
      { title: "Apontar para o guia de programação (opcional)", text: 'Na aba "EPG" → em "Localização XMLTV" escolha Remoto (URL) e cole a URL do epg.xml, também disponível na página "Servidor IPTV".' },
      { title: "Salvar e reiniciar o Kodi", text: 'Confirme a configuração do add-on e reinicie o Kodi. Os canais do Screenlet aparecerão em "TV ao vivo" no menu principal.' },
    ],
  },
  {
    group: "Habilitar controle remoto via HTTP",
    steps: [
      { title: "Ativar o servidor de controle", text: 'Configurações → Serviços → Controle → ative "Permitir controle remoto via HTTP".' },
      { title: "Definir porta e credenciais", text: "Defina a porta (padrão 8080), usuário e senha. Essas credenciais são o que o Screenlet usa para reiniciar o Kodi e trocar de canal remotamente." },
    ],
  },
];

const TutorialPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  let n = 0;
  return (
    <div className="rounded-xl border border-border bg-card">
      <button className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium" onClick={() => setOpen((v) => !v)}>
        <Terminal size={14} />
        <span>Como instalar o cliente IPTV e habilitar o controle HTTP</span>
        {open ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
      </button>
      {open && (
        <div className="flex flex-col gap-5 border-t border-border p-4">
          {TUTORIAL_GROUPS.map((g) => (
            <div key={g.group} className="flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</div>
              {g.steps.map((s) => {
                n += 1;
                return (
                  <div key={s.title} className="flex gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{n}</div>
                    <div>
                      <div className="text-sm font-medium">{s.title}</div>
                      <p className="text-sm text-muted-foreground">{s.text}</p>
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

// ─── Ping badge ────────────────────────────────────────────────────────────────
type PingState = "idle" | "loading" | "online" | "offline";

function PingBadge({ state }: { state: PingState }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        state === "online" && "bg-[color:var(--success)]/15 text-[color:var(--success)]",
        state === "offline" && "bg-destructive/15 text-destructive",
        (state === "idle" || state === "loading") && "bg-muted text-muted-foreground",
      )}
    >
      {state === "online" && <Wifi size={11} />}
      {state === "offline" && <WifiOff size={11} />}
      {state === "loading" && <RefreshCw size={11} className="animate-spin" />}
      {state === "idle" ? "—" : state === "loading" ? "Verificando" : state === "online" ? "Online" : "Offline"}
    </span>
  );
}

const cardCls = "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md";

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
    if (result.ok) toast.success(`Kodi reiniciado em ${device.name}. Canal será aberto em ${device.restartDelaySecs}s.`);
    else toast.error(`Falha ao reiniciar ${device.name}: ${result.error}`);
  };

  const handleDelete = async () => {
    await remove(device.id);
    toast.info(`"${device.name}" removido.`);
    onDeleted();
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <MonitorPlay size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{device.name}</div>
          <div className="truncate text-xs text-muted-foreground">{device.ip}:{device.sshPort}</div>
        </div>
        <PingBadge state={ping} />
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <Tv2 size={10} />
          {channelName ? `Canal: ${channelName}` : "Sem canal padrão"}
        </span>
        {device.kodiChannelId != null && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Kodi ID #{device.kodiChannelId}</span>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
        <Button variant="secondary" size="sm" icon={<RefreshCw size={12} />} onClick={handleRestart} disabled={restarting}>
          {restarting ? "Reiniciando…" : "Reiniciar Kodi"}
        </Button>
        <Button variant="secondary" size="sm" icon={<Wifi size={12} />} onClick={handlePing} disabled={ping === "loading"}>
          Testar
        </Button>
        <div className="ml-auto flex gap-1">
          <IconButton label="Editar" onClick={onEdit}>
            <Pencil size={13} />
          </IconButton>
          <IconButton label="Excluir" variant="danger" onClick={handleDelete}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>
    </div>
  );
};

// ─── Form wizard ──────────────────────────────────────────────────────────────
type FormState = {
  name: string; ip: string; sshPort: string; sshUser: string; sshPassword: string;
  kodiHttpPort: string; kodiHttpUser: string; kodiHttpPassword: string;
  defaultChannelId: string; kodiChannelId: string; restartDelaySecs: string;
};

const EMPTY_FORM: FormState = {
  name: "", ip: "", sshPort: "22", sshUser: "", sshPassword: "",
  kodiHttpPort: "8080", kodiHttpUser: "kodi", kodiHttpPassword: "",
  defaultChannelId: "", kodiChannelId: "", restartDelaySecs: "20",
};

function deviceToForm(d: KodiDevice): FormState {
  return {
    name: d.name, ip: d.ip, sshPort: String(d.sshPort), sshUser: d.sshUser, sshPassword: "",
    kodiHttpPort: String(d.kodiHttpPort), kodiHttpUser: d.kodiHttpUser, kodiHttpPassword: "",
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

  const sshCredsReady = !!(form.ip.trim() && form.sshUser.trim() && (form.sshPassword.trim() || device?.hasSshPassword));
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
    setForm((prev) => ({ ...prev, kodiHttpPort: String(result.port), kodiHttpUser: result.user, kodiHttpPassword: result.password }));
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
    if (result.length === 0) toast.error("Nenhum canal encontrado. Verifique as credenciais do Kodi.");
    else setKodiChannels(result);
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
        <div className="flex w-full justify-between">
          {step > 1 ? (
            <Button variant="secondary" onClick={goBack} disabled={saving}>Voltar</Button>
          ) : (
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          )}
          {step < 3 ? (
            <Button variant="primary" onClick={goNext} disabled={step === 1 && !step1Valid}>Continuar</Button>
          ) : (
            <Button variant="primary" onClick={handleSave} disabled={saving || !step1Valid}>{saving ? "Salvando…" : "Salvar"}</Button>
          )}
        </div>
      }
    >
      {/* Step indicator */}
      <div className="mb-5 flex items-center justify-center gap-2">
        {WIZARD_STEPS.map((s, i) => {
          const done = step > s.num;
          const active = step === s.num;
          return (
            <Fragment key={s.num}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                    active && "bg-primary text-primary-foreground",
                    done && "bg-[color:var(--success)] text-white",
                    !active && !done && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : s.num}
                </div>
                <div className={cn("text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>{s.label}</div>
              </div>
              {i < WIZARD_STEPS.length - 1 && <div className="h-px w-10 bg-border" />}
            </Fragment>
          );
        })}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Field label="Nome do dispositivo">
            <TextField value={form.name} onChange={set("name")} placeholder="TV Recepção" autoFocus />
          </Field>
          <div className="grid grid-cols-[1fr_100px] gap-4">
            <Field label="Endereço IP">
              <TextField value={form.ip} onChange={set("ip")} placeholder="192.168.1.100" />
            </Field>
            <Field label="Porta SSH">
              <TextField type="number" value={form.sshPort} onChange={set("sshPort")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Usuário SSH">
              <TextField value={form.sshUser} onChange={set("sshUser")} placeholder="root" />
            </Field>
            <Field label="Senha SSH" hint={device?.hasSshPassword ? "Deixe em branco para manter." : undefined}>
              <TextField type="password" value={form.sshPassword} onChange={set("sshPassword")} placeholder={device?.hasSshPassword ? "•••• (salva no Keychain)" : "••••••"} autoComplete="new-password" />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" icon={<Terminal size={12} className={fetchingConfig ? "animate-spin" : undefined} />} onClick={handleFetchKodiConfig} disabled={fetchingConfig || !sshCredsReady}>
              {fetchingConfig ? "Conectando…" : "Ler configuração Kodi via SSH"}
            </Button>
            <span className="text-xs text-muted-foreground">Preenche a etapa 2 automaticamente</span>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          {detected && (
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 p-2.5 text-sm text-[color:var(--success)]">
              <Check size={13} strokeWidth={2.5} />
              Configuração detectada via SSH — campos preenchidos automaticamente.
            </div>
          )}
          <Field label="Porta HTTP">
            <TextField type="number" value={form.kodiHttpPort} onChange={set("kodiHttpPort")} placeholder="8080" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Usuário Kodi">
              <TextField value={form.kodiHttpUser} onChange={set("kodiHttpUser")} placeholder="kodi" />
            </Field>
            <Field label="Senha Kodi HTTP" hint={device?.hasKodiPassword ? "Deixe em branco para manter." : undefined}>
              <TextField type="password" value={form.kodiHttpPassword} onChange={set("kodiHttpPassword")} placeholder={device?.hasKodiPassword ? "•••• (salva no Keychain)" : "••••••"} autoComplete="new-password" />
            </Field>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
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
          <div className="flex items-end gap-2">
            <Field label="ID do canal Kodi (PVR)">
              <TextField type="number" value={form.kodiChannelId} onChange={set("kodiChannelId")} placeholder="Ex: 1" />
            </Field>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={12} />} onClick={handleFetchKodiChannels} disabled={fetchingChannels || !form.ip.trim()}>
              {fetchingChannels ? "Buscando…" : "Buscar canais"}
            </Button>
          </div>
          {kodiChannels.length > 0 && (
            <Field label="Selecionar canal do Kodi">
              <SelectField value={form.kodiChannelId} onChange={set("kodiChannelId")}>
                <option value="">— Selecione —</option>
                {kodiChannels.map((ch) => <option key={ch.channelid} value={ch.channelid}>#{ch.channelid} — {ch.label}</option>)}
              </SelectField>
            </Field>
          )}
        </div>
      )}
    </Dialog>
  );
};

// ─── Screenlet Player devices ──────────────────────────────────────────────────
const PLAYER_ONLINE_THRESHOLD_MS = 60_000;

function isPlayerOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < PLAYER_ONLINE_THRESHOLD_MS;
}

const PlayerDeviceCard: React.FC<{ device: PlayerDevice; channelName: string | null }> = ({ device, channelName }) => {
  const { unpair, remove } = usePlayerDeviceStore();
  const online = isPlayerOnline(device.lastSeenAt);

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Cast size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{device.name}</div>
          <div className="truncate text-xs text-muted-foreground">{device.hostname || "—"} · v{device.playerVersion || "?"}</div>
        </div>
        <PingBadge state={online ? "online" : "offline"} />
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <Tv2 size={10} />
          {channelName ? `Canal: ${channelName}` : "Sem canal"}
        </span>
        {device.playing && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Reproduzindo</span>}
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
        <Button variant="secondary" size="sm" icon={<Unlink2 size={12} />} onClick={async () => { await unpair(device.id); toast.info(`"${device.name}" despareado.`); }}>
          Despareie
        </Button>
        <div className="ml-auto">
          <IconButton label="Excluir" variant="danger" onClick={async () => { await remove(device.id); toast.info(`"${device.name}" removido.`); }}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>
    </div>
  );
};

const PendingPlayerRow: React.FC<{ device: PlayerDevice; onClaim: () => void }> = ({ device, onClaim }) => {
  const { remove } = usePlayerDeviceStore();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Cast size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{device.hostname || device.deviceId.slice(0, 8)}</div>
        <div className="truncate text-xs text-muted-foreground">código {device.pairingCode || "—"} · v{device.playerVersion || "?"}</div>
      </div>
      <Button variant="primary" size="sm" icon={<Link2 size={12} />} onClick={onClaim}>
        Pareie
      </Button>
      <IconButton label="Ignorar" variant="danger" onClick={() => remove(device.id)}>
        <Trash2 size={13} />
      </IconButton>
    </div>
  );
};

const ClaimDialog: React.FC<{ device: PlayerDevice | null; onClose: () => void; onClaimed: () => void }> = ({ device, onClose, onClaimed }) => {
  const { claim } = usePlayerDeviceStore();
  const { channels } = useChannelStore();
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (device) {
      setName(device.name);
      setChannelId("");
    }
  }, [device]);

  const handleClaim = async () => {
    if (!device || !channelId) return;
    setSaving(true);
    try {
      await claim(device.id, channelId, name.trim() || undefined);
      toast.success(`"${name.trim() || device.hostname}" pareado.`);
      onClaimed();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao parear dispositivo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!device}
      onClose={onClose}
      title="Parear Screenlet Player"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleClaim} disabled={saving || !channelId}>{saving ? "Pareando…" : "Parear"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nome de exibição">
          <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder={device?.hostname} />
        </Field>
        <Field label="Canal Screenlet">
          <SelectField value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">— Selecione um canal —</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
        </Field>
      </div>
    </Dialog>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export const Devices: React.FC = () => {
  const { devices, refresh } = useDeviceStore();
  const { devices: playerDevices, refresh: refreshPlayerDevices, scan: scanPlayers, scanning } = usePlayerDeviceStore();
  const { channels, refresh: refreshChannels } = useChannelStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<KodiDevice | null>(null);
  const [claimTarget, setClaimTarget] = useState<PlayerDevice | null>(null);

  const loadAll = useCallback(async () => {
    await Promise.all([refresh(), refreshChannels(), refreshPlayerDevices()]);
  }, [refresh, refreshChannels, refreshPlayerDevices]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const id = setInterval(refreshPlayerDevices, 5_000);
    return () => clearInterval(id);
  }, [refreshPlayerDevices]);

  const channelName = (id: string | null) => (id ? channels.find((c) => c.id === id)?.name ?? null : null);

  const pendingPlayers = playerDevices.filter((d) => !d.paired);
  const pairedPlayers = playerDevices.filter((d) => d.paired);

  return (
    <PageContainer>
      <PageHeader
        title="Dispositivos"
        subtitle="Gerencie TVs Kodi e Screenlet Player da rede."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
            Novo dispositivo
          </Button>
        }
      />

      <TutorialPanel />

      {devices.length === 0 ? (
        <EmptyState
          icon={<MonitorPlay size={22} />}
          title="Nenhum dispositivo cadastrado"
          text="Cadastre TVs ou players Kodi para controlar a reprodução remotamente."
          action={
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
              Adicionar dispositivo
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((d) => (
            <DeviceCard key={d.id} device={d} channelName={channelName(d.defaultChannelId)} onEdit={() => setEditDevice(d)} onDeleted={refresh} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Cast size={16} /> Screenlet Player
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Cliente nativo (sem Kodi, sem SSH) — dispositivos já pareados reaparecem sozinhos ao ligar; para parear um dispositivo novo, clique em "Procurar na rede".
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={12} className={scanning ? "animate-spin" : undefined} />} onClick={() => scanPlayers()} disabled={scanning}>
          {scanning ? "Procurando…" : "Procurar na rede"}
        </Button>
      </div>

      {pendingPlayers.length > 0 && (
        <div className="flex flex-col gap-2">
          {pendingPlayers.map((d) => (
            <PendingPlayerRow key={d.id} device={d} onClaim={() => setClaimTarget(d)} />
          ))}
        </div>
      )}

      {pairedPlayers.length === 0 && pendingPlayers.length === 0 ? (
        <EmptyState
          icon={<Cast size={22} />}
          title="Nenhum Screenlet Player detectado"
          text="Instale e inicie o screenlet-player no dispositivo. Depois clique em 'Procurar na rede' para encontrá-lo e parear. Uma vez pareado, ele reaparece aqui sozinho."
        />
      ) : pairedPlayers.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pairedPlayers.map((d) => (
            <PlayerDeviceCard key={d.id} device={d} channelName={channelName(d.channelId)} />
          ))}
        </div>
      ) : null}

      <DeviceDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} />
      <DeviceDialog open={!!editDevice} device={editDevice ?? undefined} onClose={() => setEditDevice(null)} onSaved={refresh} />
      <ClaimDialog device={claimTarget} onClose={() => setClaimTarget(null)} onClaimed={refreshPlayerDevices} />
    </PageContainer>
  );
};
