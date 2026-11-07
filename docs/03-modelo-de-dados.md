# 03 · Modelo de dados

Todos os dados são **arquivos JSON** em disco, sem banco de dados. A versão Qt deve **ler esses mesmos arquivos** para migrar sem atrito.

## Onde cada coisa fica

### Pasta de dados (`SCREENLET_DIR`)

O padrão é `~/Documents/Screenlet`. O usuário pode trocar, e a escolha fica em `userData/storage-config.json` (`{ "baseDir": "..." }`). Essa pasta pode estar sincronizada com iCloud ou OneDrive.

```
SCREENLET_DIR/
  assets/                  imagens e vídeos importados ("uploads/…" nos JSON)
    media-catalog.json     catálogo da Media Hub
  projects/<id>.json       projetos do editor
  project-thumbs/<id>.jpg  miniaturas dos projetos
  templates/<id>.json      templates do usuário
  library/<id>.json        produtos da biblioteca
  channels/<id>.json       canais
  schedules/<id>.json      agendas LEGADAS (só alimentam o EPG)
  exports/*.mp4            vídeos renderizados
  backups/*.zip            backups (pasta configurável)
  player-devices.json      Screenlet Players (com token cifrado)
```

### Dados da máquina (`userData`)

São dados locais, nunca sincronizados. No macOS ficam em `~/Library/Application Support/Screenlet`; no Windows, em `%APPDATA%/Screenlet`.

```
userData/
  storage-config.json   pasta de dados escolhida
  app-settings.json     preferências
  iptv-config.json      { selectedIp }
  devices.json          dispositivos Kodi (senhas cifradas)
  integrations.json     StockEasy (chave cifrada)
  remotion-root/        cache do Chrome headless
  remotion-bundle/      cópia gravável do bundle de render
```

### No renderer (`localStorage`)

| Chave | Conteúdo |
|---|---|
| `vitrinetv-theme` | `"dark" \| "light" \| "system"` |
| `screenlet-store-profiles` | `StoreProfile[]`. **Não entra no backup** |

### Convenção de caminhos

Os caminhos de mídia são guardados **relativos e sem barra inicial**:

- `uploads/1712345-foto.png`: o prefixo `uploads/` aponta para `assets/`;
- `assets/products/milk-can.png`: amostras empacotadas no app (`public/assets`);
- `exports/x.mp4` e `project-thumbs/id.jpg`.

O nome de um upload é `<Date.now()>-<nome sanitizado, até 40 caracteres>.<ext>`, em que a sanitização troca o que não for `[A-Za-z0-9_-]` por `_`.

## Projeto (`projects/<id>.json`)

```jsonc
{
  "id": "uuid",
  "name": "Ofertas da semana",          // chave lógica: salvar com o mesmo nome sobrescreve
  "createdAt": "ISO", "updatedAt": "ISO",
  "config": AdConfig
}
```

### `AdConfig`

```ts
type AdConfig = {
  logoImage: string;       // caminho da logo do projeto ("" = sem logo)
  storeName?: string;
  fps: number;             // 30
  width: number;           // 1920 (substituído pelo formato ao exportar)
  height: number;          // 1080
  scenes: SceneConfig[];   // tocadas em sequência, sem sobreposição
  templates?: Template[];  // só no payload de exportação, quando há cenas de template
};
type SceneConfig = LogoSceneConfig | ProductSceneConfig | TemplateSceneConfig | VideoSceneConfig;
```

| Cena | Campos | Padrões |
|---|---|---|
| `logo` | `id, tagline, taglineColor, bg, durationInFrames` | "Ofertas imperdíveis para você!", `#ffffff`, `#0B5E1F`, 60 |
| `product` | `id, image, productName, productNameColor, priceMode ("offer"\|"single"), oldPrice, oldPriceColor, newPrice, priceSuffix, bg, accentColor, badgeColor, badgeText, badgeTextColor, durationInFrames, showLogoOverlay, logoPosition ("top-left"\|"top-right"\|"bottom-left"\|"bottom-right"), libraryProductId?, librarySnapshot?` | nome "Nome do Produto", preços "0,00", bg `#1A1A1A`, destaque `#FFD500`, selo `#E10600` "Oferta por tempo limitado", 150 quadros, logo em `top-right` desligada |
| `template` | `id, templateId, values: Record<string,string>, durationInFrames` | 150 |
| `video` | `id, src, volume (0–1), durationInFrames` | volume 1, 150 |

Detalhes que valem para todos os tipos:

- **Os preços são texto** já formatados no padrão brasileiro (`"12,95"`). O prefixo `R$` é adicionado na hora de desenhar.
- `librarySnapshot` guarda `{ image, productName, priceMode, oldPrice, newPrice, priceSuffix, badgeText }` como estavam na importação ou na última sincronização.
- Os ids de cena têm 8 caracteres em base36 (`makeId()`); os de template e camada são UUIDs.

### Formatos de exportação

| Formato | Resolução |
|---|---|
| `tv` | 1920×1080 |
| `instagram` | 1080×1080 |
| `stories` | 1080×1920 |
| `tiktok` | 1080×1920 |

## Template (`templates/<id>.json` e embutidos)

```ts
type Template = {
  id; name; description; category; tags: string[]; thumbnail; version;
  fps; width; height; createdAt; updatedAt; builtin?: boolean;
  variables: { key: string /* A-Z0-9_ */; label; type: "text"|"image"|"color"|"number";
               defaultValue: string; required?: boolean }[];
  scenes: { id; name; durationInFrames; backgroundColor: string /* valor CSS */; layers: TemplateLayer[] }[];
};
```

Todas as camadas têm estes campos em comum:

