/**
 * PARASITE EXHIBITION — OFFLINE TRANSITION
 * Preserves the return URL and controls dormancy transitions.
 * Chrome 109 / Manifest V3.
 *
 * This module does not activate itself.
 */
(() => {
    "use strict";

    const STORAGE_KEY = "parasiteExhibitionOfflineReturnV1";
    const OWNER_KEY = "parasiteExhibitionTabId";

    const OFFLINE_URL =
        chrome.runtime.getURL("exhibition/offline.html");

    const FRESH_MS = 90000;

    function validWebUrl(value) {
        if (typeof value !== "string") return false;

        try {
            const url = new URL(value);
            return url.protocol === "https:" ||
                url.protocol === "http:";
        } catch {
            return false;
        }
    }

    async function readRecord() {
        const saved = await chrome.storage.session.get(STORAGE_KEY);
        return saved[STORAGE_KEY] ?? null;
    }

    async function remember(tabId, url) {
        if (!Number.isInteger(tabId) || !validWebUrl(url)) {
            return false;
        }

        const previous = await readRecord();

        if (
            previous?.tabId === tabId &&
            previous.insideOffline === true
        ) {
            return false;
        }

        await chrome.storage.session.set({
            [STORAGE_KEY]: {
                tabId,
                returnUrl: url,
                insideOffline: false
            }
        });

        return true;
    }

    async function enter(tabId) {

        const record = await readRecord();

        // Verificar que la pestaña siga siendo la autorizada.
        const owner = await chrome.storage.session.get(OWNER_KEY);

        if (owner[OWNER_KEY] !== tabId) {
            return false;
        }


        if (
            !record ||
            record.tabId !== tabId ||
            record.insideOffline ||
            !validWebUrl(record.returnUrl)
        ) {
            return false;
        }

        const survival =
            globalThis.parasiteExhibitionSurvival;

        if (!survival?.getState) return false;

        const state = await survival.getState();

        if (state.phase !== "DORMANCY") return false;

        await chrome.storage.session.set({
            [STORAGE_KEY]: {
                ...record,
                insideOffline: true,
                enteredAt: Date.now()
            }
        });

        try {
            await chrome.tabs.update(tabId, {
                url: OFFLINE_URL
            });
            return true;
        } catch (error) {
            await chrome.storage.session.set({
                [STORAGE_KEY]: record
            });

            console.error(
                "[PARASITE] OFFLINE ENTRY FAILED",
                error
            );

            return false;
        }
    }

    async function recover(tabId) {

        const record = await readRecord();

        // Verificar que la pestaña siga siendo la autorizada.
        const owner = await chrome.storage.session.get(OWNER_KEY);

        if (owner[OWNER_KEY] !== tabId) {
            return false;
        }


        if (
            !record ||
            record.tabId !== tabId ||
            record.insideOffline !== true ||
            record.recoveryPending === true ||
            !validWebUrl(record.returnUrl)
        ) {
            return false;
        }

        // Evitar reintentos continuos cuando una URL falla.
        if (
            Number.isFinite(record.retryAfter) &&
            Date.now() < record.retryAfter
        ) {
            return false;
        }

        const survival =
            globalThis.parasiteExhibitionSurvival;

        if (!survival?.getState) return false;

        const state = await survival.getState();
        const now = Date.now();

        const connectionConfirmed =
            state.phase === "ACTIVE" &&
            Number.isFinite(state.lastCheckAt) &&
            now >= state.lastCheckAt &&
            now - state.lastCheckAt <= FRESH_MS;

        if (!connectionConfirmed) return false;


        try {

            await chrome.storage.session.set({
                [STORAGE_KEY]: {
                    ...record,
                    recoveryPending: true,
                    recoveryRequestedAt: Date.now()
                }
            });

            await chrome.tabs.update(tabId, {
                url: record.returnUrl
            });
            return true;

        } catch (error) {
            try {
                await chrome.storage.session.set({
                    [STORAGE_KEY]: record
                });
            } catch (restoreError) {
                console.error(
                    "[PARASITE] RECOVERY RECORD RESTORE FAILED",
                    restoreError
                );
            }

            console.error(
                "[PARASITE] OFFLINE RECOVERY FAILED",
                error
            );

            return false;
        }

    }

    // ----------------------------------------------------------
    // RECEIVE LAST VALID EXHIBITION URL
    // ----------------------------------------------------------

    chrome.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {

            if (
                message?.type !==
                "PARASITE_EXHIBITION_REMEMBER_URL"
            ) {
                return false;
            }

            (async () => {
                if (
                    sender.frameId !== 0 ||
                    !Number.isInteger(sender.tab?.id)
                ) {
                    return { ok: false };
                }

                const saved =
                    await chrome.storage.session.get(OWNER_KEY);

                if (saved[OWNER_KEY] !== sender.tab.id) {
                    return { ok: false };
                }

                const pending = await getPendingRecovery(sender.tab.id);

                if (pending) {
                    if (
                        !validWebUrl(sender.url) ||
                        !sameWebsite(sender.url, pending.returnUrl)
                    ) {
                        return { ok: false };
                    }

                    await chrome.storage.session.remove(STORAGE_KEY);

                    console.log(
                        "[PARASITE] RECOVERY CONFIRMED BY CONTENT SCRIPT"
                    );

                    return { ok: true, recovered: true };
                }

                const record = await readRecord();

                if (
                    record?.tabId === sender.tab.id &&
                    record.insideOffline === true
                ) {
                    return { ok: false };
                }

                const remembered = await remember(
                    sender.tab.id,
                    sender.url
                );

                return { ok: remembered };

            })()
                .then(sendResponse)
                .catch((error) => {
                    console.warn(
                        "[PARASITE] OFFLINE URL MEMORY ERROR",
                        error
                    );

                    sendResponse({ ok: false });
                });

            return true;
        }
    );


    // ==========================================================
    // EXHIBITION — RECOVERY NAVIGATION GUARD
    // ==========================================================

    const RECOVERY_TIMEOUT_MS = 120000;
    const RECOVERY_RETRY_DELAY_MS = 15 * 60 * 1000;
    const NETWORK_ALARM = "parasite-exhibition-network-check";

    function sameWebsite(a, b) {
        try {
            const hostA = new URL(a).hostname.replace(/^www\./, "");
            const hostB = new URL(b).hostname.replace(/^www\./, "");
            return hostA === hostB;
        } catch {
            return false;
        }
    }

    async function getPendingRecovery(tabId) {
        const saved = await chrome.storage.session.get([
            STORAGE_KEY,
            OWNER_KEY
        ]);

        const record = saved[STORAGE_KEY];

        if (
            saved[OWNER_KEY] !== tabId ||
            record?.tabId !== tabId ||
            record.insideOffline !== true ||
            record.recoveryPending !== true
        ) {
            return null;
        }

        return record;
    }

    async function restoreOffline(tabId, reason) {
        const record = await getPendingRecovery(tabId);
        if (!record) return;

        await chrome.storage.session.set({
            [STORAGE_KEY]: {
                ...record,
                recoveryPending: false,
                recoveryRequestedAt: null,
                retryAfter: Date.now() + RECOVERY_RETRY_DELAY_MS,
                lastRecoveryError: reason
            }
        });

        try {
            await chrome.tabs.update(tabId, {
                url: OFFLINE_URL
            });

            console.warn(
                "[PARASITE] RETURNED TO OFFLINE HABITAT",
                reason
            );
        } catch (error) {
            console.error(
                "[PARASITE] OFFLINE FALLBACK FAILED",
                error
            );
        }
    }

    // ----------------------------------------------------------
    // SUCCESSFUL NAVIGATION
    // ----------------------------------------------------------

    chrome.webNavigation.onCompleted.addListener((details) => {
        if (details.frameId !== 0) return;

        void (async () => {
            const record = await getPendingRecovery(details.tabId);

            if (
                !record ||
                !sameWebsite(details.url, record.returnUrl)
            ) {
                return;
            }

            // La carga terminó, pero esperamos la confirmación
            // del script de PARASITE antes de borrar el registro.
            console.log(
                "[PARASITE] PAGE LOADED; AWAITING ORGANISM CONFIRMATION"
            );


        })().catch((error) => {
            console.error(
                "[PARASITE] RECOVERY CONFIRMATION ERROR",
                error
            );
        });
    });

    // ----------------------------------------------------------
    // FAILED NAVIGATION
    // ----------------------------------------------------------

    chrome.webNavigation.onErrorOccurred.addListener((details) => {
        if (
            details.frameId !== 0 ||
            details.error === "net::ERR_ABORTED"
        ) {
            return;
        }

        void (async () => {
            const record = await getPendingRecovery(details.tabId);

            if (
                !record ||
                !sameWebsite(details.url, record.returnUrl)
            ) {
                return;
            }

            await restoreOffline(details.tabId, details.error);
        })().catch((error) => {
            console.error(
                "[PARASITE] RECOVERY ERROR HANDLER FAILED",
                error
            );
        });
    });

    // ----------------------------------------------------------
    // TIMEOUT — REUSE EXISTING NETWORK ALARM
    // ----------------------------------------------------------

    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name !== NETWORK_ALARM) return;

        void (async () => {
            const saved = await chrome.storage.session.get(STORAGE_KEY);
            const record = saved[STORAGE_KEY];

            if (!record?.recoveryPending) return;

            if (
                !Number.isFinite(record.recoveryRequestedAt) ||
                Date.now() - record.recoveryRequestedAt > RECOVERY_TIMEOUT_MS
            ) {
                await restoreOffline(
                    record.tabId,
                    "RECOVERY_TIMEOUT"
                );
            }
        })().catch((error) => {
            console.error(
                "[PARASITE] RECOVERY TIMEOUT HANDLER FAILED",
                error
            );
        });
    });

    // ----------------------------------------------------------
    // LEAVE OFFLINE HABITAT WHEN EXHIBITION IS DISABLED
    // ----------------------------------------------------------

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "session") return;

        const ownerChange = changes[OWNER_KEY];
        if (!ownerChange) return;

        const oldTabId = ownerChange.oldValue;
        const newTabId = ownerChange.newValue;

        if (!Number.isInteger(oldTabId) || oldTabId === newTabId) {
            return;
        }

        void (async () => {
            const saved = await chrome.storage.session.get([
                OWNER_KEY, STORAGE_KEY
            ]);

            const record = saved[STORAGE_KEY];

            if (
                saved[OWNER_KEY] === oldTabId ||
                record?.tabId !== oldTabId
            ) {
                return;
            }

            try {
                if (record.insideOffline === true) {
                    const frame = await chrome.webNavigation.getFrame({
                        tabId: oldTabId,
                        frameId: 0
                    });

                    const current =
                        await chrome.storage.session.get(OWNER_KEY);

                    if (
                        frame?.url === OFFLINE_URL &&
                        current[OWNER_KEY] !== oldTabId
                    ) {
                        await chrome.tabs.update(oldTabId, {
                            url: "about:blank"
                        });
                    }
                }
            } catch (error) {
                console.warn(
                    "[PARASITE] OFFLINE EXIT FAILED",
                    error
                );
            } finally {
                const latest = await chrome.storage.session.get([
                    OWNER_KEY, STORAGE_KEY
                ]);

                if (
                    latest[OWNER_KEY] !== oldTabId &&
                    latest[STORAGE_KEY]?.tabId === oldTabId
                ) {
                    await chrome.storage.session.remove(STORAGE_KEY);
                }
            }
        })().catch((error) => {
            console.error(
                "[PARASITE] OFFLINE CLEANUP FAILED",
                error
            );
        });
    });

    globalThis.parasiteExhibitionOfflineTransition = {
        remember,
        enter,
        recover
    };
})();
