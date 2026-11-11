import { nodeJS } from "./platform.ts";

/**
 * Execute a callback when the DOM is ready.
 * In Node.js, when there is no DOM, or when the DOM is already parsed,
 * the callback is deferred to the next microtask.
 * @param fn - callback to execute when the DOM is ready
 * @ignore
 * @internal
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

/**
 * Whether this runtime has a DOM: a `document` to create elements in, attach
 * the canvas to and listen on. False in a Web Worker and in browser-like
 * runtimes that only implement the web APIs a game draws and plays sound with,
 * such as nx.js on the Nintendo Switch, where the display is a canvas handed
 * to the Application (`settings.canvas`) and nothing is laid out around it.
 *
 * Read at call time, not cached at import, so code loaded before a `document`
 * shim is installed still sees it.
 * @returns true if `globalThis.document` exists
 * @ignore
 * @internal
 */
export const hasDOM = (): boolean => typeof globalThis.document !== "undefined";
