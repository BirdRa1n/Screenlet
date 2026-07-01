"use client";

import { useEffect, useState } from "react";
import { Check, FolderOpen, FolderSearch, KeyRound, Monitor, Moon, Plug, Store, Sun } from "lucide-react";
import { Button, Checkbox, Dialog, SelectField, Field, TextField } from "../design-system/components";
import { PageContainer, PageHeader } from "../layout/PageShell";
import { cn } from "@/lib/utils";
import { useThemeStore, type Theme } from "../store/useThemeStore";
import { useAppSettingsStore, type VideoCodec, type VideoQuality } from "../store/useAppSettingsStore";
import { useIntegrationsStore } from "../store/useIntegrationsStore";
import { BackupSettings } from "../components/BackupSettings";
import { toast } from "../store/useToastStore";
import type { SystemInfo } from "../global";

type ThemeOption = {
  value: Theme;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "Claro", description: "Interface com fundo branco", icon: <Sun size={18} /> },
  { value: "dark", label: "Escuro", description: "Interface com fundo escuro", icon: <Moon size={18} /> },
  { value: "system", label: "Sistema", description: "Segue a preferência do sistema", icon: <Monitor size={18} /> },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export const Settings: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  const [currentDir, setCurrentDir] = useState<string>("");
  const [pendingDir, setPendingDir] = useState<string | null>(null);
  const [copyFiles, setCopyFiles] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const [isWindows, setIsWindows] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const {
    settings: appSettings,
    refresh: refreshAppSettings,
    setLaunchAtLogin,
    setAutoStartIptv,
    setVideoCodec,
    setVideoQuality,
    setHardwareAcceleration,
  } = useAppSettingsStore();

  useEffect(() => {
    if (!window.adFrame) return;
    const win = window.adFrame.platform === "win32";
    setIsWindows(win);
    window.adFrame.storageGetDir().then(setCurrentDir);
    window.adFrame.appGetVersion().then(setAppVersion);
    window.adFrame.systemInfoGet().then(setSystemInfo);
    refreshAppSettings();
  }, [refreshAppSettings]);

  const handleChooseDir = async () => {
    const chosen = await window.adFrame.storageChooseDir();
    if (!chosen) return;
    if (chosen === currentDir) {
      toast.info("Essa já é a pasta atual.");
      return;
    }
    setPendingDir(chosen);
    setCopyFiles(true);
  };

  const handleConfirm = async () => {
    if (!pendingDir) return;
    setMigrating(true);
    const result = await window.adFrame.storageMigrate(pendingDir, copyFiles);
    if (!result.success) {
      setMigrating(false);
      setPendingDir(null);
      toast.error(`Erro ao migrar: ${result.reason ?? "desconhecido"}`);
    }
    // On success the app relaunches — no need to handle the return.
  };

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Configurações" subtitle="Personalize o comportamento do aplicativo." />

      <Section title="Aparência" description="Escolha o tema da interface.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((opt) => {
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-accent/30",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {opt.icon}
                </span>
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.description}</span>
                {active && (
                  <span className="absolute right-3 top-3 text-primary">
                    <Check size={16} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {isWindows && (
        <Section
          title="Inicialização"
          description="Comportamento ao iniciar o Windows — útil para equipamentos de sinalização que ficam sempre ligados."
        >
          <div className="flex flex-col gap-3">
            <Checkbox
              checked={appSettings.launchAtLogin}
              onChange={setLaunchAtLogin}
              label="Iniciar o Screenlet junto com o Windows (minimizado, na bandeja do sistema)"
            />
            {appSettings.launchAtLogin && (
              <Checkbox
                checked={appSettings.autoStartIptvOnLaunch}
                onChange={setAutoStartIptv}
                label="Iniciar o servidor IPTV automaticamente"
              />
            )}
          </div>
        </Section>
      )}

      <Section
        title="Vídeo e Renderização"
        description="Codificação usada ao exportar vídeos. Mais qualidade gera arquivos maiores e renderiza mais lentamente."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Codec de vídeo">
            <SelectField
              value={appSettings.videoCodec}
              onChange={(e) => setVideoCodec(e.target.value as VideoCodec)}
            >
              <option value="h264">H.264 (compatibilidade)</option>
              <option value="h265">H.265 / HEVC (arquivos menores)</option>
            </SelectField>
          </Field>
          <Field label="Qualidade">
            <SelectField
              value={appSettings.videoQuality}
              onChange={(e) => setVideoQuality(e.target.value as VideoQuality)}
            >
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa (arquivo menor)</option>
            </SelectField>
          </Field>
        </div>
        <Checkbox
          checked={appSettings.hardwareAcceleration}
          onChange={setHardwareAcceleration}
          label="Usar aceleração de hardware quando disponível"
        />
      </Section>

      <Section
        title="Armazenamento"
        description="Pasta onde projetos, assets e configurações são salvos. Aponte para uma pasta sincronizada com iCloud Drive ou OneDrive para acesso em vários computadores."
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <FolderOpen size={15} className="shrink-0 text-muted-foreground" />
            <span className="truncate text-sm" title={currentDir}>
              {currentDir || "—"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<FolderSearch size={13} />} onClick={() => window.adFrame.storageOpenDir()}>
              Abrir no Finder
            </Button>
            <Button variant="secondary" size="sm" onClick={handleChooseDir}>
              Alterar localização
            </Button>
          </div>
        </div>
      </Section>

      <BackupSettings />

      <IntegrationsSection />

      <Section title="Informações da máquina" description="Dados do computador onde o Screenlet está rodando.">
        <dl className="flex flex-col divide-y divide-border text-sm">
          <Row k="Sistema" v={systemInfo ? `${systemInfo.platform} ${systemInfo.osRelease}` : "—"} />
          <Row k="Arquitetura" v={systemInfo?.arch ?? "—"} />
          <Row k="Nome do computador" v={systemInfo?.hostname ?? "—"} />
          <Row k="Processador" v={systemInfo ? `${systemInfo.cpuModel} (${systemInfo.cpuCores} núcleos)` : "—"} />
          <Row
            k="Memória"
            v={systemInfo ? `${systemInfo.freeRamGb} GB livres de ${systemInfo.totalRamGb} GB` : "—"}
          />
          <Row k="Renderizações simultâneas" v={systemInfo ? String(systemInfo.renderConcurrency) : "—"} />
          <Row
            k="Versões"
            v={
              systemInfo
                ? `Electron ${systemInfo.electronVersion} · Chrome ${systemInfo.chromeVersion} · Node ${systemInfo.nodeVersion}`
                : "—"
            }
          />
          <Row k="Pasta de dados" v={systemInfo?.screenletDir ?? "—"} />
        </dl>
      </Section>

      <Section title="Sobre">
        <dl className="flex flex-col divide-y divide-border text-sm">
          <Row k="Aplicativo" v="Screenlet" />
          <Row k="Versão" v={appVersion || "—"} />
          <Row k="Tecnologia" v="Electron · Next.js · Remotion" />
        </dl>
      </Section>

      <Dialog
        open={!!pendingDir}
        onClose={() => !migrating && setPendingDir(null)}
        title="Alterar pasta de armazenamento"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDir(null)} disabled={migrating}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={migrating}>
              {migrating ? "Migrando…" : "Confirmar e reiniciar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Pasta atual</span>
              <span className="break-all">{currentDir}</span>
            </div>
            <div className="text-center text-muted-foreground">↓</div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Nova pasta</span>
              <span className="break-all font-medium text-primary">{pendingDir}</span>
            </div>
          </div>

          <Checkbox checked={copyFiles} onChange={setCopyFiles} label="Copiar todos os arquivos para a nova pasta" />
          <p className="text-xs text-muted-foreground">
            {copyFiles
              ? "Projetos, assets e configurações serão copiados. A pasta original não será apagada."
              : "Apenas a localização será alterada. Use esta opção se os arquivos já estão na nova pasta (ex.: via sincronização de nuvem)."}
          </p>
        </div>
      </Dialog>
    </PageContainer>
  );
};

