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

# Package Windows installer
npm run dist:win

# Package Linux
npm run dist:linux
```

## Architecture

Screenlet is an Electron desktop app for digital signage — creating, rendering and broadcasting MP4 video ads (TV, Instagram, Stories, TikTok) via a built-in IPTV server. It combines a Vite+React UI with Remotion for video rendering and export.

### Process model
- **`electron/main.cjs`** — Electron main process (CommonJS). Registers `app://` protocol (serves `dist/` and user uploads). All user data lives under `~/Documents/Screenlet/` (or a user-configured path). Runs Remotion `renderMedia()`/`renderStill()` for MP4 export and project-thumbnail generation with adaptive concurrency. Runs an HTTP IPTV server on port 7095. Manages a `Tray` icon + login-item (autostart) settings on Windows.
- **`electron/preload.cjs`** — Exposes `window.adFrame` via `contextBridge`. Key groups: file utils (`selectImage`, `copyFile`, `selectVideo`), projects CRUD, templates CRUD, library CRUD, channels CRUD, Kodi devices CRUD + `kodiPing`/`kodiRestartAndOpen`/`kodiListChannels`/`kodiFetchConfig`, Screenlet Player devices (`playerDeviceList`/`playerDeviceScan`/`playerDeviceClaim`/`playerDeviceUnpair`/`playerDeviceDelete`), exports list/delete/reveal, IPTV start/stop/setIp, app settings (`appSettingsGet`/`appSettingsSetLaunchAtLogin`/`appSettingsSetAutoStartIptv`), `exportVideo`, `onExportProgress`, storage management (`storageGetDir`, `storageChooseDir`, `storageMigrate`, `storageOpenDir`), platform info (`platform: NodeJS.Platform`, `appGetVersion`, `setTitleBarTheme(isDark)`). See `src/global.d.ts` for the full typed surface.
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
"dashboard" | "wizard" | "editor"
| "projects" | "library" | "media-hub" | "templates" | "template-builder" | "template-wizard"
| "renders"
| "channels" | "devices"
| "iptv" | "settings"
```
`navigateToBuilder(templateId?)` opens the template builder for a new or existing template.

### Media Hub (`src/pages/MediaHub.tsx`)
Catalogs all uploaded assets (images + videos) in `UPLOADS_DIR`. The catalog is persisted at `UPLOADS_DIR/media-catalog.json`. Key behaviors:
- **Auto-discovery**: `media-catalog` IPC scans `UPLOADS_DIR` on every call and adds un-cataloged files automatically — existing uploads from before Media Hub exist appear without any migration.
- **SHA-256 dedup**: `media-import` computes a SHA-256 hash before copying; if the same file was already imported it returns the existing asset without duplicating.
- **Non-destructive delete**: removing an asset from the catalog only removes the catalog entry; the physical file is preserved so existing `image: "uploads/xxx"` references in projects still work.
- **`MediaPicker` component** (`src/components/media/MediaPicker.tsx`): shared picker used in `InspectorPanel` (ProductInspector image field). Opens a dialog showing the catalog grid + "Import file" button. Replaces `UploadZone` for choosing product images.
- **Video thumbnails**: `VideoThumbnail` component in `MediaHub.tsx` captures a frame via a detached `<video>` + `<canvas>` + `toDataURL()` (no IPC/disk write — generated client-side on render).

### Devices (`src/pages/Devices.tsx`)
Two unrelated device-management sections share this one page:
- **Kodi devices** (`useDeviceStore`, `src/types/device.ts`) — SSH-managed Kodi/LibreELEC boxes. `device-save`/`device-list`/`device-delete` persist `KodiDevice` JSON (passwords encrypted at rest, never sent back to the renderer — only boolean flags). `kodi-ping` checks reachability, `kodi-restart-and-open` restarts Kodi and opens the IPTV M3U, `kodi-list-channels` previews channels from temporary form creds before saving, `kodi-fetch-config` reads `guisettings.xml` over SSH to auto-fill the HTTP API port/credentials fields.
- **Screenlet Player devices** (`usePlayerDeviceStore`, `src/types/playerDevice.ts`) — sibling Go project (`screenlet-player`, lightweight Linux mpv-based signage player). `player-device-scan` sweeps the local network for unclaimed/unpaired players; `player-device-claim` pairs one to a channel (may reject if unreachable or already claimed by another Studio instance); `player-device-unpair`/`player-device-delete` release/remove it. Claimed players poll the Studio for their assigned channel's programming.

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
- **`useRendersStore`** — Exported MP4 list (`{ videos, loading, refresh(), remove(filename), reveal(filename) }`), backed by `exportsList`/`exportsDelete`/`exportsReveal`. Replaces ad-hoc local state previously kept inside `Renders.tsx`.
- **`useAppSettingsStore`** — Windows-only app settings: `launchAtLogin` (autostart, default off) and `autoStartIptv` (start the IPTV server on launch, default on). Synced with `appSettingsGet`/`appSettingsSetLaunchAtLogin`/`appSettingsSetAutoStartIptv`, persisted to `userData/app-settings.json`.
- **`useDeviceStore`** — Kodi device CRUD, synced with `device-list`/`device-save`/`device-delete` IPC.
- **`usePlayerDeviceStore`** — Screenlet Player device CRUD + pairing (`playerDeviceList`/`playerDeviceScan`/`playerDeviceClaim`/`playerDeviceUnpair`/`playerDeviceDelete`).

### Channel & Studio system
Channels live in `SCREENLET_DIR/channels/`. Each channel has `playlist: PlaylistItem[]`, `loop: boolean`, and `rules?: ProgrammingRule[]` (see `src/types/channel.ts`). `rules` is optional for backward compatibility with existing channel JSON files.

`PlaylistItem = { id, filename, name, transition: "cut" | "fade" }`.

The Studio (`src/pages/Studio.tsx`) is a fixed full-screen overlay (`z-index: 200`). `type Tab = "playlist" | "preview" | "schedule"`:
- **Playlist** tab — library of rendered videos from `EXPORTS_DIR` (left, via `useRendersStore`) + playlist editor with move up/down, transition selector, remove (right)
- **Pré-visualizar** tab — a real `<Player>` (Remotion) that plays through the current `playlist` in order, switching `src` per item and respecting each item's `transition`; shows an empty state pointing back to the Playlist tab if it has no items
- **Horários** tab — `ProgrammingTimeline` component for managing `ProgrammingRule[]`
- Footer: loop toggle + Save/Cancel (saves `{ ...channel, playlist, loop, rules }`)

`ProgrammingRule = { id, assetFilename, assetName, schedule: ProgrammingSchedule, transition? }`.
`ProgrammingSchedule` is a discriminated union: `{ type: "always" }` | `{ type: "time-range"; startTime; endTime }` | `{ type: "day-of-week"; days: ScheduleDay[] }`.

**Programming Engine** (`src/lib/programmingEngine.ts`): pure function `getCurrentAsset(channel, now?)` evaluates rules against the current time and returns the filename to broadcast. Falls back to `channel.playlist[0].filename` if no rule matches. Handles overnight time ranges (e.g. 22:00–06:00). Used in `IptvServer.tsx` to display live programming status.

**`ProgrammingTimeline`** (`src/components/programming/ProgrammingTimeline.tsx`): list of `ProgrammingRuleBlock` components + "Adicionar regra" button + `ProgrammingRuleForm` dialog for create/edit.

**macOS traffic light fix**: Studio's header uses `padding-left: 80px` + `-webkit-app-region: drag` with `-webkit-app-region: no-drag` on interactive elements.

**Windows titlebar**: `createWindow()` uses platform-conditional options. On Windows: `titleBarStyle: "hidden"` + `titleBarOverlay: { height: 36, color, symbolColor }` + `autoHideMenuBar: true`. The overlay color is set at startup via `nativeTheme.shouldUseDarkColors` (tokens `#0a0b0e` dark / `#f7f8fa` light) and updated via `ipcMain.handle("set-titlebar-theme")` + `nativeTheme.on("updated")`. The sidebar's `.vt-sidebar__brand-trafficzone` div is hidden on non-macOS via `html:not([data-platform="darwin"])` CSS selector. The editor header avoids the overlay buttons via `padding-right` using `env(titlebar-area-width)` (Electron CSS env var) with `--win-controls-w: 152px` as fallback.

