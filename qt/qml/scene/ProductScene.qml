import QtQuick
import Screenlet
import "SceneMath.js" as SM

// Product offer scene (docs/05 · Cena de produto).
Item {
    id: root
    property var scene
    property real f: 0
    property int fps: 30
    property real sc: 1
    property string logoImage: ""
    property bool exportMode: false
    readonly property bool ready: (!img.visible || img.status !== Image.Loading) && (!overlay.visible || overlay.status !== Image.Loading)

    readonly property bool portrait: height > width
    readonly property bool vertical: height >= width
    readonly property bool offer: scene && scene.priceMode === "offer"

    readonly property real imageSpring: SM.spring(f, fps, 200, 0.6)
    readonly property real imageScale: SM.interpolate(imageSpring, [0, 1], [0.6, 1], { left: false, right: false })
    readonly property real imageOpacity: SM.interpolate(f, [0, 15], [0, 1], { left: false })
    readonly property real textSpring: SM.spring(f - 10, fps, 200, 0.5)
    readonly property real textShift: SM.interpolate(textSpring, [0, 1], [80 * sc, 0], { left: false, right: false })
    readonly property real textOpacity: SM.interpolate(f, [10, 25], [0, 1], { left: false })
    readonly property real priceSpring: SM.spring(f - 25, fps, 12, 0.5)
    readonly property real priceScale: SM.interpolate(priceSpring, [0, 1], [0, 1], { left: false, right: false })
    readonly property real pulse: 1 + Math.sin(f / 6) * 0.03

    function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }

    Rectangle {
        anchors.fill: parent
        color: root.scene ? root.scene.bg : "#1A1A1A"
    }

    // ── Image half ─────────────────────────────────────────────────────────
    Item {
        id: imgBox
        x: 0
        y: root.vertical ? root.height * 0.025 : 0
        width: root.vertical ? root.width : root.width / 2
        height: root.vertical ? root.height * 0.45 : root.height

        Shadowed {
            anchors.centerIn: parent
            width: imgBox.width * 0.9
            height: imgBox.height * (root.portrait ? 0.8 : 0.75)
            dy: 30 * root.sc
            blur: 40 * root.sc
            shadowOpacity: 0.45
            scale: root.imageScale
            opacity: root.imageOpacity
            visible: img.source != ""

            Image {
                id: img
                anchors.fill: parent
                source: root.scene && root.scene.image ? Storage.url(root.scene.image) : ""
                fillMode: Image.PreserveAspectFit
                asynchronous: !root.exportMode
                smooth: true
                mipmap: true
            }
        }
    }

    // ── Text half ──────────────────────────────────────────────────────────
    Item {
        id: textBox
        x: root.vertical ? 0 : root.width / 2
        y: root.vertical ? root.height * 0.475 : 0
        width: root.vertical ? root.width : root.width / 2
        height: root.vertical ? root.height * 0.5 : root.height
        readonly property real padL: root.vertical ? 60 * root.sc : 0
        readonly property real padR: root.vertical ? 60 * root.sc : 80 * root.sc
        readonly property real colW: width - padL - padR

        Column {
            id: col
            x: textBox.padL
            anchors.verticalCenter: parent.verticalCenter
            width: textBox.colW
            spacing: 24 * root.sc
            opacity: root.textOpacity
            transform: Translate {
                x: root.vertical ? 0 : root.textShift
                y: root.vertical ? root.textShift : 0
            }

            Shadowed {
                width: col.width
                height: nameText.implicitHeight
                dy: 4 * root.sc
                blur: 12 * root.sc
                shadowOpacity: 0.4
                Text {
                    id: nameText
                    width: col.width
                    horizontalAlignment: root.vertical ? Text.AlignHCenter : Text.AlignLeft
                    wrapMode: Text.WordWrap
                    text: root.scene ? String(root.scene.productName || "").toUpperCase() : ""
                    color: root.scene ? root.scene.productNameColor : "#fff"
                    font.family: Theme.adFont
                    font.pixelSize: Math.max(1, 56 * root.sc)
                    font.weight: Font.ExtraBold
                    font.letterSpacing: 1
                }
            }

            Item {
                id: priceBlock
                width: col.width
                height: priceCol.implicitHeight
                scale: root.priceScale
                transformOrigin: root.vertical ? Item.Center : Item.Left

                Column {
                    id: priceCol
                    width: parent.width
                    spacing: 4 * root.sc

                    Text {
                        visible: root.offer
                        width: parent.width
                        horizontalAlignment: root.vertical ? Text.AlignHCenter : Text.AlignLeft
                        text: root.scene ? "De R$ " + root.scene.oldPrice : ""
                        color: root.scene ? root.scene.oldPriceColor : "#fff"
                        opacity: 0.75
                        font.family: Theme.adFont
                        font.pixelSize: Math.max(1, 36 * root.sc)
                        font.strikeout: true
                    }

                    Shadowed {
                        width: parent.width
                        height: priceText.implicitHeight
                        dy: 6 * root.sc
                        blur: 18 * root.sc
                        shadowOpacity: 0.5
                        scale: root.pulse
                        transformOrigin: root.vertical ? Item.Center : Item.Left
                        Text {
                            id: priceText
                            width: parent.width
                            horizontalAlignment: root.vertical ? Text.AlignHCenter : Text.AlignLeft
                            textFormat: Text.RichText
                            color: root.scene ? root.scene.accentColor : "#FFD500"
                            font.family: Theme.adFont
                            font.pixelSize: Math.max(1, 130 * root.sc)
                            font.weight: Font.Black
                            lineHeight: 1.0
                            text: {
                                if (!root.scene) return ""
                                const por = root.offer ? "<span style=\"font-size:" + Math.round(38 * root.sc) + "px; font-weight:700;\">por&nbsp;&nbsp;</span>" : ""
                                const suffix = root.scene.priceSuffix ? "<span style=\"font-size:" + Math.round(44 * root.sc) + "px;\">" + root.esc(root.scene.priceSuffix) + "</span>" : ""
                                return por + "R$&nbsp;" + root.esc(root.scene.newPrice) + suffix
                            }
                        }
                    }
                }
            }

            Item {
                width: col.width
                height: badge.height
                visible: !!(root.scene && root.scene.badgeText)

                Shadowed {
                    id: badge
                    x: root.vertical ? (parent.width - width) / 2 : 0
                    width: badgeText.implicitWidth + 56 * root.sc
                    height: badgeText.implicitHeight + 20 * root.sc
                    dy: 8 * root.sc
                    blur: 20 * root.sc
                    shadowOpacity: 0.35
                    Rectangle {
                        anchors.fill: parent
                        radius: height / 2
                        color: root.scene ? root.scene.badgeColor : "#E10600"
                        Text {
                            id: badgeText
                            anchors.centerIn: parent
                            text: root.scene ? String(root.scene.badgeText || "").toUpperCase() : ""
                            color: root.scene ? root.scene.badgeTextColor : "#fff"
                            font.family: Theme.adFont
                            font.pixelSize: Math.max(1, 30 * root.sc)
                            font.weight: Font.ExtraBold
                        }
                    }
                }
            }
        }
    }

    // ── Logo overlay (fixed px, not scaled — Electron behavior) ───────────
    Shadowed {
        id: overlayBox
        visible: !!(root.scene && root.scene.showLogoOverlay) && root.logoImage !== ""
        readonly property string pos: (root.scene && root.scene.logoPosition) || "top-right"
        x: pos.indexOf("left") >= 0 ? 36 : root.width - 36 - width
        y: pos.indexOf("top") >= 0 ? 36 : root.height - 36 - height
        width: 180
        height: 110
        dy: 8
        blur: 16
        shadowOpacity: 0.45
        Image {
            id: overlay
            anchors.fill: parent
            source: overlayBox.visible ? Storage.url(root.logoImage) : ""
            fillMode: Image.PreserveAspectFit
            horizontalAlignment: overlayBox.pos.indexOf("left") >= 0 ? Image.AlignLeft : Image.AlignRight
            verticalAlignment: overlayBox.pos.indexOf("top") >= 0 ? Image.AlignTop : Image.AlignBottom
            asynchronous: !root.exportMode
            smooth: true
            mipmap: true
        }
    }
}
