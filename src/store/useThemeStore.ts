import { create } from "zustand";

export type Theme = "dark" | "light" | "system";

const STORAGE_KEY = "vitrinetv-theme";

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "system";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.setAttribute("data-theme", resolved);
  localStorage.setItem(STORAGE_KEY, theme);
  window.adFrame?.setTitleBarTheme?.(resolved === "dark");
}

type ThemeStore = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initial = getInitialTheme();
applyTheme(initial);

// Listen for OS preference changes when theme is "system"
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme;
  if (stored === "system") applyTheme("system");
});

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
