import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Screenlet

ApplicationWindow {
    id: win
    width: 1440
    height: 900
    minimumWidth: 1024
    minimumHeight: 680
    visible: !SystemInfo.startedHidden
    title: Nav.page === "editor" && Doc.name ? Doc.name + " — Screenlet" : "Screenlet"
    color: Theme.bg

    font.family: Theme.bodyFont

    // Closing keeps the app (IPTV server, player sync) alive in the tray.
    onClosing: (close) => {
        if (SystemInfo.trayAvailable && !SystemInfo.quitting) {
            close.accepted = false
            win.hide()
        } else {
            Qt.quit()
        }
    }

    Connections {
        target: SystemInfo
        function onShowWindowRequested() {
            win.show()
            win.raise()
            win.requestActivate()
        }
    }

    readonly property var pages: ({
        painel: "pages/Painel.qml",
        anuncios: "pages/Anuncios.qml",
        editor: "pages/Editor.qml",
        wizard: "pages/Wizard.qml",
        templates: "pages/TemplatesPage.qml",
        templateWizard: "pages/TemplateWizard.qml",
        templateBuilder: "pages/TemplateBuilder.qml",
        produtos: "pages/Produtos.qml",
        midia: "pages/Midia.qml",
        videos: "pages/Videos.qml",
        canais: "pages/Canais.qml",
        studio: "pages/Studio.qml",
        telas: "pages/Telas.qml",
        iptv: "pages/IptvPage.qml",
        configuracoes: "pages/Configuracoes.qml"
    })

    RowLayout {
        anchors.fill: parent
        spacing: 0

        Sidebar {
            Layout.fillHeight: true
            Layout.preferredWidth: width
            compact: Nav.page === "editor" || Nav.page === "templateBuilder" || Nav.page === "studio"
            onNewAd: Nav.go("wizard")
        }

        StackView {
            id: stack
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            // As a string: a `url` value here left the first page blank at
            // startup (the page was created but never shown); replace() is fine.
            initialItem: Qt.resolvedUrl(win.pages[Nav.page]).toString()

            replaceEnter: Transition {
                ParallelAnimation {
                    NumberAnimation { property: "opacity"; from: 0; to: 1; duration: Motion.base; easing.type: Easing.OutCubic }
                    NumberAnimation { property: "y"; from: 14; to: 0; duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 1.2 }
                }
            }
            replaceExit: Transition {
                NumberAnimation { property: "opacity"; from: 1; to: 0; duration: Motion.fast }
            }
        }
    }

    Connections {
        target: Nav
        function onNavigated(page, params) {
            stack.replace(null, Qt.resolvedUrl(win.pages[page] || win.pages.painel), { params: params || ({}) })
        }
    }

    Component.onCompleted: {
        if (SystemInfo.env("SCREENLET_TEST_EXPORT")) {
            const t0 = Date.now()
            const cfgPath = SystemInfo.env("SCREENLET_TEST_CONFIG")
            // "/Users/…" on the Mac, "C:/…" or "C:\…" on Windows.
            const cfgUrl = cfgPath.startsWith("/") ? "file://" + cfgPath : "file:///" + cfgPath.replace(/\\/g, "/")
            const cfg = cfgPath ? JSON.parse(SystemInfo.readTextFile(cfgUrl)) : Doc.config
            Renderer.exportVideo(Object.assign({}, cfg, { width: 1920, height: 1080 }), SystemInfo.env("SCREENLET_TEST_EXPORT"), 30, "tv", "", function (r) {
                console.log("TEST_EXPORT", JSON.stringify(r), "ms=" + (Date.now() - t0))
                Qt.quit()
            })
        }
        if (SystemInfo.env("SCREENLET_DEV_IPTV")) Iptv.start()
        // Dev/test hooks (isolated data dirs only).
        if (SystemInfo.env("SCREENLET_TEST_QUEUE")) {
            const ids = Insights.priceDrift().map(d => d.projectId)
            console.log("TEST_QUEUE outdated", JSON.stringify(ids))
            RenderQueue.finished.connect((done, failed) => { console.log("TEST_QUEUE finished done=" + done + " failed=" + failed + " left=" + JSON.stringify(Insights.priceDrift().map(d => d.projectId))); Qt.quit() })
            console.log("TEST_QUEUE enqueue", JSON.stringify(RenderQueue.enqueue(ids)))
        }
        if (SystemInfo.env("SCREENLET_TEST_BACKUP")) {
            const mode = SystemInfo.env("SCREENLET_TEST_BACKUP")
            if (mode === "create") {
                StockEasy.setApiKey("sk_test_chave_secreta_123")
                console.log("TEST_BACKUP needsPassword(settings)", Backup.needsPassword(["settings"]), "needsPassword(projects)", Backup.needsPassword(["projects"]))
                Backup.create(["settings"], "", function (r) { console.log("TEST_BACKUP no-password", JSON.stringify(r)) })
                Backup.create(["settings", "projects"], "senha-de-teste-123", function (r) { console.log("TEST_BACKUP create", JSON.stringify(r)); Qt.quit() })
            } else {
                const [zip, pw] = mode.split("|")
                console.log("TEST_BACKUP wrong pw ok?", Backup.checkPassword(zip, "errada"), "right pw ok?", Backup.checkPassword(zip, pw))
                Backup.restore(zip, ["settings"], pw, function (r) { console.log("TEST_BACKUP restore", JSON.stringify(r)) })
            }
        }
        const devPage = SystemInfo.env("SCREENLET_PAGE")
        if (devPage) Qt.callLater(() => Nav.go(devPage, SystemInfo.env("SCREENLET_PARAMS") ? JSON.parse(SystemInfo.env("SCREENLET_PARAMS")) : ({})))
    }

    QueueDock {
        x: (Nav.page === "editor" || Nav.page === "templateBuilder" || Nav.page === "studio" ? 72 : 248) + 20
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 20
        z: 900
    }

    ToastHost {
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: 20
        z: 1000
    }

    // ── First run: terms ─────────────────────────────────────────────────
    AppDialog {
        id: terms
        title: "Bem-vindo ao Screenlet"
        subtitle: "Antes de começar, leia os Termos de Serviço."
        closePolicy: AppDialog.NoAutoClose
        T {
            Layout.fillWidth: true
            tone: "muted"
            text: "Eles explicam, de forma resumida, como o Screenlet usa os arquivos que você importa, o que fica guardado no seu computador e as responsabilidades sobre o conteúdo exibido nas suas telas."
        }
        actions: [
            Btn { text: "Ler no navegador"; iconName: "link"; onClicked: SystemInfo.openExternal("https://screenlet.birdra1n.com/termos") },
            Btn { text: "Li e concordo"; variant: "primary"; onClicked: { Settings.termsAcknowledged = true; terms.close() } }
        ]
        Component.onCompleted: if (!Settings.termsAcknowledged && !SystemInfo.env("SCREENLET_SNAPSHOT")) Qt.callLater(open)
    }

    // ── Update available ─────────────────────────────────────────────────
    AppDialog {
        id: updateDlg
        title: "Atualização disponível"
        subtitle: "Uma nova versão do Screenlet está disponível (" + Updater.latestVersion + ")."
        T { Layout.fillWidth: true; tone: "muted"; text: "Abra a página da versão para baixar o instalador. Seus dados são mantidos." }
        actions: [
            Btn { text: "Agora não"; onClicked: updateDlg.close() },
            Btn { text: "Baixar"; variant: "primary"; iconName: "download"; onClicked: { Updater.openRelease(); updateDlg.close() } }
        ]
    }
    Connections {
        target: Updater
        function onChecked(manual, available) {
            if (available) updateDlg.open()
            else if (manual) Toasts.info("Você já está na versão mais recente.")
        }
    }
}
