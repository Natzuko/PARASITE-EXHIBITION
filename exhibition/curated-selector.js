
/**
 * PARASITE — EXHIBITION MODE
 * MODULE 04A — CURATED CONTENT SELECTOR
 *
 * Lee un catálogo local de enlaces, imágenes y textos.
 * Solo selecciona: no navega, no dibuja, no modifica memoria.
 * Compatible con Chrome 109 (Manifest V3).
 * Debe cargarse en el service worker, NO como content script.
 */
(() => {
    "use strict";

    const CATALOG_PATH = "exhibition/curated-content.json";
    const RECENT_KEY = "parasiteExhibitionCuratedRecent";
    const MAX_RECENT = 5;

    class CuratedSelector {
        constructor() {
            this.entries = null;
            this.loading = null;
        }

        normalize(type, groupId, entry) {
            if (!entry || typeof entry !== "object") return null;
            if (typeof entry.id !== "string" || !entry.id.trim()) return null;

            const id = entry.id.trim();
            const key = `${groupId}:${type}:${id}`;

            if (type === "link") {
                if (typeof entry.url !== "string") return null;
                try {
                    const url = new URL(entry.url);
                    if (!["https:", "http:"].includes(url.protocol)) return null;
                    if (url.username || url.password) return null;
                    return { key, id, groupId, type, url: url.href };
                } catch {
                    return null;
                }
            }

            if (type === "image") {
                const file = entry.file;
                if (typeof file !== "string") return null;

                // Solo imágenes empaquetadas en la carpeta local.
                if (!/^exhibition\/media\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(file)) {
                    return null;
                }

                return {
                    key, id, groupId, type, file,
                    url: chrome.runtime.getURL(file),
                    alt: typeof entry.alt === "string"
                        ? entry.alt.slice(0, 180)
                        : ""
                };
            }

            if (type === "text") {
                if (typeof entry.text !== "string") return null;
                const value = entry.text.trim().slice(0, 600);
                if (!value) return null;
                return { key, id, groupId, type, text: value };
            }

            return null;
        }

        async load() {
            if (this.entries !== null) return this.entries;
            if (this.loading) return this.loading;

            this.loading = (async () => {
                const response = await fetch(chrome.runtime.getURL(CATALOG_PATH));
                if (!response.ok) {
                    throw new Error(`Catalog HTTP ${response.status}`);
                }

                const catalog = await response.json();

                if (!Array.isArray(catalog.groups)) {
                    throw new Error(
                        "Invalid curated catalog: groups must be an array"
                    );
                }

                const items = [];

                for (const group of catalog.groups) {
                    if (!group || typeof group.id !== "string") continue;

                    const groupId = group.id.trim();
                    if (!groupId) continue;

                    for (const [listName, type] of [
                        ["links", "link"],
                        ["images", "image"],
                        ["texts", "text"]
                    ]) {
                        if (!Array.isArray(group[listName])) continue;

                        for (const entry of group[listName]) {
                            const item = this.normalize(type, groupId, entry);

                            if (
                                item &&
                                !items.some(x => x.key === item.key)
                            ) {
                                items.push(item);
                            }
                        }
                    }
                }

                this.entries = items;

                console.log(
                    "[PARASITE EXHIBITION] CURATED CATALOG READY:",
                    items.length
                );

                return items;
            })();

            try {
                return await this.loading;
            } finally {
                this.loading = null;
            }
        }

        async next(allowedTypes = ["link", "image", "text"]) {
            const entries = await this.load();

            const allowed = Array.isArray(allowedTypes)
                ? allowedTypes
                : [];

            const candidates = entries.filter(
                item => allowed.includes(item.type)
            );

            if (!candidates.length) return null;

            const stored = await chrome.storage.session.get(RECENT_KEY);

            const recent = Array.isArray(stored[RECENT_KEY])
                ? stored[RECENT_KEY]
                : [];

            const fresh = candidates.filter(
                item => !recent.includes(item.key)
            );

            const pool = fresh.length ? fresh : candidates;

            const chosen = pool[
                Math.floor(Math.random() * pool.length)
            ];

            const updated = [
                ...recent.filter(key => key !== chosen.key),
                chosen.key
            ].slice(-MAX_RECENT);

            await chrome.storage.session.set({
                [RECENT_KEY]: updated
            });

            return chosen;
        }
    }

    globalThis.parasiteExhibitionCurated = new CuratedSelector();

    // Solicitudes desde la pestaña Exhibition.
    chrome.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {

            if (
                message?.type !==
                "PARASITE_EXHIBITION_CURATED_NEXT"
            ) {
                return false;
            }

            (async () => {
                const tabId = sender.tab?.id;

                // Aceptar solamente la pestaña principal
                // de nuestra extension.
                if (
                    sender.id !== chrome.runtime.id ||
                    sender.frameId !== 0 ||
                    !Number.isInteger(tabId)
                ) {
                    return { ok: false, item: null };
                }

                const saved =
                    await chrome.storage.session.get(
                        "parasiteExhibitionTabId"
                    );

                if (saved.parasiteExhibitionTabId !== tabId) {
                    return { ok: false, item: null };
                }

                const item =
                    await globalThis.parasiteExhibitionCurated.next(
                        ["link"]
                    );

                return {
                    ok: Boolean(item),
                    item: item ?? null
                };

            })()
                .then(sendResponse)
                .catch((error) => {
                    console.warn(
                        "[PARASITE EXHIBITION] CURATED REQUEST ERROR",
                        error
                    );

                    sendResponse({
                        ok: false,
                        item: null
                    });
                });

            return true;
        }
    );

})();
