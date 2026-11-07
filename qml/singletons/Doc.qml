pragma Singleton
import QtQuick
import Screenlet

// The ad currently open in the editor (AdConfig + project identity).
// Every mutation replaces `config` with a new object so bindings update.
QtObject {
    id: doc

    property string projectId: ""
    property string name: ""
    property var config: buildPreset("generico")
    property string selectedId: config.scenes.length ? config.scenes[0].id : ""
    property bool dirty: false
    property int seekRequest: -1

    readonly property var scenes: config.scenes
    readonly property int totalFrames: scenes.reduce((a, s) => a + (s.durationInFrames || 0), 0)
    readonly property var selected: scenes.find(s => s.id === selectedId) || null

    // ── Lifecycle ──────────────────────────────────────────────────────────
    function newFrom(cfg, displayName) {
        projectId = ""
        name = displayName || ""
        config = cfg
        selectedId = cfg.scenes.length ? cfg.scenes[0].id : ""
        dirty = true
    }

    function open(id) {
        const p = Projects.load(id)
        if (!p || !p.config)
            return false
        projectId = p.id
        name = p.name
        const c = p.config
        if (!c.scenes) c.scenes = []
        if (!c.fps) c.fps = 30
        if (!c.width) { c.width = 1920; c.height = 1080 }
        config = c
        selectedId = c.scenes.length ? c.scenes[0].id : ""
        dirty = false
        return true
    }

    function save(displayName) {
        if (displayName !== undefined)
            name = displayName
        projectId = Projects.save(projectId, name, config)
        dirty = false
        return projectId
    }

    // ── Scenes ─────────────────────────────────────────────────────────────
    function setScenes(list) {
        const c = Object.assign({}, config)
        c.scenes = list
        config = c
        dirty = true
    }

    function setLogo(path) {
        const c = Object.assign({}, config)
        c.logoImage = path
        config = c
        dirty = true
    }

    function select(id) {
        selectedId = id
        seekRequest = sceneStart(id) + Math.min(30, Math.floor((sceneById(id) ? sceneById(id).durationInFrames : 0) * 0.35))
    }

    function sceneById(id) { return scenes.find(s => s.id === id) || null }

    function sceneStart(id) {
        let f = 0
        for (const s of scenes) {
            if (s.id === id) return f
            f += s.durationInFrames
        }
        return 0
    }

    function sceneAtFrame(frame) {
        let f = 0
        for (const s of scenes) {
            if (frame < f + s.durationInFrames) return s
            f += s.durationInFrames
        }
        return scenes.length ? scenes[scenes.length - 1] : null
    }

    function add(scene) {
        setScenes(scenes.concat([scene]))
        select(scene.id)
    }

    function update(id, patch) {
        setScenes(scenes.map(s => s.id === id ? Object.assign({}, s, patch) : s))
    }

    function remove(id) {
        const idx = scenes.findIndex(s => s.id === id)
        const list = scenes.filter(s => s.id !== id)
        setScenes(list)
        if (selectedId === id)
            selectedId = list.length ? list[Math.max(0, idx - 1)].id : ""
    }

    function move(id, dir) {
        const list = scenes.slice()
        const i = list.findIndex(s => s.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= list.length) return
        const t = list[i]; list[i] = list[j]; list[j] = t
        setScenes(list)
    }

    function moveTo(from, to) {
        if (from === to || from < 0 || to < 0) return
        const list = scenes.slice()
        const [s] = list.splice(from, 1)
        list.splice(to, 0, s)
        setScenes(list)
    }

    function duplicate(id) {
        const s = sceneById(id)
        if (!s) return
        const copy = JSON.parse(JSON.stringify(s))
        copy.id = Fmt.shortId()
        const list = scenes.slice()
        list.splice(list.findIndex(x => x.id === id) + 1, 0, copy)
        setScenes(list)
        select(copy.id)
    }

    // ── Factories (same defaults as the Electron build) ────────────────────
    function logoScene(o) {
        return Object.assign({ type: "logo", id: Fmt.shortId(), tagline: "Ofertas imperdíveis para você!",
                               taglineColor: "#ffffff", bg: "#0B5E1F", durationInFrames: 60 }, o || {})
    }

    function productScene(o) {
        return Object.assign({
            type: "product", id: Fmt.shortId(), image: "", productName: "Nome do Produto", productNameColor: "#ffffff",
            priceMode: "offer", oldPrice: "0,00", oldPriceColor: "#ffffff", newPrice: "0,00", priceSuffix: "",
            bg: "#1A1A1A", accentColor: "#FFD500", badgeColor: "#E10600", badgeText: "Oferta por tempo limitado",
            badgeTextColor: "#ffffff", durationInFrames: 150, showLogoOverlay: false, logoPosition: "top-right"
        }, o || {})
    }

    function templateScene(templateId) {
        const t = Templates.find(templateId)
        let frames = 0
        if (t && t.scenes) for (const s of t.scenes) frames += s.durationInFrames
        return { type: "template", id: Fmt.shortId(), templateId: templateId || "", values: {},
                 durationInFrames: frames > 0 ? frames : 150 }
    }

    function videoScene(src) {
        return { type: "video", id: Fmt.shortId(), src: src || "", volume: 1, durationInFrames: 150 }
    }

    function fromLibrary(p) {
        const snap = { image: p.image || "", productName: p.name || "", priceMode: p.priceMode || "offer",
                       oldPrice: p.oldPrice || "", newPrice: p.newPrice || "", priceSuffix: p.priceSuffix || "",
                       badgeText: p.badgeText || "" }
        return productScene(Object.assign({}, snap, { libraryProductId: p.id, librarySnapshot: snap }))
    }

    // Library drift: only fields the LIBRARY changed since import count, so
    // the user's own scene edits survive.
    readonly property var snapshotLabels: ({ image: "imagem", productName: "nome", priceMode: "modo de preço",
                                             oldPrice: "preço anterior", newPrice: "preço", priceSuffix: "sufixo",
                                             badgeText: "selo" })
    function driftFor(scene, product) {
        const current = { image: product.image || "", productName: product.name || "", priceMode: product.priceMode || "offer",
                          oldPrice: product.oldPrice || "", newPrice: product.newPrice || "",
                          priceSuffix: product.priceSuffix || "", badgeText: product.badgeText || "" }
        const snap = scene.librarySnapshot
        const changed = []
        const patch = {}
        for (const k in current) {
            const baseline = snap ? snap[k] : scene[k]
            if (current[k] !== baseline) {
                changed.push(snapshotLabels[k])
                patch[k] = current[k]
            }
        }
        if (!changed.length) return null
        patch.librarySnapshot = current
        return { patch: patch, changed: changed }
    }

    function buildPreset(id) {
        const base = { fps: 30, width: 1920, height: 1080, logoImage: "" }
        const P = (o) => productScene(o)
        const L = (o) => logoScene(o)
        switch (id) {
        case "carnes":
            return Object.assign(base, { scenes: [
                L({ tagline: "Semana do Churrasco! Carnes selecionadas.", bg: "#0B5E1F" }),
                P({ image: "assets/products/picanha-steak.png", productName: "Picanha Bovina", oldPrice: "79,90", newPrice: "69,90", priceSuffix: "/kg", bg: "#241312", accentColor: "#FF8A00", badgeColor: "#C81F1F" }),
                P({ image: "assets/products/beef-ribs.png", productName: "Costela Bovina", oldPrice: "39,90", newPrice: "34,90", priceSuffix: "/kg", bg: "#1c1c1c", accentColor: "#FF8A00", badgeColor: "#C81F1F" }),
                L({ tagline: "Garanta já a sua carne para o fim de semana!", bg: "#0B5E1F" }) ] })
        case "natal":
            return Object.assign(base, { scenes: [
                L({ tagline: "Feliz Natal! Ofertas especiais de fim de ano.", bg: "#7A0D0D" }),
                P({ image: "assets/products/panettone.png", productName: "Panetone Tradicional", oldPrice: "45,00", newPrice: "32,90", bg: "#7A0D0D", accentColor: "#FFD700", badgeColor: "#0B5E1F" }),
                P({ image: "assets/products/sparkling-wine.png", productName: "Espumante Brut", oldPrice: "39,90", newPrice: "29,90", bg: "#0B5E1F", accentColor: "#FFD700", badgeColor: "#7A0D0D" }),
                L({ tagline: "Boas festas! Venha celebrar com a gente.", bg: "#7A0D0D" }) ] })
        case "pascoa":
            return Object.assign(base, { scenes: [
                L({ tagline: "Feliz Páscoa! Doçura para toda a família.", bg: "#B07CC6" }),
                P({ image: "assets/products/easter-egg.png", productName: "Ovo de Chocolate", oldPrice: "89,90", newPrice: "69,90", bg: "#B07CC6", accentColor: "#FFF1A6", badgeColor: "#5B2A86", durationInFrames: 180 }),
                L({ tagline: "Aproveite as ofertas de Páscoa enquanto durarem!", bg: "#B07CC6" }) ] })
        default:
            return Object.assign(base, { scenes: [
                L({ tagline: "Ofertas imperdíveis para você!", bg: "#0B5E1F" }),
                P({ image: "assets/products/toothpick-stack.png", productName: "Pilhas Duracell AA", oldPrice: "14,00", newPrice: "12,95", bg: "#1A1A1A", durationInFrames: 165 }),
                P({ image: "assets/products/milk-can.png", productName: "Leite Ninho Fases 1+ 800g", oldPrice: "65,00", newPrice: "59,95", bg: "#C81F1F", durationInFrames: 165 }),
                L({ tagline: "Corra! Ofertas válidas enquanto durarem os estoques.", bg: "#0B5E1F" }) ] })
        }
    }

    // Preset look applied to the wizard's products (fixes: the Electron
    // wizard ignored the chosen preset).
    readonly property var presetStyles: ({
        generico: { bgs: ["#1A1A1A", "#C81F1F"], accent: "", badge: "#E10600", logoBg: "" },
        carnes:   { bgs: ["#241312", "#1c1c1c"], accent: "#FF8A00", badge: "#C81F1F", logoBg: "#0B5E1F" },
        natal:    { bgs: ["#7A0D0D", "#0B5E1F"], accent: "#FFD700", badge: "#0B5E1F", logoBg: "#7A0D0D" },
        pascoa:   { bgs: ["#B07CC6", "#5B2A86"], accent: "#FFF1A6", badge: "#5B2A86", logoBg: "#B07CC6" }
    })
}
