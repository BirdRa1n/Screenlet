import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Screenlet

// Scene properties panel for the editor (one section per scene type).
ScrollView {
    id: root
    property var scene: null
    property var drift: null
    property string tab: "content"
    signal applyDrift(var d)

    contentWidth: availableWidth
    clip: true

    function set(patch) { if (scene) Doc.update(scene.id, patch) }

    ColumnLayout {
        width: root.availableWidth - 32
        x: 16
        spacing: 16

        Item { Layout.preferredHeight: 2 }

        // Empty
        ColumnLayout {
            visible: !root.scene
            Layout.fillWidth: true
            Layout.topMargin: 40
            spacing: 8
            Icon { name: "edit"; size: 26; color: Theme.faint; Layout.alignment: Qt.AlignHCenter }
            T { text: "Selecione uma cena para editar"; tone: "muted"; Layout.alignment: Qt.AlignHCenter }
        }

        // Header
        ColumnLayout {
            visible: !!root.scene
            Layout.fillWidth: true
            spacing: 2
            T {
                tone: "eyebrow"
                text: root.scene ? ({ product: "Cena de produto", logo: "Cena de logo", template: "Cena de template", video: "Cena de vídeo" })[root.scene.type] : ""
            }
            H {
                level: 4
                Layout.fillWidth: true
                text: !root.scene ? "" : root.scene.type === "product" ? root.scene.productName
                    : root.scene.type === "logo" ? "Abertura / chamada" : root.scene.type === "template" ? (Templates.find(root.scene.templateId).name || "Template") : "Vídeo"
                elide: Text.ElideRight
                wrapMode: Text.NoWrap
            }
        }

        // Library drift
        Rectangle {
            visible: !!root.drift
            Layout.fillWidth: true
            Layout.preferredHeight: driftRow.implicitHeight + 20
            radius: 14
            color: Theme.amberSoft
            border.color: Theme.amberLine
            RowLayout {
                id: driftRow
                anchors.fill: parent
                anchors.margins: 10
                spacing: 10
                Icon { name: "refresh"; color: Theme.amberInk; Layout.alignment: Qt.AlignTop }
                T {
                    Layout.fillWidth: true
                    size: 13
                    color: Theme.amberInk
                    text: root.drift ? "A biblioteca mudou: " + root.drift.changed.join(", ") + (root.drift.patch.newPrice ? " (agora R$ " + root.drift.patch.newPrice + ")" : "") + "." : ""
                }
                Text {
                    text: "Atualizar"
                    color: Theme.amberInk
                    font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.Bold
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.applyDrift(root.drift) }
                }
            }
        }

        // ── Product ───────────────────────────────────────────────────────
        Segmented {
            visible: !!root.scene && root.scene.type === "product"
            Layout.fillWidth: true
            stretch: true
            options: [{ value: "content", label: "Conteúdo" }, { value: "style", label: "Estilo" }, { value: "logo", label: "Logo" }]
            value: root.tab
            onPicked: (v) => root.tab = v
        }

        ColumnLayout {
            visible: !!root.scene && root.scene.type === "product" && root.tab === "content"
            Layout.fillWidth: true
            spacing: 14
            Field {
                Layout.fillWidth: true
                label: "Imagem do produto"
                ImageField { value: root.scene && root.scene.image ? root.scene.image : ""; onPicked: (p) => root.set({ image: p }) }
            }
            Field {
                Layout.fillWidth: true
                label: "Nome do produto"
                TextBox { text: root.scene ? root.scene.productName || "" : ""; onTextEdited: root.set({ productName: text }) }
            }
            Field {
                Layout.fillWidth: true
                label: "Tipo de preço"
                Segmented {
                    width: parent.width
                    stretch: true
                    dark: true
                    options: [{ value: "offer", label: "Oferta de/por" }, { value: "single", label: "Preço único" }]
                    value: (root.scene && root.scene.priceMode) || "offer"
                    onPicked: (v) => root.set({ priceMode: v })
                }
            }
            RowLayout {
                Layout.fillWidth: true
                spacing: 10
                Field {
                    visible: !!(root.scene && root.scene.priceMode === "offer")
                    Layout.fillWidth: true
                    label: "De (R$)"
                    TextBox { text: root.scene ? root.scene.oldPrice || "" : ""; onTextEdited: root.set({ oldPrice: text }) }
                }
                Field {
                    Layout.fillWidth: true
                    label: root.scene && root.scene.priceMode === "offer" ? "Por (R$)" : "Preço (R$)"
                    TextBox { emphasis: true; text: root.scene ? root.scene.newPrice || "" : ""; onTextEdited: root.set({ newPrice: text }) }
                }
            }
            Field {
                Layout.fillWidth: true
                label: "Sufixo"
                TextBox { placeholderText: "/kg, /un"; text: root.scene ? root.scene.priceSuffix || "" : ""; onTextEdited: root.set({ priceSuffix: text }) }
            }
            Field {
                Layout.fillWidth: true
                label: "Selo"
                TextBox { placeholderText: "Oferta por tempo limitado"; text: root.scene ? root.scene.badgeText || "" : ""; onTextEdited: root.set({ badgeText: text }) }
            }
        }

        ColumnLayout {
            visible: !!root.scene && root.scene.type === "product" && root.tab === "style"
            Layout.fillWidth: true
            spacing: 16
            Field { Layout.fillWidth: true; label: "Cor de destaque (preço)"; ColorField { value: (root.scene && root.scene.accentColor) || "#FFD500"; onPicked: (c) => root.set({ accentColor: c }) } }
            Field { Layout.fillWidth: true; label: "Fundo"; ColorField { value: (root.scene && root.scene.bg) || "#1A1A1A"; swatches: ["#1A1A1A", "#C81F1F", "#241312", "#0B5E1F", "#7A0D0D", "#B07CC6", "#1F3FD1", "#FFFFFF"]; onPicked: (c) => root.set({ bg: c }) } }
            Field { Layout.fillWidth: true; label: "Nome do produto"; ColorField { value: (root.scene && root.scene.productNameColor) || "#ffffff"; onPicked: (c) => root.set({ productNameColor: c }) } }
            Field { Layout.fillWidth: true; label: "Preço anterior"; ColorField { value: (root.scene && root.scene.oldPriceColor) || "#ffffff"; onPicked: (c) => root.set({ oldPriceColor: c }) } }
            Field { Layout.fillWidth: true; label: "Selo — fundo"; ColorField { value: (root.scene && root.scene.badgeColor) || "#E10600"; onPicked: (c) => root.set({ badgeColor: c }) } }
            Field { Layout.fillWidth: true; label: "Selo — texto"; ColorField { value: (root.scene && root.scene.badgeTextColor) || "#ffffff"; onPicked: (c) => root.set({ badgeTextColor: c }) } }
        }

        ColumnLayout {
            visible: !!root.scene && root.scene.type === "product" && root.tab === "logo"
            Layout.fillWidth: true
            spacing: 14
            Toggle {
                Layout.fillWidth: true
                text: "Mostrar a logo sobre a cena"
                checked: !!(root.scene && root.scene.showLogoOverlay)
                onToggled: root.set({ showLogoOverlay: checked })
            }
            Field {
                Layout.fillWidth: true
                label: "Posição"
                enabled: !!(root.scene && root.scene.showLogoOverlay)
                opacity: enabled ? 1 : 0.5
                GridLayout {
                    width: parent.width
                    columns: 2
                    columnSpacing: 8
                    rowSpacing: 8
                    Repeater {
                        model: [{ v: "top-left", l: "Superior esquerdo" }, { v: "top-right", l: "Superior direito" },
                                { v: "bottom-left", l: "Inferior esquerdo" }, { v: "bottom-right", l: "Inferior direito" }]
                        delegate: Rectangle {
                            required property var modelData
                            readonly property bool on: root.scene && root.scene.logoPosition === modelData.v
                            Layout.fillWidth: true
                            Layout.preferredHeight: 40
                            radius: 11
                            color: on ? Theme.inverse : Theme.surface
                            border.color: Theme.borderStrong
                            border.width: on ? 0 : 1
                            Text { anchors.centerIn: parent; text: modelData.l; color: parent.on ? Theme.inverseInk : Theme.ink; font.family: Theme.bodyFont; font.pixelSize: 12; font.weight: Font.DemiBold }
                            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.set({ logoPosition: modelData.v }) }
                        }
                    }
                }
            }
            T { tone: "muted"; size: 12; text: "A logo usada é a do anúncio (painel de cenas)."; Layout.fillWidth: true }
        }

        // ── Logo scene ────────────────────────────────────────────────────
        ColumnLayout {
            visible: !!root.scene && root.scene.type === "logo"
            Layout.fillWidth: true
            spacing: 16
            Field {
                Layout.fillWidth: true
                label: "Chamada"
                TextBox { text: root.scene ? root.scene.tagline || "" : ""; onTextEdited: root.set({ tagline: text }) }
            }
            Field { Layout.fillWidth: true; label: "Cor do texto"; ColorField { value: root.scene ? root.scene.taglineColor || "#fff" : "#fff"; onPicked: (c) => root.set({ taglineColor: c }) } }
            Field { Layout.fillWidth: true; label: "Fundo"; ColorField { value: root.scene ? root.scene.bg || "#0B5E1F" : "#0B5E1F"; swatches: ["#0B5E1F", "#7A0D0D", "#B07CC6", "#111318", "#1F3FD1", "#C81F1F", "#FF8A00", "#FFFFFF"]; onPicked: (c) => root.set({ bg: c }) } }
        }

        // ── Template scene ────────────────────────────────────────────────
        ColumnLayout {
            visible: !!root.scene && root.scene.type === "template"
            Layout.fillWidth: true
            spacing: 14
            readonly property var tpl: root.scene && root.scene.type === "template" ? Templates.find(root.scene.templateId) : ({})
            Field {
                Layout.fillWidth: true
                label: "Template"
                Select {
                    options: Templates.items.map(t => ({ value: t.id, text: t.name }))
                    value: (root.scene && root.scene.templateId) || ""
                    onPicked: (v) => {
                        const fresh = Doc.templateScene(v)
                        root.set({ templateId: v, values: {}, durationInFrames: fresh.durationInFrames })
                    }
                }
            }
            Repeater {
                model: parent.tpl && parent.tpl.variables ? parent.tpl.variables : []
                delegate: Field {
                    required property var modelData
                    Layout.fillWidth: true
                    label: modelData.label + (modelData.required ? " *" : "")
                    readonly property string current: root.scene && root.scene.values && root.scene.values[modelData.key] !== undefined ? root.scene.values[modelData.key] : modelData.defaultValue
                    function put(v) { const vals = Object.assign({}, root.scene.values || {}); vals[modelData.key] = v; root.set({ values: vals }) }
                    Loader {
                        width: parent.width
                        sourceComponent: modelData.type === "image" ? imgC : modelData.type === "color" ? colorC : textC
                        Component { id: textC; TextBox { text: current; onTextEdited: put(text) } }
                        Component { id: colorC; ColorField { value: current || "#ffffff"; onPicked: (c) => put(c) } }
                        Component { id: imgC; ImageField { value: current || ""; onPicked: (p) => put(p) } }
                    }
                }
            }
        }

        // ── Video scene ───────────────────────────────────────────────────
        ColumnLayout {
            visible: !!root.scene && root.scene.type === "video"
            Layout.fillWidth: true
            spacing: 14
            Field {
                Layout.fillWidth: true
                label: "Arquivo de vídeo"
                ImageField { kind: "video"; value: root.scene && root.scene.src ? root.scene.src : ""; onPicked: (p) => root.set({ src: p }) }
            }
            Field {
                Layout.fillWidth: true
                label: "Volume · " + Math.round((root.scene && root.scene.volume !== undefined ? root.scene.volume : 1) * 100) + "%"
                AppSlider { from: 0; to: 1; value: root.scene && root.scene.volume !== undefined ? root.scene.volume : 1; onMoved: root.set({ volume: Math.round(value * 100) / 100 }) }
            }
        }

        // ── Duration (all) ────────────────────────────────────────────────
        Field {
            visible: !!root.scene
            Layout.fillWidth: true
            label: "Duração · " + (root.scene ? Fmt.seconds(root.scene.durationInFrames, Doc.config.fps) : "")
            AppSlider {
                from: 1
                to: 30
                stepSize: 0.5
                value: root.scene ? root.scene.durationInFrames / (Doc.config.fps || 30) : 5
                onMoved: root.set({ durationInFrames: Math.round(value * (Doc.config.fps || 30)) })
            }
        }

        RowLayout {
            visible: !!root.scene
            Layout.fillWidth: true
            Btn { text: "Duplicar"; small: true; iconName: "copy"; onClicked: Doc.duplicate(root.scene.id) }
            Item { Layout.fillWidth: true }
            Btn { text: "Remover"; small: true; variant: "danger"; iconName: "trash"; onClicked: Doc.remove(root.scene.id) }
        }

        Item { Layout.preferredHeight: 12 }
    }
}
