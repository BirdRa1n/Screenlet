# 05 · Motor de vídeo (especificação quadro a quadro)

Este é o documento mais importante para a migração. Ele descreve, sem depender do React nem do Remotion, **o que é desenhado em cada quadro**. A versão Qt precisa reproduzir isto para que os projetos existentes fiquem iguais.

## Conceitos

- O tempo é medido em **quadros inteiros**. `fps` é 30 (ou 60, escolhido na exportação). A duração do vídeo é a soma de `durationInFrames` de todas as cenas.
- As cenas tocam **em sequência, sem sobreposição e sem transição entre si**. A cena *i* começa no quadro `Σ durações anteriores`, e `frame` passa a ser o quadro **local** da cena (começa em 0).
- O fundo da composição é preto (`#000`).
- **Escala**: as cenas de logo e de produto foram desenhadas para 1920×1080 e usam `sc = min(W/1920, H/1080)`. Os templates usam coordenadas absolutas no espaço `template.width × template.height`.
- **Exportar em 60 fps não muda as durações em quadros**, então o vídeo fica com metade da duração em segundos. É um comportamento herdado, a decidir (ver [06](06-pontos-de-atencao.md)).

## Funções auxiliares (semântica do Remotion)

```
interpolate(x, [x0, x1, …], [y0, y1, …], clamp)   // linear por trechos
  extrapolateLeft/Right "clamp" = prende nos extremos (padrão quando especificado)
  sem clamp = extrapola linearmente

spring(frame, fps, {damping, mass, stiffness = 100})
  oscilador harmônico amortecido de 0 → 1, simulado no tempo t = frame/fps;
  frame < 0 ⇒ 0. overshoot permitido (damping baixo passa de 1 e volta).

Easing.ease      = cubic-bezier(0.42, 0, 1, 1)
Easing.in(f)     = f(t)
Easing.out(f)    = 1 − f(1 − t)
Easing.inOut(f)  = t < .5 ? f(2t)/2 : 1 − f(2(1 − t))/2
```

## Cena de logo (`logo`)

O layout é uma coluna centralizada, com `gap = 40·sc`, fundo `bg` e fonte Helvetica/Arial.

| Elemento | Propriedades | Animação |
|---|---|---|
| Logo (`logoImage`, se houver) | largura `720·sc`, altura máx. `420·sc`, `contain`, sombra `drop-shadow(0 20px 30px rgba(0,0,0,.4))` | `s = spring(frame, {damping:12, mass:0.6})`; `scale = interp(s, [0,1] → [0.3,1])`; `opacity = interp(frame, [0,12] → [0,1])` com clamp |
| Tagline | cor `taglineColor`, `46·sc` px, peso 700, `letter-spacing 1`, centralizada, padding horizontal `80·sc` | `opacity = interp(frame, [18,30] → [0,1])`; `translateY = interp(frame, [18,30] → [30,0])` px, com clamp |

## Cena de produto (`product`)

**Layout**:

- **Paisagem** (W > H): linha com duas metades iguais. À esquerda a imagem, à direita o texto alinhado à esquerda, com padding `0 80·sc 0 0`.
- **Retrato ou quadrado**: coluna. A imagem ocupa 45% da altura e o texto 50%, centralizado, com padding lateral `60·sc`.

Fundo `bg`, fonte Helvetica/Arial.

### Elementos

Os blocos do texto ficam separados por `gap = 24·sc`.

