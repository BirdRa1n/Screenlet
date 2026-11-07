# Documentação do Screenlet

Documentação técnica e funcional da versão atual do Screenlet (Electron + Next.js + Remotion, versão `1.0.0-beta.2`), escrita como base para a migração para Qt na branch `refactor/qt-migration`.

O objetivo é que qualquer pessoa consiga reconstruir o app a partir destes documentos sem precisar ler o código antigo: o que cada tela faz, como os dados são guardados, quais protocolos o app fala com TVs e players, e exatamente como cada cena de vídeo é desenhada quadro a quadro.

## O que é o Screenlet

O Screenlet é um app desktop de **digital signage** para varejo (supermercados, açougues, lojas). Com ele, o lojista:

1. **Cria anúncios em vídeo** com produtos, preços, ofertas "de/por", selos e a logo da loja, usando um assistente, um editor de cenas ou templates.
2. **Exporta MP4** em quatro formatos: TV (1920×1080), Instagram (1080×1080), Stories e TikTok (1080×1920).
3. **Monta canais** com playlists, transições e regras de horário.
4. **Transmite na rede local** por um servidor IPTV embutido (M3U + EPG + stream MPEG-TS) para Smart TVs, boxes Kodi e o **Screenlet Player** (player Linux próprio, que baixa e guarda o conteúdo para tocar offline).

## Índice

| Documento | Conteúdo |
|---|---|
| [01 · Arquitetura](01-arquitetura.md) | Processos, camadas, inicialização, protocolo `app://`, build e distribuição |
| [02 · Funcionalidades](02-funcionalidades.md) | Cada tela e fluxo do usuário, com regras de negócio |
| [03 · Modelo de dados](03-modelo-de-dados.md) | Estrutura de pastas, todos os formatos JSON e onde cada um fica |
| [04 · Interfaces](04-interfaces.md) | API interna (IPC), servidor IPTV/HTTP e integrações externas (Kodi, Screenlet Player, StockEasy) |
| [05 · Motor de vídeo](05-motor-de-video.md) | Especificação quadro a quadro das cenas, camadas e animações (base para a paridade visual) |
| [06 · Pontos de atenção](06-pontos-de-atencao.md) | Bugs, dívidas técnicas e decisões a tomar na migração para Qt |
| [07 · Versão Qt](07-versao-qt.md) | O que já foi portado, onde está o código e limitações conhecidas |

## Números do código atual

| Área | Linhas | Arquivos |
|---|---|---|
| Processo principal (`electron/main.cjs` + `preload.cjs`) | ~2.900 | 2 |
| Telas (`src/views`) | ~5.650 | 15 |
| Componentes, layout e design system | ~4.400 | 41 |
| Stores (Zustand) | ~1.000 | 17 |
| Composições de vídeo (`src/remotion`) + templates embutidos | ~1.900 | 17 |
| Testes automatizados | 0 | 0 |

Toda a interface está em **português do Brasil**.
