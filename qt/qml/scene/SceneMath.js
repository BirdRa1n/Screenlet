.pragma library

// Frame math for the ad scenes — a faithful port of the Remotion helpers the
// Electron build used (interpolate, spring, Easing), so existing projects
// look the same. See docs/05-motor-de-video.md.

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }

// Piecewise-linear interpolate with optional clamping and easing.
function interpolate(x, input, output, opts) {
    const o = opts || {}
    if (o.left !== false && x <= input[0]) return output[0]
    if (o.right !== false && x >= input[input.length - 1]) return output[output.length - 1]
    let i = 1
    while (i < input.length - 1 && x > input[i]) ++i
    const x0 = input[i - 1], x1 = input[i]
    const y0 = output[i - 1], y1 = output[i]
    let t = x1 === x0 ? 0 : (x - x0) / (x1 - x0)
    if (o.easing) t = o.easing(clamp(t, 0, 1))
    return y0 + (y1 - y0) * t
}

// Damped spring 0 → 1 (stiffness 100 by default), t = frame/fps — the same
// model Remotion uses (React Native's spring): underdamped springs oscillate,
// and ANY damping at or above critical is treated as critically damped.
// (`damping: 200`, used by the default scenes, is ~10× critical; a true
// overdamped solution is both far slower and numerically explosive — that
// caused the "slow zoom, then snap" glitch.)
function spring(frame, fps, damping, mass, stiffness) {
    if (frame <= 0) return 0
    const k = stiffness || 100, m = mass || 1, c = damping === undefined ? 10 : damping
    const t = frame / fps
    const w0 = Math.sqrt(k / m)
    const zeta = c / (2 * Math.sqrt(k * m))
    if (zeta < 1) {
        const w1 = w0 * Math.sqrt(1 - zeta * zeta)
        return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(w1 * t) + (zeta * w0 / w1) * Math.sin(w1 * t))
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t)
}

// cubic-bezier(x1, y1, x2, y2) solver (for Easing.ease = .42,0,1,1).
function bezier(x1, y1, x2, y2) {
    function a(p1, p2) { return 1 - 3 * p2 + 3 * p1 }
    function b(p1, p2) { return 3 * p2 - 6 * p1 }
    function c(p1) { return 3 * p1 }
    function calc(t, p1, p2) { return ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t }
    function slope(t, p1, p2) { return 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1) }
    return function (x) {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let t = x
        for (let i = 0; i < 8; ++i) {
            const s = slope(t, x1, x2)
            if (Math.abs(s) < 1e-6) break
            t -= (calc(t, x1, x2) - x) / s
        }
        return calc(clamp(t, 0, 1), y1, y2)
    }
}

const ease = bezier(0.42, 0, 1, 1)
function easeIn(t) { return ease(t) }
function easeOut(t) { return 1 - ease(1 - t) }
function easeInOut(t) { return t < 0.5 ? ease(2 * t) / 2 : 1 - ease(2 * (1 - t)) / 2 }

function easingFor(name) {
    switch (name) {
    case "easeIn": return easeIn
    case "easeOut": return easeOut
    case "easeInOut": return easeInOut
    default: return function (t) { return t }
    }
}

// ── Template layer animations ─────────────────────────────────────────────

function animProgress(frame, a) {
    return interpolate(frame, [a.startFrame, a.startFrame + a.durationInFrames], [0, 1], { easing: easingFor(a.easing) })
}

// Returns { opacity, tx, ty, scale, rot, glowBlur } for a layer at `frame`.
// Animations outside their window have no effect (Electron behavior).
function resolveLayer(frame, animations, baseOpacity) {
    const r = { opacity: baseOpacity === undefined ? 1 : baseOpacity, tx: 0, ty: 0, scale: 1, rot: 0, glowBlur: 0 }
    const list = animations || []
    for (let i = 0; i < list.length; ++i) {
        const a = list[i]
        if (frame < a.startFrame || frame > a.startFrame + a.durationInFrames) continue
        const p = animProgress(frame, a)
        switch (a.type) {
        case "fadeIn": r.opacity *= p; break
        case "fadeOut": r.opacity *= 1 - p; break
        case "slideLeft": r.tx += 120 * (1 - p); r.opacity *= p; break
        case "slideRight": r.tx += -120 * (1 - p); r.opacity *= p; break
        case "slideUp": r.ty += 80 * (1 - p); r.opacity *= p; break
        case "slideDown": r.ty += -80 * (1 - p); r.opacity *= p; break
        case "zoomIn": r.scale *= 0.4 + 0.6 * p; r.opacity *= p; break
        case "zoomOut": r.scale *= 1 - 0.6 * p; r.opacity *= 1 - p; break
        case "scale": r.scale *= 0.7 + 0.3 * p; break
        case "slideOut": r.tx += 200 * p; r.opacity *= 1 - p; break
        case "rotate": r.rot += 360 * p; break
        case "pulse": r.scale *= 1 + 0.06 * Math.sin(p * Math.PI * 4); break
        case "bounce": r.ty += -Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p) * 40; break
        case "shake": {
            const k = interpolate(p, [0, 0.7, 1], [8, 8, 0])
            r.tx += Math.sin((frame - a.startFrame) * 1.8) * k
            break
        }
        case "glow": {
            r.scale *= 1 + 0.04 * Math.sin(p * Math.PI * 6)
            const elapsed = frame - a.startFrame
            const intensity = 0.5 + 0.5 * Math.sin((elapsed / a.durationInFrames) * Math.PI * 6)
            r.glowBlur = Math.round(8 + intensity * 16)
            break
        }
        default: break
        }
    }
    return r
}

