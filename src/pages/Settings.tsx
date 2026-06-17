import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore, type Theme } from "../store/useThemeStore";
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

        {/* Sobre */}
        <section className="vt-settings__section">
          <h2 className="vt-settings__section-title">Sobre</h2>
          <div className="vt-settings__about">
            <div className="vt-settings__about-row">
              <span className="vt-settings__about-key">Aplicativo</span>
              <span className="vt-settings__about-val">AdFrame</span>
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
    </div>
  );
};
