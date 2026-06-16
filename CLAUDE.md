# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev: Vite only (browser at localhost:5173)
npm run dev

# Dev: Electron app (recommended — starts Vite then Electron)
npm run electron:dev

# Production build
npm run build

# Type check
npx tsc -b

# Lint
npm run lint
```

## Architecture

VitrineTV is an Electron desktop app for creating video ads (for TV displays in supermarkets). It combines a Vite+React UI with Remotion for video rendering and export.

### Process model
- **`electron/main.cjs`** — Electron main process (CommonJS). Handles file dialogs (`selectImage`), copies uploads to `public/uploads/`, and runs Remotion's `bundle()` + `renderMedia()` for MP4 export. Public dir is explicitly set: `publicDir: path.join(process.cwd(), "public")`.
- **`electron/preload.cjs`** — Exposes `window.vitrineTV` via `contextBridge`: `{ selectImage, exportVideo, onExportProgress }`.
- **`src/`** — React renderer process (ESM, Vite).

### State
- **`src/store/useAdStore.ts`** — Zustand store for the full ad config (list of scenes + selected scene ID). Key actions: `addProductScene`, `addLogoScene`, `updateScene`, `moveScene`, `removeScene`, `setLogoImage`.
- **`src/store/useThemeStore.ts`** — Dark/light theme. Reads system preference on first run, persists to `localStorage`. Applies `data-theme` attribute on `<html>`.

### Design system
- **`src/design-system/tokens.css`** — Single source of truth for all CSS custom properties. Theme-sensitive tokens (backgrounds, text, borders, `--input-bg`) are split between `:root[data-theme="dark"]` and `:root[data-theme="light"]` blocks. Import this file first in `src/main.tsx`.
- **`src/design-system/components/`** — `Button`, `IconButton`, `Field`/`TextField`/`SelectField`/`ColorField`/`Checkbox`, `Card`, `ProgressBar`. All use token-based CSS. Never hardcode neutral color values (e.g. `var(--neutral-950)`) in component CSS — use semantic tokens like `--input-bg` so themes work.

### Layout
Three-panel layout in `src/layout/`:
- `SceneListPanel` (left, 300px) — logo upload + scene list with reorder/delete
- `PreviewPanel` (center, flex:1) — Remotion `<Player>` at 16:9
- `InspectorPanel` (right, 320px) — scene-specific fields, animates between scenes with Framer Motion `AnimatePresence`

### Remotion / video
- **`src/remotion/types.ts`** — `ProductSceneConfig` and `LogoSceneConfig` types + factory defaults.
- **`src/remotion/DynamicAd.tsx`** — Root composition; maps scenes to `<ProductScene>` or `<LogoScene>` inside `<Sequence>`.
- Asset paths are stored **without a leading slash** (e.g. `"assets/logo.png"`, `"uploads/123-file.png"`). Components call `staticFile(path)` at render time — never store paths with `/` prefix or `staticFile()` baked in.
- `public/uploads/` is where runtime user-uploaded images land (gitignored).

### Key gotchas
- Electron main is CJS (`require`/`module.exports`); everything under `src/` is ESM.
- Framer Motion's `HTMLMotionProps` includes `MotionValue` as a valid child type. To allow `React.ReactNode` children in wrapped components use `Omit<HTMLMotionProps<"button">, "ref" | "children"> & { children?: React.ReactNode }`.
- `useSelectedScene()` in `useAdStore` uses two separate `useStore` selectors (one for the list, one for the ID) to avoid infinite re-render loops.
