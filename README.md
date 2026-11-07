# Screenlet (Qt)

Edição nativa do Screenlet em **Qt 6.12 (C++20 + QML)**, com o design "Vitrine" (proposta B). Ela substitui a versão Electron + Next.js + Remotion e lê **os mesmos arquivos de dados**, sem nenhuma conversão.

## Compilar e rodar

Pré-requisitos:
- Qt 6.8 ou mais recente, com os módulos Quick, QuickControls2, Multimedia (com o backend FFmpeg), Network e Concurrent;
- CMake 3.21 ou mais recente e Ninja (o instalador do Qt já traz os dois).

```bash
export PATH="$HOME/Qt/Tools/CMake/CMake.app/Contents/bin:$HOME/Qt/Tools/Ninja:$PATH"
cmake -S . -B build/release -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH=$HOME/Qt/6.12.0/macos
cmake --build build/release
open build/release/Screenlet.app
```

### Empacotar o .dmg (macOS)

```bash
scripts/package-mac.sh
```

O script gera `build/dist/Screenlet-<versão>-universal.dmg`, um app universal (Apple Silicon e Intel) para macOS 14.4 ou mais recente. Ele:
1. compila em Release;
2. roda o `macdeployqt` para embutir o Qt, os módulos QML e o backend FFmpeg;
3. remove plugins que o app não usa;
4. grava um `qt.conf` com caminhos relativos ao pacote;
5. assina o app e cria a imagem com o atalho "Aplicativos".

| Variável | Uso |
|---|---|
| `SIGN_IDENTITY` | Padrão: detecta automaticamente um certificado "Developer ID Application" ou "Apple Development" (hardened runtime + `resources/entitlements.plist`); sem certificado, usa `-` (ad-hoc). Para distribuir, use "Developer ID Application" e notarize o `.dmg` com `xcrun notarytool` + `xcrun stapler` |

> **Por que assinar com certificado:** o macOS amarra a permissão de acesso à pasta Documentos (e ao Keychain) à assinatura do app. Com assinatura ad-hoc, cada build ou cópia do app tem outra assinatura e o macOS volta a perguntar. Os builds de desenvolvimento (Qt Creator / CMake) também são assinados automaticamente após o link; para forçar outra identidade, use `-DSCREENLET_SIGN_IDENTITY=<sha1>` (ou `-` para ad-hoc).
| `ARCHS` | `arm64;x86_64` (padrão) ou só uma arquitetura |
| `QT_DIR` | Kit Qt (padrão `~/Qt/6.12.0/macos`) |

Os avisos do `macdeployqt` sobre `libpq`, `libiodbc` e `libmimerapi` vêm de drivers SQL que o script remove em seguida; podem ser ignorados.

**Fontes:** coloque `Inter-*.ttf` e `BricolageGrotesque-*.ttf` em `fonts/`. Elas são embutidas e carregadas automaticamente. Sem elas, o app usa fontes do sistema parecidas (Avenir Next ou Helvetica Neue).

### Ícone do app

O ícone é um documento do **Icon Composer**, `resources/AppIcon.icon`. Ele tem duas camadas em SVG: a etiqueta e o "play" em vidro, sobre um fundo amarelo-alaranjado. No macOS 26+ o sistema aplica o Liquid Glass e as variações escura, clara e tingida. Para editar, abra o arquivo no Icon Composer (vem com o Xcode).

O CMake compila o documento com o `actool` (Xcode 26+) e gera o `Assets.car` (`CFBundleIconName`) mais o `AppIcon.icns`. Os arquivos `icon.icns`, `icon.png` e `icon.ico` são versões pré-renderizadas com o `ictool`. Eles servem para builds sem Xcode, para o ícone da janela e para o Windows. Para regenerar depois de mudar o ícone:

```bash
ICTOOL="/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool"
"$ICTOOL" resources/AppIcon.icon --export-image --output-file resources/icon.png \
  --platform macOS --rendition Default --width 1024 --height 1024 --scale 1
```

## Estrutura

