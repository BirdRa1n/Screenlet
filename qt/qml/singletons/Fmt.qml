pragma Singleton
import QtQuick

// Formatting helpers (pt-BR).
QtObject {
    readonly property var formats: ({
        tv:        { width: 1920, height: 1080, label: "TV / Monitor", short: "TV", dims: "1920 × 1080 · 16:9" },
        instagram: { width: 1080, height: 1080, label: "Instagram", short: "IG", dims: "1080 × 1080 · 1:1" },
        stories:   { width: 1080, height: 1920, label: "Stories", short: "Stories", dims: "1080 × 1920 · 9:16" },
        tiktok:    { width: 1080, height: 1920, label: "TikTok", short: "TikTok", dims: "1080 × 1920 · 9:16" }
    })

    function bytes(n) {
        if (!n) return "0 B"
        const u = ["B", "KB", "MB", "GB"]
        let i = 0
        while (n >= 1024 && i < u.length - 1) { n /= 1024; ++i }
        return (i === 0 ? n : n.toFixed(1)).toString().replace(".", ",") + " " + u[i]
    }

    function seconds(frames, fps) {
        const s = frames / (fps || 30)
        return (Math.round(s * 10) / 10).toString().replace(".", ",") + " s"
    }

    function clock(frames, fps) {
        const total = Math.floor(frames / (fps || 30))
        const m = Math.floor(total / 60), s = total % 60
        return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s
    }

    function date(iso) {
        if (!iso) return ""
        const d = new Date(iso)
        return d.toLocaleDateString(Qt.locale("pt_BR"), "dd MMM yyyy")
    }

    function relative(iso) {
        if (!iso) return ""
        const d = new Date(iso)
        const diff = (Date.now() - d.getTime()) / 1000
        if (diff < 60) return "agora"
        if (diff < 3600) return "há " + Math.floor(diff / 60) + " min"
        if (diff < 86400) return "há " + Math.floor(diff / 3600) + " h"
        const days = Math.floor(diff / 86400)
        if (days === 1) return "ontem"
        if (days < 7) return "há " + days + " dias"
        return date(iso)
    }

    function price(v) {
        return Number(v).toFixed(2).replace(".", ",")
    }

    function weekdayShort(i) { return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][i] }

    function today() {
        return new Date().toLocaleDateString(Qt.locale("pt_BR"), "dddd, d 'de' MMMM")
    }

    function uuid() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0
            return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16)
        })
    }

    function shortId() { return Math.random().toString(36).slice(2, 10) }

    function clone(o) { return JSON.parse(JSON.stringify(o)) }
}
