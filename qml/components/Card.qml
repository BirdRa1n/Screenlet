import QtQuick
import QtQuick.Effects
import Screenlet

// Surface card. `popDelay >= 0` plays the staggered "pop" entrance
// (translate + scale + fade, spring); `lift` springs up on hover;
// `roundClip` masks the content to the rounded corners (for edge-to-edge
// thumbnails — a plain `clip` only cuts to the square bounds).
Rectangle {
    id: root
    property int popDelay: -1
    property bool lift: false
    property bool roundClip: false
    property bool hovered: hover.hovered
    property real padding: 16
    property alias liftY: tr.y

    radius: Theme.radiusXL
    color: Theme.surface
    border.width: 1
    border.color: Theme.border
    transformOrigin: Item.Center
    opacity: popDelay >= 0 ? 0 : 1

    transform: Translate { id: tr }

    HoverHandler { id: hover }

    // The mask costs an offscreen layer + an effect pass per card: on old GPUs
    // a plain (square) clip is used instead.
    readonly property bool maskCorners: roundClip && !Motion.reduced
    clip: roundClip && Motion.reduced
    layer.enabled: maskCorners
    layer.smooth: true
    layer.effect: MultiEffect {
        maskEnabled: true
        maskSource: mask
        maskThresholdMin: 0.5
        maskSpreadAtMin: 1.0
    }

    // Mask shape (rendered into a texture only, never shown).
    Item {
        id: mask
        anchors.fill: parent
        visible: false
        layer.enabled: root.maskCorners
        Rectangle {
            anchors.fill: parent
            radius: root.radius
            antialiasing: true
            color: "black"
        }
    }

    // Hairline drawn above masked content so the edge stays crisp.
    Rectangle {
        visible: root.roundClip
        anchors.fill: parent
        radius: root.radius
        color: "transparent"
        border.width: root.border.width
        border.color: root.border.color
        z: 100
    }

    states: State {
        when: root.lift && hover.hovered
        PropertyChanges { tr.y: -5 }
    }
    transitions: Transition {
        NumberAnimation { property: "y"; target: tr; duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 2 }
    }

    SequentialAnimation {
        id: enter
        PauseAnimation { duration: Math.max(0, root.popDelay) }
        ParallelAnimation {
            NumberAnimation { target: root; property: "opacity"; from: 0; to: 1; duration: Motion.base }
            NumberAnimation { target: tr; property: "y"; from: 18; to: 0; duration: Motion.pop; easing.type: Easing.OutBack; easing.overshoot: 1.6 }
            NumberAnimation { target: root; property: "scale"; from: 0.96; to: 1; duration: Motion.pop; easing.type: Easing.OutBack; easing.overshoot: 1.6 }
        }
    }
    Component.onCompleted: if (popDelay >= 0) enter.start()
}
