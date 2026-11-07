# 06 · Pontos de atenção e mapa para o Qt

## Bugs e comportamentos inesperados encontrados no código atual

| # | Onde | Problema | Efeito para o usuário |
|---|---|---|---|
| 1 | `Channels.tsx`, `ChannelDialog.handleSave` | O objeto salvo não copia `rules` | **Editar o nome ou a descrição de um canal apaga as regras de horário** |
| 2 | Servidor IPTV `/channel/:id` | Toca a playlist inteira e ignora `rules` e `transition` | "Horários" e "fade" só existem na prévia e no painel "Programação agora", não no que a TV recebe |
| 3 | `/channel/:id` | Cada cliente sobe um ffmpeg que recodifica em libx264 | CPU proporcional ao número de TVs; com várias telas, a máquina satura |
| 4 | `/epg.xml` | Usa as agendas legadas (sem tela) e grava horário local com `+0000` | O EPG fica vazio ou com o horário errado |
| 5 | Assistente | `selectedPreset` não entra em `wizardToAdConfig` | Escolher "Natal" ou "Açougue" no passo 3 não muda o vídeo |
| 6 | Exportação a 60 fps | As durações estão em quadros | O vídeo a 60 fps tem metade da duração em segundos |
| 7 | Animações de camada | Uma animação fora da janela não tem efeito | Um `fadeIn` atrasado mostra a camada antes do tempo, e um `fadeOut` a faz reaparecer (ver [05](05-motor-de-video.md)) |
| 8 | `storage-migrate` | Não copia `exports/`, `project-thumbs/` nem `player-devices.json` | Vídeos e players somem ao trocar a pasta de dados com cópia |
| 9 | Perfis de loja | Ficam em `localStorage` | Não entram no backup e se perdem ao migrar ou reinstalar |
| 10 | `hashExport`, `computeSha256` | Leem o arquivo inteiro na memória | Pico de RAM com vídeos grandes |
| 11 | `generateM3u`, `generateEpg` | Não escapam aspas nem `<&>` no nome do canal | M3U ou XML inválidos com nomes como `Açougue "Top"` ou `A&B` |
| 12 | `projects-save` | Faz upsert pelo nome, lendo todos os projetos | Dois projetos com o mesmo nome se sobrescrevem; fica lento com muitos projetos |
| 13 | `player-devices.json` | Fica na pasta sincronizada, mas o token está cifrado para a máquina | Duas lojas na mesma nuvem sobrescrevem os players uma da outra (o mesmo problema já resolvido para `devices.json`) |
| 14 | Canal salvo | Reinicia **todos** os Kodis do canal a cada salvamento | As telas piscam ou reiniciam a cada edição |
| 15 | Bandeja (Windows) | Esconde a janela, mas mantém o renderer vivo | Consumo de memória alto 24/7 |
| 16 | CI | Builds sem assinatura | O auto-update não aplica no macOS; SmartScreen no Windows |
| 17 | Cena de vídeo | Usa `width/height 100%`, sem `cover` ou `contain` | Vídeos com outra proporção ficam distorcidos |

> Para cada item, a migração precisa decidir entre **corrigir** e **manter por compatibilidade**. A recomendação é corrigir 1–5, 8–14 e 17, e tornar 6 e 7 opções explícitas: "duração em segundos" e "animação mantém o estado final".

## Dívidas técnicas

- **Tudo do backend está em um único arquivo de 2.800 linhas**, sem separação de módulos.
- **Nenhum teste automatizado.**
- I/O síncrono (`fs.readFileSync`/`writeFileSync`) no processo principal: listar diretórios grandes trava a interface.
- Gravações sem atomicidade, sem o padrão "escrever em temporário e renomear": uma queda no meio corrompe o JSON.
- A lista de templates embutidos fica duplicada entre o renderer e o bundle de render.
- O nome da API, `window.adFrame`, é herança do nome antigo do projeto.

## Mapa de cada parte para o Qt

| Hoje | Na versão Qt |
|---|---|
| Electron main + IPC | Camada de serviços em C++ (`QObject`s registrados em QML via `QML_ELEMENT`/`QML_SINGLETON`), chamadas assíncronas com `QFuture`/sinais |
| Next.js + React + Tailwind + shadcn | Qt Quick (QML) + Qt Quick Controls com estilo próprio, tokens de design em singleton QML |
| Zustand | Modelos C++ (`QAbstractListModel`) + propriedades `Q_PROPERTY` com `NOTIFY` |
| Remotion Player (prévia) | Motor de cena próprio: `SceneRenderer` em QML/Qt Quick, dirigido por um quadro atual, sem relógio implícito |
| Remotion `renderMedia` (Chrome) | O mesmo grafo de cena renderizado fora da tela com `QQuickRenderControl`, com os quadros entregues ao `QMediaRecorder` via `QVideoFrameInput` (Qt 6.8+) ou direto ao FFmpeg |
| `OffthreadVideo` | Decodificação com precisão de quadro (FFmpeg/libav, já empacotado pelo Qt Multimedia) |
| `<video>` (prévias, Studio) | `MediaPlayer` + `VideoOutput` (Qt Multimedia) |
| Servidor HTTP (`node:http`) | `QTcpServer` com um parser HTTP mínimo (o Qt HttpServer não está instalado), streaming com `Range` |
| ffmpeg por cliente | Um processo de transmissão por **canal**, compartilhado entre os clientes, ou, melhor, servir os MP4 já prontos (o player já usa o manifesto) |
| ssh2 | libssh (ou `QProcess` com `ssh` do sistema como fallback) |
| JSON-RPC do Kodi, StockEasy, Screenlet Player | `QNetworkAccessManager` |
| safeStorage | Keychain / DPAPI / libsecret via QtKeychain (**as senhas antigas precisam ser digitadas de novo**) |
| archiver / yauzl | QuaZip ou minizip-ng (mantendo o formato do backup) |
| electron-updater | Sparkle (macOS) / WinSparkle (Windows), lendo as GitHub Releases |
| Bandeja e autostart | `QSystemTrayIcon`; LaunchAgent no macOS, chave Run no Windows |
| `localStorage` (tema, perfis) | `QSettings` ou arquivo em `userData`, **incluído no backup** |

## Compatibilidade de dados

O app Qt deve, no primeiro uso:

1. Ler `userData/storage-config.json` do Electron (`~/Library/Application Support/Screenlet`, `%APPDATA%/Screenlet`) para achar a pasta de dados.
2. Usar a pasta de dados **sem converter nada**: projetos, templates, biblioteca, canais, catálogo e exportações.
3. Importar `app-settings.json` e `iptv-config.json`.
4. Copiar os dispositivos e a integração **sem as credenciais** e marcá-los como "precisa reautenticar".
5. Não alterar o formato dos arquivos. Os campos novos devem ser opcionais, para que a versão Electron continue lendo os dados durante a transição.
