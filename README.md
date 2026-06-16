# VitrineTV

Editor visual de anúncios em vídeo para televisores em pontos de venda — supermercados, lojas e comércio em geral.

Crie apresentações profissionais com produtos, preços e logo da sua marca, e exporte diretamente em **MP4** pronto para exibição em TV.

---

## Funcionalidades

- **Editor visual** com painel de cenas, prévia em tempo real e inspetor de propriedades
- **Cenas de produto** — imagem do produto, nome, preço normal ou oferta (preço de/por), badge personalizável
- **Cenas de logo/chamada** — exibição da marca com tagline animada
- **Logo overlay** — aplique a logo da loja em qualquer canto de cada cena
- **Cores totalmente editáveis** — texto, preços, badges, fundos, por cena
- **Tema claro / escuro** com persistência
- **Exportação em MP4** diretamente pelo app, sem dependências externas

---

## Stack

| Camada | Tecnologia |
|---|---|
| Desktop | Electron 42 |
| UI | React 19 + Vite 8 |
| Animações | Framer Motion 12 |
| Vídeo | Remotion 4 |
| Estado | Zustand 5 |
| Ícones | Lucide React |
| Tipografia | Inter (@fontsource) |

---

## Requisitos

- Node.js 18+
- npm 9+

---

## Instalação

```bash
git clone https://github.com/seu-usuario/vitrinetv.git
cd vitrinetv
npm install
```

---

## Desenvolvimento

```bash
# Inicia Vite + Electron juntos (recomendado)
npm run electron:dev

# Só o browser (sem Electron)
npm run dev
```

---

## Build

```bash
npm run build
```

Gera os arquivos em `dist/`. Para empacotar o instalador do app use [electron-builder](https://www.electron.build/) (não incluído por padrão).

---

## Como usar

1. **Adicione cenas** usando os botões "+ Produto" ou "+ Logo/Texto" no painel esquerdo
2. **Selecione uma cena** para editar suas propriedades no painel direito
3. **Carregue a logo** da loja no topo do painel de cenas (usada em todas as cenas com overlay ativo)
4. **Ajuste cores, textos e preços** diretamente no inspetor
5. **Pré-visualize** o vídeo completo no painel central
6. **Exporte** clicando em "Exportar MP4" no cabeçalho

---

## Estrutura do projeto

```
src/
  design-system/     # tokens CSS + componentes (Button, Field, Card, etc.)
  layout/            # Header, SceneListPanel, PreviewPanel, InspectorPanel
  remotion/          # composições de vídeo (DynamicAd, ProductScene, LogoScene)
  store/             # Zustand (useAdStore, useThemeStore)
electron/
  main.cjs           # processo principal: diálogo de arquivo + exportação
  preload.cjs        # bridge window.vitrineTV
public/
  assets/            # logo e imagens de exemplo
  uploads/           # imagens carregadas pelo usuário (gerado em tempo de execução)
```

---

## Licença

Uso privado. Todos os direitos reservados.
