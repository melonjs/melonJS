import { nextPowerOfTwo } from "../math/math.ts";
import CanvasRenderTarget from "./rendertarget/canvasrendertarget.js";

/**
 * @import {Color} from "../math/color.ts";
 */

/**
 * A Gradient object representing a linear or radial gradient fill.
 * Created via {@link CanvasRenderer#createLinearGradient}, {@link CanvasRenderer#createRadialGradient},
 * {@link WebGLRenderer#createLinearGradient}, or {@link WebGLRenderer#createRadialGradient}.
 * Can be passed to {@link CanvasRenderer#setColor} or {@link WebGLRenderer#setColor} as a fill style.
 */
export class Gradient {
	/**
	 * @param {"linear"|"radial"} type - the gradient type
	 * @param {number[]} coords - gradient coordinates [x0, y0, x1, y1] for linear, [x0, y0, r0, x1, y1, r1] for radial
	 */
	constructor(type, coords) {
		/**
		 * gradient type
		 * @type {"linear"|"radial"}
		 */
		this.type = type;

		/**
		 * gradient coordinates
		 * @type {number[]}
		 * @ignore
		 */
		this.coords = coords;

		/**
		 * color stops
		 * @type {Array<{offset: number, color: string}>}
		 * @ignore
		 */
		this.colorStops = [];

		/**
		 * cached canvas gradient (for Canvas renderer)
		 * @type {CanvasGradient|undefined}
		 * @ignore
		 */
		this._canvasGradient = undefined;

		/**
		 * cached gradient render target (for WebGL renderer)
		 * @type {CanvasRenderTarget|undefined}
		 * @ignore
		 */
		this._renderTarget = undefined;

		/**
		 * whether the gradient needs to be regenerated
		 * @type {boolean}
		 * @ignore
		 */
		this._dirty = true;
	}

	/**
	 * Add a color stop to the gradient.
	 * @param {number} offset - value between 0.0 and 1.0
	 * @param {Color|string} color - a CSS color string or Color object
	 * @returns {Gradient} this gradient for chaining
	 * @example
	 * gradient.addColorStop(0, "#FF0000");
	 * gradient.addColorStop(0.5, "green");
	 * gradient.addColorStop(1, "blue");
	 */
	addColorStop(offset, color) {
		if (offset < 0.0 || offset > 1.0) {
			throw new Error("offset must be between 0.0 and 1.0");
		}
		this.colorStops.push({
			offset,
			color: typeof color === "string" ? color : color.toRGBA(),
		});
		this._dirty = true;
		this._canvasGradient = undefined;
		this._renderTarget = undefined;
		return this;
	}

	/**
	 * Get or create a native CanvasGradient for use with a 2D context.
	 * @param {CanvasRenderingContext2D} context - the 2D context to create the gradient on
	 * @returns {CanvasGradient}
	 * @ignore
	 */
	toCanvasGradient(context) {
		if (this._canvasGradient && !this._dirty) {
			return this._canvasGradient;
		}

		const c = this.coords;
		if (this.type === "linear") {
			this._canvasGradient = context.createLinearGradient(
				c[0],
				c[1],
				c[2],
				c[3],
			);
		} else {
			this._canvasGradient = context.createRadialGradient(
				c[0],
				c[1],
				c[2],
				c[3],
				c[4],
				c[5],
			);
		}

		for (const stop of this.colorStops) {
			this._canvasGradient.addColorStop(stop.offset, stop.color);
		}

		this._dirty = false;
		return this._canvasGradient;
	}

	/**
	 * Render the gradient onto a canvas matching the given draw rect.
	 * Uses the original gradient coordinates so the result matches Canvas 2D behavior.
	 * @param {number} x - draw rect x
	 * @param {number} y - draw rect y
	 * @param {number} width - draw rect width
	 * @param {number} height - draw rect height
	 * @returns {HTMLCanvasElement|OffscreenCanvas} the rendered gradient canvas
	 * @ignore
	 */
	toCanvas(x, y, width, height) {
		// use power-of-two dimensions for WebGL texture compatibility
		const tw = nextPowerOfTwo(Math.max(1, Math.ceil(width)));
		const th = nextPowerOfTwo(Math.max(1, Math.ceil(height)));

		// return cached texture if nothing changed
		if (
			this._renderTarget &&
			!this._dirty &&
			this._lastX === x &&
			this._lastY === y &&
			this._renderTarget.width === tw &&
			this._renderTarget.height === th
		) {
			return this._renderTarget.canvas;
		}

		// reuse or create the render target
		if (!this._renderTarget) {
			this._renderTarget = new CanvasRenderTarget(tw, th);
		} else if (
			this._renderTarget.width !== tw ||
			this._renderTarget.height !== th
		) {
			this._renderTarget.canvas.width = tw;
			this._renderTarget.canvas.height = th;
		}

		const ctx = this._renderTarget.context;
		ctx.clearRect(0, 0, tw, th);

		// create gradient with coordinates offset to the draw rect origin
		const c = this.coords;
		let gradient;

		if (this.type === "linear") {
			gradient = ctx.createLinearGradient(
				c[0] - x,
				c[1] - y,
				c[2] - x,
				c[3] - y,
			);
		} else {
			gradient = ctx.createRadialGradient(
				c[0] - x,
				c[1] - y,
				c[2],
				c[3] - x,
				c[4] - y,
				c[5],
			);
		}

		for (const stop of this.colorStops) {
			gradient.addColorStop(stop.offset, stop.color);
		}

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, tw, th);

		this._dirty = false;
		this._lastX = x;
		this._lastY = y;
		return this._renderTarget.canvas;
	}
}
