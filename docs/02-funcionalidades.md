# 02 · Funcionalidades

Este documento descreve cada tela e fluxo, na ordem da barra lateral. As regras de negócio estão em **negrito** quando o comportamento não é óbvio.

## Navegação

A barra lateral fixa tem três grupos:

| Grupo | Itens |
|---|---|
| **Content Studio** | Dashboard, Projetos, Templates, Media Hub, Produtos (biblioteca), Vídeos |
| **Broadcasting** | Canais, Dispositivos |
| **IPTV Server** | Servidor IPTV |
| (rodapé) | Configurações |

Ficam fora da barra: o assistente (`/wizard`), o editor (`/editor`), o assistente de template (`/templates/wizard`), o construtor de templates (`/templates/builder`) e o Studio (overlay sobre Canais).

## Primeiro uso

Na primeira abertura, o diálogo **"Bem-vindo ao Screenlet"** resume os Termos de Serviço e tem um link para `https://screenlet.birdra1n.com/termos`. Ao confirmar, grava `termsAcknowledged: true`, e o diálogo não aparece mais.

## Dashboard (`/`)

- Hero "Crie anúncios profissionais em minutos." com o botão **Criar novo anúncio**, que leva ao assistente.
- Quatro contadores: projetos salvos, vídeos exportados, templates disponíveis e mídias no catálogo.
- **Templates prontos**: os quatro templates embutidos, com prévia animada que toca ao passar o mouse. O clique abre o assistente de template.
- **Projetos recentes**: cartões com abrir, renomear e excluir.

## Assistente de anúncio (`/wizard`)

São cinco passos, com barra de progresso e indicadores:

1. **Loja**
   - Escolher um perfil de loja salvo ou criar um novo: nome, logo (upload) e cor da marca (padrão `#6e56f8`).
   - **O perfil é salvo ao avançar**: um upsert por nome, sem diferenciar maiúsculas, em `localStorage`.
2. **Produtos**
   - Lista de produtos com imagem, nome, tipo (oferta "de/por" ou preço único) e preços.
   - **Importar CSV**: o cabeçalho aceita os sinônimos `nome|name|produto`, `preco_de|de|preco_antigo`, `preco_por|por|preco|price`, `sufixo|unidade` e `selo|badge`.
   - **Um produto do CSV vira oferta se houver preço "de"**.
3. **Template**: escolhe um dos quatro presets (Genérico, Açougue, Natal, Páscoa), cada um com prévia animada.
4. **Preview**: player com controles e o resultado final.
5. **Renderizar**: escolhe o formato (TV, Instagram, Stories, TikTok) e então **Renderizar MP4** ou **Ir para o editor**.

Como a configuração é montada (`wizardToAdConfig`):

- Primeiro vem uma cena de **logo** com fundo na cor da marca e a tagline `"<loja> — ofertas imperdíveis!"`, com 60 quadros.
- Depois, uma cena de **produto** por item que tenha nome ou imagem:
  - o destaque usa a cor da marca;
  - `showLogoOverlay` fica ativo se houver logo, no canto superior direito.
- **O preset escolhido no passo 3 não é aplicado ao resultado**: só serve de prévia (ver [06](06-pontos-de-atencao.md)).

## Editor (`/editor`)

O layout tem três painéis e um cabeçalho.

### Cabeçalho

- Nome do projeto e **Salvar**. Salvar com o mesmo nome **sobrescreve** o projeto que tem esse nome.
- **Renderizar**, com escolha de formato.
- Barra de progresso da exportação.

### Painel de cenas (esquerda)

- Upload da logo do projeto.
- Lista de cenas reordenável por arrastar (dnd-kit), com remoção.
- Botões para adicionar cenas:
  - **Produto**;
  - **Logo/Texto**;
  - **Biblioteca**: importa vários produtos da biblioteca como cenas, ligando cada um ao produto de origem (`libraryProductId` + `librarySnapshot`);
  - **Template**: galeria de templates;
  - **Vídeo**: escolhe do catálogo de mídia.

