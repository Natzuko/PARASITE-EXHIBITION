
/**
 * PARASITE EXHIBITION — SURVIVAL AUDIO
 * Controls the existing audio engine's volume.
 * Does not create new audio sources.
 */
(() => {
    "use strict";

    const LEVELS = Object.freeze({
        ACTIVE: 0.18,
        UNSTABLE: 0.16,
        STARVATION: 0.11,
        NEAR_DEATH: 0.055,
        DORMANCY: 0.02,
        RECOVERY: 0.09
    });

    let resumePending = false;

    chrome.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {

            if (
                message?.type !==
                "PARASITE_EXHIBITION_AUDIO_PHASE"
            ) {
                return false;
            }

            const phase = message.phase;

            if (
                !Object.prototype.hasOwnProperty.call(
                    LEVELS,
                    phase
                )
            ) {
                sendResponse({
                    ok: false,
                    reason: "INVALID_PHASE"
                });

                return false;
            }

            const engine = globalThis.audioHost?.engine;

            if (
                !engine?.state?.active ||
                !engine.context ||
                !engine.masterGain
            ) {
                sendResponse({
                    ok: false,
                    reason: "AUDIO_NOT_STARTED"
                });

                return false;
            }

            if (engine.context.state !== "running") {

                if (
                    engine.context.state === "suspended" &&
                    !resumePending
                ) {
                    resumePending = true;

                    Promise.resolve()
                        .then(() => engine.context.resume())
                        .then(() => {
                            console.log(
                                "[PARASITE EXHIBITION] AUDIO RESUME RESULT",
                                engine.context.state
                            );
                        })
                        .catch((error) => {
                            console.warn(
                                "[PARASITE EXHIBITION] AUDIO RESUME FAILED",
                                error
                            );
                        })
                        .finally(() => {
                            resumePending = false;
                        });
                }

                sendResponse({
                    ok: false,
                    reason: "AUDIO_CONTEXT_NOT_RUNNING",
                    contextState: engine.context.state
                });

                return false;
            }


            const now = engine.context.currentTime;
            const gain = engine.masterGain.gain;

            const fadeSeconds =
                phase === "RECOVERY" ? 30 : 12;

            gain.cancelAndHoldAtTime(now);

            gain.linearRampToValueAtTime(
                LEVELS[phase],
                now + fadeSeconds
            );

            sendResponse({
                ok: true,
                phase
            });

            return false;
        }
    );
})();