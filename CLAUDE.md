# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev: Electron app (recommended — starts Vite then Electron)
npm run electron:dev

# Dev: Vite only (browser at localhost:5173, without Electron APIs)
npm run dev

# Type check only
npx tsc --noEmit

# Production build (tsc + vite build + remotion pre-bundle)
npm run build

# Package macOS installer (DMG arm64 + x64)
npm run dist:mac
```

## Architecture

AdFrame is an Electron desktop app for creating video ads (TV, Instagram, Stories, TikTok) for supermarkets and retail. It combines a Vite+React UI with Remotion for video rendering and export.

### Process model
- **`electron/main.cjs`** — Electron main process (CommonJS). Registers `app://` protocol (serves `dist/` and `userData/uploads/`), handles file dialogs, copies uploads. Runs Remotion `renderMedia()` for MP4 export. Library, project and template data persisted as JSON under `userData/`.
- **`electron/preload.cjs`** — Exposes `window.adFrame` via `contextBridge`: `selectImage`, `selectVideo`, `copyFile`, `selectCsv`, `projectsList/Save/Load/Delete/Rename`, `templateList/Save/Delete`, `libraryList/Save/Delete`, `exportVideo`, `onExportProgress`.
- **`src/`** — React renderer process (ESM, Vite).

### Routing
Single-page with Zustand-driven navigation. `Page = "dashboard" | "wizard" | "editor" | "projects" | "library" | "templates" | "template-builder" | "template-wizard" | "settings"` in `src/store/useNavigationStore.ts`. `navigateToBuilder(templateId?)` opens the template builder for a new or existing template.

### State (Zustand stores)
- **`useAdStore`** — Full ad config + selected scene ID + `seekFrame` for player sync. Key actions: `addProductScene`, `addLogoScene`, `addTemplateScene(templateId?)`, `addVideoScene`, `updateScene`, `removeScene`, `reorderScenes`, `seekToScene`, `loadConfig`.
- **`useTemplateStore`** — Template CRUD (list, save, delete, duplicate, import/export JSON). Merges built-in templates from `src/templates/` with user-created ones from `userData/templates/`.
- **`useTemplateInstanceStore`** — Holds the active template + filled values while the user is in the TemplateWizard flow.
- **`useWizardStore`** — Multi-step wizard state (store info, products, preset, export format).
- **`useNavigationStore`** — Current page + `editingTemplateId` + sidebar collapsed state.
- **`useThemeStore`** — `"dark" | "light" | "system"`. System mode listens to `prefers-color-scheme` in real time.
- **`useLibraryStore`** — Product library CRUD, synced with IPC.
- **`useProjectsStore`** — Projects CRUD, synced with IPC.
- **`useToastStore`** — Toast notifications.

### Design system
- **`src/styles/tokens.css`** — Single source of truth for all CSS custom properties.
- **`src/styles/`** — All CSS under `components/`, `layout/`, `pages/`. No CSS files alongside `.tsx`.
- **`src/design-system/components/`** — `Button`, `IconButton` (variants: `"default" | "danger"` — NOT "ghost"), `Field`/`TextField`/`SelectField`/`ColorField`/`Checkbox`, `Card`, `Dialog`, `ProgressBar`, `Tabs`, `Toast`, `Tooltip`, `UploadZone`, `ContextMenu`. All exported from `index.ts`.
- Never hardcode color values — use semantic tokens (`--input-bg`, `--text-primary`, etc.).

### Layout (Editor)
Three-panel layout when `page === "editor"`:
- `SceneListPanel` (left) — logo upload, sortable scene list (dnd-kit), buttons: Produto / Logo/Texto / Biblioteca / Template / Vídeo
- `PreviewPanel` (center) — Remotion `<Player>` with `seekTo` sync on scene select
- `InspectorPanel` (right) — per-type inspectors: `LogoInspector`, `ProductInspector`, `TemplateInspector`, `VideoInspector`

### Scene types (`src/remotion/types.ts`)
```ts
type SceneConfig = LogoSceneConfig | ProductSceneConfig | TemplateSceneConfig | VideoSceneConfig
```
- **`LogoSceneConfig`** — tagline, colors, duration
- **`ProductSceneConfig`** — image, name, price (offer/single), badge, colors, logo overlay
- **`TemplateSceneConfig`** — `templateId`, `values: Record<string,string>`, duration. At export time, `AdConfig.templates[]` must be populated so `DynamicAd` can look up the full Template object (Zustand store is not available in the Remotion render process).
- **`VideoSceneConfig`** — `src`, `volume`, duration

Factory defaults: `defaultLogoScene()`, `defaultProductScene()`, `defaultTemplateScene(templateId?)`, `defaultVideoScene()`.

### Template system (`src/remotion/template-types.ts`)
Templates are multi-scene compositions with typed variables (text, number, image, color). Each template has `scenes[]` of layers.

