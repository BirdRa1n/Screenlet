import QtQuick
import Screenlet

// Pill segmented control with a sliding selection thumb.
Rectangle {
    id: root
    property var options: []       // [{ value, label }]
    property var value
    property bool dark: false      // selected thumb uses ink instead of white
    property bool stretch: false
    signal picked(var value)

    implicitHeight: 40
    implicitWidth: row.implicitWidth + 8
    radius: 12
    color: Theme.sunken

    readonly property int currentIndex: {
        for (let i = 0; i < options.length; ++i)
            if (options[i].value === value) return i
        return -1
    }

    Rectangle {
        id: thumb
        visible: root.currentIndex >= 0
        property int built: 0
        readonly property Item target: (built, root.currentIndex >= 0 && root.width > 0) ? rep.itemAt(root.currentIndex) : null
        x: target ? target.x + 4 : 4
        width: target ? target.width : 0
        y: 4
        height: root.height - 8
        radius: 9
        color: root.dark ? Theme.inverse : Theme.surface
        border.width: root.dark ? 0 : 1
        border.color: Theme.border
        Behavior on x { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 1.4 } }
        Behavior on width { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 1.4 } }
    }

    Row {
        id: row
        x: 4
        y: 4
        height: root.height - 8
        Repeater {
            id: rep
            model: root.options
            onItemAdded: thumb.built++
            delegate: Item {
                required property int index
                required property var modelData
                width: root.stretch ? (root.width - 8) / root.options.length : label.implicitWidth + 24
                height: row.height
                Text {
                    id: label
                    anchors.centerIn: parent
                    text: modelData.label
                    font.family: Theme.bodyFont
                    font.pixelSize: 13
                    font.weight: index === root.currentIndex ? Font.DemiBold : Font.Medium
                    color: index === root.currentIndex && root.dark ? Theme.inverseInk : (index === root.currentIndex ? Theme.ink : Theme.text2)
                }
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.picked(modelData.value)
                }
                Accessible.role: Accessible.RadioButton
                Accessible.name: modelData.label
                Accessible.checked: index === root.currentIndex
            }
        }
    }
}
