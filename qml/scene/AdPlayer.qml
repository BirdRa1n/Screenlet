import QtQuick
import Screenlet
import "SceneMath.js" as SM

// Live preview: an AdStage at composition size, scaled to fit, driven by a
// FrameAnimation (vsync-locked, no timers) while playing.
Item {
    id: root

    property var config: ({ scenes: [], fps: 30, width: 1920, height: 1080 })
    property bool playing: false
    property bool loop: true
    property real frame: 0
    property real radius: 0
    property color backdrop: "#000000"
    property int compWidth: config && config.width ? config.width : 1920
    property int compHeight: config && config.height ? config.height : 1080
    readonly property int fps: config && config.fps ? config.fps : 30
    readonly property int totalFrames: SM.totalFrames(config ? config.scenes : [])
    readonly property real fitScale: Math.min(width / compWidth, height / compHeight)
    readonly property alias stage: stage

    signal ended()

    function play() { if (totalFrames > 0) playing = true }
    function pause() { playing = false }
    function toggle() { playing ? pause() : play() }
    function seek(f) { frame = Math.max(0, Math.min(f, Math.max(0, totalFrames - 1))) }

    onTotalFramesChanged: if (frame >= totalFrames) frame = Math.max(0, totalFrames - 1)

    Rectangle {
        anchors.fill: parent
        color: root.backdrop
        radius: root.radius
        visible: root.backdrop.a > 0
    }

    Item {
        id: viewport
        width: root.compWidth * root.fitScale
        height: root.compHeight * root.fitScale
        anchors.centerIn: parent
        clip: true

        AdStage {
            id: stage
            width: root.compWidth
            height: root.compHeight
            scale: root.fitScale
            transformOrigin: Item.TopLeft
            config: root.config
            frameExact: root.frame
            playing: root.playing
        }
    }

    FrameAnimation {
        running: root.playing && root.visible && root.totalFrames > 0
        onTriggered: {
            let f = root.frame + frameTime * root.fps
            if (f >= root.totalFrames) {
                if (root.loop) f = f % root.totalFrames
                else {
                    f = root.totalFrames - 1
                    root.playing = false
                    root.ended()
                }
            }
            root.frame = f
        }
    }
}
