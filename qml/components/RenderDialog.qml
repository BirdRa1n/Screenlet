import QtQuick
import QtQuick.Layouts
import Screenlet

// "Renderizar" flow shared by the editor and both wizards: file name, format
// and FPS. The render itself goes to RenderQueue, so the user can watch it
// here or send it to the background (the queue dock keeps showing it) and keep
// working — and line up more renders while one is running.
AppDialog {
    id: root
    property var config: null
    property string projectId: ""
    property string defaultName: "anuncio"
    property string format: "tv"
    property bool allowFormat: true
    property int fps: 30
    property int uid: -1                     // job this dialog started
    // Emitted when the render the user waited for here completes.
    signal finished(var result)
    // Emitted when the job was left to the queue (background, or queued
    // behind another render) — the caller should move on.
    signal sentToBackground()

    readonly property var job: uid >= 0 ? RenderQueue.jobs.find(j => j.uid === uid) || null : null
    readonly property bool rendering: !!job && job.status === "rendering"
    readonly property bool waiting: !!job && job.status === "queued"
    readonly property bool tracking: rendering || waiting
    readonly property bool othersBusy: !tracking && RenderQueue.active

    title: rendering ? "Renderizando…" : waiting ? "Na fila" : "Renderizar vídeo"
    subtitle: tracking ? job.filename
                       : "O arquivo é salvo em Vídeos prontos. Se já existir, será substituído e os canais que o usam são atualizados."
    dialogWidth: 560
    closePolicy: tracking ? AppDialog.NoAutoClose : (AppDialog.CloseOnEscape | AppDialog.CloseOnPressOutside)

    function start(cfg, name, pid, fmt) {
        config = cfg
        defaultName = name || "anuncio"
        projectId = pid || ""
        if (fmt) format = fmt
        nameBox.text = ""
        // Re-opened while this dialog's own render is still going: show it.
        if (!tracking) uid = -1
        open()
    }

    function run() {
        const f = Fmt.formats[format]
        const queuedBehind = RenderQueue.active
        uid = RenderQueue.add({
            config: Object.assign({}, config, { width: f.width, height: f.height }),
            filename: nameBox.text.trim() || defaultName,
            name: defaultName, fps: fps, format: format, projectId: projectId
        })
        if (queuedBehind) {
            Toasts.info("\"" + RenderQueue.job(uid).filename + "\" entrou na fila de renderização.")
            moveToBackground()
        }
    }

    function moveToBackground() {
        root.close()
        root.sentToBackground()
    }

    Connections {
        target: RenderQueue
        function onJobFinished(doneUid, r) {
            if (doneUid !== root.uid) return
            root.uid = -1
            if (!root.opened) return
            root.close()
            if (r.ok) root.finished(r)
        }
    }

    ColumnLayout {
        Layout.fillWidth: true
        spacing: 14
        visible: !root.tracking

        Field {
            Layout.fillWidth: true
            label: "Nome do arquivo (.mp4)"
            hint: "Em branco usa \"" + root.defaultName + ".mp4\"."
            TextBox { id: nameBox; placeholderText: root.defaultName; onAccepted: root.run() }
        }

        Field {
            Layout.fillWidth: true
            label: "Formato"
            visible: root.allowFormat
            Segmented {
                width: parent.width
                stretch: true
                options: [{ value: "tv", label: "TV 16:9" }, { value: "instagram", label: "Instagram 1:1" },
                          { value: "stories", label: "Stories 9:16" }, { value: "tiktok", label: "TikTok 9:16" }]
                value: root.format
                onPicked: (v) => root.format = v
            }
        }

        Field {
            Layout.fillWidth: true
            label: "Taxa de quadros"
            Segmented {
                width: parent.width
                stretch: true
                options: [{ value: 30, label: "30 fps · recomendado" }, { value: 60, label: "60 fps · mais fluido" }]
                value: root.fps
                onPicked: (v) => root.fps = v
            }
        }
    }

    ColumnLayout {
        Layout.fillWidth: true
        visible: root.tracking
        spacing: 10
        RowLayout {
            T {
                Layout.fillWidth: true
                bold: true
                text: root.waiting ? "Aguardando " + RenderQueue.positionOf(root.uid) + " renderização(ões) antes desta"
                      : Renderer.phase === "finalizing" ? "Finalizando o arquivo…" : Renderer.phase === "audio" ? "Preparando o áudio…" : "Gerando quadros"
            }
            T { visible: root.rendering; text: Math.round(Renderer.progress * 100) + "%"; tone: "muted" }
        }
        Rectangle {
            Layout.fillWidth: true
            height: 10
            radius: 5
            color: Theme.sunken
            Rectangle {
                // No width Behavior: progress changes every frame, and the
                // restarted animation left the bar far behind the percentage.
                width: parent.width * (root.rendering ? Renderer.progress : 0)
                height: parent.height
                radius: 5
                color: Theme.accent
            }
        }
        T { tone: "muted"; size: 12; text: "Você pode continuar usando o app: a renderização segue na fila, no canto da tela." }
        T { tone: "muted"; size: 12; text: Settings.videoCodec.toUpperCase() + " · qualidade " + ({ high: "alta", medium: "média", low: "baixa" })[Settings.videoQuality] + " · " + root.fps + " fps"
                                    + (root.rendering && Renderer.encoderName ? " · " + Renderer.encoderName : "") }
    }

    actions: [
        Btn {
            text: root.tracking ? "Cancelar renderização" : "Cancelar"
            variant: root.tracking ? "danger" : "secondary"
            onClicked: root.tracking ? RenderQueue.cancelJob(root.uid) : root.close()
        },
        Btn { visible: root.tracking; text: "Continuar em segundo plano"; variant: "primary"; iconName: "chevronDown"; onClicked: root.moveToBackground() },
        Btn { visible: !root.tracking; text: root.othersBusy ? "Adicionar à fila" : "Renderizar"; variant: "primary"; iconName: root.othersBusy ? "plus" : "play"; onClicked: root.run() }
    ]
}
