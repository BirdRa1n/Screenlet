import QtQuick
import QtQuick.Shapes
import "SceneMath.js" as SM

// Paints a CSS background value (solid color, linear-/radial-gradient) with
// optional corner radius / circle and CSS border ("4px solid #fff").
Item {
    id: root
    property string paint: ""
    property real radius: 0
    property bool circle: false
    property string borderCss: ""

    readonly property var p: SM.parsePaint(paint)
    readonly property var b: SM.parseBorder(borderCss)
    readonly property real r: circle ? Math.min(width, height) / 2 : Math.min(radius, Math.min(width, height) / 2)

    Rectangle {
        anchors.fill: parent
        visible: root.p.kind === "solid"
        color: root.p.kind === "solid" ? root.p.color : "transparent"
        radius: root.r
        border.width: root.b.width
        border.color: root.b.color
    }

    Shape {
        anchors.fill: parent
        visible: root.p.kind !== "solid"
        preferredRendererType: Shape.CurveRenderer

        ShapePath {
            strokeWidth: root.b.width
            strokeColor: root.b.width > 0 ? root.b.color : "transparent"
            fillGradient: root.p.kind === "radial" ? radial : linear

            PathRectangle {
                x: 0
                y: 0
                width: root.width
                height: root.height
                radius: root.r
            }
        }
    }

    // CSS angle: 0deg = to top, 90deg = to right; line through the centre.
    readonly property real rad: (root.p.angle || 180) * Math.PI / 180
    readonly property real half: (Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad))) / 2

    LinearGradient {
        id: linear
        x1: root.width / 2 - Math.sin(root.rad) * root.half
        y1: root.height / 2 + Math.cos(root.rad) * root.half
        x2: root.width / 2 + Math.sin(root.rad) * root.half
        y2: root.height / 2 - Math.cos(root.rad) * root.half
        stops: stopList.instances
    }

    RadialGradient {
        id: radial
        centerX: root.width / 2
        centerY: root.height / 2
        focalX: centerX
        focalY: centerY
        centerRadius: Math.max(root.width, root.height) / 2
        stops: stopList.instances
    }

    Instantiator {
        id: stopList
        readonly property var instances: {
            const out = []
            for (let i = 0; i < count; ++i) out.push(objectAt(i))
            return out
        }
        model: root.p.stops || []
        delegate: GradientStop {
            required property var modelData
            position: modelData.pos
            color: modelData.color
        }
    }
}
