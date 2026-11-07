# CLAUDE.md

Guia para o Claude Code (claude.ai/code) trabalhar neste repositório.

## Comandos

```bash
export PATH="$HOME/Qt/Tools/CMake/CMake.app/Contents/bin:$HOME/Qt/Tools/Ninja:$PATH"

# Configurar + compilar (Debug)
cmake -S . -B build/debug -G Ninja -DCMAKE_BUILD_TYPE=Debug -DCMAKE_PREFIX_PATH=$HOME/Qt/6.12.0/macos
cmake --build build/debug
open build/debug/Screenlet.app

# Testes (ZIP AES-256 do backup)
ctest --test-dir build/debug --output-on-failure

# .dmg universal (arm64 + x86_64), assinado com o certificado da máquina
scripts/package-mac.sh            # → build/dist/Screenlet-<versão>-universal.dmg
```

No Windows (Qt em `C:\Qt\6.12.0\mingw_64`, MinGW e CMake em `C:\Qt\Tools`, Inno Setup 6):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package-win.ps1
# → build\dist\Screenlet-Setup-<versão>.exe + latest.yml
```

O instalador (`installer/screenlet.iss`) instala por usuário em `%LOCALAPPDATA%\Programs\Screenlet`, com `Screenlet.exe` na raiz, e remove a versão Electron antes de instalar. O `latest.yml` vai junto na release: é por ele que o electron-updater das instalações Electron oferece a atualização para esta versão.

O Qt fica em `~/Qt/6.12.0/macos`. O CMake e o Ninja estão em `~/Qt/Tools`. O Xcode completo (27) está em `/Applications/Xcode.app`, mas o `xcode-select` aponta para as Command Line Tools; o CMake encontra o `actool` sozinho. Commits e PRs são em **pt-BR**, sem coautoria.

## Arquitetura

O Screenlet é um app desktop de sinalização digital: cria anúncios em vídeo, renderiza em MP4 e transmite por IPTV, Kodi ou Screenlet Player. É feito em **Qt 6.12, C++20 + QML**, com CMake (`qt_add_qml_module`, URI `Screenlet`).

Ele substituiu a versão Electron + Next.js + Remotion, que não existe mais na `main`. Os docs `docs/01`–`06` descrevem essa versão antiga e valem como especificação. O `docs/07-versao-qt.md` descreve o estado atual.

```
src/main.cpp        instância única, bandeja, QQmlApplicationEngine, plugin estático de imagens
src/core/           AppContext (cria os serviços), Paths, JsonIo (gravação atômica),
                    SecretStore (Keychain/DPAPI), SecureZip (ZIP WinZip AE-2), Async
src/services/       Settings, Storage, Projects, Templates, Library, Media, Exports, Channels,
                    StoreProfiles, Backup, SystemInfo, Updater
src/net/            HttpServer (QTcpServer), Iptv (porta 7095), Kodi (SSH + JSON-RPC), Players, StockEasy
src/render/         Renderer (exportação MP4/miniaturas), AudioMix (áudio AAC)
src/imageio/        plugin QImageIO via ImageIO do macOS / WIC do Windows (WebP/AVIF/HEIC)
qml/Main.qml        janela, sidebar, StackView de páginas, ganchos de teste
qml/singletons/     Theme, Motion, Nav, Doc (anúncio aberto), Insights, RenderQueue, Toasts, Fmt
qml/components/     design system (Btn, Card, Segmented, Inspector, MediaPicker, QueueDock…)
qml/scene/          motor de cenas: AdStage, ProductScene, LogoScene, TemplateScene, LayerItem,
                    VideoScene, SceneMath.js
qml/pages/          Painel, Anuncios, Editor, Wizard, Templates*, Produtos, Midia, Videos,
                    Canais, Studio, Telas, IptvPage, Configuracoes
