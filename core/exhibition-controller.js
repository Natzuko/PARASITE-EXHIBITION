
/**
 * PARASITE — EXHIBITION MODE
 * MODULE 03B — ACTIVITY CONTROLLER (CONTENT SCRIPT)
 *
 * Coordina una unica pestana de exhibicion.
 * No modifica la memoria, el sonido o la colonizacion original.
 * El service worker decide que pestana esta habilitada.
 */
(() => {
    "use strict";

    const IDLE_MS = 25000;
    const MIN_PAGE_MS = 90000;
    const MAX_PAGE_MS = 150000;
    const CHECK_MS = 4000;
    const RETRY_MS = 20000;
    const SURVIVAL_FRESH_MS = 90000;


    let lastHumanActivity = Date.now();
    let lastInputRecorded = 0;
    let receivedStatusPush = false;


    const exhibition = {
        active: false,
        paused: true,
        nextNavigationAt: null,
        survival: {
            phase: "UNKNOWN",
            lastCheckAt: null
        }
    };


    function scheduleNavigation(now, minimum = MIN_PAGE_MS, maximum = MAX_PAGE_MS) {
        const delay = minimum + Math.random() * (maximum - minimum);
        exhibition.nextNavigationAt = now + Math.round(delay);
    }

    function setActive(active) {
        if (exhibition.active === active) return;

        exhibition.active = active;
        exhibition.paused = true;
        exhibition.survival = {
            phase: "UNKNOWN",
            lastCheckAt: null
        };
        lastHumanActivity = Date.now();


        if (active) {
            scheduleNavigation(lastHumanActivity);
            requestSurvivalState();
            chrome.runtime.sendMessage({
                type: "PARASITE_EXHIBITION_REMEMBER_URL"
            }).catch((error) => {
                console.warn(
                    "[PARASITE EXHIBITION] URL NOT SAVED",
                    error
                );
            });

            console.log("[PARASITE EXHIBITION] ACTIVE IN THIS TAB");
        } else {
            exhibition.nextNavigationAt = null;
            console.log("[PARASITE EXHIBITION] INACTIVE IN THIS TAB");
        }
    }

    function registerHumanActivity() {
        const now = Date.now();
        if (now - lastInputRecorded < 250) return;

        lastInputRecorded = now;
        lastHumanActivity = now;
        exhibition.paused = true;

        if (exhibition.active) {
            scheduleNavigation(now);
        }
    }

    ["mousemove", "pointerdown", "wheel", "keydown", "touchstart"].forEach(
        (eventName) => {
            window.addEventListener(eventName, registerHumanActivity, {
                capture: true,
                passive: true
            });
        }
    );

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) registerHumanActivity();
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message?.type !== "PARASITE_EXHIBITION_STATUS_CHANGED") return;
        receivedStatusPush = true;
        setActive(message.active === true);
    });

    chrome.runtime.sendMessage({
        type: "PARASITE_EXHIBITION_GET_STATUS"
    }).then((response) => {
        if (!receivedStatusPush) setActive(response?.active === true);
    }).catch((error) => {
        console.warn("[PARASITE EXHIBITION] STATUS UNAVAILABLE", error);
    });

    // ==========================================================
    // PARASITE EXHIBITION — SURVIVAL COMMUNICATION
    // ==========================================================

    function acceptSurvivalState(state) {
        if (!state || typeof state.phase !== "string") {
            return;
        }

        exhibition.survival = {
            phase: state.phase,
            lastCheckAt: Number.isFinite(state.lastCheckAt)
                ? state.lastCheckAt
                : null
        };
    }

    function requestSurvivalState() {
        chrome.runtime.sendMessage({
            type: "PARASITE_EXHIBITION_GET_SURVIVAL_STATE"
        })
            .then((response) => {
                if (exhibition.active && response?.ok) {
                    acceptSurvivalState(response.state);
                }
            })
            .catch((error) => {
                console.warn(
                    "[PARASITE EXHIBITION] SURVIVAL REQUEST ERROR",
                    error
                );
            });
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (
            message?.type ===
            "PARASITE_EXHIBITION_SURVIVAL_UPDATED" &&
            exhibition.active
        ) {
            acceptSurvivalState(message.state);
        }
    });

    function update() {
        if (!exhibition.active) return;

        const now = Date.now();
        exhibition.paused =
            document.hidden || now - lastHumanActivity < IDLE_MS;

        if (exhibition.paused) return;

        // --------------------------------------------------
        // EXHIBITION — AUTOMATIC PLATFORM MIGRATION
        // --------------------------------------------------

        const behavior = globalThis.parasiteBehavior;
        const platform = behavior?.platformTranslation;

        if (
            platform?.phase === "PLATFORM" &&
            Number.isFinite(platform.startedAt) &&
            Number.isFinite(platform.duration) &&
            performance.now() >=
            platform.startedAt + platform.duration + 10000
        ) {
            const survival = exhibition.survival;

            const connectionReady =
                Number.isFinite(survival.lastCheckAt) &&
                now >= survival.lastCheckAt &&
                now - survival.lastCheckAt <= SURVIVAL_FRESH_MS &&
                survival.phase === "ACTIVE" &&
                navigator.onLine !== false;

            const navigation =
                globalThis.parasiteExhibitionNavigation;

            if (
                connectionReady &&
                typeof navigation?.navigate === "function" &&
                navigation.navigate()
            ) {
                scheduleNavigation(now);
                return;
            }

            // Si no encuentra una web disponible,
            // vuelve a explorar la pagina actual.
            behavior.exitPlatformView?.();
            scheduleNavigation(now);
            return;
        }

        if (exhibition.nextNavigationAt === null) return;
        if (now < exhibition.nextNavigationAt) return;


        // ----------------------------------------------------------
        // OFFLINE PROTECTION — AUTONOMOUS NAVIGATION
        // ----------------------------------------------------------

        const survival = exhibition.survival;

        const hasRecentCheck =
            Number.isFinite(survival.lastCheckAt) &&
            now >= survival.lastCheckAt &&
            now - survival.lastCheckAt <= SURVIVAL_FRESH_MS;

        if (
            !hasRecentCheck ||
            survival.phase !== "ACTIVE" ||
            navigator.onLine === false
        ) {
            exhibition.nextNavigationAt = now + RETRY_MS;
            return;
        }

        const navigation = globalThis.parasiteExhibitionNavigation;
        if (!navigation || typeof navigation.navigate !== "function") {
            exhibition.nextNavigationAt = now + RETRY_MS;
            return;
        }

        // --------------------------------------------------
        // MODULE 04 — OCCASIONAL CURATED NAVIGATION
        // --------------------------------------------------

        if (Math.random() < 0.40) {

            const activityAtRequest = lastHumanActivity;
            const pageAtRequest = window.location.href;

            exhibition.nextNavigationAt = now + RETRY_MS;

            chrome.runtime.sendMessage({
                type: "PARASITE_EXHIBITION_CURATED_NEXT"
            }).then((response) => {

                if (
                    !response?.ok ||
                    response.item?.type !== "link"
                ) return;

                // No intervenir si cambió la situación humana.
                if (
                    !exhibition.active ||
                    document.hidden ||
                    lastHumanActivity !== activityAtRequest ||
                    Date.now() - lastHumanActivity < IDLE_MS ||
                    window.location.href !== pageAtRequest
                ) return;

                const state = exhibition.survival;

                if (
                    state.phase !== "ACTIVE" ||
                    !Number.isFinite(state.lastCheckAt) ||
                    Date.now() - state.lastCheckAt > SURVIVAL_FRESH_MS ||
                    navigator.onLine === false
                ) return;

                const behavior = globalThis.parasiteBehavior;

                if (
                    navigation.locked ||
                    behavior?.colonization?.active ||
                    behavior?.colonization?.retracting ||
                    behavior?.platformTranslation?.phase === "TRANSLATING"
                ) return;

                const target =
                    navigation.normalizeDestination(response.item.url);

                if (!target) return;

                console.log(
                    "[PARASITE EXHIBITION] CURATED VISIT",
                    target
                );

                window.location.assign(target);

            }).catch((error) => {
                console.warn(
                    "[PARASITE EXHIBITION] CURATED UNAVAILABLE",
                    error
                );
            });

            return;
        }

        // Navegación autónoma original.
        const navigated = navigation.navigate();


        if (navigated) {
            // La solicitud no garantiza que la pagina haya cargado.
            // Evitar nuevos intentos inmediatos si la navegacion no ocurre.
            scheduleNavigation(now);

            console.log(
                "[PARASITE EXHIBITION] AUTONOMOUS ROUTE REQUESTED"
            );
        } else {
            // Sin destino valido o durante una transicion:
            // intentar mas tarde.
            exhibition.nextNavigationAt = now + RETRY_MS;
        }
    }

    globalThis.parasiteExhibition = exhibition;
    window.setInterval(update, CHECK_MS);

    console.log("[PARASITE EXHIBITION] CONTROLLER READY");
})();
