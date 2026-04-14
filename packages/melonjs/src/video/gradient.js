import { colorPool } from "../math/color.ts";

/**
 * @import {Color} from "../math/color.ts";
 */
import { nextPowerOfTwo } from "../math/math.ts";
import CanvasRenderTarget from "./rendertarget/canvasrendertarget.js";

/**
 * Shared render target for WebGL gradient textures.
 * Reused across all Gradient instances to avoid GPU memory leaks.
 * @ignore
 */
let sharedRenderTarget = null;
let sharedLastId = -1;
let sharedLastX = NaN;
let sharedLastY = NaN;
let nextGradientId = 0;

/**
 * A Gradient object representing a linear or radial gradient fill.
 * Created via {@link Renderer#createLinearGradient} or {@link Renderer#createRadialGradient}.
 * Can be passed to {@link Renderer#setColor} as a fill style.
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
		/** @ignore */
		this._id = nextGradientId++;

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

		/**
		 * cached parsed Color objects for sampling (lazily built)
		 * @type {{offset: number, color: Color}[]|null}
		 * @ignore
		 */
		this._parsedStops = null;
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
		// keep _renderTarget alive — the _dirty flag will trigger re-rendering
		// in toCanvasGradient() / toCanvas(), avoiding a GL texture leak
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
	 * @param {CanvasRenderer|WebGLRenderer} renderer - the active renderer (used to invalidate GPU texture)
	 * @param {number} x - draw rect x
	 * @param {number} y - draw rect y
	 * @param {number} width - draw rect width
	 * @param {number} height - draw rect height
	 * @returns {HTMLCanvasElement|OffscreenCanvas} the rendered gradient canvas
	 * @ignore
	 */
	toCanvas(renderer, x, y, width, height) {
		// use power-of-two dimensions for WebGL texture compatibility
		const tw = nextPowerOfTwo(Math.max(1, Math.ceil(width)));
		const th = nextPowerOfTwo(Math.max(1, Math.ceil(height)));

		// skip if this gradient already rendered to the shared target at these coords
		if (
			sharedRenderTarget &&
			sharedLastId === this._id &&
			!this._dirty &&
			sharedLastX === x &&
			sharedLastY === y &&
			sharedRenderTarget.width === tw &&
			sharedRenderTarget.height === th
		) {
			this._renderTarget = sharedRenderTarget;
			return this._renderTarget.canvas;
		}

		// reuse the shared render target to avoid GPU memory leaks
		if (!sharedRenderTarget) {
			sharedRenderTarget = new CanvasRenderTarget(tw, th);
		} else if (
			sharedRenderTarget.width !== tw ||
			sharedRenderTarget.height !== th
		) {
			sharedRenderTarget.canvas.width = tw;
			sharedRenderTarget.canvas.height = th;
		}
		this._renderTarget = sharedRenderTarget;

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
		sharedLastId = this._id;
		sharedLastX = x;
		sharedLastY = y;
		this._renderTarget.invalidate(renderer);
		return this._renderTarget.canvas;
	}

	/**
	 * Get the interpolated color at a given position along the gradient.
	 * Useful for procedural effects like trails that need per-segment colors.
	 * @param {number} position - position along the gradient (0.0–1.0)
	 * @param {Color} out - output Color object to write into
	 * @returns {Color} the output Color object
	 * @example
	 * const gradient = new Gradient("linear", [0, 0, 1, 0]);
	 * gradient.addColorStop(0, "#ff0000");
	 * gradient.addColorStop(1, "#0000ff");
	 * gradient.getColorAt(0.5, myColor); // myColor is now purple
	 */
	getColorAt(position, out) {
		if (!this._parsedStops || this._dirty) {
			this._buildParsedStops();
		}

		const stops = this._parsedStops;
		const len = stops.length;

		// single stop or before first
		if (len === 1 || position <= stops[0].offset) {
			return out.copy(stops[0].color);
		}

		// at or past last stop
		if (position >= stops[len - 1].offset) {
			return out.copy(stops[len - 1].color);
		}

		// find surrounding stops and interpolate in float space
		for (let i = 0; i < len - 1; i++) {
			if (position >= stops[i].offset && position <= stops[i + 1].offset) {
				const range = stops[i + 1].offset - stops[i].offset;
				const frac = range > 0 ? (position - stops[i].offset) / range : 0;
				const a = stops[i].color.toArray();
				const b = stops[i + 1].color.toArray();
				return out.setFloat(
					a[0] + (b[0] - a[0]) * frac,
					a[1] + (b[1] - a[1]) * frac,
					a[2] + (b[2] - a[2]) * frac,
					a[3] + (b[3] - a[3]) * frac,
				);
			}
		}

		return out;
	}

	/**
	 * Build the parsed Color cache from colorStops strings.
	 * @ignore
	 */
	_buildParsedStops() {
		// release previous cached colors
		if (this._parsedStops) {
			for (const stop of this._parsedStops) {
				colorPool.release(stop.color);
			}
		}

		this._parsedStops = this.colorStops.map((stop) => {
			return {
				offset: stop.offset,
				color: colorPool.get(stop.color),
			};
		});
	}

	/**
	 * Release pooled resources held by this gradient.
	 */
	destroy() {
		if (this._parsedStops) {
			for (const stop of this._parsedStops) {
				colorPool.release(stop.color);
			}
			this._parsedStops = null;
		}
	}
}
