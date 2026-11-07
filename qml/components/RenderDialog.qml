import QtQuick
import QtQuick.Layouts
import Screenlet

// "Renderizar" flow shared by the editor and both wizards: file name, format
// and FPS, then progress until the MP4 lands in Vídeos prontos.
AppDialog {
    id: root
    property var config: null
    property string projectId: ""
    property string defaultName: "anuncio"
    property string format: "tv"
    property bool allowFormat: true
    property int fps: 30
    signal finished(var result)

    title: Renderer.busy ? "Renderizando…" : "Renderizar vídeo"
    subtitle: Renderer.busy ? Renderer.currentFile : "O arquivo é salvo em Vídeos prontos. Se já existir, será substituído e os canais que o usam são atualizados."
    dialogWidth: 560
    closePolicy: Renderer.busy ? AppDialog.NoAutoClose : (AppDialog.CloseOnEscape | AppDialog.CloseOnPressOutside)

    function start(cfg, name, pid, fmt) {
        config = cfg
        defaultName = name || "anuncio"
        projectId = pid || ""
        if (fmt) format = fmt
        nameBox.text = ""
        open()
    }

    function run() {
        const f = Fmt.formats[format]
        const payload = Object.assign({}, config, { width: f.width, height: f.height })
        const filename = (nameBox.text.trim() || defaultName)
        Renderer.exportVideo(payload, filename, fps, format, projectId, function (r) {
            if (!r.ok) {
                Toasts.error("Erro ao renderizar: " + r.error)
                return
            }
            Toasts.success("Vídeo \"" + r.filename + "\" pronto!")
            for (const c of r.updatedChannels || [])
                Toasts.info("O canal \"" + c.name + "\" foi atualizado — as telas estão sendo sincronizadas.")
            root.close()
            root.finished(r)
        })
    }

    ColumnLayout {
        Layout.fillWidth: true
        spacing: 14
        visible: !Renderer.busy

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
        visible: Renderer.busy
        spacing: 10
        RowLayout {
            T { text: Renderer.phase === "finalizing" ? "Finalizando o arquivo…" : Renderer.phase === "audio" ? "Preparando o áudio…" : "Gerando quadros"; bold: true; Layout.fillWidth: true }
            T { text: Math.round(Renderer.progress * 100) + "%"; tone: "muted" }
        }
        Rectangle {
            Layout.fillWidth: true
            height: 10
            radius: 5
            color: Theme.sunken
            Rectangle {
                width: parent.width * Renderer.progress
                height: parent.height
                radius: 5
                color: Theme.accent
                Behavior on width { NumberAnimation { duration: Motion.base } }
            }
        }
        T { tone: "muted"; size: 12; text: Settings.videoCodec.toUpperCase() + " · qualidade " + ({ high: "alta", medium: "média", low: "baixa" })[Settings.videoQuality] + " · " + root.fps + " fps"
                                    + (Renderer.busy && Renderer.encoderName ? " · " + Renderer.encoderName : "") }
    }

    actions: [
        Btn { text: Renderer.busy ? "Cancelar renderização" : "Cancelar"; variant: Renderer.busy ? "danger" : "secondary"; onClicked: Renderer.busy ? Renderer.cancel() : root.close() },
        Btn { visible: !Renderer.busy; text: "Renderizar"; variant: "primary"; iconName: "play"; onClicked: root.run() }
    ]
}
