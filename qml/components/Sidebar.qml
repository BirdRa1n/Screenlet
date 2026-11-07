import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Screenlet

// Proposal B sidebar: active store, "Novo anúncio", Anúncios / Exibição.
// `compact` collapses it to an icon rail (used by the editor).
Rectangle {
    id: root
    property bool compact: false
    signal newAd()

    width: compact ? 72 : 248
    color: Theme.surface
    Behavior on width { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 0.8 } }

    Rectangle { anchors.right: parent.right; width: 1; height: parent.height; color: Theme.border }

    readonly property int alertCount: 0
    readonly property var profile: StoreProfiles.active

    component NavItem: Rectangle {
        id: item
        property string page
        property string iconName
        property string label
        property string badge: ""
        property bool badgeAlert: false
        readonly property bool active: Nav.page === page || (page === "anuncios" && (Nav.page === "editor"))
                                       || (page === "templates" && (Nav.page === "templateWizard" || Nav.page === "templateBuilder"))
                                       || (page === "canais" && Nav.page === "studio")
        Layout.fillWidth: true
        height: 40
        radius: 11
        color: active ? Theme.inverse : (ma.containsMouse ? Theme.hover : "transparent")
        Behavior on color { ColorAnimation { duration: Motion.fast } }

        Icon {
            id: ico
            name: item.iconName
            size: 18
            color: item.active ? Theme.accent : Theme.text2
            x: root.compact ? (item.width - width) / 2 : 12
            anchors.verticalCenter: parent.verticalCenter
            rotation: ma.containsMouse && !item.active ? -6 : 0
            scale: ma.containsMouse && !item.active ? 1.15 : 1
            Behavior on rotation { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 2.5 } }
            Behavior on scale { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 2.5 } }
        }
        Text {
            visible: !root.compact
            anchors.left: ico.right
            anchors.leftMargin: 10
            anchors.right: badgeBox.left
            anchors.verticalCenter: parent.verticalCenter
            text: item.label
            elide: Text.ElideRight
            color: item.active ? Theme.inverseInk : Theme.text2
            font.family: Theme.bodyFont
            font.pixelSize: 14
            font.weight: item.active ? Font.DemiBold : Font.Normal
        }
        Rectangle {
            id: badgeBox
            visible: item.badge !== "" && !root.compact
            anchors.right: parent.right
            anchors.rightMargin: 10
            anchors.verticalCenter: parent.verticalCenter
            height: 20
            width: Math.max(20, bt.implicitWidth + 10)
            radius: 10
            color: item.badgeAlert ? Theme.red : "transparent"
            Text {
                id: bt
                anchors.centerIn: parent
                text: item.badge
                color: item.badgeAlert ? "#FFFFFF" : (item.active ? Theme.inverseInk : Theme.muted)
                font.family: Theme.bodyFont
                font.pixelSize: 12
                font.weight: Font.Bold
            }
        }
        MouseArea {
            id: ma
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: Nav.go(item.page)
        }
        ToolTip.visible: root.compact && ma.containsMouse
        ToolTip.text: item.label
        Accessible.role: Accessible.Link
        Accessible.name: item.label
    }

    component Group: Text {
        visible: !root.compact
        Layout.leftMargin: 10
        Layout.topMargin: 8
        Layout.bottomMargin: 2
        color: Theme.faint
        font.family: Theme.bodyFont
        font.pixelSize: 11
        font.weight: Font.Bold
        font.letterSpacing: 1
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 14
        anchors.topMargin: 28  // brand lines up with the page title
        spacing: 2

        // Brand
        RowLayout {
            Layout.fillWidth: true
            Layout.bottomMargin: 12
            spacing: 10
            Rectangle {
                width: 36
                height: 36
                radius: 11
                color: Theme.accent
                Layout.alignment: root.compact ? Qt.AlignHCenter : Qt.AlignLeft
                Icon { anchors.centerIn: parent; name: "tag"; size: 19; stroke: 2.2; color: Theme.accentInk }
                // A few wiggles, then idle: a looping animation would redraw
                // the whole window at every vsync forever.
                SequentialAnimation on rotation {
                    running: !Motion.reduced
                    loops: 3
                    PauseAnimation { duration: 3600 }
                    NumberAnimation { to: -6; duration: 110 }
                    NumberAnimation { to: 5; duration: 110 }
                    NumberAnimation { to: -3; duration: 110 }
                    NumberAnimation { to: 0; duration: 160; easing.type: Easing.OutBack }
                }
            }
            Text {
                visible: !root.compact
                text: "Screenlet"
                color: Theme.ink
                font.family: Theme.displayFont
                font.pixelSize: 20
                font.weight: Font.ExtraBold
                font.letterSpacing: -0.4
                Layout.fillWidth: true
            }
        }

        // Active store
        Rectangle {
            visible: !root.compact
            Layout.fillWidth: true
            Layout.bottomMargin: 10
            height: 52
            radius: 14
            color: Theme.surfaceAlt
            border.color: Theme.border
            RowLayout {
                anchors.fill: parent
                anchors.margins: 8
                spacing: 10
                Rectangle {
                    width: 34
                    height: 34
                    radius: 10
                    color: root.profile && root.profile.brandColor ? root.profile.brandColor : "#0B5E1F"
                    clip: true
                    Image {
                        anchors.fill: parent
                        anchors.margins: 3
                        visible: !!(root.profile && root.profile.logoPath)
                        source: visible ? Storage.url(root.profile.logoPath) : ""
                        fillMode: Image.PreserveAspectFit
                        sourceSize.width: 80
                    }
                    Text {
                        anchors.centerIn: parent
                        visible: !(root.profile && root.profile.logoPath)
                        text: root.profile && root.profile.name ? root.profile.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "SL"
                        color: "#FFFFFF"
                        font.pixelSize: 13
                        font.bold: true
                    }
                }
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 0
                    T { text: root.profile && root.profile.name ? root.profile.name : "Minha loja"; bold: true; elide: Text.ElideRight; wrapMode: Text.NoWrap; Layout.fillWidth: true }
                    T { text: StoreProfiles.items.length > 1 ? StoreProfiles.items.length + " lojas" : "Perfil da loja"; tone: "muted"; size: 12 }
                }
                Icon { name: "updown"; size: 16; color: Theme.muted }
            }
            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: storeMenu.popup()
            }
            Menu {
                id: storeMenu
                Repeater {
                    model: StoreProfiles.items
                    delegate: MenuItem {
                        required property var modelData
                        text: modelData.name
                        onTriggered: StoreProfiles.setActive(modelData.id)
                    }
                }
                MenuSeparator {}
                MenuItem { text: "Gerenciar lojas…"; onTriggered: Nav.go("configuracoes", { section: "lojas" }) }
            }
        }

        // Primary action
        Rectangle {
            id: cta
            Layout.fillWidth: true
            Layout.bottomMargin: 10
            height: 46
            radius: 14
            color: Theme.accent
            scale: ctaMa.pressed ? 0.97 : (ctaMa.containsMouse ? 1.03 : 1)
            Behavior on scale { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack; easing.overshoot: 2 } }
            Row {
                anchors.centerIn: parent
                spacing: 8
                Icon { name: "plus"; size: 18; stroke: 2.6; color: Theme.accentInk; anchors.verticalCenter: parent.verticalCenter }
                Text {
                    visible: !root.compact
                    text: "Novo anúncio"
                    color: Theme.accentInk
                    font.family: Theme.bodyFont
                    font.pixelSize: 15
                    font.weight: Font.Bold
                    anchors.verticalCenter: parent.verticalCenter
                }
            }
            MouseArea { id: ctaMa; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.newAd() }
            Accessible.role: Accessible.Button
            Accessible.name: "Novo anúncio"
        }

        Group { text: "ANÚNCIOS" }
        NavItem { page: "painel"; iconName: "grid"; label: "Painel" }
        NavItem { page: "anuncios"; iconName: "megaphone"; label: "Meus anúncios"; badge: Projects.items.length ? String(Projects.items.length) : "" }
        NavItem { page: "templates"; iconName: "layout"; label: "Templates" }
        NavItem { page: "produtos"; iconName: "box"; label: "Produtos e preços" }
        NavItem { page: "midia"; iconName: "image"; label: "Mídia" }
        NavItem { page: "videos"; iconName: "film"; label: "Vídeos prontos" }

        Group { text: "EXIBIÇÃO" }
        NavItem { page: "canais"; iconName: "tv"; label: "Canais e grade" }
        NavItem {
            page: "telas"
            iconName: "monitor"
            label: "Telas"
            readonly property int online: Players.items.filter(p => p.paired && p.lastSeenAt && (Date.now() - new Date(p.lastSeenAt).getTime()) < 120000).length
            readonly property int total: Players.items.filter(p => p.paired).length + Kodi.items.length
            badge: total > 0 ? online + "/" + total : ""
        }
        NavItem { page: "iptv"; iconName: "radio"; label: "Servidor IPTV"; badge: Iptv.running ? "●" : "" }

        Item { Layout.fillHeight: true }

        Rectangle {
            visible: !root.compact && Renderer.busy
            Layout.fillWidth: true
            Layout.bottomMargin: 8
            height: 58
            radius: 14
            color: Theme.sunken
            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 12
                spacing: 6
                RowLayout {
                    T { text: "Renderizando"; bold: true; size: 12; Layout.fillWidth: true }
                    T { text: Math.round(Renderer.progress * 100) + "%"; tone: "muted"; size: 12 }
                }
                Rectangle {
                    Layout.fillWidth: true
                    height: 6
                    radius: 3
                    color: Theme.border
                    Rectangle {
                        width: parent.width * Renderer.progress
                        height: parent.height
                        radius: 3
                        color: Theme.inverse
                        Behavior on width { NumberAnimation { duration: Motion.base } }
                    }
                }
            }
        }

        NavItem { page: "configuracoes"; iconName: "settings"; label: "Configurações"; badge: Updater.updateAvailable ? "1" : ""; badgeAlert: true }
    }
}
