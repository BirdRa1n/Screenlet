import QtQuick
import QtQuick.Controls.Basic
import Screenlet

// Scrollable page body with standard padding; children stack vertically.
ScrollView {
    id: root
    default property alias content: col.data
    property int maxWidth: 1480
    property int gap: 22
    clip: true
    contentWidth: availableWidth

    Column {
        id: col
        width: Math.min(root.availableWidth - 64, root.maxWidth)
        x: Math.max(32, (root.availableWidth - width) / 2)
        topPadding: 24
        bottomPadding: 40
        spacing: root.gap
    }
}
