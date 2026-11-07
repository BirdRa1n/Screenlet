import QtQuick
import Screenlet

// Bottom-right toast stack; each toast springs in and auto-dismisses.
Item {
    id: root
    width: 380
    height: col.height

    Column {
        id: col
        width: parent.width
        spacing: 8
        anchors.bottom: parent.bottom

        Repeater {
            model: Toasts.items
            delegate: Rectangle {
                id: toast
                required property int uid
                required property string kind
                required property string text
                width: col.width
                height: Math.max(48, label.implicitHeight + 26)
                radius: 14
                color: Theme.inverse
                opacity: 0
                transform: Translate { id: tr; x: 40 }

                Row {
                    anchors.fill: parent
                    anchors.margins: 13
                    spacing: 10
                    Rectangle {
                        width: 22
                        height: 22
                        radius: 11
                        anchors.verticalCenter: parent.verticalCenter
                        color: toast.kind === "success" ? Theme.green : toast.kind === "error" ? Theme.red : Theme.accent
                        Icon {
                            anchors.centerIn: parent
                            size: 13
                            stroke: 3
                            color: toast.kind === "info" ? Theme.accentInk : "#FFFFFF"
                            name: toast.kind === "success" ? "check" : toast.kind === "error" ? "x" : "info"
                        }
                    }
                    Text {
                        id: label
                        width: parent.width - 32
                        anchors.verticalCenter: parent.verticalCenter
                        text: toast.text
                        color: Theme.inverseInk
                        wrapMode: Text.WordWrap
                        font.family: Theme.bodyFont
                        font.pixelSize: 14
                    }
                }
                MouseArea { anchors.fill: parent; onClicked: Toasts.dismiss(toast.uid) }

                Component.onCompleted: enter.start()
                ParallelAnimation {
                    id: enter
                    NumberAnimation { target: toast; property: "opacity"; to: 1; duration: Motion.base }
                    NumberAnimation { target: tr; property: "x"; to: 0; duration: Motion.pop; easing.type: Easing.OutBack; easing.overshoot: 1.5 }
                }
                Timer {
                    interval: toast.kind === "error" ? 6500 : 4200
                    running: true
                    onTriggered: Toasts.dismiss(toast.uid)
                }
            }
        }
    }
}
