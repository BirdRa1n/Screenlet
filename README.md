# AdFrame

Editor desktop para criação de vídeos publicitários para supermercados e varejo — TV, Instagram, Stories e TikTok.

Crie anúncios profissionais com produtos, preços e logo da sua marca e exporte diretamente em **MP4**, sem dependências externas.

---

## Funcionalidades

### Editor
- Painel de cenas com drag-and-drop para reordenar
- Prévia em tempo real com `@remotion/player`
- Ao selecionar uma cena, o preview avança automaticamente para aquele ponto do vídeo
- Inspetor de propriedades com edição de cores, textos, preços, logo e variáveis de template

### Tipos de cena
- **Produto** — imagem, nome, preço único ou oferta (de/por), sufixo, badge personalizável
- **Logo/Chamada** — exibição da marca com tagline animada
- **Template** — composição criada no Template Builder, com variáveis preenchíveis no inspetor
- **Vídeo** — arquivo de vídeo local com controle de volume
- **Logo overlay** — aplique a logo em qualquer canto de cada cena produto

### Template Builder
- Canvas visual de arrastar e redimensionar (1920×1080 escalado para o container)
- Timeline de frames por camada com controle de início/fim
- Tipos de camada: texto, imagem, logo, forma, badge, preço, vídeo
- Flip horizontal e vertical em camadas de imagem e logo
- Variáveis tipadas (texto, número, imagem, cor) para personalização por instância
- Galeria de templates com prévia, duplicar, exportar e importar JSON
- Templates embutidos: Genérico, Açougue/Carnes, Natal, Páscoa

### Wizard de Template
- 3 passos: preencher variáveis → preview → escolher formato de exportação

### Exportação multi-formato
| Formato | Resolução | Proporção |
|---|---|---|
| TV / Monitor | 1920 × 1080 | 16:9 |
| Instagram | 1080 × 1080 | 1:1 |
| Stories | 1080 × 1920 | 9:16 |
| TikTok | 1080 × 1920 | 9:16 |

- Aceleração por GPU quando disponível (NVENC/AMF/QSV), com fallback automático para CPU

### Biblioteca de Produtos
- Cadastre produtos reutilizáveis com categorias
- Busca e filtro por categoria
- Importe múltiplos produtos no editor com multi-seleção ordenada

### Wizard de criação
- 5 passos guiados: loja → produtos → template → preview → exportação
- Importação de produtos via CSV
- 4 templates visuais com preview real (Genérico, Açougue, Natal, Páscoa)

### Projetos
- Salve e carregue projetos com nome
- Histórico com data de atualização

### Configurações
- Tema claro / escuro / sistema (segue o macOS em tempo real)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Desktop | Electron |
| UI | React 19 + Vite |
| Animações | Framer Motion |
| Vídeo | Remotion 4 |
| Estado | Zustand 5 |
| Drag & Drop | dnd-kit |
| Ícones | Lucide React |

---

## Requisitos

- Node.js 18+
- npm 9+

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

# Empacota o instalador (macOS — DMG arm64 + x64)
npm run dist:mac
```

O build empacota o Remotion em `dist/remotion-bundle/` durante o processo de build. Em produção, a exportação usa esse bundle pré-compilado sem precisar transpilar no runtime.

---

## Como usar

1. **Crie um projeto** pelo wizard ou abra um existente em Projetos
2. **Adicione cenas** com os botões Produto / Logo/Texto / Biblioteca / Template / Vídeo
3. **Selecione uma cena** — o preview avança automaticamente e o inspetor exibe os campos
4. **Ajuste** cores, textos, preços e imagens no painel direito
5. **Escolha o formato** de exportação no cabeçalho
6. **Exporte** em MP4 com um clique

Para criar um template personalizado, acesse **Templates** na barra lateral e clique em **Novo Template**.

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
  remotion/            # DynamicAd, ProductScene, LogoScene, TemplateRenderer,
                       # LayerRenderer, animations, types, template-types
  store/               # useAdStore, useWizardStore, useLibraryStore, useProjectsStore,
                       # useTemplateStore, useTemplateInstanceStore, useNavigationStore
  styles/
    components/        # CSS dos componentes do design system
    layout/            # CSS dos painéis e layout
    pages/             # CSS das páginas
    tokens.css         # Variáveis de design (cores, espaçamento, tipografia)
  templates/           # Templates embutidos (generico, carnes, natal, pascoa)
electron/
  main.cjs             # Processo principal: protocolo app://, diálogos, exportação MP4
  preload.cjs          # Bridge window.adFrame (selectImage, selectVideo, exportVideo, …)
scripts/
  bundle-remotion.mjs  # Pré-compila as composições Remotion em dist/remotion-bundle/
entitlements.plist     # Entitlements macOS para hardened runtime (dylibs do ffmpeg)
public/
  assets/              # Imagens de exemplo e assets estáticos
```

---

## Licença

Uso privado. Todos os direitos reservados.