Layer types: `text`, `image`, `logo`, `shape`, `badge`, `price`, `video`. Image and logo layers support `flipX?: boolean` and `flipY?: boolean` (applied as `scaleX(-1)` / `scaleY(-1)`).

- **`src/remotion/TemplateRenderer.tsx`** — Renders a `Template` with filled `values` using Remotion sequences.
- **`src/remotion/LayerRenderer.tsx`** — Per-layer rendering inside the Remotion composition.
- **`src/components/builder/CanvasEditor.tsx`** — Drag/resize canvas for the Template Builder (1920×1080 scaled to container).
- **`src/components/builder/Timeline.tsx`** — Frame timeline for layer start/end editing.
- **`src/pages/TemplateBuilder.tsx`** — Full template builder page. Text/badge inputs use a debounce pattern (300ms + flush on blur) to avoid focus loss on every keystroke.
- **`src/pages/Templates.tsx`** — Template gallery with preview cards, context menu, duplicate/delete/export.
- **`src/pages/TemplateWizard.tsx`** — 3-step flow: fill variables → preview → export format.

Built-in templates live in `src/templates/` (generico, carnes, natal, pascoa) and are merged with user templates at runtime.

### Remotion / video
- **`src/remotion/DynamicAd.tsx`** — Root ad composition. Renders scenes by type: `logo → LogoScene`, `product → ProductScene`, `template → TemplateRenderer` (looks up template from `props.templates ?? storeTemplates`), `video → OffthreadVideo`.
- **`src/remotion/Root.tsx`** — Registers all compositions (`DynamicAd`, `TemplateAd`) for the Remotion bundle.
- Asset paths stored **without leading slash** (e.g. `"uploads/123-file.png"`). Components call `staticFile(path)` at render time.
- `<Player>` components always need `acknowledgeRemotionLicense` prop to suppress license warnings.
- `initialFrame` on `<Player>` must be clamped: `Math.min(value, Math.max(totalFrames - 1, 0))` to avoid white screen crash.

### Production build & packaging

```
npm run build
  └─ tsc -b
  └─ vite build          → dist/
  └─ bundle-remotion.mjs → dist/remotion-bundle/   (pre-built Remotion webpack bundle)
npm run dist:mac
  └─ electron-builder    → release/AdFrame-*.dmg
```

**Key production decisions:**
- `"asar": false` in electron-builder — Remotion uses ESM with `import.meta.url` to locate compositor binaries; `.asar` archives break `chmod` and `spawn` for those binaries.
- `dist/remotion-bundle/` is a pre-built Remotion webpack bundle. At export time, `renderMedia({ serveUrl: bundleLocation })` uses it directly — no runtime bundling.
- Production bundle path: `path.join(process.resourcesPath, "app", "dist", "remotion-bundle")`.
- Before rendering, uploads are synced from `userData/uploads/` to `{bundleDir}/public/uploads/` because Remotion injects `window.remotion_staticBase = '/public/'` in the webpack bundle, making `staticFile('uploads/x')` resolve to `/public/uploads/x`.
- `entitlements.plist` includes `cs.disable-library-validation` — required for ffmpeg's dylibs (`libavdevice.dylib` etc.) which use relative rpaths blocked by macOS hardened runtime.
- `hardwareAcceleration: "if-possible"` in `renderMedia` — uses NVENC/AMF/QSV when available, falls back to CPU.
- `HOME` is set at process startup via `os.userInfo().homedir` (not `os.homedir()`) because `os.homedir()` reads the `HOME` env var first, which may be empty in packaged Electron on macOS.
- **DevTools shortcut**: `Cmd+Shift+I` opens DevTools in any build (useful for debugging production releases).

### `app://` protocol (production)
Serves app bundle assets using `fs.readFileSync` (handles `.asar` transparently if ever re-enabled) and user uploads via `net.fetch`. Registered before `app.whenReady()` with `registerSchemesAsPrivileged`.

### Key gotchas
- `electron/main.cjs` is CJS; everything under `src/` is ESM.
- `protocol.registerSchemesAsPrivileged` must be called **before** `app.whenReady()`.
- `TemplateSceneConfig.templateId` alone is not enough for export — always include `AdConfig.templates` in the export payload when any scene is `type: "template"`.
- `IconButton` variant only accepts `"default" | "danger"` — NOT `"ghost"`.
- `useRef<T>()` requires an initial value in this TS config — use `useRef<T>(undefined as unknown as T)` for timer refs.
- `interpolate()` from Remotion uses `extrapolateLeft/Right: "clamp"` — not `clamp: true`.
- Framer Motion `ease` values must be cast: `ease: "easeOut" as const`.
- `useSelectedScene()` uses two separate selectors (scenes list + selectedId) to avoid re-render loops.
- `seekToScene(id)` sets `seekFrame`; `PreviewPanel` watches via `useEffect` and calls `playerRef.seekTo()`.
