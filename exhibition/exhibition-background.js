/**
 * PARASITE — EXHIBITION MODE
 * MODULE 03A — TAB OWNER (BACKGROUND)
 *
 * A single tab can own the autonomous exhibition.
 * Clicking the extension icon toggles that tab on/off.
 *
 * Ownership survives navigation and service worker sleep,
 * but not a Chrome restart.
 *
 * Does not modify audio, memory or original navigation.
 */

(() => {
    "use strict";

    const STORAGE_KEY = "parasiteExhibitionTabId";
    const STATUS_MESSAGE = "PARASITE_EXHIBITION_STATUS_CHANGED";

    async function getOwnerId() {
        const stored = await chrome.storage.session.get(STORAGE_KEY);
        const id = stored[STORAGE_KEY];

        return Number.isInteger(id) ? id : null;
    }

    async function setOwnerId(id) {
        if (Number.isInteger(id)) {
            await chrome.storage.session.set({
                [STORAGE_KEY]: id
            });
        } else {
            await chrome.storage.session.remove(STORAGE_KEY);
        }
    }

    async function notifyTab(tabId, active) {
        if (!Number.isInteger(tabId)) return;

        try {
            await chrome.tabs.sendMessage(tabId, {
                type: STATUS_MESSAGE,
                active
            });
        } catch {
            // The tab may have closed or may not accept scripts.
        }
    }

    // Indicador del modo de Exhibition.
    async function updateBadge(tabId, autonomous) {
        await chrome.action.setBadgeText({
            tabId,
            text: autonomous ? "AUTO" : "HUM"
        });

        await chrome.action.setBadgeBackgroundColor({
            tabId,
            color: autonomous ? "#A4C500" : "#666666"
        });

        await chrome.action.setTitle({
            tabId,
            title: autonomous
                ? "PARASITE — AUTONOMOUS"
                : "PARASITE — HUMAN"
        });
    }

    chrome.action.setBadgeText({ text: "HUM" }).catch(() => { });
    chrome.action.setBadgeBackgroundColor({
        color: "#666666"
    }).catch(() => { });

    // Recuperar el indicador al despertar el service worker.
    getOwnerId().then((id) => {
        if (id !== null) return updateBadge(id, true);
    }).catch((error) => {
        console.warn("[PARASITE EXHIBITION] BADGE INIT ERROR", error);
    });

    // ======================================================
    // EXHIBITION — MODE INDICATOR
    // ======================================================

    async function updateBadge(tabId, autonomous) {
        await Promise.all([
            chrome.action.setBadgeText({
                tabId,
                text: autonomous ? "AUTO" : "HUM"
            }),

            chrome.action.setBadgeBackgroundColor({
                tabId,
                color: autonomous ? "#A5C800" : "#656565"
            }),

            chrome.action.setTitle({
                tabId,
                title: autonomous
                    ? "PARASITE — AUTONOMOUS MODE"
                    : "PARASITE — HUMAN MODE"
            })
        ]);
    }

    // Modo predeterminado: humano.
    chrome.action.setBadgeText({
        text: "HUM"
    }).catch(() => { });

    chrome.action.setBadgeBackgroundColor({
        color: "#656565"
    }).catch(() => { });

    // Recuperar el indicador al iniciar el service worker.
    getOwnerId().then((id) => {
        if (id !== null) {
            return updateBadge(id, true);
        }
    }).catch(console.warn);

    // Actualizar cuando cambia la pestaña autónoma.
    chrome.storage.onChanged.addListener(
        (changes, areaName) => {

            if (
                areaName !== "session" ||
                !changes[STORAGE_KEY]
            ) return;

            const oldId = changes[STORAGE_KEY].oldValue;
            const newId = changes[STORAGE_KEY].newValue;

            if (Number.isInteger(oldId) && oldId !== newId) {
                updateBadge(oldId, false).catch(() => { });
            }

            if (Number.isInteger(newId)) {
                updateBadge(newId, true).catch(console.warn);
            }
        }
    );

    chrome.action.onClicked.addListener((tab) => {
        if (!Number.isInteger(tab?.id)) return;

        (async () => {
            const previousId = await getOwnerId();

            const nextId =
                previousId === tab.id ? null : tab.id;

            await setOwnerId(nextId);

            if (previousId !== null) {
                await notifyTab(previousId, false);
            }

            if (nextId !== null) {
                await notifyTab(nextId, true);
            }

            try {
                if (previousId !== null) {
                    await updateBadge(previousId, false);
                }

                if (nextId !== null) {
                    await updateBadge(nextId, true);
                }
            } catch (error) {
                console.warn(
                    "[PARASITE EXHIBITION] BADGE ERROR",
                    error
                );
            }

            console.log(
                "[PARASITE EXHIBITION] OWNER TAB",
                nextId
            );
        })().catch((error) => {
            console.error(
                "[PARASITE EXHIBITION] TOGGLE ERROR",
                error
            );
        });
    });

    chrome.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {

            if (
                message?.type !== "PARASITE_EXHIBITION_GET_STATUS"
            ) {
                return;
            }

            getOwnerId()
                .then((ownerId) => {
                    sendResponse({
                        active:
                            Number.isInteger(sender.tab?.id) &&
                            sender.tab.id === ownerId
                    });
                })
                .catch((error) => {
                    console.error(
                        "[PARASITE EXHIBITION] STATUS ERROR",
                        error
                    );

                    sendResponse({ active: false });
                });

            return true;
        }
    );

    chrome.tabs.onRemoved.addListener((closedTabId) => {
        getOwnerId()
            .then((ownerId) => {
                if (ownerId === closedTabId) {
                    return setOwnerId(null);
                }
            })
            .catch((error) => {
                console.error(
                    "[PARASITE EXHIBITION] CLEANUP ERROR",
                    error
                );
            });
    });

})();
