import { game } from "../application/application.ts";
import { defaultApplicationSettings } from "../application/defaultApplicationSettings.ts";
import { warning } from "../lang/console.js";
import { initialized } from "../system/bootstrap.ts";
import { on, VIDEO_INIT } from "../system/event.ts";
import Renderer from "./renderer.js";

/**
 * @namespace video
 */

/**
 * Select the HTML5 Canvas renderer
 */
/**
 * Select the WebGL renderer
 */
/**
 * Auto-select the renderer (Attempt WebGL first, with fallback to Canvas)
 */
export { AUTO, CANVAS, WEBGL } from "../const";

/**
 * A reference to the active Canvas or WebGL renderer.
 * @memberof video
 * @type {CanvasRenderer|WebGLRenderer}
 * @deprecated since 18.3.0 — use {@link Application#renderer app.renderer} instead.
 * @see Application#renderer
 */
export let renderer = null;

// backward compatibility: keep video.renderer in sync
// when Application is used directly instead of video.init()
on(VIDEO_INIT, (r) => {
	renderer = r;
});

/**
 * Initialize the "video" system (create a canvas based on the given arguments, and the related renderer). <br>
 * @memberof video
 * @param {number} width - The width of the canvas viewport
 * @param {number} height - The height of the canvas viewport
 * @param {ApplicationSettings} [options] - optional parameters for the renderer
 * @returns {boolean} false if initialization failed (canvas not supported)
 * @deprecated since 18.3.0 — use {@link Application} constructor instead:
 * `const app = new Application(width, height, options)`
 * @see Application
 * @example
 * // using the new Application entry point (recommended)
 * const app = new Application(640, 480, {
 *     parent : "screen",
 *     scale : "auto",
 *     scaleMethod : "fit"
 * });
 *
 * // legacy usage (still supported)
 * me.video.init(640, 480, {
 *     parent : "screen",
 *     renderer : me.video.AUTO,
 *     scale : "auto",
 *     scaleMethod : "fit"
 * });
 */
export function init(width, height, options) {
	// ensure melonjs has been properly initialized
	if (!initialized) {
		throw new Error("me.video.init() called before engine initialization.");
	}

	try {
		// initialize the default game Application with the given options
		game.init(width, height, {
			...defaultApplicationSettings,
			...(options || {}),
		});
	} catch (e) {
		console.log(e.message);
		// me.video.init() historically returns false if failing at creating/using a HTML5 canvas
		return false;
	}

	// DOM event listeners and VIDEO_INIT are now handled by Application.init()

	return true;
}

/**
 * Create and return a new Canvas element.
 * @memberof video
 * @param {number} width - width
 * @param {number} height - height
 * @param {boolean} [returnOffscreenCanvas=false] - will return an OffscreenCanvas if supported
 * @returns {HTMLCanvasElement|OffscreenCanvas} a new Canvas element of the given size
 * @deprecated since 19.7.0 — use {@link Renderer.createCanvas} instead.
 * @see Renderer.createCanvas
 */
export function createCanvas(width, height, returnOffscreenCanvas = false) {
	warning("video.createCanvas", "Renderer.createCanvas", "19.7.0");
	return Renderer.createCanvas(width, height, returnOffscreenCanvas);
}

/**
 * return a reference to the parent DOM element holding the main canvas
 * @memberof video
 * @returns {HTMLElement} the HTML parent element
 * @deprecated since 18.3.0 — use {@link Application#getParentElement app.getParentElement()} instead.
 * @see Application#getParentElement
 */
export function getParent() {
	return game.getParentElement();
}
