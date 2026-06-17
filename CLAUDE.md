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

# Package installer (macOS DMG)
npm run dist:mac

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Architecture

AdFrame is an Electron desktop app for creating video ads (TV, Instagram, Stories, TikTok) targeting supermarkets and retail. It combines a Vite+React UI with Remotion for video rendering and export.

### Process model
- **`electron/main.cjs`** — Electron main process (CommonJS). Registers `app://` protocol, handles file dialogs, copies uploads to `userData/uploads/` in production and `public/uploads/` in dev. Runs Remotion `bundle()` + `renderMedia()` for MP4 export. Library and project data persisted as JSON under `userData/`.
- **`electron/preload.cjs`** — Exposes `window.adFrame` via `contextBridge`: `selectImage`, `copyFile`, `selectCsv`, `projectsList/Save/Load/Delete/Rename`, `libraryList/Save/Delete`, `exportVideo`, `onExportProgress`.
- **`src/`** — React renderer process (ESM, Vite).

### Routing
Single-page with Zustand-driven navigation. `Page = "dashboard" | "wizard" | "editor" | "projects" | "library" | "settings"` in `src/store/useNavigationStore.ts`. Pages rendered conditionally in `src/App.tsx`.

### State (Zustand stores)
- **`useAdStore`** — Full ad config + selected scene ID + `seekFrame` for player sync. Key actions: `addProductScene`, `addLogoScene`, `updateScene`, `removeScene`, `reorderScenes`, `seekToScene`, `loadConfig`.
- **`useWizardStore`** — Multi-step wizard state (store info, products, preset, export format).
- **`useNavigationStore`** — Current page + sidebar collapsed state.
- **`useThemeStore`** — `"dark" | "light" | "system"`. System mode listens to `prefers-color-scheme` in real time. Applies `data-theme` on `<html>`.
- **`useLibraryStore`** — Product library CRUD, synced with IPC (`libraryList/Save/Delete`).
- **`useProjectsStore`** — Projects CRUD, synced with IPC.
- **`useToastStore`** — Toast notifications.

### Design system
- **`src/styles/tokens.css`** — Single source of truth for all CSS custom properties. Theme tokens split between `[data-theme="dark"]` and `[data-theme="light"]`.
- **`src/styles/`** — All CSS centralized here under `components/`, `layout/`, `pages/`. No CSS files alongside `.tsx` files.
- **`src/design-system/components/`** — `Button`, `IconButton`, `Field`/`TextField`/`SelectField`/`ColorField`/`Checkbox`, `Card`, `Dialog`, `ProgressBar`, `Tabs`, `Toast`, `Tooltip`, `UploadZone`, `ContextMenu`. All exported from `index.ts`.
- Never hardcode color values — use semantic tokens (`--input-bg`, `--text-primary`, etc.).

### Layout (Editor)
Three-panel layout rendered when `page === "editor"`:
- `SceneListPanel` (left, 300px) — logo upload, sortable scene list (dnd-kit), library import picker
- `PreviewPanel` (center, flex:1) — Remotion `<Player>` with `seekTo` sync on scene select
- `InspectorPanel` (right, 320px) — scene fields, animated with Framer Motion `AnimatePresence`

### Remotion / video
- **`src/remotion/types.ts`** — `ProductSceneConfig`, `LogoSceneConfig`, `ExportFormat`, `FORMAT_DIMENSIONS`. Defaults via `defaultProductScene()` / `defaultLogoScene()`.
- **`src/remotion/DynamicAd.tsx`** — Root composition; maps scenes to `<ProductScene>` or `<LogoScene>` inside `<Sequence>`.
- **`src/remotion/presets.ts`** — `buildPreset(id: PresetId): AdConfig` for generico / carnes / natal / pascoa.
- **Multi-format**: `ExportFormat = "tv" | "instagram" | "stories" | "tiktok"`. Scenes scale with `sc = Math.min(width/1920, height/1080)` and switch layout for portrait/square.
- Asset paths stored **without leading slash** (e.g. `"uploads/123-file.png"`). Components call `staticFile(path)` at render time.
- Production: `app://` protocol serves `dist/` and `userData/uploads/` for the Remotion Player in the renderer.

### Key gotchas
- `electron/main.cjs` is CJS; everything under `src/` is ESM.
- `protocol.registerSchemesAsPrivileged` must be called **before** `app.whenReady()`.
- In production, `publicDir` for `bundle()` is `app.getPath("userData")` (contains `uploads/` subdir).
- Framer Motion `ease` values must be cast: `ease: "easeOut" as const` to satisfy TypeScript.
- `useSelectedScene()` uses two separate selectors (scenes list + selectedId) to avoid re-render loops.
- `seekToScene(id)` sets `seekFrame`; `PreviewPanel` watches via `useEffect` and calls `playerRef.seekTo()`. Offset: `min(30, floor(duration × 0.35))` frames to skip intro animations.
