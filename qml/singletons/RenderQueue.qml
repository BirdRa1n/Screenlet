pragma Singleton
import QtQuick
import Screenlet

// Batch "update + re-render" for ads whose library products changed.
// Each ad is first refreshed with the library data, then re-rendered to the
// SAME video file(s) it was exported to — overwriting a file makes every
// channel that plays it resync automatically (Kodi restart, player manifest).
// Jobs run one after another; the queue survives page navigation.
QtObject {
    id: q

    property var jobs: []          // { uid, projectId, name, filename, format, fps, status, error }
    property int seq: 0
    readonly property int pending: jobs.filter(j => j.status === "queued" || j.status === "rendering").length
    readonly property int doneCount: jobs.filter(j => j.status === "done").length
    readonly property var current: jobs.find(j => j.status === "rendering") || null
    readonly property bool active: pending > 0

    signal finished(int done, int failed)

    property Connections rendererWatch: Connections {
        target: Renderer
        function onStateChanged() { if (!Renderer.busy) Qt.callLater(q.pump) }
    }

    // Electron saved "<project name>.mp4" with [^a-zA-Z0-9.-_] → "_".
    function legacyFilename(name) { return String(name || "").replace(/[^a-zA-Z0-9.\-_]/g, "_") + ".mp4" }

    // Applies library drift to one project (through Doc when it's open, so
    // the editor never overwrites the update with stale data).
    function refreshProject(projectId) {
        const p = Projects.load(projectId)
        if (!p || !p.config) return 0
        let count = 0
        const scenes = (p.config.scenes || []).map(s => {
            if (s.type !== "product" || !s.libraryProductId) return s
            const prod = Library.find(s.libraryProductId)
            if (!prod || !prod.id) return s
            const d = Doc.driftFor(s, prod)
            if (!d) return s
            count++
            return Object.assign({}, s, d.patch)
        })
        if (!count) return 0
        if (Doc.projectId === projectId) {
            for (const s of scenes) Doc.update(s.id, s)
            Doc.save()
        } else {
            Projects.save(projectId, p.name, Object.assign({}, p.config, { scenes: scenes }))
        }
        return count
    }

    // Video files this project feeds: recorded exports, or the Electron-era
    // file named after the project.
    function targetsFor(projectId) {
        const p = Projects.load(projectId)
        const out = []
        const seen = {}
        for (const e of (p.exports || [])) {
            if (!e.filename || seen[e.filename]) continue
            seen[e.filename] = true
            out.push({ filename: e.filename, format: e.format || "tv", fps: e.fps || 30 })
        }
        if (!out.length) {
            const legacy = legacyFilename(p.name)
            if (Exports.items.some(x => x.filename === legacy))
                out.push({ filename: legacy, format: "tv", fps: 30 })
        }
        return out
    }

    function isQueued(projectId) { return jobs.some(j => j.projectId === projectId && (j.status === "queued" || j.status === "rendering")) }

    // Update + enqueue. Returns { updated, queued, withoutVideo }.
    function enqueue(projectIds) {
        let updated = 0, queued = 0, withoutVideo = []
        const add = []
        for (const id of projectIds) {
            if (isQueued(id)) continue
            if (refreshProject(id) > 0) updated++
            const targets = targetsFor(id)
            const meta = Projects.items.find(x => x.id === id) || {}
            if (!targets.length) { withoutVideo.push(meta.name || id); continue }
            for (const t of targets) {
                seq++
                add.push({ uid: seq, projectId: id, name: meta.name || id, filename: t.filename, format: t.format, fps: t.fps, status: "queued", error: "" })
                queued++
            }
        }
        if (add.length) jobs = jobs.filter(j => j.status !== "done" && j.status !== "error").concat(add)
        if (withoutVideo.length)
            Toasts.info(withoutVideo.length + " anúncio(s) atualizado(s), mas ainda sem vídeo renderizado: " + withoutVideo.join(", "))
        Qt.callLater(pump)
        return { updated: updated, queued: queued, withoutVideo: withoutVideo.length }
    }

    function setStatus(uid, status, error) {
        jobs = jobs.map(j => j.uid === uid ? Object.assign({}, j, { status: status, error: error || "" }) : j)
    }

    function pump() {
        if (Renderer.busy || current) return
        const job = jobs.find(j => j.status === "queued")
        if (!job) return
        const p = Projects.load(job.projectId)
        if (!p || !p.config) { setStatus(job.uid, "error", "Anúncio não encontrado."); Qt.callLater(pump); return }
        const f = Fmt.formats[job.format] || Fmt.formats.tv
        setStatus(job.uid, "rendering")
        Renderer.exportVideo(Object.assign({}, p.config, { width: f.width, height: f.height }), job.filename, job.fps, job.format, job.projectId, function (r) {
            setStatus(job.uid, r.ok ? "done" : "error", r.ok ? "" : r.error)
            if (r.ok)
                for (const c of r.updatedChannels || [])
                    Toasts.info("Canal \"" + c.name + "\" atualizado com o novo \"" + job.name + "\".")
            else
                Toasts.error("Falha ao renderizar \"" + job.name + "\": " + r.error)
            if (!jobs.some(j => j.status === "queued" || j.status === "rendering")) {
                const done = jobs.filter(j => j.status === "done").length
                const failed = jobs.filter(j => j.status === "error").length
                if (done) Toasts.success(done + " vídeo(s) atualizado(s) e programação sincronizada.")
                q.finished(done, failed)
            }
            Qt.callLater(pump)
        })
    }

    function cancel() {
        jobs = jobs.filter(j => j.status !== "queued")
        if (current) Renderer.cancel()
    }

    function clearFinished() { jobs = jobs.filter(j => j.status === "queued" || j.status === "rendering") }
}
