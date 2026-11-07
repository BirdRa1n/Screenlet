import QtQuick
import Screenlet

// Green dot with a radar "ping" — signals something is on air.
Item {
    id: root
    property real size: 8
    property color color: Theme.green
    property bool active: true
    implicitWidth: size
    implicitHeight: size

    Rectangle {
        id: ring
        anchors.centerIn: parent
        width: root.size
        height: root.size
        radius: width / 2
        color: root.color
        visible: root.active && !Motion.reduced
        SequentialAnimation on scale {
            running: root.active && root.visible && !Motion.reduced
            loops: Animation.Infinite
            NumberAnimation { from: 1; to: 2.6; duration: 1600; easing.type: Easing.OutCubic }
        }
        SequentialAnimation on opacity {
            running: root.active && root.visible && !Motion.reduced
            loops: Animation.Infinite
            NumberAnimation { from: 0.7; to: 0; duration: 1600; easing.type: Easing.OutCubic }
        }
    }
    Rectangle {
        anchors.fill: parent
        radius: width / 2
        color: root.active ? root.color : Theme.borderStrong
    }
}
