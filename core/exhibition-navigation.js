
/**
 * PARASITE — EXHIBITION MODE
 * MODULE 02 — AUTONOMOUS NAVIGATION
 *
 * Selecciona un destino ya observado por el organismo.
 * No crea timers, no abre pestanas, no altera la memoria
 * y no activa la colonizacion global.
 * El Exhibition Controller decidira cuando llamar a navigate().
 */
(() => {
    "use strict";

    class ParasiteExhibitionNavigation {
        constructor() {
            this.locked = false;
            console.log("[PARASITE EXHIBITION] NAVIGATION READY");
        }

        normalizeDestination(rawHref) {
            if (typeof rawHref !== "string" || !rawHref.trim()) return null;

            try {
                const destination = new URL(rawHref, window.location.href);
                const current = new URL(window.location.href);

                if (!["http:", "https:"].includes(destination.protocol)) return null;
                if (destination.username || destination.password) return null;

                // No abrir direcciones locales ni repetir la misma pagina por un ancla.
                if (
                    destination.hostname === "localhost" ||
                    destination.hostname.endsWith(".local") ||
                    destination.hostname === "127.0.0.1"
                ) return null;

                destination.hash = "";
                current.hash = "";
                if (destination.href === current.href) return null;

                return destination.href;
            } catch {
                return null;
            }
        }

        getDestination() {
            const parasite = globalThis.parasite;
            const behavior = globalThis.parasiteBehavior;
            if (!parasite?.state || !behavior) return null;

            const target = behavior.currentTarget;
            if (
                target?.tagName === "A" &&
                document.contains(target) &&
                !target.hasAttribute("download")
            ) {
                const url = this.normalizeDestination(target.href);
                if (url) return { url, source: "CURRENT_TARGET" };
            }
            // Evita utilizar una decision antigua tras cambiar de pagina.
            try {
                const observed = new URL(parasite.state.lastObservation?.url);
                const current = new URL(window.location.href);
                observed.hash = "";
                current.hash = "";
                if (observed.href !== current.href) return null;
            } catch {
                return null;
            }

            // Reserva: la ultima eleccion del cerebro, solo si sigue en el DOM.
            const decidedUrl = this.normalizeDestination(
                parasite.state.lastDecision?.href
            );
            if (!decidedUrl) return null;

            const matchesPage = Array.from(document.querySelectorAll("a[href]")).some(
                (link) =>
                    !link.hasAttribute("download") &&
                    this.normalizeDestination(link.href) === decidedUrl
            );

            return matchesPage ? { url: decidedUrl, source: "BRAIN_DECISION" } : null;
        }

        navigate() {
            const controller = globalThis.parasiteExhibition;
            const behavior = globalThis.parasiteBehavior;

            // Solo la pestaña habilitada por el futuro Exhibition Controller.
            if (controller?.active !== true || controller?.paused === true) return false;
            if (this.locked || !behavior) return false;

            if (
                behavior.colonization?.active ||
                behavior.colonization?.retracting ||
                behavior.platformTranslation?.phase === "TRANSLATING"
            ) return false;

            const destination = this.getDestination();
            if (!destination) return false;

            this.locked = true;
            console.log("[PARASITE EXHIBITION] NAVIGATE", destination);

            try {
                window.location.assign(destination.url);
            } catch (error) {
                this.locked = false;
                console.error("[PARASITE EXHIBITION] NAVIGATION ERROR", error);
                return false;
            }

            // Si el navegador no cambia de pagina, permite un nuevo intento.
            window.setTimeout(() => {
                this.locked = false;
            }, 5000);

            return true;
        }
    }

    globalThis.parasiteExhibitionNavigation =
        new ParasiteExhibitionNavigation();
})();
