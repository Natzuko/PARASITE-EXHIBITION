
/**
 * PARASITE EXHIBITION — MODULE 05C
 * Network monitoring scheduler for Chrome 109 (Manifest V3).
 *
 * Checks connectivity only while an exhibition tab is selected.
 * Does not navigate, draw, or change the audio/memory system.
 */
(() => {
    "use strict";

    const ALARM_NAME = "parasite-exhibition-network-check";
    const OWNER_KEY = "parasiteExhibitionTabId";
    let checking = false;

    function ensureNetworkAlarm() {
        chrome.alarms.get(ALARM_NAME)
            .then((existing) => {
                if (existing) return;

                // Chrome 109: create() has no Promise return value.
                chrome.alarms.create(ALARM_NAME, {
                    periodInMinutes: 1
                });

                console.log("[PARASITE EXHIBITION] NETWORK ALARM CREATED");
            })
            .catch((error) => {
                console.error("[PARASITE EXHIBITION] ALARM ERROR", error);
            });
    }

    async function checkExhibitionConnectivity() {
        if (checking) return;
        checking = true;

        try {
            const saved = await chrome.storage.session.get(OWNER_KEY);

            if (!Number.isInteger(saved[OWNER_KEY])) return;

            const detector = globalThis.parasiteExhibitionConnectivity;
            if (!detector || typeof detector.check !== "function") {
                console.warn("[PARASITE EXHIBITION] NETWORK DETECTOR UNAVAILABLE");
                return;
            }

            const result = await detector.check();

            const currentOwner =
                await chrome.storage.session.get(OWNER_KEY);

            // Exhibition pudo desactivarse durante la comprobacion.
            if (currentOwner[OWNER_KEY] !== saved[OWNER_KEY]) {
                return;
            }


            if (result?.reported && result.state) {

                // 1. Comunicar el estado al organismo visual.
                try {
                    await chrome.tabs.sendMessage(saved[OWNER_KEY], {
                        type: "PARASITE_EXHIBITION_SURVIVAL_UPDATED",
                        state: result.state
                    });
                } catch {
                    // La pestaña puede estar navegando o recargando.
                }

                // 2. Comunicar el estado al motor de audio.
                try {
                    await ensureOffscreenDocument();

                    let response = await chrome.runtime.sendMessage({
                        type: "PARASITE_EXHIBITION_AUDIO_PHASE",
                        phase: result.state.phase
                    });

                    // El documento existe, pero su motor puede
                    // no haber comenzado a reproducir.
                    if (response?.reason === "AUDIO_NOT_STARTED") {

                        const started = await chrome.runtime.sendMessage({
                            type: "PARASITE_AUDIO_START"
                        });

                        if (started?.ok === true) {
                            response = await chrome.runtime.sendMessage({
                                type: "PARASITE_EXHIBITION_AUDIO_PHASE",
                                phase: result.state.phase
                            });
                        }
                    }

                    if (response?.ok !== true) {
                        console.warn(
                            "[PARASITE EXHIBITION] AUDIO NOT RESTORED",
                            response
                        );
                    }

                } catch (error) {
                    console.warn(
                        "[PARASITE EXHIBITION] AUDIO PHASE UNAVAILABLE",
                        error
                    );
                }

                // ----------------------------------------------------------
                // AUTOMATIC DORMANCY TRANSITIONS
                // ----------------------------------------------------------

                const transition =
                    globalThis.parasiteExhibitionOfflineTransition;

                if (transition) {
                    try {
                        if (result.state.phase === "DORMANCY") {
                            await transition.enter(saved[OWNER_KEY]);

                        } else if (result.state.phase === "ACTIVE") {
                            await transition.recover(saved[OWNER_KEY]);
                        }

                    } catch (error) {
                        console.error(
                            "[PARASITE EXHIBITION] OFFLINE TRANSITION ERROR",
                            error
                        );
                    }
                }

            }

        } catch (error) {
            console.error("[PARASITE EXHIBITION] NETWORK CHECK ERROR", error);
        } finally {
            checking = false;
        }
    }

    // Register event listeners at top level for Manifest V3 wake-ups.
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === ALARM_NAME) {
            void checkExhibitionConnectivity();
        }
    });

    chrome.runtime.onInstalled.addListener(ensureNetworkAlarm);
    chrome.runtime.onStartup.addListener(ensureNetworkAlarm);

    // Recreate the alarm if Chrome discarded it.
    ensureNetworkAlarm();

    // ----------------------------------------------------------
    // EXHIBITION — SURVIVAL STATE REQUEST
    // ----------------------------------------------------------

    chrome.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {

            if (
                message?.type !==
                "PARASITE_EXHIBITION_GET_SURVIVAL_STATE"
            ) {
                return false;
            }

            (async () => {
                const saved = await chrome.storage.session.get([
                    OWNER_KEY,
                    "parasiteExhibitionOfflineReturnV1"
                ]);

                // Solicitud desde la pestaña web de Exhibition.
                const fromExhibitionTab =
                    Number.isInteger(sender.tab?.id) &&
                    sender.tab.id === saved[OWNER_KEY];

                // Solicitud desde el entorno interno de latencia.
                const offlineRecord =
                    saved.parasiteExhibitionOfflineReturnV1;

                const fromOfflineHabitat =
                    sender.id === chrome.runtime.id &&
                    sender.url === chrome.runtime.getURL(
                        "exhibition/offline.html"
                    ) &&
                    Number.isInteger(saved[OWNER_KEY]) &&
                    offlineRecord?.tabId === saved[OWNER_KEY] &&
                    offlineRecord.insideOffline === true;

                if (!fromExhibitionTab && !fromOfflineHabitat) {
                    return { ok: false, state: null };
                }


                const survival =
                    globalThis.parasiteExhibitionSurvival;

                if (!survival) {
                    return { ok: false, state: null };
                }

                return {
                    ok: true,
                    state: await survival.getState()
                };

            })()
                .then(sendResponse)
                .catch((error) => {
                    console.error(
                        "[PARASITE EXHIBITION] SURVIVAL STATUS ERROR",
                        error
                    );

                    sendResponse({
                        ok: false,
                        state: null
                    });
                });

            return true;
        }
    );

    /**
     * Restore original audio when Exhibition is disabled.
     */
    chrome.storage.onChanged.addListener(
        (changes, areaName) => {

            if (areaName !== "session") return;

            const ownerChange = changes[OWNER_KEY];

            if (
                !ownerChange ||
                Number.isInteger(ownerChange.newValue)
            ) {
                return;
            }

            chrome.runtime.sendMessage({
                type: "PARASITE_EXHIBITION_AUDIO_PHASE",
                phase: "ACTIVE"
            })
                .then((response) => {
                    if (!response?.ok) {
                        console.warn(
                            "[PARASITE EXHIBITION] AUDIO RESET NOT CONFIRMED",
                            response
                        );
                    }
                })
                .catch((error) => {
                    console.warn(
                        "[PARASITE EXHIBITION] AUDIO RESET UNAVAILABLE",
                        error
                    );
                });
        }
    );
})();
