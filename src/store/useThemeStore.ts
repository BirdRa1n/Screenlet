import { create } from "zustand";

export type Theme = "dark" | "light" | "system";

const STORAGE_KEY = "vitrinetv-theme";

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system")
    return stored;
  return "system";
}

// Applies the theme by toggling the `.dark` class on <html> (shadcn convention),
// persists the choice, and syncs the Windows native titlebar overlay color.
function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
  window.adFrame?.setTitleBarTheme?.(resolved === "dark");
}

let listenerAttached = false;

type ThemeStore = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Client-only bootstrap — called once from app/providers.tsx. */
  initTheme: () => void;
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: "system",
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  initTheme: () => {
    const theme = readStoredTheme();
    applyTheme(theme);
    set({ theme });
    if (!listenerAttached && typeof window !== "undefined") {
      listenerAttached = true;
      window
        .matchMedia?.("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
          if (get().theme === "system") applyTheme("system");
        });
    }
  },
}));