| Elemento | Propriedades |
|---|---|
| Imagem | altura 75% do bloco (80% no retrato), largura máx. 90%, `contain`, `drop-shadow(0 30px 40px rgba(0,0,0,.45))` |
| Nome | `productNameColor`, `56·sc` px, peso 800, MAIÚSCULAS, `letter-spacing 1`, `text-shadow 0 4px 12px rgba(0,0,0,.4)` |
| Preço antigo (só em oferta) | `"De R$ {oldPrice}"`, `oldPriceColor`, `36·sc`, riscado, opacidade 0.75 |
| Linha do preço | linha alinhada pela base, `gap 16·sc`. Em oferta, começa com `"por"` (`accentColor`, `38·sc`, peso 700). Depois vem `"R$ {newPrice}"` (`accentColor`, `130·sc`, peso 900, `line-height 1`, `text-shadow 0 6px 18px rgba(0,0,0,.5)`) e, colado, `priceSuffix` em `44·sc` |
| Selo (se `badgeText`) | fundo `badgeColor`, texto `badgeTextColor`, `30·sc`, peso 800, MAIÚSCULAS, padding `10·sc 28·sc`, raio 999, `box-shadow 0 8px 20px rgba(0,0,0,.35)` |
| Logo sobreposta (se `showLogoOverlay`) | posição absoluta a 36 px do canto `logoPosition`, largura 180, altura máx. 110, `contain`, `drop-shadow(0 8px 16px rgba(0,0,0,.45))`. **Esses 36/180/110 px não usam `sc`** |

### Animações

| Elemento | Fórmula |
|---|---|
| Imagem | `s = spring(frame, {damping:200, mass:0.6})`; `scale = interp(s → [0.6,1])`; `opacity = interp(frame, [0,15] → [0,1])` |
| Bloco de texto | `s = spring(frame−10, {damping:200, mass:0.5})`; `desloc = interp(s → [80·sc, 0])` em X na paisagem ou Y no retrato; `opacity = interp(frame, [10,25] → [0,1])` |
| Bloco de preço | `s = spring(frame−25, {damping:12, mass:0.5})`; `scale = interp(s → [0,1])`. A origem fica à esquerda e no centro na paisagem, e no centro no retrato |
| Linha do preço | pulso contínuo `scale = 1 + 0.03·sin(frame/6)` |

## Cena de vídeo (`video`)

Desenha `src` em tela cheia com `width/height 100%`, ou seja, preenche esticando, sem `cover`. Aplica o volume `volume` e toca a partir do quadro 0 da cena. O vídeo é cortado na duração da cena.

## Cena de template (`template`)

1. Busca o template por `templateId` (no payload `templates` ou na lista local). Se não achar, a cena fica preta.
2. Resolve as variáveis:
   - `valores = { para cada variável: values[key] ?? defaultValue }`;
   - substitui `{{KEY}}` (regex `\{\{([A-Z0-9_]+)\}\}`, chave ausente vira `""`) em `text.text`, `image.src`, `price.oldPrice/newPrice/suffix` e `badge.text`.
3. As cenas internas do template tocam **em sequência** dentro da cena do projeto. Cada uma pinta `backgroundColor` (valor CSS) e `overflow: hidden`.
4. As camadas são ordenadas por `zIndex` crescente. Só são desenhadas quando `startFrame ?? 0 ≤ quadro ≤ endFrame ?? duração` e `visible`.
5. A logo das camadas `logo` vem de `values.LOGO` ou do `defaultValue` da variável `LOGO`.

> **Atenção:** a duração da cena de template no projeto (`durationInFrames`, padrão 150) e a soma das cenas internas do template são independentes. A cena do projeto corta ou sobra (preto) conforme a diferença.

### Desenho das camadas

Cada camada é uma caixa absoluta em (`x`, `y`, `width`, `height`), com `rotate(rotation°)` em torno do centro e a transformação e opacidade das animações (abaixo).

| Tipo | Desenho |
|---|---|
| `shape` | Fundo `fill` (CSS: cor sólida **ou gradiente**). `circle` usa raio 50%; `rect` usa `borderRadius`. Borda opcional `border` (CSS, ex.: `"4px solid #fff"`) |
| `text` | Flex centralizado na vertical, horizontal por `align`. Fonte **Inter**, `fontSize`, `fontWeight`, `color`, `lineHeight` (1.2), `letterSpacing`. Quebra de linha normal dentro da largura |
| `badge` | Caixa com fundo `bg` e raio `borderRadius`; texto centralizado `textColor`, `fontSize`, peso 700, padding lateral 16, fonte Inter |
| `price` | Coluna centralizada com `gap 4`. Em oferta, primeiro `"R$ {oldPrice}"` (`0.45·fontSize`, `oldPriceColor`, riscado, opacidade 0.75). Depois `"R$ {newPrice}"` (`fontSize`, peso 900, `accentColor`, `line-height 1`) e o sufixo (`0.4·fontSize`, `textColor`) |
| `image` | `src` com `contain`/`cover` e recorte na caixa; espelhamento com `scaleX(−1)`/`scaleY(−1)` |
| `logo` | Igual a `image`, com a logo como origem |
| `video` | Vídeo com `cover`, `volume`, começando em `startFrom`. O campo `loop` existe, mas não é usado |

