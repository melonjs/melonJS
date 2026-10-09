import { colorPool } from "../math/color.ts";
import { createPool, registerPool } from "../system/pool.ts";
import Renderable, { resetRenderableState } from "./renderable.js";

/**
 * additional import for TypeScript
 * @import {Color} from "./../math/color.ts";
 * @import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../video/webgl/webgl_renderer.js";
 * @import Camera2d from "./../camera/camera2d.ts";
 * @import Renderer from "../video/renderer.js";
 */

/**
 * a generic Color Layer Object.  Fills the entire Canvas with the color not just the container the object belongs to.
 * @category Game Objects
 */
export default class ColorLayer extends Renderable {
	/**
	 * @param {string} name - Layer name
	 * @param {Color|string} color - CSS color
	 * @param {number} [z = 0] - z-index position
	 */
	constructor(name, color, z) {
		// parent constructor
		super(0, 0, Infinity, Infinity);

		/**
		 * the layer color component
		 * @type {Color}
		 */
		this.color = colorPool.get().parseCSS(color);

		this.onResetEvent(name, color, z);
	}

	onResetEvent(name, color, z = 0) {
		// the inherited state first: a recycled layer carried the previous
		// one's alpha and blend mode, so a flash faded out came back faded
		if (typeof this.currentTransform !== "undefined") {
			resetRenderableState(this);
		}
		// apply given parameters
		this.name = name;
		this.pos.z = z;
		this.floating = true;
		// string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
		this.color.parseCSS(color);
	}

	/**
	 * draw this color layer (automatically called by melonJS)
	 * @param {Renderer} renderer - a renderer instance
	 * @param {Camera2d} [viewport] - the viewport to (re)draw
	 */
	draw(renderer, viewport) {
		renderer.save();
		renderer.clipRect(0, 0, viewport.width, viewport.height);
		renderer.clearColor(this.color);
		renderer.restore();
	}

	/**
	 * Destroy function
	 * @ignore
	 * @internal
	 */
	destroy() {
		colorPool.release(this.color);
		this.color = undefined;
		super.destroy();
	}
}

/**
 * A pool of reusable {@link ColorLayer} instances.
 *
 * Reachable as `getPool("colorLayer")`. `release` it yourself when the layer
 * is finished, or let a container do it: a layer this pool built carries the
 * pool it came from, so removing it from a container releases it back. Pass
 * `keepalive` to `removeChild()` to keep holding one.
 * @example
 * const flash = getPool("colorLayer").get("flash", "#ffffff", 10);
 * // ... later
 * getPool("colorLayer").release(flash);
 */
export const colorLayerPool = createPool((name, color, z) => {
	const instance = new ColorLayer(name, color, z);
	return {
		instance,
		reset(name, color, z) {
			instance.onResetEvent(name, color, z);
		},
	};
});

registerPool("colorLayer", colorLayerPool);
