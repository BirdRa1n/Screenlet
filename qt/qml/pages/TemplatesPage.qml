import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Dialogs
import QtQuick.Layouts
import Screenlet

// Template gallery.
Item {
    id: page
    property var params: ({})
    property string tag: "Todos"
    property var target: null

    Component.onCompleted: Templates.refresh()

    readonly property var tags: {
        const out = ["Todos"]
        for (const t of Templates.items) for (const g of t.tags || []) if (out.indexOf(g) < 0) out.push(g)
        return out
    }
    readonly property var shown: Templates.items.filter(t => tag === "Todos" || (t.tags || []).indexOf(tag) >= 0)

    ScrollPage {
        anchors.fill: parent

        PageHeader {
            title: "Templates"
            subtitle: "Modelos prontos e os seus. Passe o mouse para ver a animação."
            Btn { text: "Importar"; iconName: "upload"; onClicked: importDlg.open() }
            Btn { text: "Novo template"; variant: "primary"; iconName: "plus"; onClicked: Nav.go("templateBuilder", {}) }
        }

        Flow {
            width: parent.width
            spacing: 8
            Repeater {
                model: page.tags
                delegate: Rectangle {
                    required property string modelData
                    readonly property bool on: page.tag === modelData
                    height: 34
                    width: tl.implicitWidth + 28
                    radius: 17
                    color: on ? Theme.inverse : Theme.surface
                    border.color: Theme.border
                    border.width: on ? 0 : 1
                    Text { id: tl; anchors.centerIn: parent; text: modelData; color: parent.on ? Theme.inverseInk : Theme.text2; font.family: Theme.bodyFont; font.pixelSize: 13; font.weight: Font.DemiBold }
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: page.tag = modelData }
                }
            }
        }

        GridLayout {
            width: parent.width
            columns: Math.max(1, Math.floor((width + 16) / 320))
            columnSpacing: 16
            rowSpacing: 16
            Repeater {
                model: page.shown
                delegate: TemplateCard {
                    required property var modelData
                    required property int index
                    Layout.fillWidth: true
                    Layout.alignment: Qt.AlignTop
                    template: modelData
                    popDelay: Math.min(index, 10) * Motion.stagger
                    onActivated: Nav.go("templateWizard", { templateId: modelData.id })

                    Btn { text: "Usar"; small: true; variant: "primary"; onClicked: Nav.go("templateWizard", { templateId: modelData.id }) }
                    Btn { visible: !modelData.builtin; text: "Editar"; small: true; onClicked: Nav.go("templateBuilder", { id: modelData.id }) }
                    IconBtn { iconName: "copy"; label: "Duplicar"; box: 34; onClicked: { Templates.duplicate(modelData.id); Toasts.success("\"" + modelData.name + "\" duplicado.") } }
                    IconBtn { iconName: "download"; label: "Exportar"; box: 34; onClicked: { page.target = modelData; exportDlg.open() } }
                    IconBtn { visible: !modelData.builtin; iconName: "trash"; danger: true; label: "Excluir"; box: 34; onClicked: { page.target = modelData; deleteDlg.open() } }
                }
            }
        }
    }

    FileDialog {
        id: importDlg
        title: "Importar template"
        nameFilters: ["Template do Screenlet (*.adframe.json *.json)"]
        onAccepted: {
            const r = Templates.importFrom(SystemInfo.localPath(selectedFile))
            if (r.ok) Toasts.success("Template \"" + r.name + "\" importado.")
            else Toasts.error(r.error)
        }
    }

    FileDialog {
        id: exportDlg
        title: "Exportar template"
        fileMode: FileDialog.SaveFile
        defaultSuffix: "json"
        currentFile: page.target ? "file:///" + page.target.name.toLowerCase().replace(/\s+/g, "-") + ".adframe.json" : ""
        nameFilters: ["Template do Screenlet (*.adframe.json)"]
        onAccepted: if (Templates.exportTo(page.target.id, SystemInfo.localPath(selectedFile))) Toasts.success("Template exportado.")
    }

    AppDialog {
        id: deleteDlg
        title: "Excluir template?"
        subtitle: page.target ? "\"" + page.target.name + "\" será removido. Anúncios que o usam ficarão sem essa cena." : ""
        actions: [
            Btn { text: "Cancelar"; onClicked: deleteDlg.close() },
            Btn { text: "Excluir"; variant: "danger"; onClicked: { Templates.remove(page.target.id); deleteDlg.close(); Toasts.info("Template removido.") } }
        ]
    }
}
