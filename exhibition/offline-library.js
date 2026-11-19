/**
 * PARASITE EXHIBITION — OFFLINE LIBRARY 01
 * Six local documents selected by the parasite.
 * Chrome 109 / Manifest V3.
 * No external requests or storage writes.
 * Removing its script tag disables the library.
 */
(() => {
    "use strict";

    const habitat = document.getElementById(
        "parasite-offline-habitat"
    );
    if (!habitat) return;

    // --------------------------------------------------
    // 01 — LOCAL DOCUMENTS
    // --------------------------------------------------

    const documents = [
        {
            id: "index",
            type: "ARCHIVE / 01",
            title: "INDEX OF REMAINS",
            lines: [
                "No connection to the external network.",
                "Only local documents and previously observed addresses remain.",
                "An address is not a cached copy of its page."
            ],
            links: ["routes", "leo", "residue"]
        },
        {
            id: "leo",
            type: "CONTACT / 02",
            title: "LEO / EXTERNAL UNIVERSE",
            lines: [
                "An external territory remains registered in the archive.",
                "wipparasito.straw.page/leo",
                "Its live pages are unavailable while the network is absent."
            ],
            links: ["index", "classification", "routes"]
        },
        {
            id: "routes",
            type: "TOPOLOGY / 03",
            title: "LOCAL ROUTING TABLE",
            lines: [
                "These connections lead to local documents only.",
                "Each transition changes the available next destinations.",
                "There is no predetermined order of traversal."
            ],
            links: ["classification", "exclusions", "leo"]
        },
        {
            id: "classification",
            type: "SELECTION / 04",
            title: "ATTENTION FILTER",
            lines: [
                "Candidates are evaluated against recent local visits.",
                "Repetition lowers priority; deviation remains possible.",
                "The human visitor does not choose the next document."
            ],
            links: ["exclusions", "residue", "index"]
        },
        {
            id: "exclusions",
            type: "DISCARD / 05",
            title: "REJECTED PATHS",
            lines: [
                "A candidate may be discarded without being visited.",
                "A failed route remains a possibility, not an event in memory.",
                "Discarded choices can become available again."
            ],
            links: ["routes", "residue", "classification"]
        },
        {
            id: "residue",
            type: "LATENCY / 06",
            title: "RESIDUAL OPERATIONS",
            lines: [
                "External acquisition is suspended.",
                "Selection continues inside a finite local archive.",
                "The absence of new material does not stop the organism."
            ],
            links: ["index", "exclusions", "leo"]
        }
    ];

    const byId = new Map(
        documents.map(doc => [doc.id, doc])
    );

    const state = {
        current: "index",
        previous: null,
        visits: Object.create(null),
        rememberedHosts: [],
        timer: null
    };

    // --------------------------------------------------
    // 02 — INDEPENDENT DISPLAY
    // --------------------------------------------------

    const root = document.createElement("section");
    root.id = "parasite-offline-library";
    root.setAttribute(
        "aria-label",
        "PARASITE local archive"
    );
    habitat.appendChild(root);

    const styles = document.createElement("style");

    styles.textContent = `
        #parasite-offline-library {
            position: absolute;
            left: 3%;
            top: 8%;
            width: 44%;
            max-width: 570px;
            max-height: 77%;
            overflow: hidden;
            box-sizing: border-box;
            z-index: 0;
            pointer-events: none;
            padding: 18px 20px;
            border-left: 1px solid rgba(215,255,0,.38);
            background: rgba(0,0,0,.77);
            color: rgba(236,242,220,.86);
            font: 12px/1.55 Consolas,"Courier New",monospace;
            overflow-wrap: anywhere;
        }

        #parasite-offline-library .ol-small {
            font-size: 10px;
            letter-spacing: 1.8px;
            color: #d7ff00;
        }

        #parasite-offline-library .ol-title {
            margin: 19px 0 17px;
            font-size: clamp(15px,2.2vw,25px);
            line-height: 1.2;
            font-weight: normal;
            letter-spacing: 1px;
        }

        #parasite-offline-library .ol-line {
            margin: 0 0 9px;
            max-width: 48ch;
        }

        #parasite-offline-library .ol-data {
            margin: 14px 0;
            padding: 8px 0;
            border-top: 1px solid #333;
            border-bottom: 1px solid #333;
            color: rgba(215,255,0,.72);
            font-size: 10px;
            white-space: pre-wrap;
        }

        #parasite-offline-library .ol-links {
            display: flex;
            flex-wrap: wrap;
            gap: 6px 12px;
            margin-top: 17px;
            padding-top: 10px;
            border-top: 1px dotted #454545;
        }

        #parasite-offline-library .ol-links a {
            color: #d7ff00;
            text-decoration: none;
            font-size: 10px;
        }

        #parasite-offline-library .ol-image {
            display: block;
            max-width: 210px;
            max-height: 145px;
            object-fit: contain;
            margin: 12px 0;
            opacity: .78;
        }

        #parasite-offline-library[data-page="residue"] {
            opacity: .57;
        }

        #parasite-offline-library[data-page="exclusions"] {
            border-left-style: dashed;
        }

        @media (max-width:700px) {
            #parasite-offline-library {
                width: 68%;
                max-height: 68%;
                padding: 12px 13px;
            }
            #parasite-offline-library .ol-image {
                max-height: 105px;
            }
        }
    `;

    root.appendChild(styles);

    function add(parent, tag, className, value) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (value !== undefined) {
            element.textContent = value;
        }

        parent.appendChild(element);
        return element;
    }

    // --------------------------------------------------
    // 03 — RENDER LOCAL DOCUMENT
    // --------------------------------------------------

    function render() {
        const page = byId.get(state.current);
        if (!page) return;

        while (
            root.lastChild &&
            root.lastChild !== styles
        ) {
            root.lastChild.remove();
        }

        root.dataset.page = page.id;

        add(
            root,
            "div",
            "ol-small",
            "PARASITE / LOCAL ARCHIVE / " + page.type
        );

        add(root, "h2", "ol-title", page.title);

        for (const line of page.lines) {
            add(root, "p", "ol-line", line);
        }

        // LEO — existing local exhibition asset.
        if (page.id === "leo") {
            const image = add(
                root,
                "img",
                "ol-image"
            );

            image.alt =
                "Local image from the PARASITE repository";

            image.src = chrome.runtime.getURL(
                "leo-wip.png"
            );

            image.onerror = () => image.remove();
        }

        if (page.id === "index") {
            const hosts = state.rememberedHosts;

            add(
                root,
                "div",
                "ol-data",
                hosts.length
                    ? "OBSERVED HOSTS (ADDRESSES ONLY)\n" +
                    hosts.join("\n")
                    : "OBSERVED HOSTS\nNONE AVAILABLE"
            );
        }

        else if (page.id === "routes") {
            add(
                root,
                "div",
                "ol-data",
                page.id.toUpperCase() +
                " -> " +
                page.links.join(" / ")
            );
        }

        else if (page.id === "classification") {
            const counts = documents.map(doc =>
                doc.id.toUpperCase() + ":" +
                (state.visits[doc.id] || 0)
            ).join("  ");

            add(
                root,
                "div",
                "ol-data",
                "LOCAL COUNTS / " + counts
            );
        }

        else if (page.id === "exclusions") {
            add(
                root,
                "div",
                "ol-data",
                "PREVIOUS DOCUMENT / " +
                (state.previous || "NONE") +
                "\nCURRENT DOCUMENT / " +
                state.current
            );
        }

        else if (page.id === "residue") {
            add(
                root,
                "div",
                "ol-data",
                "LOCAL PROCESS / CONTINUING"
            );
        }

        // Internal connections only.
        const navigation = add(
            root,
            "nav",
            "ol-links"
        );

        navigation.setAttribute(
            "aria-label",
            "Local document connections"
        );

        for (const id of page.links) {
            const destination = byId.get(id);
            if (!destination) continue;

            const anchor = add(
                navigation,
                "a",
                "",
                "/" + destination.id
            );

            anchor.href = "#parasite-local-" + destination.id;
            anchor.tabIndex = -1;
        }

        add(
            root,
            "div",
            "ol-small",
            "OFFLINE / INTERNAL NAVIGATION"
        );
    }

    // --------------------------------------------------
    // 04 — AUTONOMOUS LOCAL SELECTION
    // --------------------------------------------------

    function chooseNext() {
        const current = byId.get(state.current);

        // Usually follow a local link.
        // Occasionally select another archive document.
        const candidates = Math.random() < 0.82
            ? current.links.slice()
            : documents.map(doc => doc.id);

        let selected = state.current;
        let highest = -Infinity;

        for (const id of candidates) {
            if (
                id === state.current ||
                !byId.has(id)
            ) {
                continue;
            }

            const visits = state.visits[id] || 0;

            const recentPenalty =
                id === state.previous ? 0.45 : 0;

            const score =
                Math.random() -
                Math.min(visits, 12) * 0.055 -
                recentPenalty;

            if (score > highest) {
                highest = score;
                selected = id;
            }
        }

        if (selected === state.current) return;

        state.previous = state.current;
        state.current = selected;

        state.visits[selected] = Math.min(
            30,
            (state.visits[selected] || 0) + 1
        );

        render();
    }

    // --------------------------------------------------
    // 05 — ACTIVITY SCHEDULER
    // --------------------------------------------------

    function schedule() {
        // Only one timer.
        // Approximately 28 to 80 seconds per decision.

        const delay =
            28000 + Math.random() * 52000;

        state.timer = window.setTimeout(() => {
            if (!document.hidden) {
                chooseNext();
            }

            schedule();
        }, delay);
    }

    // --------------------------------------------------
    // 06 — READ EXISTING MEMORY
    // --------------------------------------------------

    async function loadRememberedHosts() {
        try {
            const saved =
                await chrome.storage.local.get(
                    "parasiteState"
                );

            const memory = saved.parasiteState;

            if (
                memory?.memoryVersion !== 1 ||
                !Array.isArray(memory.graph?.nodes)
            ) {
                return;
            }

            const hosts = [];

            for (
                const node of memory.graph.nodes.slice(-120)
            ) {
                if (
                    node?.type !== "destination" ||
                    typeof node.href !== "string"
                ) {
                    continue;
                }

                try {
                    const url = new URL(node.href);

                    if (
                        (
                            url.protocol === "https:" ||
                            url.protocol === "http:"
                        ) &&
                        !hosts.includes(url.hostname)
                    ) {
                        hosts.push(url.hostname);
                    }
                } catch {
                    // Ignore invalid historic references.
                }
            }

            state.rememberedHosts =
                hosts.slice(-5);

            if (state.current === "index") {
                render();
            }

        } catch (error) {
            console.warn(
                "[PARASITE OFFLINE] LIBRARY MEMORY UNAVAILABLE",
                error
            );
        }
    }

    // --------------------------------------------------
    // 07 — INITIALIZATION
    // --------------------------------------------------

    state.visits.index = 1;

    render();
    void loadRememberedHosts();
    schedule();

    console.log(
        "[PARASITE OFFLINE] LIBRARY READY / 6 LOCAL DOCUMENTS"
    );

})();
