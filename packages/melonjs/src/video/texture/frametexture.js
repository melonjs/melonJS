import Texture2d from "./texture2d.ts";

/**
 * A GPU-resident texture holding a captured frame — the value returned by
 * {@link WebGLRenderer#toFrameTexture}. Its backing is a live `WebGLTexture`
 * that the renderer refreshes **in place** on each capture, so a shader that
 * has bound it once (via {@link ShaderEffect#setTexture}) keeps sampling the
 * latest frame with no re-bind.
 *
 * Not part of the public class surface: obtain instances from
 * `renderer.toFrameTexture()` and treat them as opaque {@link Texture2d}
 * values. The `isGPUResident` flag is the discriminant `setTexture` uses to
 * take its live-bind path (bind the existing handle) instead of uploading a
 * static copy.
 * @augments Texture2d
 * @ignore
 */
export class FrameTexture extends Texture2d {
	/**
	 * @param {WebGLRenderer} renderer - the owning renderer (for the GL context)
	 * @param {number} width - capture width in pixels
	 * @param {number} height - capture height in pixels
	 */
	constructor(renderer, width, height) {
		super();
		this._renderer = renderer;
		/** @type {number} */
		this.width = width;
		/** @type {number} */
		this.height = height;
		/**
		 * the live backing texture, (re)filled by `renderer.toFrameTexture` and
		 * bound (never re-uploaded) by consumers
		 * @type {WebGLTexture|null}
		 */
		this.glTexture = null;
		/**
		 * marks this as a live GPU-resident source — see {@link ShaderEffect#setTexture}
		 * @type {boolean}
		 */
		this.isGPUResident = true;
	}

	/**
	 * The opaque GPU-resident backing — itself.
	 * @returns {FrameTexture}
	 */
	getTexture() {
		return this;
	}

	/**
	 * Delete the backing GL texture. Invoked on the renderer-owned shared slot
	 * at context loss / renderer teardown, or by a caller that owns a `target`
	 * capture and is done with it. Idempotent.
	 */
	destroy() {
		if (this.glTexture !== null) {
			this._renderer.gl.deleteTexture(this.glTexture);
			this.glTexture = null;
		}
	}
}

/**
 * The Canvas-renderer counterpart of {@link FrameTexture}: a captured frame
 * backed by an offscreen `<canvas>` copy of the drawing buffer, keeping the
 * `toFrameTexture` family renderer-complete. A drawable source (not
 * GPU-resident), so it flows through the normal image path; custom shaders
 * don't run under the Canvas renderer, so this exists for API parity and
 * CPU-side reuse (e.g. drawing the captured frame back onto the scene).
 * @augments Texture2d
 * @ignore
 */
export class CanvasFrameTexture extends Texture2d {
	/**
	 * @param {HTMLCanvasElement|OffscreenCanvas} canvas - the backing copy
	 */
	constructor(canvas) {
		super();
		/** @type {HTMLCanvasElement|OffscreenCanvas} */
		this.canvas = canvas;
		/** @type {number} */
		this.width = canvas.width;
		/** @type {number} */
		this.height = canvas.height;
	}

	/**
	 * The backing canvas copy.
	 * @returns {HTMLCanvasElement|OffscreenCanvas}
	 */
	getTexture() {
		return this.canvas;
	}
}
