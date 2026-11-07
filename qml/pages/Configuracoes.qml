import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Dialogs
import QtQuick.Layouts
import Screenlet

// Configurações.
Item {
    id: page
    property var params: ({})
    property var info: SystemInfo.info()
    property var backups: []
    property var restoreTarget: null
    property var exportKeys: Backup.categories().map(c => c.key).filter(k => k !== "videos")
    property var importKeys: []
    readonly property bool mustLock: Backup.needsPassword(exportKeys)
    property string pendingDir: ""
    readonly property var graphicsApis: SystemInfo.graphicsApis()
    readonly property var gpus: SystemInfo.gpus()
    readonly property var hwEncoders: SystemInfo.hardwareEncoders(Settings.videoCodec === "h265")
    readonly property bool graphicsRestart: Settings.graphicsApi !== SystemInfo.startupGraphics.graphicsApi
                                            || Settings.gpuPreference !== SystemInfo.startupGraphics.gpuPreference
                                            || (SystemInfo.isMac && Settings.videoEncoder !== SystemInfo.startupGraphics.videoEncoder)

    Component.onCompleted: refreshBackups()
    function refreshBackups() { Backup.list(function (l) { page.backups = l }) }

    component Section: Card {
        id: sec
        property string title
        property string description: ""
        default property alias body: secBody.data
        width: parent ? parent.width : 800
        height: secCol.implicitHeight + 40
        RowLayout {
            id: secCol
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.margins: 20
            spacing: 24
            ColumnLayout {
                Layout.preferredWidth: 260
                Layout.maximumWidth: 260
                Layout.minimumWidth: 260
                Layout.alignment: Qt.AlignTop
                spacing: 4
                H { level: 4; text: sec.title; Layout.fillWidth: true }
                T { tone: "muted"; size: 13; text: sec.description; visible: text !== ""; Layout.fillWidth: true }
            }
            ColumnLayout {
                id: secBody
                Layout.fillWidth: true
                Layout.preferredWidth: 600
                spacing: 14
            }
        }
    }

    ScrollPage {
        anchors.fill: parent
        maxWidth: 1100

        PageHeader { title: "Configurações"; subtitle: "Personalize o Screenlet." }

        Section {
            title: "Aparência"
            description: "Tema da interface."
            RowLayout {
                Layout.fillWidth: true
                spacing: 12
                Repeater {
                    model: [{ v: "light", l: "Claro", d: "Fundo claro", i: "sun" }, { v: "dark", l: "Escuro", d: "Fundo grafite", i: "moon" }, { v: "system", l: "Sistema", d: "Segue o sistema", i: "monitor" }]
                    delegate: Rectangle {
                        required property var modelData
                        readonly property bool on: Settings.theme === modelData.v
                        Layout.fillWidth: true
                        Layout.preferredHeight: 84
                        radius: 16
                        color: on ? Theme.accentSoft : Theme.surface
                        border.color: on ? Theme.ink : Theme.border
                        border.width: on ? 2 : 1
                        scale: tma.containsMouse ? 1.02 : 1
                        Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack } }
                        RowLayout {
                            anchors.fill: parent
                            anchors.margins: 14
                            spacing: 12
                            Icon { name: modelData.i; size: 22; color: Theme.ink }
                            ColumnLayout { spacing: 0; T { text: modelData.l; bold: true } T { text: modelData.d; tone: "muted"; size: 12 } }
                        }
                        MouseArea { id: tma; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: Settings.theme = modelData.v }
                    }
                }
            }
        }

        Section {
            title: "Lojas"
            description: "Perfis usados no assistente e mostrados na barra lateral."
            Repeater {
                model: StoreProfiles.items
                delegate: RowLayout {
                    required property var modelData
                    Layout.fillWidth: true
                    spacing: 12
                    Rectangle {
                        width: 40; height: 40; radius: 12; color: modelData.brandColor || "#6e56f8"; clip: true
                        Image { anchors.fill: parent; anchors.margins: 4; source: modelData.logoPath ? Storage.url(modelData.logoPath) : ""; fillMode: Image.PreserveAspectFit; sourceSize.width: 80 }
                    }
                    T { text: modelData.name; bold: true; Layout.fillWidth: true }
                    Pill { visible: StoreProfiles.active.id === modelData.id; kind: "live"; dot: false; text: "Ativa" }
                    Btn { visible: StoreProfiles.active.id !== modelData.id; text: "Ativar"; small: true; onClicked: StoreProfiles.setActive(modelData.id) }
                    IconBtn { iconName: "trash"; danger: true; label: "Remover loja"; box: 32; onClicked: StoreProfiles.remove(modelData.id) }
                }
            }
            T { visible: StoreProfiles.items.length === 0; tone: "muted"; text: "Nenhuma loja ainda — ela é criada no primeiro passo do assistente." }
        }

        Section {
            title: "Inicialização"
            description: "Para equipamentos de sinalização que ficam sempre ligados."
            Toggle {
                Layout.fillWidth: true
                text: "Iniciar o Screenlet com o computador (minimizado na bandeja)"
                checked: Settings.launchAtLogin
                onToggled: Settings.launchAtLogin = checked
            }
            Toggle {
                Layout.fillWidth: true
                enabled: Settings.launchAtLogin
                opacity: enabled ? 1 : 0.5
                text: "Iniciar o servidor IPTV automaticamente nessa inicialização"
                checked: Settings.autoStartIptv
                onToggled: Settings.autoStartIptv = checked
            }
            T { tone: "muted"; size: 12; text: "Fechar a janela mantém o Screenlet na bandeja, com o servidor IPTV no ar. Use \"Sair\" no ícone da bandeja para encerrar."; Layout.fillWidth: true }
        }

        Section {
            title: "Vídeo e renderização"
            description: "Qualidade maior gera arquivos maiores."
            RowLayout {
                Layout.fillWidth: true
                spacing: 12
                Field {
                    Layout.fillWidth: true
                    label: "Codec"
                    Select { options: [{ value: "h264", text: "H.264 (mais compatível)" }, { value: "h265", text: "H.265 / HEVC (arquivos menores)" }]; value: Settings.videoCodec; onPicked: (v) => Settings.videoCodec = v }
                }
                Field {
                    Layout.fillWidth: true
                    label: "Qualidade"
                    Select { options: [{ value: "high", text: "Alta" }, { value: "medium", text: "Média" }, { value: "low", text: "Baixa (arquivo menor)" }]; value: Settings.videoQuality; onPicked: (v) => Settings.videoQuality = v }
                }
            }
            Field {
                Layout.fillWidth: true
                label: "Codificação do vídeo"
                hint: Settings.videoEncoder === "cpu"
                      ? "Usa só o processador: mais lento, mas funciona em qualquer computador."
                      : (page.hwEncoders.length > 0
                         ? "Encoder da placa de vídeo: " + page.hwEncoders.join(", ") + "."
                         : (SystemInfo.isWindows ? "Nenhum encoder de hardware encontrado: o processador será usado." : "VideoToolbox no Mac (Apple Silicon e Intel)."))
                Select {
                    options: [{ value: "auto", text: "Placa de vídeo (NVENC, AMD, Intel Quick Sync, VideoToolbox)" }, { value: "cpu", text: "Somente processador (software)" }]
                    value: Settings.videoEncoder
                    onPicked: (v) => Settings.videoEncoder = v
                }
            }
        }

        Section {
            title: "Placa de vídeo"
            description: "Como o Screenlet desenha a prévia e os quadros dos vídeos. As mudanças valem depois de reiniciar."
            RowLayout {
                Layout.fillWidth: true
                spacing: 12
                Field {
                    Layout.fillWidth: true
                    Layout.preferredWidth: 1
                    label: "API gráfica"
                    hint: (page.graphicsApis.find(a => a.value === Settings.graphicsApi) || {}).hint || ""
                    Select { options: page.graphicsApis; value: Settings.graphicsApi; onPicked: (v) => Settings.graphicsApi = v }
                }
                Field {
                    visible: SystemInfo.isWindows
                    Layout.fillWidth: true
                    Layout.preferredWidth: 1
                    label: "GPU usada"
                    hint: page.gpus.length > 1 ? "Em notebooks, escolha entre a placa dedicada e a integrada." : "Só faz diferença em computadores com mais de uma placa."
                    Select {
                        options: [{ value: "auto", text: "Automática (o Windows decide)" }, { value: "high", text: "Alto desempenho (placa dedicada)" }, { value: "low", text: "Economia de energia (integrada)" }]
                        value: Settings.gpuPreference
                        onPicked: (v) => Settings.gpuPreference = v
                    }
                }
            }
            T {
                Layout.fillWidth: true
                size: 12
                tone: "muted"
                wrapMode: Text.WordWrap
                text: "Em uso agora: " + (SystemInfo.graphicsApiInUse || "—") + (SystemInfo.gpuName ? " · " + SystemInfo.gpuName : "")
                      + (page.gpus.length > 0 ? "\nPlacas detectadas: " + page.gpus.map(g => g.name + (g.integrated ? " (integrada)" : "")).join(", ") : "")
            }
            Rectangle {
                visible: SystemInfo.graphicsNote !== ""
                Layout.fillWidth: true
                implicitHeight: noteText.implicitHeight + 20
                radius: 12
                color: Theme.amberSoft
                border.color: Theme.amberLine
                T { id: noteText; anchors.fill: parent; anchors.margins: 10; size: 12; wrapMode: Text.WordWrap; color: Theme.amberInk; text: SystemInfo.graphicsNote }
            }
            RowLayout {
                visible: page.graphicsRestart
                Layout.fillWidth: true
                spacing: 12
                Pill { kind: "warn"; text: "Reinicie para aplicar" }
                Item { Layout.fillWidth: true }
                Btn { text: "Reiniciar agora"; iconName: "refresh"; small: true; onClicked: SystemInfo.relaunch(150) }
            }
        }

        Section {
            title: "Integrações"
            description: "StockEasy: busca preços pela referência cadastrada nos produtos."
            Toggle { Layout.fillWidth: true; text: "Ativar integração com o StockEasy"; checked: StockEasy.enabled; onToggled: StockEasy.enabled = checked }
            ColumnLayout {
                Layout.fillWidth: true
                visible: StockEasy.enabled
                spacing: 12
                Field { Layout.fillWidth: true; label: "Endereço"; TextBox { text: StockEasy.baseUrl; onEditingFinished: StockEasy.baseUrl = text } }
                Field {
                    Layout.fillWidth: true
                    label: "Chave de API"
                    hint: StockEasy.needsReauth ? "A chave salva pela versão anterior precisa ser informada de novo." : (StockEasy.hasApiKey ? "Uma chave está salva no cofre do sistema." : "")
                    RowLayout {
                        width: parent.width
                        TextBox { id: keyBox; Layout.fillWidth: true; echoMode: TextInput.Password; placeholderText: StockEasy.hasApiKey ? "••••••••••••" : "Cole a chave aqui" }
                        Btn { text: "Salvar"; small: true; enabled: keyBox.text.trim() !== ""; onClicked: { StockEasy.setApiKey(keyBox.text); keyBox.text = ""; Toasts.success("Chave de API salva.") } }
                        Btn { visible: StockEasy.hasApiKey; text: "Remover"; small: true; variant: "ghost"; onClicked: { StockEasy.clearApiKey(); Toasts.info("Chave de API removida.") } }
                    }
                }
                RowLayout {
                    T { text: "Loja de referência: " + (StockEasy.selectedStore || "escolhida na próxima sincronização"); tone: "muted"; Layout.fillWidth: true }
                    Btn { visible: !!StockEasy.selectedStore; text: "Trocar loja"; small: true; onClicked: { StockEasy.selectedStore = ""; Toasts.info("Loja redefinida — você escolherá na próxima sincronização.") } }
                }
            }
        }

        Section {
            title: "Dados e backup"
            description: "Exporte ou restaure só o que precisar. Backups com senhas e chaves de API saem criptografados (AES-256) e só abrem com a senha que você definir."
            T { tone: "eyebrow"; text: "Criar backup" }
            Flow {
                Layout.fillWidth: true
                spacing: 8
                Repeater {
                    model: Backup.categories()
                    delegate: Rectangle {
                        required property var modelData
                        readonly property bool on: page.exportKeys.indexOf(modelData.key) >= 0
                        height: 34
                        width: bl.implicitWidth + 40
                        radius: 17
                        color: on ? Theme.inverse : Theme.surface
                        border.color: Theme.borderStrong
                        border.width: on ? 0 : 1
                        Row {
                            anchors.centerIn: parent
                            spacing: 6
                            Icon { visible: parent.parent.on; name: "check"; size: 13; stroke: 3; color: Theme.accent; anchors.verticalCenter: parent.verticalCenter }
                            Icon { visible: !!modelData.credentials; name: "lock"; size: 13; color: parent.parent.on ? Theme.accent : Theme.amberInk; anchors.verticalCenter: parent.verticalCenter }
                            Text { id: bl; text: modelData.label; color: parent.parent.on ? Theme.inverseInk : Theme.ink; font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold }
                        }
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: { const k = page.exportKeys.slice(); const i = k.indexOf(modelData.key); if (i >= 0) k.splice(i, 1); else k.push(modelData.key); page.exportKeys = k }
                        }
                    }
                }
            }
            // Password: mandatory with credentials, optional otherwise.
            Toggle {
                id: lockToggle
                visible: !page.mustLock
                Layout.fillWidth: true
                text: "Proteger este backup com senha"
            }
            Rectangle {
                visible: page.mustLock || lockToggle.checked
                Layout.fillWidth: true
                Layout.preferredHeight: lockCol.implicitHeight + 28
                radius: 16
                color: Theme.amberSoft
                border.color: Theme.amberLine
                ColumnLayout {
                    id: lockCol
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 10
                    RowLayout {
                        spacing: 10
                        Icon { name: "lock"; color: Theme.amberInk; size: 20 }
                        T {
                            Layout.fillWidth: true
                            color: Theme.amberInk
                            size: 13
                            text: page.mustLock
                                  ? "Este backup leva senhas de dispositivos e chaves de integração. Ele será criptografado com AES-256 e só abre com a senha abaixo — sem ela não há como recuperar."
                                  : "O backup será criptografado com AES-256. Guarde a senha: sem ela não há como recuperar."
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 10
                        TextBox { id: pw1; Layout.fillWidth: true; echoMode: TextInput.Password; placeholderText: "Senha (mínimo 8 caracteres)"; iconName: "lock" }
                        TextBox { id: pw2; Layout.fillWidth: true; echoMode: TextInput.Password; placeholderText: "Repita a senha" }
                    }
                    T {
                        visible: pw1.text.length > 0 && (pw1.text.length < 8 || (pw2.text.length > 0 && pw1.text !== pw2.text))
                        size: 12
                        color: Theme.redInk
                        text: pw1.text.length < 8 ? "Use pelo menos 8 caracteres." : "As senhas não conferem."
                    }
                }
            }
            RowLayout {
                Layout.fillWidth: true
                Btn {
                    readonly property bool locking: page.mustLock || lockToggle.checked
                    readonly property bool pwOk: !locking || (pw1.text.length >= 8 && pw1.text === pw2.text)
                    text: Backup.busy ? "Trabalhando…" : (locking ? "Criar backup protegido" : "Criar backup")
                    variant: "primary"
                    iconName: locking ? "lock" : "archive"
                    busy: Backup.busy
                    enabled: !Backup.busy && page.exportKeys.length > 0 && pwOk
                    onClicked: Backup.create(page.exportKeys, locking ? pw1.text : "", function (r) {
                        if (r.ok) {
                            Toasts.success(r.encrypted ? "Backup protegido por senha criado." : "Backup criado.")
                            pw1.text = ""; pw2.text = ""
                            page.refreshBackups()
                        } else Toasts.error("Erro ao criar backup: " + r.error)
                    })
                }
                Btn { text: "Importar de um arquivo…"; iconName: "upload"; onClicked: pickBackup.open() }
                Item { Layout.fillWidth: true }
                T { text: Backup.dir; tone: "muted"; size: 12; elide: Text.ElideMiddle; wrapMode: Text.NoWrap; Layout.maximumWidth: 260 }
                IconBtn { iconName: "folder"; label: "Abrir pasta de backups"; box: 34; onClicked: Backup.openDir() }
                IconBtn { iconName: "edit"; label: "Alterar pasta de backups"; box: 34; onClicked: backupDirDlg.open() }
            }
            T { tone: "eyebrow"; text: "Backups"; visible: page.backups.length > 0; Layout.topMargin: 6 }
            Repeater {
                model: page.backups
                delegate: RowLayout {
                    required property var modelData
                    Layout.fillWidth: true
                    spacing: 10
                    Icon { name: modelData.encrypted ? "lock" : "archive"; color: modelData.encrypted ? Theme.amberInk : Theme.text2 }
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 0
                        T { text: new Date(modelData.createdAt).toLocaleString(Qt.locale("pt_BR"), "dd/MM/yyyy HH:mm"); bold: true; size: 13 }
                        T { text: Fmt.bytes(modelData.size) + " · " + (modelData.categories || []).length + " categoria(s)" + (modelData.encrypted ? " · protegido por senha" : "") + (modelData.hasSecrets ? " · com credenciais" : ""); tone: "muted"; size: 12 }
                    }
                    Btn { text: "Importar"; small: true; onClicked: { page.restoreTarget = { path: modelData.path, filename: modelData.filename, categories: modelData.categories || [], encrypted: !!modelData.encrypted, hasSecrets: !!modelData.hasSecrets }; page.importKeys = (modelData.categories || []).slice(); restoreDlg.open() } }
                    IconBtn { iconName: "folder"; label: "Mostrar"; box: 32; onClicked: Backup.reveal(modelData.filename) }
                    IconBtn { iconName: "trash"; danger: true; label: "Excluir backup"; box: 32; onClicked: { Backup.remove(modelData.filename); page.refreshBackups() } }
                }
            }
        }

        Section {
            title: "Armazenamento"
            description: "Onde ficam anúncios, mídias, templates e vídeos. Pode ser uma pasta do iCloud Drive ou OneDrive."
            RowLayout {
                Layout.fillWidth: true
                Rectangle {
                    Layout.fillWidth: true
                    height: 40
                    radius: 10
                    color: Theme.sunken
                    Text { anchors.fill: parent; anchors.leftMargin: 12; verticalAlignment: Text.AlignVCenter; text: Storage.baseDir; elide: Text.ElideMiddle; color: Theme.ink; font.family: "Menlo"; font.pixelSize: 13 }
                }
                Btn { text: "Abrir"; iconName: "folder"; small: true; onClicked: Storage.openBaseDir() }
                Btn { text: "Alterar local"; small: true; onClicked: storageDirDlg.open() }
            }
        }

        Section {
            title: "Informações da máquina"
            GridLayout {
                Layout.fillWidth: true
                columns: 2
                columnSpacing: 20
                rowSpacing: 8
                Repeater {
                    model: [["Sistema", page.info.osName], ["Arquitetura", page.info.arch], ["Processador", page.info.cpuModel], ["Núcleos", page.info.cpuCores],
                            ["Memória", page.info.totalRamGb + " GB (" + page.info.freeRamGb + " GB livres)"], ["Computador", page.info.hostname],
                            ["Versão do Qt", page.info.qtVersion], ["Dados do app", page.info.userDataDir]]
                    delegate: RowLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        T { text: modelData[0]; tone: "muted"; size: 13; Layout.preferredWidth: 110 }
                        T { text: String(modelData[1]); size: 13; bold: true; Layout.fillWidth: true; elide: Text.ElideMiddle; wrapMode: Text.NoWrap }
                    }
                }
            }
        }

        Section {
            title: "Sobre"
            RowLayout {
                Layout.fillWidth: true
                spacing: 12
                Rectangle { width: 44; height: 44; radius: 13; color: Theme.accent; Icon { anchors.centerIn: parent; name: "tag"; size: 22; color: Theme.accentInk } }
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 0
                    T { text: "Screenlet " + SystemInfo.appVersion; bold: true }
                    T { text: Updater.updateAvailable ? "Versão " + Updater.latestVersion + " disponível" : "Edição nativa (Qt " + page.info.qtVersion + ")"; tone: "muted"; size: 12; color: Updater.updateAvailable ? Theme.redInk : Theme.muted }
                }
                Btn { visible: Updater.updateAvailable; text: "Baixar atualização"; variant: "primary"; iconName: "download"; onClicked: Updater.openRelease() }
                Btn { text: "Verificar atualizações"; iconName: "refresh"; onClicked: Updater.check(true) }
                Btn { text: "Termos de Serviço"; variant: "ghost"; onClicked: SystemInfo.openExternal("https://screenlet.birdra1n.com/termos") }
            }
        }
    }

    FolderDialog {
        id: storageDirDlg
        title: "Escolher pasta de armazenamento"
        onAccepted: { page.pendingDir = SystemInfo.localPath(selectedFolder); migrateDlg.open() }
    }
    FolderDialog {
        id: backupDirDlg
        title: "Escolher pasta de backups"
        onAccepted: { Backup.setDir(SystemInfo.localPath(selectedFolder)); page.refreshBackups() }
    }
    FileDialog {
        id: pickBackup
        title: "Selecionar backup"
        nameFilters: ["Backup do Screenlet (*.zip)"]
        onAccepted: {
            const r = Backup.inspect(SystemInfo.localPath(selectedFile))
            if (!r.ok) { Toasts.error(r.error); return }
            page.restoreTarget = r
            page.importKeys = (r.categories || []).slice()
            restoreDlg.open()
        }
    }

    AppDialog {
        id: migrateDlg
        title: "Alterar pasta de armazenamento"
        subtitle: "Nova pasta: " + page.pendingDir
        Toggle { id: copyToggle; Layout.fillWidth: true; checked: true; text: "Copiar meus dados atuais para a nova pasta (recomendado)" }
        T { tone: "muted"; size: 12; Layout.fillWidth: true; text: "O Screenlet reinicia para passar a usar a nova pasta. Os arquivos antigos não são apagados." }
        actions: [
            Btn { text: "Cancelar"; onClicked: migrateDlg.close() },
            Btn {
                text: "Confirmar e reiniciar"
                variant: "primary"
                onClicked: Storage.migrate(page.pendingDir, copyToggle.checked, function (r) {
                    if (!r.ok) Toasts.error("Erro ao migrar: " + r.error)
                    else Toasts.success("Pronto! Reiniciando…")
                })
            }
        ]
    }

    AppDialog {
        id: restoreDlg
        title: "Importar backup"
        subtitle: page.restoreTarget ? page.restoreTarget.filename : ""
        onOpened: restorePw.text = ""
        T { tone: "muted"; Layout.fillWidth: true; text: "Escolha o que restaurar. As pastas escolhidas são substituídas pelo conteúdo do backup e o app reinicia." }
        Field {
            visible: !!(page.restoreTarget && page.restoreTarget.encrypted)
            Layout.fillWidth: true
            label: "Senha do backup"
            hint: page.restoreTarget && page.restoreTarget.hasSecrets ? "As senhas e chaves de API voltam para o cofre (Keychain) deste computador." : ""
            TextBox { id: restorePw; echoMode: TextInput.Password; iconName: "lock" }
        }
        Repeater {
            model: Backup.categories().filter(c => page.restoreTarget && (page.restoreTarget.categories || []).indexOf(c.key) >= 0)
            delegate: Toggle {
                required property var modelData
                Layout.fillWidth: true
                text: modelData.label
                checked: page.importKeys.indexOf(modelData.key) >= 0
                onToggled: { const k = page.importKeys.slice(); const i = k.indexOf(modelData.key); if (i >= 0) k.splice(i, 1); else k.push(modelData.key); page.importKeys = k }
            }
        }
        actions: [
            Btn { text: "Cancelar"; onClicked: restoreDlg.close() },
            Btn {
                text: "Importar e reiniciar"
                variant: "primary"
                busy: Backup.busy
                enabled: page.importKeys.length > 0 && !Backup.busy && (!page.restoreTarget || !page.restoreTarget.encrypted || restorePw.text.length > 0)
                onClicked: Backup.restore(page.restoreTarget.path, page.importKeys, restorePw.text, function (r) {
                    if (r.ok) Toasts.success("Importado! Reiniciando o app…")
                    else Toasts.error("Erro ao importar: " + r.error)
                })
            }
        ]
    }
}
