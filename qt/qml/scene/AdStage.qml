import QtQuick
import Screenlet
import "SceneMath.js" as SM

// One frame of an ad (AdConfig) at composition size. Used both by the live
// preview (AdPlayer) and the offscreen exporter (Renderer), so what you see
// is exactly what gets encoded.
Item {
    id: stage

    property var config: ({ scenes: [] })
    property real frameExact: 0
    property int frame: 0               // set by the exporter
    property bool exportMode: false
    property bool playing: false        // preview: videos play in sync

    onFrameChanged: if (Math.floor(frameExact) !== frame) frameExact = frame

    readonly property var scenes: config && config.scenes ? config.scenes : []
    readonly property int fps: config && config.fps ? config.fps : 30
    readonly property var info: SM.sceneAt(scenes, Math.floor(frameExact))
    readonly property var scene: info.index >= 0 ? scenes[info.index] : null
    readonly property real localFrame: frameExact - info.start
    readonly property real sc: Math.min(width / 1920, height / 1080)
    readonly property string logoImage: config && config.logoImage ? config.logoImage : ""
    readonly property bool ready: !content.item || content.item.ready !== false

    clip: true

    Rectangle {
        anchors.fill: parent
        color: "#000000"
    }

    Loader {
        id: content
        anchors.fill: parent
        sourceComponent: {
            if (!stage.scene) return null
            switch (stage.scene.type) {
            case "logo": return logoC
            case "template": return templateC
            case "video": return videoC
            default: return productC
            }
        }
    }

    Component {
        id: logoC
        LogoScene { scene: stage.scene; f: stage.localFrame; fps: stage.fps; sc: stage.sc; logoImage: stage.logoImage; exportMode: stage.exportMode }
    }
    Component {
        id: productC
        ProductScene { scene: stage.scene; f: stage.localFrame; fps: stage.fps; sc: stage.sc; logoImage: stage.logoImage; exportMode: stage.exportMode }
    }
    Component {
        id: templateC
        TemplateScene {
            template: Templates.find(stage.scene.templateId)
            values: stage.scene.values || ({})
            f: stage.localFrame
            fps: stage.fps
            exportMode: stage.exportMode
            playing: stage.playing
        }
    }
    Component {
        id: videoC
        VideoScene {
            src: stage.scene.src || ""
            volume: stage.scene.volume === undefined ? 1 : stage.scene.volume
            f: stage.localFrame
            fps: stage.fps
            exportMode: stage.exportMode
            playing: stage.playing
        }
    }
}
