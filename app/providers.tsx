"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FirstRunTerms } from "@/components/FirstRunTerms";
import { useThemeStore } from "@/store/useThemeStore";

/**
 * Client-side app bootstrap. Ported from the old `src/main.tsx`:
 * stamps the platform onto <html> so CSS can branch per OS, sets the Windows
 * native-controls width fallback, and applies the persisted theme. Theme
 * application lives in an effect (not a module-level side effect) so it never
 * runs during the static-export prerender.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const initTheme = useThemeStore((s) => s.initTheme);

  useEffect(() => {
    if (typeof window !== "undefined" && window.adFrame?.platform) {
      document.documentElement.dataset.platform = window.adFrame.platform;
      if (window.adFrame.platform === "win32") {
        document.documentElement.style.setProperty("--win-controls-w", "152px");
      }
    }
    initTheme();
  }, [initTheme]);

  return (
    <TooltipProvider delayDuration={200}>
      {children}
      <FirstRunTerms />
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  );
}
