import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import QtMultimedia
import Screenlet

// Canais e grade — channel list; opening one goes to the Studio.
Item {
    id: page
    property var params: ({})
    property var editing: null

    Component.onCompleted: { Channels.refresh(); Exports.refresh() }

    ScrollPage {
        anchors.fill: parent

        PageHeader {
            title: "Canais e grade"
            subtitle: "Cada canal é uma programação que pode tocar em várias telas."
            Btn { text: "Novo canal"; variant: "primary"; iconName: "plus"; onClicked: { page.editing = null; editDlg.open() } }
        }

        GridLayout {
            width: parent.width
            columns: Math.max(1, Math.floor((width + 16) / 360))
            columnSpacing: 16
            rowSpacing: 16
            Repeater {
                model: Channels.items
                delegate: Card {
                    id: cc
                    required property var modelData
                    required property int index
                    readonly property bool on: modelData.enabled !== false
                    readonly property string now: (Insights.tick, Channels.currentAsset(modelData))
                    readonly property var screens: Insights.pairedPlayers.filter(p => p.channelId === modelData.id).length + Kodi.items.filter(k => k.defaultChannelId === modelData.id).length
                    Layout.fillWidth: true
                    Layout.preferredHeight: ccol.implicitHeight
                    popDelay: Math.min(index, 10) * Motion.stagger
                    lift: true
                    roundClip: true

                    ColumnLayout {
                        id: ccol
                        width: parent.width
                        spacing: 0
                        Rectangle {
                            Layout.fillWidth: true
                            Layout.preferredHeight: width * 9 / 16 * 0.62
                            color: "#000"
                            clip: true
                            MediaPlayer {
                                id: cp
                                source: cc.now && cc.on ? Storage.exportUrl(cc.now) : ""
                                videoOutput: cvo
                                loops: MediaPlayer.Infinite
                                onSourceChanged: if (source != "") play()
                                Component.onCompleted: if (source != "") play()
                            }
                            VideoOutput { id: cvo; anchors.fill: parent; fillMode: VideoOutput.PreserveAspectCrop; opacity: cc.on ? 1 : 0.3 }
                            ColumnLayout {
                                anchors.centerIn: parent
                                visible: !cc.now
                                Icon { name: "tv"; size: 26; color: "#9AA0AE"; Layout.alignment: Qt.AlignHCenter }
                                Text { text: "Sem programação"; color: "#C9CDD5"; font.family: Theme.bodyFont; font.pixelSize: 13 }
                            }
                            Row {
                                anchors.left: parent.left
                                anchors.top: parent.top
                                anchors.margins: 10
                                spacing: 6
                                Pill { kind: cc.on && cc.now ? "live" : "neutral"; text: cc.on ? (cc.now ? "No ar" : "Vazio") : "Desativado" }
                            }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            Layout.margins: 14
                            spacing: 4
                            RowLayout {
                                Layout.fillWidth: true
                                H { level: 4; text: cc.modelData.name; Layout.fillWidth: true; elide: Text.ElideRight; wrapMode: Text.NoWrap }
                                Toggle { checked: cc.on; onToggled: { Channels.save(Object.assign({}, cc.modelData, { enabled: checked })); Toasts.success(checked ? "\"" + cc.modelData.name + "\" ativado." : "\"" + cc.modelData.name + "\" desativado.") } }
                            }
                            T { visible: !!cc.modelData.description; text: cc.modelData.description || ""; tone: "muted"; size: 13; Layout.fillWidth: true }
                            T {
                                size: 12
                                tone: "muted"
                                Layout.fillWidth: true
                                text: (cc.modelData.playlist || []).length + " vídeo(s) · " + (cc.modelData.rules || []).length + " regra(s) · " + cc.screens + " tela(s)"
                                      + (cc.modelData.loop ? " · em loop" : "")
                            }
                            RowLayout {
                                Layout.topMargin: 8
                                spacing: 6
                                Btn { text: "Abrir Studio"; small: true; variant: "dark"; iconName: "list"; Layout.fillWidth: true; onClicked: Nav.go("studio", { id: cc.modelData.id }) }
                                IconBtn { iconName: "edit"; label: "Renomear"; box: 34; onClicked: { page.editing = cc.modelData; editDlg.open() } }
                                IconBtn { iconName: "link"; label: "Copiar link IPTV"; box: 34; onClicked: { SystemInfo.copyText(Iptv.baseUrl() + "/channel/" + cc.modelData.id); Toasts.success("Link do canal copiado.") } }
                                IconBtn { iconName: "trash"; danger: true; label: "Excluir"; box: 34; onClicked: { page.editing = cc.modelData; delDlg.open() } }
                            }
                        }
                    }
                }
            }
        }

        EmptyState {
            visible: Channels.items.length === 0
            width: parent.width
            iconName: "tv"
            title: "Nenhum canal criado"
            text: "Crie um canal, monte a playlist com seus vídeos e conecte as telas da loja."
            Btn { text: "Criar canal"; variant: "primary"; iconName: "plus"; onClicked: { page.editing = null; editDlg.open() } }
        }
    }

    AppDialog {
        id: editDlg
        title: page.editing ? "Editar canal" : "Novo canal"
        onOpened: { nameBox.text = page.editing ? page.editing.name : ""; descBox.text = page.editing ? page.editing.description || "" : ""; nameBox.forceActiveFocus() }
        Field { Layout.fillWidth: true; label: "Nome do canal"; TextBox { id: nameBox; placeholderText: "Ex: Açougue · TV 1"; onAccepted: okBtn.clicked() } }
        Field { Layout.fillWidth: true; label: "Descrição (opcional)"; TextBox { id: descBox; placeholderText: "Onde fica, o que passa…" } }
        actions: [
            Btn { text: "Cancelar"; onClicked: editDlg.close() },
            Btn {
                id: okBtn
                text: "Salvar"
                variant: "primary"
                enabled: nameBox.text.trim() !== ""
                onClicked: {
                    // Keeps every other field (playlist, loop, rules) intact.
                    const base = page.editing ? page.editing : Channels.blank()
                    const saved = Channels.save(Object.assign({}, base, { name: nameBox.text.trim(), description: descBox.text.trim() }))
                    editDlg.close()
                    Toasts.success(page.editing ? "Canal atualizado." : "Canal criado.")
                    if (!page.editing) Nav.go("studio", { id: saved.id })
                }
            }
        ]
    }

    AppDialog {
        id: delDlg
        title: "Excluir canal?"
        subtitle: page.editing ? "\"" + page.editing.name + "\" deixará de existir nas TVs. Os vídeos continuam em Vídeos prontos." : ""
        actions: [
            Btn { text: "Cancelar"; onClicked: delDlg.close() },
            Btn { text: "Excluir"; variant: "danger"; onClicked: { Channels.remove(page.editing.id); delDlg.close(); Toasts.info("Canal removido.") } }
        ]
    }
}
