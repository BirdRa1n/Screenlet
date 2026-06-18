import React, { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Check, Copy, List, Radio, Tv2 } from "lucide-react";
import { Button, Field, SelectField } from "../design-system/components";
import { useChannelStore } from "../store/useChannelStore";
import { useIptvStore } from "../store/useIptvStore";
import { toast } from "../store/useToastStore";
import "../styles/pages/IptvServer.css";

export const IptvServer: React.FC = () => {
  const { channels, refresh: refreshChannels } = useChannelStore();
  const { status, refresh: refreshStatus, start, stop, setIp } = useIptvStore();
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    refreshChannels();
    refreshStatus();
  }, [refreshChannels, refreshStatus]);

  const activeChannels = channels.filter((c) => c.enabled).length;
  const playlistChannels = channels.filter((c) => c.playlist?.length > 0).length;
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
    <div className="vt-iptv">
      <div className="vt-iptv__header">
        <div>
          <h1 className="vt-iptv__title">Servidor IPTV</h1>
          <p className="vt-iptv__sub">Disponibilize a programação para Smart TVs na rede local.</p>
        </div>
        <div className={`vt-iptv__badge ${status.running ? "vt-iptv__badge--on" : ""}`}>
          <span className="vt-iptv__badge-dot" />
          {status.running ? "Rodando" : "Parado"}
        </div>
      </div>

      {/* Server control */}
      <div className="vt-iptv__server-panel">
        <div className={`vt-iptv__server-indicator ${status.running ? "vt-iptv__server-indicator--on" : "vt-iptv__server-indicator--off"}`}>
          <Radio size={20} />
        </div>
        <div className="vt-iptv__server-info">
          <div className="vt-iptv__server-status">
            {status.running ? `Ouvindo na porta ${status.port}` : "Servidor inativo"}
          </div>
          {status.running && status.ips.length > 0 && (
            <div className="vt-iptv__server-address">
              {status.ips.map((ip) => `${ip}:${status.port}`).join("  ·  ")}
            </div>
          )}
        </div>
        <Button
          variant={status.running ? "secondary" : "primary"}
          onClick={handleToggle}
          disabled={toggling}
        >
          {toggling ? "Aguarde…" : status.running ? "Parar servidor" : "Iniciar servidor"}
        </Button>
      </div>

      {/* Network interface selector */}
      {status.ips.length > 0 && (
        <div className="vt-iptv__iface-row">
          <Field label="Interface de rede">
            <SelectField
              value={primaryIp}
              onChange={(e) => setIp(e.target.value)}
            >
              {status.ips.map((ip) => (
                <option key={ip} value={ip}>{ipLabel(ip)}</option>
              ))}
            </SelectField>
          </Field>
        </div>
      )}

      {/* ffmpeg warning */}
      {!status.ffmpegAvailable && playlistChannels > 0 && (
        <div className="vt-iptv__warning">
          <AlertTriangle size={16} />
          <span>
            {playlistChannels} {playlistChannels === 1 ? "canal usa" : "canais usam"} playlist, mas o <strong>ffmpeg</strong> não foi encontrado no sistema.
            O loop funciona melhor com ffmpeg instalado — sem ele, o stream é servido uma vez por conexão.
            Instale via <code>brew install ffmpeg</code>.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="vt-iptv__stats">
        <div className="vt-iptv__stat-card">
          <div className="vt-iptv__stat-icon"><Tv2 size={18} /></div>
          <div className="vt-iptv__stat-label">Canais ativos</div>
          <div className="vt-iptv__stat-value">{activeChannels}</div>
        </div>
        <div className="vt-iptv__stat-card">
          <div className="vt-iptv__stat-icon"><Tv2 size={18} /></div>
          <div className="vt-iptv__stat-label">Total de canais</div>
          <div className="vt-iptv__stat-value">{channels.length}</div>
        </div>
        <div className="vt-iptv__stat-card">
          <div className="vt-iptv__stat-icon"><Tv2 size={18} /></div>
          <div className="vt-iptv__stat-label">Com playlist</div>
          <div className="vt-iptv__stat-value">{playlistChannels}</div>
        </div>
      </div>

      {/* Endpoints */}
      <div className="vt-iptv__endpoints">
        <div className="vt-iptv__endpoints-title">Endpoints</div>

        <div className="vt-iptv__endpoint-card">
          <div className="vt-iptv__endpoint-icon"><List size={16} /></div>
          <div className="vt-iptv__endpoint-info">
            <div className="vt-iptv__endpoint-name">Playlist M3U</div>
            <div className="vt-iptv__endpoint-url">{m3uUrl}</div>
          </div>
          <div className={`vt-iptv__endpoint-status ${status.running ? "vt-iptv__endpoint-status--on" : ""}`}>
            {status.running ? "Disponível" : "Indisponível"}
          </div>
        </div>

        <div className="vt-iptv__endpoint-card">
          <div className="vt-iptv__endpoint-icon"><CalendarClock size={16} /></div>
          <div className="vt-iptv__endpoint-info">
            <div className="vt-iptv__endpoint-name">Guia de programação EPG</div>
            <div className="vt-iptv__endpoint-url">{epgUrl}</div>
          </div>
          <div className={`vt-iptv__endpoint-status ${status.running ? "vt-iptv__endpoint-status--on" : ""}`}>
            {status.running ? "Disponível" : "Indisponível"}
          </div>
        </div>

        <div className="vt-iptv__endpoint-card">
          <div className="vt-iptv__endpoint-icon"><Radio size={16} /></div>
          <div className="vt-iptv__endpoint-info">
            <div className="vt-iptv__endpoint-name">Stream de canal</div>
            <div className="vt-iptv__endpoint-url">
              {`http://${primaryIp}:${status.port}/channel/<id>`}
            </div>
          </div>
          <div className={`vt-iptv__endpoint-status ${status.running ? "vt-iptv__endpoint-status--on" : ""}`}>
            {status.running ? "Disponível" : "Indisponível"}
          </div>
        </div>
      </div>

      {/* M3U URL copy — only when running */}
      {status.running && (
        <>
          <div className="vt-iptv__url-row">
            <span className="vt-iptv__url-label">M3U</span>
            <span className="vt-iptv__url-value">{m3uUrl}</span>
            <button className="vt-iptv__copy-btn" onClick={() => handleCopy(m3uUrl, "m3u")}>
              {copied === "m3u" ? <Check size={12} /> : <Copy size={12} />}
              {copied === "m3u" ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="vt-iptv__url-row">
            <span className="vt-iptv__url-label">EPG</span>
            <span className="vt-iptv__url-value">{epgUrl}</span>
            <button className="vt-iptv__copy-btn" onClick={() => handleCopy(epgUrl, "epg")}>
              {copied === "epg" ? <Check size={12} /> : <Copy size={12} />}
              {copied === "epg" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
