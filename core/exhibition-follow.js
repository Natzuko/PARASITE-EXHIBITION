/**
 * PARASITE — EXHIBITION MODE
 * MODULE 01 — VISUAL FOLLOW
 *
 * Sigue el objetivo del organismo mediante scroll.
 * No interviene en la memoria ni en la navegación.
 */

(() => {
    "use strict";

    const CHECK_INTERVAL = 1800;
    const HUMAN_PAUSE = 12000;
    const FOLLOW_COOLDOWN = 2500;

    let lastHumanInput = Date.now();
    let lastFollow = 0;

    // Exploracion autonoma de la pagina.
    const EXPLORE_AFTER_MS = 14000;
    const EXPLORE_INTERVAL_MS = 4200;
    const EXPLORE_STEP = 0.30;

    let lastPagePosition = 0;
    let lastPageMovementAt = Date.now();
    let lastExploreAt = 0;
    let exploreDirection = 1;
    let exploring = false;
    let previousTarget = null;

    // Evita interferir mientras alguien utiliza la página.
    ["wheel", "pointerdown", "keydown", "touchstart"].forEach(
        (eventName) => {
            window.addEventListener(
                eventName,
                () => {
                    lastHumanInput = Date.now();
                },
                { passive: true, capture: true }
            );
        }
    );

    function followParasite() {
        if (globalThis.parasiteExhibition?.active !== true) return;

        const behavior = window.parasiteBehavior;
        const target = behavior?.currentTarget;

        if (!target || !document.contains(target)) return;

        // Solo actuar en la vista humana.
        if (behavior.platformTranslation?.phase !== "HUMAN") return;
        if (behavior.colonization?.active ||
            behavior.colonization?.retracting) return;

        const now = Date.now();


        const scroller =
            document.scrollingElement || document.documentElement;

        const scrollTop = scroller.scrollTop;
        const maxScroll = Math.max(
            0,
            scroller.scrollHeight - scroller.clientHeight
        );

        if (now - lastHumanInput < HUMAN_PAUSE) {
            exploring = false;
            previousTarget = target;
            lastPagePosition = scrollTop;
            lastPageMovementAt = lastHumanInput;
            return;
        }

        // Si encuentra otro objetivo, vuelve a seguirlo.
        if (exploring && target !== previousTarget) {
            exploring = false;
            lastPageMovementAt = now;
        }

        previousTarget = target;

        // Detectar si la pagina lleva tiempo inmovil.
        if (
            !exploring &&
            Math.abs(scrollTop - lastPagePosition) > 12
        ) {
            lastPageMovementAt = now;
        }

        lastPagePosition = scrollTop;

        if (
            maxScroll > 50 &&
            now - lastPageMovementAt >= EXPLORE_AFTER_MS
        ) {
            exploring = true;
        }

        if (exploring) {
            if (now - lastExploreAt >= EXPLORE_INTERVAL_MS) {

                if (scrollTop >= maxScroll - 8) {
                    exploreDirection = -1;
                } else if (scrollTop <= 8) {
                    exploreDirection = 1;
                }

                window.scrollBy({
                    top: Math.round(
                        window.innerHeight * EXPLORE_STEP
                    ) * exploreDirection,
                    behavior: "smooth"
                });

                lastExploreAt = now;
            }

            return;
        }

        if (now - lastFollow < FOLLOW_COOLDOWN) return;


        const rect = target.getBoundingClientRect();

        if (rect.width <= 0 || rect.height <= 0) return;

        const centerY = rect.top + rect.height / 2;

        const marginY = window.innerHeight * 0.38;

        const inCentralBand =
            centerY >= marginY &&
            centerY <= window.innerHeight - marginY;

        if (inCentralBand) return;

        target.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest"
        });

        lastFollow = now;

        console.log(
            "[PARASITE EXHIBITION] FOLLOW TARGET",
            target.href
        );
    }

    window.setInterval(followParasite, CHECK_INTERVAL);

    console.log("[PARASITE EXHIBITION] VISUAL FOLLOW ONLINE");
})();
