import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Screenlet

// Servidor IPTV — status, network interface, M3U/EPG links, what's on air.
Item {
    id: page
    property var params: ({})

    Component.onCompleted: { Iptv.refreshStatus(); Channels.refresh() }

    ScrollPage {
        anchors.fill: parent

        PageHeader {
            title: "Servidor IPTV"
            subtitle: "Disponibilize a programação para Smart TVs, Kodi e players na rede local."
            Btn {
                text: Iptv.running ? "Parar servidor" : "Iniciar servidor"
                variant: Iptv.running ? "danger" : "primary"
                iconName: Iptv.running ? "pause" : "play"
                onClicked: {
                    if (Iptv.running) { Iptv.stop(); Toasts.info("Servidor IPTV parado.") }
                    else if (Iptv.start()) Toasts.success("Servidor IPTV iniciado.")
                    else Toasts.error("Erro: " + Iptv.lastError)
                }
            }
        }

        Card {
            popDelay: 40
            width: parent.width
            height: 120
            color: Iptv.running ? Theme.inverse : Theme.surface
            border.width: Iptv.running ? 0 : 1
            Behavior on color { ColorAnimation { duration: Motion.slow } }
            RowLayout {
                anchors.fill: parent
                anchors.margins: 22
                spacing: 18
                Rectangle {
                    width: 64; height: 64; radius: 20
                    color: Iptv.running ? Theme.accent : Theme.sunken
                    Icon { anchors.centerIn: parent; name: "radio"; size: 30; color: Iptv.running ? Theme.accentInk : Theme.muted }
                    SequentialAnimation on scale {
                        running: Iptv.running
                        loops: Animation.Infinite
                        NumberAnimation { to: 1.06; duration: 900; easing.type: Easing.InOutSine }
                        NumberAnimation { to: 1; duration: 900; easing.type: Easing.InOutSine }
                    }
                }
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 4
                    RowLayout {
                        spacing: 8
                        LiveDot { active: Iptv.running }
                        Text { text: Iptv.running ? "No ar" : "Parado"; color: Iptv.running ? Theme.inverseInk : Theme.ink; font.family: Theme.displayFont; font.pixelSize: 26; font.weight: Font.ExtraBold }
                    }
                    Text {
                        text: Iptv.running ? Iptv.baseUrl() + " · " + Channels.items.filter(c => c.enabled !== false).length + " canal(is) ativo(s)" : "Inicie para que as telas recebam a programação."
                        color: Iptv.running ? (Theme.dark ? "#5B6170" : "#B9BDC8") : Theme.muted
                        font.family: Theme.bodyFont; font.pixelSize: 14
                    }
                }
                ColumnLayout {
                    spacing: 4
                    T { text: "Interface de rede"; size: 12; color: Iptv.running ? (Theme.dark ? "#5B6170" : "#B9BDC8") : Theme.muted }
                    Select {
                        width: 220
                        Layout.preferredWidth: 220
                        options: Iptv.ips.map(ip => ({ value: ip, text: ip + (ip.indexOf("100.") === 0 ? " (VPN)" : "") }))
                        value: Iptv.selectedIp
                        onPicked: (v) => Iptv.setIp(v)
                    }
                }
            }
        }

        Rectangle {
            visible: !Iptv.ffmpegAvailable
            width: parent.width
            height: ffRow.implicitHeight + 28
            radius: Theme.radiusXL
            color: Theme.amberSoft
            border.color: Theme.amberLine
            RowLayout {
                id: ffRow
                anchors.fill: parent
                anchors.margins: 14
                spacing: 12
                Icon { name: "alert"; color: Theme.amberInk }
                T {
                    Layout.fillWidth: true
                    color: Theme.amberInk
                    text: "O ffmpeg não foi encontrado. Ele é usado no link ao vivo de cada canal (TVs e Kodi). O Screenlet Player funciona sem ele, baixando os vídeos. Instale com "
                          + (SystemInfo.isWindows ? "winget install ffmpeg" : "brew install ffmpeg") + " e clique em Verificar."
                }
                Btn { text: "Verificar"; small: true; onClicked: Iptv.refreshStatus() }
            }
        }

        GridLayout {
            width: parent.width
            columns: width > 900 ? 2 : 1
            columnSpacing: 16
            rowSpacing: 16

            Endpoint { title: "Lista de canais (M3U)"; iconName: "list"; url: Iptv.baseUrl() + "/playlist.m3u"; hint: "Cole na Smart TV, VLC ou Kodi (PVR IPTV Simple Client)." }
            Endpoint { title: "Guia de programação (EPG)"; iconName: "calendar"; url: Iptv.baseUrl() + "/epg.xml"; hint: "Gerado a partir das regras de horário dos canais." }
        }

        Card {
            width: parent.width
            height: nowCol.implicitHeight + 32
            ColumnLayout {
                id: nowCol
                anchors.fill: parent
                anchors.margins: 16
                spacing: 10
                RowLayout {
                    H { level: 4; text: "Programação agora"; Layout.fillWidth: true }
                    T { tone: "muted"; size: 12; text: "atualiza a cada 30 s" }
                }
                Repeater {
                    model: Channels.items
                    delegate: RowLayout {
                        required property var modelData
                        readonly property string now: (Insights.tick, Channels.currentAsset(modelData))
                        readonly property string rule: (Insights.tick, (modelData.rules || []).length ? (modelData.rules.find(r => Channels.currentAsset({ rules: [r], playlist: [] }) === r.assetFilename) || {}).assetName || "" : "")
                        Layout.fillWidth: true
                        spacing: 12
                        LiveDot { active: modelData.enabled !== false && !!parent.now }
                        T { text: modelData.name; bold: true; Layout.preferredWidth: 200; elide: Text.ElideRight; wrapMode: Text.NoWrap }
                        T { text: parent.now ? parent.now.replace(/\.mp4$/i, "") : "Sem conteúdo"; tone: parent.now ? "ink" : "muted"; Layout.fillWidth: true; elide: Text.ElideRight; wrapMode: Text.NoWrap }
                        Pill { visible: parent.rule !== ""; kind: "scheduled"; text: "Regra de horário" }
                        IconBtn { iconName: "link"; label: "Copiar link do canal"; box: 30; bordered: false; onClicked: { SystemInfo.copyText(Iptv.baseUrl() + "/channel/" + modelData.id); Toasts.success("Link copiado.") } }
                    }
                }
                T { visible: Channels.items.length === 0; tone: "muted"; text: "Nenhum canal criado ainda." }
            }
        }
    }

    component Endpoint: Card {
        id: ep
        property string title
        property string iconName
        property string url
        property string hint
        property bool copied: false
        Layout.fillWidth: true
        Layout.preferredHeight: 140
        lift: true
        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 16
            spacing: 8
            RowLayout {
                spacing: 10
                Rectangle { width: 36; height: 36; radius: 11; color: Theme.blueSoft; Icon { anchors.centerIn: parent; name: ep.iconName; color: Theme.blue; size: 18 } }
                H { level: 4; text: ep.title; Layout.fillWidth: true }
            }
            RowLayout {
                Layout.fillWidth: true
                Rectangle {
                    Layout.fillWidth: true
                    height: 38
                    radius: 10
                    color: Theme.sunken
                    Text { anchors.fill: parent; anchors.leftMargin: 12; verticalAlignment: Text.AlignVCenter; text: ep.url; elide: Text.ElideMiddle; color: Iptv.running ? Theme.ink : Theme.faint; font.family: "Menlo"; font.pixelSize: 13 }
                }
                Btn {
                    text: ep.copied ? "Copiado" : "Copiar"
                    iconName: ep.copied ? "check" : "copy"
                    small: true
                    onClicked: { SystemInfo.copyText(ep.url); ep.copied = true; resetTimer.restart() }
                }
            }
            T { tone: "muted"; size: 12; text: ep.hint; Layout.fillWidth: true }
        }
        Timer { id: resetTimer; interval: 1600; onTriggered: ep.copied = false }
    }
}