function IntegrationsSection() {
  const { config, refresh, setStockEasy } = useIntegrationsStore();
  const se = config.stockeasy;
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = async (enabled: boolean) => {
    await setStockEasy({ enabled });
  };

  const handleSaveKey = async () => {
    const key = apiKeyInput.trim();
    if (!key) return toast.error("Informe a chave de API.");
    setSaving(true);
    try {
      await setStockEasy({ apiKey: key, enabled: true });
      setApiKeyInput("");
      toast.success("Chave de API salva.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearKey = async () => {
    await setStockEasy({ apiKey: null });
    toast.info("Chave de API removida.");
  };

  const handleResetStore = async () => {
    await setStockEasy({ selectedStore: null });
    toast.info("Loja redefinida — você escolherá na próxima sincronização.");
  };

  return (
    <Section
      title="Integrações"
      description="Conecte um sistema externo (PDV/ERP) para sincronizar dados dos produtos da sua biblioteca."
    >
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Plug size={18} />
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">StockEasy</h3>
              {se.hasApiKey && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Check size={11} /> Conectado
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Busca preços e dados de produtos pela referência cadastrada.
            </p>
          </div>
          <Checkbox checked={se.enabled} onChange={handleToggle} label="" />
        </div>

        {se.enabled && (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <Field
              label="Chave de API (x-api-key)"
              hint={se.hasApiKey ? "Uma chave já está salva. Informe uma nova para substituí-la." : undefined}
            >
              <div className="flex gap-2">
                <TextField
                  type="password"
                  autoComplete="off"
                  placeholder={se.hasApiKey ? "••••••••••••" : "Cole a chave de API aqui"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
                <Button variant="primary" size="sm" icon={<KeyRound size={13} />} onClick={handleSaveKey} disabled={saving}>
                  {saving ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </Field>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Store size={14} />
                Loja de referência:{" "}
                <span className="font-medium text-foreground">{se.selectedStore || "ainda não escolhida"}</span>
              </span>
              {se.selectedStore && (
                <button className="text-xs font-medium text-primary hover:underline" onClick={handleResetStore}>
                  Trocar loja
                </button>
              )}
            </div>

            {se.hasApiKey && (
              <button className="w-fit text-xs font-medium text-destructive hover:underline" onClick={handleClearKey}>
                Remover chave de API
              </button>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
