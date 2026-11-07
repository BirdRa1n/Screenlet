pragma Singleton
import QtQuick

// Motion language of proposal B: elastic springs for interaction, short
// fades for content, stamps for prices. Durations in ms.
QtObject {
    readonly property int fast: 140
    readonly property int base: 220
    readonly property int slow: 420
    readonly property int pop: 560
    readonly property int stagger: 55

    // OutBack overshoot ≈ the CSS cubic-bezier(.34,1.56,.64,1) used in the mockups.
    readonly property int springEasing: Easing.OutBack
    readonly property real springOvershoot: 1.6
    readonly property int easeOut: Easing.OutCubic

    readonly property bool reduced: false
}
