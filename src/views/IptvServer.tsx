"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Check, Copy, Film, List, Radio, Tv2 } from "lucide-react";
import { Button, Field, SelectField } from "../design-system/components";
import { PageContainer, PageHeader } from "../layout/PageShell";
import { cn } from "@/lib/utils";
import { useChannelStore } from "../store/useChannelStore";
import { useIptvStore } from "../store/useIptvStore";
import { getCurrentAsset } from "../lib/programmingEngine";
import { toast } from "../store/useToastStore";
import type { Channel } from "../types/channel";

export const IptvServer: React.FC = () => {
  const { channels, refresh: refreshChannels } = useChannelStore();
  const { status, refresh: refreshStatus, start, stop, setIp } = useIptvStore();
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    refreshChannels();
    refreshStatus();
  }, [refreshChannels, refreshStatus]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const activeChannels = channels.filter((c) => c.enabled).length;
  const playlistChannels = channels.filter((c) => c.playlist?.length > 0).length;
  const channelsWithRules = channels.filter((c) => (c.rules?.length ?? 0) > 0).length;
  const primaryIp = status.selectedIp;
  const m3uUrl = `http://${primaryIp}:${status.port}/playlist.m3u`;
  const epgUrl = `http://${primaryIp}:${status.port}/epg.xml`;

  const ipLabel = (ip: string) => {
    if (/^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip))
      return `${ip}  (rede local)`;
    if (/^100\./.test(ip)) return `${ip}  (Tailscale/VPN)`;
    return ip;
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      if (status.running) {
        await stop();
        toast.info("Servidor IPTV parado.");
      } else {
        await start();
        toast.success("Servidor IPTV iniciado.");
      }
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setToggling(false);
    }
  };

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Servidor IPTV"
        subtitle="Disponibilize a programação para Smart TVs na rede local."
        actions={
          <span
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
              status.running
                ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                status.running ? "bg-[color:var(--success)]" : "bg-muted-foreground/50",
              )}
            />
            {status.running ? "Rodando" : "Parado"}
          </span>
        }
      />

      {/* Server control */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-xl",
            status.running
              ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Radio size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            {status.running ? `Ouvindo na porta ${status.port}` : "Servidor inativo"}
          </div>
          {status.running && status.ips.length > 0 && (
            <div className="truncate text-sm text-muted-foreground">
              {status.ips.map((ip) => `${ip}:${status.port}`).join("  ·  ")}
            </div>
          )}
        </div>
        <Button variant={status.running ? "secondary" : "primary"} onClick={handleToggle} disabled={toggling}>
          {toggling ? "Aguarde…" : status.running ? "Parar servidor" : "Iniciar servidor"}
        </Button>
      </div>

      {status.ips.length > 0 && (
        <div className="max-w-md">
          <Field label="Interface de rede">
            <SelectField value={primaryIp} onChange={(e) => setIp(e.target.value)}>
              {status.ips.map((ip) => (
                <option key={ip} value={ip}>
                  {ipLabel(ip)}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>
      )}

      {!status.ffmpegAvailable && playlistChannels > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[color:var(--warning)]" />
          <span>
            {playlistChannels} {playlistChannels === 1 ? "canal usa" : "canais usam"} playlist, mas o{" "}
            <strong>ffmpeg</strong> não foi encontrado no sistema. O loop funciona melhor com ffmpeg
            instalado — sem ele, o stream é servido uma vez por conexão. Instale via{" "}
            <code className="rounded bg-muted px-1">brew install ffmpeg</code>.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Tv2 size={18} />} label="Canais ativos" value={activeChannels} />
        <StatCard icon={<Tv2 size={18} />} label="Total de canais" value={channels.length} />
        <StatCard icon={<List size={18} />} label="Com playlist" value={playlistChannels} />
        <StatCard icon={<CalendarClock size={18} />} label="Com programação" value={channelsWithRules} />
      </div>

      {channels.length > 0 && <ProgrammingStatus channels={channels} now={now} />}

      {/* Endpoints */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <div className="text-sm font-semibold">Endpoints</div>
        <Endpoint icon={<List size={16} />} name="Playlist M3U" url={m3uUrl} running={status.running} />
        <Endpoint icon={<CalendarClock size={16} />} name="Guia de programação EPG" url={epgUrl} running={status.running} />
        <Endpoint
          icon={<Radio size={16} />}
          name="Stream de canal"
          url={`http://${primaryIp}:${status.port}/channel/<id>`}
          running={status.running}
        />
      </div>

      {status.running && (
        <div className="flex flex-col gap-2">
          <CopyRow label="M3U" value={m3uUrl} copied={copied === "m3u"} onCopy={() => handleCopy(m3uUrl, "m3u")} />
          <CopyRow label="EPG" value={epgUrl} copied={copied === "epg"} onCopy={() => handleCopy(epgUrl, "epg")} />
        </div>
      )}
    </PageContainer>
  );
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Endpoint({
  icon,
  name,
  url,
  running,
}: {
  icon: React.ReactNode;
  name: string;
  url: string;
  running: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="truncate font-mono text-xs text-muted-foreground">{url}</div>
      </div>
      <span
        className={cn(
          "shrink-0 text-xs font-medium",
          running ? "text-[color:var(--success)]" : "text-muted-foreground",
        )}
      >
        {running ? "Disponível" : "Indisponível"}
      </span>
    </div>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <span className="w-10 text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{value}</span>
      <button
        className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent"
        onClick={onCopy}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

const ProgrammingStatus: React.FC<{ channels: Channel[]; now: Date }> = ({ channels, now }) => {
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <CalendarClock size={16} className="text-muted-foreground" />
        <span className="text-sm font-semibold">Programação agora</span>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">{timeStr}</span>
      </div>
      <div className="flex flex-col divide-y divide-border">
        {channels.map((ch) => {
          const asset = getCurrentAsset(ch, now);
          const fromRule = asset != null && (ch.rules ?? []).some((r) => r.assetFilename === asset);
          const assetName = fromRule
            ? ch.rules!.find((r) => r.assetFilename === asset)?.assetName ?? asset
            : ch.playlist.find((p) => p.filename === asset)?.name ?? asset ?? "—";

          return (
            <div key={ch.id} className="flex items-center gap-3 py-2">
              <div
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  ch.enabled ? "bg-[color:var(--success)]" : "bg-muted-foreground/40",
                )}
              />
              <span className="text-sm font-medium">{ch.name}</span>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <Film size={11} />
                <span>{assetName ?? "Sem playlist"}</span>
              </div>
              {fromRule && (
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  Regra
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
