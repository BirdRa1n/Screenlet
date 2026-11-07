import QtQuick
import Screenlet

// Body text. tone: ink | muted | faint | eyebrow
Text {
    property string tone: "ink"
    property bool bold: false
    property int size: tone === "eyebrow" ? 11 : 14
    color: tone === "muted" ? Theme.muted : tone === "faint" ? Theme.faint : tone === "eyebrow" ? Theme.faint : Theme.ink
    font.family: Theme.bodyFont
    font.pixelSize: size
    font.weight: tone === "eyebrow" ? Font.Bold : (bold ? Font.DemiBold : Font.Normal)
    font.letterSpacing: tone === "eyebrow" ? 1 : 0
    font.capitalization: tone === "eyebrow" ? Font.AllUppercase : Font.MixedCase
    wrapMode: Text.WordWrap
}
