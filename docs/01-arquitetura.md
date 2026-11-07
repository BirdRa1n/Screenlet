# 01 · Arquitetura

## Visão geral

```
┌──────────────────────────── Processo principal (Node / Electron) ───────────────────────────┐
│ electron/main.cjs (~2.800 linhas, um único arquivo)                                         │
│                                                                                             │
│  Persistência JSON ── Mídia/SHA-256 ── Backup ZIP ── Criptografia (safeStorage)             │
│  Render (Remotion → Chrome headless → FFmpeg) ── Miniaturas de projeto                      │
│  Servidor IPTV HTTP :7095 (M3U, EPG, /channel stream via ffmpeg, API do Screenlet Player)   │
│  Kodi (SSH + JSON-RPC) ── Varredura de rede ── StockEasy (HTTPS) ── Auto-update ── Bandeja  │
└───────────────▲─────────────────────────────────────────────────────────────────────────────┘
                │ IPC (ipcMain.handle / ipcRenderer.invoke) — 69 métodos + 1 evento
┌───────────────┴──────── electron/preload.cjs → window.adFrame (contextBridge) ──────────────┐
└───────────────▲─────────────────────────────────────────────────────────────────────────────┘
┌───────────────┴──────────────────── Renderer (Chromium) ────────────────────────────────────┐
│ Next.js App Router (export estático) + React 19 + Tailwind v4 + shadcn/ui                   │
│ Telas: src/views/*   Estado: Zustand (src/store/*)   Prévia: @remotion/player               │
│ Composições de vídeo: src/remotion/* (as MESMAS usadas na exportação)                       │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

O app tem três peças:

- **Processo principal**: faz todo o I/O, rede, render e servidor.
- **Preload**: expõe uma API tipada e restrita ao renderer.
- **Renderer**: é uma SPA sem acesso direto ao disco.

## Processo principal

O processo principal é um arquivo CommonJS único. Ele está organizado nos blocos abaixo, na ordem em que aparecem no arquivo.

| Bloco | Responsabilidade |
|---|---|
| Bootstrap | Corrige `HOME` (lido de `os.userInfo()`), trava de instância única (`requestSingleInstanceLock`), flag `--hidden` |
| Gestão do Chrome do Remotion | `warmRemotionBrowser()` baixa/acha o Chrome headless em `userData/remotion-root/node_modules/.remotion`; `computeConcurrency()` |
| Diretórios | `SCREENLET_DIR` lido de `userData/storage-config.json` ou `~/Documents/Screenlet` |
| Janela | `createWindow()` com barra de título própria por plataforma, `show:false` até `ready-to-show`, bloqueio de popups, links externos vão ao navegador |
| Servidores de arquivos | Protocolo `app://` (produção) e servidor estático de dev na porta 7096 |
| Bandeja e ciclo de vida | Bandeja só no Windows; fechar esconde a janela; "Sair" encerra de fato |
| Auto-update | `electron-updater` contra GitHub Releases (pré-releases), pergunta antes de baixar |
| CRUD | Projetos, biblioteca, templates, canais, agendas legadas, exportações, catálogo de mídia |
| Integrações | StockEasy (chave cifrada), Kodi (SSH/JSON-RPC), Screenlet Player (heartbeat, varredura, pareamento) |
| Configurações | `app-settings.json`, `iptv-config.json`, info da máquina |
| Backup | ZIP seletivo por categoria com `manifest.json`, restauração e reinício do app |
| IPTV | Servidor HTTP na porta 7095 |
| Exportação | Bundle do Remotion, sincronização de uploads, `renderMedia`/`renderStill` |
| Armazenamento | Troca da pasta de dados com cópia opcional e reinício |

### Sequência de inicialização

1. Corrige `HOME` e pega a trava de instância única. Uma segunda execução só traz a janela existente para frente.
2. Calcula as pastas (`SCREENLET_DIR`, `UPLOADS_DIR`…), migra `devices.json` da pasta sincronizada para `userData` e carrega `app-settings.json` e `iptv-config.json`.
3. Registra o esquema `app://` como privilegiado, antes do `whenReady`.
4. No `whenReady`:
   - cria as pastas;
   - registra o atalho `Cmd/Ctrl+Shift+I` para o DevTools;
   - registra o handler `app://` (e o servidor de dev, se for o caso);
   - cria a janela e a bandeja.
5. Inicia o IPTV automaticamente se `launchAtLogin` **e** `autoStartIptvOnLaunch` estiverem ativos.
6. Faz o pré-aquecimento do Chrome em segundo plano e verifica atualizações.

### Janela e barra de título

| | macOS | Windows / Linux |
|---|---|---|
| Estilo | `titleBarStyle: "hiddenInset"`, semáforo em (14,10) | `titleBarStyle: "hidden"` + `titleBarOverlay` de 36 px |
| Cores do overlay | — | `#0a0b0e`/`#f7f8fa` (escuro) ou o inverso (claro), atualizadas por IPC `set-titlebar-theme` e por `nativeTheme.on("updated")` |
| Fechar | Fecha normalmente | Com bandeja ativa, só esconde a janela |
| Ajustes no layout | Área de arrasto com `padding-left: 80px` | `padding-right` com `env(titlebar-area-width)`, ou `--win-controls-w: 152px` como fallback |

O tamanho inicial é 1440×960 e a cor de fundo inicial segue o tema do sistema, para não piscar branco ao abrir.

## Renderer

