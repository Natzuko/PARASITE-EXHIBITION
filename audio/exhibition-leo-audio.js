/**
 * PARASITE EXHIBITION — LEO AUDIO
 * Reproduccion puntual, independiente del audio original.
 * Se carga dentro de offscreen.html (Chrome 109).
 */
(() => {
    "use strict";

    const AUDIO_PATH = "audio/leo_nostalgia.m4a";
    const MESSAGE_TYPE =
        "PARASITE_EXHIBITION_LEO_PLAY_OFFSCREEN";

    let bufferPromise = null;
    let playing = false;

    async function loadBuffer(context) {
        if (!bufferPromise) {
            bufferPromise = (async () => {
                const response = await fetch(
                    chrome.runtime.getURL(AUDIO_PATH)
                );

                if (!response.ok) {
                    throw new Error(
                        `Leo audio HTTP ${response.status}`
                    );
                }

                const data = await response.arrayBuffer();
                return context.decodeAudioData(data);
            })().catch((error) => {
                bufferPromise = null;
                throw error;
            });
        }

        return bufferPromise;
    }

    async function playLeo() {
        const engine = globalThis.audioHost?.engine;
        const context = engine?.context;

        if (
            !engine?.state?.active ||
            context?.state !== "running"
        ) {
            return {
                ok: false,
                reason: "AUDIO_NOT_RUNNING"
            };
        }

        if (playing) {
            return {
                ok: false,
                reason: "LEO_ALREADY_PLAYING"
            };
        }

        playing = true;

        try {
            const buffer = await loadBuffer(context);

            if (context.state !== "running") {
                playing = false;
                return {
                    ok: false,
                    reason: "AUDIO_NOT_RUNNING"
                };
            }

            const source = context.createBufferSource();
            const gain = context.createGain();

            source.buffer = buffer;

            // Solo regula el nivel de Leo.
            // No modifica el volumen de PARASITE.
            gain.gain.value = 0.35;

            source.connect(gain);
            gain.connect(context.destination);

            source.onended = () => {
                playing = false;
                source.disconnect();
                gain.disconnect();
            };

            source.start();

            console.log(
                "[PARASITE EXHIBITION] LEO AUDIO PLAYING"
            );

            return {
                ok: true,
                duration: buffer.duration
            };

        } catch (error) {
            playing = false;

            console.error(
                "[PARASITE EXHIBITION] LEO AUDIO ERROR",
                error
            );

            return {
                ok: false,
                reason: "LEO_AUDIO_FAILED"
            };
        }
    }

    chrome.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {

            if (message?.type !== MESSAGE_TYPE) {
                return false;
            }

            playLeo().then(sendResponse);

            return true;
        }
    );
})();
