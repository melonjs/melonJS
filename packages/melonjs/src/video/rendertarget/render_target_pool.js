/**
 * @import RenderTarget from "./rendertarget.ts";
 */

/**
 * Manages a pool of {@link RenderTarget} instances for post-effect processing.
 * Renderer-agnostic — the actual RenderTarget creation is delegated to a
 * factory function provided by the renderer (WebGL, WebGPU, etc.).
 *
 * Camera effects use pool indices 0 and 1 (capture + ping-pong); sprite
 * effects use indices 2 and 3, and each NESTED sprite pass (a multi-effect
 * renderable drawn inside another multi-effect renderable) gets its own pair
 * above that (4/5, 6/7, …), tracked by a stack of active bases so begin/end
 * pairs compose like save/restore.
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
		/**
		 * active pass bases, innermost last — a STACK, so nested begin/end
		 * pairs unwind correctly (two scalars silently corrupted the pool on
		 * nested passes: the inner end() popped the outer pass's slot)
		 * @type {number[]}
		 */
		this._baseStack = [];
	}

	/**
	 * The base index of the innermost active pass, or -1 when none.
	 * @returns {number}
	 */
	get activeBase() {
		return this._baseStack.length > 0
			? this._baseStack[this._baseStack.length - 1]
			: -1;
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
		let newBase;
		if (isCamera) {
			newBase = 0;
		} else {
			// each nested sprite pass gets its own capture/ping-pong pair
			// (2/3, then 4/5, 6/7, … — lazily allocated)
			let depth = 0;
			for (const base of this._baseStack) {
				if (base >= 2) {
					depth++;
				}
			}
			newBase = 2 + depth * 2;
		}
		this._baseStack.push(newBase);
		const rt = this.get(newBase, width, height);
		if (effectCount > 1) {
			this.get(newBase + 1, width, height);
		}
		return rt;
	}

	/**
	 * Get the capture render target for the current active pass.
	 * @returns {RenderTarget|undefined} the capture target, or undefined if no active pass
	 */
	getCaptureTarget() {
		const base = this.activeBase;
		if (base < 0) {
			return undefined;
		}
		return this._pool[base];
	}

	/**
	 * Get the ping-pong render target for the current active pass.
	 * @returns {RenderTarget|undefined} the ping-pong target, or undefined if no active pass
	 */
	getPingPongTarget() {
		const base = this.activeBase;
		if (base < 0) {
			return undefined;
		}
		return this._pool[base + 1];
	}

	/**
	 * End the current pass and restore the previous active base.
	 * Returns the parent render target to rebind (or null for screen).
	 * @returns {RenderTarget|null} the parent target, or null if returning to screen
	 */
	end() {
		this._baseStack.pop();
		const base = this.activeBase;
		if (base >= 0 && this._pool[base]) {
			return this._pool[base];
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
		this._baseStack.length = 0;
	}
}
