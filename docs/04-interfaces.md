# 04 · Interfaces

## 1. API interna (renderer → processo principal)

`window.adFrame` (em `electron/preload.cjs`) expõe 69 métodos `invoke` assíncronos, um evento e uma constante. Na versão Qt, isso vira a camada de serviços em C++ exposta ao QML. A lista serve de checklist de paridade.

| Grupo | Métodos | Observações |
|---|---|---|
| Arquivos | `selectImage()`, `selectVideo()`, `copyFile(src)`, `selectCsv()` | Abrem o diálogo nativo e copiam para `assets/`, devolvendo `uploads/…`; `selectCsv` devolve o texto do arquivo |
| Projetos | `projectsList()`, `projectsSave(config, name)`, `projectsLoad(id)`, `projectsDelete(id)`, `projectsRename(id, name)` | `list` devolve só metadados + `thumbnail`; `save` faz upsert **por nome** e dispara a miniatura |
| Templates | `templateList()`, `templateSave(t)`, `templateDelete(id)` | Só templates do usuário |
| Biblioteca | `libraryList()`, `librarySave(p)`, `libraryDelete(id)` | Ordenados por `createdAt` desc. |
| Integrações | `integrationsGet()`, `integrationsSetStockEasy(payload)`, `stockeasyLookup(ref)` | No payload, `apiKey` é string para definir, `null` para apagar e `undefined` para manter |
| Canais | `channelList()`, `channelSave(c)`, `channelDelete(id)` | `save` reinicia os Kodis do canal |
| Exportações | `exportsList()`, `exportsDelete(file)`, `exportsReveal(file)` | |
| IPTV | `iptvStatus()`, `iptvStart()`, `iptvStop()`, `iptvSetIp(ip)` | Status: `{ running, port, ips[], selectedIp, ffmpegAvailable }` |
| Configurações | `appSettingsGet()`, `appSettingsSet{LaunchAtLogin, AutoStartIptv, VideoCodec, VideoQuality, HardwareAcceleration, TermsAcknowledged}(v)` | Todos devolvem as configurações completas |
| Sistema | `openExternal(url)`, `systemInfoGet()`, `appGetVersion()`, `setTitleBarTheme(isDark)`, `platform` | `openExternal` aceita só http(s) |
| Backup | `backupCategories()`, `backupGetDir()`, `backupChooseDir()`, `backupOpenDir()`, `backupList()`, `backupCreate(keys)`, `backupDelete(file)`, `backupReveal(file)`, `backupPick()`, `backupRestore({path, categories})` | A restauração reinicia o app após 400 ms |
| Mídia | `mediaCatalog()`, `mediaImport(type)`, `mediaDelete(id)` | O catálogo sincroniza a pasta a cada chamada |
| Armazenamento | `storageGetDir()`, `storageChooseDir()`, `storageMigrate(dir, copy)`, `storageOpenDir()` | `migrate` grava a configuração e reinicia o app |
| Kodi | `deviceList()`, `deviceSave(d)`, `deviceDelete(id)`, `kodiPing(id)`, `kodiRestartAndOpen(id)`, `kodiListChannels(creds)`, `kodiFetchConfig(sshCreds)` | Dispositivos já salvos só são acessados por id; as credenciais temporárias são só para o formulário |
| Screenlet Player | `playerDeviceList()`, `playerDeviceScan()`, `playerDeviceClaim({id, channelId, name})`, `playerDeviceUnpair(id)`, `playerDeviceDelete(id)` | |
| Render | `exportVideo(payload, filename, fps)` e o evento `onExportProgress(cb)` | Devolve `{ ok: true, filename, updatedChannels: {id, name}[] }` ou `{ ok: false, error }` |

Também existem os canais `schedule-list`, `schedule-save` e `schedule-delete` no processo principal, mas o preload não os expõe.

## 2. Servidor IPTV / HTTP (porta 7095, `0.0.0.0`)

Todas as respostas levam `Access-Control-Allow-Origin: *`. Não há autenticação.

| Método e rota | Resposta |
|---|---|
| `GET /` ou `GET /playlist.m3u` | `application/x-mpegurl`. Lista os **canais ativos** |
| `GET /epg.xml` | XMLTV gerado a partir das **agendas legadas**, no fuso `+0000` |
| `GET /channel/:id` | Stream **MPEG-TS** ao vivo (ver abaixo) |
| `GET\|HEAD /exports/:file` | Arquivo exportado com `Range` (206/416), `Accept-Ranges` e proteção contra path traversal |
| `POST /api/player/heartbeat` | Corpo `{ deviceId, hostname, pairingCode, playerVersion, playing, source }` → `204`. Faz upsert do dispositivo e aprende o `apiUrl` pelo IP de origem |
| `GET /api/player/sync?deviceId=` | Manifesto offline (ver abaixo) |

### Formato do M3U

