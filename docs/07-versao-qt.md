# 07 · Versão Qt (estado atual)

O código fica na raiz deste repositório, um projeto CMake + Qt 6.12. O código Electron foi removido da `main`; ele continua no histórico do Git, até o merge do PR #8. O [README](../README.md) descreve a estrutura e como compilar.

## O que foi portado

| Área | Situação |
|---|---|
| Painel, Meus anúncios, Editor, Assistente (5 passos) | ✅ Novo design B, com status no ar / agendado / pronto / rascunho e alertas de preço |
| Motor de cenas (logo, produto, template, vídeo) e animações de camada | ✅ Port das fórmulas do doc 05 (spring, interpolate, easing) |
| Exportação MP4 (H.264/H.265, 30/60 fps) e miniaturas de projeto | ✅ Renderização nativa fora da tela, sem Chrome |
| Áudio na exportação (cenas de vídeo e camadas de vídeo dos templates) | ✅ Mixado em AAC 48 kHz estéreo, com o volume de cada clipe |
| Ícone do app | ✅ Documento do Icon Composer (`resources/AppIcon.icon`, camadas com Liquid Glass no macOS 26+), compilado pelo `actool` em `Assets.car`; `.icns`, `.png` e `.ico` pré-renderizados para macOS antigo, Windows e builds sem Xcode |
| Templates: galeria, assistente de variáveis, construtor (canvas, linha do tempo, animações, variáveis) | ✅ |
| Produtos + sincronização de preço com o StockEasy | ✅ |
| Mídia (deduplicação SHA-256, arrastar e soltar), Vídeos prontos | ✅ |
| Canais, Studio (playlist, prévia com corte/fade real, grade de 24 h) | ✅ |
| Servidor IPTV (M3U, EPG, stream, `/exports` com Range, API do Screenlet Player) | ✅ Testado com curl de ponta a ponta |
| Telas: Screenlet Player (varredura e pareamento) e Kodi (SSH + JSON-RPC) | ✅ Screenlet Player testado de ponta a ponta com o player real (heartbeat, sync, download, re-render, PC desligado e religado, troca de endereço). Kodi não testado com dispositivos reais |
| Screenlet Player: robustez | ✅ O manifesto é montado fora da thread da interface, com URLs pelo cabeçalho `Host`; o pareamento envia o IP da mesma sub-rede do player; o Studio avisa os players do seu endereço atual (`POST /studio`) ao iniciar o servidor e quando eles ficam em silêncio; com algum player pareado, o servidor IPTV sobe junto com o app |
| Configurações, backup/restauração seletiva, troca de pasta, bandeja, iniciar com o sistema | ✅ |
| Backup com credenciais | ✅ Senhas de dispositivos, tokens de players e a chave do StockEasy vão no backup, que sai criptografado (ZIP AES-256, WinZip AE-2, senha obrigatória de 8+ caracteres) e regrava os segredos no Keychain ao restaurar |
| Anúncios desatualizados | ✅ Aviso em Meus anúncios, no Painel e após sincronizar preços; "Atualizar e renderizar" aplica os dados da biblioteca e renderiza de novo nos mesmos arquivos, em fila; os canais que usam esses vídeos se atualizam sozinhos |
| Atualizações | ⚠️ Verifica as GitHub Releases e abre a página de download; não instala sozinho |
| Pacote macOS (`scripts/package-mac.sh`) | ✅ `.dmg` universal de 86 MB, testado rodando de dentro da imagem em Apple Silicon e Intel (Rosetta) |

## Limitações conhecidas

1. **Cena de vídeo na exportação:** a imagem de cada quadro é buscada no arquivo (seek). Funciona, mas é mais lenta que as cenas de imagem e não foi testada com vídeos longos. O áudio já sai sincronizado.
2. **Mixagem:** o som dos clipes é somado e limitado a ±1, sem compressão. Vários vídeos com volume alto ao mesmo tempo podem saturar.
3. **Senhas da versão Electron:** não podem ser lidas, porque estão presas ao `safeStorage` do Electron. Dispositivos e a chave do StockEasy aparecem como "senha necessária".
4. **Plataformas:** compilado e testado só no macOS (Apple Silicon). Windows (DPAPI, bandeja, chave Run) e Linux estão no código, mas não foram compilados.
5. **Fontes da marca:** Inter e Bricolage Grotesque não estão embutidas; basta colocar os `.ttf` em `fonts/`.
6. **Distribuição:** o `.dmg` é assinado com o certificado encontrado na máquina (Developer ID ou Apple Development). Assim, o macOS lembra a permissão da pasta Documentos entre versões. Para abrir sem aviso em outros Macs, falta assinar com Developer ID e notarizar. Também faltam o instalador Windows (windeployqt) e o CI.
