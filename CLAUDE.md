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

# Package macOS installers (both arm64 and x64 DMGs)
npm run dist:mac

# Package macOS — Apple Silicon only
npm run dist:mac:arm64

# Package macOS — Intel only
npm run dist:mac:intel
```

## Architecture

Screenlet is an Electron desktop app for digital signage — creating, rendering and broadcasting MP4 video ads (TV, Instagram, Stories, TikTok) via a built-in IPTV server. It combines a Vite+React UI with Remotion for video rendering and export.

### Process model
- **`electron/main.cjs`** — Electron main process (CommonJS). Registers `app://` protocol (serves `dist/` and user uploads). All user data lives under `~/Documents/Screenlet/` (or a user-configured path). Runs Remotion `renderMedia()` for MP4 export with adaptive concurrency. Runs an HTTP IPTV server on port 7095.
- **`electron/preload.cjs`** — Exposes `window.adFrame` via `contextBridge`. Key groups: file utils (`selectImage`, `copyFile`, `selectVideo`), projects CRUD, templates CRUD, library CRUD, channels CRUD, exports list/delete/reveal, IPTV start/stop/setIp, `exportVideo`, `onExportProgress`, storage management (`storageGetDir`, `storageChooseDir`, `storageMigrate`, `storageOpenDir`), platform info (`platform: NodeJS.Platform`, `setTitleBarTheme(isDark)`).
- **`src/main.tsx`** — Sets `document.documentElement.dataset.platform` from `window.adFrame.platform` at startup so CSS rules can branch per OS. Also sets `--win-controls-w: 152px` on Windows as a CSS fallback for the titlebar overlay width.
- **`src/`** — React renderer process (ESM, Vite).

### Storage architecture
All user data is stored under `~/Documents/Screenlet/` by default (survives reinstalls, syncs via iCloud/OneDrive):

```
~/Documents/Screenlet/
  assets/     ← uploaded images and videos (UPLOADS_DIR)
  projects/   ← project JSON files
  templates/  ← user template JSON files
  library/    ← product library JSON
  channels/   ← channel JSON files
  exports/    ← rendered MP4 videos (EXPORTS_DIR)
```

The location can be changed by the user in Settings → Armazenamento. The custom path is persisted in `userData/storage-config.json`. On change, the app relaunches so all module-level `*_DIR` constants pick up the new path.

Vite dev server has a `serve-user-uploads` plugin (in `vite.config.ts`) that proxies `/uploads/*` requests to `UPLOADS_DIR` so the Remotion Player renders assets correctly in dev.

### Routing
Single-page with Zustand-driven navigation. `Page` type in `src/store/useNavigationStore.ts`:
```ts
"dashboard" | "wizard" | "editor" | "projects" | "library" | "media-hub" | "renders"
| "templates" | "template-builder" | "template-wizard"
| "channels" | "iptv" | "settings"
```
`navigateToBuilder(templateId?)` opens the template builder for a new or existing template.

### Media Hub (`src/pages/MediaHub.tsx`)
Catalogs all uploaded assets (images + videos) in `UPLOADS_DIR`. The catalog is persisted at `UPLOADS_DIR/media-catalog.json`. Key behaviors:
- **Auto-discovery**: `media-catalog` IPC scans `UPLOADS_DIR` on every call and adds un-cataloged files automatically — existing uploads from before Media Hub exist appear without any migration.
- **SHA-256 dedup**: `media-import` computes a SHA-256 hash before copying; if the same file was already imported it returns the existing asset without duplicating.
- **Non-destructive delete**: removing an asset from the catalog only removes the catalog entry; the physical file is preserved so existing `image: "uploads/xxx"` references in projects still work.
- **`MediaPicker` component** (`src/components/media/MediaPicker.tsx`): shared picker used in `InspectorPanel` (ProductInspector image field). Opens a dialog showing the catalog grid + "Import file" button. Replaces `UploadZone` for choosing product images.