- **Next.js App Router em export estático** (`output: "export"`, `trailingSlash: true`). Não existe servidor Node no runtime; `app/(app)/**/page.tsx` só monta componentes de `src/views/*`.
- **Rotas**: `/`, `/projects`, `/templates`, `/templates/wizard`, `/templates/builder?id=`, `/media-hub`, `/library`, `/renders`, `/channels`, `/devices`, `/iptv`, `/settings`, `/wizard`, `/editor`. O **Studio** não é rota: é um overlay de tela cheia aberto pela tela de Canais.
- **Bootstrap** (`app/providers.tsx`):
  - grava `data-platform` no `<html>`;
  - no Windows, define `--win-controls-w`;
  - monta `TooltipProvider` e o `Toaster` (sonner);
  - chama `initTheme()`.
- **Estado**: 17 stores Zustand. A maioria é um espelho fino de uma chamada IPC (`refresh()` → `window.adFrame.xxxList()`). As exceções guardam estado próprio:
  - `useAdStore`: o projeto aberto no editor;
  - `useWizardStore`: o assistente;
  - `useTemplateInstanceStore`: o template em preenchimento;
  - `useThemeStore`: o tema;
  - `useStoreProfileStore`: os perfis de loja, gravados em `localStorage`.
- **Design system**: tokens em `app/globals.css` mapeados para as variáveis do shadcn, com claro e escuro. A cor primária é `#6e56f8`. Os wrappers em `src/design-system/components` mantêm uma API própria (`Button`, `IconButton`, `Field`, `Dialog`, `Tabs`, `UploadZone`, `ContextMenu`…).

## Como o vídeo é feito hoje

O ponto mais importante para a migração: **prévia e exportação usam o mesmo código React**.

- **Prévia**: `@remotion/player` executa as composições `DynamicAd` ou `TemplateRenderer` dentro do próprio renderer.
- **Exportação** (`export-video`):
  1. `prepareRenderBundle()` usa o bundle Webpack pré-gerado (`out/remotion-bundle`) e copia para `userData/remotion-bundle`, porque `resourcesPath` pode ser somente leitura no Windows. Também sincroniza `assets/` para `public/uploads/` dentro do bundle.
  2. `selectComposition()` e `renderMedia()` sobem N instâncias de Chrome headless, onde N vem de `computeConcurrency()`: reserva 2 GB, ~600 MB por worker, no máximo metade das CPUs e até 8. Cada quadro é capturado como imagem e passado ao FFmpeg do Remotion.
  3. Codec `h264` ou `h265`. O CRF vem da qualidade configurada. A aceleração por hardware é `"if-possible"`.
  4. O progresso chega ao renderer pelo evento `export-progress` (`{phase: "bundling" | "rendering", progress}`).
  5. Ao terminar, `resyncChannelsUsingAsset()` marca os canais que usam o arquivo e reinicia os Kodis atribuídos.
- **Miniatura de projeto**: ao salvar um projeto, roda `renderStill()` do quadro do meio, em segundo plano e sem tratar falhas.

## Protocolo `app://` e caminhos de mídia

Os caminhos de mídia são sempre **relativos** (`uploads/x.png`, `exports/x.mp4`, `project-thumbs/id.jpg`).

| Rota (pathname) | Pasta servida |
|---|---|
| `/uploads/` | `SCREENLET_DIR/assets` |
| `/project-thumbs/` | `SCREENLET_DIR/project-thumbs` |
| `/exports/` | `SCREENLET_DIR/exports` |
| demais | `out/` (o app); rotas desconhecidas caem em `index.html` |

Os arquivos de mídia são servidos com `Content-Type` e suporte a `Range`, para que o `<video>` consiga buscar posição. Não se usa `app://exports/x`, porque no esquema `app://` o primeiro segmento vira host. Em dev, o Next na porta 3000 faz proxy dessas três rotas para o servidor da porta 7096.

## Segurança

- `contextIsolation: true`, `nodeIntegration: false`, e o renderer só enxerga `window.adFrame`.
- Senhas do Kodi, chave do StockEasy e token do Screenlet Player são cifrados com `safeStorage` (Keychain, DPAPI ou libsecret) e **nunca voltam ao renderer**, só flags `hasXxx`.
- `open-external` aceita apenas `http(s)`.
- As rotas de arquivo usam `path.basename` e checagem de contenção contra path traversal.

## Build e distribuição

```
npm run dist:mac
  install-cross-compositors.mjs  → compositores Remotion arm64 + x64
  next build                     → out/ (export estático, com checagem de tipos)
  bundle-remotion.mjs            → out/remotion-bundle/
  electron-builder               → release/*.dmg (arm64 e x64), *.exe (NSIS), Linux
```

- `asar: false`, para que os binários `ffmpeg`/`ffprobe` do Remotion possam ser executados.
- `npmRebuild: false`, porque o `cpu-features` do `ssh2` quebraria o rebuild.
- Entitlement `cs.disable-library-validation`, necessário para as dylibs do ffmpeg.
- **CI** (`.github/workflows/release.yml`): a cada tag `v*`, gera macOS e depois Windows, em sequência para não duplicar a release. Os builds saem **sem assinatura** (`CSC_IDENTITY_AUTO_DISCOVERY: false`), e por isso o auto-update no macOS não consegue aplicar a atualização.
- `appId: com.screenlet.app`, publicado em `github.com/BirdRa1n/Screenlet` como pré-release.

## Dependências relevantes

| Função | Pacote atual |
|---|---|
| UI | next 15, react 19, tailwind 4, radix-ui/shadcn, lucide-react, sonner, framer-motion, @dnd-kit |
| Estado | zustand 5 |
| Vídeo | remotion 4 (`player`, `renderer`, `bundler`, `cli`), @fontsource/inter |
| Backend | ssh2, archiver, yauzl, electron-updater |
| Runtime | electron 42 |
