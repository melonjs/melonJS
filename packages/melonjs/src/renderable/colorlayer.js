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
 * A layer of one color.
 *
 * By default it fills the entire canvas with the color, whatever container it
 * belongs to and wherever the camera is: a background.
 *
 * It is a renderable like any other, though: give it a size, and it fills
 * that rectangle only, where it is (`pos`, by its `anchorPoint`). Not
 * `floating`, the rectangle is one of the world, and scrolls with it: the
 * floor of a room, the background of one level among several. Left
 * `floating`, it is one of the screen: a panel.
 *
 * It is also a class a level can name: an object of class `ColorLayer` in a
 * map, with a `color` property, fills the object's rectangle (and the
 * canvas, when the object is a point: it has no size).
 * @category Game Objects
 * @example
 * // a background: the whole canvas, behind everything
 * app.world.addChild(new ColorLayer("background", "#202020"), 0);
 *
 * // a colored rectangle of the world: 320 x 180 pixels at (640, 0)
 * const cave = new ColorLayer("cave", "#1b1026");
 * cave.floating = false;
 * cave.anchorPoint.set(0, 0);
 * cave.pos.x = 640;
 * cave.resize(320, 180);
 * app.world.addChild(cave, 1);
 */
export default class ColorLayer extends Renderable {
	/**
	 * @overload
	 * @param {string} name - Layer name
	 * @param {Color|string} color - CSS color
	 * @param {number} [z = 0] - z-index position
	 */
	/**
	 * As an object of a level, the way a class registered with
	 * {@link registerObjectClass} is built: the object's rectangle, in its
	 * `color`, at its place in the world.
	 * @overload
	 * @param {number} x - the object's left edge
	 * @param {number} y - the object's top edge
	 * @param {{name?: string, color?: Color|string, width?: number, height?: number, z?: number}} settings - the object: its `color` (black without one), its size (the canvas is filled when it has none), its `name` and its `z`
	 */
	/**
	 * @param {string|number} name - the layer's name, or the object's left edge
	 * @param {Color|string|number} color - the color, or the object's top edge
	 * @param {number|object} [z] - the z-index, or the object
	 * @ignore
	 */
	constructor(name, color, z) {
		// parent constructor
		super(0, 0, Infinity, Infinity);

		/**
		 * the layer color component
		 * @type {Color}
		 */
		this.color = colorPool.get();

		this.onResetEvent(name, color, z);
	}

	onResetEvent(name, color, z = 0) {
		// the inherited state first: a recycled layer carried the previous
		// one's alpha and blend mode, so a flash faded out came back faded
		if (typeof this.currentTransform !== "undefined") {
			resetRenderableState(this);
		}
		// the whole canvas, wherever the camera is, until it is given a size
		this.floating = true;
		this.pos.x = 0;
		this.pos.y = 0;
		this.resize(Infinity, Infinity);
		// built as an object of a level, `(x, y, settings)`: the object's
		// rectangle in the world, in its `color`
		if (typeof name === "number" && typeof z === "object" && z !== null) {
			const settings = z;
			// (a size read from a file can be text)
			const width = Number(settings.width);
			const height = Number(settings.height);
			if (
				Number.isFinite(width) &&
				Number.isFinite(height) &&
				width > 0 &&
				height > 0
			) {
				this.floating = false;
				this.anchorPoint.set(0, 0);
				this.pos.x = name;
				this.pos.y = color;
				this.resize(width, height);
			}
			name = settings.name;
			color = settings.color ?? "#000000";
			z = settings.z ?? 0;
		}
		// apply given parameters
		this.name = name;
		this.pos.z = z;
		// string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
		this.color.parseCSS(color);
	}

	/**
	 * draw this color layer (automatically called by melonJS)
	 * @param {Renderer} renderer - a renderer instance
	 * @param {Camera2d} [viewport] - the viewport to (re)draw
	 */
	draw(renderer, viewport) {
		if (Number.isFinite(this.width) && Number.isFinite(this.height)) {
			// a size of its own: a rectangle of the color, where the layer is
			renderer.setColor(this.color);
			renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
			return;
		}
		// a zoomed camera measures itself in the world it sees while the
		// world is drawn, and the layer fills the screen: scale back by the
		// zoom, as ImageLayer does, or zoomed in it fills part of the view
		const zoom = viewport.zoom;
		renderer.save();
		// (with one side of a size and the other endless, it is no rectangle:
		// the offset its anchor gave the side that has a size is taken back)
		renderer.translate(
			Number.isFinite(this.width) ? this.width * this.anchorPoint.x : 0,
			Number.isFinite(this.height) ? this.height * this.anchorPoint.y : 0,
		);
		renderer.clipRect(0, 0, viewport.width * zoom, viewport.height * zoom);
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
