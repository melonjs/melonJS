import { nodeJS } from "./platform.ts";

/**
 * Execute a callback when the DOM is ready.
 * Emits the DOM_READY event and calls the provided function.
 * In Node.js or when the DOM is already parsed, the callback
 * is deferred to the next microtask.
 * @param fn - callback to execute when the DOM is ready
 * @ignore
 */
export const DOMContentLoaded = (fn: () => void) => {
	if (
		nodeJS ||
		typeof globalThis.document === "undefined" ||
		globalThis.document.readyState !== "loading"
	) {
		// DOM already ready (or no DOM environment), defer to next microtask
		void Promise.resolve().then(fn);
	} else {
		globalThis.document.addEventListener("DOMContentLoaded", fn, {
			once: true,
		});
	}
};