### Prévia (centro)

- Player Remotion com o projeto inteiro.
- **Selecionar uma cena pula a prévia** para o início dela, mais `min(30, 35% da duração)` quadros.

### Inspetor (direita)

O inspetor muda conforme o tipo de cena:

| Tipo de cena | Campos |
|---|---|
| Logo | Tagline, cor da tagline, fundo, duração |
| Produto | Abas *Conteúdo* (imagem pelo Media Picker, nome, modo de preço, preços, sufixo, selo), *Estilo* (cores de fundo, destaque, nome, preço antigo, selo e texto do selo) e *Logo* (mostrar logo e o canto), além da duração |
| Template | Escolha do template e campos gerados pelas variáveis (texto, número, cor, imagem) |
| Vídeo | Arquivo e volume |

### Detecção de produtos desatualizados

Ao abrir o editor, as cenas importadas da biblioteca são comparadas com o produto atual.

- **Só conta como mudança o que a biblioteca alterou desde a importação**, comparando o produto atual com o snapshot. Edições feitas pelo usuário na cena são preservadas.
- Se houver diferenças, aparece o diálogo "Produtos desatualizados", que lista os campos alterados e permite atualizar todas as cenas de uma vez.

### Fluxo de renderização

O fluxo é o mesmo no editor, no assistente e no assistente de template:

1. O diálogo "Qualidade de renderização" pede o nome do arquivo (em branco usa o nome do projeto) e o FPS (30, recomendado, ou 60).
2. **Se já existir um arquivo com esse nome, ele é substituído.**
3. Se o projeto tiver cenas de template, a lista completa de templates vai junto no payload.
4. Ao terminar, aparece um toast de sucesso e outro para cada canal que usava aquele arquivo e foi atualizado ("as telas estão sendo sincronizadas").

## Projetos (`/projects`)

Grade com miniatura (o quadro do meio do vídeo, gerado ao salvar), nome e data de edição. Cada cartão permite abrir no editor, renomear e excluir.

## Templates (`/templates`)

- Galeria com filtro por tag. Os quatro templates embutidos aparecem como **"Oficial"**: não podem ser editados nem excluídos, só duplicados.
- Ações por cartão: editar (abre o construtor), duplicar, excluir, **exportar** (baixa `<nome>.adframe.json`) e **usar** (abre o assistente de template).
- **Importar**: lê um `.adframe.json`, gera um id novo e grava como template do usuário.
- **Novo template** abre o construtor vazio.

### Assistente de template (`/templates/wizard`)

- Formulário gerado pelas variáveis do template:
  - texto e número viram campo de texto;
  - cor vira seletor e campo hex;
  - imagem vira Media Picker.
- Prévia ao vivo.
- **Variáveis marcadas como obrigatórias bloqueiam o avanço** e mostram a lista do que falta.
- Escolha de formato e renderização.

### Construtor de templates (`/templates/builder?id=`)

- **Coluna de cenas**: adicionar e remover cenas; cada cena tem nome, duração em quadros e cor de fundo.
- **Camadas**: adicionar texto, imagem, forma e badge; selecionar e remover.
- **Canvas**:
  - mover e redimensionar com oito alças, com tamanho mínimo de 20 px;
  - **imã para o centro** horizontal e vertical a menos de 8 px, com guias visuais;
  - zoom de 25% a 400%.
- **Abas Canvas / Prévia** (o player toca o template).
- **Timeline**: régua clicável e uma barra por camada, que pode ser movida ou redimensionada pelas bordas e define `startFrame`/`endFrame` da camada.
- **Propriedades** por camada:
  - nome, posição, tamanho, rotação, opacidade, z-index e início/fim em quadros;
  - texto (com `{{VAR}}`), tamanho, peso, cor e alinhamento;
  - forma (retângulo ou círculo), preenchimento e arredondamento;
  - badge (texto, fundo, cor do texto, tamanho da fonte);
  - imagem (variável opcional, ajuste `contain`/`cover`, espelhar horizontal e vertical).
