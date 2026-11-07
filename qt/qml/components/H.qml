import QtQuick
import Screenlet

// Display heading (Bricolage-style). level: 1 (36) … 4 (17).
Text {
    property int level: 2
    color: Theme.ink
    font.family: Theme.displayFont
    font.pixelSize: level === 1 ? 36 : level === 2 ? 24 : level === 3 ? 20 : 17
    font.weight: level <= 2 ? Font.ExtraBold : Font.Bold
    font.letterSpacing: level === 1 ? -1 : (level === 2 ? -0.4 : 0)
    wrapMode: Text.WordWrap
}
