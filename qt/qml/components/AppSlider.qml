import QtQuick
import QtQuick.Controls.Basic
import Screenlet

// Slider with the yellow/ink knob from the editor mockup.
Slider {
    id: control
    implicitHeight: 28
    width: parent ? parent.width : 200

    background: Rectangle {
        x: control.leftPadding
        y: control.topPadding + control.availableHeight / 2 - height / 2
        width: control.availableWidth
        height: 6
        radius: 3
        color: Theme.border
        Rectangle {
            width: control.visualPosition * parent.width
            height: parent.height
            radius: 3
            color: Theme.inverse
        }
    }

    handle: Rectangle {
        x: control.leftPadding + control.visualPosition * (control.availableWidth - width)
        y: control.topPadding + control.availableHeight / 2 - height / 2
        width: 18
        height: 18
        radius: 9
        color: Theme.accent
        border.width: 3
        border.color: Theme.inverse
        scale: control.pressed ? 1.25 : (control.hovered ? 1.12 : 1)
        Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack; easing.overshoot: 2.5 } }
    }
}