`Channels.tsx` opens Studio by setting `studioChannel` state; while set, it renders `<Studio>` instead of the channel list.

### Windows tray & autostart
- App can be launched with `--hidden` (checked via `startedHidden = process.argv.includes("--hidden")`), which creates the main `BrowserWindow` with `show: false` and skips the startup focus.
- A `Tray` icon (`getTrayIconPath()`) is always created; its menu has "Abrir" and "Sair" (`isQuitting = true; app.quit()`).
- The window's `close` event is intercepted: unless `isQuitting`, it calls `event.preventDefault()` and `window.hide()` instead of actually closing — true quit only happens from the tray's "Sair" or `before-quit`.
- **Launch at login**: `useAppSettingsStore` (Settings page, Windows-only "Inicialização" section) toggles `appSettingsSetLaunchAtLogin`, which calls `app.setLoginItemSettings({ openAtLogin, args: ["--hidden"] })` — note `setLoginItemSettings` registers `electron.exe` itself in dev (wrong binary), so this only behaves correctly in packaged builds.
- **Auto-start IPTV**: a second toggle (`autoStartIptv`, default **on**) starts the IPTV server automatically at app launch (`startIptvServer()`, extracted out of the `iptv-start` IPC handler so both the manual and automatic paths share the same code).
- Settings persisted to `APP_SETTINGS_FILE` (`userData/app-settings.json`), defaults in `DEFAULT_APP_SETTINGS`.

