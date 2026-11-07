import QtQuick
import QtQuick.Layouts
import Screenlet

// Inline preview + "Escolher" that opens the MediaPicker.
Rectangle {
    id: root
    property string value: ""
    property string kind: "image"
    property string emptyLabel: kind === "video" ? "Escolher vídeo" : "Escolher imagem"
    signal picked(string path)

    width: parent ? parent.width : 280
    height: 104
    radius: 14
    color: Theme.surfaceAlt
    border.color: ma.containsMouse ? Theme.ink : Theme.borderStrong
    border.width: 1

    RowLayout {
        anchors.fill: parent
        anchors.margins: 10
        spacing: 12
        MediaThumb {
            Layout.preferredWidth: 120
            Layout.fillHeight: true
            path: root.value
            type: root.kind
        }
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 6
            T { text: root.value ? root.value.split("/").pop() : root.emptyLabel; bold: true; elide: Text.ElideMiddle; wrapMode: Text.NoWrap; Layout.fillWidth: true }
            Row {
                spacing: 8
                Btn { text: root.value ? "Trocar" : "Escolher"; small: true; iconName: "image"; onClicked: picker.choose() }
                Btn { visible: root.value !== ""; text: "Remover"; small: true; variant: "ghost"; onClicked: root.picked("") }
            }
        }
    }
    MouseArea { id: ma; anchors.fill: parent; hoverEnabled: true; acceptedButtons: Qt.NoButton }
    MediaPicker { id: picker; kind: root.kind; onPicked: (p) => root.picked(p) }
}
