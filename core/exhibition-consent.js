
/**
 * PARASITE EXHIBITION — COOKIE CONSENT
 * Only active during Exhibition AUTO mode.
 */
(() => {
    "use strict";

    const REJECT_SELECTORS = [
        "#onetrust-reject-all-handler",
        "#CybotCookiebotDialogBodyButtonDecline",
        "#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll"
    ];

    const attempted = new WeakSet();

    function dismissKnownConsent() {

        if (globalThis.parasiteExhibition?.active !== true) {
            return;
        }

        for (const selector of REJECT_SELECTORS) {

            const button = document.querySelector(selector);

            if (
                !button ||
                attempted.has(button) ||
                button.disabled
            ) {
                continue;
            }

            const style = getComputedStyle(button);

            if (
                button.getClientRects().length === 0 ||
                style.visibility === "hidden" ||
                style.display === "none"
            ) {
                continue;
            }

            attempted.add(button);
            button.click();

            console.log(
                "[PARASITE EXHIBITION] COOKIE CONSENT REJECTED",
                selector
            );

            return;
        }
    }

    window.setInterval(dismissKnownConsent, 2500);

})();
