import QtQuick
import QtQuick.Effects

// CSS `drop-shadow(0 <dy>px <blur>px rgba(0,0,0,<a>))` for any child item.
// Wrap the item: Shadowed { dy: 20; blur: 30; opacity: .4; Image { ... } }
Item {
    id: root
    default property alias content: holder.data
    property real dy: 0
    property real blur: 0
    property real shadowOpacity: 0.4
    property color shadowColor: "#000000"
    property bool enabled_: true

    implicitWidth: holder.childrenRect.width
    implicitHeight: holder.childrenRect.height

    Item {
        id: holder
        anchors.fill: parent
        layer.enabled: root.enabled_ && root.blur > 0
        layer.effect: MultiEffect {
            shadowEnabled: true
            shadowColor: root.shadowColor
            shadowOpacity: root.shadowOpacity
            shadowVerticalOffset: root.dy
            shadowHorizontalOffset: 0
            blurMax: Math.max(1, Math.min(64, Math.round(root.blur)))
            shadowBlur: 1.0
        }
    }
}
