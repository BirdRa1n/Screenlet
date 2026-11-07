import QtQuick
import Screenlet
import "SceneMath.js" as SM

// Logo / call-to-action scene (docs/05 · Cena de logo).
Item {
    id: root
    property var scene
    property real f: 0
    property int fps: 30
    property real sc: 1
    property string logoImage: ""
    property bool exportMode: false
    readonly property bool ready: !logo.visible || logo.status !== Image.Loading

    readonly property real logoSpring: SM.spring(f, fps, 12, 0.6)
    readonly property real logoScale: SM.interpolate(logoSpring, [0, 1], [0.3, 1], { left: false, right: false })
    readonly property real logoOpacity: SM.interpolate(f, [0, 12], [0, 1], { left: false })
    readonly property real tagOpacity: SM.interpolate(f, [18, 30], [0, 1], { left: false })
    readonly property real tagShift: SM.interpolate(f, [18, 30], [30, 0], { left: false })

    Rectangle {
        anchors.fill: parent
        color: root.scene ? root.scene.bg : "#000"
    }

    Column {
        anchors.centerIn: parent
        width: parent.width
        spacing: 40 * root.sc

        Shadowed {
            anchors.horizontalCenter: parent.horizontalCenter
            visible: root.logoImage !== ""
            width: 720 * root.sc
            height: logo.implicitWidth > 0 ? Math.min(420 * root.sc, width * logo.implicitHeight / logo.implicitWidth) : 420 * root.sc
            dy: 20 * root.sc
            blur: 30 * root.sc
            shadowOpacity: 0.4
            scale: root.logoScale
            opacity: root.logoOpacity

            Image {
                id: logo
                anchors.fill: parent
                source: Storage.url(root.logoImage)
                fillMode: Image.PreserveAspectFit
                asynchronous: !root.exportMode
                smooth: true
                mipmap: true
            }
        }

        Text {
            width: parent.width - 160 * root.sc
            anchors.horizontalCenter: parent.horizontalCenter
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            text: root.scene ? root.scene.tagline : ""
            color: root.scene ? root.scene.taglineColor : "#fff"
            font.family: Theme.adFont
            font.pixelSize: Math.max(1, 46 * root.sc)
            font.weight: Font.Bold
            font.letterSpacing: 1
            opacity: root.tagOpacity
            transform: Translate { y: root.tagShift }
        }
    }
}
