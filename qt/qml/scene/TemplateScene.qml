import QtQuick
import Screenlet
import "SceneMath.js" as SM

// Renders a Template (its inner scenes play in sequence) with {{VAR}}
// values resolved. Layers use absolute px in composition space.
Item {
    id: root
    property var template
    property var values: ({})
    property real f: 0
    property int fps: 30
    property bool exportMode: false
    property bool playing: false
    readonly property bool ready: true

    readonly property var merged: SM.mergedValues(template, values)
    readonly property var tScenes: template && template.scenes ? template.scenes : []
    readonly property var info: SM.sceneAt(tScenes, Math.floor(f))
    readonly property var tScene: info.index >= 0 ? tScenes[info.index] : null
    readonly property real sceneFrame: f - info.start
    readonly property string logoSrc: merged["LOGO"] || ""

    readonly property var layers: {
        if (!tScene) return []
        const out = []
        for (const l of tScene.layers || [])
            out.push(SM.resolveLayerText(l, merged))
        out.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
        return out
    }

    clip: true

    CssFill {
        anchors.fill: parent
        paint: root.tScene ? root.tScene.backgroundColor : "#000"
    }

    Repeater {
        model: root.layers
        delegate: LayerItem {
            required property var modelData
            lyr: modelData
            sceneFrame: root.sceneFrame
            sceneDuration: root.tScene ? root.tScene.durationInFrames : 0
            logoSrc: root.logoSrc
            exportMode: root.exportMode
            playing: root.playing
            fps: root.fps
        }
    }
}
