import QtQuick
import QtQuick.Layouts
import Screenlet

// Page title block with eyebrow + right-side actions (wraps on narrow).
Flow {
    id: root
    property string eyebrow: ""
    property string title: ""
    property string subtitle: ""
    default property alias actions: actionRow.data
    spacing: 16
    width: parent ? parent.width : 800

    ColumnLayout {
        width: Math.max(280, root.width - actionRow.implicitWidth - 24)
        spacing: 4
        T { tone: "muted"; text: root.eyebrow; visible: text !== ""; font.weight: Font.Medium; size: 13 }
        H { level: 1; text: root.title; Layout.fillWidth: true }
        T { tone: "muted"; text: root.subtitle; visible: text !== ""; Layout.fillWidth: true }
    }
    Row {
        id: actionRow
        spacing: 10
        height: implicitHeight
    }
}
