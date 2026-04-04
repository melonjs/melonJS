import { Color } from "./../math/color.ts";
import { Matrix2d } from "../math/matrix2d.ts";

/**
 * Renderer-agnostic state container with a pre-allocated save/restore stack.
 *
 * Owns the mutable rendering state (color, tint, transform, scissor, blend mode)
 * and provides zero-allocation save()/restore() via index-based stacks.
 * Both CanvasRenderer and WebGLRenderer (and future WebGPU) delegate state
 * management here, keeping rendering-context-specific code in the renderers.
 */
export default class RenderState {
	constructor() {
		/**
		 * current fill & stroke style color
		 * @type {Color}
		 */
		this.currentColor = new Color(0, 0, 0, 1.0);

		/**
		 * current tint applied to sprites
		 * @type {Color}
		 */
		this.currentTint = new Color(255, 255, 255, 1.0);

		/**
		 * current transformation matrix
		 * @type {Matrix2d}
		 */
		this.currentTransform = new Matrix2d();

		/**
		 * current scissor/clipping rectangle [x, y, width, height]
		 * @type {Int32Array}
		 */
		this.currentScissor = new Int32Array(4);

		/**
		 * current gradient fill (null when using solid color)
		 * @type {Gradient|null}
		 */
		this.currentGradient = null;

		/**
		 * current blend mode
		 * @type {string}
		 */
		this.currentBlendMode = "none";

		// ---- pre-allocated save/restore stack ----

		/**
		 * @ignore
		 */
		this._stackCapacity = 32;

		/**
		 * current stack depth
		 * @ignore
		 */
		this._stackDepth = 0;

		/** @ignore */
		this._colorStack = Array.from({ length: this._stackCapacity }, () => {
			return new Color();
		});

		/** @ignore */
		this._tintStack = Array.from({ length: this._stackCapacity }, () => {
			return new Color();
		});

		/** @ignore */
		this._matrixStack = Array.from({ length: this._stackCapacity }, () => {
			return new Matrix2d();
		});

		/** @ignore */
		this._scissorStack = Array.from({ length: this._stackCapacity }, () => {
			return new Int32Array(4);
		});

		/** @ignore */
		this._scissorActive = new Uint8Array(this._stackCapacity);

		/** @ignore */
		this._gradientStack = new Array(this._stackCapacity);

		/** @ignore */
		this._blendStack = new Array(this._stackCapacity);
	}

	/**
	 * Save the current state onto the stack (zero allocations).
	 * @param {boolean} [scissorTestActive=false] - whether scissor/clip is currently enabled
	 */
	save(scissorTestActive = false) {
		const depth = this._stackDepth;

		if (depth >= this._stackCapacity) {
			this._growStacks();
		}

		this._colorStack[depth].copy(this.currentColor);
		this._tintStack[depth].copy(this.currentTint);
		this._matrixStack[depth].copy(this.currentTransform);
		this._gradientStack[depth] = this.currentGradient;
		this._blendStack[depth] = this.currentBlendMode;

		if (scissorTestActive) {
			this._scissorStack[depth].set(this.currentScissor);
			this._scissorActive[depth] = 1;
		} else {
			this._scissorActive[depth] = 0;
		}

		this._stackDepth = depth + 1;
	}

	/**
	 * Restore state from the stack.
	 * Color, tint, transform, and scissor are restored in place.
	 * Blend mode is NOT applied to `currentBlendMode` — it is returned so the
	 * renderer can call its own `setBlendMode()` (which has context-specific side effects).
	 * @param {number} canvasWidth - current canvas width (used when scissor was inactive)
	 * @param {number} canvasHeight - current canvas height (used when scissor was inactive)
	 * @returns {{ blendMode: string, scissorActive: boolean } | null} restored blend mode and scissor flag, or null if stack was empty
	 */
	restore(canvasWidth, canvasHeight) {
		if (this._stackDepth > 0) {
			const depth = --this._stackDepth;

			this.currentColor.copy(this._colorStack[depth]);
			this.currentTint.copy(this._tintStack[depth]);
			this.currentTransform.copy(this._matrixStack[depth]);
			this.currentGradient = this._gradientStack[depth];

			const scissorActive = !!this._scissorActive[depth];
			if (scissorActive) {
				this.currentScissor.set(this._scissorStack[depth]);
			} else {
				this.currentScissor[0] = 0;
				this.currentScissor[1] = 0;
				this.currentScissor[2] = canvasWidth;
				this.currentScissor[3] = canvasHeight;
			}

			return { blendMode: this._blendStack[depth], scissorActive };
		}
		return null;
	}

	/**
	 * Reset all state to defaults and clear the stack.
	 * @param {number} width - canvas width
	 * @param {number} height - canvas height
	 */
	reset(width, height) {
		this._stackDepth = 0;
		this.currentTransform.identity();
		this.currentScissor[0] = 0;
		this.currentScissor[1] = 0;
		this.currentScissor[2] = width;
		this.currentScissor[3] = height;
	}

	/** @private — doubles stack capacity when exceeded */
	_growStacks() {
		const oldCap = this._stackCapacity;
		const newCap = oldCap * 2;
		for (let i = oldCap; i < newCap; i++) {
			this._colorStack.push(new Color());
			this._tintStack.push(new Color());
			this._matrixStack.push(new Matrix2d());
			this._scissorStack.push(new Int32Array(4));
			this._gradientStack.push(null);
			this._blendStack.push(undefined);
		}
		const newScissorActive = new Uint8Array(newCap);
		newScissorActive.set(this._scissorActive);
		this._scissorActive = newScissorActive;
		this._stackCapacity = newCap;
	}
}
