import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Screenlet",
  description: "Sinalização digital — crie, renderize e transmita anúncios.",
};

// Applies the persisted theme class before the first paint so the app never
// flashes the wrong theme on launch (the store's initTheme runs later, in an
// effect). Mirrors readStoredTheme()/getSystemTheme() in useThemeStore.
const THEME_INIT = `
try {
  var t = localStorage.getItem('vitrinetv-theme');
  var dark = t === 'dark' || ((!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