### State (Zustand stores)
- **`useAdStore`** — Full ad config + selected scene ID + `seekFrame` + `currentProjectName`. Key actions: `addProductScene`, `addLogoScene`, `addTemplateScene`, `addVideoScene`, `updateScene`, `reorderScenes`, `seekToScene`, `loadConfig`, `setCurrentProjectName`.
- **`useTemplateStore`** — Template CRUD. Merges built-in templates from `src/templates/` with user templates from `SCREENLET_DIR/templates/`.
- **`useTemplateInstanceStore`** — Active template + filled values during TemplateWizard flow.
- **`useWizardStore`** — Multi-step wizard state (store info, products, preset, export format).
- **`useNavigationStore`** — Current page + `editingTemplateId` + sidebar collapsed state.
- **`useThemeStore`** — `"dark" | "light" | "system"`. System mode listens to `prefers-color-scheme` in real time. `applyTheme()` also calls `window.adFrame.setTitleBarTheme(isDark)` to sync the Windows titlebar overlay color.
- **`useLibraryStore`** — Product library CRUD, synced with IPC.
- **`useMediaStore`** — Media catalog CRUD. `refresh()` calls `media-catalog` IPC which scans `UPLOADS_DIR` for new files and returns `MediaAsset[]`. `importAsset(type)` opens a file dialog with SHA-256 dedup and adds to catalog. `removeAsset(id)` removes from catalog only (does NOT delete the physical file to preserve compatibility).
- **`useProjectsStore`** — Projects CRUD, synced with IPC.
- **`useChannelStore`** — Channels CRUD, synced with IPC.
- **`useIptvStore`** — IPTV server status (`running`, `port`, `ips[]`, `selectedIp`, `ffmpegAvailable`). `setIp(ip)` persists the preferred network interface to `userData/iptv-config.json`. `getLocalIPs()` in main sorts IPs: `192.168.x.x` → `10.x.x.x` → `172.16-31.x.x` → VPN/Tailscale last.
- **`useToastStore`** — Toast notifications.

### Channel & Studio system
Channels live in `SCREENLET_DIR/channels/`. Each channel has `playlist: PlaylistItem[]`, `loop: boolean`, and `rules?: ProgrammingRule[]` (see `src/types/channel.ts`). `rules` is optional for backward compatibility with existing channel JSON files.

`PlaylistItem = { id, filename, name, transition: "cut" | "fade" }`.

The Studio (`src/pages/Studio.tsx`) is a fixed full-screen overlay (`z-index: 200`). It has two tabs:
- **Playlist** tab — library of rendered videos from `EXPORTS_DIR` (left) + playlist editor with move up/down, transition selector, remove (right)
- **Horários** tab — `ProgrammingTimeline` component for managing `ProgrammingRule[]`
- Footer: loop toggle + Save/Cancel (saves `{ ...channel, playlist, loop, rules }`)

`ProgrammingRule = { id, assetFilename, assetName, schedule: ProgrammingSchedule, transition? }`.
`ProgrammingSchedule` is a discriminated union: `{ type: "always" }` | `{ type: "time-range"; startTime; endTime }` | `{ type: "day-of-week"; days: ScheduleDay[] }`.

**Programming Engine** (`src/lib/programmingEngine.ts`): pure function `getCurrentAsset(channel, now?)` evaluates rules against the current time and returns the filename to broadcast. Falls back to `channel.playlist[0].filename` if no rule matches. Handles overnight time ranges (e.g. 22:00–06:00). Used in `IptvServer.tsx` to display live programming status.

**`ProgrammingTimeline`** (`src/components/programming/ProgrammingTimeline.tsx`): list of `ProgrammingRuleBlock` components + "Adicionar regra" button + `ProgrammingRuleForm` dialog for create/edit.

**macOS traffic light fix**: Studio's header uses `padding-left: 80px` + `-webkit-app-region: drag` with `-webkit-app-region: no-drag` on interactive elements.

**Windows titlebar**: `createWindow()` uses platform-conditional options. On Windows: `titleBarStyle: "hidden"` + `titleBarOverlay: { height: 36, color, symbolColor }` + `autoHideMenuBar: true`. The overlay color is set at startup via `nativeTheme.shouldUseDarkColors` (tokens `#0a0b0e` dark / `#f7f8fa` light) and updated via `ipcMain.handle("set-titlebar-theme")` + `nativeTheme.on("updated")`. The sidebar's `.vt-sidebar__brand-trafficzone` div is hidden on non-macOS via `html:not([data-platform="darwin"])` CSS selector. The editor header avoids the overlay buttons via `padding-right` using `env(titlebar-area-width)` (Electron CSS env var) with `--win-controls-w: 152px` as fallback.

`Channels.tsx` opens Studio by setting `studioChannel` state; while set, it renders `<Studio>` instead of the channel list.

### Renders page
`src/pages/Renders.tsx` lists all MP4 files in `EXPORTS_DIR` via `window.adFrame.exportsList()`. Each card has reveal-in-Finder and delete actions.

