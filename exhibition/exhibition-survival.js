
/**
 * PARASITE EXHIBITION — MODULE 05A
 * Survival state machine (background / Chrome 109)
 *
 * Does not check connectivity itself, draw, play audio,
 * navigate, or modify the organism's memory.
 */
(() => {
    "use strict";

    const STORAGE_KEY = "parasiteExhibitionSurvivalV1";
    const STARVATION_AFTER = 60 * 1000;
    const NEAR_DEATH_AFTER = 5 * 60 * 1000;
    const DORMANCY_AFTER = 15 * 60 * 1000;
    const RECOVERY_TIME = 90 * 1000;

    class ExhibitionSurvival {
        constructor() {
            this.data = {
                offlineSince: null,
                recoverySince: null,
                failedChecks: 0,
                healthyChecks: 0,
                lastCheckAt: null
            };

            this.ready = this.restore();
        }

        async restore() {
            try {
                const saved = await chrome.storage.session.get(STORAGE_KEY);
                const value = saved[STORAGE_KEY];

                if (value && typeof value === "object") {
                    for (const key of Object.keys(this.data)) {
                        if (Object.prototype.hasOwnProperty.call(value, key)) {
                            this.data[key] = value[key];
                        }
                    }
                }
            } catch (error) {
                console.warn(
                    "[PARASITE EXHIBITION] SURVIVAL RESTORE ERROR",
                    error
                );
            }
        }

        phase(now) {
            const state = this.data;

            if (state.recoverySince !== null) {
                return "RECOVERY";
            }

            if (state.offlineSince !== null) {
                const duration = Math.max(
                    0,
                    now - state.offlineSince
                );

                if (duration >= DORMANCY_AFTER) return "DORMANCY";
                if (duration >= NEAR_DEATH_AFTER) return "NEAR_DEATH";
                if (duration >= STARVATION_AFTER) return "STARVATION";

                return "UNSTABLE";
            }

            if (state.failedChecks > 0) return "UNSTABLE";

            return state.lastCheckAt === null
                ? "UNKNOWN"
                : "ACTIVE";
        }

        async getState() {
            await this.ready;

            const now = Date.now();

            return {
                phase: this.phase(now),
                offlineForMs: this.data.offlineSince === null
                    ? 0
                    : Math.max(0, now - this.data.offlineSince),
                lastCheckAt: this.data.lastCheckAt
            };
        }

        async reportConnectivity(reachable) {
            await this.ready;

            if (typeof reachable !== "boolean") {
                return this.getState();
            }

            const now = Date.now();
            const before = this.phase(now);
            const state = this.data;

            if (reachable) {
                state.healthyChecks = Math.min(
                    10,
                    state.healthyChecks + 1
                );

                state.failedChecks = 0;

                if (state.offlineSince !== null) {
                    if (
                        state.healthyChecks >= 2 &&
                        state.recoverySince === null
                    ) {
                        state.recoverySince = now;
                    }

                    if (
                        state.recoverySince !== null &&
                        now - state.recoverySince >= RECOVERY_TIME
                    ) {
                        state.offlineSince = null;
                        state.recoverySince = null;
                    }
                }
            } else {
                state.failedChecks = Math.min(
                    10,
                    state.failedChecks + 1
                );

                state.healthyChecks = 0;
                state.recoverySince = null;

                if (
                    state.failedChecks >= 2 &&
                    state.offlineSince === null
                ) {
                    state.offlineSince = now;
                }
            }

            state.lastCheckAt = now;

            await chrome.storage.session.set({
                [STORAGE_KEY]: state
            });

            const result = await this.getState();

            if (result.phase !== before) {
                console.log(
                    "[PARASITE EXHIBITION] SURVIVAL:",
                    before,
                    "->",
                    result.phase
                );
            }

            return result;
        }
    }

    globalThis.parasiteExhibitionSurvival =
        new ExhibitionSurvival();
})();
