/**
 * PARASITE EXHIBITION — OFFLINE ACTIVITY (isolated module)
 * Chrome 109 / Manifest V3. Draws a local analytic field behind
 * the original organism. Never navigates, writes storage or requests
 * external resources. Remove its script tag to revert completely.
 */
(() => {
    "use strict";

    const habitat = document.getElementById("parasite-offline-habitat");
    const organismCanvas = document.getElementById("parasite-offline-canvas");
    if (!habitat || !organismCanvas) return;

    const layer = document.createElement("canvas");
    layer.id = "parasite-offline-activity-canvas";
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
        zIndex: "0"
    });
    habitat.insertBefore(layer, organismCanvas);
    // The existing organism remains above the additional drawing layer.
    organismCanvas.style.zIndex = "1";
    const ctx = layer.getContext("2d");
    if (!ctx) {
        layer.remove();
        organismCanvas.style.zIndex = "";
        return;
    }

    const MAX_SOURCES = 14;
    const MAX_TRACES = 18;
    const FRAME_MS = 50; // roughly 20 FPS on the older notebook
    const modes = ["SCAN", "SELECT", "REJECT", "RECOMBINE", "RESIDUE"];
    const state = {
        sources: [],
        focus: -1,
        previous: -1,
        mode: "RESIDUE",
        charge: 0.36,
        traces: [],
        nextDecisionAt: 0,
        previousFrameAt: 0,
        width: 1,
        height: 1,
        decisions: 0,
        hasMemory: false
    };

    const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
    const random = (lo, hi) => lo + Math.random() * (hi - lo);

    function hash(value) {
        let h = 2166136261;
        for (let i = 0; i < value.length; i++) {
            h ^= value.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function makeSource(value, kind) {
        if (typeof value !== "string" || !value) return null;
        let label = value;
        if (kind === "url") {
            try {
                const url = new URL(value);
                if (url.protocol !== "https:" && url.protocol !== "http:") {
                    return null;
                }
                label = url.hostname.replace(/^www\./, "");
            } catch {
                return null;
            }
        }
        const key = kind + ":" + value;
        return {
            key,
            label: label.slice(0, 36),
            kind,
            hits: 0,
            relevance: 0.3 + (hash(key) % 100) / 200
        };
    }

    async function loadSources() {
        const collected = [];
        try {
            const stored = await chrome.storage.local.get("parasiteState");
            const memory = stored.parasiteState;
            if (memory?.memoryVersion === 1 &&
                Array.isArray(memory.graph?.nodes)) {
                memory.graph.nodes.slice(-250).forEach(node => {
                    if (node?.type === "destination") {
                        const source = makeSource(node.href, "url");
                        if (source) collected.push(source);
                    }
                });
            }
        } catch (error) {
            console.warn("[PARASITE OFFLINE] MEMORY READ FAILED", error);
        }
        try {
            // A file packaged inside the extension, not a network request.
            const response = await fetch(
                chrome.runtime.getURL("exhibition/curated-content.json")
            );
            if (response.ok) {
                const catalog = await response.json();
                for (const group of catalog.groups ?? []) {
                    for (const item of group.links ?? []) {
                        const source = makeSource(item.url, "url");
                        if (source) collected.push(source);
                    }
                    for (const item of group.texts ?? []) {
                        if (typeof item.text === "string") {
                            const source = makeSource(item.text.trim(), "text");
                            if (source) collected.push(source);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn("[PARASITE OFFLINE] LOCAL CATALOG UNAVAILABLE", error);
        }

        const unique = new Map();
        collected.forEach(source => {
            if (!unique.has(source.key)) unique.set(source.key, source);
        });
        state.sources = [...unique.values()].slice(-MAX_SOURCES);
        state.hasMemory = state.sources.length > 0;
        // No fabricated browsing history: the empty condition stays empty.
        state.nextDecisionAt = 0;
        console.log("[PARASITE OFFLINE] LOCAL SOURCES", state.sources.length);
    }

    function resize() {
        state.width = Math.max(1, Math.min(window.innerWidth, 1440));
        state.height = Math.max(1, Math.min(window.innerHeight, 900));
        layer.width = state.width;
        layer.height = state.height;
    }

    function position(index, t) {
        const count = Math.max(1, state.sources.length);
        const spread = index / count;
        const angle = spread * 2.39996323 + (hash(state.sources[index].key) % 100) / 130;
        const radius = 0.24 + 0.13 * ((index * 7 % count) / count);
        return {
            x: state.width * (0.5 + Math.cos(angle) * radius) + Math.sin(t * 0.00012 + index) * 9,
            y: state.height * (0.5 + Math.sin(angle) * radius) + Math.cos(t * 0.00015 + index) * 8
        };
    }

    function decide(now) {
        state.decisions = Math.min(100000, state.decisions + 1);
        state.previous = state.focus;
        state.charge = clamp(state.charge + random(-0.15, 0.12), 0.16, 0.74);

        const available = state.sources;
        if (available.length) {
            // Bias toward less visited sources; never changes original memory.
            let best = -1;
            let bestScore = -Infinity;
            available.forEach((source, index) => {
                const novelty = 1 / (1 + source.hits * 0.19);
                const repetition = index === state.previous && available.length > 1 ? 0.6 : 0;
                const score = source.relevance * novelty + random(0, 0.52) - repetition;
                if (score > bestScore) {
                    bestScore = score;
                    best = index;
                }
            });
            state.focus = best;
            // Bounded counters, no long-term accumulation.
            available[best].hits = Math.min(100, available[best].hits + 1);
        } else {
            state.focus = -1;
        }

        const modeRoll = Math.random();
        if (state.focus === -1) {
            state.mode = modeRoll < 0.35 ? "SCAN" :
                modeRoll < 0.72 ? "RESIDUE" : "RECOMBINE";
        } else {
            state.mode = modes[Math.floor(modeRoll * modes.length)];
        }
        state.nextDecisionAt = now + random(8000, 34000);

        state.traces.push({
            from: state.previous,
            to: state.focus,
            x: random(0.17, 0.83),
            y: random(0.18, 0.82),
            born: now,
            duration: random(16000, 48000)
        });
        if (state.traces.length > MAX_TRACES) {
            state.traces.splice(0, state.traces.length - MAX_TRACES);
        }
    }

    function drawTrace(t, trace) {
        const life = clamp(1 - (t - trace.born) / trace.duration, 0, 1);
        if (!life) return;
        const x = trace.x * state.width;
        const y = trace.y * state.height;
        ctx.strokeStyle = `rgba(215,255,0,${(0.12 * life).toFixed(3)})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(x, y, 4 + 27 * (1 - life), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 10 * life, y);
        ctx.lineTo(x + 10 * life, y);
        ctx.stroke();
    }

    function drawEmptyField(t) {
        // Actual absence of web memory. Internal residual activity only.
        const cx = state.width * 0.5;
        const cy = state.height * 0.5;
        const ring = 85 + 45 * (0.5 + 0.5 * Math.sin(t * 0.00023));
        ctx.strokeStyle = "rgba(215,255,0,0.08)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(cx, cy, ring, 0, Math.PI * 2);
        ctx.stroke();
        const sweep = t * 0.00018;
        const a = Math.sin(sweep * 3) * 0.8;
        ctx.beginPath();
        ctx.moveTo(cx - 180, cy + Math.sin(sweep) * 90);
        ctx.lineTo(cx + 180, cy + Math.sin(sweep) * 90 + a * 12);
        ctx.stroke();
    }

    function drawSources(t) {
        if (!state.hasMemory) {
            drawEmptyField(t);
            return;
        }
        const focus = state.focus >= 0 ? position(state.focus, t) : null;
        const previous = state.previous >= 0 ? position(state.previous, t) : null;
        if (focus && previous && state.mode !== "REJECT") {
            ctx.beginPath();
            ctx.moveTo(previous.x, previous.y);
            ctx.quadraticCurveTo(
                state.width * 0.5,
                state.height * 0.5 + Math.sin(t * 0.00023) * 35,
                focus.x, focus.y
            );
            ctx.strokeStyle = `rgba(215,255,0,${(0.12 + state.charge * 0.2).toFixed(3)})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
        }
        if (focus && state.mode === "SCAN") {
            const angle = t * 0.0005;
            ctx.beginPath();
            ctx.arc(focus.x, focus.y, 32, angle, angle + Math.PI * 1.1);
            ctx.strokeStyle = "rgba(215,255,0,0.30)";
            ctx.lineWidth = 0.7;
            ctx.stroke();
        }
        if (focus && state.mode === "RECOMBINE" && state.sources.length > 1) {
            const partner = position((state.focus + 1) % state.sources.length, t);
            ctx.beginPath();
            ctx.moveTo(focus.x, focus.y);
            ctx.lineTo(partner.x, partner.y);
            ctx.strokeStyle = "rgba(215,255,0,0.25)";
            ctx.lineWidth = 0.75;
            ctx.stroke();
        }
        if (focus && state.mode === "SELECT") {
            ctx.beginPath();
            ctx.arc(focus.x, focus.y, 18, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(215,255,0,0.34)";
            ctx.lineWidth = 0.6;
            ctx.stroke();
        }
        state.sources.forEach((source, index) => {
            const p = position(index, t);
            const selected = index === state.focus;
            const alpha = selected ? 0.55 : 0.12;
            const r = selected ? 5 + 2 * Math.sin(t * 0.001) : 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(215,255,0,${alpha})`;
            ctx.stroke();
            if (selected) {
                ctx.fillStyle = "rgba(215,255,0,0.5)";
                ctx.font = "10px monospace";
                ctx.fillText(source.label, p.x + 12, p.y - 10);
                if (state.mode === "REJECT") {
                    ctx.beginPath();
                    ctx.moveTo(p.x - 10, p.y - 10);
                    ctx.lineTo(p.x + 10, p.y + 10);
                    ctx.strokeStyle = "rgba(215,255,0,0.24)";
                    ctx.stroke();
                }
            }
        });
    }

    function draw(t) {
        ctx.clearRect(0, 0, state.width, state.height);
        const intensity = state.mode === "RESIDUE" ? 0.55 :
            state.mode === "REJECT" ? 0.62 : 1;
        ctx.save();
        ctx.globalAlpha = intensity;
        state.traces = state.traces.filter(trace => t - trace.born < trace.duration);
        state.traces.forEach(trace => drawTrace(t, trace));
        drawSources(t);
        // A real internal state indicator, not a simulation of network traffic.
        ctx.font = "10px monospace";
        ctx.fillStyle = "rgba(215,255,0,0.35)";
        ctx.fillText("OFFLINE / " + state.mode, 18, state.height - 22);
        ctx.fillStyle = "rgba(215,255,0,0.19)";
        ctx.fillText(
            state.hasMemory ? "LOCAL REFERENCES " + state.sources.length : "LOCAL MEMORY EMPTY",
            18, state.height - 10
        );
        ctx.restore();
    }

    function frame(t) {
        requestAnimationFrame(frame);
        if (document.hidden || t - state.previousFrameAt < FRAME_MS) return;
        state.previousFrameAt = t;
        if (t >= state.nextDecisionAt) decide(t);
        draw(t);
    }

    window.addEventListener("resize", resize);
    resize();
    void loadSources();
    requestAnimationFrame(frame);
    console.log("[PARASITE OFFLINE] ACTIVITY LAYER READY");
})();
