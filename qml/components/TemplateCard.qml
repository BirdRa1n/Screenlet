import QtQuick
import QtQuick.Layouts
import Screenlet
import "../scene/SceneMath.js" as SM

// Template card with a live preview that plays on hover.
Card {
    id: root
    property var template: ({})
    property bool compact: false
    signal activated()
    default property alias actions: actionRow.data

    lift: true
    roundClip: true
    implicitHeight: col.implicitHeight

    readonly property int total: SM.templateFrames(template)
    readonly property var previewConfig: ({
        fps: template.fps || 30, width: template.width || 1920, height: template.height || 1080, logoImage: "",
        scenes: [{ type: "template", id: "preview", templateId: template.id, values: {}, durationInFrames: Math.max(1, total) }]
    })

    ColumnLayout {
        id: col
        width: parent.width
        spacing: 0

        Item {
            Layout.fillWidth: true
            Layout.preferredHeight: width * 9 / 16
            clip: true
            AdPlayer {
                id: player
                anchors.fill: parent
                config: root.previewConfig
                playing: root.hovered
                frame: Math.min((root.template.scenes && root.template.scenes.length ? root.template.scenes[0].durationInFrames : 0) + 30, Math.max(0, root.total - 1))
            }
            Rectangle {
                visible: !!root.template.builtin
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.margins: 10
                height: 22
                width: oft.implicitWidth + 16
                radius: 11
                color: Theme.accent
                Text { id: oft; anchors.centerIn: parent; text: "Oficial"; color: Theme.accentInk; font.family: Theme.bodyFont; font.pixelSize: 11; font.weight: Font.Bold }
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.margins: 14
            spacing: 4
            H { level: 4; text: root.template.name || ""; Layout.fillWidth: true; elide: Text.ElideRight; wrapMode: Text.NoWrap }
            T { visible: !root.compact; tone: "muted"; size: 13; text: root.template.description || ""; Layout.fillWidth: true; maximumLineCount: 2; elide: Text.ElideRight }
            RowLayout {
                Layout.topMargin: 6
                spacing: 6
                Repeater {
                    model: (root.template.tags || []).slice(0, 3)
                    delegate: Chip { required property string modelData; text: modelData }
                }
                Item { Layout.fillWidth: true }
                T { tone: "muted"; size: 12; text: Fmt.seconds(root.total, root.template.fps) }
            }
            Row { id: actionRow; spacing: 6; Layout.topMargin: actionRow.children.length ? 8 : 0 }
        }
    }

    MouseArea {
        anchors.fill: parent
        anchors.bottomMargin: actionRow.children.length ? actionRow.height + 22 : 0
        cursorShape: Qt.PointingHandCursor
        onClicked: root.activated()
    }
}
