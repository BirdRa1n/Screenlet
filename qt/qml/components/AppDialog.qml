import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Screenlet

// Modal dialog with a springy entrance. Put body items as children; set
// `footer` buttons through the `actions` list (Row).
Popup {
    id: root
    property string title: ""
    property string subtitle: ""
    property int dialogWidth: 520
    default property alias body: bodyCol.data
    property alias actions: actionRow.data

    parent: Overlay.overlay
    anchors.centerIn: parent
    modal: true
    focus: true
    width: Math.min(dialogWidth, (parent ? parent.width : 800) - 48)
    padding: 0
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    Overlay.modal: Rectangle {
        color: Theme.alpha("#0B0C10", 0.45)
        Behavior on opacity { NumberAnimation { duration: Motion.base } }
    }

    enter: Transition {
        NumberAnimation { property: "opacity"; from: 0; to: 1; duration: Motion.base }
        NumberAnimation { property: "scale"; from: 0.92; to: 1; duration: Motion.pop; easing.type: Easing.OutBack; easing.overshoot: 1.6 }
    }
    exit: Transition {
        NumberAnimation { property: "opacity"; from: 1; to: 0; duration: Motion.fast }
        NumberAnimation { property: "scale"; from: 1; to: 0.96; duration: Motion.fast }
    }

    background: Rectangle {
        radius: Theme.radiusXL
        color: Theme.surface
        border.color: Theme.border
    }

    contentItem: ColumnLayout {
        spacing: 0

        RowLayout {
            Layout.fillWidth: true
            Layout.margins: 20
            Layout.bottomMargin: 8
            spacing: 12
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 4
                H { level: 3; text: root.title; Layout.fillWidth: true }
                T { tone: "muted"; text: root.subtitle; visible: text !== ""; Layout.fillWidth: true }
            }
            IconBtn { iconName: "x"; label: "Fechar"; bordered: false; box: 34; onClicked: root.close(); Layout.alignment: Qt.AlignTop }
        }

        ScrollView {
            id: scroller
            Layout.fillWidth: true
            Layout.preferredHeight: Math.min(bodyCol.implicitHeight + 8, (root.parent ? root.parent.height : 800) - 220)
            contentWidth: availableWidth
            clip: true
            ColumnLayout {
                id: bodyCol
                width: scroller.availableWidth - 40
                x: 20
                spacing: 14
            }
        }

        Rectangle { Layout.fillWidth: true; height: 1; color: Theme.border; visible: actionRow.children.length > 0; Layout.topMargin: 12 }
        RowLayout {
            Layout.fillWidth: true
            Layout.margins: 16
            visible: actionRow.children.length > 0
            Item { Layout.fillWidth: true }
            Row { id: actionRow; spacing: 8 }
        }
    }
}
