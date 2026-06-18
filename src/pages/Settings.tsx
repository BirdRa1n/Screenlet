import React, { useEffect, useState } from "react";
import { FolderOpen, FolderSearch, Monitor, Moon, Sun } from "lucide-react";
import { Button, Checkbox, Dialog } from "../design-system/components";
import { useThemeStore, type Theme } from "../store/useThemeStore";
import { toast } from "../store/useToastStore";
import "../styles/pages/Settings.css";

type ThemeOption = { value: Theme; label: string; description: string; icon: React.ReactNode };

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Claro",
    description: "Interface com fundo branco",
    icon: <Sun size={18} />,
  },
  {
    value: "dark",
    label: "Escuro",
    description: "Interface com fundo escuro",
    icon: <Moon size={18} />,
  },
  {
    value: "system",
    label: "Sistema",
    description: "Segue a preferência do macOS",
    icon: <Monitor size={18} />,
  },
];

export const Settings: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  const [currentDir, setCurrentDir] = useState<string>("");
  const [pendingDir, setPendingDir] = useState<string | null>(null);
  const [copyFiles, setCopyFiles] = useState(true);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    window.adFrame.storageGetDir().then(setCurrentDir);
  }, []);

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
    // On success the app relaunches — no need to handle the return
  };

  return (
    <div className="vt-settings">
      <div className="vt-settings__header">
        <h1 className="vt-settings__title">Configurações</h1>
        <p className="vt-settings__subtitle">Personalize o comportamento do aplicativo.</p>
      </div>

      <div className="vt-settings__body">

        {/* Aparência */}
        <section className="vt-settings__section">
          <h2 className="vt-settings__section-title">Aparência</h2>
          <p className="vt-settings__section-desc">Escolha o tema da interface.</p>
          <div className="vt-settings__theme-grid">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={[
                  "vt-settings__theme-card",
                  theme === opt.value ? "vt-settings__theme-card--active" : "",
                ].join(" ")}
                onClick={() => setTheme(opt.value)}
              >
                <span className="vt-settings__theme-icon">{opt.icon}</span>
                <span className="vt-settings__theme-label">{opt.label}</span>
                <span className="vt-settings__theme-desc">{opt.description}</span>
                {theme === opt.value && <span className="vt-settings__theme-check">✓</span>}
              </button>
            ))}
          </div>
        </section>

        {/* Armazenamento */}
        <section className="vt-settings__section">
          <h2 className="vt-settings__section-title">Armazenamento</h2>
          <p className="vt-settings__section-desc">
            Pasta onde projetos, assets e configurações são salvos. Aponte para uma pasta sincronizada
            com iCloud Drive ou OneDrive para acesso em vários computadores.
          </p>

          <div className="vt-settings__storage">
            <div className="vt-settings__storage-path">
              <FolderOpen size={15} className="vt-settings__storage-icon" />
              <span className="vt-settings__storage-path-text" title={currentDir}>
                {currentDir || "—"}
              </span>
            </div>
            <div className="vt-settings__storage-actions">
              <Button variant="secondary" size="sm" icon={<FolderSearch size={13} />} onClick={() => window.adFrame.storageOpenDir()}>
                Abrir no Finder
              </Button>
              <Button variant="secondary" size="sm" onClick={handleChooseDir}>
                Alterar localização
              </Button>
            </div>
          </div>
        </section>

        {/* Sobre */}
        <section className="vt-settings__section">
          <h2 className="vt-settings__section-title">Sobre</h2>
          <div className="vt-settings__about">
            <div className="vt-settings__about-row">
              <span className="vt-settings__about-key">Aplicativo</span>
              <span className="vt-settings__about-val">Screenlet</span>
            </div>
            <div className="vt-settings__about-row">
              <span className="vt-settings__about-key">Versão</span>
              <span className="vt-settings__about-val">1.0.0</span>
            </div>
            <div className="vt-settings__about-row">
              <span className="vt-settings__about-key">Tecnologia</span>
              <span className="vt-settings__about-val">Electron · React · Remotion</span>
            </div>
          </div>
        </section>

      </div>

      {/* Dialog de confirmação de migração */}
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
        <div className="vt-settings__migrate-body">
          <div className="vt-settings__migrate-paths">
            <div className="vt-settings__migrate-path-row">
              <span className="vt-settings__migrate-label">Pasta atual</span>
              <span className="vt-settings__migrate-value">{currentDir}</span>
            </div>
            <div className="vt-settings__migrate-arrow">↓</div>
            <div className="vt-settings__migrate-path-row vt-settings__migrate-path-row--new">
              <span className="vt-settings__migrate-label">Nova pasta</span>
              <span className="vt-settings__migrate-value">{pendingDir}</span>
            </div>
          </div>

          <Checkbox
            checked={copyFiles}
            onChange={setCopyFiles}
            label="Copiar todos os arquivos para a nova pasta"
          />
          <p className="vt-settings__migrate-hint">
            {copyFiles
              ? "Projetos, assets e configurações serão copiados. A pasta original não será apagada."
              : "Apenas a localização será alterada. Use esta opção se os arquivos já estão na nova pasta (ex.: via sincronização de nuvem)."}
          </p>
        </div>
      </Dialog>
    </div>
  );
};