resources/          templates embutidos (JSON), imagens de exemplo, AppIcon.icon, Info.plist.in
```

### Pontos centrais
- **Os serviços C++ são singletons QML com uma única instância.** O `AppContext` cria todos. A macro `SL_SINGLETON(T)` fornece `instance()` e `create()`. **Os construtores precisam exigir `parent`**: se existir um construtor padrão, o Qt o prefere ao `create()` e o QML passa a ter uma segunda cópia do serviço.
- **I/O pesado roda fora da thread da interface** com `Async::run(this, cb, work)`, e o callback volta para a thread da GUI. No QML, o padrão é `Servico.metodo(args, function (r) { … })`.
- **Prévia e exportação usam o mesmo `qml/scene/AdStage.qml`.** O `Renderer` instancia essa cena fora da tela (QQuickRenderControl + leitura de textura QRhi), envia os quadros para `QVideoFrameInput` e o áudio para `QAudioBufferInput`, e grava com `QMediaRecorder` (FFmpeg, H.264/H.265). Para mudar o visual, mude a cena e os dois caminhos acompanham.
- **No Windows, a exportação usa o Media Foundation direto (`src/render/MfEncoder`)**, com transforms de hardware (NVENC, AMD, Quick Sync). O FFmpeg que vem com o Qt no Windows não tem nvenc/amf/qsv/x264 e abre o `h264_mf` sem `hw_encoding`, por isso cai no encoder de software da Microsoft. Ele continua como fallback e como opção "Somente processador". No Mac, o caminho do FFmpeg usa o VideoToolbox.
- **API gráfica e GPU (`src/render/Gpu`)** são lidas uma vez em `main()` (`graphicsApi`, `gpuPreference`). Antes de aplicar, uma sonda cria um `QRhi` da API escolhida; se falhar, o app volta ao padrão. A preferência de GPU vira `QT_D3D_ADAPTER_INDEX` mais a entrada `UserGpuPreferences` do Windows.
- **`SceneMath.js` porta o `spring`/`interpolate` do Remotion.** Com ζ ≥ 1, use a fórmula de amortecimento crítico; a superamortecida causava saltos na animação.
- **Recursos QML ficam em `:/qt/qml/Screenlet/...`.** Não use `NO_RESOURCE_TARGET_PATH`, porque o app empacotado quebra.

### Dados
- Os dados ficam em `~/Documents/Screenlet/` (ou na pasta escolhida em Configurações). As subpastas são `assets/`, `projects/`, `templates/`, `library/`, `channels/`, `exports/` e `project-thumbs/`. A configuração local da máquina fica em `Paths::userData()`.
- **O JSON é compatível com a versão Electron.** Campos novos devem ser opcionais (ex.: `exports[]` nos projetos, com `filename`, `format`, `fps` e `at`).
- **Caminhos de mídia ficam sem barra inicial e são relativos** (`"uploads/x.png"`, `"exports/x.mp4"`). Eles são resolvidos por `Paths::resolveMedia`.
- **Segredos nunca ficam no JSON nem chegam ao QML.** O JSON guarda uma referência `kc:<uuid>` para o Keychain (serviço `com.screenlet.app.secrets`) ou para o DPAPI. O QML só recebe flags booleanas.
- **Backup:** as categorias com credenciais (`devices`, `settings`) exigem senha de 8+ caracteres. Nesse caso o backup sai em ZIP AES-256 com `_secrets/secrets.json`, e o `manifest.json` fica legível sem senha.
- **Sobrescrever um vídeo em `exports/` sincroniza os canais.** `resyncChannelsUsing` atualiza os canais que tocam aquele arquivo e reinicia os Kodis. O `RenderQueue` usa isso para re-renderizar os anúncios desatualizados.

### macOS
- **Todo build é assinado após o link** com um certificado "Developer ID" ou "Apple Development", detectado automaticamente (`-DSCREENLET_SIGN_IDENTITY=` muda a identidade; `-` usa ad-hoc). Sem isso, o macOS pede acesso à pasta Documentos e ao Keychain a cada build.
- **O ícone é o documento do Icon Composer `resources/AppIcon.icon`.** O `actool` o compila em `Assets.car` + `AppIcon.icns`. `icon.icns`, `icon.png` e `icon.ico` são versões pré-renderizadas com o `ictool` (para builds sem Xcode e para o Windows).
- A versão mínima é o macOS 14.4 (`CMAKE_OSX_DEPLOYMENT_TARGET`). O `package-mac.sh` grava um `qt.conf` com caminhos relativos ao pacote.

## Armadilhas de QML
- **Não use `layer` como nome de propriedade ou id**, porque conflita com `Item.layer` (use `lyr`/`selLayer`). Não chame componentes de `Page`; o nosso é `ScrollPage`.
- **Propriedades QML não podem começar com letra maiúscula.**
- **Não coloque `;` depois de uma vinculação de objeto inline.** Tenha uma única `Component.onCompleted` por objeto.
- Cartões com cantos arredondados que recortam conteúdo usam `Card { roundClip: true }` (máscara via MultiEffect).

## Testes e automação
Use estas variáveis de ambiente, sempre com pastas isoladas, para não tocar nos dados reais:

| Variável | Efeito |
|---|---|
| `SCREENLET_DATA_DIR` / `SCREENLET_USERDATA_DIR` | Pastas de dados e de configuração isoladas |
| `SCREENLET_PAGE=<página>` (+ `SCREENLET_PARAMS`) | Abre uma página |
| `SCREENLET_SNAPSHOT=<png>` (+ `SCREENLET_SNAPSHOT_DELAY`) | Salva uma captura da janela e encerra |
| `SCREENLET_TEST_EXPORT=<nome>` (+ `SCREENLET_TEST_CONFIG=<json>`) | Exporta e encerra |
| `SCREENLET_TEST_QUEUE=1` | Roda a fila de anúncios desatualizados e encerra |
| `SCREENLET_TEST_BACKUP=create` ou `"zip\|senha"` | Cria ou restaura um backup e encerra |
| `SCREENLET_DEV_IPTV=1` | Inicia o servidor IPTV |
| `SCREENLET_NO_RELAUNCH=1` | Encerra em vez de reiniciar após uma restauração |
| `SCREENLET_D3D_FEATURE_LEVEL=0xa100` | Finge uma GPU antiga no Windows (`0xa100` = D3D 10.1, Intel HD 3000; `0xb000` = 11.0, HD 4000) |
| `QSG_RHI_PREFER_SOFTWARE_RENDERER=1` | Força o WARP (renderização por software), útil para simular máquina fraca |

Os ganchos de captura e de exportação ignoram a instância única, então funcionam com o app aberto.
