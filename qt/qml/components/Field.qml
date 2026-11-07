import QtQuick
import QtQuick.Layouts
import Screenlet

// Label above a control, optional hint below.
ColumnLayout {
    id: root
    property string label: ""
    property string hint: ""
    default property alias content: holder.data
    spacing: 6

    Text {
        visible: root.label !== ""
        text: root.label
        color: Theme.ink
        font.family: Theme.bodyFont
        font.pixelSize: 13
        font.weight: Font.DemiBold
        Layout.fillWidth: true
        elide: Text.ElideRight
    }
    Item {
        id: holder
        Layout.fillWidth: true
        implicitHeight: childrenRect.height
        Layout.preferredHeight: childrenRect.height
    }
    Text {
        visible: root.hint !== ""
        text: root.hint
        color: Theme.muted
        font.family: Theme.bodyFont
        font.pixelSize: 12
        wrapMode: Text.WordWrap
        Layout.fillWidth: true
    }
}
