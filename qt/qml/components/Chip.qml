import QtQuick
import Screenlet

Rectangle {
    property string text: ""
    property bool selected: false
    implicitHeight: 22
    implicitWidth: t.implicitWidth + 16
    radius: 6
    color: selected ? Theme.inverse : Theme.hover
    Text {
        id: t
        anchors.centerIn: parent
        text: parent.text
        color: parent.selected ? Theme.inverseInk : Theme.ink
        font.family: Theme.bodyFont
        font.pixelSize: 12
        font.weight: Font.DemiBold
    }
}
