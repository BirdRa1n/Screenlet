# Screenlet

Plataforma desktop de **digital signage** para criação, gerenciamento e transmissão de vídeos publicitários — TV, Instagram, Stories e TikTok.

Crie anúncios com produtos, preços e logo da sua marca, exporte em **MP4**, organize em canais e transmita via **IPTV** para Smart TVs na rede local.

---

## Funcionalidades

### Editor de anúncios
- Painel de cenas com drag-and-drop para reordenar
- Prévia em tempo real com `@remotion/player`
- Ao selecionar uma cena, o preview avança automaticamente para aquele ponto
- Inspetor de propriedades com edição de cores, textos, preços, logo e variáveis de template

### Tipos de cena
- **Produto** — imagem, nome, preço único ou oferta (de/por), sufixo, badge personalizável
- **Logo/Chamada** — exibição da marca com tagline animada
- **Template** — composição criada no Template Builder, com variáveis preenchíveis no inspetor
- **Vídeo** — arquivo de vídeo local com controle de volume

### Template Builder
- Canvas visual de arrastar e redimensionar (1920×1080 escalado para o container)
- Timeline de frames por camada com controle de início/fim
- Tipos de camada: texto, imagem, logo, forma, badge, preço, vídeo
- Flip horizontal e vertical em camadas de imagem e logo
- Variáveis tipadas (texto, número, imagem, cor) para personalização por instância
- Galeria de templates com prévia, duplicar, exportar e importar JSON
- Templates embutidos: Genérico, Açougue/Carnes, Natal, Páscoa

### Renderização
- Diálogo de renderização com nome do arquivo e seleção de FPS (30 ou 60)
- Nome em branco usa o nome do projeto (ex.: `projeto.mp4`); se o arquivo já existir, é **sobrescrito**
- Ao sobrescrever um vídeo já usado por um canal, a programação é atualizada **mantendo a posição na grade** e as telas atribuídas são re-sincronizadas — com aviso por toast informando qual canal foi atualizado
- Aceleração por GPU quando disponível (NVENC/AMF/QSV), com fallback automático para CPU
- Chrome Headless baixado uma vez e em cache permanente no diretório do usuário
- Concorrência de renderização ajustada automaticamente de acordo com a RAM disponível

### Vídeos renderizados
- Aba **Vídeos** lista todos os MP4s exportados
- Pré-visualizar (player embutido), revelar no Finder ou excluir diretamente pela interface

### Canais e Studio
- Crie canais IPTV com nome, descrição e logo
- **Studio** — modal full-screen para montar a playlist de cada canal, com 3 abas:
  - **Playlist** — biblioteca de vídeos renderizados (painel esquerdo) + ordenação, transição por clipe (corte / fade) e loop (painel direito)
  - **Pré-visualizar** — player que reproduz a playlist na ordem configurada, simulando a transmissão real do canal
  - **Horários** — regras de programação por horário e dia da semana
- Servidor IPTV embutido na porta 7095 com playlist M3U e guia EPG
- Seletor de interface de rede — escolha por qual adaptador transmitir (rede local, Tailscale/VPN, etc.); preferência persistida entre sessões

### Dispositivos
- **Kodi/LibreELEC** — cadastre boxes Kodi via SSH, teste conexão, liste canais e reinicie/abra o IPTV remotamente. Credenciais armazenadas com criptografia.
- **Screenlet Player** — pareie players Linux dedicados (projeto irmão `screenlet-player`, baseado em mpv) varrendo a rede local, associe a um canal e acompanhe o status de cada dispositivo pareado. O player baixa e cacheia o conteúdo do canal localmente (manifesto exposto em `/api/player/sync` + rota `/exports`), então continua reproduzindo a última programação mesmo após reiniciar sem o servidor disponível.

### Media Hub
- Catálogo central de todas as imagens e vídeos importados, com miniaturas (inclusive para vídeos, geradas a partir de um frame do clipe)
- Deduplicação automática por hash do arquivo
- Seletor de mídia reutilizado no editor, no Template Builder e no Wizard

### Biblioteca de produtos
- Cadastre produtos reutilizáveis com categorias e um campo opcional de **referência** (código no PDV/ERP)
- Busca e filtro por categoria
- Importe múltiplos produtos no editor com multi-seleção ordenada
- **Sincronizar** preço a partir da integração StockEasy (por produto ou em lote); na primeira sincronização você escolhe a loja de referência
- Ao abrir um projeto no editor, produtos importados da biblioteca que ficaram desatualizados (imagem, preço, descrição…) são detectados e podem ser atualizados sem reimportar tudo

### Integrações
- Seção **Integrações** nas configurações para conectar sistemas externos (PDV/ERP) aos dados dos produtos
- **StockEasy** — informe a chave de API (armazenada criptografada via `safeStorage`, nunca exposta ao renderer) para buscar preços e dados pela referência do produto

### Wizard de criação
- 5 passos guiados: loja → produtos → template → preview → renderização
- Importação de produtos via CSV

### Projetos
- Salve e carregue projetos com nome personalizado
- Histórico com data de atualização
- Miniatura gerada automaticamente para cada projeto salvo

