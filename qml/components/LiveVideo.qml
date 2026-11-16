import QtQuick
import QtMultimedia
import Screenlet

// Silent looping video that decorates the UI (Painel "Na tela agora", cards of
// Canais). With Motion.liveVideos off (no dedicated GPU, or turned off in
// Configurações) it shows a still frame instead of playing; flipping the
// setting takes effect at once.
Item {
    id: root
    property alias source: mp.source
    property alias fillMode: vo.fillMode
    readonly property alias player: mp
    readonly property bool live: Motion.liveVideos

    function sync() {
        if (mp.source == "")
            return
        if (live)
            mp.play()
        else if (mp.mediaStatus === MediaPlayer.NoMedia || mp.mediaStatus === MediaPlayer.LoadingMedia)
            mp.play() // decode up to a frame; paused in onMediaStatusChanged
        else
            mp.pause()
    }

    MediaPlayer {
        id: mp
        videoOutput: vo
        loops: MediaPlayer.Infinite
        onSourceChanged: root.sync()
        onMediaStatusChanged: if (!root.live && mediaStatus === MediaPlayer.LoadedMedia) { setPosition(Math.min(800, Math.max(0, duration - 1))); pause() }
    }
    VideoOutput {
        id: vo
        anchors.fill: parent
        fillMode: VideoOutput.PreserveAspectCrop
    }

    onLiveChanged: sync()
    Component.onCompleted: sync()
}