- **Animações**:
  - presets (Fade In, Slide ←→↑↓, Zoom In e outros) que podem ser empilhados;
  - remover uma animação ou limpar todas.
- **Salvar** grava o template do usuário. Templates embutidos não são salvos.

## Media Hub (`/media-hub`)

- Catálogo de imagens e vídeos com miniaturas. As de vídeo são geradas no próprio cliente, capturando um quadro com `<video>` e `<canvas>`.
- **Importar imagem / Importar vídeo** passam por deduplicação **SHA-256**: o mesmo arquivo nunca é copiado duas vezes.
- **Remover tira o item do catálogo, mas não apaga o arquivo**, porque projetos antigos podem referenciá-lo.
- **Descoberta automática**: qualquer arquivo colocado em `assets/` aparece sozinho.
- O **Media Picker**, um diálogo com a grade do catálogo e o botão de importar, é reutilizado no inspetor, no assistente de template, no construtor e na escolha de vídeo.

## Produtos / Biblioteca (`/library`)

- Produtos reutilizáveis, com:
  - imagem, nome, categoria e **referência** no PDV/ERP (opcional);
  - modo de preço, preços, sufixo e selo.
- Filtro por categoria ("Todos" mais as categorias existentes).
- Ações por produto:
  - editar e excluir;
  - **usar no assistente**, que adiciona o produto ao assistente;
  - **sincronizar preço**, quando a integração está ativa e o produto tem referência.
- **Sincronizar tudo**:
  1. Na primeira vez, pergunta qual loja do StockEasy usar e lista as lojas que aparecem nos preços do primeiro produto consultado. A escolha fica gravada como `selectedStore`.
  2. Para cada produto, consulta pela referência e aplica o preço daquela loja como `newPrice`.
  3. Mostra um resumo com o número de sucessos e o primeiro erro.

## Vídeos renderizados (`/renders`)

Lista os MP4 em `exports/`, com nome, tamanho e data. Ações:

- **Play**, que abre um diálogo com `<video>`;
- **Revelar no Finder/Explorer**;
- **Excluir**, que apaga o arquivo;
- **Abrir pasta** e **Atualizar**.

## Canais (`/channels`)

- Cartões de canal com nome, descrição, contagem de itens e um **ativar/desativar**. **Só canais ativos entram no M3U.**
- **Novo / Editar canal**: nome e descrição. Os demais campos são mantidos ao editar, **exceto `rules`**: esse é um bug, ver [06](06-pontos-de-atencao.md).
- **Abrir** mostra o **Studio**.
- **Salvar um canal reinicia todos os Kodis atribuídos a ele.**

### Studio (overlay de tela cheia)

O Studio tem três abas:

| Aba | O que faz |
|---|---|
| **Playlist** | À esquerda, a biblioteca de vídeos renderizados; clicar adiciona o vídeo. À direita, a playlist, com subir/descer, transição por item (corte ou fade) e remover |
| **Pré-visualizar** | `<video>` que toca a playlist na ordem. Ao acabar um item, vai para o próximo; no último, volta ao início se o loop estiver ligado, senão para. Dá para clicar num item para pular até ele |
| **Horários** | Regras de programação: cada regra liga um vídeo a uma condição, que pode ser "sempre", "faixa de horário" (aceita virar a meia-noite, ex.: 22:00–06:00) ou "dias da semana". A **primeira regra que casar vence** |

O rodapé tem o loop, **Salvar** (grava a playlist, o loop e as regras) e Cancelar.

## Dispositivos (`/devices`)

### Kodi / LibreELEC

O cadastro é um assistente em três passos:

