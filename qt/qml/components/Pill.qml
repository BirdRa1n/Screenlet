import QtQuick
import Screenlet

// Status pill — kind: live | scheduled | draft | warn | danger | neutral.
Rectangle {
    id: root
    property string kind: "neutral"
    property string text: ""
    property bool dot: kind === "live"

    implicitHeight: 24
    implicitWidth: row.implicitWidth + 20
    radius: height / 2
    color: kind === "live" ? Theme.greenSoft : kind === "scheduled" ? Theme.blueSoft : kind === "warn" ? Theme.amberSoft
          : kind === "danger" ? Theme.redSoft : Theme.hover

    readonly property color fg: kind === "live" ? Theme.greenInk : kind === "scheduled" ? Theme.blue : kind === "warn" ? Theme.amberInk
                               : kind === "danger" ? Theme.redInk : Theme.text2

    Row {
        id: row
        anchors.centerIn: parent
        spacing: 6
        LiveDot {
            visible: root.dot
            anchors.verticalCenter: parent.verticalCenter
            size: 6
        }
        Text {
            text: root.text
            color: root.fg
            font.family: Theme.bodyFont
            font.pixelSize: 12
            font.weight: Font.Bold
            anchors.verticalCenter: parent.verticalCenter
        }
    }
}
