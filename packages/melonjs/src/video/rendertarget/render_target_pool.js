/**
 * @import RenderTarget from "./rendertarget.ts";
 */

/**
 * Manages a pool of {@link RenderTarget} instances for post-effect processing.
 * Renderer-agnostic — the actual RenderTarget creation is delegated to a
 * factory function provided by the renderer (WebGL, WebGPU, etc.).
 *
 * Camera effects use pool indices 0 and 1 (capture + ping-pong),
 * sprite effects use indices 2 and 3.
 * Render targets are lazily created and resized to match the required dimensions.
 * @ignore
 */
export default class RenderTargetPool {
	/**
	 * @param {function(number, number): RenderTarget} factory - creates a RenderTarget with the given width and height
	 */
	constructor(factory) {
		/** @type {function(number, number): RenderTarget} */
		this._factory = factory;
		/** @type {RenderTarget[]} */
		this._pool = [];
		/** @type {number} */
		this._activeBase = -1;
		/** @type {number} */
		this._previousBase = -1;
	}

	/**
	 * Get or create a render target at the given pool index, resized to the given dimensions.
	 * @param {number} index - pool index
	 * @param {number} width - desired width in pixels
	 * @param {number} height - desired height in pixels
	 * @returns {RenderTarget} the render target
	 */
	get(index, width, height) {
		if (!this._pool[index]) {
			this._pool[index] = this._factory(width, height);
		} else {
			this._pool[index].resize(width, height);
		}
		return this._pool[index];
	}

	/**
	 * Prepare render targets for a post-effect pass.
	 * Allocates/resizes the capture target and optionally the ping-pong target.
	 * @param {boolean} isCamera - true for camera effects (indices 0+1), false for sprite (indices 2+3)
	 * @param {number} effectCount - number of enabled effects
	 * @param {number} width - target width in pixels
	 * @param {number} height - target height in pixels
	 * @returns {RenderTarget} the capture target (ready to bind)
	 */
	begin(isCamera, effectCount, width, height) {
		this._previousBase = this._activeBase;
		this._activeBase = isCamera ? 0 : 2;
		const rt = this.get(this._activeBase, width, height);
		if (effectCount > 1) {
			this.get(this._activeBase + 1, width, height);
		}
		return rt;
	}

	/**
	 * Get the capture render target for the current active pass.
	 * @returns {RenderTarget|undefined} the capture target, or undefined if no active pass
	 */
	getCaptureTarget() {
		if (this._activeBase < 0) {
			return undefined;
		}
		return this._pool[this._activeBase];
	}

	/**
	 * Get the ping-pong render target for the current active pass.
	 * @returns {RenderTarget|undefined} the ping-pong target, or undefined if no active pass
	 */
	getPingPongTarget() {
		if (this._activeBase < 0) {
			return undefined;
		}
		return this._pool[this._activeBase + 1];
	}

	/**
	 * End the current pass and restore the previous active base.
	 * Returns the parent render target to rebind (or null for screen).
	 * @returns {RenderTarget|null} the parent target, or null if returning to screen
	 */
	end() {
		this._activeBase = this._previousBase;
		this._previousBase = -1;
		if (this._activeBase >= 0 && this._pool[this._activeBase]) {
			return this._pool[this._activeBase];
		}
		return null;
	}

	/**
	 * Resize all existing render targets in the pool to the given dimensions.
	 * @param {number} width - new width in pixels
	 * @param {number} height - new height in pixels
	 */
	resizeAll(width, height) {
		for (const rt of this._pool) {
			if (rt) {
				rt.resize(width, height);
			}
		}
	}

	/**
	 * Destroy all render targets and clear the pool.
	 */
	destroy() {
		for (const rt of this._pool) {
			if (rt) {
				rt.destroy();
			}
		}
		this._pool.length = 0;
	}
}
