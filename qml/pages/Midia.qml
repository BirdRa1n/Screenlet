import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Dialogs
import QtQuick.Layouts
import Screenlet

// Mídia — imported images and videos (SHA-256 dedup, non-destructive remove).
Item {
    id: page
    property var params: ({})
    property string kind: "all"
    property string importKind: "image"

    Component.onCompleted: Media.refresh()

    readonly property var shown: Media.items.filter(a => kind === "all" || a.type === kind)

    ScrollPage {
        anchors.fill: parent

        PageHeader {
            title: "Mídia"
            subtitle: Media.items.length + " arquivo(s) · arquivos repetidos são detectados automaticamente"
            Btn { text: "Importar vídeo"; iconName: "video"; onClicked: { page.importKind = "video"; fileDlg.open() } }
            Btn { text: "Importar imagem"; variant: "primary"; iconName: "upload"; onClicked: { page.importKind = "image"; fileDlg.open() } }
        }

        Segmented {
            options: [{ value: "all", label: "Tudo" }, { value: "image", label: "Imagens" }, { value: "video", label: "Vídeos" }]
            value: page.kind
            onPicked: (v) => page.kind = v
        }

        // Drop zone
        Rectangle {
            width: parent.width
            height: 90
            radius: Theme.radiusXL
            color: drop.containsDrag ? Theme.accentSoft : Theme.surfaceAlt
            border.color: drop.containsDrag ? Theme.ink : Theme.borderStrong
            border.width: drop.containsDrag ? 2 : 1
            Behavior on color { ColorAnimation { duration: Motion.fast } }
            scale: drop.containsDrag ? 1.01 : 1
            Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack } }
            Row {
                anchors.centerIn: parent
                spacing: 12
                Icon { name: "upload"; size: 22; color: Theme.text2; anchors.verticalCenter: parent.verticalCenter }
                T { text: "Arraste imagens e vídeos para cá"; tone: "muted"; anchors.verticalCenter: parent.verticalCenter }
            }
            DropArea {
                id: drop
                anchors.fill: parent
                onDropped: (d) => {
                    for (const u of d.urls) {
                        const path = SystemInfo.localPath(u)
                        const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(path)
                        Media.importFile(path, isVideo ? "video" : "image", function (r) {
                            if (r.ok) Toasts.success(r.duplicate ? "\"" + r.asset.originalName + "\" já estava no catálogo." : "\"" + r.asset.originalName + "\" importado.")
                            else Toasts.error(r.error)
                        })
                    }
                }
            }
        }

        GridLayout {
            width: parent.width
            columns: Math.max(2, Math.floor((width + 12) / 200))
            columnSpacing: 12
            rowSpacing: 12
            Repeater {
                model: page.shown
                delegate: Card {
                    id: mc
                    required property var modelData
                    required property int index
                    Layout.fillWidth: true
                    Layout.preferredHeight: 196
                    popDelay: Math.min(index, 16) * 30
                    lift: true
                    roundClip: true
                    ColumnLayout {
                        anchors.fill: parent
                        spacing: 0
                        MediaThumb { Layout.fillWidth: true; Layout.preferredHeight: 136; radius: 0; path: mc.modelData.filename; type: mc.modelData.type }
                        RowLayout {
                            Layout.fillWidth: true
                            Layout.margins: 10
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 0
                                T { text: mc.modelData.originalName; size: 13; bold: true; elide: Text.ElideMiddle; wrapMode: Text.NoWrap; Layout.fillWidth: true }
                                T { text: Fmt.bytes(mc.modelData.size) + " · " + Fmt.relative(mc.modelData.importedAt); tone: "muted"; size: 11 }
                            }
                            IconBtn {
                                iconName: "trash"
                                danger: true
                                label: "Remover do catálogo"
                                box: 30
                                bordered: false
                                opacity: mc.hovered ? 1 : 0
                                Behavior on opacity { NumberAnimation { duration: Motion.fast } }
                                onClicked: { Media.remove(mc.modelData.id); Toasts.info("\"" + mc.modelData.originalName + "\" removido do catálogo (o arquivo continua no disco).") }
                            }
                        }
                    }
                }
            }
        }

        EmptyState {
            visible: page.shown.length === 0
            width: parent.width
            iconName: "image"
            title: "Nenhuma mídia ainda"
            text: "Importe imagens de produtos, logos e vídeos para usar nos anúncios."
        }
    }

    FileDialog {
        id: fileDlg
        title: page.importKind === "video" ? "Importar vídeo" : "Importar imagem"
        fileMode: FileDialog.OpenFiles
        nameFilters: page.importKind === "video" ? ["Vídeos (*.mp4 *.webm *.mov *.mkv)"] : ["Imagens (*.png *.jpg *.jpeg *.webp)"]
        onAccepted: {
            for (const u of selectedFiles)
                Media.importFile(SystemInfo.localPath(u), page.importKind, function (r) {
                    if (r.ok) Toasts.success(r.duplicate ? "Arquivo já estava no catálogo." : "\"" + r.asset.originalName + "\" importado.")
                    else Toasts.error(r.error)
                })
        }
    }
}