function typewriter(text, frame, animations) {
    const list = animations || []
    for (let i = 0; i < list.length; ++i) {
        const a = list[i]
        if (a.type !== "typewriter") continue
        const elapsed = Math.max(0, frame - a.startFrame)
        const n = Math.min(text.length, Math.floor(elapsed * text.length / a.durationInFrames))
        return text.slice(0, n)
    }
    return text
}

// ── Templates ─────────────────────────────────────────────────────────────

const VAR = /\{\{([A-Z0-9_]+)\}\}/g

function resolveString(s, values) {
    return (s || "").replace(VAR, function (_, k) { return values[k] !== undefined ? values[k] : "" })
}

function mergedValues(template, values) {
    const out = {}
    const vars = (template && template.variables) || []
    for (let i = 0; i < vars.length; ++i) {
        const v = vars[i]
        const given = values ? values[v.key] : undefined
        out[v.key] = (given !== undefined && given !== null) ? given : v.defaultValue
    }
    return out
}

function resolveLayerText(layer, values) {
    const l = Object.assign({}, layer)
    switch (l.type) {
    case "text": l.text = resolveString(l.text, values); break
    case "image": l.src = resolveString(l.src, values); break
    case "price":
        l.oldPrice = resolveString(l.oldPrice, values)
        l.newPrice = resolveString(l.newPrice, values)
        l.suffix = resolveString(l.suffix, values)
        break
    case "badge": l.text = resolveString(l.text, values); break
    default: break
    }
    return l
}

function templateFrames(t) {
    let f = 0
    const s = (t && t.scenes) || []
    for (let i = 0; i < s.length; ++i) f += s[i].durationInFrames
    return f
}

// ── CSS paint parsing (shape fill / scene background / border) ───────────

// "linear-gradient(135deg, #a 0%, #b 100%)" → { kind, angle, stops: [{color, pos}] }
function parsePaint(css) {
    const s = (css || "").trim()
    if (!s) return { kind: "solid", color: "transparent" }
    const m = /^(linear|radial)-gradient\((.*)\)$/i.exec(s)
    if (!m) return { kind: "solid", color: s }
    const parts = splitTop(m[2])
    let angle = 180
    if (m[1].toLowerCase() === "linear" && parts.length) {
        const first = parts[0].trim()
        const deg = /^(-?\d+(\.\d+)?)deg$/.exec(first)
        const dirs = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270,
                       "to top right": 45, "to bottom right": 135, "to bottom left": 225, "to top left": 315 }
        if (deg) { angle = parseFloat(deg[1]); parts.shift() }
        else if (dirs[first] !== undefined) { angle = dirs[first]; parts.shift() }
    } else if (parts.length && /circle|ellipse|at /.test(parts[0])) {
        parts.shift()
    }
    const stops = []
    for (let i = 0; i < parts.length; ++i) {
        const p = parts[i].trim()
        const pm = /^(.*?)\s+(-?\d+(\.\d+)?)%$/.exec(p)
        stops.push({ color: pm ? pm[1] : p, pos: pm ? parseFloat(pm[2]) / 100 : (parts.length > 1 ? i / (parts.length - 1) : 0) })
    }
    return { kind: m[1].toLowerCase(), angle: angle, stops: stops }
}

function splitTop(s) {
    const out = []
    let depth = 0, cur = ""
    for (let i = 0; i < s.length; ++i) {
        const ch = s[i]
        if (ch === "(") depth++
        if (ch === ")") depth--
        if (ch === "," && depth === 0) { out.push(cur); cur = "" } else cur += ch
    }
    if (cur.trim()) out.push(cur)
    return out
}

// "4px solid #fff" → { width, color }
function parseBorder(css) {
    const s = (css || "").trim()
    if (!s) return { width: 0, color: "transparent" }
    const w = /(\d+(\.\d+)?)px/.exec(s)
    const tokens = s.replace(/(\d+(\.\d+)?)px/, "").replace(/\b(solid|dashed|dotted|double)\b/, "").trim()
    return { width: w ? parseFloat(w[1]) : 1, color: tokens || "#000000" }
}

// ── Composition ───────────────────────────────────────────────────────────

function totalFrames(scenes) {
    let t = 0
    for (let i = 0; i < (scenes || []).length; ++i) t += scenes[i].durationInFrames || 0
    return t
}

// { index, start } of the scene containing `frame`.
function sceneAt(scenes, frame) {
    let start = 0
    for (let i = 0; i < (scenes || []).length; ++i) {
        const d = scenes[i].durationInFrames || 0
        if (frame < start + d) return { index: i, start: start }
        start += d
    }
    return { index: -1, start: start }
}
