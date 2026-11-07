import QtQuick

// Small spinning arc used inside buttons while work is in progress.
Item {
    id: root
    property color color: "#111318"
    implicitWidth: 14
    implicitHeight: 14

    Rectangle {
        anchors.fill: parent
        radius: width / 2
        color: "transparent"
        border.width: 2
        border.color: Qt.rgba(root.color.r, root.color.g, root.color.b, 0.25)
    }
    Rectangle {
        width: 4
        height: 4
        radius: 2
        color: root.color
        x: parent.width / 2 - 2
        y: 0
    }
    RotationAnimation on rotation {
        from: 0
        to: 360
        duration: 800
        loops: Animation.Infinite
        running: root.visible
    }
}