```
#EXTM3U x-tvg-url="http://<ip>:7095/epg.xml"
#EXTINF:-1 tvg-id="<id>" tvg-name="<nome>" group-title="Screenlet",<nome>
#EXTVLCOPT:input-repeat=65535          (somente se loop)
http://<ip>:7095/channel/<id>
```

### Stream de um canal (`/channel/:id`)

1. **Playlist** (formato atual):
   - escreve um arquivo `ffconcat` temporário com os itens que ainda existem;
   - executa `ffmpeg -f concat -safe 0 -i <lista> -c:v libx264 -c:a aac -preset ultrafast -tune zerolatency -f mpegts pipe:1`;
   - se o loop estiver ligado, reinicia a playlist ao terminar;
   - encerra o processo quando o cliente desconecta.
   - **Cada cliente conectado ganha o seu próprio ffmpeg recodificando o vídeo.** As transições e as regras de horário **não são aplicadas**.
2. **Legado `loopSourceId`**: um único vídeo com `-re -stream_loop -1`. Sem ffmpeg, o arquivo é servido inteiro uma vez.
3. **Legado `schedules`**: serve o primeiro vídeo agendado como arquivo, com `Range`.

O ffmpeg é procurado em caminhos fixos por plataforma (Homebrew, `/usr/bin`, `C:\ffmpeg\bin`, Scoop, Chocolatey) e depois com `which`/`where`.

### Manifesto do Screenlet Player (`/api/player/sync`)

```jsonc
// dispositivo não pareado, sem canal ou com canal inexistente
{ "paired": false }

// pareado
{
  "paired": true,
  "channelId": "…",
  "playlistUrl": "http://<ip>:7095/channel/<id>",   // legado / fallback
  "updatedAt": "ISO",
  "loop": true,                                       // channel.loop !== false
  "version": "<16 hex>",   // sha256 de "file:sha256:…|…" truncado
  "items": [ { "filename", "url": "http://<ip>:7095/exports/<file>", "size",
               "hash": "sha256:<hex>", "transition": "cut"|"fade" } ]
}
```

- Os hashes ficam em cache por `size:mtime`, para não recalcular a cada chamada do player, que acontece a cada ~15 s. Na versão Qt, o manifesto é montado fora da thread da interface.
- Na versão Qt, as URLs (`url`, `playlistUrl`) usam o cabeçalho `Host` da requisição, ou seja, o endereço que o player de fato alcança, e não o IP selecionado na tela IPTV.
- Itens cujo arquivo sumiu são omitidos.
- O player baixa os arquivos, guarda em cache e continua tocando mesmo sem o servidor.

## 3. Integrações externas

### Kodi

- **SSH** (ssh2), com timeout de 10 s e senha:
  - para reiniciar: `systemctl restart kodi`;
  - para ler a configuração: `grep -i webserver` em `/storage/.kodi/userdata/guisettings.xml` (LibreELEC) ou em `$HOME/.kodi/userdata/guisettings.xml`. Extrai `services.webserver`, `webserverport` (8080), `webserverusername` (kodi), `webserverpassword` e `webserverauthentication`.
- **JSON-RPC** em `POST http://<ip>:<porta>/jsonrpc`, com autenticação Basic e timeout de 6 s:

| Método | Uso |
|---|---|
| `JSONRPC.Version` | Teste de conexão |
| `PVR.GetChannels {channelgroupid:"alltv"}` | Lista de canais |
| `Player.Open {item:{channelid}}` | Abrir o canal, `restartDelaySecs` segundos depois de reiniciar |

### Screenlet Player

O Screenlet Player é um projeto à parte, em Go, que usa o mpv. Sua API de controle fica na porta **8089**.

| Chamada | Resposta |
|---|---|
| `GET /identify` (sem autenticação) | `{ deviceId, hostname, playerVersion, claimed: bool, … }` |
| `POST /claim` com `{ studioUrl: "http://<ip>:7095" }` | `{ token }`. Responde 409 se já foi reivindicado. Na versão Qt, o `<ip>` é o IP local na mesma sub-rede do player |
| `POST /studio` com `{ studioUrl }` e `Authorization: Bearer <token>` | `204`. Atualiza o endereço do Studio no player (players ≥ esta versão; os antigos respondem 404). O Studio chama ao iniciar o servidor IPTV e, a cada minuto, para players pareados sem heartbeat há 90 s (no máximo uma vez a cada 5 min por player) |

Depois do pareamento, o player passa a enviar heartbeats e a consultar `/api/player/sync` no Studio.

### StockEasy (PDV/ERP)

- `GET <baseUrl>/api/v1/products?codigo=<referência>` com o cabeçalho `x-api-key`.
- Respostas tratadas: 401 é chave inválida e 404 é produto não encontrado.
- Campos usados da resposta: `precos: { loja, preco, custo }[]` (aplica `preco` da loja escolhida, com duas casas e vírgula) e `descricao`, `estoque[]`, `ean[]`.

### GitHub Releases

O auto-update lê `latest-mac.yml` e `latest.yml` das releases de `BirdRa1n/Screenlet`, incluindo pré-releases.
