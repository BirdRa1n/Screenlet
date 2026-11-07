import QtQuick
import Screenlet

// Tiny visual of a scene for lists (no live render: cheap and instant).
Rectangle {
    id: root
    property var scene
    property string logoImage: ""
    radius: 7
    clip: true
    color: !scene ? "#222" : scene.type === "product" || scene.type === "logo" ? (scene.bg || "#1A1A1A")
          : scene.type === "video" ? "#000" : Theme.blueSoft

    Image {
        anchors.fill: parent
        anchors.margins: 3
        visible: !!root.scene && root.scene.type === "product" && !!root.scene.image
        source: visible ? Storage.url(root.scene.image) : ""
        fillMode: Image.PreserveAspectFit
        sourceSize.width: 120
        asynchronous: true
    }
    Image {
        anchors.fill: parent
        anchors.margins: 4
        visible: !!root.scene && root.scene.type === "logo" && root.logoImage !== ""
        source: visible ? Storage.url(root.logoImage) : ""
        fillMode: Image.PreserveAspectFit
        sourceSize.width: 120
        asynchronous: true
    }
    Text {
        anchors.centerIn: parent
        visible: !!root.scene && root.scene.type === "logo" && root.logoImage === ""
        text: "LOGO"
        color: "#FFFFFF"
        font.pixelSize: 9
        font.weight: Font.ExtraBold
    }
    Icon {
        anchors.centerIn: parent
        visible: !!root.scene && (root.scene.type === "template" || root.scene.type === "video")
        name: root.scene && root.scene.type === "video" ? "video" : "layout"
        size: 16
        color: root.scene && root.scene.type === "video" ? "#FFFFFF" : Theme.blue
    }
}
