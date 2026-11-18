
/**
 * PARASITE EXHIBITION — OFFLINE WORLD
 * Independent local habitat.
 * Does not navigate or write memory.
 */
(() => {
    "use strict";

    const field = document.getElementById("parasite-memory-field");
    const canvas = document.getElementById("parasite-offline-canvas");
    const organism = window.parasiteOrganism;
    const evolution = window.parasiteEvolution;

    if (!field || !canvas || !organism) {
        console.error("[PARASITE] OFFLINE HABITAT INCOMPLETE");
        return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const metabolism = {
        energy: 0.1,
        curiosity: 0.12,
        stress: 0.2,
        hunger: 0.9
    };

    let habitat = null;
    let anchors = [];
    let lastFrame = 0;


    // ----------------------------------------------------------
    // OFFLINE — SURVIVAL STATE
    // ----------------------------------------------------------

    let survivalPhase = "DORMANCY";

    async function refreshSurvivalPhase() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: "PARASITE_EXHIBITION_GET_SURVIVAL_STATE"
            });

            if (
                response?.ok &&
                typeof response.state?.phase === "string"
            ) {
                survivalPhase = response.state.phase;
            }
        } catch (error) {
            console.warn(
                "[PARASITE] OFFLINE SURVIVAL UNAVAILABLE",
                error
            );
        }
    }

    void refreshSurvivalPhase();

    window.setInterval(() => {
        if (!document.hidden) {
            void refreshSurvivalPhase();
        }
    }, 60000);

    function resize() {
        // Limitar el costo gráfico en la notebook antigua.
        canvas.width = Math.max(1, window.innerWidth);
        canvas.height = Math.max(1, window.innerHeight);
    }

    function restoreAnchors(nodes) {
        field.replaceChildren();
        anchors = [];

        const destinations = nodes
            .filter(node =>
                node?.type === "destination" &&
                typeof node.href === "string" &&
                /^https?:\/\//i.test(node.href)
            )
            .slice(-12);

        destinations.forEach((node, index) => {
            const angle =
                (index / destinations.length) * Math.PI * 2;

            const distance = 145 + (index % 3) * 50;
            const anchor = document.createElement("a");

            // Mantener la referencia sin navegar hacia ella.
            anchor.href = `#memory-${index}`;
            anchor.dataset.memoryUrl = node.href;
            anchor.setAttribute(
                "aria-label",
                node.hostname || "memory"
            );

            Object.assign(anchor.style, {
                position: "absolute",
                left: `calc(50% + ${Math.cos(angle) * distance}px)`,
                top: `calc(50% + ${Math.sin(angle) * distance}px)`,
                width: "2px",
                height: "2px",
                opacity: "0",
                pointerEvents: "none"
            });

            field.appendChild(anchor);
            anchors.push(anchor);
        });
    }

    async function loadMemory() {
        try {
            const saved =
                await chrome.storage.local.get("parasiteState");

            const state = saved.parasiteState;

            if (
                state?.memoryVersion !== 1 ||
                !Array.isArray(state.graph?.nodes)
            ) {
                return;
            }

            habitat = state.lastEcosystem?.habitat ?? null;

            restoreAnchors(state.graph.nodes);

            console.log(
                "[PARASITE] OFFLINE MEMORY NODES",
                anchors.length
            );

        } catch (error) {
            console.warn(
                "[PARASITE] OFFLINE MEMORY UNAVAILABLE",
                error
            );
        }
    }

    function frame(time) {
        requestAnimationFrame(frame);

        // Aproximadamente 20 FPS.
        if (document.hidden || time - lastFrame < 50) return;

        lastFrame = time;

        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const centerX =
            width * 0.5 + Math.sin(time * 0.00018) * 16;

        const centerY =
            height * 0.5 + Math.cos(time * 0.00014) * 12;

        const radius =
            34 + Math.sin(time * 0.0006) * 3;


        // --------------------------------------------------
        // OFFLINE — ORGANISM VITALITY
        // --------------------------------------------------

        const vitalityTargets = {
            ACTIVE: 1,
            UNSTABLE: 0.8,
            STARVATION: 0.55,
            NEAR_DEATH: 0.32,
            DORMANCY: 0.18,
            RECOVERY: 0.6,
            UNKNOWN: 0.18
        };

        const targetVitality =
            vitalityTargets[survivalPhase] ?? 0.18;

        const smoothing = 0.02;

        // El metabolismo responde gradualmente.
        metabolism.energy +=
            (targetVitality - metabolism.energy) * smoothing;

        metabolism.curiosity +=
            (targetVitality * 0.4 - metabolism.curiosity) * smoothing;

        metabolism.hunger +=
            ((1 - targetVitality) - metabolism.hunger) * smoothing;

        const vitality = metabolism.energy;

        const anatomy =
            evolution?.updateAnatomy(metabolism, habitat) ?? null;

        ctx.save();

        // Presencia residual, incluso en DORMANCY.
        ctx.globalAlpha =
            (0.08 + 0.34 * vitality) *
            (1 + Math.sin(time * 0.0005) * 0.08);

        organism.draw({
            ctx,
            currentTarget: null,
            centerX,
            centerY,
            radius: radius * (0.65 + 0.35 * vitality),
            time,
            activity: 0.15,
            tendrilStrength: 0.12 + 0.38 * vitality,
            anatomy
        });

        ctx.restore();

    }

    window.addEventListener("resize", resize);

    resize();
    void loadMemory();
    requestAnimationFrame(frame);

})();
