import QtQuick
import QtMultimedia
import Screenlet

// Video clip synced to the ad timeline.
//   preview: plays along while `playing`, re-seeks when it drifts > 250 ms;
//   export:  seeks to the exact frame time and reports ready once the
//            decoder delivered that frame. Audio is mixed separately by the
//            exporter (AudioMix), so the player stays silent there.
Item {
    id: root
    property string src: ""
    property real volume: 1
    property real f: 0
    property int fps: 30
    property bool exportMode: false
    property bool playing: false
    property bool ready: src === ""

    readonly property int targetMs: Math.max(0, Math.round(f / fps * 1000))
    readonly property bool loaded: player.mediaStatus !== MediaPlayer.NoMedia && player.mediaStatus !== MediaPlayer.LoadingMedia
                                   && player.mediaStatus !== MediaPlayer.InvalidMedia
    // No new frame will ever come for these: don't make the exporter wait.
    readonly property bool nothingToWaitFor: player.mediaStatus === MediaPlayer.InvalidMedia || player.error !== MediaPlayer.NoError
                                             || (loaded && (!player.hasVideo || (player.duration > 0 && targetMs >= player.duration - 40)))

    Rectangle {
        anchors.fill: parent
        color: "#000"
    }

    MediaPlayer {
        id: player
        source: root.src ? Storage.url(root.src) : ""
        videoOutput: output
        audioOutput: root.exportMode ? null : audio
        onMediaStatusChanged: {
            if (mediaStatus === MediaPlayer.LoadedMedia) {
                player.setPosition(root.targetMs)
                if (root.playing && !root.exportMode) player.play()
                else player.pause()
            }
            if (root.exportMode && root.nothingToWaitFor) root.ready = true
        }
        onErrorOccurred: if (root.exportMode) root.ready = true
    }

    AudioOutput {
        id: audio
        volume: root.volume
    }

    VideoOutput {
        id: output
        anchors.fill: parent
        fillMode: VideoOutput.PreserveAspectCrop
    }

    Connections {
        target: output.videoSink
        function onVideoFrameChanged() {
            if (root.exportMode)
                root.ready = true
        }
    }

    // Last resort so a stubborn decoder can never stall an export.
    Timer {
        id: guard
        interval: 1500
        onTriggered: if (root.exportMode) root.ready = true
    }

    onTargetMsChanged: {
        if (exportMode) {
            if (!src) return
            if (nothingToWaitFor || (loaded && Math.abs(player.position - targetMs) < 2)) {
                ready = true
                return
            }
            ready = false
            guard.restart()
            player.setPosition(targetMs)
            return
        }
        if (Math.abs(player.position - targetMs) > 250)
            player.setPosition(targetMs)
    }

    onPlayingChanged: {
        if (exportMode) return
        if (playing) player.play()
        else {
            player.pause()
            player.setPosition(targetMs)
        }
    }

    Component.onCompleted: if (exportMode && src) guard.restart()
}
