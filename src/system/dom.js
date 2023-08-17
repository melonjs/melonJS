import * as event from "./event.js";
import { nodeJS } from "./platform.js";

// track if DOMContentLoaded was called already
let readyBound = false;

// is the DOM ready ?
let isDOMReady = false;

// check if the dom is ready
function _domReady() {

    // Make sure that the DOM is not already loaded
    if (!isDOMReady) {
        // be sure document.body is there
        if (typeof globalThis.document !== "undefined" && !globalThis.document.body) {
            return setTimeout(_domReady, 13);
        }

        // clean up loading event
        if (typeof globalThis.document !== "undefined" && typeof globalThis.document.removeEventListener === "function") {
            globalThis.document.removeEventListener(
                "DOMContentLoaded",
                _domReady,
                false
            );
        }

        if (typeof globalThis.removeEventListener === "function") {
            // remove the event on globalThis.onload (always added in `onReady`)
            globalThis.removeEventListener("load", _domReady, false);
        }

        // execute all callbacks
        event.emit(event.DOM_READY);

        // Remember that the DOM is ready
        isDOMReady = true;
    }
}

// https://developer.mozilla.org/en-US/docs/Web/API/Window/DOMContentLoaded_event
export function DOMContentLoaded(fn) {
    // If the DOM is already ready
    if (isDOMReady) {
        // Execute the function immediately
        fn.call(globalThis, []);
    }
    else {
        // else add the function to the DOM_READY event
        event.once(event.DOM_READY, fn, globalThis);
        // bind dom load event if not done yet
        if (!readyBound) {
            // directly call domReady if document is already "ready"
            if (nodeJS === true || (typeof globalThis.document !== "undefined" && globalThis.document.readyState === "complete")) {
                // defer the fn call to ensure our script is fully loaded
                globalThis.setTimeout(_domReady, 0);
            }
            else {
                if (typeof globalThis.document !== "undefined" && typeof globalThis.document.addEventListener === "function") {
                    // Use the handy event callback
                    globalThis.document.addEventListener("DOMContentLoaded", _domReady, false);
                }
                // A fallback to globalThis.onload, that will always work
                globalThis.addEventListener("load", _domReady, false);
            }
            readyBound = true;
        }
    }
}
