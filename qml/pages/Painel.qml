import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import QtMultimedia
import Screenlet

// Painel de anúncios — proposal B dashboard.
Item {
    id: page
    property var params: ({})
    property string filter: "all"
    property string query: ""
    property var drift: []

    Component.onCompleted: {
        Projects.refresh(); Channels.refresh(); Exports.refresh(); Library.refresh()
        drift = Insights.priceDrift()
    }

    readonly property var rows: {
        const q = query.trim().toLowerCase()
        return Projects.items.map(p => ({ p: p, st: Insights.adStatus(p) }))
            .filter(r => filter === "all" || (filter === "live" && r.st.kind === "live")
                    || (filter === "scheduled" && r.st.kind === "scheduled") || (filter === "draft" && r.st.kind === "draft"))
            .filter(r => !q || r.p.name.toLowerCase().indexOf(q) >= 0)
    }
    readonly property int liveCount: Projects.items.filter(p => Insights.adStatus(p).kind === "live").length
    readonly property int scheduledCount: Projects.items.filter(p => Insights.adStatus(p).kind === "scheduled").length

    // What's on air now: first enabled channel with a current asset.
    readonly property var nowPlaying: {
        Insights.tick
        for (const c of Insights.enabledChannels) {
            const a = Channels.currentAsset(c)
            if (a) return { channel: c, file: a }
        }
        return null
    }

    ScrollPage {
        anchors.fill: parent

        PageHeader {
            eyebrow: Fmt.today().charAt(0).toUpperCase() + Fmt.today().slice(1)
            title: "Painel de anúncios"
            TextBox {
                width: 280
                iconName: "search"
                placeholderText: "Buscar anúncio ou produto"
                onTextChanged: page.query = text
            }
            IconBtn {
                iconName: "bell"
                label: page.drift.length ? page.drift.length + " anúncio(s) com preço desatualizado" : "Sem alertas"
                box: 40
                onClicked: if (page.drift.length) driftDlg.open()
                Rectangle {
                    visible: page.drift.length > 0
                    width: 10; height: 10; radius: 5
                    color: Theme.red
                    border.color: Theme.surface; border.width: 2
                    x: parent.width - 14; y: 8
                }
                SequentialAnimation on rotation {
                    running: page.drift.length > 0 && !Motion.reduced
                    loops: Animation.Infinite
                    PauseAnimation { duration: 2800 }
                    NumberAnimation { to: -12; duration: 90 }
                    NumberAnimation { to: 10; duration: 90 }
                    NumberAnimation { to: -6; duration: 90 }
                    NumberAnimation { to: 0; duration: 140; easing.type: Easing.OutBack }
                }
            }
        }

        // ── KPIs ──────────────────────────────────────────────────────────
        GridLayout {
            width: parent.width
            columns: width > 1000 ? 4 : 2
            columnSpacing: 14
            rowSpacing: 14

            Kpi { dark: true; popDelay: 60; label: "No ar agora"; value: page.liveCount; unit: "anúncios"; live: true; onClicked: page.filter = "live" }
            Kpi { popDelay: 115; label: "Agendados"; value: page.scheduledCount; unit: "com regra de horário"; onClicked: page.filter = "scheduled" }
            Kpi { popDelay: 170; label: "Telas online"; value: Insights.screensOnline; suffix: "/" + Insights.screensTotal; onClicked: Nav.go("telas") }
            Kpi { popDelay: 225; warn: true; label: "Preços mudaram no PDV"; value: page.drift.length; unit: "revisar →"; onClicked: if (page.drift.length) driftDlg.open(); else Nav.go("produtos") }
        }

        // ── Main area ─────────────────────────────────────────────────────
        GridLayout {
            width: parent.width
            columns: width > 1100 ? 2 : 1
            columnSpacing: 18
            rowSpacing: 18

            Card {
                popDelay: 280
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignTop
                Layout.preferredHeight: tableCol.implicitHeight
                radius: 24
                roundClip: true

                ColumnLayout {
                    id: tableCol
                    width: parent.width
                    spacing: 0

                    RowLayout {
                        Layout.fillWidth: true
                        Layout.margins: 16
                        spacing: 12
                        H { level: 3; text: "Anúncios"; Layout.fillWidth: true }
                        Segmented {
                            options: [{ value: "all", label: "Todos" }, { value: "live", label: "No ar" },
                                      { value: "scheduled", label: "Agendados" }, { value: "draft", label: "Rascunhos" }]
                            value: page.filter
                            onPicked: (v) => page.filter = v
                        }
                    }
                    Rectangle { Layout.fillWidth: true; height: 1; color: Theme.border }

                    RowLayout {
                        visible: page.rows.length > 0
                        Layout.fillWidth: true
                        Layout.leftMargin: 18; Layout.rightMargin: 18; Layout.topMargin: 10; Layout.bottomMargin: 6
                        T { text: "Anúncio"; tone: "muted"; size: 12; bold: true; Layout.fillWidth: true }
                        T { text: "Formatos"; tone: "muted"; size: 12; bold: true; Layout.preferredWidth: 130 }
                        T { text: "Canais"; tone: "muted"; size: 12; bold: true; Layout.preferredWidth: 120 }
                        T { text: "Status"; tone: "muted"; size: 12; bold: true; Layout.preferredWidth: 96 }
                        Item { Layout.preferredWidth: 90 }
                    }

                    Repeater {
                        model: page.rows.slice(0, 8)
                        delegate: AdRow {
                            required property var modelData
                            required property int index
                            Layout.fillWidth: true
                            project: modelData.p
                            status: modelData.st
                            popDelay: 320 + index * 45
                        }
                    }

                    EmptyState {
                        visible: page.rows.length === 0
                        Layout.fillWidth: true
                        Layout.margins: 16
                        border.width: 0
                        iconName: "megaphone"
                        title: Projects.items.length ? "Nada neste filtro" : "Nenhum anúncio ainda"
                        text: Projects.items.length ? "Troque o filtro ou a busca." : "Crie o primeiro com o botão \"Novo anúncio\"."
                        Btn { visible: !Projects.items.length; text: "Novo anúncio"; variant: "primary"; iconName: "plus"; onClicked: Nav.go("wizard") }
                    }

                    Item { Layout.preferredHeight: 8 }
                }
            }

            ColumnLayout {
                Layout.fillWidth: true
                Layout.maximumWidth: parent.columns === 2 ? 360 : 100000
                Layout.alignment: Qt.AlignTop
                spacing: 18

                // Na tela agora
                Card {
                    popDelay: 340
                    Layout.fillWidth: true
                    Layout.preferredHeight: nowCol.implicitHeight + 32
                    radius: 24
                    ColumnLayout {
                        id: nowCol
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 12
                        RowLayout {
                            H { level: 4; text: "Na tela agora"; Layout.fillWidth: true }
                            T { text: page.nowPlaying ? page.nowPlaying.channel.name : ""; tone: "muted"; size: 12; bold: true }
                        }
                        Rectangle {
                            Layout.fillWidth: true
                            Layout.preferredHeight: width * 9 / 16
                            radius: 14
                            color: "#000"
                            clip: true
                            MediaPlayer {
                                id: nowPlayer
                                source: page.nowPlaying ? Storage.exportUrl(page.nowPlaying.file) : ""
                                videoOutput: nowOut
                                loops: MediaPlayer.Infinite
                                Component.onCompleted: if (source != "") play()
                                onSourceChanged: if (source != "") play()
                            }
                            VideoOutput { id: nowOut; anchors.fill: parent; fillMode: VideoOutput.PreserveAspectCrop }
                            Rectangle {
                                anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom
                                height: 4
                                color: Theme.alpha("#FFFFFF", 0.25)
                                Rectangle {
                                    height: parent.height
                                    width: nowPlayer.duration > 0 ? parent.width * nowPlayer.position / nowPlayer.duration : 0
                                    color: "#FFFFFF"
                                }
                            }
                            ColumnLayout {
                                anchors.centerIn: parent
                                visible: !page.nowPlaying
                                Icon { name: "tv"; size: 28; color: "#9AA0AE"; Layout.alignment: Qt.AlignHCenter }
                                Text { text: "Nenhum canal no ar"; color: "#C9CDD5"; font.family: Theme.bodyFont; font.pixelSize: 13; Layout.alignment: Qt.AlignHCenter }
                            }
                        }
                        T { tone: "eyebrow"; text: "A seguir"; visible: upcomingRep.count > 0 }
                        Repeater {
                            id: upcomingRep
                            model: Insights.upcoming(3)
                            delegate: RowLayout {
                                required property var modelData
                                Layout.fillWidth: true
                                spacing: 10
                                T { text: modelData.when; tone: "muted"; size: 12; bold: true; Layout.preferredWidth: 44 }
                                T { text: modelData.name; bold: true; elide: Text.ElideRight; wrapMode: Text.NoWrap; Layout.fillWidth: true }
                                T { text: modelData.channel; size: 12; color: Theme.blue; bold: true }
                            }
                        }
                        Btn { text: "Abrir canais"; small: true; Layout.fillWidth: true; onClicked: Nav.go("canais") }
                    }
                }

                // New screen found
                Card {
                    visible: Insights.unpairedPlayers.length > 0
                    popDelay: 400
                    Layout.fillWidth: true
                    Layout.preferredHeight: newCol.implicitHeight + 32
                    radius: 24
                    color: Theme.inverse
                    border.width: 0
                    ColumnLayout {
                        id: newCol
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 8
                        Text { text: "NOVA TELA ENCONTRADA"; color: Theme.accent; font.family: Theme.bodyFont; font.pixelSize: 12; font.weight: Font.Bold; font.letterSpacing: 0.6 }
                        Text { text: Insights.unpairedPlayers.length ? Insights.unpairedPlayers[0].name : ""; color: Theme.inverseInk; font.family: Theme.displayFont; font.pixelSize: 18; font.weight: Font.Bold }
                        Text {
                            text: Insights.unpairedPlayers.length ? "Screenlet Player " + (Insights.unpairedPlayers[0].playerVersion || "") + (Insights.unpairedPlayers[0].apiUrl ? " · " + Insights.unpairedPlayers[0].apiUrl.replace("http://", "").replace(":8089", "") : "") : ""
                            color: Theme.dark ? "#5B6170" : "#B9BDC8"; font.family: Theme.bodyFont; font.pixelSize: 13
                        }
                        Btn { text: "Parear com um canal"; variant: "primary"; small: true; onClicked: Nav.go("telas", { pair: Insights.unpairedPlayers[0].id }) }
                    }
                }

                // Templates shortcut
                Card {
                    popDelay: 460
                    Layout.fillWidth: true
                    Layout.preferredHeight: 92
                    radius: 24
                    lift: true
                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 14
                        Rectangle {
                            width: 48; height: 48; radius: 14
                            color: Theme.blueSoft
                            Icon { anchors.centerIn: parent; name: "layout"; size: 22; color: Theme.blue }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 2
                            H { level: 4; text: "Usar um template" }
                            T { tone: "muted"; size: 13; text: "Açougue, Natal, Páscoa e mais" }
                        }
                        Icon { name: "chevronRight"; color: Theme.muted }
                    }
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: Nav.go("templates") }
                }
            }
        }
    }

    // ── Price drift dialog ────────────────────────────────────────────────
    AppDialog {
        id: driftDlg
        title: "Preços mudaram"
        subtitle: "Produtos da biblioteca foram alterados depois de entrarem nestes anúncios. Atualize e renderize de novo — suas outras edições são mantidas e os canais recebem o vídeo novo."
        actions: [
            Btn { text: "Agora não"; onClicked: driftDlg.close() },
            Btn {
                text: "Atualizar e renderizar todos"
                variant: "primary"
                iconName: "refresh"
                onClicked: {
                    const r = RenderQueue.enqueue(page.drift.map(d => d.projectId))
                    if (r.queued) Toasts.info(r.queued + " vídeo(s) na fila de renderização.")
                    page.drift = Insights.priceDrift()
                    driftDlg.close()
                }
            }
        ]
        Repeater {
            model: page.drift
            delegate: Rectangle {
                required property var modelData
                Layout.fillWidth: true
                Layout.preferredHeight: dcol.implicitHeight + 24
                radius: 14
                color: Theme.amberSoft
                border.color: Theme.amberLine
                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 12
                    ColumnLayout {
                        id: dcol
                        Layout.fillWidth: true
                        spacing: 2
                        T { text: modelData.projectName; bold: true }
                        T { size: 12; color: Theme.amberInk; text: modelData.scenes.map(s => s.name + " (" + s.changed.join(", ") + ")").join(" · ") }
                    }
                    Btn { text: "Abrir"; small: true; onClicked: { driftDlg.close(); if (Doc.open(modelData.projectId)) Nav.go("editor") } }
                }
            }
        }
    }

    // ── Local components ──────────────────────────────────────────────────
    component Kpi: Card {
        id: kpi
        property bool dark: false
        property bool warn: false
        property bool live: false
        property string label
        property int value
        property string unit: ""
        property string suffix: ""
        signal clicked()
        Layout.fillWidth: true
        Layout.preferredHeight: 116
        lift: true
        color: dark ? Theme.inverse : (warn ? Theme.amberSoft : Theme.surface)
        border.width: dark ? 0 : 1
        border.color: warn ? Theme.amberLine : Theme.border

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 18
            spacing: 10
            RowLayout {
                spacing: 8
                LiveDot { visible: kpi.live; active: kpi.value > 0 }
                Text {
                    text: kpi.label
                    color: kpi.dark ? Theme.accent : (kpi.warn ? Theme.amberInk : Theme.muted)
                    font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold
                }
            }
            Item { Layout.fillHeight: true }
            Row {
                spacing: 6
                Text {
                    id: num
                    text: String(Math.round(anim.v)) + kpi.suffix
                    color: kpi.dark ? Theme.inverseInk : Theme.ink
                    font.family: Theme.displayFont; font.pixelSize: 40; font.weight: Font.ExtraBold
                    QtObject { id: anim; property real v: 0 }
                    NumberAnimation { target: anim; property: "v"; from: 0; to: kpi.value; duration: 900; easing.type: Easing.OutCubic; running: true }
                }
                Text {
                    anchors.baseline: num.baseline
                    text: kpi.unit
                    color: kpi.dark ? "#B9BDC8" : (kpi.warn ? Theme.amberInk : Theme.muted)
                    font.family: Theme.bodyFont; font.pixelSize: 14; font.weight: Font.DemiBold
                }
            }
        }
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: kpi.clicked() }
        onValueChanged: anim.v = value
    }

    component AdRow: Rectangle {
        id: row
        property var project
        property var status
        property int popDelay: 0
        Layout.preferredHeight: 60
        color: rowMa.containsMouse ? Theme.surfaceAlt : "transparent"
        opacity: 0
        Component.onCompleted: fade.start()
        SequentialAnimation { id: fade; PauseAnimation { duration: row.popDelay } NumberAnimation { target: row; property: "opacity"; to: 1; duration: Motion.base } }

        Rectangle { anchors.top: parent.top; width: parent.width; height: 1; color: Theme.border; opacity: 0.6 }

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 18
            anchors.rightMargin: 18
            spacing: 8

            RowLayout {
                Layout.fillWidth: true
                spacing: 12
                Rectangle {
                    width: 64; height: 36; radius: 8
                    color: row.project.coverBg || "#1A1A1A"
                    clip: true
                    Image {
                        anchors.fill: parent
                        source: row.project.thumbnail ? Storage.url(row.project.thumbnail) + "?t=" + row.project.updatedAt
                              : (row.project.coverImage ? Storage.url(row.project.coverImage) : "")
                        fillMode: row.project.thumbnail ? Image.PreserveAspectCrop : Image.PreserveAspectFit
                        anchors.margins: row.project.thumbnail ? 0 : 3
                        sourceSize.width: 160
                        asynchronous: true
                    }
                }
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 1
                    T { text: row.project.name; bold: true; elide: Text.ElideRight; wrapMode: Text.NoWrap; Layout.fillWidth: true }
                    T { text: row.project.sceneCount + " cenas · " + Fmt.seconds(row.project.durationFrames, row.project.fps); tone: "muted"; size: 12 }
                }
            }
            Row {
                Layout.preferredWidth: 130
                spacing: 4
                Repeater {
                    model: row.status.formats.length ? row.status.formats : []
                    delegate: Chip { required property string modelData; text: Fmt.formats[modelData] ? Fmt.formats[modelData].short : modelData }
                }
                T { visible: !row.status.formats.length; text: "—"; tone: "muted" }
            }
            T { Layout.preferredWidth: 120; text: row.status.channels.length ? row.status.channels.join(", ") : "—"; tone: row.status.channels.length ? "ink" : "muted"; color: Theme.text2; elide: Text.ElideRight; wrapMode: Text.NoWrap; size: 13 }
            Item {
                Layout.preferredWidth: 96
                implicitHeight: 24
                Pill { kind: row.status.kind; text: row.status.label; anchors.verticalCenter: parent.verticalCenter }
            }
            Text {
                Layout.preferredWidth: 90
                horizontalAlignment: Text.AlignRight
                text: row.status.kind === "draft" ? "Continuar" : "Editar"
                color: Theme.blue
                font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold
            }
        }
        MouseArea {
            id: rowMa
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: if (Doc.open(row.project.id)) Nav.go("editor")
        }
    }
}
