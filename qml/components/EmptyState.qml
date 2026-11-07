import QtQuick
import QtQuick.Layouts
import Screenlet

Card {
    id: root
    property string iconName: "folder"
    property string title: ""
    property string text: ""
    default property alias actions: actionRow.data
    implicitHeight: col.implicitHeight + 64

    ColumnLayout {
        id: col
        anchors.centerIn: parent
        width: Math.min(parent.width - 48, 420)
        spacing: 10

        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            width: 52
            height: 52
            radius: 16
            color: Theme.accentSoft
            Icon { anchors.centerIn: parent; name: root.iconName; size: 24; color: Theme.ink }
            SequentialAnimation on rotation {
                running: !Motion.reduced
                loops: 3
                PauseAnimation { duration: 2200 }
                NumberAnimation { to: -8; duration: 120 }
                NumberAnimation { to: 6; duration: 120 }
                NumberAnimation { to: 0; duration: 160; easing.type: Easing.OutBack }
            }
        }
        H { level: 4; text: root.title; Layout.alignment: Qt.AlignHCenter; horizontalAlignment: Text.AlignHCenter; Layout.fillWidth: true }
        T { tone: "muted"; text: root.text; visible: text !== ""; Layout.fillWidth: true; horizontalAlignment: Text.AlignHCenter }
        Row { id: actionRow; spacing: 8; Layout.alignment: Qt.AlignHCenter; Layout.topMargin: 6 }
    }
}
