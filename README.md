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
- Aceleração por GPU quando disponível (NVENC/AMF/QSV), com fallback automático para CPU
- Chrome Headless baixado uma vez e em cache permanente no diretório do usuário
- Concorrência de renderização ajustada automaticamente de acordo com a RAM disponível

### Vídeos renderizados
- Aba **Vídeos** lista todos os MP4s exportados
- Revelar no Finder ou excluir diretamente pela interface

### Canais e Studio
- Crie canais IPTV com nome, descrição e logo
- **Studio** — modal full-screen para montar a playlist de cada canal:
  - Biblioteca de vídeos renderizados (painel esquerdo)
  - Playlist com ordenação, transição por clipe (corte / fade) e loop
- Servidor IPTV embutido na porta 7095 com playlist M3U e guia EPG

### Biblioteca de produtos
- Cadastre produtos reutilizáveis com categorias
- Busca e filtro por categoria
- Importe múltiplos produtos no editor com multi-seleção ordenada

### Wizard de criação
- 5 passos guiados: loja → produtos → template → preview → renderização
- Importação de produtos via CSV

### Projetos
- Salve e carregue projetos com nome personalizado
- Histórico com data de atualização

### Armazenamento
- Todos os dados (projetos, assets, templates, canais, exports) salvos em `~/Documents/Screenlet/`
- Sobrevive a reinstalações e sincroniza via iCloud / OneDrive automaticamente
- Seção **Armazenamento** nas configurações para alterar e migrar a pasta com ou sem cópia dos arquivos

### Configurações
- Tema claro / escuro / sistema (segue o macOS em tempo real)
- Escolha e migração da pasta de armazenamento

---

## Stack

| Camada | Tecnologia |
|---|---|
| Desktop | Electron 42 |
| UI | React 19 + Vite 8 |
| Animações | Framer Motion |
| Vídeo | Remotion 4 |
| Estado | Zustand 5 |
| Drag & Drop | dnd-kit |
| Ícones | Lucide React |

---

## Requisitos

- Node.js 18+
- npm 9+
- macOS (Apple Silicon ou Intel)

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
# Inicia Vite + Electron juntos (recomendado)
npm run electron:dev

# Só o browser (sem Electron APIs)
npm run dev
```

---

## Build

```bash
# Compila TypeScript + Vite + pré-bundle Remotion (dist/remotion-bundle/)
npm run build

# Empacota instaladores macOS (Apple Silicon + Intel)
npm run dist:mac

# Só Apple Silicon
npm run dist:mac:arm64

# Só Intel
npm run dist:mac:intel
```

O script `install-cross-compositors.mjs` é executado automaticamente antes de cada `dist:mac*` para garantir que os binários do Remotion para ambas as arquiteturas estejam presentes — mesmo ao buildar em um Mac ARM64.

---

## Estrutura do projeto

```
src/
  components/
    builder/           # CanvasEditor (drag/resize), Timeline (por camada)
  design-system/
    components/        # Button, Dialog, Field, UploadZone, ContextMenu, etc.
  layout/              # Sidebar, Header, SceneListPanel, PreviewPanel, InspectorPanel
  pages/               # Dashboard, Wizard, Projects, Library, Settings
                       # Templates, TemplateBuilder, TemplateWizard
                       # Channels, Studio, Renders, IptvServer
  remotion/            # DynamicAd, ProductScene, LogoScene, TemplateRenderer,
                       # LayerRenderer, animations, types, template-types
  store/               # useAdStore, useWizardStore, useLibraryStore, useProjectsStore,
                       # useTemplateStore, useTemplateInstanceStore, useNavigationStore,
                       # useChannelStore, useIptvStore, useThemeStore, useToastStore
  styles/
    components/        # CSS dos componentes do design system
    layout/            # CSS dos painéis e layout
    pages/             # CSS das páginas (incluindo Studio.css e Renders.css)
    tokens.css         # Variáveis de design (cores, espaçamento, tipografia)
  templates/           # Templates embutidos (generico, carnes, natal, pascoa)
  types/               # channel.ts (Channel, PlaylistItem, TransitionType)
electron/
  main.cjs             # Processo principal: protocolo app://, armazenamento em ~/Documents/Screenlet/,
                       # exportação MP4 com concorrência adaptativa, servidor IPTV
  preload.cjs          # Bridge window.adFrame (selectImage, exportVideo, channelList, etc.)
scripts/
  bundle-remotion.mjs            # Pré-compila as composições Remotion em dist/remotion-bundle/
  install-cross-compositors.mjs  # Baixa compositors ARM64 e x64 para builds cross-platform
entitlements.plist     # Entitlements macOS para hardened runtime (dylibs do ffmpeg)
```

---

## Licença

Uso privado. Todos os direitos reservados.
