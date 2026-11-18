
/**
 * PARASITE — EXHIBITION MODE
 * MODULE 04C — CURATED DISPLAY
 *
 * Presenta una intromision por vez, solo por solicitud externa.
 * No solicita contenidos, no navega y no modifica la memoria.
 * La seleccion y la frecuencia pertenecen a otros modulos.
 */
(() => {
    "use strict";

    const VISIBLE_MS = 14000;
    const MEDIA_PATH = /^exhibition\/media\/[a-z0-9_-]+\.(png|jpg|jpeg|webp)$/i;

    let host = null;
    let label = null;
    let content = null;
    let hideTimer = null;

    function ensureSurface() {
        if (host) {
            if (!document.contains(host)) {
                document.documentElement.appendChild(host);
            }
            return;
        }

        host = document.createElement("div");
        host.id = "parasite-curated-host";

        Object.assign(host.style, {
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "min(320px, 34vw)",
            maxWidth: "calc(100vw - 48px)",
            pointerEvents: "none",
            zIndex: "2147483646",
            display: "none"
        });

        // Shadow DOM: contenido aislado de la pagina observada.
        const shadow = host.attachShadow({ mode: "closed" });

        const style = document.createElement("style");
        style.textContent = `
      .panel {
        box-sizing: border-box;
        padding: 14px;
        background: rgba(12, 12, 12, 0.94);
        color: #ebebeb;
        border-left: 2px solid #e1d321;
        font: 13px/1.45 Arial, sans-serif;
        overflow: hidden;
        max-height: 45vh;
      }

      .label {
        font: 10px/1.4 monospace;
        letter-spacing: 0.13em;
        color: #d8ce4a;
        margin-bottom: 9px;
      }

      .content {
        overflow: hidden;
        overflow-wrap: anywhere;
      }

      .content img {
        display: block;
        max-width: 100%;
        max-height: 28vh;
        width: auto;
        height: auto;
        object-fit: contain;
      }

      .content p {
        margin: 0;
      }

      .url {
        opacity: 0.7;
        font: 11px/1.4 monospace;
      }
    `;

        const panel = document.createElement("section");
        panel.className = "panel";

        label = document.createElement("div");
        label.className = "label";

        content = document.createElement("div");
        content.className = "content";

        panel.append(label, content);
        shadow.append(style, panel);

        document.documentElement.appendChild(host);
    }

    function hide() {
        if (hideTimer !== null) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }

        if (!host) return;

        host.style.display = "none";
        content.replaceChildren();
    }

    function show(item) {
        const exhibition = globalThis.parasiteExhibition;
        const phase = globalThis.parasiteBehavior?.platformTranslation?.phase;

        if (exhibition?.active !== true || exhibition.paused === true) {
            return false;
        }

        if (phase !== "HUMAN") return false;
        if (!item || typeof item !== "object") return false;

        let node;
        let category;

        if (
            item.type === "image" &&
            MEDIA_PATH.test(item.file || "")
        ) {
            category = "IMAGE";

            node = document.createElement("img");
            node.alt = typeof item.alt === "string"
                ? item.alt.slice(0, 180)
                : "";

            node.onerror = hide;
            node.src = chrome.runtime.getURL(item.file);

        } else if (
            item.type === "text" &&
            typeof item.text === "string"
        ) {
            category = "TEXT";

            node = document.createElement("p");
            node.textContent = item.text.trim().slice(0, 600);

            if (!node.textContent) return false;

        } else if (
            item.type === "link" &&
            typeof item.url === "string"
        ) {
            let url;

            try {
                url = new URL(item.url);
            } catch {
                return false;
            }

            if (!["http:", "https:"].includes(url.protocol)) {
                return false;
            }

            category = "LINK";

            node = document.createElement("p");
            node.className = "url";
            node.textContent =
                url.hostname + url.pathname.slice(0, 140);

            // No crea un enlace activo ni dispara navegacion.

        } else {
            return false;
        }

        ensureSurface();
        hide();

        // Situar la intromision del lado opuesto al organismo.
        const organismX = globalThis.parasiteBehavior?.x;

        const onRight =
            !Number.isFinite(organismX) ||
            organismX < window.innerWidth / 2;

        host.style.right = onRight ? "24px" : "auto";
        host.style.left = onRight ? "auto" : "24px";

        label.textContent = "CURATED / " + category;

        content.appendChild(node);
        host.style.display = "block";

        hideTimer = setTimeout(hide, VISIBLE_MS);

        return true;
    }

    // Si se desactiva Exhibition, desaparece la intromision.
    chrome.runtime.onMessage.addListener((message) => {
        if (
            message?.type === "PARASITE_EXHIBITION_STATUS_CHANGED" &&
            message.active !== true
        ) {
            hide();
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) hide();
    });

    globalThis.parasiteExhibitionCuratedDisplay = {
        show,
        hide
    };

    console.log(
        "[PARASITE EXHIBITION] CURATED DISPLAY READY"
    );
})();
