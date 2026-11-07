import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Screenlet

// Meus anúncios — every saved ad with status, formats and channels.
Item {
    id: page
    property var params: ({})
    property string filter: "all"
    property string query: ""
    property var target: null

    Component.onCompleted: { Projects.refresh(); Channels.refresh(); Library.refresh(); Exports.refresh(); recomputeOutdated() }

    // projectId → { scenes: [{ name, changed }] } for ads whose library
    // products changed since import. Recomputed when products/ads change.
    property var outdated: ({})
    function recomputeOutdated() {
        const map = {}
        for (const d of Insights.priceDrift()) map[d.projectId] = d
        outdated = map
    }
    Connections { target: Library; function onItemsChanged() { page.recomputeOutdated() } }
    Connections { target: Projects; function onItemsChanged() { page.recomputeOutdated() } }
    readonly property var outdatedIds: Object.keys(outdated)

    function updateAndRender(ids) {
        const r = RenderQueue.enqueue(ids)
        if (r.queued) Toasts.info(r.queued + " vídeo(s) na fila de renderização.")
        recomputeOutdated()
    }

    readonly property var rows: {
        const q = query.trim().toLowerCase()
        return Projects.items.map(p => ({ p: p, st: Insights.adStatus(p) }))
            .filter(r => filter === "all" || (filter === "outdated" ? !!outdated[r.p.id] : r.st.kind === filter))
            .filter(r => !q || r.p.name.toLowerCase().indexOf(q) >= 0)
    }

    ScrollPage {
        anchors.fill: parent

        PageHeader {
            title: "Meus anúncios"
            subtitle: Projects.items.length + " anúncio(s) salvos"
            TextBox { width: 260; iconName: "search"; placeholderText: "Buscar anúncio"; onTextChanged: page.query = text }
            Btn { text: "Novo anúncio"; variant: "primary"; iconName: "plus"; onClicked: Nav.go("wizard") }
        }

        // Outdated banner
        Card {
            visible: page.outdatedIds.length > 0
            width: parent.width
            height: banner.implicitHeight + 32
            color: Theme.amberSoft
            border.color: Theme.amberLine
            RowLayout {
                id: banner
                anchors.fill: parent
                anchors.margins: 16
                spacing: 14
                Rectangle {
                    width: 44; height: 44; radius: 14
                    color: Theme.amberLine
                    Icon { anchors.centerIn: parent; name: "refresh"; size: 20; color: Theme.amberInk }
                    RotationAnimation on rotation { running: RenderQueue.active; loops: Animation.Infinite; from: 0; to: 360; duration: 1600 }
                }
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 2
                    Text {
                        text: page.outdatedIds.length + (page.outdatedIds.length > 1 ? " anúncios desatualizados" : " anúncio desatualizado")
                        color: Theme.amberInk; font.family: Theme.displayFont; font.pixelSize: 18; font.weight: Font.Bold
                    }
                    T {
                        Layout.fillWidth: true
                        size: 13
                        color: Theme.amberInk
                        text: "Produtos mudaram no PDV ou na biblioteca: " + page.outdatedIds.map(id => page.outdated[id].projectName).join(", ")
                              + ". Atualize para renderizar de novo e a programação dos canais acompanha."
                    }
                }
                Btn {
                    text: "Atualizar e renderizar " + (page.outdatedIds.length > 1 ? "todos (" + page.outdatedIds.length + ")" : "")
                    variant: "dark"
                    iconName: "refresh"
                    enabled: page.outdatedIds.some(id => !RenderQueue.isQueued(id))
                    onClicked: page.updateAndRender(page.outdatedIds)
                }
            }
        }

        Segmented {
            options: [{ value: "all", label: "Todos" }, { value: "outdated", label: "Desatualizados" + (page.outdatedIds.length ? " · " + page.outdatedIds.length : "") },
                      { value: "live", label: "No ar" }, { value: "scheduled", label: "Agendados" },
                      { value: "neutral", label: "Prontos" }, { value: "draft", label: "Rascunhos" }]
            value: page.filter
            onPicked: (v) => page.filter = v
        }

        GridLayout {
            width: parent.width
            columns: Math.max(1, Math.floor((width + 16) / 300))
            columnSpacing: 16
            rowSpacing: 16

            Repeater {
                model: page.rows
                delegate: Card {
                    id: card
                    required property var modelData
                    required property int index
                    readonly property var drift: page.outdated[modelData.p.id] || null
                    readonly property var job: RenderQueue.jobs.find(j => j.projectId === modelData.p.id && (j.status === "queued" || j.status === "rendering")) || null
                    Layout.fillWidth: true
                    Layout.alignment: Qt.AlignTop
                    Layout.preferredHeight: cardCol.implicitHeight
                    popDelay: Math.min(index, 12) * Motion.stagger
                    lift: true
                    roundClip: true

                    ColumnLayout {
                        id: cardCol
                        width: parent.width
                        spacing: 0
                        Rectangle {
                            Layout.fillWidth: true
                            Layout.preferredHeight: width * 9 / 16
                            color: card.modelData.p.coverBg || "#1A1A1A"
                            Image {
                                anchors.fill: parent
                                anchors.margins: card.modelData.p.thumbnail ? 0 : 18
                                source: card.modelData.p.thumbnail ? Storage.url(card.modelData.p.thumbnail) + "?t=" + card.modelData.p.updatedAt
                                      : (card.modelData.p.coverImage ? Storage.url(card.modelData.p.coverImage) : "")
                                fillMode: card.modelData.p.thumbnail ? Image.PreserveAspectCrop : Image.PreserveAspectFit
                                asynchronous: true
                                sourceSize.width: 640
                                scale: card.hovered ? 1.05 : 1
                                Behavior on scale { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutCubic } }
                            }
                            Pill { kind: card.modelData.st.kind; text: card.modelData.st.label; anchors.left: parent.left; anchors.top: parent.top; anchors.margins: 10 }
                            Rectangle {
                                visible: !!card.drift && !card.job
                                anchors.right: parent.right
                                anchors.top: parent.top
                                anchors.margins: 10
                                height: 24
                                width: odRow.implicitWidth + 18
                                radius: 12
                                color: Theme.accent
                                Row {
                                    id: odRow
                                    anchors.centerIn: parent
                                    spacing: 5
                                    Icon { name: "alert"; size: 12; stroke: 2.4; color: Theme.accentInk; anchors.verticalCenter: parent.verticalCenter }
                                    Text { text: "Desatualizado"; color: Theme.accentInk; font.family: Theme.bodyFont; font.pixelSize: 12; font.weight: Font.Bold }
                                }
                                SequentialAnimation on scale {
                                    loops: Animation.Infinite
                                    NumberAnimation { to: 1.08; duration: 700; easing.type: Easing.InOutSine }
                                    NumberAnimation { to: 1; duration: 700; easing.type: Easing.InOutSine }
                                }
                            }
                            // Queue status overlay
                            Rectangle {
                                visible: !!card.job
                                anchors.fill: parent
                                color: Theme.alpha("#000000", 0.55)
                                Column {
                                    anchors.centerIn: parent
                                    spacing: 8
                                    BusyDot { anchors.horizontalCenter: parent.horizontalCenter; color: "#FFFFFF"; visible: !!card.job && card.job.status === "rendering" }
                                    Text {
                                        anchors.horizontalCenter: parent.horizontalCenter
                                        text: !card.job ? "" : card.job.status === "rendering" ? "Renderizando " + Math.round(Renderer.progress * 100) + "%" : "Na fila"
                                        color: "#FFFFFF"; font.family: Theme.bodyFont; font.pixelSize: 14; font.weight: Font.Bold
                                    }
                                    Rectangle {
                                        visible: !!card.job && card.job.status === "rendering"
                                        width: 140; height: 5; radius: 3
                                        color: Theme.alpha("#FFFFFF", 0.3)
                                        Rectangle { width: parent.width * Renderer.progress; height: parent.height; radius: 3; color: Theme.accent }
                                    }
                                }
                            }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            Layout.margins: 14
                            spacing: 4
                            RowLayout {
                                Layout.fillWidth: true
                                H { level: 4; text: card.modelData.p.name; elide: Text.ElideRight; wrapMode: Text.NoWrap; Layout.fillWidth: true }
                                IconBtn { iconName: "more"; label: "Opções"; bordered: false; box: 30; onClicked: { page.target = card.modelData.p; menu.popup() } }
                            }
                            T { tone: "muted"; size: 13; text: card.modelData.p.sceneCount + " cenas · " + Fmt.seconds(card.modelData.p.durationFrames, card.modelData.p.fps) + " · editado " + Fmt.relative(card.modelData.p.updatedAt) }
                            Flow {
                                Layout.fillWidth: true
                                Layout.topMargin: 6
                                spacing: 6
                                Repeater { model: card.modelData.st.formats; delegate: Chip { required property string modelData; text: Fmt.formats[modelData] ? Fmt.formats[modelData].short : modelData } }
                                Repeater { model: card.modelData.st.channels; delegate: Chip { required property string modelData; text: "📺 " + modelData } }
                            }
                            // What changed + per-ad action
                            Rectangle {
                                visible: !!card.drift
                                Layout.fillWidth: true
                                Layout.topMargin: 8
                                Layout.preferredHeight: driftCol.implicitHeight + 20
                                radius: 12
                                color: Theme.amberSoft
                                border.color: Theme.amberLine
                                ColumnLayout {
                                    id: driftCol
                                    anchors.fill: parent
                                    anchors.margins: 10
                                    spacing: 8
                                    T {
                                        Layout.fillWidth: true
                                        size: 12
                                        color: Theme.amberInk
                                        text: card.drift ? card.drift.scenes.map(s => s.name + " (" + s.changed.join(", ") + ")").join(" · ") : ""
                                    }
                                    Btn {
                                        Layout.fillWidth: true
                                        small: true
                                        variant: "dark"
                                        iconName: "refresh"
                                        text: card.job ? "Na fila…" : "Atualizar e renderizar"
                                        enabled: !card.job
                                        onClicked: page.updateAndRender([card.modelData.p.id])
                                    }
                                }
                            }
                        }
                    }
                    MouseArea {
                        anchors.fill: parent
                        anchors.bottomMargin: cardCol.implicitHeight - (card.width * 9 / 16)
                        cursorShape: Qt.PointingHandCursor
                        onClicked: if (Doc.open(card.modelData.p.id)) Nav.go("editor")
                    }
                }
            }
        }

        EmptyState {
            visible: page.rows.length === 0
            width: parent.width
            iconName: "megaphone"
            title: Projects.items.length ? "Nada neste filtro" : "Nenhum anúncio salvo"
            text: Projects.items.length ? "Troque o filtro ou a busca." : "Crie um anúncio e salve pelo editor para que ele apareça aqui."
            Btn { visible: !Projects.items.length; text: "Criar anúncio"; variant: "primary"; iconName: "plus"; onClicked: Nav.go("wizard") }
        }
    }

    Menu {
        id: menu
        MenuItem { text: "Abrir no editor"; onTriggered: if (Doc.open(page.target.id)) Nav.go("editor") }
        MenuItem { text: "Renomear"; onTriggered: { renameBox.text = page.target.name; renameDlg.open() } }
        MenuItem { text: "Duplicar"; onTriggered: { Projects.duplicate(page.target.id); Toasts.success("Anúncio duplicado.") } }
        MenuSeparator {}
        MenuItem { text: "Excluir"; onTriggered: deleteDlg.open() }
    }

    AppDialog {
        id: renameDlg
        title: "Renomear anúncio"
        Field { Layout.fillWidth: true; label: "Novo nome"; TextBox { id: renameBox; onAccepted: renameOk.clicked() } }
        actions: [
            Btn { text: "Cancelar"; onClicked: renameDlg.close() },
            Btn { id: renameOk; text: "Salvar"; variant: "primary"; enabled: renameBox.text.trim() !== ""; onClicked: { Projects.rename(page.target.id, renameBox.text); renameDlg.close(); Toasts.success("Anúncio renomeado.") } }
        ]
    }

    AppDialog {
        id: deleteDlg
        title: "Excluir anúncio?"
        subtitle: page.target ? "\"" + page.target.name + "\" será removido. Os vídeos já renderizados continuam em Vídeos prontos." : ""
        actions: [
            Btn { text: "Cancelar"; onClicked: deleteDlg.close() },
            Btn { text: "Excluir"; variant: "danger"; iconName: "trash"; onClicked: { Projects.remove(page.target.id); deleteDlg.close(); Toasts.info("Anúncio removido.") } }
        ]
    }
}
