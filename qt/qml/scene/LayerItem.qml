import QtQuick
import QtQuick.Effects
import Screenlet
import "SceneMath.js" as SM

// One template layer at a given scene frame (docs/05 · Desenho das camadas).
Item {
    id: root
    property var lyr: ({})
    property real sceneFrame: 0
    property int sceneDuration: 0
    property string logoSrc: ""
    property bool exportMode: false
    property bool playing: false
    property int fps: 30
    // Editor hooks (builder canvas shows hidden-window layers dimmed).
    property bool forceVisible: false

    readonly property bool inWindow: sceneFrame >= (lyr.startFrame || 0)
                                     && sceneFrame <= (lyr.endFrame === undefined || lyr.endFrame === null ? sceneDuration : lyr.endFrame)
    readonly property var anim: SM.resolveLayer(sceneFrame, lyr.animations, lyr.opacity === undefined ? 1 : lyr.opacity)

    x: lyr.x || 0
    y: lyr.y || 0
    width: lyr.width || 0
    height: lyr.height || 0
    visible: lyr.visible !== false && (inWindow || forceVisible)
    opacity: anim.opacity

    // CSS: translate(tx,ty) scale(s) rotate(r), then the base `rotate` —
    // QML applies the list in order to the item's own coordinates.
    transform: [
        Rotation { origin.x: root.width / 2; origin.y: root.height / 2; angle: root.anim.rot },
        Scale { origin.x: root.width / 2; origin.y: root.height / 2; xScale: root.anim.scale; yScale: root.anim.scale },
        Translate { x: root.anim.tx; y: root.anim.ty },
        Rotation { origin.x: root.width / 2; origin.y: root.height / 2; angle: root.lyr.rotation || 0 }
    ]

    layer.enabled: anim.glowBlur > 0
    layer.effect: MultiEffect {
        shadowEnabled: true
        shadowColor: "#ffffff"
        shadowOpacity: 0.7
        shadowHorizontalOffset: 0
        shadowVerticalOffset: 0
        blurMax: Math.max(1, Math.min(64, root.anim.glowBlur * 2))
        shadowBlur: 1.0
    }

    Loader {
        anchors.fill: parent
        sourceComponent: {
            switch (root.lyr.type) {
            case "shape": return shapeC
            case "text": return textC
            case "badge": return badgeC
            case "price": return priceC
            case "image": return imageC
            case "logo": return imageC
            case "video": return videoC
            default: return null
            }
        }
    }

    Component {
        id: shapeC
        CssFill {
            paint: root.lyr.fill || "transparent"
            circle: root.lyr.shape === "circle"
            radius: root.lyr.borderRadius || 0
            borderCss: root.lyr.border || ""
        }
    }

    Component {
        id: textC
        Text {
            text: SM.typewriter(root.lyr.text || "", root.sceneFrame, root.lyr.animations)
            color: root.lyr.color || "#fff"
            font.family: Theme.layerFont
            font.pixelSize: Math.max(1, root.lyr.fontSize || 48)
            font.weight: root.lyr.fontWeight || 700
            font.letterSpacing: root.lyr.letterSpacing || 0
            lineHeightMode: Text.ProportionalHeight
            lineHeight: root.lyr.lineHeight || 1.2
            wrapMode: Text.WordWrap
            verticalAlignment: Text.AlignVCenter
            horizontalAlignment: root.lyr.align === "left" ? Text.AlignLeft : root.lyr.align === "right" ? Text.AlignRight : Text.AlignHCenter
        }
    }

    Component {
        id: badgeC
        Rectangle {
            color: root.lyr.bg || "#e10600"
            radius: Math.min(root.lyr.borderRadius || 0, Math.min(width, height) / 2)
            Text {
                anchors.fill: parent
                anchors.leftMargin: 16
                anchors.rightMargin: 16
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                wrapMode: Text.WordWrap
                text: root.lyr.text || ""
                color: root.lyr.textColor || "#fff"
                font.family: Theme.layerFont
                font.pixelSize: Math.max(1, root.lyr.fontSize || 28)
                font.weight: Font.Bold
            }
        }
    }

    Component {
        id: priceC
        Item {
            readonly property real fs: root.lyr.fontSize || 96
            Column {
                anchors.centerIn: parent
                spacing: 4
                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    visible: root.lyr.priceMode === "offer" && !!root.lyr.oldPrice
                    text: "R$ " + (root.lyr.oldPrice || "")
                    color: root.lyr.oldPriceColor || "#fff"
                    opacity: 0.75
                    font.family: Theme.layerFont
                    font.pixelSize: Math.max(1, parent.parent.fs * 0.45)
                    font.strikeout: true
                }
                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    textFormat: Text.RichText
                    color: root.lyr.accentColor || "#FFD500"
                    font.family: Theme.layerFont
                    font.pixelSize: Math.max(1, parent.parent.fs)
                    font.weight: Font.Black
                    text: "R$&nbsp;" + (root.lyr.newPrice || "")
                          + (root.lyr.suffix ? "<span style=\"font-size:" + Math.round(parent.parent.fs * 0.4) + "px; color:" + (root.lyr.textColor || "#fff") + ";\">&nbsp;" + root.lyr.suffix + "</span>" : "")
                }
            }
        }
    }

    Component {
        id: imageC
        Item {
            clip: true
            Image {
                anchors.fill: parent
                source: Storage.url(root.lyr.type === "logo" ? root.logoSrc : (root.lyr.src || ""))
                fillMode: root.lyr.fit === "cover" ? Image.PreserveAspectCrop : Image.PreserveAspectFit
                asynchronous: !root.exportMode
                smooth: true
                mipmap: true
                mirror: !!root.lyr.flipX
                mirrorVertically: !!root.lyr.flipY
            }
        }
    }

    Component {
        id: videoC
        VideoScene {
            src: root.lyr.src || ""
            volume: root.lyr.volume === undefined ? 1 : root.lyr.volume
            f: root.sceneFrame + (root.lyr.startFrom || 0)
            fps: root.fps
            exportMode: root.exportMode
            playing: root.playing
        }
    }
}
