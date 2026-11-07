pragma Singleton
import QtQuick
import Screenlet

// Every MP4 render goes through this queue, so renders keep running in the
// background while the user works elsewhere and more can be lined up.
//   - add(): one render from the dialog (editor, wizards), with a snapshot of
//     the config taken at click time — later edits don't leak into it.
//   - enqueue(): batch "update + re-render" for ads whose library products
//     changed; each ad is refreshed with the library data, then re-rendered to
//     the SAME file(s) — overwriting a file makes every channel that plays it
//     resync automatically (Kodi restart, player manifest).
// Jobs run one after another; the queue survives page navigation.
QtObject {
    id: q

    // { uid, kind: "manual"|"refresh", projectId, name, filename, format, fps, config?, status, error }
    property var jobs: []
    property int seq: 0
    readonly property int pending: jobs.filter(j => j.status === "queued" || j.status === "rendering").length
    readonly property int doneCount: jobs.filter(j => j.status === "done").length
    readonly property var current: jobs.find(j => j.status === "rendering") || null
    readonly property bool active: pending > 0

    signal finished(int done, int failed)
    signal jobFinished(int uid, var result)

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
                add.push({ uid: seq, kind: "refresh", projectId: id, name: meta.name || id, filename: t.filename, format: t.format, fps: t.fps, status: "queued", error: "" })
                queued++
            }
        }
        if (add.length) jobs = jobs.filter(j => j.status !== "done" && j.status !== "error").concat(add)
        if (withoutVideo.length)
            Toasts.info(withoutVideo.length + " anúncio(s) atualizado(s), mas ainda sem vídeo renderizado: " + withoutVideo.join(", "))
        Qt.callLater(pump)
        return { updated: updated, queued: queued, withoutVideo: withoutVideo.length }
    }

    // One render with a fixed config (already sized for its format).
    // Returns the job uid; watch jobFinished(uid, result) for the outcome.
    function add(opts) {
        seq++
        const filename = String(opts.filename || "anuncio")
        const job = {
            uid: seq, kind: "manual", projectId: opts.projectId || "", name: opts.name || filename,
            filename: /\.mp4$/i.test(filename) ? filename : filename + ".mp4",
            format: opts.format || "tv", fps: opts.fps || 30,
            config: JSON.parse(JSON.stringify(opts.config)),
            status: "queued", error: ""
        }
        jobs = jobs.filter(j => j.status !== "done" && j.status !== "error").concat([job])
        Qt.callLater(pump)
        return job.uid
    }

    function job(uid) { return jobs.find(j => j.uid === uid) || null }

    // 0 = rendering now, 1 = next, …; -1 when not pending.
    function positionOf(uid) {
        const pending = jobs.filter(j => j.status === "queued" || j.status === "rendering")
        return pending.findIndex(j => j.uid === uid)
    }

    function cancelJob(uid) {
        const j = job(uid)
        if (!j) return
        if (j.status === "rendering") Renderer.cancel()
        else if (j.status === "queued") jobs = jobs.filter(x => x.uid !== uid)
    }

    function setStatus(uid, status, error) {
        jobs = jobs.map(j => j.uid === uid ? Object.assign({}, j, { status: status, error: error || "" }) : j)
    }

    function pump() {
        if (Renderer.busy || current) return
        const job = jobs.find(j => j.status === "queued")
        if (!job) return
        let config = job.config
        if (!config) {
            const p = Projects.load(job.projectId)
            if (!p || !p.config) { setStatus(job.uid, "error", "Anúncio não encontrado."); Qt.callLater(pump); return }
            const f = Fmt.formats[job.format] || Fmt.formats.tv
            config = Object.assign({}, p.config, { width: f.width, height: f.height })
        }
        setStatus(job.uid, "rendering")
        Renderer.exportVideo(config, job.filename, job.fps, job.format, job.projectId, function (r) {
            setStatus(job.uid, r.ok ? "done" : "error", r.ok ? "" : r.error)
            if (r.ok) {
                if (job.kind === "manual") Toasts.success("Vídeo \"" + r.filename + "\" pronto!")
                for (const c of r.updatedChannels || [])
                    Toasts.info(job.kind === "manual" ? "O canal \"" + c.name + "\" foi atualizado — as telas estão sendo sincronizadas."
                                                      : "Canal \"" + c.name + "\" atualizado com o novo \"" + job.name + "\".")
            } else if (r.error === "Renderização cancelada.") {
                Toasts.info("Renderização de \"" + job.filename + "\" cancelada.")
            } else {
                Toasts.error("Falha ao renderizar \"" + job.name + "\": " + r.error)
            }
            q.jobFinished(job.uid, r)
            if (!jobs.some(j => j.status === "queued" || j.status === "rendering")) {
                const done = jobs.filter(j => j.status === "done").length
                const failed = jobs.filter(j => j.status === "error").length
                if (jobs.some(j => j.kind === "refresh" && j.status === "done"))
                    Toasts.success(done + " vídeo(s) atualizado(s) e programação sincronizada.")
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
