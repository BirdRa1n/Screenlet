import QtQuick
import QtQuick.Controls.Basic
import Screenlet

// Button — variants: primary (offer yellow), dark, secondary, ghost, danger.
// Springs up on hover, presses down on click (proposal B motion).
Button {
    id: control
    property string variant: "secondary"
    property string iconName: ""
    property bool small: false
    property bool busy: false

    implicitHeight: small ? 34 : 42
    leftPadding: small ? 12 : 16
    rightPadding: small ? 12 : 16
    font.family: Theme.bodyFont
    font.pixelSize: small ? 13 : 14
    font.weight: variant === "primary" ? Font.Bold : Font.DemiBold
    hoverEnabled: true
    focusPolicy: Qt.StrongFocus

    readonly property color bgColor: {
        switch (variant) {
        case "primary": return Theme.accent
        case "dark": return Theme.inverse
        case "danger": return Theme.redSoft
        case "ghost": return hovered ? Theme.hover : "transparent"
        default: return hovered ? Theme.hover : Theme.surface
        }
    }
    readonly property color fgColor: {
        switch (variant) {
        case "primary": return Theme.accentInk
        case "dark": return Theme.inverseInk
        case "danger": return Theme.redInk
        default: return Theme.ink
        }
    }

    scale: down ? 0.97 : (hovered && enabled && (variant === "primary" || variant === "dark") ? 1.03 : 1)
    Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack; easing.overshoot: 2 } }
    opacity: enabled ? 1 : 0.5

    contentItem: Item {
      implicitWidth: btnRow.implicitWidth
      implicitHeight: btnRow.implicitHeight
      Row {
        id: btnRow
        spacing: 8
        anchors.centerIn: parent
        Icon {
            visible: control.iconName !== "" && !control.busy
            name: control.iconName
            size: control.small ? 15 : 17
            stroke: control.variant === "primary" ? 2.6 : 2.2
            color: control.fgColor
            anchors.verticalCenter: parent.verticalCenter
        }
        BusyDot {
            visible: control.busy
            color: control.fgColor
            anchors.verticalCenter: parent.verticalCenter
        }
        Text {
            text: control.text
            visible: text !== ""
            font: control.font
            color: control.fgColor
            anchors.verticalCenter: parent.verticalCenter
        }
      }
    }

    background: Rectangle {
        radius: control.small ? 10 : Theme.radiusM
        color: control.bgColor
        border.width: control.variant === "secondary" ? 1 : 0
        border.color: Theme.borderStrong
        Behavior on color { ColorAnimation { duration: Motion.fast } }

        Rectangle {
            anchors.fill: parent
            anchors.margins: -3
            radius: parent.radius + 3
            color: "transparent"
            border.width: 2
            border.color: Theme.blue
            visible: control.visualFocus
        }
    }
}