1. **Acesso SSH**: IP, porta, usuário e senha.
2. **Kodi HTTP**:
   - porta, usuário e senha;
   - o botão **"Buscar configuração"** lê o `guisettings.xml` por SSH e preenche os campos sozinho; avisa se o servidor web do Kodi estiver desligado.
3. **Programação**:
   - canal padrão do Screenlet;
   - canal do Kodi, escolhido pela lista que o Kodi devolve via JSON-RPC;
   - atraso de reinício (padrão 20 s).

Cada cartão tem **Testar**, que mostra a versão do JSON-RPC, **Reiniciar e abrir**, que reinicia o Kodi por SSH e, depois do atraso, abre o canal, editar e excluir.

### Screenlet Player

- **Detectados**: aparecem por heartbeat (o player conhece o endereço do Studio) ou pela **varredura de rede**. A varredura percorre as sub-redes locais até /23, com 48 conexões simultâneas e timeout de 800 ms, consultando `GET :8089/identify`. **Players já pareados com outro Studio são ignorados.**
- **Parear**:
  - define um nome e um canal;
  - o Studio chama `POST <player>/claim` e guarda o token cifrado;
  - se já houver token, reaproveita sem chamar `/claim` de novo.
- **Pareados**: nome, canal, se está tocando, versão, último contato, **desparear** e excluir.

## Servidor IPTV (`/iptv`)

- **Iniciar/Parar** o servidor na porta 7095, mostrando o status.
- **Seletor de interface de rede**: lista as IPs ordenadas por `192.168` → `10.` → `172.16–31` → VPN/Tailscale. A escolha é persistida.
- Endpoints com botão de copiar: playlist M3U (`/playlist.m3u`) e EPG (`/epg.xml`).
- Aviso quando o **ffmpeg** não é encontrado no sistema, porque o stream por canal depende dele.
- **"Programação agora"**: para cada canal, o vídeo que está no ar segundo o motor de regras, atualizado a cada minuto. **Esse painel é só informativo**: o stream real não aplica as regras (ver [06](06-pontos-de-atencao.md)).

## Configurações (`/settings`)

| Seção | Opções |
|---|---|
| Aparência | Claro, escuro ou sistema; o modo sistema acompanha a mudança do SO em tempo real |
| Inicialização (só Windows) | Iniciar com o Windows, minimizado na bandeja; iniciar o IPTV automaticamente |
| Vídeo e renderização | Codec H.264 ou H.265; qualidade alta, média ou baixa (CRF 18/23/28 no H.264 e 24/28/33 no H.265); aceleração de hardware |
| Integrações | StockEasy: ativar, salvar ou remover a chave de API, URL base, trocar a loja |
| Dados (backup) | Escolher categorias e criar backup; pasta de backups; lista com data e tamanho; importar de um backup da lista ou de um arquivo; restauração seletiva e reinício |
| Armazenamento | Pasta atual; abrir; **alterar localização**, com cópia opcional dos dados e reinício do app |
| Informações da máquina | SO, arquitetura, CPU, núcleos, RAM total e livre, concorrência de render, versões e pasta de dados |
| Sobre | Versão do app |

As categorias de backup são: projetos (e miniaturas), mídia, vídeos renderizados, templates, biblioteca, canais (e agendas), dispositivos (credenciais) e configurações/integrações.

## Comportamentos de sistema

- **Instância única**: abrir de novo só traz a janela existente.
- **Bandeja (Windows)**: fechar esconde a janela, e o servidor IPTV continua rodando. "Sair" encerra.
- **`--hidden`**: abre direto na bandeja; é usado pela inicialização automática.
- **Auto-update**: na abertura, consulta as releases. Se houver versão nova, pergunta "Instalar agora / Agora não"; ao aceitar, baixa e reinicia; se recusar, aplica ao sair.
- **Atalho** `Cmd/Ctrl+Shift+I`: abre o DevTools.