### Armazenamento
- Todos os dados (projetos, assets, templates, canais, exports) salvos em `~/Documents/Screenlet/`
- Sobrevive a reinstalações e sincroniza via iCloud / OneDrive automaticamente
- Seção **Armazenamento** nas configurações para alterar e migrar a pasta com ou sem cópia dos arquivos

### Configurações
- Tema claro / escuro / sistema (acompanha a preferência do sistema operacional em tempo real)
- Escolha e migração da pasta de armazenamento
- **Inicialização (Windows)**: iniciar o Screenlet junto com o sistema (minimizado na bandeja/tray) e, opcionalmente, já iniciar o servidor IPTV automaticamente

---

## Stack

| Camada | Tecnologia |
|---|---|
| Desktop | Electron 42 |
| UI | Next.js 15 (App Router, static export) + React 19 |
| Estilo | Tailwind CSS v4 + shadcn/ui (Radix) |
| Animações | Framer Motion |
| Vídeo | Remotion 4 |
| Estado | Zustand 5 |
| Drag & Drop | dnd-kit |
| Ícones | Lucide React |

---

## Requisitos

- Node.js 18+
- npm 9+
- macOS (Apple Silicon ou Intel) ou Windows 10/11 x64

---

## Instalação

```bash
git clone https://github.com/BirdRa1n/AdFrame.git
cd AdFrame
npm install
```

---

## Desenvolvimento

```bash
# Inicia Next (dev server) + Electron juntos (recomendado)
npm run electron:dev

# Só o browser em http://localhost:3000 (sem Electron APIs)
npm run dev
```

---

## Build

```bash
# Static export do Next (out/) + pré-bundle Remotion (out/remotion-bundle/)
npm run build

# Empacota instaladores macOS (Apple Silicon + Intel)
npm run dist:mac

# Só Apple Silicon
npm run dist:mac:arm64

# Só Intel
npm run dist:mac:intel

# Instalador Windows
npm run dist:win

# Linux
npm run dist:linux
```

O script `install-cross-compositors.mjs` é executado automaticamente antes de cada `dist:mac*` para garantir que os binários do Remotion para ambas as arquiteturas estejam presentes — mesmo ao buildar em um Mac ARM64.

---

## Estrutura do projeto

```
app/                   # Next.js App Router (static export)
  layout.tsx           # Root layout + providers.tsx (tema, tooltip, toaster, platform)
  globals.css          # Tema: tokens da marca → variáveis shadcn (claro/escuro)
  (app)/               # Grupo com a Sidebar; uma rota por página:
                       # / projects library media-hub renders templates
                       # templates/builder templates/wizard channels devices
                       # iptv settings wizard editor
src/
  components/
    ui/                # Primitivos shadcn (button, dialog, tabs, input, ...)
    builder/           # CanvasEditor (drag/resize), Timeline (por camada)
    media/             # MediaPicker, MediaPickerDialog (catálogo de mídia)
    programming/       # ProgrammingTimeline, ProgrammingRuleBlock, ProgrammingRuleForm
    RemotionPlayer.tsx # Wrapper client-only do <Player> (seguro no static export)
  design-system/
    components/        # Wrappers sobre shadcn com a API do app (Button, Dialog, Field, ...)
  layout/              # Sidebar, Header, SceneListPanel, PreviewPanel, InspectorPanel, PageShell
  lib/                 # utils.ts (cn), exportFormats.tsx, programmingEngine.ts
  views/               # Dashboard, Wizard, Editor, Projects, Library, Settings, MediaHub,
                       # Devices, Templates, TemplateBuilder, TemplateWizard,
                       # Channels, Studio, Renders, IptvServer
  remotion/            # DynamicAd, ProductScene, LogoScene, TemplateRenderer,
                       # LayerRenderer, animations, types, template-types
  store/               # useAdStore, useWizardStore, useLibraryStore, useProjectsStore,
                       # useTemplateStore, useTemplateInstanceStore,
                       # useChannelStore, useIptvStore, useThemeStore, useToastStore,
                       # useMediaStore, useRendersStore, useAppSettingsStore,
                       # useDeviceStore, usePlayerDeviceStore
  templates/           # Templates embutidos (generico, carnes, natal, pascoa)
  types/               # channel.ts, device.ts (Kodi), playerDevice.ts (Screenlet Player), media.ts
electron/
  main.cjs             # Processo principal: protocolo app:// (serve out/), dev asset server (7096),
                       # armazenamento em ~/Documents/Screenlet/, exportação MP4 e thumbnails,
                       # servidor IPTV, tray/autostart (Windows), Screenlet Player, SSH para Kodi
  preload.cjs          # Bridge window.adFrame (selectImage, exportVideo, channelList, etc.)
next.config.mjs        # output: export, distDir: out, rewrites dev p/ assets
components.json        # Config do shadcn (alias @/* → src/*, base radix)
scripts/
  bundle-remotion.mjs            # Pré-compila as composições Remotion em out/remotion-bundle/
  install-cross-compositors.mjs  # Baixa compositors ARM64 e x64 para builds cross-platform
entitlements.plist     # Entitlements macOS para hardened runtime (dylibs do ffmpeg)
```

---

## Licença

Uso privado. Todos os direitos reservados.