### Render / export flow
1. User clicks "Renderizar" → `openFpsDialog(payload, suggestedName)` in `App.tsx`
2. FPS dialog shows filename input (pre-filled from `suggestedName`) + FPS choice (30/60)
3. `confirmRender()` builds filename as `customName + ".mp4"` and calls `runExport`
4. `runExport` calls `window.adFrame.exportVideo(payload, filename, fps)`
5. Main process `export-video` handler: auto-saves to `EXPORTS_DIR`, adaptive concurrency, Chrome from cache

**Adaptive concurrency** (`computeConcurrency()` in `main.cjs`): reserves 2 GB for OS + app, allocates ~600 MB per Remotion worker, capped at half the CPU count and max 8.

**Chrome caching**: `warmRemotionBrowser()` runs at app startup. It chdirs to `userData/remotion-root/` (which has a `package.json` anchor) so Remotion stores Chrome at `userData/remotion-root/node_modules/.remotion/` — survives app updates. The path is cached in `cachedBrowserExecutable` and passed to every `renderMedia` / `selectComposition` call.

### Design system
- **`src/styles/tokens.css`** — Single source of truth for all CSS custom properties.
- **`src/styles/`** — All CSS under `components/`, `layout/`, `pages/`. **No CSS files alongside `.tsx`.**
- **`src/design-system/components/`** — `Button`, `IconButton` (variants: `"default" | "danger"` — **NOT "ghost"**), `Field`/`TextField`/`SelectField`/`ColorField`/`Checkbox`, `Card`, `Dialog`, `ProgressBar`, `Tabs`, `Toast`, `Tooltip`, `UploadZone`, `ContextMenu`. All exported from `index.ts`.
- **`src/components/media/MediaPicker.tsx`** — shared media picker. Exports `MediaPicker` (inline preview + click-to-open) and `MediaPickerDialog` (standalone modal). Used in `InspectorPanel` (product image), `SceneListPanel` (video picker), `TemplateWizard` (image variables), `TemplateBuilder` (image layer props).
- **`src/components/programming/`** — `ProgrammingTimeline`, `ProgrammingRuleBlock`, `ProgrammingRuleForm`. Used by Studio's "Horários" tab.
- Never hardcode color values — always use semantic tokens (`--input-bg`, `--text-primary`, etc.).

### Layout (Editor)
Three-panel layout when `page === "editor"`:
- `SceneListPanel` (left) — logo upload, sortable scene list (dnd-kit), buttons: Produto / Logo/Texto / Biblioteca / Template / Vídeo
- `PreviewPanel` (center) — Remotion `<Player>` with `seekTo` sync on scene select
- `InspectorPanel` (right) — per-type inspectors: `LogoInspector`, `ProductInspector`, `TemplateInspector`, `VideoInspector`

### Scene types (`src/remotion/types.ts`)
```ts
type SceneConfig = LogoSceneConfig | ProductSceneConfig | TemplateSceneConfig | VideoSceneConfig
```
Factory defaults: `defaultLogoScene()`, `defaultProductScene()`, `defaultTemplateScene(templateId?)`, `defaultVideoScene()`.

At export time, when any scene is `type: "template"`, `AdConfig.templates[]` must be included in the payload so `DynamicAd` can look up the full Template object (Zustand store is not available in the Remotion render process).

### Asset bundle (`public/assets/`)
Static assets shipped with the app live in `public/assets/`. The naming convention is **English kebab-case** (e.g. `picanha-steak.png`, `milk-can.png`). The subfolder for sample product images is `products/`. Paths are referenced in templates and presets without a leading slash (`"assets/products/picanha-steak.png"`), resolved at render time via `staticFile()`.

### Template system (`src/remotion/template-types.ts`)
Layer types: `text`, `image`, `logo`, `shape`, `badge`, `price`, `video`. Image and logo layers support `flipX?: boolean` and `flipY?: boolean`.

Built-in templates live in `src/templates/` (generico, carnes, natal, pascoa) and are merged with user templates at runtime.

### Remotion / video
- **`src/remotion/DynamicAd.tsx`** — Root ad composition. Renders scenes by type.
- **`src/remotion/Root.tsx`** — Registers all compositions (`DynamicAd`, `TemplateAd`) for the Remotion bundle.
- Asset paths stored **without leading slash** (e.g. `"uploads/123-file.png"`). Components call `staticFile(path)` at render time.
- `<Player>` components always need `acknowledgeRemotionLicense` prop.
- `initialFrame` on `<Player>` must be clamped: `Math.min(value, Math.max(totalFrames - 1, 0))` to avoid white-screen crash.

### Production build & packaging

```
npm run dist:mac
  └─ install-cross-compositors.mjs   → installs arm64 + x64 compositor binaries
  └─ tsc -b
  └─ vite build                      → dist/
  └─ bundle-remotion.mjs             → dist/remotion-bundle/
  └─ electron-builder                → release/Screenlet-arm64.dmg + Screenlet-x64.dmg
```

