import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Screenlet

// Produtos e preços — product library + StockEasy price sync.
Item {
    id: page
    property var params: ({})
    property string category: "Todos"
    property string query: ""
    property var editing: null
    property bool syncing: false
    property var pendingSync: []

    Component.onCompleted: Library.refresh()

    readonly property var shown: Library.items.filter(p => (category === "Todos" || p.category === category)
                                                       && (!query || p.name.toLowerCase().indexOf(query.toLowerCase()) >= 0))
    readonly property bool canSync: StockEasy.enabled && StockEasy.hasApiKey

    function applyPrice(p, product, store) {
        const entry = (product.precos || []).find(x => x.loja === store)
        if (!entry) return "\"" + p.name + "\": loja \"" + store + "\" sem preço."
        Library.save(Object.assign({}, p, { newPrice: Fmt.price(entry.preco) }))
        return null
    }

    // Sequential sync (one request at a time keeps the API happy).
    function syncList(list, store) {
        syncing = true
        let ok = 0
        const errors = []
        const next = (i) => {
            if (i >= list.length) {
                syncing = false
                if (ok) Toasts.success(ok + " produto(s) sincronizado(s) com a loja \"" + store + "\".")
                if (errors.length) Toasts.error(errors[0] + (errors.length > 1 ? " (+" + (errors.length - 1) + ")" : ""))
                const drift = Insights.priceDrift()
                if (drift.length) { outdatedDlg.drift = drift; outdatedDlg.open() }
                return
            }
            StockEasy.lookup(list[i].reference, function (r) {
                if (!r.ok) errors.push("\"" + list[i].name + "\": " + r.error)
                else { const e = page.applyPrice(list[i], r.product, store); if (e) errors.push(e); else ok++ }
                next(i + 1)
            })
        }
        next(0)
    }

    function sync(targets) {
        const withRef = targets.filter(p => (p.reference || "").trim())
        if (!withRef.length) { Toasts.error("Nenhum produto com referência para sincronizar."); return }
        if (StockEasy.selectedStore) { syncList(withRef, StockEasy.selectedStore); return }
        syncing = true
        StockEasy.lookup(withRef[0].reference, function (r) {
            syncing = false
            if (!r.ok) { Toasts.error(r.error); return }
            const stores = (r.product.precos || []).map(x => x.loja).filter((v, i, a) => a.indexOf(v) === i)
            if (!stores.length) { Toasts.error("Nenhuma loja disponível na resposta do StockEasy."); return }
            page.pendingSync = withRef
            storeDlg.stores = stores
            storeDlg.pick = stores[0]
            storeDlg.open()
        })
    }

    ScrollPage {
        anchors.fill: parent

        PageHeader {
            title: "Produtos e preços"
            subtitle: "Produtos reutilizáveis nos anúncios. " + (page.canSync ? "Preços sincronizados com o StockEasy." : "Conecte o StockEasy em Configurações para sincronizar preços.")
            TextBox { width: 240; iconName: "search"; placeholderText: "Buscar produto"; onTextChanged: page.query = text }
            Btn { visible: page.canSync; text: page.syncing ? "Sincronizando…" : "Sincronizar preços"; iconName: "refresh"; busy: page.syncing; enabled: !page.syncing; onClicked: page.sync(Library.items) }
            Btn { text: "Adicionar produto"; variant: "primary"; iconName: "plus"; onClicked: { page.editing = null; editDlg.open() } }
        }

        Flow {
            width: parent.width
            spacing: 8
            Repeater {
                model: ["Todos"].concat(Library.categories)
                delegate: Rectangle {
                    required property string modelData
                    readonly property bool on: page.category === modelData
                    height: 34
                    width: ct.implicitWidth + 28
                    radius: 17
                    color: on ? Theme.inverse : Theme.surface
                    border.color: Theme.border
                    border.width: on ? 0 : 1
                    Text { id: ct; anchors.centerIn: parent; text: modelData; color: parent.on ? Theme.inverseInk : Theme.text2; font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold }
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: page.category = modelData }
                }
            }
        }

        GridLayout {
            width: parent.width
            columns: Math.max(1, Math.floor((width + 16) / 250))
            columnSpacing: 16
            rowSpacing: 16
            Repeater {
                model: page.shown
                delegate: ProductCard {
                    required property var modelData
                    required property int index
                    Layout.fillWidth: true
                    Layout.preferredHeight: 384
                    product: modelData
                    popDelay: Math.min(index, 12) * 40
                }
            }
        }

        EmptyState {
            visible: page.shown.length === 0
            width: parent.width
            iconName: "box"
            title: Library.items.length ? "Nenhum produto aqui" : "Biblioteca vazia"
            text: Library.items.length ? "Troque a categoria ou a busca." : "Cadastre produtos para reutilizar nos anúncios e manter os preços em dia."
            Btn { visible: !Library.items.length; text: "Adicionar produto"; variant: "primary"; iconName: "plus"; onClicked: { page.editing = null; editDlg.open() } }
        }
    }


    // ── Product card ──────────────────────────────────────────────────────
    function num(v) { const n = parseFloat(String(v || "").replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n }

    component ProductCard: Card {
        id: pc
        property var product: ({})
        readonly property real oldP: page.num(product.oldPrice)
        readonly property real newP: page.num(product.newPrice)
        readonly property int discount: product.priceMode === "offer" && oldP > newP && newP > 0 ? Math.round((1 - newP / oldP) * 100) : 0
        readonly property bool hasRef: !!(product.reference || "").trim()
        lift: true

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 10
            spacing: 0

            // Image panel
            Rectangle {
                id: panel
                Layout.fillWidth: true
                Layout.preferredHeight: 190
                radius: 16
                color: Theme.dark ? "#1E222A" : "#F4F5F8"

                Image {
                    id: img
                    anchors.fill: parent
                    anchors.margins: 18
                    source: pc.product.image ? Storage.url(pc.product.image) : ""
                    fillMode: Image.PreserveAspectFit
                    sourceSize.width: 420
                    asynchronous: true
                    smooth: true
                    mipmap: true
                    opacity: status === Image.Ready ? 1 : 0
                    Behavior on opacity { NumberAnimation { duration: Motion.base } }
                    scale: pc.hovered ? 1.07 : 1
                    rotation: pc.hovered ? -2 : 0
                    Behavior on scale { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 1.8 } }
                    Behavior on rotation { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack } }
                }
                Column {
                    anchors.centerIn: parent
                    spacing: 6
                    visible: img.status !== Image.Ready
                    Icon { anchors.horizontalCenter: parent.horizontalCenter; name: "image"; size: 28; color: Theme.faint }
                    T { anchors.horizontalCenter: parent.horizontalCenter; text: pc.product.image ? "Imagem indisponível" : "Sem imagem"; tone: "faint"; size: 12 }
                }

                // Category
                Rectangle {
                    visible: !!pc.product.category
                    anchors.left: parent.left
                    anchors.top: parent.top
                    anchors.margins: 10
                    height: 24
                    width: catText.implicitWidth + 18
                    radius: 12
                    color: Theme.surface
                    Text { id: catText; anchors.centerIn: parent; text: pc.product.category || ""; color: Theme.text2; font.family: Theme.bodyFont; font.pixelSize: 11; font.weight: Font.DemiBold }
                }

                // Discount stamp
                Rectangle {
                    visible: pc.discount > 0
                    anchors.left: parent.left
                    anchors.bottom: parent.bottom
                    anchors.margins: 10
                    height: 28
                    width: discText.implicitWidth + 18
                    radius: 8
                    color: Theme.red
                    rotation: -4
                    scale: pc.hovered ? 1.1 : 1
                    Behavior on scale { NumberAnimation { duration: Motion.slow; easing.type: Easing.OutBack; easing.overshoot: 3 } }
                    Text { id: discText; anchors.centerIn: parent; text: "-" + pc.discount + "%"; color: "#FFFFFF"; font.family: Theme.displayFont; font.pixelSize: 14; font.weight: Font.ExtraBold }
                }

                // Hover actions
                Row {
                    anchors.right: parent.right
                    anchors.top: parent.top
                    anchors.margins: 8
                    spacing: 6
                    opacity: pc.hovered ? 1 : 0
                    transform: Translate { y: pc.hovered ? 0 : -6; Behavior on y { NumberAnimation { duration: Motion.base; easing.type: Easing.OutBack } } }
                    Behavior on opacity { NumberAnimation { duration: Motion.fast } }
                    IconBtn { visible: page.canSync && pc.hasRef; iconName: "refresh"; label: "Sincronizar preço"; box: 32; onClicked: page.sync([pc.product]) }
                    IconBtn { iconName: "edit"; label: "Editar"; box: 32; onClicked: { page.editing = pc.product; editDlg.open() } }
                    IconBtn { iconName: "trash"; danger: true; label: "Excluir"; box: 32; onClicked: { Library.remove(pc.product.id); Toasts.info("\"" + pc.product.name + "\" removido.") } }
                }
            }

            // Text
            ColumnLayout {
                Layout.fillWidth: true
                Layout.leftMargin: 6
                Layout.rightMargin: 6
                Layout.topMargin: 12
                spacing: 4
                Text {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 38
                    text: pc.product.name || ""
                    color: Theme.ink
                    font.family: Theme.bodyFont
                    font.pixelSize: 14
                    font.weight: Font.DemiBold
                    wrapMode: Text.WordWrap
                    maximumLineCount: 2
                    elide: Text.ElideRight
                    verticalAlignment: Text.AlignTop
                }
                RowLayout {
                    spacing: 6
                    Text {
                        text: "R$"
                        color: Theme.redInk
                        font.family: Theme.displayFont; font.pixelSize: 14; font.weight: Font.Bold
                        Layout.alignment: Qt.AlignBaseline
                    }
                    Text {
                        id: priceText
                        text: pc.product.newPrice || "0,00"
                        color: Theme.redInk
                        font.family: Theme.displayFont; font.pixelSize: 28; font.weight: Font.ExtraBold
                        font.letterSpacing: -0.5
                    }
                    Text {
                        visible: !!pc.product.priceSuffix
                        text: pc.product.priceSuffix || ""
                        color: Theme.muted
                        font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold
                    }
                    Text {
                        visible: pc.discount > 0
                        text: "R$ " + (pc.product.oldPrice || "")
                        color: Theme.faint
                        font.family: Theme.bodyFont; font.pixelSize: 13; font.strikeout: true
                        Layout.leftMargin: 2
                    }
                }
                RowLayout {
                    spacing: 6
                    Rectangle {
                        visible: pc.hasRef
                        height: 20
                        width: refText.implicitWidth + 14
                        radius: 6
                        color: Theme.hover
                        Text { id: refText; anchors.centerIn: parent; text: "Ref. " + (pc.product.reference || ""); color: Theme.muted; font.family: Theme.bodyFont; font.pixelSize: 11; font.weight: Font.DemiBold }
                    }
                    Row {
                        visible: page.canSync && pc.hasRef
                        spacing: 4
                        Rectangle { width: 6; height: 6; radius: 3; color: Theme.green; anchors.verticalCenter: parent.verticalCenter }
                        Text { text: "PDV"; color: Theme.greenInk; font.family: Theme.bodyFont; font.pixelSize: 11; font.weight: Font.DemiBold }
                    }
                    T { visible: !pc.hasRef; text: "Sem referência no PDV"; tone: "faint"; size: 11 }
                }
            }

            Item { Layout.fillHeight: true }

            // Primary action
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 40
                radius: 12
                color: useMa.containsMouse ? Theme.inverse : Theme.sunken
                Behavior on color { ColorAnimation { duration: Motion.fast } }
                Row {
                    anchors.centerIn: parent
                    spacing: 8
                    Icon { name: "plus"; size: 15; stroke: 2.4; color: useMa.containsMouse ? Theme.accent : Theme.ink; anchors.verticalCenter: parent.verticalCenter }
                    Text { text: "Usar em anúncio"; color: useMa.containsMouse ? Theme.inverseInk : Theme.ink; font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold; anchors.verticalCenter: parent.verticalCenter }
                }
                MouseArea { id: useMa; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: Nav.go("wizard", { libraryProduct: pc.product }) }
                Accessible.role: Accessible.Button
                Accessible.name: "Usar " + (pc.product.name || "") + " em anúncio"
            }
        }
    }

    // ── Edit dialog ───────────────────────────────────────────────────────
    AppDialog {
        id: editDlg
        property var f: ({})
        title: page.editing ? "Editar produto" : "Novo produto"
        dialogWidth: 620
        onOpened: f = page.editing ? Object.assign({}, page.editing)
                                   : { name: "", category: "", reference: "", image: "", priceMode: "offer", oldPrice: "", newPrice: "", priceSuffix: "", badgeText: "Oferta por tempo limitado" }
        function set(p) { f = Object.assign({}, f, p) }

        Field { Layout.fillWidth: true; label: "Imagem do produto"; ImageField { value: editDlg.f.image || ""; onPicked: (p) => editDlg.set({ image: p }) } }
        RowLayout {
            Layout.fillWidth: true
            spacing: 12
            Field { Layout.fillWidth: true; label: "Nome do produto"; TextBox { text: editDlg.f.name || ""; placeholderText: "Ex: Arroz Tio João 5kg"; onTextEdited: editDlg.set({ name: text }) } }
            Field { Layout.preferredWidth: 180; label: "Categoria"; TextBox { text: editDlg.f.category || ""; placeholderText: "Ex: Laticínios"; onTextEdited: editDlg.set({ category: text }) } }
        }
        Field { Layout.fillWidth: true; label: "Referência no PDV (opcional)"; hint: "Código usado para buscar o preço no StockEasy."; TextBox { text: editDlg.f.reference || ""; placeholderText: "Ex: 201"; onTextEdited: editDlg.set({ reference: text }) } }
        Field {
            Layout.fillWidth: true
            label: "Tipo de preço"
            Segmented { width: parent.width; stretch: true; dark: true; options: [{ value: "offer", label: "Oferta de/por" }, { value: "single", label: "Preço único" }]; value: editDlg.f.priceMode || "offer"; onPicked: (v) => editDlg.set({ priceMode: v }) }
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 12
            Field { visible: editDlg.f.priceMode === "offer"; Layout.fillWidth: true; label: "Preço anterior"; TextBox { text: editDlg.f.oldPrice || ""; placeholderText: "0,00"; onTextEdited: editDlg.set({ oldPrice: text }) } }
            Field { Layout.fillWidth: true; label: "Preço"; TextBox { emphasis: true; text: editDlg.f.newPrice || ""; placeholderText: "0,00"; onTextEdited: editDlg.set({ newPrice: text }) } }
            Field { Layout.preferredWidth: 120; label: "Sufixo"; TextBox { text: editDlg.f.priceSuffix || ""; placeholderText: "/kg"; onTextEdited: editDlg.set({ priceSuffix: text }) } }
        }
        Field { Layout.fillWidth: true; label: "Selo"; TextBox { text: editDlg.f.badgeText || ""; onTextEdited: editDlg.set({ badgeText: text }) } }
        actions: [
            Btn { text: "Cancelar"; onClicked: editDlg.close() },
            Btn {
                text: "Salvar"
                variant: "primary"
                enabled: (editDlg.f.name || "").trim() !== ""
                onClicked: { const saved = Library.save(editDlg.f); Toasts.success("\"" + saved.name + "\" salvo na biblioteca."); editDlg.close() }
            }
        ]
    }

    AppDialog {
        id: outdatedDlg
        property var drift: []
        title: drift.length + (drift.length > 1 ? " anúncios ficaram desatualizados" : " anúncio ficou desatualizado")
        subtitle: "Os preços sincronizados mudaram produtos usados nestes anúncios. Atualizar renderiza os vídeos de novo, um após o outro, e os canais passam a exibir a versão nova."
        Repeater {
            model: outdatedDlg.drift
            delegate: RowLayout {
                required property var modelData
                Layout.fillWidth: true
                spacing: 10
                Icon { name: "megaphone"; color: Theme.amberInk }
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 0
                    T { text: modelData.projectName; bold: true }
                    T { size: 12; tone: "muted"; Layout.fillWidth: true; text: modelData.scenes.map(s => s.name + " (" + s.changed.join(", ") + ")").join(" · ") }
                }
            }
        }
        actions: [
            Btn { text: "Agora não"; onClicked: outdatedDlg.close() },
            Btn {
                text: "Atualizar e renderizar"
                variant: "primary"
                iconName: "refresh"
                onClicked: {
                    const r = RenderQueue.enqueue(outdatedDlg.drift.map(d => d.projectId))
                    if (r.queued) Toasts.info(r.queued + " vídeo(s) na fila de renderização.")
                    outdatedDlg.close()
                }
            }
        ]
    }

    AppDialog {
        id: storeDlg
        property var stores: []
        property string pick: ""
        title: "Escolha a loja"
        subtitle: "De qual loja do StockEasy os preços devem vir? Você pode trocar depois em Configurações."
        Field { Layout.fillWidth: true; label: "Loja de referência"; Select { options: storeDlg.stores.map(s => ({ value: s, text: s })); value: storeDlg.pick; onPicked: (v) => storeDlg.pick = v } }
        actions: [
            Btn { text: "Cancelar"; onClicked: storeDlg.close() },
            Btn { text: "Confirmar e sincronizar"; variant: "primary"; onClicked: { StockEasy.selectedStore = storeDlg.pick; storeDlg.close(); page.syncList(page.pendingSync, storeDlg.pick) } }
        ]
    }
}
