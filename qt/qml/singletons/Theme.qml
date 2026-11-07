pragma Singleton
import QtQuick
import Screenlet

// Design tokens — proposal B "Vitrine": bright retail look, offer yellow,
// big rounded cards. Dark mode keeps the same accents on graphite surfaces.
QtObject {
    id: theme

    readonly property bool dark: Settings.theme === "dark"
                                 || (Settings.theme === "system" && Qt.styleHints.colorScheme === Qt.ColorScheme.Dark)

    // Surfaces
    readonly property color bg:          dark ? "#0F1115" : "#F3F4F7"
    readonly property color surface:     dark ? "#171A20" : "#FFFFFF"
    readonly property color surfaceAlt:  dark ? "#1C2027" : "#FAFBFC"
    readonly property color sunken:      dark ? "#12151A" : "#F3F4F7"
    readonly property color stage:       dark ? "#0B0D10" : "#E7E9EE"
    readonly property color hover:       dark ? "#222630" : "#F1F2F5"
    readonly property color border:      dark ? "#2A2F38" : "#E3E5EB"
    readonly property color borderStrong: dark ? "#3A404B" : "#D5D8E0"

    // Text
    readonly property color ink:   dark ? "#F2F3F5" : "#111318"
    readonly property color text2: dark ? "#C9CDD5" : "#3A3F4B"
    readonly property color muted: dark ? "#A0A6B2" : "#5B6170"
    readonly property color faint: dark ? "#8A909C" : "#6B7080"

    // Brand + status
    readonly property color accent:    "#FFD21F"
    readonly property color accentInk: "#111318"
    readonly property color accentSoft: dark ? "#3A3210" : "#FFF6CC"
    readonly property color inverse:   dark ? "#F2F3F5" : "#111318"
    readonly property color inverseInk: dark ? "#111318" : "#FFFFFF"
    readonly property color blue:      dark ? "#7C93FF" : "#1F3FD1"
    readonly property color blueSoft:  dark ? "#1D2547" : "#E5EAFE"
    readonly property color green:     "#12A150"
    readonly property color greenInk:  dark ? "#5FD992" : "#0E6B35"
    readonly property color greenSoft: dark ? "#14301F" : "#E2F5E8"
    readonly property color red:       "#E8412C"
    readonly property color redInk:    dark ? "#FF8A78" : "#C4321F"
    readonly property color redSoft:   dark ? "#3A1A16" : "#FDE5E1"
    readonly property color amberInk:  dark ? "#FFC85C" : "#8A5A00"
    readonly property color amberSoft: dark ? "#3A2B0E" : "#FFF1D6"
    readonly property color amberLine: dark ? "#6B5220" : "#F5D592"

    // Type
    readonly property string displayFont: pick(["Bricolage Grotesque", "Avenir Next", "Segoe UI Variable Display", "Segoe UI", "Helvetica Neue"])
    readonly property string bodyFont: pick(["Inter", "Segoe UI Variable Text", "Segoe UI", "Helvetica Neue", "Arial"])
    readonly property string adFont: pick(["Helvetica", "Arial", "Liberation Sans"])
    readonly property string layerFont: pick(["Inter", "Helvetica Neue", "Arial"])

    // Radii / spacing
    readonly property int radiusS: 9
    readonly property int radiusM: 12
    readonly property int radiusL: 16
    readonly property int radiusXL: 22
    readonly property int radiusXXL: 28

    function pick(list) {
        const available = Qt.fontFamilies()
        for (let i = 0; i < list.length; ++i)
            if (available.indexOf(list[i]) >= 0)
                return list[i]
        return Qt.application.font.family
    }

    // "#rrggbb" + alpha 0..1
    function alpha(c, a) { return Qt.rgba(c.r, c.g, c.b, a) }
}
