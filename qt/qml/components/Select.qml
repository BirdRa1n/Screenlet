import QtQuick
import QtQuick.Controls.Basic
import Screenlet

// ComboBox over [{ value, text }]; `value` is two-way friendly via `picked`.
ComboBox {
    id: control
    property var options: []
    property var value
    signal picked(var value)

    model: options
    textRole: "text"
    valueRole: "value"
    implicitHeight: 40
    width: parent ? parent.width : implicitWidth
    font.family: Theme.bodyFont
    font.pixelSize: 14

    currentIndex: {
        for (let i = 0; i < options.length; ++i)
            if (options[i].value === value) return i
        return -1
    }
    onActivated: (index) => picked(options[index].value)

    contentItem: Text {
        leftPadding: 12
        rightPadding: 32
        text: control.currentIndex >= 0 ? control.options[control.currentIndex].text : control.displayText
        font: control.font
        color: Theme.ink
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }

    indicator: Icon {
        name: "chevronDown"
        size: 16
        color: Theme.muted
        x: control.width - width - 12
        anchors.verticalCenter: parent.verticalCenter
        rotation: control.popup.visible ? 180 : 0
        Behavior on rotation { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack } }
    }

    background: Rectangle {
        radius: 11
        color: Theme.surface
        border.width: control.activeFocus ? 2 : 1
        border.color: control.activeFocus ? Theme.blue : Theme.borderStrong
    }

    delegate: ItemDelegate {
        required property int index
        required property var modelData
        width: control.width
        height: 38
        highlighted: control.highlightedIndex === index
        contentItem: Text {
            text: modelData.text
            color: Theme.ink
            font.family: Theme.bodyFont
            font.pixelSize: 14
            font.weight: control.currentIndex === index ? Font.DemiBold : Font.Normal
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
        }
        background: Rectangle {
            radius: 8
            color: highlighted ? Theme.hover : "transparent"
        }
    }

    popup: Popup {
        y: control.height + 4
        width: control.width
        padding: 6
        implicitHeight: Math.min(contentItem.implicitHeight + 12, 320)
        enter: Transition {
            NumberAnimation { property: "opacity"; from: 0; to: 1; duration: Motion.fast }
            NumberAnimation { property: "scale"; from: 0.96; to: 1; duration: Motion.base; easing.type: Easing.OutBack }
        }
        contentItem: ListView {
            clip: true
            implicitHeight: contentHeight
            model: control.popup.visible ? control.delegateModel : null
            currentIndex: control.highlightedIndex
            ScrollIndicator.vertical: ScrollIndicator {}
        }
        background: Rectangle {
            radius: 12
            color: Theme.surface
            border.color: Theme.border
        }
    }
}
