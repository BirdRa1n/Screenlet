import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Dialogs
import QtQuick.Layouts
import Screenlet

// Novo anúncio — 5 steps: Loja · Produtos · Visual · Prévia · Formato.
Item {
    id: page
    property var params: ({})
    property int step: 1
    property string storeName: StoreProfiles.active.name || ""
    property string logoPath: StoreProfiles.active.logoPath || ""
    property string brandColor: StoreProfiles.active.brandColor || "#6e56f8"
    property string preset: "generico"
    property string format: "tv"
    property var products: [blankProduct()]

    readonly property var steps: ["Loja", "Produtos", "Visual", "Prévia", "Formato"]

    function blankProduct() {
        return { id: Fmt.shortId(), image: "", productName: "", priceMode: "offer", oldPrice: "", newPrice: "", priceSuffix: "", badgeText: "Oferta por tempo limitado" }
    }

    function updateProduct(id, patch) { products = products.map(p => p.id === id ? Object.assign({}, p, patch) : p) }

    Component.onCompleted: {
        // "Usar no assistente" from the library pre-fills a product.
        if (params.libraryProduct) {
            const lp = params.libraryProduct
            products = [{ id: Fmt.shortId(), image: lp.image || "", productName: lp.name || "", priceMode: lp.priceMode || "offer",
                          oldPrice: lp.oldPrice || "", newPrice: lp.newPrice || "", priceSuffix: lp.priceSuffix || "", badgeText: lp.badgeText || "",
                          libraryProductId: lp.id }]
        }
    }

    // Wizard → AdConfig. Applies the chosen preset's look (the Electron
    // wizard ignored it).
    function buildConfig() {
        const style = Doc.presetStyles[preset] || Doc.presetStyles.generico
        const logo = Doc.logoScene({
            tagline: storeName ? storeName + " — ofertas imperdíveis!" : "Ofertas imperdíveis para você!",
            bg: style.logoBg || brandColor, durationInFrames: 60 })
        const scenes = products.filter(p => p.productName || p.image).map((p, i) => {
            const base = {
                image: p.image, productName: p.productName, priceMode: p.priceMode, oldPrice: p.oldPrice, newPrice: p.newPrice,
                priceSuffix: p.priceSuffix, badgeText: p.badgeText, bg: style.bgs[i % style.bgs.length],
                accentColor: style.accent || brandColor, badgeColor: style.badge, showLogoOverlay: !!logoPath, logoPosition: "top-right"
            }
            if (p.libraryProductId) {
                const snap = { image: p.image, productName: p.productName, priceMode: p.priceMode, oldPrice: p.oldPrice, newPrice: p.newPrice, priceSuffix: p.priceSuffix, badgeText: p.badgeText }
                base.libraryProductId = p.libraryProductId
                base.librarySnapshot = snap
            }
            return Doc.productScene(base)
        })
        const closing = Doc.logoScene({ tagline: "Corra! Ofertas válidas enquanto durarem os estoques.", bg: style.logoBg || brandColor, durationInFrames: 60 })
        return { logoImage: logoPath, storeName: storeName, fps: 30, width: 1920, height: 1080,
                 scenes: [logo].concat(scenes).concat(scenes.length ? [closing] : []) }
    }

    function saveProfile() {
        if (storeName.trim()) {
            const p = StoreProfiles.upsert({ name: storeName, logoPath: logoPath, brandColor: brandColor })
            if (p.id) StoreProfiles.setActive(p.id)
        }
    }

    function finish() {
        saveProfile()
        Doc.newFrom(buildConfig(), storeName ? "Ofertas " + storeName : "")
        Nav.go("editor")
        Toasts.success("Anúncio criado! Ajuste os detalhes no editor.")
    }

    function parseCsv(raw) {
        const lines = raw.trim().split(/\r?\n/).filter(Boolean)
        if (lines.length < 2) return []
        const sep = lines[0].indexOf(";") >= 0 ? ";" : ","
        const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"))
        return lines.slice(1).map(line => {
            const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""))
            const row = {}
            headers.forEach((h, i) => row[h] = cols[i] || "")
            const de = row["preco_de"] || row["de"] || row["preco_antigo"] || ""
            return Object.assign(blankProduct(), {
                productName: row["nome"] || row["name"] || row["produto"] || "",
                oldPrice: de,
                newPrice: row["preco_por"] || row["por"] || row["preco"] || row["price"] || "",
                priceSuffix: row["sufixo"] || row["unidade"] || "",
                badgeText: row["selo"] || row["badge"] || "Oferta por tempo limitado",
                priceMode: de ? "offer" : "single"
            })
        }).filter(p => p.productName)
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // Progress + steps
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 72
            color: Theme.surface
            Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }
            Rectangle {
                anchors.bottom: parent.bottom
                height: 3
                width: parent.width * (page.step - 1) / (page.steps.length - 1)
                color: Theme.accent
                Behavior on width { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack } }
            }
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 28
                anchors.rightMargin: 28
                spacing: 10
                H { level: 3; text: "Novo anúncio"; Layout.rightMargin: 18 }
                Repeater {
                    model: page.steps
                    delegate: RowLayout {
                        required property string modelData
                        required property int index
                        readonly property int num: index + 1
                        spacing: 8
                        Rectangle { visible: index > 0; width: 26; height: 1; color: Theme.border }
                        Rectangle {
                            width: 26; height: 26; radius: 13
                            color: page.step === parent.num ? Theme.inverse : page.step > parent.num ? Theme.green : Theme.hover
                            scale: page.step === parent.num ? 1.1 : 1
                            Behavior on scale { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 3 } }
                            Behavior on color { ColorAnimation { duration: Motion.base } }
                            Text { anchors.centerIn: parent; visible: page.step <= parent.parent.num; text: parent.parent.num; color: page.step === parent.parent.num ? Theme.inverseInk : Theme.muted; font.pixelSize: 12; font.weight: Font.Bold }
                            Icon { anchors.centerIn: parent; visible: page.step > parent.parent.num; name: "check"; size: 13; stroke: 3; color: "#fff" }
                        }
                        T { text: modelData; bold: page.step === parent.num; tone: page.step === parent.num ? "ink" : "muted"; size: 13 }
                    }
                }
                Item { Layout.fillWidth: true }
            }
        }

        // Step content
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true

            Loader {
                id: stepLoader
                anchors.fill: parent
                sourceComponent: [s1, s2, s3, s4, s5][page.step - 1]
                onLoaded: enterAnim.restart()
                ParallelAnimation {
                    id: enterAnim
                    NumberAnimation { target: stepLoader.item; property: "opacity"; from: 0; to: 1; duration: Motion.base }
                    NumberAnimation { target: stepLoader.item; property: "x"; from: 30; to: 0; duration: Motion.slow; easing.type: Easing.OutBack }
                }
            }
        }

        // Footer
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 72
            color: Theme.surface
            Rectangle { width: parent.width; height: 1; color: Theme.border }
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 28
                anchors.rightMargin: 28
                spacing: 10
                Btn { text: "Cancelar"; variant: "ghost"; onClicked: Nav.back("painel") }
                Item { Layout.fillWidth: true }
                Btn { visible: page.step > 1; text: "Anterior"; iconName: "chevronLeft"; onClicked: page.step-- }
                Btn { visible: page.step >= 2; text: "Ir para o editor"; onClicked: page.finish() }
                Btn {
                    visible: page.step < 5
                    text: page.step === 4 ? "Escolher formato" : "Próximo"
                    variant: "primary"
                    enabled: page.step !== 2 || page.products.some(p => p.productName || p.image)
                    onClicked: { if (page.step === 1) page.saveProfile(); page.step++ }
                }
                Btn {
                    visible: page.step === 5
                    text: "Renderizar MP4"
                    variant: "primary"
                    iconName: "play"
                    onClicked: renderDlg.start(page.buildConfig(), "anuncio-" + page.format, "", page.format)
                }
            }
        }
    }

    RenderDialog {
        id: renderDlg
        allowFormat: false
        onFinished: page.finish()
        onSentToBackground: page.finish()
    }

    // ── Steps ─────────────────────────────────────────────────────────────
    Component {
        id: s1
        ScrollPage {
            maxWidth: 820
            ColumnLayout {
                width: parent.width
                spacing: 6
                H { level: 2; text: "Informações da loja" }
                T { tone: "muted"; text: "Esses dados aparecem na abertura do vídeo e identificam sua marca." }
            }
            Flow {
                visible: StoreProfiles.items.length > 0
                width: parent.width
                spacing: 10
                Repeater {
                    model: StoreProfiles.items
                    delegate: Rectangle {
                        required property var modelData
                        readonly property bool on: page.storeName === modelData.name
                        width: pr.implicitWidth + 24
                        height: 52
                        radius: 14
                        color: on ? Theme.accentSoft : Theme.surface
                        border.color: on ? Theme.ink : Theme.border
                        border.width: on ? 2 : 1
                        Row {
                            id: pr
                            anchors.centerIn: parent
                            spacing: 10
                            Rectangle {
                                width: 32; height: 32; radius: 9; color: modelData.brandColor || "#6e56f8"; clip: true
                                Image { anchors.fill: parent; anchors.margins: 3; source: modelData.logoPath ? Storage.url(modelData.logoPath) : ""; fillMode: Image.PreserveAspectFit; sourceSize.width: 80 }
                            }
                            T { text: modelData.name; bold: true; anchors.verticalCenter: parent.verticalCenter }
                        }
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: { page.storeName = modelData.name; page.logoPath = modelData.logoPath || ""; page.brandColor = modelData.brandColor || "#6e56f8" }
                        }
                    }
                }
                Rectangle {
                    width: 120; height: 52; radius: 14
                    color: "transparent"
                    border.color: Theme.borderStrong
                    Row { anchors.centerIn: parent; spacing: 6; Icon { name: "plus"; size: 15; color: Theme.muted } T { text: "Nova loja"; tone: "muted"; bold: true } }
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { page.storeName = ""; page.logoPath = ""; page.brandColor = "#6e56f8" } }
                }
            }
            Card {
                width: parent.width
                height: form.implicitHeight + 40
                ColumnLayout {
                    id: form
                    anchors.fill: parent
                    anchors.margins: 20
                    spacing: 16
                    Field { Layout.fillWidth: true; label: "Nome da empresa"; TextBox { text: page.storeName; placeholderText: "Ex: Supermercado Central"; onTextEdited: page.storeName = text } }
                    Field { Layout.fillWidth: true; label: "Logo da empresa"; hint: "PNG com fundo transparente fica melhor."; ImageField { value: page.logoPath; onPicked: (p) => page.logoPath = p } }
                    Field { Layout.fillWidth: true; label: "Cor principal da marca"; ColorField { value: page.brandColor; swatches: ["#6e56f8", "#0B5E1F", "#C81F1F", "#1F3FD1", "#FF8A00", "#111318", "#B07CC6", "#FFD21F"]; onPicked: (c) => page.brandColor = c } }
                }
            }
        }
    }

    Component {
        id: s2
        ScrollPage {
            maxWidth: 980
            RowLayout {
                width: parent.width
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 6
                    H { level: 2; text: "Adicione seus produtos" }
                    T { tone: "muted"; text: "Cada produto vira uma cena. Você ajusta os detalhes depois, no editor." }
                }
                Btn { text: "Importar planilha"; iconName: "file"; onClicked: csvDlg.open() }
                Btn { text: "Da biblioteca"; iconName: "box"; onClicked: libPick.open() }
            }
            Repeater {
                model: page.products
                delegate: Card {
                    required property var modelData
                    required property int index
                    width: parent.width
                    height: 150
                    popDelay: index * 40
                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 14
                        spacing: 16
                        Rectangle {
                            Layout.preferredWidth: 160
                            Layout.fillHeight: true
                            radius: 14
                            color: Theme.surfaceAlt
                            border.color: Theme.borderStrong
                            MediaThumb { anchors.fill: parent; anchors.margins: 4; path: modelData.image; color: "transparent" }
                            Text { anchors.centerIn: parent; visible: !modelData.image; text: "\n\n\nImagem"; color: Theme.muted; font.pixelSize: 12 }
                            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { imgPick.targetId = modelData.id; imgPick.choose() } }
                        }
                        GridLayout {
                            Layout.fillWidth: true
                            columns: 3
                            columnSpacing: 12
                            rowSpacing: 10
                            Field { Layout.fillWidth: true; Layout.columnSpan: 2; label: "Nome do produto"; TextBox { text: modelData.productName; placeholderText: "Ex: Arroz Integral 1kg"; onTextEdited: page.updateProduct(modelData.id, { productName: text }) } }
                            Field {
                                Layout.fillWidth: true
                                label: "Tipo"
                                Select { options: [{ value: "offer", text: "Oferta (de / por)" }, { value: "single", text: "Preço único" }]; value: modelData.priceMode; onPicked: (v) => page.updateProduct(modelData.id, { priceMode: v }) }
                            }
                            Field { visible: modelData.priceMode === "offer"; Layout.fillWidth: true; label: "Preço de"; TextBox { text: modelData.oldPrice; placeholderText: "0,00"; onTextEdited: page.updateProduct(modelData.id, { oldPrice: text }) } }
                            Field { Layout.fillWidth: true; label: modelData.priceMode === "offer" ? "Preço por" : "Preço"; TextBox { emphasis: true; text: modelData.newPrice; placeholderText: "0,00"; onTextEdited: page.updateProduct(modelData.id, { newPrice: text }) } }
                            Field { Layout.fillWidth: true; label: "Sufixo"; TextBox { text: modelData.priceSuffix; placeholderText: "/kg"; onTextEdited: page.updateProduct(modelData.id, { priceSuffix: text }) } }
                        }
                        IconBtn { visible: page.products.length > 1; iconName: "trash"; danger: true; label: "Remover produto"; Layout.alignment: Qt.AlignTop; onClicked: page.products = page.products.filter(p => p.id !== modelData.id) }
                    }
                }
            }
            Btn { text: "Adicionar produto"; iconName: "plus"; onClicked: page.products = page.products.concat([page.blankProduct()]) }
            T { tone: "muted"; size: 12; text: "Planilha CSV: colunas nome, preco_de, preco_por, sufixo, selo (vírgula ou ponto-e-vírgula)." }
        }
    }

    Component {
        id: s3
        ScrollPage {
            maxWidth: 1100
            ColumnLayout {
                width: parent.width
                spacing: 6
                H { level: 2; text: "Escolha o visual" }
                T { tone: "muted"; text: "Define as cores das cenas de produto e da abertura." }
            }
            GridLayout {
                width: parent.width
                columns: 2
                columnSpacing: 16
                rowSpacing: 16
                Repeater {
                    model: [{ id: "generico", name: "Genérico", desc: "Produtos do dia a dia" }, { id: "carnes", name: "Açougue", desc: "Promoções de carnes" },
                            { id: "natal", name: "Natal", desc: "Especial de fim de ano" }, { id: "pascoa", name: "Páscoa", desc: "Especial de Páscoa" }]
                    delegate: Card {
                        required property var modelData
                        required property int index
                        readonly property bool on: page.preset === modelData.id
                        Layout.fillWidth: true
                        Layout.preferredHeight: width * 9 / 16 + 70
                        popDelay: index * 60
                        lift: true
                        clip: true
                        border.width: on ? 3 : 1
                        border.color: on ? Theme.ink : Theme.border
                        ColumnLayout {
                            anchors.fill: parent
                            spacing: 0
                            AdPlayer {
                                Layout.fillWidth: true
                                Layout.preferredHeight: width * 9 / 16
                                config: Doc.buildPreset(modelData.id)
                                playing: parent.parent.hovered || parent.parent.on
                                frame: 90
                            }
                            RowLayout {
                                Layout.margins: 14
                                ColumnLayout { spacing: 0; H { level: 4; text: modelData.name } T { tone: "muted"; size: 13; text: modelData.desc } }
                                Item { Layout.fillWidth: true }
                                Rectangle {
                                    visible: parent.parent.parent.on
                                    width: 28; height: 28; radius: 14; color: Theme.inverse
                                    Icon { anchors.centerIn: parent; name: "check"; size: 14; stroke: 3; color: Theme.accent }
                                }
                            }
                        }
                        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: page.preset = modelData.id }
                    }
                }
            }
        }
    }

    Component {
        id: s4
        ScrollPage {
            maxWidth: 1100
            ColumnLayout {
                width: parent.width
                spacing: 6
                H { level: 2; text: "Prévia do vídeo" }
                T { tone: "muted"; text: "Este é o resultado com os seus dados. Continue para escolher o formato." }
            }
            Rectangle {
                width: parent.width
                height: width * 9 / 16
                radius: 20
                color: Theme.stage
                AdPlayer { id: pv; anchors.fill: parent; anchors.margins: 18; config: page.buildConfig(); Component.onCompleted: play() }
            }
        }
    }

    Component {
        id: s5
        ScrollPage {
            maxWidth: 1000
            ColumnLayout {
                width: parent.width
                spacing: 6
                H { level: 2; text: "Formato de exportação" }
                T { tone: "muted"; text: "TV, Instagram, Stories e TikTok — o mesmo anúncio se adapta ao formato." }
            }
            GridLayout {
                width: parent.width
                columns: 4
                columnSpacing: 14
                Repeater {
                    model: ["tv", "instagram", "stories", "tiktok"]
                    delegate: Card {
                        required property string modelData
                        required property int index
                        readonly property bool on: page.format === modelData
                        readonly property var f: Fmt.formats[modelData]
                        Layout.fillWidth: true
                        Layout.preferredHeight: 260
                        popDelay: index * 60
                        lift: true
                        border.width: on ? 3 : 1
                        border.color: on ? Theme.ink : Theme.border
                        ColumnLayout {
                            anchors.fill: parent
                            anchors.margins: 14
                            spacing: 8
                            Item {
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                AdPlayer {
                                    anchors.centerIn: parent
                                    width: Math.min(parent.width, parent.height * f.width / f.height)
                                    height: width * f.height / f.width
                                    config: Object.assign({}, page.buildConfig(), { width: f.width, height: f.height })
                                    playing: true
                                    frame: 80 + index * 12
                                }
                            }
                            H { level: 4; text: f.label }
                            T { tone: "muted"; size: 12; text: f.dims }
                        }
                        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: page.format = modelData }
                    }
                }
            }
        }
    }

    // ── Pickers ───────────────────────────────────────────────────────────
    MediaPicker {
        id: imgPick
        property string targetId: ""
        onPicked: (p) => page.updateProduct(targetId, { image: p })
    }

    FileDialog {
        id: csvDlg
        title: "Importar planilha"
        nameFilters: ["Planilha CSV (*.csv *.txt)"]
        onAccepted: {
            const parsed = page.parseCsv(SystemInfo.readTextFile(selectedFile))
            if (!parsed.length) { Toasts.error("CSV inválido. Verifique as colunas: nome, preco_de, preco_por, sufixo"); return }
            const keep = page.products.filter(p => p.productName || p.image)
            page.products = keep.concat(parsed)
            Toasts.success(parsed.length + " produto(s) importado(s) do CSV.")
        }
    }

    AppDialog {
        id: libPick
        title: "Da biblioteca"
        dialogWidth: 600
        Repeater {
            model: Library.items
            delegate: Rectangle {
                required property var modelData
                Layout.fillWidth: true
                Layout.preferredHeight: 58
                radius: 12
                color: lma.containsMouse ? Theme.hover : Theme.surface
                border.color: Theme.border
                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 8
                    MediaThumb { Layout.preferredWidth: 52; Layout.fillHeight: true; path: modelData.image || "" }
                    T { text: modelData.name; bold: true; Layout.fillWidth: true }
                    T { text: "R$ " + modelData.newPrice; tone: "muted" }
                }
                MouseArea {
                    id: lma
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        const p = modelData
                        const keep = page.products.filter(x => x.productName || x.image)
                        page.products = keep.concat([{ id: Fmt.shortId(), image: p.image || "", productName: p.name, priceMode: p.priceMode || "offer",
                                                       oldPrice: p.oldPrice || "", newPrice: p.newPrice || "", priceSuffix: p.priceSuffix || "",
                                                       badgeText: p.badgeText || "", libraryProductId: p.id }])
                        libPick.close()
                    }
                }
            }
        }
        T { visible: Library.items.length === 0; tone: "muted"; text: "A biblioteca está vazia." }
    }
}
