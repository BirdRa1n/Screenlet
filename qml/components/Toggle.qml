import QtQuick
import QtQuick.Controls.Basic
import Screenlet

// Switch with a springy knob.
Switch {
    id: control
    font.family: Theme.bodyFont
    font.pixelSize: 14
    spacing: 12

    indicator: Rectangle {
        implicitWidth: 44
        implicitHeight: 26
        x: control.leftPadding
        y: (control.height - height) / 2
        radius: height / 2
        color: control.checked ? Theme.inverse : Theme.borderStrong
        Behavior on color { ColorAnimation { duration: Motion.base } }

        Rectangle {
            width: 20
            height: 20
            radius: 10
            y: 3
            x: control.checked ? parent.width - width - 3 : 3
            color: control.checked ? Theme.accent : "#FFFFFF"
            Behavior on x { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 2 } }
        }
    }

    contentItem: Text {
        leftPadding: control.indicator.width + control.spacing
        text: control.text
        font: control.font
        color: Theme.ink
        wrapMode: Text.WordWrap
        verticalAlignment: Text.AlignVCenter
    }
}
