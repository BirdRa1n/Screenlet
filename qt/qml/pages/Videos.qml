import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import QtMultimedia
import Screenlet

// Vídeos prontos — rendered MP4s, where they play, preview / reveal / delete.
Item {
    id: page
    property var params: ({})
    property var playing: null
    property var target: null

    Component.onCompleted: { Exports.refresh(); Channels.refresh() }

    ScrollPage {
        anchors.fill: parent

        PageHeader {
            title: "Vídeos prontos"
            subtitle: Exports.items.length + " vídeo(s) em " + Storage.exportsDir
            Btn { text: "Abrir pasta"; iconName: "folder"; onClicked: Storage.openExportsDir() }
            Btn { text: "Atualizar"; iconName: "refresh"; onClicked: Exports.refresh() }
        }

        GridLayout {
            width: parent.width
            columns: Math.max(1, Math.floor((width + 14) / 320))
            columnSpacing: 14
            rowSpacing: 14
            Repeater {
                model: Exports.items
                delegate: Card {
                    id: vc
                    required property var modelData
                    required property int index
                    readonly property var used: Insights.channelsForFile(modelData.filename)
                    Layout.fillWidth: true
                    Layout.preferredHeight: vcol.implicitHeight
                    popDelay: Math.min(index, 12) * 45
                    lift: true
                    roundClip: true
                    ColumnLayout {
                        id: vcol
                        width: parent.width
                        spacing: 0
                        Rectangle {
                            Layout.fillWidth: true
                            Layout.preferredHeight: width * 9 / 16
                            color: "#000"
                            MediaThumb { anchors.fill: parent; radius: 0; color: "#000"; path: "exports/" + vc.modelData.filename; type: "video" }
                            Rectangle {
                                anchors.centerIn: parent
                                width: 56; height: 56; radius: 28
                                color: Theme.accent
                                opacity: vc.hovered ? 1 : 0
                                scale: vc.hovered ? 1 : 0.6
                                Behavior on opacity { NumberAnimation { duration: Motion.base } }
                                Behavior on scale { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 2.5 } }
                                Icon { anchors.centerIn: parent; anchors.horizontalCenterOffset: 2; name: "play"; filled: true; size: 20; color: Theme.accentInk }
                            }
                            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { page.playing = vc.modelData; playDlg.open() } }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            Layout.margins: 14
                            spacing: 4
                            RowLayout {
                                Layout.fillWidth: true
                                H { level: 4; text: vc.modelData.name; elide: Text.ElideRight; wrapMode: Text.NoWrap; Layout.fillWidth: true }
                                Pill { visible: vc.used.length > 0; kind: "live"; text: "No ar" }
                            }
                            T { tone: "muted"; size: 12; text: Fmt.bytes(vc.modelData.size) + " · " + Fmt.relative(vc.modelData.modifiedAt) }
                            T { visible: vc.used.length > 0; size: 12; color: Theme.blue; text: "Em: " + vc.used.map(u => u.channel.name).join(", "); Layout.fillWidth: true }
                            RowLayout {
                                Layout.topMargin: 6
                                spacing: 6
                                Btn { text: "Reproduzir"; small: true; iconName: "play"; onClicked: { page.playing = vc.modelData; playDlg.open() } }
                                IconBtn { iconName: "folder"; label: SystemInfo.isMac ? "Mostrar no Finder" : "Mostrar na pasta"; box: 34; onClicked: Exports.reveal(vc.modelData.filename) }
                                Item { Layout.fillWidth: true }
                                IconBtn { iconName: "trash"; danger: true; label: "Excluir"; box: 34; onClicked: { page.target = vc.modelData; delDlg.open() } }
                            }
                        }
                    }
                }
            }
        }

        EmptyState {
            visible: Exports.items.length === 0
            width: parent.width
            iconName: "film"
            title: "Nenhum vídeo renderizado"
            text: "Renderize um anúncio no editor e ele aparece aqui, pronto para entrar em um canal."
            Btn { text: "Ir para Meus anúncios"; onClicked: Nav.go("anuncios") }
        }
    }

    AppDialog {
        id: playDlg
        title: page.playing ? page.playing.name : ""
        dialogWidth: 960
        onClosed: mp.stop()
        onOpened: mp.play()
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: width * 9 / 16
            radius: 12
            color: "#000"
            clip: true
            MediaPlayer { id: mp; source: page.playing ? Storage.exportUrl(page.playing.filename) : ""; videoOutput: vo; audioOutput: AudioOutput {} }
            VideoOutput { id: vo; anchors.fill: parent }
            MouseArea { anchors.fill: parent; onClicked: mp.playbackState === MediaPlayer.PlayingState ? mp.pause() : mp.play() }
        }
        RowLayout {
            Layout.fillWidth: true
            IconBtn { iconName: mp.playbackState === MediaPlayer.PlayingState ? "pause" : "play"; label: "Reproduzir/pausar"; onClicked: mp.playbackState === MediaPlayer.PlayingState ? mp.pause() : mp.play() }
            AppSlider { Layout.fillWidth: true; from: 0; to: Math.max(1, mp.duration); value: mp.position; onMoved: mp.setPosition(value) }
            T { text: Fmt.clock(mp.position / 1000 * 30, 30) + " / " + Fmt.clock(mp.duration / 1000 * 30, 30); tone: "muted"; size: 12 }
        }
    }

    AppDialog {
        id: delDlg
        title: "Excluir vídeo?"
        subtitle: page.target ? "\"" + page.target.filename + "\" será apagado do disco." + (Insights.channelsForFile(page.target.filename).length ? " Atenção: ele está em uso por canais." : "") : ""
        actions: [
            Btn { text: "Cancelar"; onClicked: delDlg.close() },
            Btn { text: "Excluir"; variant: "danger"; iconName: "trash"; onClicked: { Exports.remove(page.target.filename); delDlg.close(); Toasts.info("Vídeo removido.") } }
        ]
    }
}
