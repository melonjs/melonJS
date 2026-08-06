import { colorPool } from "../math/color.ts";

/**
 * @import {Color} from "../math/color.ts";
 */
import CanvasRenderTarget from "./rendertarget/canvasrendertarget.js";

/**
 * The gradient bake resolution: gradients are rasterized into a FIXED
 * 256×256 shared target regardless of on-screen size and stretched by the
 * destination quad — a gradient is piecewise-linear between its stops and
 * the GPU interpolates linearly between texels, so a capped bake is
 * visually equivalent to a full-size one. The fixed size means the shared
 * target is allocated exactly once and never resized: every re-bake is a
 * same-size texture update (the cheap path on every backend), and memory
 * is capped at 256 KB instead of growing with the largest gradient drawn.
 * @ignore
 */
const GRADIENT_BAKE_SIZE = 256;

/**
 * Shared render target for GPU gradient textures.
 * Reused across all Gradient instances to avoid GPU memory leaks.
 * @ignore
 */
let sharedRenderTarget = null;
let sharedLastId = -1;
let sharedLastX = NaN;
let sharedLastY = NaN;
let sharedLastW = NaN;
let sharedLastH = NaN;
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
		// invalidate parsed Color cache so getColorAt() rebuilds on next call
		if (this._parsedStops) {
			for (const stop of this._parsedStops) {
				colorPool.release(stop.color);
			}
			this._parsedStops = null;
		}
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
	 * Render the gradient into the fixed-resolution shared bake target for
	 * the given draw rect. Uses the original gradient coordinates so the
	 * result matches Canvas 2D behavior. Rects larger than the bake target
	 * are rasterized scaled-down; the destination quad stretches them back,
	 * which is visually equivalent (linear stop interpolation × linear
	 * texture filtering). The returned `width`/`height` describe the region
	 * of the canvas the caller must use as the drawImage SOURCE rect.
	 * @param {CanvasRenderer|WebGLRenderer} renderer - the active renderer (used to invalidate the GPU texture)
	 * @param {number} x - draw rect x
	 * @param {number} y - draw rect y
	 * @param {number} width - draw rect width
	 * @param {number} height - draw rect height
	 * @returns {{canvas: HTMLCanvasElement|OffscreenCanvas, width: number, height: number}} the shared gradient canvas + the used source-rect size
	 * @ignore
	 */
	toCanvas(renderer, x, y, width, height) {
		const w = Math.max(1, width);
		const h = Math.max(1, height);
		// bake 1:1 up to the target size, scaled-down beyond it
		const sx = w > GRADIENT_BAKE_SIZE ? GRADIENT_BAKE_SIZE / w : 1;
		const sy = h > GRADIENT_BAKE_SIZE ? GRADIENT_BAKE_SIZE / h : 1;
		const sw = w * sx;
		const sh = h * sy;

		// skip if this gradient already rendered to the shared target for
		// this exact rect (the target is fixed-size, so the RECT — not the
		// canvas dimensions — is the identity of the last bake)
		if (
			sharedRenderTarget &&
			sharedLastId === this._id &&
			!this._dirty &&
			sharedLastX === x &&
			sharedLastY === y &&
			sharedLastW === w &&
			sharedLastH === h
		) {
			this._renderTarget = sharedRenderTarget;
			return { canvas: this._renderTarget.canvas, width: sw, height: sh };
		}

		// the shared target is allocated once and never resized — every
		// bake is a same-size update, the cheap path on every backend
		if (!sharedRenderTarget) {
			sharedRenderTarget = new CanvasRenderTarget(
				GRADIENT_BAKE_SIZE,
				GRADIENT_BAKE_SIZE,
			);
		}
		this._renderTarget = sharedRenderTarget;

		const ctx = this._renderTarget.context;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, GRADIENT_BAKE_SIZE, GRADIENT_BAKE_SIZE);

		// bake through the scale so gradient coordinates stay in draw-rect
		// (logical) space; the destination quad's stretch inverts it exactly
		ctx.setTransform(sx, 0, 0, sy, 0, 0);

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
		// fill the WHOLE canvas (in logical units) so the padding beyond the
		// used region carries the extended gradient — linear filtering at the
		// source-rect edge then samples gradient-colored texels, not
		// transparent ones (same edge behavior as the old full-canvas bake)
		ctx.fillRect(0, 0, GRADIENT_BAKE_SIZE / sx, GRADIENT_BAKE_SIZE / sy);
		ctx.setTransform(1, 0, 0, 1, 0, 0);

		this._dirty = false;
		sharedLastId = this._id;
		sharedLastX = x;
		sharedLastY = y;
		sharedLastW = w;
		sharedLastH = h;
		this._renderTarget.invalidate(renderer);
		return { canvas: this._renderTarget.canvas, width: sw, height: sh };
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
		if (!this._parsedStops) {
			this._buildParsedStops();
		}

		const stops = this._parsedStops;
		const len = stops.length;

		// no stops defined
		if (len === 0) {
			return out;
		}

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
		this._parsedStops = this.colorStops
			.map((stop) => {
				return {
					offset: stop.offset,
					color: colorPool.get(stop.color),
				};
			})
			.sort((a, b) => {
				return a.offset - b.offset;
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
