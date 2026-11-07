import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Screenlet
import "../scene/SceneMath.js" as SM

// Template builder: scenes · canvas (drag/resize/snap/zoom) + timeline ·
// layer properties, animations and variables.
Item {
    id: page
    property var params: ({})
    property var tpl: {
        const t = params.id ? Templates.find(params.id) : null
        return t && t.id && !t.builtin ? Fmt.clone(t) : Templates.blank()
    }
    property string sceneId: tpl.scenes.length ? tpl.scenes[0].id : ""
    property string layerId: ""
    property real frame: 30
    property string centerTab: "canvas"
    property string rightTab: "layer"
    property real zoom: 1
    property bool dirty: false

    readonly property var scene: tpl.scenes.find(s => s.id === sceneId) || tpl.scenes[0] || null
    readonly property var layers: scene ? scene.layers.slice().sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)) : []
    readonly property var selLayer: scene ? (scene.layers.find(l => l.id === layerId) || null) : null

    // ── Mutations ─────────────────────────────────────────────────────────
    function setTpl(t) { tpl = t; dirty = true }
    function patchTpl(p) { setTpl(Object.assign({}, tpl, p)) }
    function patchScene(p) { patchTpl({ scenes: tpl.scenes.map(s => s.id === scene.id ? Object.assign({}, s, p) : s) }) }
    function patchLayer(id, p) { patchScene({ layers: scene.layers.map(l => l.id === id ? Object.assign({}, l, p) : l) }) }

    function addScene() {
        const s = { id: Fmt.uuid(), name: "Cena " + (tpl.scenes.length + 1), durationInFrames: 150, backgroundColor: "#111318", layers: [] }
        patchTpl({ scenes: tpl.scenes.concat([s]) })
        sceneId = s.id
        layerId = ""
    }
    function removeScene(id) {
        if (tpl.scenes.length <= 1) return
        patchTpl({ scenes: tpl.scenes.filter(s => s.id !== id) })
        sceneId = tpl.scenes[0].id
    }

    function addLayer(type) {
        const W = tpl.width, H = tpl.height
        const z = scene.layers.reduce((m, l) => Math.max(m, l.zIndex || 0), 0) + 1
        const base = { id: Fmt.uuid(), name: "Camada", x: W / 2 - 200, y: H / 2 - 50, width: 400, height: 100, opacity: 1, zIndex: z,
                       rotation: 0, animations: [{ type: "fadeIn", startFrame: 0, durationInFrames: 15, easing: "easeOut" }], visible: true }
        const by = {
            text: { type: "text", name: "Texto", text: "Texto aqui", fontSize: 64, fontWeight: 800, color: "#ffffff", align: "center", width: 800, height: 120, x: W / 2 - 400 },
            image: { type: "image", name: "Imagem", src: "", fit: "contain", width: 600, height: 600, x: W / 2 - 300, y: H / 2 - 300 },
            logo: { type: "logo", name: "Logo", fit: "contain", width: 360, height: 200, x: 60, y: 60 },
            shape: { type: "shape", name: "Forma", shape: "rect", fill: "#FFD21F", width: 300, height: 120, borderRadius: 16 },
            badge: { type: "badge", name: "Selo", text: "Oferta", bg: "#e10600", textColor: "#ffffff", borderRadius: 99, fontSize: 32, width: 300, height: 70 },
            price: { type: "price", name: "Preço", priceMode: "offer", oldPrice: "{{OLD_PRICE}}", newPrice: "{{NEW_PRICE}}", suffix: "{{PRICE_SUFFIX}}",
                     accentColor: "#FFD500", textColor: "#ffffff", oldPriceColor: "#ffffff", fontSize: 120, width: 700, height: 240, x: W / 2 - 350, y: H / 2 - 120 },
            video: { type: "video", name: "Vídeo", src: "", volume: 0, loop: true, startFrom: 0, width: 960, height: 540, x: W / 2 - 480, y: H / 2 - 270 }
        }
        const l = Object.assign(base, by[type])
        patchScene({ layers: scene.layers.concat([l]) })
        layerId = l.id
        rightTab = "layer"
    }

    function removeLayer(id) {
        patchScene({ layers: scene.layers.filter(l => l.id !== id) })
        if (layerId === id) layerId = ""
    }

    function shiftZ(id, dir) {
        const sorted = scene.layers.slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
        const i = sorted.findIndex(l => l.id === id), j = i + dir
        if (j < 0 || j >= sorted.length) return
        const zi = sorted[i].zIndex || 0, zj = sorted[j].zIndex || 0
        patchScene({ layers: scene.layers.map(l => l.id === sorted[i].id ? Object.assign({}, l, { zIndex: zj === zi ? zi + dir : zj })
                                                    : l.id === sorted[j].id ? Object.assign({}, l, { zIndex: zi }) : l) })
    }

    function save() {
        if (!tpl.name.trim()) { Toasts.error("Dê um nome ao template."); return }
        if (Templates.save(tpl)) { dirty = false; Toasts.success("Template salvo!") }
        else Toasts.error("Erro ao salvar template.")
    }

    Shortcut { sequences: [StandardKey.Delete, "Backspace"]; enabled: page.selLayer !== null && !page.activeFocusItem; onActivated: page.removeLayer(page.layerId) }
    Shortcut { sequences: [StandardKey.Save]; onActivated: page.save() }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // Top bar
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 66
            color: Theme.surface
            Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 20
                anchors.rightMargin: 20
                spacing: 12
                IconBtn { iconName: "chevronLeft"; label: "Voltar"; onClicked: Nav.go("templates") }
                TextInput {
                    Layout.fillWidth: true
                    text: page.tpl.name
                    color: Theme.ink
                    font.family: Theme.displayFont
                    font.pixelSize: 20
                    font.weight: Font.ExtraBold
                    selectByMouse: true
                    onTextEdited: page.patchTpl({ name: text })
                }
                T { visible: page.dirty; text: "Alterações não salvas"; tone: "muted"; size: 12 }
                Segmented {
                    options: [{ value: "canvas", label: "Canvas" }, { value: "preview", label: "Prévia" }]
                    value: page.centerTab
                    onPicked: (v) => page.centerTab = v
                }
                Btn { text: "Duplicar"; iconName: "copy"; visible: !!page.params.id; onClicked: { const id = Templates.duplicate(page.tpl.id); Toasts.success("Template duplicado."); Nav.go("templateBuilder", { id: id }) } }
                Btn { text: "Salvar"; variant: "primary"; iconName: "check"; onClicked: page.save() }
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.margins: 16
            spacing: 16

            // Scenes + layers
            Card {
                popDelay: 30
                Layout.preferredWidth: 250
                Layout.fillHeight: true
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 8
                    RowLayout {
                        H { level: 4; text: "Cenas"; Layout.fillWidth: true }
                        IconBtn { iconName: "plus"; label: "Adicionar cena"; box: 30; onClicked: page.addScene() }
                    }
                    Repeater {
                        model: page.tpl.scenes
                        delegate: Rectangle {
                            required property var modelData
                            readonly property bool on: page.scene && modelData.id === page.scene.id
                            Layout.fillWidth: true
                            Layout.preferredHeight: 40
                            radius: 11
                            color: on ? Theme.accentSoft : (sma.containsMouse ? Theme.hover : "transparent")
                            border.color: on ? Theme.ink : "transparent"
                            border.width: on ? 2 : 0
                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: 10
                                anchors.rightMargin: 4
                                Rectangle { width: 14; height: 14; radius: 4; color: modelData.backgroundColor.indexOf("gradient") >= 0 ? "#888" : modelData.backgroundColor; border.color: Theme.border }
                                T { text: modelData.name; bold: parent.parent.on; size: 13; Layout.fillWidth: true; elide: Text.ElideRight; wrapMode: Text.NoWrap }
                                T { text: Fmt.seconds(modelData.durationInFrames, page.tpl.fps); tone: "muted"; size: 11 }
                                IconBtn { visible: page.tpl.scenes.length > 1 && sma.containsMouse; iconName: "x"; label: "Remover cena"; bordered: false; box: 26; onClicked: page.removeScene(modelData.id) }
                            }
                            MouseArea { id: sma; anchors.fill: parent; hoverEnabled: true; acceptedButtons: Qt.LeftButton; propagateComposedEvents: true; onClicked: (m) => { page.sceneId = modelData.id; page.layerId = ""; m.accepted = false } }
                        }
                    }
                    Rectangle { Layout.fillWidth: true; height: 1; color: Theme.border; Layout.topMargin: 6; Layout.bottomMargin: 6 }
                    T { tone: "eyebrow"; text: "Camadas" }
                    Flow {
                        Layout.fillWidth: true
                        spacing: 6
                        Repeater {
                            model: [{ t: "text", i: "type", l: "Texto" }, { t: "image", i: "image", l: "Imagem" }, { t: "shape", i: "square", l: "Forma" },
                                    { t: "badge", i: "tag", l: "Selo" }, { t: "price", i: "dollar", l: "Preço" }, { t: "logo", i: "store", l: "Logo" }, { t: "video", i: "video", l: "Vídeo" }]
                            delegate: IconBtn { required property var modelData; iconName: modelData.i; label: "Adicionar " + modelData.l; box: 32; onClicked: page.addLayer(modelData.t) }
                        }
                    }
                    ListView {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        clip: true
                        spacing: 4
                        model: page.layers
                        delegate: Rectangle {
                            required property var modelData
                            readonly property bool on: modelData.id === page.layerId
                            width: ListView.view.width
                            height: 36
                            radius: 10
                            color: on ? Theme.inverse : (lma.containsMouse ? Theme.hover : "transparent")
                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: 8
                                anchors.rightMargin: 4
                                spacing: 6
                                Icon {
                                    name: ({ text: "type", image: "image", shape: "square", badge: "tag", price: "dollar", logo: "store", video: "video" })[modelData.type] || "layers"
                                    size: 15
                                    color: parent.parent.on ? Theme.accent : Theme.text2
                                }
                                Text {
                                    Layout.fillWidth: true
                                    text: modelData.name
                                    elide: Text.ElideRight
                                    color: parent.parent.on ? Theme.inverseInk : Theme.ink
                                    opacity: modelData.visible === false ? 0.45 : 1
                                    font.family: Theme.bodyFont; font.pixelSize: 13
                                }
                                IconBtn { iconName: "eye"; label: modelData.visible === false ? "Mostrar" : "Ocultar"; bordered: false; box: 26; iconColor: parent.parent.on ? Theme.inverseInk : Theme.muted; opacity: modelData.visible === false ? 0.4 : 1; onClicked: page.patchLayer(modelData.id, { visible: modelData.visible === false }) }
                            }
                            MouseArea { id: lma; anchors.fill: parent; anchors.rightMargin: 32; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: { page.layerId = modelData.id; page.rightTab = "layer" } }
                        }
                    }
                }
            }

            // Canvas / preview + timeline
            ColumnLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 14

                Rectangle {
                    id: canvasArea
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    radius: Theme.radiusXL
                    color: Theme.stage
                    clip: true

                    readonly property real fit: Math.min((width - 60) / page.tpl.width, (height - 60) / page.tpl.height)
                    readonly property real s: fit * page.zoom

                    // Preview tab (draws the in-memory template, not the saved one)
                    Item {
                        visible: page.centerTab === "preview"
                        anchors.fill: parent
                        anchors.margins: 22
                        clip: true
                        readonly property real ps: Math.min(width / page.tpl.width, height / page.tpl.height)
                        Item {
                            width: page.tpl.width
                            height: page.tpl.height
                            scale: parent.ps
                            transformOrigin: Item.TopLeft
                            x: (parent.width - width * parent.ps) / 2
                            y: (parent.height - height * parent.ps) / 2
                            TemplateScene {
                                id: previewScene
                                anchors.fill: parent
                                template: page.tpl
                                values: ({})
                                f: previewClock.f
                                playing: page.centerTab === "preview"
                            }
                        }
                        QtObject { id: previewClock; property real f: 0 }
                        FrameAnimation {
                            running: page.centerTab === "preview"
                            onTriggered: { const t = SM.templateFrames(page.tpl); previewClock.f = t > 0 ? (previewClock.f + frameTime * page.tpl.fps) % t : 0 }
                        }
                    }

                    // Canvas tab
                    Item {
                        id: canvas
                        visible: page.centerTab === "canvas"
                        width: page.tpl.width
                        height: page.tpl.height
                        scale: canvasArea.s
                        transformOrigin: Item.TopLeft
                        x: (canvasArea.width - width * canvasArea.s) / 2
                        y: (canvasArea.height - height * canvasArea.s) / 2

                        CssFill { anchors.fill: parent; paint: page.scene ? page.scene.backgroundColor : "#000" }
                        MouseArea { anchors.fill: parent; onClicked: page.layerId = "" }

                        Repeater {
                            model: page.scene ? page.scene.layers.slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map(l => SM.resolveLayerText(l, SM.mergedValues(page.tpl, {}))) : []
                            delegate: LayerItem {
                                required property var modelData
                                lyr: modelData
                                sceneFrame: page.frame
                                sceneDuration: page.scene.durationInFrames
                                forceVisible: true
                                opacity: inWindow ? anim.opacity : 0.25
                                MouseArea {
                                    anchors.fill: parent
                                    cursorShape: Qt.SizeAllCursor
                                    property point start
                                    property point orig
                                    onPressed: (m) => { page.layerId = modelData.id; page.rightTab = "layer"; start = mapToItem(canvas, m.x, m.y); orig = Qt.point(modelData.x, modelData.y) }
                                    onPositionChanged: (m) => {
                                        const p = mapToItem(canvas, m.x, m.y)
                                        let nx = Math.round(orig.x + p.x - start.x), ny = Math.round(orig.y + p.y - start.y)
                                        const cx = (page.tpl.width - modelData.width) / 2, cy = (page.tpl.height - modelData.height) / 2
                                        guides.v = Math.abs(nx - cx) < 8; guides.h = Math.abs(ny - cy) < 8
                                        if (guides.v) nx = Math.round(cx)
                                        if (guides.h) ny = Math.round(cy)
                                        page.patchLayer(modelData.id, { x: nx, y: ny })
                                    }
                                    onReleased: { guides.v = false; guides.h = false }
                                }
                            }
                        }

                        // Snap guides
                        Item {
                            id: guides
                            property bool v: false
                            property bool h: false
                            anchors.fill: parent
                            Rectangle { visible: guides.v; x: parent.width / 2 - width / 2; width: 2 / canvasArea.s; height: parent.height; color: "#FF3EA5" }
                            Rectangle { visible: guides.h; y: parent.height / 2 - height / 2; height: 2 / canvasArea.s; width: parent.width; color: "#FF3EA5" }
                        }

                        // Selection + 8 resize handles
                        Item {
                            visible: !!page.selLayer
                            x: page.selLayer ? page.selLayer.x : 0
                            y: page.selLayer ? page.selLayer.y : 0
                            width: page.selLayer ? page.selLayer.width : 0
                            height: page.selLayer ? page.selLayer.height : 0
                            rotation: page.selLayer ? page.selLayer.rotation || 0 : 0
                            Rectangle { anchors.fill: parent; color: "transparent"; border.color: Theme.blue; border.width: 2 / canvasArea.s }
                            Repeater {
                                model: ["tl", "tc", "tr", "ml", "mr", "bl", "bc", "br"]
                                delegate: Rectangle {
                                    required property string modelData
                                    readonly property real hs: 12 / canvasArea.s
                                    width: hs; height: hs; radius: hs / 2
                                    color: "#FFFFFF"
                                    border.color: Theme.blue
                                    border.width: 2 / canvasArea.s
                                    x: (modelData[1] === "l" ? 0 : modelData[1] === "c" ? parent.width / 2 : parent.width) - hs / 2
                                    y: (modelData[0] === "t" ? 0 : modelData[0] === "m" ? parent.height / 2 : parent.height) - hs / 2
                                    MouseArea {
                                        anchors.fill: parent
                                        anchors.margins: -6 / canvasArea.s
                                        cursorShape: modelData === "tc" || modelData === "bc" ? Qt.SizeVerCursor : modelData === "ml" || modelData === "mr" ? Qt.SizeHorCursor
                                                   : modelData === "tl" || modelData === "br" ? Qt.SizeFDiagCursor : Qt.SizeBDiagCursor
                                        property point start
                                        property var orig
                                        onPressed: (m) => { start = mapToItem(canvas, m.x, m.y); orig = Object.assign({}, page.selLayer) }
                                        onPositionChanged: (m) => {
                                            const p = mapToItem(canvas, m.x, m.y)
                                            const dx = p.x - start.x, dy = p.y - start.y
                                            let x = orig.x, y = orig.y, w = orig.width, h = orig.height
                                            if (modelData.indexOf("r") >= 1) w = Math.max(20, orig.width + dx)
                                            if (modelData[1] === "l") { w = Math.max(20, orig.width - dx); x = orig.x + orig.width - w }
                                            if (modelData[0] === "b") h = Math.max(20, orig.height + dy)
                                            if (modelData[0] === "t") { h = Math.max(20, orig.height - dy); y = orig.y + orig.height - h }
                                            page.patchLayer(orig.id, { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) })
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Zoom controls
                    Rectangle {
                        visible: page.centerTab === "canvas"
                        anchors.right: parent.right
                        anchors.bottom: parent.bottom
                        anchors.margins: 12
                        width: zr.implicitWidth + 12
                        height: 40
                        radius: 12
                        color: Theme.surface
                        border.color: Theme.border
                        Row {
                            id: zr
                            anchors.centerIn: parent
                            spacing: 4
                            IconBtn { iconName: "chevronDown"; label: "Diminuir zoom"; bordered: false; box: 30; onClicked: page.zoom = Math.max(0.25, page.zoom - 0.1) }
                            T { text: Math.round(page.zoom * 100) + "%"; size: 12; bold: true; width: 44; horizontalAlignment: Text.AlignHCenter; anchors.verticalCenter: parent.verticalCenter }
                            IconBtn { iconName: "chevronUp"; label: "Aumentar zoom"; bordered: false; box: 30; onClicked: page.zoom = Math.min(4, page.zoom + 0.1) }
                        }
                    }
                }

                // Timeline
                Card {
                    Layout.fillWidth: true
                    Layout.preferredHeight: Math.min(220, 70 + page.layers.length * 30)
                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 12
                        spacing: 6
                        RowLayout {
                            T { text: "Linha do tempo · quadro " + Math.round(page.frame) + " de " + (page.scene ? page.scene.durationInFrames : 0); bold: true; size: 13; Layout.fillWidth: true }
                        }
                        Item {
                            id: ruler
                            Layout.fillWidth: true
                            Layout.preferredHeight: 18
                            readonly property real ppf: page.scene && page.scene.durationInFrames ? (width - 120) / page.scene.durationInFrames : 1
                            Rectangle { x: 120; width: parent.width - 120; height: parent.height; radius: 6; color: Theme.sunken }
                            Rectangle { x: 120 + page.frame * ruler.ppf - 1; width: 3; height: tlFlick.height + 24; color: Theme.red; z: 5 }
                            MouseArea {
                                x: 120
                                width: parent.width - 120
                                height: parent.height
                                cursorShape: Qt.PointingHandCursor
                                onPressed: (m) => page.frame = Math.max(0, Math.min(page.scene.durationInFrames, m.x / ruler.ppf))
                                onPositionChanged: (m) => { if (pressed) page.frame = Math.max(0, Math.min(page.scene.durationInFrames, m.x / ruler.ppf)) }
                            }
                        }
                        Flickable {
                            id: tlFlick
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            contentHeight: tlCol.height
                            clip: true
                            Column {
                                id: tlCol
                                width: parent.width
                                spacing: 4
                                Repeater {
                                    model: page.layers
                                    delegate: Item {
                                        required property var modelData
                                        width: tlCol.width
                                        height: 26
                                        readonly property real st: modelData.startFrame || 0
                                        readonly property real en: modelData.endFrame === undefined || modelData.endFrame === null ? page.scene.durationInFrames : modelData.endFrame
                                        T { width: 112; text: modelData.name; size: 12; elide: Text.ElideRight; wrapMode: Text.NoWrap; anchors.verticalCenter: parent.verticalCenter }
                                        Rectangle {
                                            id: clip
                                            x: 120 + parent.st * ruler.ppf
                                            width: Math.max(8, (parent.en - parent.st) * ruler.ppf)
                                            height: parent.height
                                            radius: 7
                                            color: modelData.id === page.layerId ? Theme.inverse : Theme.blueSoft
                                            border.color: Theme.blue
                                            border.width: modelData.id === page.layerId ? 0 : 1
                                            MouseArea {
                                                anchors.fill: parent
                                                anchors.leftMargin: 6
                                                anchors.rightMargin: 6
                                                cursorShape: Qt.SizeAllCursor
                                                property real sx
                                                property real os
                                                property real oe
                                                onPressed: (m) => { page.layerId = modelData.id; sx = mapToItem(ruler, m.x, 0).x; os = parent.parent.st; oe = parent.parent.en }
                                                onPositionChanged: (m) => {
                                                    const d = Math.round((mapToItem(ruler, m.x, 0).x - sx) / ruler.ppf)
                                                    const len = oe - os
                                                    const ns = Math.max(0, Math.min(page.scene.durationInFrames - len, os + d))
                                                    page.patchLayer(modelData.id, { startFrame: ns, endFrame: ns + len })
                                                }
                                            }
                                            Repeater {
                                                model: ["l", "r"]
                                                delegate: MouseArea {
                                                    required property string modelData
                                                    width: 8
                                                    height: parent.height
                                                    x: modelData === "l" ? 0 : parent.width - 8
                                                    cursorShape: Qt.SizeHorCursor
                                                    property real sx
                                                    property real os
                                                    property real oe
                                                    onPressed: (m) => { sx = mapToItem(ruler, m.x, 0).x; os = clip.parent.st; oe = clip.parent.en }
                                                    onPositionChanged: (m) => {
                                                        const d = Math.round((mapToItem(ruler, m.x, 0).x - sx) / ruler.ppf)
                                                        const lid = clip.parent.modelData.id
                                                        if (modelData === "l") page.patchLayer(lid, { startFrame: Math.max(0, Math.min(oe - 1, os + d)) })
                                                        else page.patchLayer(lid, { endFrame: Math.max(os + 1, Math.min(page.scene.durationInFrames, oe + d)) })
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Properties
            Card {
                popDelay: 90
                Layout.preferredWidth: 330
                Layout.fillHeight: true
                clip: true
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 10
                    Segmented {
                        Layout.fillWidth: true
                        stretch: true
                        options: [{ value: "layer", label: "Camada" }, { value: "scene", label: "Cena" }, { value: "vars", label: "Variáveis" }]
                        value: page.rightTab
                        onPicked: (v) => page.rightTab = v
                    }
                    ScrollView {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        contentWidth: availableWidth
                        clip: true
                        Loader {
                            width: parent.width
                            sourceComponent: page.rightTab === "scene" ? sceneProps : page.rightTab === "vars" ? varsProps : layerProps
                        }
                    }
                }
            }
        }
    }

    // ── Property panels ───────────────────────────────────────────────────
    component Num: TextBox {
        property string key
        validator: DoubleValidator {}
        text: page.selLayer && page.selLayer[key] !== undefined ? String(page.selLayer[key]) : ""
        onEditingFinished: if (page.selLayer && text !== "") page.patchLayer(page.selLayer.id, ({ [key]: Number(text.replace(",", ".")) }))
    }

    Component {
        id: sceneProps
        ColumnLayout {
            spacing: 14
            visible: !!page.scene
            Field { Layout.fillWidth: true; label: "Nome da cena"; TextBox { text: page.scene ? page.scene.name : ""; onTextEdited: page.patchScene({ name: text }) } }
            Field {
                Layout.fillWidth: true
                label: "Duração · " + Fmt.seconds(page.scene ? page.scene.durationInFrames : 0, page.tpl.fps)
                AppSlider { from: 1; to: 30; stepSize: 0.5; value: page.scene ? page.scene.durationInFrames / page.tpl.fps : 5; onMoved: page.patchScene({ durationInFrames: Math.round(value * page.tpl.fps) }) }
            }
            Field {
                Layout.fillWidth: true
                label: "Fundo"
                hint: "Aceita cor (#111318) ou gradiente CSS, ex.: linear-gradient(135deg, #1F3FD1 0%, #6e56f8 100%)."
                ColumnLayout {
                    width: parent.width
                    ColorField { value: page.scene && page.scene.backgroundColor.indexOf("gradient") < 0 ? page.scene.backgroundColor : "#111318"; onPicked: (c) => page.patchScene({ backgroundColor: c }) }
                    TextBox { text: page.scene ? page.scene.backgroundColor : ""; onEditingFinished: page.patchScene({ backgroundColor: text }) }
                }
            }
            Field { Layout.fillWidth: true; label: "Descrição do template"; TextBox { text: page.tpl.description || ""; onTextEdited: page.patchTpl({ description: text }) } }
            Field { Layout.fillWidth: true; label: "Categoria / tag"; TextBox { text: (page.tpl.tags || []).join(", "); onEditingFinished: page.patchTpl({ tags: text.split(",").map(s => s.trim()).filter(Boolean), category: text.split(",")[0].trim() }) } }
            Field {
                Layout.fillWidth: true
                label: "Tamanho do template"
                Select {
                    options: [{ value: "1920x1080", text: "1920 × 1080 (TV)" }, { value: "1080x1080", text: "1080 × 1080 (quadrado)" }, { value: "1080x1920", text: "1080 × 1920 (vertical)" }]
                    value: page.tpl.width + "x" + page.tpl.height
                    onPicked: (v) => { const [w, h] = v.split("x").map(Number); page.patchTpl({ width: w, height: h }) }
                }
            }
        }
    }

    Component {
        id: varsProps
        ColumnLayout {
            spacing: 10
            T { tone: "muted"; size: 12; Layout.fillWidth: true; text: "Variáveis são os campos que quem usa o template preenche. Use {{CHAVE}} em textos, preços e imagens." }
            Repeater {
                model: page.tpl.variables || []
                delegate: Rectangle {
                    required property var modelData
                    required property int index
                    Layout.fillWidth: true
                    Layout.preferredHeight: vcol.implicitHeight + 20
                    radius: 14
                    color: Theme.surfaceAlt
                    border.color: Theme.border
                    function setVar(p) { page.patchTpl({ variables: page.tpl.variables.map((v, i) => i === index ? Object.assign({}, v, p) : v) }) }
                    ColumnLayout {
                        id: vcol
                        anchors.fill: parent
                        anchors.margins: 10
                        spacing: 6
                        RowLayout {
                            TextBox { Layout.fillWidth: true; text: modelData.key; font.family: "Menlo"; onEditingFinished: parent.parent.parent.setVar({ key: text.toUpperCase().replace(/[^A-Z0-9_]/g, "_") }) }
                            IconBtn { iconName: "trash"; danger: true; label: "Remover variável"; box: 34; onClicked: page.patchTpl({ variables: page.tpl.variables.filter((v, i) => i !== index) }) }
                        }
                        TextBox { text: modelData.label; placeholderText: "Rótulo"; onTextEdited: parent.parent.setVar({ label: text }) }
                        RowLayout {
                            Select { Layout.preferredWidth: 130; options: [{ value: "text", text: "Texto" }, { value: "number", text: "Número" }, { value: "image", text: "Imagem" }, { value: "color", text: "Cor" }]; value: modelData.type; onPicked: (v) => parent.parent.parent.setVar({ type: v }) }
                            Toggle { text: "Obrigatória"; checked: !!modelData.required; onToggled: parent.parent.parent.setVar({ required: checked }) }
                        }
                        TextBox { text: modelData.defaultValue || ""; placeholderText: "Valor padrão"; onTextEdited: parent.parent.setVar({ defaultValue: text }) }
                    }
                }
            }
            Btn {
                text: "Adicionar variável"
                iconName: "plus"
                onClicked: page.patchTpl({ variables: (page.tpl.variables || []).concat([{ key: "CAMPO_" + ((page.tpl.variables || []).length + 1), label: "Novo campo", type: "text", defaultValue: "" }]) })
            }
        }
    }

    Component {
        id: layerProps
        ColumnLayout {
            spacing: 12
            ColumnLayout {
                visible: !page.selLayer
                Layout.fillWidth: true
                Layout.topMargin: 30
                Icon { name: "layers"; size: 26; color: Theme.faint; Layout.alignment: Qt.AlignHCenter }
                T { text: "Selecione uma camada no canvas"; tone: "muted"; Layout.alignment: Qt.AlignHCenter }
            }
            ColumnLayout {
                visible: !!page.selLayer
                Layout.fillWidth: true
                spacing: 12
                Field { Layout.fillWidth: true; label: "Nome"; TextBox { text: page.selLayer ? page.selLayer.name : ""; onTextEdited: page.patchLayer(page.selLayer.id, { name: text }) } }
                GridLayout {
                    Layout.fillWidth: true
                    columns: 2
                    columnSpacing: 8
                    rowSpacing: 8
                    Field { Layout.fillWidth: true; label: "X"; Num { key: "x" } }
                    Field { Layout.fillWidth: true; label: "Y"; Num { key: "y" } }
                    Field { Layout.fillWidth: true; label: "Largura"; Num { key: "width" } }
                    Field { Layout.fillWidth: true; label: "Altura"; Num { key: "height" } }
                    Field { Layout.fillWidth: true; label: "Rotação (°)"; Num { key: "rotation" } }
                    Field { Layout.fillWidth: true; label: "Opacidade"; Num { key: "opacity" } }
                }
                RowLayout {
                    Btn { text: "Trazer p/ frente"; small: true; onClicked: page.shiftZ(page.selLayer.id, 1) }
                    Btn { text: "Enviar p/ trás"; small: true; onClicked: page.shiftZ(page.selLayer.id, -1) }
                }

                // Type-specific
                Loader {
                    Layout.fillWidth: true
                    sourceComponent: !page.selLayer ? null : ({ text: textP, badge: badgeP, shape: shapeP, price: priceP, image: imageP, logo: imageP, video: videoP })[page.selLayer.type] || null
                }

                // Animations
                Rectangle { Layout.fillWidth: true; height: 1; color: Theme.border }
                T { tone: "eyebrow"; text: "Animações" }
                Flow {
                    Layout.fillWidth: true
                    spacing: 6
                    Repeater {
                        model: [["fadeIn", "Fade In"], ["slideLeft", "Slide ←"], ["slideRight", "Slide →"], ["slideUp", "Slide ↑"], ["slideDown", "Slide ↓"],
                                ["zoomIn", "Zoom In"], ["scale", "Scale"], ["pulse", "Pulso"], ["bounce", "Quique"], ["shake", "Tremer"], ["glow", "Brilho"],
                                ["typewriter", "Digitação"], ["rotate", "Girar"], ["fadeOut", "Fade Out"], ["slideOut", "Slide Out"], ["zoomOut", "Zoom Out"]]
                        delegate: Rectangle {
                            required property var modelData
                            readonly property bool on: page.selLayer && (page.selLayer.animations || []).some(a => a.type === modelData[0])
                            height: 30
                            width: al.implicitWidth + 20
                            radius: 15
                            color: on ? Theme.inverse : Theme.surface
                            border.color: Theme.borderStrong
                            border.width: on ? 0 : 1
                            scale: ama.pressed ? 0.92 : 1
                            Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack } }
                            Text { id: al; anchors.centerIn: parent; text: modelData[1]; color: parent.on ? Theme.inverseInk : Theme.ink; font.family: Theme.bodyFont; font.pixelSize: 12; font.weight: Font.DemiBold }
                            MouseArea {
                                id: ama
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: {
                                    const list = (page.selLayer.animations || []).slice()
                                    const idx = list.findIndex(a => a.type === modelData[0])
                                    const out = modelData[0] === "fadeOut" || modelData[0] === "slideOut" || modelData[0] === "zoomOut"
                                    const loop = ["pulse", "glow", "shake", "bounce"].indexOf(modelData[0]) >= 0
                                    if (idx >= 0) list.splice(idx, 1)
                                    else list.push({ type: modelData[0], startFrame: out ? Math.max(0, page.scene.durationInFrames - 20) : (loop ? 20 : 0),
                                                     durationInFrames: loop ? 60 : (modelData[0] === "typewriter" ? 40 : 20), easing: "easeOut" })
                                    page.patchLayer(page.selLayer.id, { animations: list })
                                }
                            }
                        }
                    }
                }
                Repeater {
                    model: page.selLayer ? page.selLayer.animations || [] : []
                    delegate: RowLayout {
                        required property var modelData
                        required property int index
                        Layout.fillWidth: true
                        spacing: 6
                        function setA(p) { page.patchLayer(page.selLayer.id, { animations: page.selLayer.animations.map((a, i) => i === index ? Object.assign({}, a, p) : a) }) }
                        T { text: modelData.type; size: 12; bold: true; Layout.preferredWidth: 78; elide: Text.ElideRight; wrapMode: Text.NoWrap }
                        TextBox { Layout.preferredWidth: 56; text: String(modelData.startFrame); onEditingFinished: parent.setA({ startFrame: Number(text) })
                            validator: IntValidator { bottom: 0 } }
                        TextBox { Layout.preferredWidth: 56; text: String(modelData.durationInFrames); onEditingFinished: parent.setA({ durationInFrames: Number(text) })
                            validator: IntValidator { bottom: 1 } }
                        Select { Layout.fillWidth: true; options: [{ value: "linear", text: "Linear" }, { value: "easeIn", text: "Ease in" }, { value: "easeOut", text: "Ease out" }, { value: "easeInOut", text: "Ease in-out" }]; value: modelData.easing || "linear"; onPicked: (v) => parent.setA({ easing: v }) }
                    }
                }
                T { tone: "muted"; size: 11; text: "Colunas: início (quadro), duração (quadros), curva."; visible: page.selLayer && (page.selLayer.animations || []).length > 0 }

                Btn { text: "Remover camada"; variant: "danger"; iconName: "trash"; small: true; Layout.topMargin: 6; onClicked: page.removeLayer(page.selLayer.id) }
            }
        }
    }

    Component {
        id: textP
        ColumnLayout {
            spacing: 10
            Field { Layout.fillWidth: true; label: "Conteúdo"; hint: "Use {{VAR}} para variáveis."; TextBox { text: page.selLayer.text; onTextEdited: page.patchLayer(page.selLayer.id, { text: text }) } }
            RowLayout {
                Field { Layout.fillWidth: true; label: "Tamanho"; Num { key: "fontSize" } }
                Field { Layout.fillWidth: true; label: "Peso"; Select { options: [400, 500, 600, 700, 800, 900].map(w => ({ value: w, text: String(w) })); value: page.selLayer.fontWeight; onPicked: (v) => page.patchLayer(page.selLayer.id, { fontWeight: v }) } }
            }
            Field { Layout.fillWidth: true; label: "Alinhamento"; Segmented { width: parent.width; stretch: true; options: [{ value: "left", label: "Esquerda" }, { value: "center", label: "Centro" }, { value: "right", label: "Direita" }]; value: page.selLayer.align; onPicked: (v) => page.patchLayer(page.selLayer.id, { align: v }) } }
            Field { Layout.fillWidth: true; label: "Cor"; ColorField { value: page.selLayer.color || "#ffffff"; onPicked: (c) => page.patchLayer(page.selLayer.id, { color: c }) } }
        }
    }
    Component {
        id: badgeP
        ColumnLayout {
            spacing: 10
            Field { Layout.fillWidth: true; label: "Texto"; TextBox { text: page.selLayer.text; onTextEdited: page.patchLayer(page.selLayer.id, { text: text }) } }
            RowLayout {
                Field { Layout.fillWidth: true; label: "Tamanho da fonte"; Num { key: "fontSize" } }
                Field { Layout.fillWidth: true; label: "Arredondamento"; Num { key: "borderRadius" } }
            }
            Field { Layout.fillWidth: true; label: "Fundo"; ColorField { value: page.selLayer.bg || "#e10600"; onPicked: (c) => page.patchLayer(page.selLayer.id, { bg: c }) } }
            Field { Layout.fillWidth: true; label: "Cor do texto"; ColorField { value: page.selLayer.textColor || "#ffffff"; onPicked: (c) => page.patchLayer(page.selLayer.id, { textColor: c }) } }
        }
    }
    Component {
        id: shapeP
        ColumnLayout {
            spacing: 10
            Field { Layout.fillWidth: true; label: "Tipo"; Segmented { width: parent.width; stretch: true; options: [{ value: "rect", label: "Retângulo" }, { value: "circle", label: "Círculo" }]; value: page.selLayer.shape; onPicked: (v) => page.patchLayer(page.selLayer.id, { shape: v }) } }
            Field { Layout.fillWidth: true; label: "Arredondamento"; visible: page.selLayer.shape === "rect"; Num { key: "borderRadius" } }
            Field { Layout.fillWidth: true; label: "Preenchimento"; hint: "Cor ou gradiente CSS."; ColumnLayout { width: parent.width; ColorField { value: (page.selLayer.fill || "").indexOf("gradient") < 0 ? page.selLayer.fill : "#888888"; onPicked: (c) => page.patchLayer(page.selLayer.id, { fill: c }) } TextBox { text: page.selLayer.fill; onEditingFinished: page.patchLayer(page.selLayer.id, { fill: text }) } } }
            Field { Layout.fillWidth: true; label: "Borda (CSS)"; TextBox { placeholderText: "4px solid #ffffff"; text: page.selLayer.border || ""; onEditingFinished: page.patchLayer(page.selLayer.id, { border: text }) } }
        }
    }
    Component {
        id: priceP
        ColumnLayout {
            spacing: 10
            Field { Layout.fillWidth: true; label: "Modo"; Segmented { width: parent.width; stretch: true; options: [{ value: "offer", label: "Oferta" }, { value: "single", label: "Único" }]; value: page.selLayer.priceMode; onPicked: (v) => page.patchLayer(page.selLayer.id, { priceMode: v }) } }
            Field { Layout.fillWidth: true; label: "Preço anterior"; TextBox { text: page.selLayer.oldPrice; onTextEdited: page.patchLayer(page.selLayer.id, { oldPrice: text }) } }
            Field { Layout.fillWidth: true; label: "Preço"; TextBox { text: page.selLayer.newPrice; onTextEdited: page.patchLayer(page.selLayer.id, { newPrice: text }) } }
            Field { Layout.fillWidth: true; label: "Sufixo"; TextBox { text: page.selLayer.suffix; onTextEdited: page.patchLayer(page.selLayer.id, { suffix: text }) } }
            Field { Layout.fillWidth: true; label: "Tamanho"; Num { key: "fontSize" } }
            Field { Layout.fillWidth: true; label: "Cor do preço"; ColorField { value: page.selLayer.accentColor || "#FFD500"; onPicked: (c) => page.patchLayer(page.selLayer.id, { accentColor: c }) } }
            Field { Layout.fillWidth: true; label: "Cor do sufixo"; ColorField { value: page.selLayer.textColor || "#ffffff"; onPicked: (c) => page.patchLayer(page.selLayer.id, { textColor: c }) } }
        }
    }
    Component {
        id: imageP
        ColumnLayout {
            spacing: 10
            Field {
                visible: page.selLayer.type === "image"
                Layout.fillWidth: true
                label: "Imagem"
                ColumnLayout {
                    width: parent.width
                    ImageField { value: (page.selLayer.src || "").indexOf("{{") === 0 ? "" : page.selLayer.src || ""; onPicked: (p) => page.patchLayer(page.selLayer.id, { src: p }) }
                    TextBox { placeholderText: "Ou variável: {{PRODUCT_IMAGE}}"; text: page.selLayer.src || ""; onEditingFinished: page.patchLayer(page.selLayer.id, { src: text }) }
                }
            }
            T { visible: page.selLayer.type === "logo"; tone: "muted"; size: 12; Layout.fillWidth: true; text: "A logo vem da variável LOGO preenchida por quem usa o template." }
            Field { Layout.fillWidth: true; label: "Encaixe"; Segmented { width: parent.width; stretch: true; options: [{ value: "contain", label: "Conter" }, { value: "cover", label: "Cobrir" }]; value: page.selLayer.fit; onPicked: (v) => page.patchLayer(page.selLayer.id, { fit: v }) } }
            RowLayout {
                Btn { text: "Espelhar ↔"; small: true; variant: page.selLayer.flipX ? "dark" : "secondary"; onClicked: page.patchLayer(page.selLayer.id, { flipX: !page.selLayer.flipX }) }
                Btn { text: "Espelhar ↕"; small: true; variant: page.selLayer.flipY ? "dark" : "secondary"; onClicked: page.patchLayer(page.selLayer.id, { flipY: !page.selLayer.flipY }) }
            }
        }
    }
    Component {
        id: videoP
        ColumnLayout {
            spacing: 10
            Field { Layout.fillWidth: true; label: "Vídeo"; ImageField { kind: "video"; value: page.selLayer.src || ""; onPicked: (p) => page.patchLayer(page.selLayer.id, { src: p }) } }
            Field { Layout.fillWidth: true; label: "Começar em (quadro do vídeo)"; Num { key: "startFrom" } }
            Field { Layout.fillWidth: true; label: "Volume"; AppSlider { from: 0; to: 1; value: page.selLayer.volume || 0; onMoved: page.patchLayer(page.selLayer.id, { volume: value }) } }
        }
    }
}
