import * as device from "../system/device.js";

/**
 * Create and return a new Canvas element (or `OffscreenCanvas` when
 * supported and `returnOffscreenCanvas` is true). The single low-level
 * allocator used by every renderer-side scratch / fallback / render-
 * target canvas in the engine.
 *
 * Lives in its own module (not on `Renderer` directly) to break the
 * circular dependency between `Renderer` and `CanvasRenderTarget` —
 * both can import this helper without referencing each other.
 * `Renderer.createCanvas` re-exposes it as a static method for the
 * public-facing API; internal callers can import it directly.
 *
 * Gates the OffscreenCanvas path on `device.offscreenCanvas` (the
 * vetted capability check — actually instantiates + verifies
 * `getContext("2d")` works inside a try/catch, covering historical
 * Safari quirks).
 * @param {number} width - canvas width in pixels
 * @param {number} height - canvas height in pixels
 * @param {boolean} [returnOffscreenCanvas=false] - return an
 *   `OffscreenCanvas` if the platform supports it
 * @returns {HTMLCanvasElement|OffscreenCanvas} a new canvas of the given size
 * @ignore
 */
export function createCanvas(width, height, returnOffscreenCanvas = false) {
	if (width === 0 || height === 0) {
		throw new Error(
			"width or height was zero, Canvas could not be initialized !",
		);
	}
	if (returnOffscreenCanvas === true && device.offscreenCanvas === true) {
		const c = new globalThis.OffscreenCanvas(width, height);
		// stub `style` for compatibility — OffscreenCanvas is detached
		// from the DOM but downstream code may read it
		if (typeof c.style === "undefined") {
			c.style = {};
		}
		return c;
	}
	const c = globalThis.document.createElement("canvas");
	c.width = width;
	c.height = height;
	return c;
}
