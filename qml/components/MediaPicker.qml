import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Dialogs
import QtQuick.Layouts
import Screenlet

// Catalog picker dialog (images or videos) with in-place import.
AppDialog {
    id: root
    property string kind: "image"   // image | video
    signal picked(string path)

    title: kind === "video" ? "Escolher vídeo" : "Escolher imagem"
    subtitle: "Do catálogo de mídia, ou importe um arquivo novo."
    dialogWidth: 760

    readonly property var assets: Media.items.filter(a => a.type === root.kind)

    function choose() { Media.refresh(); open() }

    RowLayout {
        Layout.fillWidth: true
        T { tone: "muted"; text: root.assets.length + (root.kind === "video" ? " vídeo(s)" : " imagem(ns)"); Layout.fillWidth: true }
        Btn {
            text: root.kind === "video" ? "Importar vídeo" : "Importar imagem"
            iconName: "upload"
            small: true
            onClicked: fileDlg.open()
        }
    }

    GridLayout {
        Layout.fillWidth: true
        columns: Math.max(2, Math.floor(width / 150))
        columnSpacing: 10
        rowSpacing: 10
        Repeater {
            model: root.assets
            delegate: Rectangle {
                required property var modelData
                Layout.fillWidth: true
                Layout.preferredHeight: 120
                radius: 12
                color: Theme.surface
                border.color: ma.containsMouse ? Theme.ink : Theme.border
                border.width: ma.containsMouse ? 2 : 1
                scale: ma.containsMouse ? 1.03 : 1
                Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack } }
                MediaThumb { anchors.fill: parent; anchors.margins: 4; anchors.bottomMargin: 26; path: modelData.filename; type: modelData.type }
                Text {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.bottom: parent.bottom
                    anchors.margins: 8
                    text: modelData.originalName
                    elide: Text.ElideMiddle
                    color: Theme.text2
                    font.family: Theme.bodyFont
                    font.pixelSize: 11
                }
                MouseArea {
                    id: ma
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: { root.picked(modelData.filename); root.close() }
                }
            }
        }
    }

    T { visible: root.assets.length === 0; tone: "muted"; text: "Nenhum arquivo no catálogo ainda."; Layout.fillWidth: true; horizontalAlignment: Text.AlignHCenter; Layout.topMargin: 20; Layout.bottomMargin: 20 }

    FileDialog {
        id: fileDlg
        title: root.kind === "video" ? "Importar vídeo" : "Importar imagem"
        nameFilters: root.kind === "video" ? ["Vídeos (*.mp4 *.webm *.mov *.mkv)"] : ["Imagens (*.png *.jpg *.jpeg *.webp)"]
        onAccepted: Media.importFile(SystemInfo.localPath(selectedFile), root.kind, function (r) {
            if (!r.ok) { Toasts.error(r.error); return }
            Toasts.success(r.duplicate ? "Arquivo já estava no catálogo." : "\"" + r.asset.originalName + "\" importado.")
            root.picked(r.asset.filename)
            root.close()
        })
    }
}
