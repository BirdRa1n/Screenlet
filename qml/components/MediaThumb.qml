import QtQuick
import QtMultimedia
import Screenlet

// Thumbnail of a stored media path (image, or first frame of a video).
Rectangle {
    id: root
    property string path: ""
    property string type: path.match(/\.(mp4|webm|mov|mkv)$/i) ? "video" : "image"
    property int fit: Image.PreserveAspectFit
    color: Theme.sunken
    radius: 10
    clip: true

    Image {
        anchors.fill: parent
        anchors.margins: root.fit === Image.PreserveAspectFit ? 6 : 0
        visible: root.type === "image" && root.path !== ""
        source: visible ? Storage.url(root.path) : ""
        fillMode: root.fit
        asynchronous: true
        sourceSize.width: 480
        smooth: true
    }

    Loader {
        anchors.fill: parent
        active: root.type === "video" && root.path !== "" && root.visible
        sourceComponent: Item {
            MediaPlayer {
                id: mp
                source: Storage.url(root.path)
                videoOutput: vo
                onMediaStatusChanged: if (mediaStatus === MediaPlayer.LoadedMedia) { mp.setPosition(800); mp.pause() }
            }
            VideoOutput { id: vo; anchors.fill: parent; fillMode: VideoOutput.PreserveAspectCrop }
            Component.onCompleted: mp.play()
        }
    }

    Rectangle {
        visible: root.type === "video"
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: 6
        width: 24
        height: 24
        radius: 12
        color: Theme.alpha("#000000", 0.6)
        Icon { anchors.centerIn: parent; name: "play"; size: 11; color: "#fff"; filled: true }
    }

    Icon {
        visible: root.path === ""
        anchors.centerIn: parent
        name: "image"
        size: 22
        color: Theme.faint
    }
}
