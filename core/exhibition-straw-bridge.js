/**
 * PARASITE EXHIBITION — STRAW.PAGE BRIDGE
 * Adaptador exclusivo para las paginas de Leo.
 *
 * Crea puntos de anclaje cuando Straw.Page utiliza
 * enlaces HTML con dimensiones 0x0.
 *
 * Permite abandonar autonomamente Straw.Page
 * despues de un periodo de permanencia.
 */

(() => {
    "use strict";

    const HOST = "wipparasito.straw.page";

    if (window.location.hostname !== HOST) return;

    const PAGES = [
        "/leo",
        "/ad2",
        "/ad3",
        "/ana1",
        "/poem2"
    ];

    const EXIT_AFTER_MS = 65000;

    const arrivedAt = Date.now();

    let leaving = false;

    // --------------------------------------------------
    // DETECTAR ENLACES UTILIZABLES
    // --------------------------------------------------

    function usableLink(a) {
        const r = a.getBoundingClientRect();
        const s = getComputedStyle(a);

        try {
            const url = new URL(a.href);

            return (
                r.width > 0 &&
                r.height > 0 &&
                s.display !== "none" &&
                s.visibility !== "hidden" &&
                Number(s.opacity) !== 0 &&
                ["http:", "https:"].includes(url.protocol) &&
                url.hostname !== "straw.page"
            );

        } catch {
            return false;
        }
    }

    // --------------------------------------------------
    // IDENTIFICAR ELEMENTOS VISUALES DE STRAW.PAGE
    // --------------------------------------------------

    function visibleVisuals() {
        return [...document.querySelectorAll(".element")]
            .filter((el) => {

                const r = el.getBoundingClientRect();
                const s = getComputedStyle(el);

                return (
                    r.width >= 12 &&
                    r.height >= 12 &&
                    s.display !== "none" &&
                    s.visibility !== "hidden"
                );
            });
    }

    // --------------------------------------------------
    // CREAR PUNTOS DE ANCLAJE
    // --------------------------------------------------

    function seedAnchors() {

        // Si existen enlaces utilizables,
        // no necesitamos intervenir.
        if (
            [...document.querySelectorAll("a[href]")]
                .some(usableLink)
        ) {
            return;
        }

        const targets = visibleVisuals();

        const destinations = PAGES.filter(
            path => path !== location.pathname
        );

        let created = 0;

        destinations.forEach((path, index) => {

            const target =
                targets[index % targets.length] ||
                document.body;

            if (!target) return;

            const anchor = document.createElement("a");

            const url = new URL(path, location.origin);

            // Diferenciar los enlaces generados
            // de los enlaces originales de Straw.Page.
            url.hash = `parasite-bridge-${index}`;

            anchor.href = url.href;

            anchor.dataset.parasiteStrawBridge = "1";

            anchor.textContent = "";

            anchor.setAttribute(
                "aria-hidden",
                "true"
            );

            anchor.tabIndex = -1;

            if (target === document.body) {

                Object.assign(anchor.style, {
                    position: "fixed",
                    left: "50vw",
                    top: "50vh"
                });

            } else {

                if (
                    getComputedStyle(target).position === "static"
                ) {
                    target.style.position = "relative";
                }

                Object.assign(anchor.style, {
                    position: "absolute",
                    left: "50%",
                    top: "50%"
                });
            }

            Object.assign(anchor.style, {
                display: "block",
                width: "8px",
                height: "8px",
                opacity: "1",
                pointerEvents: "none",
                border: "0",
                padding: "0",
                background: "transparent",
                zIndex: "0"
            });

            target.appendChild(anchor);

            created++;
        });

        console.log(
            "[PARASITE EXHIBITION] STRAW ANCHORS",
            created
        );
    }

    // --------------------------------------------------
    // RECUPERAR DESTINOS EXTERNOS DE LA MEMORIA
    // --------------------------------------------------

    function externalMemoryDestination() {

        const nodes =
            window.parasite?.state?.graph?.nodes;

        if (!Array.isArray(nodes)) return null;

        const eligible = (value) => {

            if (typeof value !== "string") {
                return false;
            }

            try {
                const url = new URL(value);

                return (
                    ["http:", "https:"].includes(url.protocol) &&
                    url.hostname !== HOST &&
                    url.hostname !== "straw.page" &&
                    !url.hostname.endsWith(".local") &&
                    url.hostname !== "localhost" &&
                    !/\.(?:jpg|jpeg|png|gif|webp|pdf|mp3|wav|mp4|webm)$/i
                        .test(url.pathname)
                );

            } catch {
                return false;
            }
        };

        // Priorizar paginas que PARASITE
        // ya observo anteriormente.
        const pages = nodes
            .filter(n => n?.type === "page")
            .map(n => n.url)
            .filter(eligible);

        const links = nodes
            .filter(n => n?.type === "destination")
            .map(n => n.href)
            .filter(eligible);

        const urls = pages.length ? pages : links;

        if (urls.length === 0) return null;

        const pool = urls.slice(-30);

        return pool[
            Math.floor(Math.random() * pool.length)
        ];
    }

    // --------------------------------------------------
    // SALIDA AUTONOMA DE STRAW.PAGE
    // --------------------------------------------------

    function autonomousExit() {

        if (
            leaving ||
            Date.now() - arrivedAt < EXIT_AFTER_MS
        ) {
            return;
        }

        const exhibition =
            globalThis.parasiteExhibition;

        if (
            !exhibition?.active ||
            exhibition.paused ||
            document.hidden
        ) {
            return;
        }

        const survival = exhibition.survival;

        const now = Date.now();

        const connectionConfirmed =
            survival?.phase === "ACTIVE" &&
            Number.isFinite(survival.lastCheckAt) &&
            now >= survival.lastCheckAt &&
            now - survival.lastCheckAt <= 90000;

        const connectionUnknown =
            survival?.phase === "UNKNOWN";

        if (
            navigator.onLine === false ||
            (!connectionConfirmed && !connectionUnknown)
        ) {
            return;
        }

        if (
            globalThis.parasiteBehavior
                ?.platformTranslation
                ?.phase === "TRANSLATING"
        ) {
            return;
        }

        // Intentar salir hacia una pagina de la memoria.
        // Si no existe, continuar dentro de Straw.Page.

        const otherPages = PAGES.filter(
            path => path !== location.pathname
        );

        const destination =
            externalMemoryDestination() ||
            new URL(
                otherPages[
                Math.floor(
                    Math.random() * otherPages.length
                )
                ],
                location.origin
            ).href;

        if (!destination) return;

        leaving = true;

        console.log(
            "[PARASITE EXHIBITION] LEAVING STRAW",
            destination
        );

        window.location.assign(destination);
    }

    // --------------------------------------------------
    // INICIAR
    // --------------------------------------------------

    seedAnchors();

    window.setInterval(autonomousExit, 3000);

    // --------------------------------------------------
    // MODULE 04 — LEO AUDIO INTERVENTION
    // --------------------------------------------------

    const LEO_AUDIO_CHANCE = 0.35;
    const LEO_AUDIO_DELAY_MS = 18000;

    const leoAudioChosen =
        Math.random() < LEO_AUDIO_CHANCE;

    let leoAudioRequested = false;

    if (leoAudioChosen) {

        const leoAudioInterval = window.setInterval(
            async () => {

                if (leaving) {
                    window.clearInterval(leoAudioInterval);
                    return;
                }

                if (
                    leoAudioRequested ||
                    Date.now() - arrivedAt < LEO_AUDIO_DELAY_MS
                ) {
                    return;
                }

                const exhibition =
                    globalThis.parasiteExhibition;

                if (
                    !exhibition?.active ||
                    exhibition.paused ||
                    document.hidden
                ) {
                    return;
                }

                leoAudioRequested = true;
                window.clearInterval(leoAudioInterval);

                try {
                    const response =
                        await chrome.runtime.sendMessage({
                            type:
                                "PARASITE_EXHIBITION_LEO_PLAY_OFFSCREEN"
                        });

                    if (response?.ok !== true) {
                        console.warn(
                            "[PARASITE EXHIBITION] LEO AUDIO NOT PLAYED",
                            response
                        );
                    } else {
                        console.log(
                            "[PARASITE EXHIBITION] LEO AUDIO STARTED"
                        );
                    }

                } catch (error) {
                    console.warn(
                        "[PARASITE EXHIBITION] LEO AUDIO UNAVAILABLE",
                        error
                    );
                }

            },
            4000
        );
    }

})();
