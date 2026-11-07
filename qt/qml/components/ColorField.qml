import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Dialogs
import Screenlet

// Swatch row + "+" (system color dialog) + hex field.
Column {
    id: root
    property string value: "#ffffff"
    property var swatches: ["#FFD500", "#FF8A00", "#FFFFFF", "#111318", "#E10600", "#0B5E1F", "#1F3FD1", "#B07CC6"]
    signal picked(string value)
    spacing: 8
    width: parent ? parent.width : 280

    Flow {
        width: parent.width
        spacing: 8
        Repeater {
            model: root.swatches
            delegate: Rectangle {
                required property string modelData
                width: 30
                height: 30
                radius: 15
                color: modelData
                border.width: root.value.toLowerCase() === modelData.toLowerCase() ? 3 : 1
                border.color: root.value.toLowerCase() === modelData.toLowerCase() ? Theme.ink : Theme.borderStrong
                scale: ma.containsMouse ? 1.18 : 1
                Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack; easing.overshoot: 2.5 } }
                Accessible.role: Accessible.Button
                Accessible.name: modelData
                MouseArea { id: ma; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.picked(parent.modelData) }
            }
        }
        Rectangle {
            width: 30
            height: 30
            radius: 15
            color: Theme.surface
            border.color: Theme.faint
            border.width: 1
            Text { anchors.centerIn: parent; text: "+"; color: Theme.text2; font.pixelSize: 16; font.bold: true }
            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: dlg.open() }
            Accessible.role: Accessible.Button
            Accessible.name: "Escolher cor"
        }
    }

    Row {
        spacing: 8
        width: parent.width
        Rectangle {
            width: 40
            height: 40
            radius: 11
            color: root.value
            border.color: Theme.borderStrong
        }
        TextBox {
            width: parent.width - 48
            text: root.value
            onEditingFinished: if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text)) root.picked(text)
        }
    }

    ColorDialog {
        id: dlg
        selectedColor: root.value
        onAccepted: root.picked(String(selectedColor).slice(0, 7))
    }
}