```
src/
  main.cpp                instância única, bandeja, carregamento do QML
  core/                   Paths, JsonIo (gravação atômica), SecretStore (Keychain/DPAPI), Async
  services/               Settings, Storage, Projects, Templates, Library, Media, Exports,
                          Channels (motor de programação), StoreProfiles, Backup, SystemInfo, Updater
  net/                    HttpServer (sobre QTcpServer), Iptv, Kodi (SSH + JSON-RPC), Players, StockEasy
  render/Renderer         exportação MP4: QQuickRenderControl → QVideoFrameInput → QMediaRecorder
  render/AudioMix         áudio dos clipes de vídeo: QAudioDecoder → mixagem → QAudioBufferInput (AAC)
qml/
  Main.qml                janela, sidebar, navegação com transições
  singletons/             Theme (tokens), Motion, Nav, Doc (anúncio aberto), Insights, Toasts, Fmt
  components/             design system (Btn, Card, Segmented, Inspector, MediaPicker…)
  scene/                  motor de cenas: AdStage, ProductScene, LogoScene, TemplateScene,
                          LayerItem, VideoScene, SceneMath.js (spring/interpolate do Remotion)
  pages/                  Painel, Anúncios, Editor, Wizard, Templates, TemplateWizard,
                          TemplateBuilder, Produtos, Mídia, Vídeos, Canais, Studio, Telas, IPTV, Configurações
resources/                templates embutidos (JSON), imagens de exemplo, ícones
```

### Decisões principais

- **Prévia e exportação usam a mesma cena QML.** O `AdStage.qml` aparece no editor através do `AdPlayer`, sincronizado com a tela (`FrameAnimation`). O `Renderer` instancia o mesmo `AdStage` fora da tela e grava quadro a quadro, sem Chrome headless. Um anúncio de 15 s em 1080p fica pronto em cerca de 3 s.
- **Serviços são singletons QML com uma única instância C++**, criada pelo `AppContext`. Os construtores exigem `parent`, para o QML não criar uma segunda cópia.
- **Os dados ficam no formato JSON original.** Quase todos os campos novos são opcionais, como `exports[]` nos projetos e `*_secret` nos dispositivos. A única exceção é `player-devices.json`, que passou da pasta sincronizada para `userData`.
- **I/O pesado roda fora da thread da interface.** É o caso de SHA-256, backup, migração de pasta e varredura de rede. O resultado volta por callback (`Servico.metodo(args, function (r) { … })`).

## Correções em relação à versão Electron

Veja `docs/06-pontos-de-atencao.md` no repositório Screenlet:
- editar um canal preserva as regras de horário;
- o stream IPTV respeita as regras de horário;
- o EPG usa as regras dos canais e o fuso correto;
- o assistente aplica o visual escolhido;
- exportar em 60 fps mantém a duração em segundos;
- a troca de pasta copia vídeos e miniaturas;
- os perfis de loja entram no backup;
- o hash é calculado em streaming;
- o M3U e o XML são escapados;
- projetos são identificados por id, não por nome;
- os Kodis só reiniciam quando a programação muda;
- a cena de vídeo usa `cover`, sem distorcer.

## Testes

```bash
cmake --build build/release-universal --target securezip_test && (cd build/release-universal && ctest --output-on-failure)
```

`tests/securezip_test` cobre o ZIP com AES-256 dos backups: ida e volta byte a byte, senha errada, adulteração detectada pelo HMAC e nomes em UTF-8.

## Modo de desenvolvimento

Estas variáveis de ambiente servem para testes automatizados:

| Variável | Efeito |
|---|---|
| `SCREENLET_PAGE=<página>` (+ `SCREENLET_PARAMS='{"id":…}'`) | Abre uma página |
| `SCREENLET_SNAPSHOT=<arquivo.png>` (+ `SCREENLET_SNAPSHOT_DELAY=ms`) | Salva um PNG da janela e encerra |
| `SCREENLET_TEST_EXPORT=<nome>` | Exporta o anúncio padrão e encerra |
| `SCREENLET_DEV_IPTV=1` | Inicia o servidor IPTV |
| `SCREENLET_DATA_DIR` / `SCREENLET_USERDATA_DIR` | Usam pastas de dados e de configuração isoladas (testes sem tocar nos dados reais) |
| `SCREENLET_NO_RELAUNCH=1` | Encerra em vez de reiniciar após restaurar um backup |
| `SCREENLET_TEST_QUEUE=1` | Atualiza e renderiza todos os anúncios desatualizados e encerra |