### Renders page
`src/pages/Renders.tsx` lists all MP4 files in `EXPORTS_DIR` via `useRendersStore`. Each card has Play (opens a `Dialog` with a `<video>` preview), reveal-in-Finder, and delete actions.

### Render / export flow
1. User clicks "Renderizar" → `openFpsDialog(payload, suggestedName)` in `App.tsx`
2. FPS dialog shows filename input (pre-filled from `suggestedName`) + FPS choice (30/60)
3. `confirmRender()` builds filename as `customName + ".mp4"` and calls `runExport`
4. `runExport` calls `window.adFrame.exportVideo(payload, filename, fps)`
5. Main process `export-video` handler: auto-saves to `EXPORTS_DIR`, adaptive concurrency, Chrome from cache

Both export and project-thumbnail generation share two helpers in `main.cjs`:
- **`prepareRenderBundle(onBundleProgress?)`** — bundles (or reuses) the Remotion compositions and returns a writable bundle location via `ensureWritableRenderBundle()` (see gotcha below).
- **`resolveAdComposition(payload)`** — picks the right composition id + duration/width/height for the given `AdConfig`.

**Project thumbnails**: on `projects-save`, the main process best-effort calls `renderStill()` against `PROJECT_THUMBS_DIR` (`SCREENLET_DIR/project-thumbs/<id>.jpg`) using the same `prepareRenderBundle`/`resolveAdComposition` helpers, and `projects-list` reports `thumbnail: "project-thumbs/<id>.jpg"` (relative path, see protocol gotcha) when the file exists, else `null`. Failures are swallowed — a project without a thumbnail just falls back to a folder icon in `Projects.tsx`.

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
- `"npmRebuild": false` in `package.json`'s `build` config — electron-builder's native-module rebuild step fails on `cpu-features` (an optional perf addon of `ssh2`, used for Kodi SSH) against newer Electron/V8 ABI; `ssh2` already wraps the `require` in `try/catch`, so skipping the rebuild is safe and avoids a hard packaging failure.
- **Windows resourcesPath can be read-only**: when installed "for all users" into `Program Files`, `process.resourcesPath` is not writable. `export-video` and project-thumbnail rendering used to copy uploads directly into the resources-path Remotion bundle (`{bundleDir}/public/uploads/`) and silently swallow the copy error. Fixed by `ensureWritableRenderBundle(sourceBundleLocation)`, which caches a copy of the bundle under `RENDER_BUNDLE_DIR` (`SCREENLET_DIR/remotion-bundle/`, always writable) and only re-copies when a `.source-mtime` marker file is stale. The render/thumbnail code now always renders out of `RENDER_BUNDLE_DIR`, never out of `process.resourcesPath` directly.

### `app://` protocol (production)
Serves app bundle assets using `fs.readFileSync` (handles `.asar` if ever re-enabled) and user uploads via `net.fetch`. Registered before `app.whenReady()` with `registerSchemesAsPrivileged({ secure: true, standard: true, supportFetchAPI: true, corsEnabled: true })`.

Routes matched on `pathname`:
- `/uploads/` → `UPLOADS_DIR`
- `/project-thumbs/` → `PROJECT_THUMBS_DIR`
- `/exports/` → `EXPORTS_DIR` (only the `Range` header is forwarded to `net.fetch`, not the full `Headers` object — see gotcha below)
- anything else falls through to the bundled `dist/` app files

**Critical gotcha — always use relative paths, never `app://host/...` absolute URLs**: in a `scheme://` URL, everything between `//` and the next `/` is the **host**, not the path. `app://exports/foo.mp4` makes `exports` the *host*, so `url.pathname` is `/foo.mp4` — it never matches `pathname.startsWith("/exports/")`. This is why the Studio preview player was stuck at `0:00`: it built `src` as `app://exports/${filename}`. The fix/convention used everywhere else in the codebase (`uploads/...`, `project-thumbs/...`) is to use a **relative** path with no scheme — it resolves against the page's own base URL (`app://index.html`), giving `pathname === "/exports/<file>"` as expected.

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
- **Any path handed to `app://` must be relative** (`"exports/x.mp4"`, never `"app://exports/x.mp4"`) — see the `app://` protocol section above for why the host/path parsing breaks otherwise.
- `src/lib/exportFormats.tsx` centralizes the format-icon lookup (`formatIcon(format)`) used by `Templates.tsx`, `Wizard.tsx`, `TemplateWizard.tsx`, and `Header.tsx` — don't reintroduce per-component emoji/icon switch statements for export formats.
- Kodi device passwords are encrypted at rest and never sent to the renderer; only boolean "has password" flags cross the IPC boundary. `kodi-ping`/`kodi-restart-and-open` take only a `deviceId` and decrypt internally in `main.cjs` — never pass plaintext credentials for an already-saved device.
- `app.setLoginItemSettings()` (autostart) registers whatever binary is currently running — in `npm run electron:dev` that's the `electron` binary itself, not the packaged app, so autostart only works correctly from a packaged build.
