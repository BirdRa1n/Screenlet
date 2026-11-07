import QtQuick
import QtQuick.Controls.Basic
import Screenlet

TextField {
    id: control
    property string iconName: ""
    property bool emphasis: false

    implicitHeight: 40
    width: parent ? parent.width : implicitWidth
    leftPadding: iconName !== "" ? 36 : 12
    rightPadding: 12
    font.family: Theme.bodyFont
    font.pixelSize: 14
    font.weight: emphasis ? Font.Bold : Font.Medium
    color: Theme.ink
    placeholderTextColor: Theme.faint
    selectionColor: Theme.accent
    selectedTextColor: Theme.accentInk
    selectByMouse: true

    background: Rectangle {
        radius: 11
        color: Theme.surface
        border.width: control.activeFocus || control.emphasis ? 2 : 1
        border.color: control.activeFocus || control.emphasis ? Theme.blue : Theme.borderStrong
        Behavior on border.color { ColorAnimation { duration: Motion.fast } }
        Icon {
            visible: control.iconName !== ""
            name: control.iconName
            size: 16
            color: Theme.muted
            anchors.left: parent.left
            anchors.leftMargin: 12
            anchors.verticalCenter: parent.verticalCenter
        }
    }
}
