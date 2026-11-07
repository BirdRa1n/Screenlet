import QtQuick
import QtQuick.Layouts
import Screenlet

// Floating render-queue panel (any page). Springs in when jobs arrive,
// collapses to a pill, and offers to dismiss once everything finished.
Rectangle {
    id: root
    property bool collapsed: false
    readonly property var jobs: RenderQueue.jobs
    readonly property int total: jobs.length

    visible: opacity > 0
    opacity: total > 0 ? 1 : 0
    width: collapsed ? pill.implicitWidth + 28 : 360
    height: collapsed ? 48 : Math.min(360, col.implicitHeight + 28)
    radius: collapsed ? 24 : Theme.radiusXL
    color: Theme.inverse
    Behavior on opacity { NumberAnimation { duration: Motion.base } }
    Behavior on width { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 1.2 } }
    Behavior on height { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 1.2 } }
    transform: Translate { y: root.total > 0 ? 0 : 40; Behavior on y { NumberAnimation { duration: Motion.pop; easing.type: Easing.OutBack } } }

    readonly property color ink: Theme.inverseInk
    readonly property color sub: Theme.dark ? "#5B6170" : "#B9BDC8"

    // Collapsed pill
    Row {
        id: pill
        visible: root.collapsed
        anchors.centerIn: parent
        spacing: 10
        BusyDot { visible: RenderQueue.active; color: Theme.accent; anchors.verticalCenter: parent.verticalCenter }
        Text {
            anchors.verticalCenter: parent.verticalCenter
            text: RenderQueue.active ? "Fila: " + RenderQueue.doneCount + " de " + root.total + " · " + Math.round(Renderer.progress * 100) + "%" : "Fila concluída"
            color: root.ink; font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold
        }
    }
    MouseArea { visible: root.collapsed; anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.collapsed = false }

    ColumnLayout {
        id: col
        visible: !root.collapsed
        anchors.fill: parent
        anchors.margins: 14
        spacing: 10

        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            Icon { name: "film"; size: 18; color: Theme.accent }
            Text {
                Layout.fillWidth: true
                text: RenderQueue.active ? "Renderizando " + (RenderQueue.doneCount + 1) + " de " + root.total : "Fila concluída"
                color: root.ink; font.family: Theme.displayFont; font.pixelSize: 16; font.weight: Font.Bold
            }
            IconBtn { iconName: "chevronDown"; label: "Recolher"; bordered: false; box: 28; iconColor: root.sub; onClicked: root.collapsed = true }
            IconBtn {
                iconName: "x"
                label: RenderQueue.active ? "Cancelar fila" : "Fechar"
                bordered: false
                box: 28
                iconColor: root.sub
                onClicked: RenderQueue.active ? RenderQueue.cancel() : RenderQueue.clearFinished()
            }
        }

        Rectangle {
            visible: RenderQueue.active
            Layout.fillWidth: true
            height: 6
            radius: 3
            color: Theme.alpha("#FFFFFF", 0.15)
            Rectangle {
                width: parent.width * ((RenderQueue.doneCount + Renderer.progress) / Math.max(1, root.total))
                height: parent.height
                radius: 3
                color: Theme.accent
            }
        }

        ListView {
            Layout.fillWidth: true
            Layout.preferredHeight: Math.min(contentHeight, 220)
            clip: true
            spacing: 6
            model: root.jobs
            delegate: RowLayout {
                required property var modelData
                width: ListView.view.width
                spacing: 10
                Item {
                    Layout.preferredWidth: 18
                    Layout.preferredHeight: 18
                    BusyDot { anchors.centerIn: parent; visible: modelData.status === "rendering"; color: Theme.accent }
                    Icon {
                        anchors.centerIn: parent
                        visible: modelData.status !== "rendering"
                        size: 15
                        stroke: 2.6
                        name: modelData.status === "done" ? "check" : modelData.status === "error" ? "x" : "clock"
                        color: modelData.status === "done" ? Theme.green : modelData.status === "error" ? Theme.red : root.sub
                    }
                }
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 0
                    Text { Layout.fillWidth: true; text: modelData.name; elide: Text.ElideRight; color: root.ink; font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold }
                    Text {
                        Layout.fillWidth: true
                        elide: Text.ElideRight
                        text: modelData.status === "error" ? modelData.error
                              : modelData.filename + " · " + (Fmt.formats[modelData.format] ? Fmt.formats[modelData.format].short : modelData.format)
                              + (modelData.status === "rendering" ? " · " + Math.round(Renderer.progress * 100) + "%" : "")
                        color: modelData.status === "error" ? "#FF8A78" : root.sub
                        font.family: Theme.bodyFont; font.pixelSize: 11
                    }
                }
                IconBtn {
                    visible: modelData.status === "queued" || modelData.status === "rendering"
                    iconName: "x"
                    label: modelData.status === "rendering" ? "Cancelar esta renderização" : "Tirar da fila"
                    bordered: false
                    box: 24
                    iconColor: root.sub
                    onClicked: RenderQueue.cancelJob(modelData.uid)
                }
            }
        }
    }
}
