import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import QtMultimedia
import Screenlet

// Studio — playlist, live preview (with real cut/fade) and the 24 h grid of
// programming rules for one channel.
Item {
    id: page
    property var params: ({})
    property var channel: Channels.find(params.id || "")
    property var playlist: (channel.playlist || []).slice()
    property bool loop: channel.loop !== undefined ? channel.loop : true
    property var rules: (channel.rules || []).slice()
    property string tab: "playlist"
    property bool dirty: false
    property int previewIndex: 0
    readonly property int activeRule: (Insights.tick, rules.findIndex(r => Channels.currentAsset({ rules: [r], playlist: [] }) === r.assetFilename))

    Component.onCompleted: Exports.refresh()

    function save() {
        Channels.save(Object.assign({}, channel, { playlist: playlist, loop: loop, rules: rules }))
        dirty = false
        Toasts.success("Programação salva. As telas do canal recebem a atualização.")
    }

    function move(i, d) {
        const j = i + d
        if (j < 0 || j >= playlist.length) return
        const l = playlist.slice(); const t = l[i]; l[i] = l[j]; l[j] = t
        playlist = l; dirty = true
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

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
                IconBtn { iconName: "chevronLeft"; label: "Voltar aos canais"; onClicked: Nav.go("canais") }
                ColumnLayout {
                    spacing: 0
                    Layout.fillWidth: true
                    T { tone: "eyebrow"; text: "Studio" }
                    H { level: 3; text: page.channel.name || "Canal" }
                }
                Segmented {
                    options: [{ value: "playlist", label: "Playlist" }, { value: "preview", label: "Pré-visualizar" }, { value: "schedule", label: "Horários" }]
                    value: page.tab
                    onPicked: (v) => { page.tab = v; page.previewIndex = 0 }
                }
                Toggle { text: "Loop"; checked: page.loop; onToggled: { page.loop = checked; page.dirty = true } }
                Btn { text: "Cancelar"; onClicked: Nav.go("canais") }
                Btn { text: "Salvar"; variant: "primary"; iconName: "check"; enabled: page.dirty; onClicked: page.save() }
            }
        }

        // ── Playlist ──────────────────────────────────────────────────────
        RowLayout {
            visible: page.tab === "playlist"
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.margins: 16
            spacing: 16

            Card {
                Layout.preferredWidth: 360
                Layout.fillHeight: true
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 10
                    H { level: 4; text: "Vídeos prontos" }
                    T { tone: "muted"; size: 12; text: "Clique para adicionar à playlist." }
                    ListView {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        clip: true
                        spacing: 8
                        model: Exports.items
                        delegate: Rectangle {
                            required property var modelData
                            width: ListView.view.width
                            height: 64
                            radius: 14
                            color: vma.containsMouse ? Theme.accentSoft : Theme.surface
                            border.color: Theme.border
                            RowLayout {
                                anchors.fill: parent
                                anchors.margins: 8
                                spacing: 10
                                MediaThumb { Layout.preferredWidth: 84; Layout.fillHeight: true; color: "#000"; path: "exports/" + modelData.filename; type: "video" }
                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 0
                                    T { text: modelData.name; bold: true; size: 13; elide: Text.ElideRight; wrapMode: Text.NoWrap; Layout.fillWidth: true }
                                    T { text: Fmt.bytes(modelData.size); tone: "muted"; size: 11 }
                                }
                                Icon { name: "plus"; color: Theme.text2; scale: vma.containsMouse ? 1.25 : 1; Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack; easing.overshoot: 3 } } }
                            }
                            MouseArea {
                                id: vma
                                anchors.fill: parent
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: { page.playlist = page.playlist.concat([{ id: Fmt.uuid(), filename: modelData.filename, name: modelData.name, transition: "cut" }]); page.dirty = true }
                            }
                        }
                    }
                    T { visible: Exports.items.length === 0; tone: "muted"; text: "Nenhum vídeo renderizado ainda." }
                }
            }

            Card {
                Layout.fillWidth: true
                Layout.fillHeight: true
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 10
                    RowLayout {
                        H { level: 4; text: "Playlist do canal"; Layout.fillWidth: true }
                        T { tone: "muted"; size: 12; text: page.playlist.length + " item(ns)" + (page.loop ? " · repete ao final" : "") }
                    }
                    ListView {
                        id: pl
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        clip: true
                        spacing: 8
                        model: page.playlist
                        add: Transition { NumberAnimation { property: "x"; from: 60; to: 0; duration: Motion.pop; easing.type: Easing.OutBack } NumberAnimation { property: "opacity"; from: 0; to: 1; duration: Motion.base } }
                        delegate: Rectangle {
                            required property var modelData
                            required property int index
                            width: pl.width
                            height: 64
                            radius: 14
                            color: Theme.surface
                            border.color: Theme.border
                            RowLayout {
                                anchors.fill: parent
                                anchors.margins: 8
                                spacing: 10
                                Rectangle {
                                    width: 28; height: 28; radius: 14; color: Theme.inverse
                                    Text { anchors.centerIn: parent; text: index + 1; color: Theme.inverseInk; font.pixelSize: 12; font.bold: true }
                                }
                                MediaThumb { Layout.preferredWidth: 84; Layout.fillHeight: true; color: "#000"; path: "exports/" + modelData.filename; type: "video" }
                                T { text: modelData.name; bold: true; size: 13; Layout.fillWidth: true; elide: Text.ElideRight; wrapMode: Text.NoWrap }
                                Segmented {
                                    options: [{ value: "cut", label: "Corte" }, { value: "fade", label: "Fade" }]
                                    value: modelData.transition || "cut"
                                    onPicked: (v) => { page.playlist = page.playlist.map((p, i) => i === index ? Object.assign({}, p, { transition: v }) : p); page.dirty = true }
                                }
                                IconBtn { iconName: "chevronUp"; label: "Subir"; box: 30; enabled: index > 0; onClicked: page.move(index, -1) }
                                IconBtn { iconName: "chevronDown"; label: "Descer"; box: 30; enabled: index < page.playlist.length - 1; onClicked: page.move(index, 1) }
                                IconBtn { iconName: "trash"; danger: true; label: "Remover"; box: 30; onClicked: { page.playlist = page.playlist.filter((p, i) => i !== index); page.dirty = true } }
                            }
                        }
                    }
                    EmptyState {
                        visible: page.playlist.length === 0
                        Layout.fillWidth: true
                        border.width: 0
                        iconName: "list"
                        title: "Playlist vazia"
                        text: "Adicione vídeos da lista ao lado."
                    }
                }
            }
        }

        // ── Preview (real cut / fade between two players) ─────────────────
        Item {
            visible: page.tab === "preview"
            Layout.fillWidth: true
            Layout.fillHeight: true

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 16
                spacing: 14
                Rectangle {
                    id: previewBox
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    radius: Theme.radiusXL
                    color: "#000"
                    clip: true

                    // Two decks: the next clip starts underneath and fades in.
                    property int deck: 0
                    MediaPlayer { id: pa; videoOutput: va; audioOutput: AudioOutput { muted: true } }
                    MediaPlayer { id: pb; videoOutput: vb; audioOutput: AudioOutput { muted: true } }
                    VideoOutput { id: va; anchors.fill: parent; opacity: parent.deck === 0 ? 1 : 0; Behavior on opacity { NumberAnimation { duration: fadeDur.v } } }
                    VideoOutput { id: vb; anchors.fill: parent; opacity: parent.deck === 1 ? 1 : 0; Behavior on opacity { NumberAnimation { duration: fadeDur.v } } }
                    QtObject { id: fadeDur; property int v: 0 }

                    function playIndex(i) {
                        if (!page.playlist.length) return
                        const item = page.playlist[i]
                        fadeDur.v = item.transition === "fade" ? 600 : 0
                        const next = deck === 0 ? pb : pa
                        next.source = Storage.exportUrl(item.filename)
                        next.play()
                        deck = deck === 0 ? 1 : 0
                        const prev = deck === 0 ? pb : pa
                        Qt.callLater(() => prev.stop())
                        page.previewIndex = i
                    }
                    Connections {
                        target: pa
                        function onMediaStatusChanged() { if (pa.mediaStatus === MediaPlayer.EndOfMedia) previewBox.advance() }
                    }
                    Connections {
                        target: pb
                        function onMediaStatusChanged() { if (pb.mediaStatus === MediaPlayer.EndOfMedia) previewBox.advance() }
                    }
                    function advance() {
                        const n = page.previewIndex + 1
                        if (n < page.playlist.length) playIndex(n)
                        else if (page.loop) playIndex(0)
                    }
                    Connections {
                        target: page
                        function onTabChanged() { if (page.tab === "preview") previewBox.playIndex(0); else { pa.stop(); pb.stop() } }
                    }

                    ColumnLayout {
                        anchors.centerIn: parent
                        visible: page.playlist.length === 0
                        Icon { name: "tv"; size: 30; color: "#9AA0AE"; Layout.alignment: Qt.AlignHCenter }
                        Text { text: "A playlist está vazia — adicione vídeos na aba Playlist."; color: "#C9CDD5"; font.family: Theme.bodyFont; font.pixelSize: 14 }
                    }
                }
                Flow {
                    Layout.fillWidth: true
                    spacing: 8
                    Repeater {
                        model: page.playlist
                        delegate: Rectangle {
                            required property var modelData
                            required property int index
                            readonly property bool on: index === page.previewIndex
                            height: 36
                            width: plt.implicitWidth + 24
                            radius: 18
                            color: on ? Theme.inverse : Theme.surface
                            border.color: Theme.border
                            Text { id: plt; anchors.centerIn: parent; text: (index + 1) + ". " + modelData.name; color: parent.on ? Theme.inverseInk : Theme.ink; font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold }
                            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: previewBox.playIndex(index) }
                        }
                    }
                }
            }
        }

        // ── Schedule (24 h grid) ──────────────────────────────────────────
        ScrollPage {
            visible: page.tab === "schedule"
            Layout.fillWidth: true
            Layout.fillHeight: true
            maxWidth: 1200

            RowLayout {
                width: parent.width
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 4
                    H { level: 3; text: "Grade de horários" }
                    T { tone: "muted"; text: "Regras têm prioridade sobre a playlist: a primeira regra que bater com o horário é a que vai ao ar." }
                }
                Btn { text: "Adicionar regra"; variant: "primary"; iconName: "plus"; onClicked: { ruleDlg.editIndex = -1; ruleDlg.open() } }
            }

            // Timeline 00–24 with "now" line
            Card {
                width: parent.width
                height: 90 + Math.max(1, page.rules.filter(r => r.schedule.type === "time-range").length) * 34
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 8
                    RowLayout {
                        Layout.fillWidth: true
                        Repeater {
                            model: 12
                            delegate: T { required property int index; Layout.fillWidth: true; text: (index * 2 < 10 ? "0" : "") + index * 2; tone: "muted"; size: 11 }
                        }
                    }
                    Item {
                        id: grid
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        Column {
                            anchors.fill: parent
                            spacing: 8
                            Repeater {
                                model: page.rules.filter(r => r.schedule.type === "time-range")
                                delegate: Rectangle {
                                    required property var modelData
                                    required property int index
                                    readonly property real s: Number(modelData.schedule.startTime.split(":")[0]) * 60 + Number(modelData.schedule.startTime.split(":")[1])
                                    readonly property real e: Number(modelData.schedule.endTime.split(":")[0]) * 60 + Number(modelData.schedule.endTime.split(":")[1])
                                    width: grid.width
                                    height: 26
                                    radius: 6
                                    color: Theme.sunken
                                    Rectangle {
                                        x: parent.width * parent.s / 1440
                                        width: Math.max(6, parent.width * ((parent.e >= parent.s ? parent.e : 1440) - parent.s) / 1440)
                                        height: parent.height
                                        radius: 6
                                        color: [Theme.amberSoft, Theme.blueSoft, Theme.greenSoft, Theme.redSoft][index % 4]
                                        Text {
                                            anchors.fill: parent; anchors.leftMargin: 8
                                            verticalAlignment: Text.AlignVCenter; elide: Text.ElideRight
                                            text: modelData.schedule.startTime + "–" + modelData.schedule.endTime + " · " + modelData.assetName
                                            color: Theme.ink; font.family: Theme.bodyFont; font.pixelSize: 11; font.weight: Font.DemiBold
                                        }
                                    }
                                    Rectangle {
                                        visible: parent.e < parent.s
                                        width: parent.width * parent.e / 1440
                                        height: parent.height
                                        radius: 6
                                        color: [Theme.amberSoft, Theme.blueSoft, Theme.greenSoft, Theme.redSoft][index % 4]
                                    }
                                }
                            }
                            T { visible: page.rules.filter(r => r.schedule.type === "time-range").length === 0; tone: "muted"; size: 12; text: "Sem faixas de horário — a playlist toca o dia todo." }
                        }
                        Rectangle {
                            readonly property real mins: (Insights.tick, new Date().getHours() * 60 + new Date().getMinutes())
                            x: grid.width * mins / 1440 - 1
                            y: -6
                            width: 3
                            height: grid.height + 12
                            radius: 2
                            color: Theme.red
                            SequentialAnimation on opacity { running: !Motion.reduced; loops: Animation.Infinite; NumberAnimation { to: 0.45; duration: 900 } NumberAnimation { to: 1; duration: 900 } }
                        }
                    }
                }
            }

            Repeater {
                model: page.rules
                delegate: Card {
                    required property var modelData
                    required property int index
                    width: parent.width
                    height: 70
                    popDelay: index * 40
                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 14
                        spacing: 12
                        Rectangle {
                            width: 42; height: 42; radius: 12
                            color: Theme.blueSoft
                            Icon { anchors.centerIn: parent; name: modelData.schedule.type === "day-of-week" ? "calendar" : modelData.schedule.type === "always" ? "refresh" : "clock"; color: Theme.blue }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 0
                            T { text: modelData.assetName; bold: true }
                            T {
                                tone: "muted"
                                size: 12
                                text: modelData.schedule.type === "always" ? "Sempre"
                                    : modelData.schedule.type === "time-range" ? "Das " + modelData.schedule.startTime + " às " + modelData.schedule.endTime
                                    : (modelData.schedule.days || []).map(d => Fmt.weekdayShort(d)).join(", ")
                            }
                        }
                        Pill { visible: index === page.activeRule; kind: "live"; text: "No ar agora" }
                        IconBtn { iconName: "chevronUp"; label: "Mais prioridade"; box: 30; enabled: index > 0; onClicked: { const l = page.rules.slice(); const t = l[index]; l[index] = l[index - 1]; l[index - 1] = t; page.rules = l; page.dirty = true } }
                        IconBtn { iconName: "edit"; label: "Editar"; box: 30; onClicked: { ruleDlg.editIndex = index; ruleDlg.open() } }
                        IconBtn { iconName: "trash"; danger: true; label: "Remover"; box: 30; onClicked: { page.rules = page.rules.filter((r, i) => i !== index); page.dirty = true } }
                    }
                }
            }
        }
    }

    AppDialog {
        id: ruleDlg
        property int editIndex: -1
        property var r: ({})
        title: editIndex >= 0 ? "Editar regra" : "Nova regra"
        dialogWidth: 560
        onOpened: r = editIndex >= 0 ? Fmt.clone(page.rules[editIndex])
                                     : { id: Fmt.uuid(), assetFilename: Exports.items.length ? Exports.items[0].filename : "", assetName: Exports.items.length ? Exports.items[0].name : "",
                                         schedule: { type: "time-range", startTime: "08:00", endTime: "12:00" } }
        function set(p) { r = Object.assign({}, r, p) }
        function setS(p) { r = Object.assign({}, r, { schedule: Object.assign({}, r.schedule, p) }) }

        Field {
            Layout.fillWidth: true
            label: "Vídeo"
            Select {
                options: Exports.items.map(e => ({ value: e.filename, text: e.name }))
                value: ruleDlg.r.assetFilename
                onPicked: (v) => ruleDlg.set({ assetFilename: v, assetName: (Exports.items.find(e => e.filename === v) || {}).name || v })
            }
        }
        Field {
            Layout.fillWidth: true
            label: "Quando"
            Segmented {
                width: parent.width
                stretch: true
                options: [{ value: "time-range", label: "Faixa de horário" }, { value: "day-of-week", label: "Dias da semana" }, { value: "always", label: "Sempre" }]
                value: ruleDlg.r.schedule ? ruleDlg.r.schedule.type : "time-range"
                onPicked: (v) => ruleDlg.set({ schedule: v === "time-range" ? { type: v, startTime: "08:00", endTime: "12:00" } : v === "day-of-week" ? { type: v, days: [1, 2, 3, 4, 5] } : { type: v } })
            }
        }
        RowLayout {
            visible: !!ruleDlg.r.schedule && ruleDlg.r.schedule.type === "time-range"
            Layout.fillWidth: true
            spacing: 12
            Field { Layout.fillWidth: true; label: "Início"; TextBox { text: ruleDlg.r.schedule ? ruleDlg.r.schedule.startTime || "" : ""; inputMask: "99:99"; onEditingFinished: ruleDlg.setS({ startTime: text }) } }
            Field { Layout.fillWidth: true; label: "Fim"; TextBox { text: ruleDlg.r.schedule ? ruleDlg.r.schedule.endTime || "" : ""; inputMask: "99:99"; onEditingFinished: ruleDlg.setS({ endTime: text }) } }
        }
        T { visible: !!ruleDlg.r.schedule && ruleDlg.r.schedule.type === "time-range"; tone: "muted"; size: 12; text: "Pode virar a meia-noite, ex.: 22:00 às 06:00." }
        Flow {
            visible: !!ruleDlg.r.schedule && ruleDlg.r.schedule.type === "day-of-week"
            Layout.fillWidth: true
            spacing: 6
            Repeater {
                model: 7
                delegate: Rectangle {
                    required property int index
                    readonly property bool on: !!ruleDlg.r.schedule && (ruleDlg.r.schedule.days || []).indexOf(index) >= 0
                    width: 58; height: 40; radius: 12
                    color: on ? Theme.inverse : Theme.surface
                    border.color: Theme.borderStrong
                    border.width: on ? 0 : 1
                    scale: on ? 1.05 : 1
                    Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack; easing.overshoot: 3 } }
                    Text { anchors.centerIn: parent; text: Fmt.weekdayShort(index); color: parent.on ? Theme.inverseInk : Theme.ink; font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold }
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: { const d = (ruleDlg.r.schedule.days || []).slice(); const i = d.indexOf(index); if (i >= 0) d.splice(i, 1); else d.push(index); d.sort(); ruleDlg.setS({ days: d }) }
                    }
                }
            }
        }
        actions: [
            Btn { text: "Cancelar"; onClicked: ruleDlg.close() },
            Btn {
                text: "Salvar regra"
                variant: "primary"
                enabled: !!ruleDlg.r.assetFilename
                onClicked: {
                    const l = page.rules.slice()
                    if (ruleDlg.editIndex >= 0) l[ruleDlg.editIndex] = ruleDlg.r
                    else l.push(ruleDlg.r)
                    page.rules = l
                    page.dirty = true
                    ruleDlg.close()
                }
            }
        ]
    }
}
