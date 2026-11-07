import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Screenlet

// Telas — Screenlet Player devices (scan/pair) and Kodi/LibreELEC boxes.
Item {
    id: page
    property var params: ({})
    property var pairTarget: null
    property var kodiEditing: null

    Component.onCompleted: {
        Channels.refresh()
        if (params.pair) {
            const d = Players.items.find(p => p.id === params.pair)
            if (d) Qt.callLater(() => { page.pairTarget = d; pairDlg.open() })
        }
    }

    readonly property var channelOptions: Channels.items.map(c => ({ value: c.id, text: c.name }))
    function channelName(id) { const c = Channels.items.find(x => x.id === id); return c ? c.name : "—" }

    ScrollPage {
        anchors.fill: parent

        PageHeader {
            title: "Telas"
            subtitle: Insights.screensOnline + " de " + Insights.screensTotal + " tela(s) online"
            Btn { text: Players.scanning ? "Procurando…" : "Procurar players na rede"; iconName: "wifi"; busy: Players.scanning; enabled: !Players.scanning
                  onClicked: Players.scan(function (r) { if (r.ok) Toasts.info(r.found ? r.found + " player(s) encontrado(s)." : "Nenhum player novo na rede.") }) }
            Btn { text: "Adicionar Kodi"; variant: "primary"; iconName: "plus"; onClicked: { page.kodiEditing = null; kodiDlg.open() } }
        }

        // Detected (unpaired) players
        Card {
            visible: Insights.unpairedPlayers.length > 0
            width: parent.width
            height: detCol.implicitHeight + 32
            color: Theme.inverse
            border.width: 0
            ColumnLayout {
                id: detCol
                anchors.fill: parent
                anchors.margins: 16
                spacing: 10
                Text { text: "PLAYERS ENCONTRADOS NA REDE"; color: Theme.accent; font.family: Theme.bodyFont; font.pixelSize: 12; font.weight: Font.Bold; font.letterSpacing: 0.6 }
                Repeater {
                    model: Insights.unpairedPlayers
                    delegate: RowLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: 12
                        LiveDot { active: Insights.playerOnline(modelData) }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 0
                            Text { text: modelData.name; color: Theme.inverseInk; font.family: Theme.displayFont; font.pixelSize: 17; font.weight: Font.Bold }
                            Text {
                                text: "Screenlet Player " + (modelData.playerVersion || "") + (modelData.apiUrl ? " · " + modelData.apiUrl.replace("http://", "") : "") + (modelData.pairingCode ? " · código " + modelData.pairingCode : "")
                                color: Theme.dark ? "#5B6170" : "#B9BDC8"; font.family: Theme.bodyFont; font.pixelSize: 12
                            }
                        }
                        Btn { text: "Parear"; variant: "primary"; small: true; onClicked: { page.pairTarget = modelData; pairDlg.open() } }
                        IconBtn { iconName: "x"; label: "Esquecer"; box: 32; onClicked: Players.remove(modelData.id) }
                    }
                }
            }
        }

        H { level: 3; text: "Screenlet Player" }
        GridLayout {
            width: parent.width
            columns: Math.max(1, Math.floor((width + 14) / 340))
            columnSpacing: 14
            rowSpacing: 14
            Repeater {
                model: Insights.pairedPlayers
                delegate: Card {
                    required property var modelData
                    required property int index
                    readonly property bool online: Insights.playerOnline(modelData)
                    Layout.fillWidth: true
                    Layout.preferredHeight: 150
                    popDelay: index * 50
                    lift: true
                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 6
                        RowLayout {
                            Layout.fillWidth: true
                            SignalBars { online: parent.parent.parent.online }
                            H { level: 4; text: modelData.name; Layout.fillWidth: true; elide: Text.ElideRight; wrapMode: Text.NoWrap }
                            Pill { kind: parent.parent.parent.online ? (modelData.playing ? "live" : "scheduled") : "warn"; text: parent.parent.parent.online ? (modelData.playing ? "Tocando" : "Online") : "Offline · cache" }
                        }
                        T { tone: "muted"; size: 13; text: "Canal: " + page.channelName(modelData.channelId) }
                        T { tone: "faint"; size: 12; text: "v" + (modelData.playerVersion || "?") + " · visto " + (modelData.lastSeenAt ? Fmt.relative(modelData.lastSeenAt) : "nunca") }
                        Item { Layout.fillHeight: true }
                        RowLayout {
                            Btn { text: "Trocar canal"; small: true; onClicked: { page.pairTarget = modelData; pairDlg.open() } }
                            Btn { text: "Desparear"; small: true; variant: "ghost"; iconName: "unlink"; onClicked: { Players.unpair(modelData.id); Toasts.info("\"" + modelData.name + "\" despareado.") } }
                            Item { Layout.fillWidth: true }
                            IconBtn { iconName: "trash"; danger: true; label: "Excluir"; box: 32; onClicked: Players.remove(modelData.id) }
                        }
                    }
                }
            }
        }
        T { visible: Insights.pairedPlayers.length === 0; tone: "muted"; text: "Nenhum Screenlet Player pareado. Ligue o player na mesma rede e clique em \"Procurar players na rede\"." }

        H { level: 3; text: "Kodi / LibreELEC" }
        GridLayout {
            width: parent.width
            columns: Math.max(1, Math.floor((width + 14) / 340))
            columnSpacing: 14
            rowSpacing: 14
            Repeater {
                model: Kodi.items
                delegate: Card {
                    id: kc
                    required property var modelData
                    required property int index
                    property string status: ""
                    property bool busy: false
                    Layout.fillWidth: true
                    Layout.preferredHeight: 160
                    popDelay: index * 50
                    lift: true
                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 6
                        RowLayout {
                            Layout.fillWidth: true
                            Rectangle { width: 34; height: 34; radius: 10; color: Theme.blueSoft; Icon { anchors.centerIn: parent; name: "monitor"; size: 17; color: Theme.blue } }
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 0
                                H { level: 4; text: kc.modelData.name || kc.modelData.ip; elide: Text.ElideRight; wrapMode: Text.NoWrap; Layout.fillWidth: true }
                                T { tone: "muted"; size: 12; text: kc.modelData.ip + " · canal " + page.channelName(kc.modelData.defaultChannelId) }
                            }
                            Pill { visible: !!kc.modelData.needsReauth; kind: "warn"; text: "Senha necessária" }
                        }
                        T { visible: kc.status !== ""; size: 12; text: kc.status; color: kc.status.indexOf("Kodi") === 0 ? Theme.greenInk : Theme.redInk; Layout.fillWidth: true; elide: Text.ElideRight; wrapMode: Text.NoWrap }
                        Item { Layout.fillHeight: true }
                        RowLayout {
                            Btn { text: "Testar"; small: true; busy: kc.busy; onClicked: { kc.busy = true; Kodi.ping(kc.modelData.id, function (r) { kc.busy = false; kc.status = r.ok ? "Kodi " + r.version + " respondendo" : r.error }) } }
                            Btn {
                                text: "Reiniciar e abrir"
                                small: true
                                onClicked: Kodi.restartAndOpen(kc.modelData.id, function (r) {
                                    if (r.ok) Toasts.success("Kodi reiniciado em " + kc.modelData.name + ". Canal será aberto em " + kc.modelData.restartDelaySecs + " s.")
                                    else Toasts.error("Falha ao reiniciar " + kc.modelData.name + ": " + r.error)
                                })
                            }
                            Item { Layout.fillWidth: true }
                            IconBtn { iconName: "edit"; label: "Editar"; box: 32; onClicked: { page.kodiEditing = kc.modelData; kodiDlg.open() } }
                            IconBtn { iconName: "trash"; danger: true; label: "Excluir"; box: 32; onClicked: { Kodi.remove(kc.modelData.id); Toasts.info("Dispositivo removido.") } }
                        }
                    }
                }
            }
        }
        T { visible: Kodi.items.length === 0; tone: "muted"; text: "Nenhum Kodi cadastrado." }
    }

    component SignalBars: Row {
        property bool online
        spacing: 2
        height: 14
        Repeater {
            model: 3
            delegate: Rectangle {
                required property int index
                width: 3
                height: 5 + index * 4.5
                anchors.bottom: parent.bottom
                radius: 1
                color: parent.online || index === 0 ? (parent.online ? Theme.green : Theme.red) : Theme.borderStrong
            }
        }
    }

    // ── Pair player ───────────────────────────────────────────────────────
    AppDialog {
        id: pairDlg
        property string channelId: ""
        property bool busy: false
        title: "Parear Screenlet Player"
        subtitle: page.pairTarget ? page.pairTarget.hostname || page.pairTarget.name : ""
        onOpened: { pairName.text = page.pairTarget ? page.pairTarget.name : ""; channelId = page.pairTarget && page.pairTarget.channelId ? page.pairTarget.channelId : (Channels.items.length ? Channels.items[0].id : "") }
        Field { Layout.fillWidth: true; label: "Nome da tela"; TextBox { id: pairName; placeholderText: "Ex: Açougue esquerda" } }
        Field { Layout.fillWidth: true; label: "Canal"; Select { options: page.channelOptions; value: pairDlg.channelId; onPicked: (v) => pairDlg.channelId = v } }
        T { visible: Channels.items.length === 0; tone: "muted"; text: "Crie um canal antes de parear." }
        actions: [
            Btn { text: "Cancelar"; onClicked: pairDlg.close() },
            Btn {
                text: "Parear"
                variant: "primary"
                busy: pairDlg.busy
                enabled: !!pairDlg.channelId && !pairDlg.busy
                onClicked: {
                    pairDlg.busy = true
                    Players.claim(page.pairTarget.id, pairDlg.channelId, pairName.text, function (r) {
                        pairDlg.busy = false
                        if (r.ok) { Toasts.success("\"" + (pairName.text || page.pairTarget.name) + "\" pareado."); pairDlg.close() }
                        else Toasts.error(r.error)
                    })
                }
            }
        ]
    }

    // ── Kodi: 3-step setup ────────────────────────────────────────────────
    AppDialog {
        id: kodiDlg
        property int step: 1
        property var d: ({})
        property var kodiChannels: []
        property bool working: false
        title: page.kodiEditing ? "Editar Kodi" : "Adicionar Kodi"
        subtitle: ["Acesso SSH", "Kodi HTTP (API)", "Programação"][step - 1] + " · passo " + step + " de 3"
        dialogWidth: 560
        onOpened: {
            step = 1
            kodiChannels = []
            d = page.kodiEditing ? Object.assign({ sshPassword: "", kodiHttpPassword: "" }, page.kodiEditing)
                                 : Object.assign(Kodi.blank(), { sshPassword: "", kodiHttpPassword: "" })
        }
        function set(p) { d = Object.assign({}, d, p) }

        ColumnLayout {
            visible: kodiDlg.step === 1
            Layout.fillWidth: true
            spacing: 12
            Field { Layout.fillWidth: true; label: "Nome"; TextBox { text: kodiDlg.d.name || ""; placeholderText: "Ex: TV do açougue"; onTextEdited: kodiDlg.set({ name: text }) } }
            RowLayout {
                Layout.fillWidth: true
                Field { Layout.fillWidth: true; label: "IP"; TextBox { text: kodiDlg.d.ip || ""; placeholderText: "192.168.0.50"; onTextEdited: kodiDlg.set({ ip: text }) } }
                Field { Layout.preferredWidth: 100; label: "Porta SSH"; TextBox { text: String(kodiDlg.d.sshPort || 22); onTextEdited: kodiDlg.set({ sshPort: Number(text) }) } }
            }
            RowLayout {
                Layout.fillWidth: true
                Field { Layout.fillWidth: true; label: "Usuário SSH"; TextBox { text: kodiDlg.d.sshUser || ""; onTextEdited: kodiDlg.set({ sshUser: text }) } }
                Field { Layout.fillWidth: true; label: "Senha SSH"; hint: kodiDlg.d.hasSshPassword ? "Em branco mantém a senha salva." : ""; TextBox { echoMode: TextInput.Password; text: kodiDlg.d.sshPassword || ""; onTextEdited: kodiDlg.set({ sshPassword: text }) } }
            }
        }
        ColumnLayout {
            visible: kodiDlg.step === 2
            Layout.fillWidth: true
            spacing: 12
            Btn {
                text: "Buscar configuração automaticamente"
                iconName: "wand"
                busy: kodiDlg.working
                enabled: !!kodiDlg.d.sshPassword
                onClicked: {
                    kodiDlg.working = true
                    Kodi.fetchConfig({ ip: kodiDlg.d.ip, sshPort: kodiDlg.d.sshPort, sshUser: kodiDlg.d.sshUser, sshPassword: kodiDlg.d.sshPassword }, function (r) {
                        kodiDlg.working = false
                        if (!r.ok) { Toasts.error("Falha ao ler configuração: " + r.error); return }
                        kodiDlg.set({ kodiHttpPort: r.port, kodiHttpUser: r.user, kodiHttpPassword: r.password })
                        Toasts.success("Configuração do Kodi encontrada.")
                    })
                }
            }
            T { tone: "muted"; size: 12; Layout.fillWidth: true; text: kodiDlg.d.sshPassword ? "Lê o guisettings.xml do Kodi por SSH e preenche os campos." : "Informe a senha SSH no passo anterior para buscar automaticamente." }
            RowLayout {
                Layout.fillWidth: true
                Field { Layout.preferredWidth: 110; label: "Porta HTTP"; TextBox { text: String(kodiDlg.d.kodiHttpPort || 8080); onTextEdited: kodiDlg.set({ kodiHttpPort: Number(text) }) } }
                Field { Layout.fillWidth: true; label: "Usuário"; TextBox { text: kodiDlg.d.kodiHttpUser || ""; onTextEdited: kodiDlg.set({ kodiHttpUser: text }) } }
                Field { Layout.fillWidth: true; label: "Senha"; TextBox { echoMode: TextInput.Password; text: kodiDlg.d.kodiHttpPassword || ""; onTextEdited: kodiDlg.set({ kodiHttpPassword: text }) } }
            }
        }
        ColumnLayout {
            visible: kodiDlg.step === 3
            Layout.fillWidth: true
            spacing: 12
            Field { Layout.fillWidth: true; label: "Canal do Screenlet"; Select { options: page.channelOptions; value: kodiDlg.d.defaultChannelId || ""; onPicked: (v) => kodiDlg.set({ defaultChannelId: v }) } }
            RowLayout {
                Layout.fillWidth: true
                Field {
                    Layout.fillWidth: true
                    label: "Canal no Kodi (PVR)"
                    Select { options: kodiDlg.kodiChannels.map(c => ({ value: c.channelid, text: c.label })); value: kodiDlg.d.kodiChannelId; onPicked: (v) => kodiDlg.set({ kodiChannelId: v }) }
                }
                Btn {
                    text: "Carregar"
                    Layout.alignment: Qt.AlignBottom
                    busy: kodiDlg.working
                    onClicked: {
                        kodiDlg.working = true
                        Kodi.listChannels({ ip: kodiDlg.d.ip, kodiHttpPort: kodiDlg.d.kodiHttpPort, kodiHttpUser: kodiDlg.d.kodiHttpUser, kodiHttpPassword: kodiDlg.d.kodiHttpPassword }, function (list) {
                            kodiDlg.working = false
                            kodiDlg.kodiChannels = list
                            if (!list.length) Toasts.error("Nenhum canal encontrado. Verifique as credenciais do Kodi.")
                        })
                    }
                }
            }
            Field { Layout.fillWidth: true; label: "Esperar após reiniciar · " + (kodiDlg.d.restartDelaySecs || 20) + " s"; AppSlider { from: 5; to: 60; stepSize: 1; value: kodiDlg.d.restartDelaySecs || 20; onMoved: kodiDlg.set({ restartDelaySecs: Math.round(value) }) } }
        }

        actions: [
            Btn { text: kodiDlg.step === 1 ? "Cancelar" : "Voltar"; onClicked: kodiDlg.step === 1 ? kodiDlg.close() : kodiDlg.step-- },
            Btn {
                text: kodiDlg.step < 3 ? "Próximo" : "Salvar"
                variant: "primary"
                enabled: kodiDlg.step !== 1 || (!!kodiDlg.d.ip && !!kodiDlg.d.sshUser)
                onClicked: {
                    if (kodiDlg.step < 3) { kodiDlg.step++; return }
                    Kodi.save(kodiDlg.d)
                    Toasts.success(page.kodiEditing ? "Dispositivo atualizado." : "Dispositivo cadastrado.")
                    kodiDlg.close()
                }
            }
        ]
    }
}
