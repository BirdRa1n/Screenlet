import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import Screenlet
import "../scene/SceneMath.js" as SM

// Fill a template's variables, preview live, render or open in the editor.
Item {
    id: page
    property var params: ({})
    readonly property var tpl: Templates.find(params.templateId || "")
    property var values: ({})
    property string format: "tv"

    Component.onCompleted: {
        const v = {}
        for (const x of (tpl.variables || [])) v[x.key] = x.defaultValue
        const profile = StoreProfiles.active
        if (profile && profile.name && v.STORE_NAME !== undefined) v.STORE_NAME = profile.name
        if (profile && profile.logoPath && v.LOGO !== undefined) v.LOGO = profile.logoPath
        values = v
    }

    readonly property int total: SM.templateFrames(tpl)
    readonly property var config: ({
        fps: tpl.fps || 30, width: Fmt.formats[format].width, height: Fmt.formats[format].height, logoImage: values.LOGO || "",
        scenes: [{ type: "template", id: Fmt.shortId(), templateId: tpl.id || "", values: values, durationInFrames: Math.max(1, total) }]
    })
    readonly property var missing: (tpl.variables || []).filter(v => v.required && !(values[v.key] || "").toString().trim()).map(v => v.label)

    function put(k, v) { const o = Object.assign({}, values); o[k] = v; values = o }

    RowLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 18

        Card {
            popDelay: 30
            Layout.preferredWidth: 380
            Layout.fillHeight: true
            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 18
                spacing: 12
                RowLayout {
                    IconBtn { iconName: "chevronLeft"; label: "Voltar"; onClicked: Nav.go("templates") }
                    ColumnLayout {
                        spacing: 0
                        Layout.fillWidth: true
                        T { tone: "eyebrow"; text: "Template" }
                        H { level: 3; text: page.tpl.name || ""; Layout.fillWidth: true; elide: Text.ElideRight; wrapMode: Text.NoWrap }
                    }
                }
                ScrollView {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    contentWidth: availableWidth
                    clip: true
                    ColumnLayout {
                        width: parent.width
                        spacing: 14
                        Repeater {
                            model: page.tpl.variables || []
                            delegate: Field {
                                required property var modelData
                                Layout.fillWidth: true
                                label: modelData.label + (modelData.required ? " *" : "")
                                Loader {
                                    width: parent.width
                                    sourceComponent: modelData.type === "image" ? imgC : modelData.type === "color" ? colorC : textC
                                    Component { id: textC; TextBox { text: page.values[modelData.key] || ""; onTextEdited: page.put(modelData.key, text) } }
                                    Component { id: colorC; ColorField { value: page.values[modelData.key] || "#ffffff"; onPicked: (c) => page.put(modelData.key, c) } }
                                    Component { id: imgC; ImageField { value: page.values[modelData.key] || ""; onPicked: (p) => page.put(modelData.key, p) } }
                                }
                            }
                        }
                    }
                }
                Rectangle {
                    visible: page.missing.length > 0
                    Layout.fillWidth: true
                    Layout.preferredHeight: mt.implicitHeight + 16
                    radius: 12
                    color: Theme.amberSoft
                    T { id: mt; anchors.fill: parent; anchors.margins: 8; size: 12; color: Theme.amberInk; text: "Preencha: " + page.missing.join(", ") }
                }
                RowLayout {
                    Layout.fillWidth: true
                    Btn {
                        text: "Abrir no editor"
                        Layout.fillWidth: true
                        enabled: page.missing.length === 0
                        onClicked: {
                            Doc.newFrom({ fps: page.tpl.fps || 30, width: 1920, height: 1080, logoImage: page.values.LOGO || "",
                                          scenes: [Object.assign(Doc.templateScene(page.tpl.id), { values: page.values })] }, page.tpl.name)
                            Nav.go("editor")
                        }
                    }
                    Btn {
                        text: "Renderizar"
                        variant: "primary"
                        iconName: "play"
                        Layout.fillWidth: true
                        enabled: page.missing.length === 0
                        onClicked: renderDlg.start(page.config, (page.tpl.name || "template").toLowerCase().replace(/\s+/g, "-"), "", page.format)
                    }
                }
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 14
            RowLayout {
                H { level: 3; text: "Prévia"; Layout.fillWidth: true }
                Segmented {
                    options: [{ value: "tv", label: "TV 16:9" }, { value: "instagram", label: "Instagram 1:1" }, { value: "stories", label: "Stories 9:16" }]
                    value: page.format
                    onPicked: (v) => page.format = v
                }
            }
            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true
                radius: Theme.radiusXL
                color: Theme.stage
                AdPlayer { id: player; anchors.fill: parent; anchors.margins: 22; config: page.config; backdrop: "transparent"; Component.onCompleted: play() }
            }
            T { tone: "muted"; size: 12; text: "Templates usam as posições do formato original (" + (page.tpl.width || 1920) + "×" + (page.tpl.height || 1080) + "); em outros formatos as camadas podem ficar fora da área." }
        }
    }

    RenderDialog { id: renderDlg; format: page.format }
}