```ts
{ id, name, x, y, width, height,   // px no espaço do template (ex.: 1920×1080)
  opacity /*0–1*/, zIndex, rotation /*graus*/, visible,
  animations: { type, startFrame, durationInFrames, easing?: "linear"|"easeIn"|"easeOut"|"easeInOut" }[],
  startFrame?, endFrame? }       // janela de visibilidade relativa à cena
```

| `type` | Campos próprios |
|---|---|
| `text` | `text` (aceita `{{VAR}}`), `fontSize`, `fontWeight`, `color`, `align`, `lineHeight?` (1.2), `letterSpacing?` |
| `image` | `src` (caminho ou `{{VAR}}`), `fit: contain\|cover`, `flipX?`, `flipY?` |
| `logo` | `fit`, `flipX?`, `flipY?`. A origem é a variável `LOGO` |
| `price` | `priceMode`, `oldPrice`, `newPrice`, `suffix` (aceitam `{{VAR}}`), `accentColor`, `textColor`, `oldPriceColor`, `fontSize` |
| `shape` | `shape: rect\|circle`, `fill` (**valor CSS livre**, pode ser gradiente), `borderRadius?`, `border?` (**CSS livre**) |
| `badge` | `text`, `bg`, `textColor`, `borderRadius`, `fontSize` |
| `video` | `src`, `volume`, `loop`, `startFrom` |

Há quatro templates embutidos: `builtin-generico`, `builtin-carnes`, `builtin-natal` e `builtin-pascoa`. Usam as variáveis `STORE_NAME`, `LOGO`, `PRODUCT_NAME`, `PRODUCT_IMAGE`, `OLD_PRICE`, `NEW_PRICE`, `PRICE_SUFFIX` e `BADGE_TEXT`. Os templates exportados usam a extensão `.adframe.json`.

## Produto da biblioteca (`library/<id>.json`)

```ts
{ id, name, category, reference?, image, priceMode, oldPrice, newPrice, priceSuffix, badgeText, createdAt }
```

## Catálogo de mídia (`assets/media-catalog.json`)

```ts
{ version: 1, assets: { id, filename /* "uploads/…" */, originalName, type: "image"|"video",
                        size, sha256?, importedAt }[] }
```

Os arquivos achados pela descoberta automática entram sem `sha256`.

As extensões aceitas são:

| Tipo | Extensões |
|---|---|
| Imagem | png, jpg, jpeg, webp, gif (a gif só aparece pela descoberta; a importação não oferece) |
| Vídeo | mp4, webm, mov, mkv |

## Canal (`channels/<id>.json`)

```ts
{ id, name, description, logo, enabled, loop,
  playlist: { id, filename /* nome em exports/ */, name, transition: "cut"|"fade" }[],
  rules?: { id, assetFilename, assetName, transition?,
            schedule: { type: "always" }
                    | { type: "time-range", startTime: "HH:MM", endTime: "HH:MM" }
                    | { type: "day-of-week", days: (0..6)[] /* 0 = domingo */ } }[],
  createdAt, updatedAt }
```

Há também um formato legado, com um único vídeo em loop por `loopSourceId`, que o servidor IPTV ainda aceita.

## Agenda legada (`schedules/<id>.json`)

```ts
{ id, channelId, name, items: { id, type: "video"|"template"|"project", startTime: "HH:MM", duration /*s*/, sourceId }[], createdAt, updatedAt }
```

Não existe mais tela para editar agendas. Elas só alimentam `/epg.xml` e o modo legado de `/channel/:id`.

## Dispositivo Kodi (`userData/devices.json`)

```ts
{ id, name, ip, sshPort, sshUser, sshPassword_enc /* base64 safeStorage */,
  kodiHttpPort, kodiHttpUser, kodiHttpPassword_enc,
  defaultChannelId, kodiChannelId, restartDelaySecs, createdAt, updatedAt }[]
```

O renderer recebe `hasSshPassword` e `hasKodiPassword` no lugar dos campos `_enc`. Ao salvar, uma senha vazia **mantém** a que já estava gravada.

## Screenlet Player (`SCREENLET_DIR/player-devices.json`)

```ts
{ id, deviceId, name, hostname, pairingCode, playerVersion, channelId, paired, playing, source,
  apiUrl /* "http://ip:8089" */, apiToken_enc?, lastSeenAt, pairedAt, createdAt }[]
```

## Configurações (`userData/app-settings.json`)

```jsonc
{ "launchAtLogin": false, "autoStartIptvOnLaunch": true,
  "videoCodec": "h264" /* | "h265" */, "videoQuality": "medium" /* high|medium|low */,
  "hardwareAcceleration": true, "termsAcknowledged": false, "backupDir": "" }
```

## Integrações (`userData/integrations.json`)

```jsonc
{ "stockeasy": { "enabled": true, "baseUrl": "https://stockeasy.birdra1n.com",
                 "selectedStore": "Loja 01", "apiKey_enc": "base64" } }
```

## Backup (`*.zip`)

```
manifest.json      { formatVersion: 1, createdAt, appVersion, categories: string[] }
projects/ project-thumbs/ assets/ exports/ templates/ library/ channels/ schedules/
_config/devices.json _config/player-devices.json _config/app-settings.json
_config/iptv-config.json _config/integrations.json
```

Os arquivos são comprimidos com zlib nível 9. A restauração é feita por categoria:

- as pastas são **substituídas por inteiro**;
- os arquivos de configuração voltam para a base de origem (`userData` ou a pasta de dados).

**As credenciais só podem ser lidas na mesma máquina e no mesmo usuário**, porque estão cifradas com `safeStorage`.

## Perfil de loja (`localStorage`)

```ts
{ id, name, logoPath, brandColor }[]
```
