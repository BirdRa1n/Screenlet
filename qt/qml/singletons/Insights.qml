pragma Singleton
import QtQuick
import Screenlet

// Derived, cross-service state for the management views: ad status
// (no ar / agendado / pronto / rascunho), screens online, price drift.
QtObject {
    id: ins

    property int tick: 0          // bump to recompute time-based values
    property Timer clock: Timer { interval: 30000; running: true; repeat: true; onTriggered: ins.tick++ }

    readonly property var enabledChannels: Channels.items.filter(c => c.enabled !== false)

    function channelsForFile(filename) {
        const out = []
        for (const c of enabledChannels) {
            const inPlaylist = (c.playlist || []).some(i => i.filename === filename)
            const inRules = (c.rules || []).some(r => r.assetFilename === filename)
            if (inPlaylist || inRules) out.push({ channel: c, playlist: inPlaylist, rules: inRules })
        }
        return out
    }

    // { kind, label, channels: [names], formats: [..] }
    function adStatus(project) {
        tick
        const exports = project.exports || []
        const formats = []
        for (const e of exports) if (e.format && formats.indexOf(e.format) < 0) formats.push(e.format)
        let names = [], live = false, scheduled = false
        for (const e of exports) {
            for (const u of channelsForFile(e.filename)) {
                if (names.indexOf(u.channel.name) < 0) names.push(u.channel.name)
                const now = Channels.currentAsset(u.channel)
                if (now === e.filename || (u.playlist && !(u.channel.rules || []).length)) live = true
                else if (u.playlist) live = true
                else scheduled = true
            }
        }
        if (live) return { kind: "live", label: "No ar", channels: names, formats: formats }
        if (scheduled) return { kind: "scheduled", label: "Agendado", channels: names, formats: formats }
        if (exports.length) return { kind: "neutral", label: "Pronto", channels: names, formats: formats }
        return { kind: "draft", label: "Rascunho", channels: names, formats: formats }
    }

    function playerOnline(p) {
        tick
        return !!p.lastSeenAt && (Date.now() - new Date(p.lastSeenAt).getTime()) < 120000
    }

    readonly property var pairedPlayers: Players.items.filter(p => p.paired)
    readonly property var unpairedPlayers: Players.items.filter(p => !p.paired)
    readonly property int screensTotal: pairedPlayers.length + Kodi.items.length
    readonly property int screensOnline: pairedPlayers.filter(p => playerOnline(p)).length

    // Projects with library scenes whose product changed since import.
    // [{ projectId, projectName, scenes: [{ sceneId, name, changed }] }]
    function priceDrift() {
        const byId = {}
        for (const p of Library.items) byId[p.id] = p
        const out = []
        for (const meta of Projects.items) {
            const proj = Projects.load(meta.id)
            if (!proj || !proj.config) continue
            const scenes = []
            for (const s of proj.config.scenes || []) {
                if (s.type !== "product" || !s.libraryProductId || !byId[s.libraryProductId]) continue
                const d = Doc.driftFor(s, byId[s.libraryProductId])
                if (d) scenes.push({ sceneId: s.id, name: byId[s.libraryProductId].name, changed: d.changed })
            }
            if (scenes.length) out.push({ projectId: meta.id, projectName: meta.name, scenes: scenes })
        }
        return out
    }

    // Upcoming programming for today: [{ when, name, channel, kind }]
    function upcoming(limit) {
        tick
        const out = []
        const now = new Date()
        const mins = now.getHours() * 60 + now.getMinutes()
        for (const c of enabledChannels) {
            for (const r of c.rules || []) {
                if (r.schedule && r.schedule.type === "time-range") {
                    const [h, m] = (r.schedule.startTime || "0:0").split(":").map(Number)
                    const start = h * 60 + m
                    if (start > mins) out.push({ sort: start, when: r.schedule.startTime, name: r.assetName, channel: c.name, kind: "rule" })
                }
            }
        }
        out.sort((a, b) => a.sort - b.sort)
        return out.slice(0, limit || 4)
    }
}
