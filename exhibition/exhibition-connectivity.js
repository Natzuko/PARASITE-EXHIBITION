
/**
 * PARASITE EXHIBITION — MODULE 05B
 * Connectivity detector for Manifest V3 / Chrome 109.
 *
 * Only measures connectivity and reports it to survival.
 * Does not schedule itself, navigate, draw or change audio.
 */
(() => {
    "use strict";

    const TIMEOUT_MS = 8000;

    const ENDPOINTS = [
        {
            name: "GOOGLE",
            url: "https://www.google.com/generate_204"
        },
        {
            name: "CLOUDFLARE",
            url: "https://cp.cloudflare.com/generate_204"
        }
    ];

    async function probe(endpoint) {
        const aborter = new AbortController();
        const timeout = setTimeout(
            () => aborter.abort(),
            TIMEOUT_MS
        );

        const started = Date.now();

        try {
            const response = await fetch(endpoint.url, {
                method: "GET",
                cache: "no-store",
                credentials: "omit",
                redirect: "manual",
                signal: aborter.signal
            });

            return {
                name: endpoint.name,
                reachable: response.status === 204,
                status: response.status,
                elapsedMs: Date.now() - started
            };

        } catch (error) {
            return {
                name: endpoint.name,
                reachable: false,
                status: null,
                error: error && error.name === "AbortError"
                    ? "TIMEOUT"
                    : "REQUEST_FAILED"
            };

        } finally {
            clearTimeout(timeout);
        }
    }

    class ExhibitionConnectivity {
        constructor() {
            this.pending = null;
        }

        async check() {
            // Evitar comprobaciones simultaneas.
            if (this.pending) return this.pending;

            this.pending = (async () => {
                const results = await Promise.all(
                    ENDPOINTS.map(probe)
                );

                const reachable = results.some(
                    result => result.reachable
                );

                const survival =
                    globalThis.parasiteExhibitionSurvival;

                if (
                    !survival ||
                    typeof survival.reportConnectivity !== "function"
                ) {
                    return {
                        reachable,
                        results,
                        reported: false
                    };
                }

                const state =
                    await survival.reportConnectivity(reachable);

                console.log(
                    "[PARASITE EXHIBITION] CONNECTIVITY",
                    reachable ? "REACHABLE" : "UNCONFIRMED",
                    state.phase
                );

                return {
                    reachable,
                    results,
                    reported: true,
                    state
                };
            })();

            try {
                return await this.pending;
            } finally {
                this.pending = null;
            }
        }
    }

    globalThis.parasiteExhibitionConnectivity =
        new ExhibitionConnectivity();

})();
