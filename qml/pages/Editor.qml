import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Screenlet

// Ad editor (proposal B): scenes · stage + timeline · inspector.
Item {
    id: page
    property var params: ({})
    property string format: "tv"
    property var drift: []          // [{ sceneId, name, changed, patch }]
    property string savedAt: ""

    readonly property var fmt: Fmt.formats[format]
    readonly property var previewConfig: Object.assign({}, Doc.config, { width: fmt.width, height: fmt.height })

    Component.onCompleted: {
        Library.refresh()
        computeDrift()
    }

    function computeDrift() {
        const out = []
        for (const s of Doc.scenes) {
            if (s.type !== "product" || !s.libraryProductId) continue
            const p = Library.find(s.libraryProductId)
            if (!p || !p.id) continue
            const d = Doc.driftFor(s, p)
            if (d) out.push({ sceneId: s.id, name: p.name || s.productName, changed: d.changed, patch: d.patch })
        }
        drift = out
    }

    function applyDrift(list) {
        for (const d of list) Doc.update(d.sceneId, d.patch)
        Toasts.success(list.length + " cena(s) atualizada(s) com a biblioteca.")
        computeDrift()
    }

    function save(thenRender) {
        if (!Doc.name.trim()) {
            saveDlg.thenRender = !!thenRender
            saveDlg.open()
            return
        }
        Doc.save()
        savedAt = new Date().toISOString()
        if (thenRender) renderDlg.start(Doc.config, Doc.name, Doc.projectId, page.format)
        else Toasts.success("\"" + Doc.name + "\" salvo.")
    }

    // Autosave existing projects shortly after each change.
    Timer {
        id: autosave
        interval: 1500
        onTriggered: if (Doc.projectId && Doc.dirty) { Doc.save(); page.savedAt = new Date().toISOString() }
    }
    Connections {
        target: Doc
        function onConfigChanged() { if (Doc.projectId) autosave.restart() }
        function onSeekRequestChanged() { if (Doc.seekRequest >= 0) { player.pause(); player.seek(Doc.seekRequest) } }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // ── Top bar ────────────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 66
            color: Theme.surface
            Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 20
                anchors.rightMargin: 20
                spacing: 14

                IconBtn { iconName: "chevronLeft"; label: "Voltar ao painel"; onClicked: Nav.go("painel") }
                ColumnLayout {
                    spacing: 0
                    Layout.fillWidth: true
                    TextInput {
                        id: nameInput
                        Layout.fillWidth: true
                        text: Doc.name
                        color: Theme.ink
                        font.family: Theme.displayFont
                        font.pixelSize: 20
                        font.weight: Font.ExtraBold
                        selectByMouse: true
                        clip: true
                        onEditingFinished: if (text.trim() && text !== Doc.name) { Doc.name = text.trim(); if (Doc.projectId) Projects.rename(Doc.projectId, Doc.name) }
                        Text {
                            visible: !parent.text && !parent.activeFocus
                            text: "Anúncio sem nome"
                            color: Theme.faint
                            font: parent.font
                        }
                    }
                    T {
                        size: 12
                        tone: "muted"
                        text: {
                            const used = Projects.items.find(p => p.id === Doc.projectId)
                            const st = used ? Insights.adStatus(used) : null
                            const saved = !Doc.projectId ? "Ainda não salvo" : (Doc.dirty ? "Alterações não salvas" : "Salvo " + Fmt.relative(page.savedAt || (used ? used.updatedAt : "")))
                            return saved + (st && st.channels.length ? " · usado em " + st.channels.length + " canal(is)" : "")
                        }
                    }
                }
                Segmented {
                    options: [{ value: "tv", label: "TV 16:9" }, { value: "instagram", label: "Instagram 1:1" }, { value: "stories", label: "Stories 9:16" }]
                    value: page.format
                    onPicked: (v) => page.format = v
                }
                Btn { text: "Salvar"; onClicked: page.save(false) }
                Btn {
                    // This ad's render in the queue (from this dialog or an earlier visit).
                    readonly property var job: Doc.projectId ? RenderQueue.jobs.find(j => j.projectId === Doc.projectId && (j.status === "queued" || j.status === "rendering")) || null : null
                    text: !job ? "Renderizar" : job.status === "rendering" ? Math.round(Renderer.progress * 100) + "%" : "Na fila"
                    variant: "primary"
                    iconName: "play"
                    busy: !!job
                    enabled: Doc.scenes.length > 0
                    // While its render runs, reopen the progress; otherwise
                    // save and start a new one (it queues if another is busy).
                    onClicked: renderDlg.tracking ? renderDlg.open() : page.save(true)
                }
            }
        }

        // ── Drift banner ───────────────────────────────────────────────────
        Rectangle {
            visible: page.drift.length > 0
            Layout.fillWidth: true
            Layout.preferredHeight: 48
            color: Theme.amberSoft
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 20
                anchors.rightMargin: 20
                Icon { name: "refresh"; color: Theme.amberInk }
                T {
                    Layout.fillWidth: true
                    color: Theme.amberInk
                    text: page.drift.length + (page.drift.length > 1 ? " produtos mudaram" : " produto mudou") + " na biblioteca desde que entrou neste anúncio: "
                          + page.drift.map(d => d.name).join(", ")
                    elide: Text.ElideRight
                    wrapMode: Text.NoWrap
                }
                Btn { text: "Atualizar " + (page.drift.length > 1 ? "cenas" : "cena"); small: true; variant: "dark"; onClicked: page.applyDrift(page.drift) }
            }
        }

        // ── Three panels ───────────────────────────────────────────────────
        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.margins: 16
            spacing: 16

            // Scenes
            Card {
                popDelay: 40
                Layout.preferredWidth: 270
                Layout.fillHeight: true
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 10

                    RowLayout {
                        H { level: 4; text: "Cenas"; Layout.fillWidth: true }
                        T { tone: "muted"; size: 12; text: Doc.scenes.length + " · " + Fmt.seconds(Doc.totalFrames, Doc.config.fps) }
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 10
                        Rectangle {
                            width: 44; height: 44; radius: 12
                            color: Theme.sunken
                            clip: true
                            Image { anchors.fill: parent; anchors.margins: 4; source: Storage.url(Doc.config.logoImage || ""); fillMode: Image.PreserveAspectFit; visible: !!Doc.config.logoImage; sourceSize.width: 100 }
                            Icon { anchors.centerIn: parent; visible: !Doc.config.logoImage; name: "store"; color: Theme.faint }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 2
                            T { text: "Logo do anúncio"; bold: true; size: 13 }
                            Text {
                                text: Doc.config.logoImage ? "Trocar" : "Escolher"
                                color: Theme.blue
                                font.family: Theme.bodyFont; font.pixelSize: 12; font.weight: Font.DemiBold
                                MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: logoPicker.choose() }
                            }
                        }
                    }

                    ListView {
                        id: sceneList
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        clip: true
                        spacing: 8
                        model: Doc.scenes
                        boundsBehavior: Flickable.StopAtBounds
                        add: Transition { NumberAnimation { property: "scale"; from: 0.85; to: 1; duration: Motion.pop; easing.type: Easing.OutBack } }
                        delegate: SceneCard {
                            required property var modelData
                            required property int index
                            width: sceneList.width
                            scene: modelData
                            sceneIndex: index
                        }
                    }

                    T { tone: "eyebrow"; text: "Adicionar" }
                    GridLayout {
                        Layout.fillWidth: true
                        columns: 2
                        columnSpacing: 8
                        rowSpacing: 8
                        AddTile { iconName: "tag"; tint: Theme.redInk; label: "Produto"; onClicked: Doc.add(Doc.productScene({ accentColor: Doc.config.scenes.length ? (Doc.scenes.find(s => s.type === "product") || {}).accentColor || "#FFD500" : "#FFD500" })) }
                        AddTile { iconName: "box"; tint: Theme.greenInk; label: "Da biblioteca"; onClicked: libDlg.open() }
                        AddTile { iconName: "layout"; tint: Theme.blue; label: "Template"; onClicked: tplDlg.open() }
                        AddTile { iconName: "video"; tint: Theme.text2; label: "Vídeo"; onClicked: videoPicker.choose() }
                        AddTile { iconName: "megaphone"; tint: Theme.amberInk; label: "Logo / texto"; onClicked: Doc.add(Doc.logoScene()); Layout.columnSpan: 2 }
                    }
                }
            }

            // Stage + timeline
            ColumnLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 14

                Rectangle {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    radius: Theme.radiusXL
                    color: Theme.stage

                    AdPlayer {
                        id: player
                        anchors.fill: parent
                        anchors.margins: 22
                        config: page.previewConfig
                        backdrop: "transparent"
                        Component.onCompleted: if (Doc.scenes.length) play()
                    }

                    ColumnLayout {
                        anchors.centerIn: parent
                        visible: Doc.scenes.length === 0
                        Icon { name: "sparkles"; size: 30; color: Theme.faint; Layout.alignment: Qt.AlignHCenter }
                        T { text: "Adicione uma cena para começar"; tone: "muted"; Layout.alignment: Qt.AlignHCenter }
                    }
                }

                Card {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 118
                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 14
                        spacing: 10
                        RowLayout {
                            spacing: 12
                            Rectangle {
                                width: 40; height: 40; radius: 20
                                color: Theme.inverse
                                scale: playMa.pressed ? 0.9 : (playMa.containsMouse ? 1.08 : 1)
                                Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack; easing.overshoot: 2.5 } }
                                Icon { anchors.centerIn: parent; name: player.playing ? "pause" : "play"; filled: true; size: 15; color: Theme.inverseInk }
                                MouseArea { id: playMa; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: player.toggle() }
                                Accessible.role: Accessible.Button
                                Accessible.name: player.playing ? "Pausar" : "Reproduzir"
                            }
                            T { text: Fmt.clock(player.frame, player.fps) + "  /  " + Fmt.clock(player.totalFrames, player.fps); bold: true; size: 13; font.features: { "tnum": 1 } }
                            Item { Layout.fillWidth: true }
                            T { tone: "muted"; size: 12; text: player.fps + " fps · " + page.fmt.width + "×" + page.fmt.height }
                        }

                        // Timeline: scene blocks + scrubbable playhead
                        Item {
                            id: timeline
                            Layout.fillWidth: true
                            Layout.preferredHeight: 44
                            readonly property real pxPerFrame: Doc.totalFrames > 0 ? width / Doc.totalFrames : 0

                            Row {
                                anchors.fill: parent
                                spacing: 0
                                Repeater {
                                    model: Doc.scenes
                                    delegate: Item {
                                        required property var modelData
                                        width: modelData.durationInFrames * timeline.pxPerFrame
                                        height: timeline.height
                                        Rectangle {
                                            anchors.fill: parent
                                            anchors.rightMargin: 4
                                            radius: 9
                                            readonly property bool sel: modelData.id === Doc.selectedId
                                            color: modelData.type === "logo" ? Theme.greenSoft : modelData.type === "product" ? Theme.redSoft
                                                  : modelData.type === "template" ? Theme.blueSoft : Theme.hover
                                            border.width: sel ? 2 : 0
                                            border.color: Theme.ink
                                            Text {
                                                anchors.fill: parent
                                                anchors.leftMargin: 8
                                                verticalAlignment: Text.AlignVCenter
                                                elide: Text.ElideRight
                                                text: modelData.type === "product" ? modelData.productName : modelData.type === "logo" ? "Logo" : modelData.type === "template" ? "Template" : "Vídeo"
                                                color: Theme.ink
                                                font.family: Theme.bodyFont; font.pixelSize: 12; font.weight: parent.sel ? Font.Bold : Font.DemiBold
                                            }
                                        }
                                    }
                                }
                            }
                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                function scrub(mx) {
                                    const f = Math.max(0, Math.min(Doc.totalFrames - 1, mx / timeline.pxPerFrame))
                                    player.pause()
                                    player.seek(f)
                                    const s = Doc.sceneAtFrame(Math.floor(f))
                                    if (s) Doc.selectedId = s.id
                                }
                                onPressed: (m) => scrub(m.x)
                                onPositionChanged: (m) => { if (pressed) scrub(m.x) }
                            }
                            Rectangle {
                                x: player.frame * timeline.pxPerFrame - 1
                                y: -6
                                width: 3
                                height: parent.height + 12
                                radius: 2
                                color: Theme.red
                                visible: Doc.totalFrames > 0
                                Rectangle { width: 11; height: 11; radius: 6; color: Theme.red; x: -4; y: -4 }
                            }
                        }
                    }
                }
            }

            // Inspector
            Card {
                popDelay: 120
                Layout.preferredWidth: 340
                Layout.fillHeight: true
                clip: true
                Inspector {
                    anchors.fill: parent
                    scene: Doc.selected
                    drift: page.drift.find(d => Doc.selected && d.sceneId === Doc.selected.id) || null
                    onApplyDrift: (d) => page.applyDrift([d])
                }
            }
        }
    }

    // ── Dialogs ───────────────────────────────────────────────────────────
    RenderDialog { id: renderDlg; format: page.format }

    MediaPicker { id: logoPicker; kind: "image"; onPicked: (p) => Doc.setLogo(p) }
    MediaPicker { id: videoPicker; kind: "video"; onPicked: (p) => Doc.add(Doc.videoScene(p)) }

    AppDialog {
        id: saveDlg
        property bool thenRender: false
        title: "Salvar anúncio"
        onOpened: { saveName.text = Doc.name; saveName.forceActiveFocus() }
        Field {
            Layout.fillWidth: true
            label: "Nome do anúncio"
            TextBox { id: saveName; placeholderText: "Ex: Ofertas da semana"; onAccepted: saveOk.clicked() }
        }
        actions: [
            Btn { text: "Cancelar"; onClicked: saveDlg.close() },
            Btn {
                id: saveOk
                text: saveDlg.thenRender ? "Salvar e renderizar" : "Salvar"
                variant: "primary"
                enabled: saveName.text.trim() !== ""
                onClicked: { Doc.name = saveName.text.trim(); saveDlg.close(); page.save(saveDlg.thenRender) }
            }
        ]
    }

    AppDialog {
        id: libDlg
        property var picked: ({})
        title: "Importar da biblioteca"
        subtitle: "Cada produto vira uma cena ligada à biblioteca — você é avisado quando o preço mudar."
        dialogWidth: 640
        onOpened: picked = ({})
        Repeater {
            model: Library.items
            delegate: Rectangle {
                required property var modelData
                readonly property bool on: !!libDlg.picked[modelData.id]
                Layout.fillWidth: true
                Layout.preferredHeight: 60
                radius: 14
                color: on ? Theme.accentSoft : Theme.surface
                border.color: on ? Theme.ink : Theme.border
                border.width: on ? 2 : 1
                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 8
                    spacing: 12
                    MediaThumb { Layout.preferredWidth: 56; Layout.fillHeight: true; path: modelData.image || "" }
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 0
                        T { text: modelData.name; bold: true }
                        T { text: (modelData.category || "Sem categoria") + " · R$ " + modelData.newPrice + (modelData.priceSuffix || ""); tone: "muted"; size: 12 }
                    }
                    Icon { visible: parent.parent.on; name: "check"; stroke: 3; color: Theme.ink }
                }
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: { const p = Object.assign({}, libDlg.picked); if (p[modelData.id]) delete p[modelData.id]; else p[modelData.id] = true; libDlg.picked = p }
                }
            }
        }
        T { visible: Library.items.length === 0; tone: "muted"; text: "A biblioteca está vazia. Cadastre produtos em Produtos e preços." }
        actions: [
            Btn { text: "Cancelar"; onClicked: libDlg.close() },
            Btn {
                text: "Importar " + Object.keys(libDlg.picked).length
                variant: "primary"
                enabled: Object.keys(libDlg.picked).length > 0
                onClicked: {
                    const ids = Object.keys(libDlg.picked)
                    const added = Library.items.filter(p => ids.indexOf(p.id) >= 0).map(p => Doc.fromLibrary(p))
                    Doc.setScenes(Doc.scenes.concat(added))
                    if (added.length) Doc.select(added[0].id)
                    Toasts.success(added.length + " produto(s) importado(s) como cenas.")
                    libDlg.close()
                }
            }
        ]
    }

    AppDialog {
        id: tplDlg
        title: "Escolher template"
        dialogWidth: 860
        GridLayout {
            Layout.fillWidth: true
            columns: 3
            columnSpacing: 12
            rowSpacing: 12
            Repeater {
                model: Templates.items
                delegate: TemplateCard {
                    required property var modelData
                    Layout.fillWidth: true
                    template: modelData
                    compact: true
                    onActivated: { Doc.add(Doc.templateScene(modelData.id)); tplDlg.close(); Toasts.success("Template \"" + modelData.name + "\" adicionado.") }
                }
            }
        }
    }

    // ── Local components ──────────────────────────────────────────────────
    component AddTile: Rectangle {
        id: tile
        property string iconName
        property color tint
        property string label
        signal clicked()
        Layout.fillWidth: true
        Layout.preferredHeight: 60
        radius: 14
        color: ma.containsMouse ? Theme.accentSoft : Theme.surfaceAlt
        border.color: Theme.borderStrong
        border.width: 1
        transform: Translate { y: ma.containsMouse ? -2 : 0; Behavior on y { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack; easing.overshoot: 2.5 } } }
        Column {
            anchors.centerIn: parent
            spacing: 4
            Icon { anchors.horizontalCenter: parent.horizontalCenter; name: tile.iconName; color: tile.tint }
            Text { text: tile.label; color: Theme.ink; font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold }
        }
        MouseArea { id: ma; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: tile.clicked() }
        Accessible.role: Accessible.Button
        Accessible.name: "Adicionar " + label
    }

    component SceneCard: Item {
        id: card
        property var scene
        property int sceneIndex
        readonly property bool sel: scene.id === Doc.selectedId
        readonly property bool drifted: page.drift.some(d => d.sceneId === scene.id)
        height: 56
        z: dragArea.drag.active ? 10 : 0

        Rectangle {
            id: body
            width: card.width
            height: card.height
            radius: 14
            color: card.sel ? Theme.accentSoft : Theme.surface
            border.width: card.sel ? 2 : 1
            border.color: card.sel ? Theme.ink : Theme.border
            x: hov.hovered && !dragArea.drag.active ? 4 : 0
            Behavior on x { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack; easing.overshoot: 2.5 } }
            scale: dragArea.drag.active ? 1.03 : 1
            Behavior on scale { NumberAnimation { duration: Motion.base } }

            RowLayout {
                anchors.fill: parent
                anchors.margins: 8
                spacing: 10
                SceneSwatch { Layout.preferredWidth: 56; Layout.preferredHeight: 32; scene: card.scene; logoImage: Doc.config.logoImage || "" }
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 0
                    T {
                        text: card.scene.type === "product" ? card.scene.productName : card.scene.type === "logo" ? (card.scene.tagline || "Logo")
                              : card.scene.type === "template" ? (Templates.find(card.scene.templateId).name || "Template") : (card.scene.src ? card.scene.src.split("/").pop() : "Vídeo")
                        bold: card.sel
                        size: 13
                        elide: Text.ElideRight
                        wrapMode: Text.NoWrap
                        Layout.fillWidth: true
                    }
                    T {
                        size: 11
                        color: card.drifted ? Theme.amberInk : Theme.muted
                        font.weight: card.drifted ? Font.DemiBold : Font.Normal
                        text: ({ product: "Produto", logo: "Logo", template: "Template", video: "Vídeo" })[card.scene.type]
                              + (card.drifted ? " · preço mudou" : " · " + Fmt.seconds(card.scene.durationInFrames, Doc.config.fps))
                    }
                }
                IconBtn {
                    iconName: "more"
                    label: "Opções da cena"
                    bordered: false
                    box: 28
                    opacity: hov.hovered || card.sel ? 1 : 0
                    onClicked: menu.popup()
                }
            }
            HoverHandler { id: hov }
            MouseArea {
                id: dragArea
                anchors.fill: parent
                anchors.rightMargin: 36
                cursorShape: drag.active ? Qt.ClosedHandCursor : Qt.PointingHandCursor
                drag.target: body
                drag.axis: Drag.YAxis
                drag.threshold: 8
                onClicked: Doc.select(card.scene.id)
                onReleased: {
                    if (drag.active || body.y !== 0) {
                        const step = card.height + sceneList.spacing
                        const target = Math.max(0, Math.min(Doc.scenes.length - 1, card.sceneIndex + Math.round(body.y / step)))
                        body.y = 0
                        Doc.moveTo(card.sceneIndex, target)
                    }
                }
            }
        }

        Menu {
            id: menu
            MenuItem { text: "Duplicar"; onTriggered: Doc.duplicate(card.scene.id) }
            MenuItem { text: "Mover para cima"; enabled: card.sceneIndex > 0; onTriggered: Doc.move(card.scene.id, -1) }
            MenuItem { text: "Mover para baixo"; enabled: card.sceneIndex < Doc.scenes.length - 1; onTriggered: Doc.move(card.scene.id, 1) }
            MenuSeparator {}
            MenuItem { text: "Remover"; onTriggered: { Doc.remove(card.scene.id); Toasts.info("Cena removida.") } }
        }
    }
}