### Animações de camada

Cada animação ativa no quadro local da cena, isto é, com `startFrame ≤ f ≤ startFrame + durationInFrames`, calcula um progresso:

`p = easing(clamp((f − startFrame) / durationInFrames, 0, 1))`

| Tipo | Efeito |
|---|---|
| `fadeIn` | opacidade `p` |
| `fadeOut` | opacidade `1 − p` |
| `slideLeft` | `tx = 120·(1−p)`, opacidade `p` |
| `slideRight` | `tx = −120·(1−p)`, opacidade `p` |
| `slideUp` | `ty = 80·(1−p)`, opacidade `p` |
| `slideDown` | `ty = −80·(1−p)`, opacidade `p` |
| `zoomIn` | `scale = 0.4 + 0.6p`, opacidade `p` |
| `zoomOut` | `scale = 1 − 0.6p`, opacidade `1 − p` |
| `scale` | `scale = 0.7 + 0.3p` |
| `slideOut` | `tx = 200p`, opacidade `1 − p` |
| `rotate` | `rot = 360p` |
| `pulse` | `scale = 1 + 0.06·sin(4πp)` |
| `bounce` | `ty = −40·|sin(3πp)|·(1−p)` |
| `shake` | `tx = sin(1.8·(f − startFrame)) · k`, com `k = 8` até `p = 0.7` e depois indo linearmente a 0 em `p = 1` |
| `glow` | `scale = 1 + 0.04·sin(6πp)` e, além disso, o filtro `drop-shadow(0 0 b px rgba(255,255,255,.7))`, com `i = 0.5 + 0.5·sin(6π·(f−start)/dur)` e `b = round(8 + 16i)` |
| `typewriter` | só em `text`: mostra `floor((f − start)·len/dur)` caracteres (limitado ao total) |

Regras de composição:

- Opacidades e escalas **se multiplicam**; deslocamentos e rotações **se somam**.
- A opacidade parte de `layer.opacity`.
- A transformação aplicada é `translate(tx, ty) scale(s) rotate(r)`, nessa ordem, **somada** à `rotation` base da camada.
- **Fora da janela de uma animação, ela não tem efeito.** Isso gera três casos:
  - um `fadeIn` de 0 a 20 fica com opacidade total depois do quadro 20, como se espera;
  - um `fadeIn` que começa no quadro 10 deixa a camada **visível por inteiro nos quadros 0 a 9** e só então ela "some" e reaparece;
  - um `fadeOut` faz a camada **reaparecer** ao terminar.

  Esse comportamento atual precisa ser preservado por compatibilidade ou corrigido de propósito na migração.
- O `typewriter` usa `elapsed = max(0, f − start)` **sem** limitar ao fim da janela. Por isso o texto fica completo depois que a animação termina.

## Prévias

- **Editor**: player com o projeto inteiro, que busca a posição ao selecionar uma cena.
- **Galeria de templates**: começa no quadro `min(duração da 1ª cena + 30, total−1)` e só toca ao passar o mouse.
- **Assistente (passo 3)**: começa em `min(logo + 30, total−1)` e toca em loop.
- **Miniatura de projeto**: quadro `floor(total/2)`, JPEG com qualidade 80.

## Fontes

| Onde | Fonte |
|---|---|
| Cenas de logo e produto | `Helvetica, Arial, sans-serif` (fonte do sistema) |
| Camadas de template | `Inter, sans-serif`; a Inter é empacotada via `@fontsource/inter` |

Na versão Qt, empacote a Inter e escolha uma Helvetica equivalente embutida (por exemplo, Inter ou Arimo), para que o resultado seja o mesmo em todas as máquinas.
