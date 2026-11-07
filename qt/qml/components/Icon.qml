import QtQuick
import QtQuick.Shapes

// Stroke icons (24×24 grid, lucide-style) drawn with Shape + PathSvg, so
// they stay crisp at any scale and recolor via `color`.
Item {
    id: root
    property string name: ""
    property color color: "#3A3F4B"
    property real size: 18
    property real stroke: 2
    property bool filled: false

    implicitWidth: size
    implicitHeight: size

    readonly property var paths: ({
        grid: ["M3 4.5A1.5 1.5 0 0 1 4.5 3h4A1.5 1.5 0 0 1 10 4.5v4A1.5 1.5 0 0 1 8.5 10h-4A1.5 1.5 0 0 1 3 8.5z",
               "M14 4.5A1.5 1.5 0 0 1 15.5 3h4A1.5 1.5 0 0 1 21 4.5v4A1.5 1.5 0 0 1 19.5 10h-4A1.5 1.5 0 0 1 14 8.5z",
               "M3 15.5A1.5 1.5 0 0 1 4.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5z",
               "M14 15.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5z"],
        megaphone: ["M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z", "M16 9a3 3 0 0 1 0 6", "M19 6a7 7 0 0 1 0 12"],
        layout: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M3 9h18", "M9 21V9"],
        box: ["M21 8 12 3 3 8v8l9 5 9-5z", "M3 8l9 5 9-5", "M12 13v8"],
        image: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M11 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0z", "m21 15-5-5L5 21"],
        film: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M7 3v18", "M17 3v18", "M3 8h4", "M3 16h4", "M17 8h4", "M17 16h4"],
        tv: ["M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z", "m17 2-5 5-5-5"],
        monitor: ["M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M8 21h8", "M12 17v4"],
        radio: ["M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0z", "M16.24 7.76a6 6 0 0 1 0 8.49", "M7.76 16.24a6 6 0 0 1 0-8.49", "M19.07 4.93a10 10 0 0 1 0 14.14", "M4.93 19.07a10 10 0 0 1 0-14.14"],
        settings: ["M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z", "M12 2v3", "M12 19v3", "M4.22 4.22l2.12 2.12", "M17.66 17.66l2.12 2.12", "M2 12h3", "M19 12h3", "M4.22 19.78l2.12-2.12", "M17.66 6.34l2.12-2.12"],
        plus: ["M12 5v14", "M5 12h14"],
        search: ["M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0z", "m20 20-3.5-3.5"],
        bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
        play: ["M7 4v16l13-8z"],
        pause: ["M7 4h3v16H7z", "M14 4h3v16h-3z"],
        chevronLeft: ["m15 18-6-6 6-6"],
        chevronRight: ["m9 18 6-6-6-6"],
        chevronDown: ["m6 9 6 6 6-6"],
        chevronUp: ["m18 15-6-6-6 6"],
        updown: ["m7 15 5 5 5-5", "m7 9 5-5 5 5"],
        tag: ["M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z", "M8 7.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z"],
        trash: ["M3 6h18", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6", "M10 11v6", "M14 11v6"],
        edit: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"],
        copy: ["M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z", "M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"],
        download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
        upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m17 8-5-5-5 5", "M12 3v12"],
        refresh: ["M21 12a9 9 0 1 1-3-6.7L21 8", "M21 3v5h-5"],
        check: ["M20 6 9 17l-5-5"],
        x: ["M18 6 6 18", "M6 6l12 12"],
        folder: ["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
        eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"],
        link: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
        unlink: ["M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71", "M8 2v3", "M2 8h3", "M16 22v-3", "M22 16h-3"],
        alert: ["M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"],
        info: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z", "M12 16v-4", "M12 8h.01"],
        clock: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z", "M12 6v6l4 2"],
        calendar: ["M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M16 2v4", "M8 2v4", "M3 10h18"],
        list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
        video: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M10 9l5 3-5 3z"],
        wand: ["M15 4V2", "M15 16v-2", "M8 9h2", "M20 9h2", "M17.8 11.8 19 13", "M15 9h.01", "M17.8 6.2 19 5", "m3 21 9-9", "M12.2 6.2 11 5"],
        file: ["M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z", "M14 3v6h6", "M8 13h8", "M8 17h5"],
        wifi: ["M5 12.55a11 11 0 0 1 14.08 0", "M1.42 9a16 16 0 0 1 21.16 0", "M8.53 16.11a6 6 0 0 1 6.95 0", "M12 20h.01"],
        more: ["M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"],
        sun: ["M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z", "M12 1v2", "M12 21v2", "M4.22 4.22l1.42 1.42", "M18.36 18.36l1.42 1.42", "M1 12h2", "M21 12h2", "M4.22 19.78l1.42-1.42", "M18.36 5.64l1.42-1.42"],
        moon: ["M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"],
        layers: ["m12 2 10 5-10 5L2 7z", "m2 17 10 5 10-5", "m2 12 10 5 10-5"],
        type: ["M4 7V4h16v3", "M9 20h6", "M12 4v16"],
        square: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"],
        circle: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"],
        dollar: ["M12 2v20", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
        hardDrive: ["M22 12H2", "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z", "M6 16h.01", "M10 16h.01"],
        cpu: ["M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M9 9h6v6H9z", "M9 1v3", "M15 1v3", "M9 20v3", "M15 20v3", "M20 9h3", "M20 14h3", "M1 9h3", "M1 14h3"],
        archive: ["M21 8v13H3V8", "M1 3h22v5H1z", "M10 12h4"],
        drag: ["M9 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M9 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M9 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M15 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M15 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M15 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"],
        flipH: ["M12 3v18", "M16 7l4 5-4 5z", "M8 7l-4 5 4 5z"],
        flipV: ["M3 12h18", "M7 8l5-4 5 4z", "M7 16l5 4 5-4z"],
        sparkles: ["M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"],
        store: ["M3 9l1-5h16l1 5", "M4 9v11h16V9", "M3 9h18", "M9 20v-6h6v6"],
        lock: ["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z", "M7 11V7a5 5 0 0 1 10 0v4"],
        shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "m9 12 2 2 4-4"],
        logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"]
    })

    Shape {
        id: shape
        anchors.centerIn: parent
        width: 24
        height: 24
        scale: root.size / 24
        preferredRendererType: Shape.CurveRenderer
    }

    // One ShapePath per sub-path; icons never change name after creation in
    // practice, but a name change rebuilds cleanly.
    Instantiator {
        model: root.paths[root.name] || []
        delegate: ShapePath {
            required property string modelData
            strokeColor: root.color
            strokeWidth: root.stroke
            fillColor: root.filled ? root.color : "transparent"
            capStyle: ShapePath.RoundCap
            joinStyle: ShapePath.RoundJoin
            PathSvg { path: modelData }
        }
        onObjectAdded: (index, object) => shape.data.push(object)
        onObjectRemoved: (index, object) => {
            const kept = []
            for (let i = 0; i < shape.data.length; ++i)
                if (shape.data[i] !== object) kept.push(shape.data[i])
            shape.data = kept
        }
    }
}
