import QtQuick
import QtQuick.Controls.Basic
import Screenlet

// Square icon-only button with an accessible name + tooltip.
Button {
    id: control
    property string iconName: ""
    property string label: ""
    property bool danger: false
    property bool bordered: true
    property int box: 38
    property color iconColor: danger ? Theme.redInk : Theme.text2

    implicitWidth: box
    implicitHeight: box
    padding: 0
    hoverEnabled: true
    Accessible.name: label
    ToolTip.visible: hovered && label !== ""
    ToolTip.text: label
    ToolTip.delay: 500

    contentItem: Item {
        Icon {
            anchors.centerIn: parent
            name: control.iconName
            size: Math.round(control.box * 0.47)
            color: control.iconColor
            rotation: control.hovered ? -8 : 0
            scale: control.down ? 0.88 : (control.hovered ? 1.12 : 1)
            Behavior on rotation { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 2.5 } }
            Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack; easing.overshoot: 2.5 } }
        }
    }

    background: Rectangle {
        radius: Theme.radiusS + 2
        color: control.hovered ? (control.danger ? Theme.redSoft : Theme.hover) : (control.bordered ? Theme.surface : "transparent")
        border.width: control.bordered ? 1 : 0
        border.color: Theme.border
        Behavior on color { ColorAnimation { duration: Motion.fast } }
    }
}