**Key production decisions:**
- `"asar": false` — Remotion compositor binaries (`ffmpeg`, `ffprobe`) must be executable on disk; `.asar` archives break `chmod` and `spawn` for those files.
- `optionalDependencies` in `package.json` lists all compositor packages so electron-builder includes them explicitly.
- `scripts/install-cross-compositors.mjs` uses `npm pack` (bypasses npm's os/cpu platform filter) to install `compositor-darwin-x64` on an ARM64 build machine. Idempotent — skips if already present.
- Production bundle path: `path.join(process.resourcesPath, "app", "dist", "remotion-bundle")`.
- Before rendering, uploads are synced from `UPLOADS_DIR` to `{bundleDir}/public/uploads/` because Remotion injects `window.remotion_staticBase = '/public/'`, making `staticFile('uploads/x')` resolve to `/public/uploads/x`.
- `entitlements.plist` includes `cs.disable-library-validation` — required for ffmpeg's dylibs which use relative rpaths blocked by macOS hardened runtime.
- `HOME` is set at startup via `os.userInfo().homedir` (not `os.homedir()`) because `os.homedir()` reads the `HOME` env var first, which may be empty in packaged Electron on macOS.
- **DevTools shortcut**: `Cmd+Shift+I` opens DevTools in any build.

### `app://` protocol (production)
Serves app bundle assets using `fs.readFileSync` (handles `.asar` if ever re-enabled) and user uploads via `net.fetch`. Registered before `app.whenReady()` with `registerSchemesAsPrivileged`.

### Key gotchas
- `electron/main.cjs` is CJS; everything under `src/` is ESM.
- `protocol.registerSchemesAsPrivileged` must be called **before** `app.whenReady()`.
- `TemplateSceneConfig.templateId` alone is not enough for export — always include `AdConfig.templates` when any scene is `type: "template"`.
- `IconButton` variant only accepts `"default" | "danger"` — **NOT "ghost"**.
- `useRef<T>()` requires an initial value in this TS config — use `useRef<T>(undefined as unknown as T)` for timer refs.
- `interpolate()` from Remotion uses `extrapolateLeft/Right: "clamp"` — not `clamp: true`.
- Framer Motion `ease` values must be cast: `ease: "easeOut" as const`.
- `Channel` type uses `playlist: PlaylistItem[]` and `loop: boolean` — the old `loopSourceId / loopSourceType` fields no longer exist. `generateM3u()` in `main.cjs` checks `ch.loop` for the VLC repeat directive.
- `window.adFrame.platform` is a string (`NodeJS.Platform`), set synchronously from `process.platform` in the preload — safe to read before React mounts.
- `titleBarStyle: "hiddenInset"` and `trafficLightPosition` are macOS-only — always guard with `process.platform === "darwin"` in `main.cjs`.
- `ExportResult` type is `{ ok: true; filename: string } | { ok: false; error: string }` — not `{ canceled: boolean }`.
- `Page` type does NOT include `"schedules"` or `"schedule-builder"` — those pages were removed.
- `media-delete` IPC removes the asset from the catalog only, not from disk — physical files must remain to avoid breaking existing project references (`image: "uploads/xxx"`).
- `media-catalog` auto-syncs: it calls `syncMediaCatalog()` which scans `UPLOADS_DIR` on every call. Any file placed in uploads outside the IPC (e.g. via `copyFile` / `selectImage`) will appear in Media Hub automatically on next load.
- `Channel.rules` is `optional` — existing channel JSONs without `rules` load fine; `getCurrentAsset` falls back to `channel.playlist[0]`.
- `getCurrentAsset` is a pure function (no IPC, no side effects) — safe to call in the renderer at render time, e.g. inside a `useEffect` with a 1-minute interval tick.
- `SceneListPanel` uses `VideoPickerButton` (wraps `MediaPickerDialog`) instead of a direct `window.adFrame.selectVideo()` call — video scenes are now picked from the media catalog.
- `TemplateWizard` and `TemplateBuilder` image fields use `MediaPickerDialog` instead of `window.adFrame.selectImage()`.
- `Dashboard` stat grid is 4 columns (projects, exports, templates, media catalog count). The 4th `StatCard` uses `iconClass="info"` which needs `.vt-dash__stat-icon--info` in `Dashboard.css`.
- `IptvServer` shows a "Programação agora" panel using `getCurrentAsset` per channel, refreshed by a 1-minute `setInterval`.
