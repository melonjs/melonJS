import { vector2dPool } from "../math/vector2d.ts";
import {
	LEVEL_LOADED,
	ONCONTEXT_RESTORED,
	off,
	on,
	VIEWPORT_ONCHANGE,
	VIEWPORT_ONRESIZE,
} from "../system/event.ts";
import * as stringUtil from "./../utils/string.ts";
import Sprite from "./sprite.js";

/**
 * additional import for TypeScript
 * @import {Vector2d} from "../math/vector2d.js";
 */

/**
 * a generic Image Layer Object
 * @category Game Objects
 */
export default class ImageLayer extends Sprite {
	/**
	 * @param {number} x - x coordinate
	 * @param {number} y - y coordinate
	 * @param {object} settings - ImageLayer properties
	 * @param {HTMLImageElement|HTMLCanvasElement|CompressedImage|string} settings.image - Image reference. See {@link loader.getImage}
	 * @param {string} [settings.name="me.ImageLayer"] - layer name
	 * @param {number} [settings.z=0] - z-index position
	 * @param {number|Vector2d} [settings.ratio=1.0] - Scrolling ratio to be applied. See {@link ImageLayer#ratio}
	 * @param {"repeat"|"repeat-x"|"repeat-y"|"no-repeat"} [settings.repeat="repeat"] - define if and how an Image Layer should be repeated. See {@link ImageLayer#repeat}
	 * @param {number|Vector2d} [settings.anchorPoint=<0.0,0.0>] - Define how the image is anchored to the viewport bound. By default, its upper-left corner is anchored to the viewport bounds upper left corner.
	 * @example
	 * // create a repetitive background pattern on the X axis using the citycloud image asset
	 * app.world.addChild(new me.ImageLayer(0, 0, {
	 *     image:"citycloud",
	 *     repeat :"repeat-x"
	 * }), 1);
	 */
	constructor(x, y, settings) {
		// call the constructor
		super(x, y, settings);

		// render in screen coordinates
		this.floating = true;

		// background layers should render in all cameras (e.g. minimap, split-screen)
		this.visibleInAllCameras = true;

		// image drawing offset
		this.offset.set(x, y);

		/**
		 * Define the image scrolling ratio<br>
		 * Scrolling speed is defined by multiplying the viewport delta position by the specified ratio.
		 * Setting this vector to &lt;0.0,0.0&gt; will disable automatic scrolling.<br>
		 * To specify a value through Tiled, use one of the following format : <br>
		 * - a number, to change the value for both axis <br>
		 * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
		 * @type {Vector2d}
		 * @default <1.0,1.0>
		 */
		this.ratio = vector2dPool.get(1.0, 1.0);

		if (typeof settings.ratio !== "undefined") {
			// little hack for backward compatibility
			if (stringUtil.isNumeric(settings.ratio)) {
				this.ratio.set(settings.ratio, +settings.ratio);
			} /* vector */ else {
				this.ratio.setV(settings.ratio);
			}
		}

		if (typeof settings.anchorPoint === "undefined") {
			this.anchorPoint.set(0, 0);
		} else {
			if (typeof settings.anchorPoint === "number") {
				this.anchorPoint.set(settings.anchorPoint, settings.anchorPoint);
			} /* vector */ else {
				this.anchorPoint.set(settings.anchorPoint.x, settings.anchorPoint.y);
			}
		}

		this.repeat = settings.repeat || "repeat";
	}

	/**
	 * Define if and how an Image Layer should be repeated.<br>
	 * By default, an Image Layer is repeated both vertically and horizontally.<br>
	 * Acceptable values : <br>
	 * - 'repeat' - The background image will be repeated both vertically and horizontally <br>
	 * - 'repeat-x' - The background image will be repeated only horizontally.<br>
	 * - 'repeat-y' - The background image will be repeated only vertically.<br>
	 * - 'no-repeat' - The background-image will not be repeated.<br>
	 * @type {string}
	 * @default 'repeat'
	 */
	get repeat() {
		return this._repeat;
	}

	set repeat(value) {
		this._repeat = value;
		switch (this._repeat) {
			case "no-repeat":
				this.repeatX = false;
				this.repeatY = false;
				break;
			case "repeat-x":
				this.repeatX = true;
				this.repeatY = false;
				break;
			case "repeat-y":
				this.repeatX = false;
				this.repeatY = true;
				break;
			default: // "repeat"
				this.repeatX = true;
				this.repeatY = true;
				break;
		}
	}

	// called when the layer is added to the game world or a container
	onActivateEvent() {
		if (!this.parentApp) {
			throw new Error(
				"ImageLayer requires a parent Application (must be added to an app's world container)",
			);
		}
		const viewport = this.parentApp.viewport;
		// set the initial size to match the viewport
		this.resize(viewport.width, viewport.height);
		this.createPattern();
		// register to the viewport change notification and context restore
		on(VIEWPORT_ONCHANGE, this.updateLayer, this);
		on(VIEWPORT_ONRESIZE, this.resize, this);
		on(ONCONTEXT_RESTORED, this.createPattern, this);
		// force a first refresh when the level is loaded
		on(LEVEL_LOADED, this.updateLayer, this);
		// in case the level is not added to the root container,
		// the onActivateEvent call happens after the LEVEL_LOADED event
		// so we need to force a first update
		if (this.ancestor.root !== true) {
			this.updateLayer();
		}
	}

	/**
	 * resize the Image Layer to match the given size
	 * @param {number} w - new width
	 * @param {number} h - new height
	 */
	resize(w, h) {
		return super.resize(
			this.repeatX ? Infinity : w,
			this.repeatY ? Infinity : h,
		);
	}

	/**
	 * createPattern function
	 * @ignore
	 */
	createPattern() {
		this._pattern = this.parentApp.renderer.createPattern(
			this.image,
			this._repeat,
		);
	}

	/**
	 * updateLayer function
	 * @ignore
	 */
	updateLayer() {
		const rx = this.ratio.x;
		const ry = this.ratio.y;

		const viewport = this.parentApp.viewport;

		if (rx === 0 && ry === 0) {
			// static image
			return;
		}

		const width = this.width;
		const height = this.height;
		const bw = viewport.bounds.width;
		const bh = viewport.bounds.height;
		const ax = this.anchorPoint.x;
		const ay = this.anchorPoint.y;
		/*
		 * Automatic positioning
		 *
		 * See https://github.com/melonjs/melonJS/issues/741#issuecomment-138431532
		 * for a thorough description of how this works.
		 */
		const x =
			ax * (rx - 1) * (bw - viewport.width) +
			this.offset.x -
			rx * viewport.pos.x;
		const y =
			ay * (ry - 1) * (bh - viewport.height) +
			this.offset.y -
			ry * viewport.pos.y;

		// Repeat horizontally; start drawing from left boundary
		if (this.repeatX) {
			this.pos.x = x % width;
		} else {
			this.pos.x = x;
		}

		// Repeat vertically; start drawing from top boundary
		if (this.repeatY) {
			this.pos.y = y % height;
		} else {
			this.pos.y = y;
		}

		this.isDirty = true;
	}

	/**
	 * Override the default preDraw to skip the base class's anchor offset
	 * translation and `autoTransform` application — `ImageLayer.draw()`
	 * computes its own world-space position from the viewport, the parallax
	 * `ratio`, anchor, and zoom, so applying anchor/transform here would
	 * double-translate the layer.
	 *
	 * Everything else from `Renderable.preDraw` is preserved (alpha, flip,
	 * mask, post-effects, tint, blend mode) so those features still work on
	 * an `ImageLayer` instance. The inherited `Renderable.postDraw` cleans
	 * up symmetrically (clearTint / clearMask / endPostEffect / restore).
	 * @ignore
	 */
	preDraw(renderer) {
		// save the context
		renderer.save();

		// apply the defined alpha value
		renderer.setGlobalAlpha(renderer.globalAlpha() * this.getOpacity());

		// apply flip — pivots around the layer center
		if (this._flip.x || this._flip.y) {
			const ax = this.width * this.anchorPoint.x;
			const ay = this.height * this.anchorPoint.y;
			const dx = this._flip.x ? this.centerX - ax : 0;
			const dy = this._flip.y ? this.centerY - ay : 0;

			renderer.translate(dx, dy);
			renderer.scale(this._flip.x ? -1 : 1, this._flip.y ? -1 : 1);
			renderer.translate(-dx, -dy);
		}

		// apply stencil mask if defined — anchored at the layer position
		if (this.mask) {
			renderer.translate(this.pos.x, this.pos.y);
			renderer.setMask(this.mask);
			renderer.translate(-this.pos.x, -this.pos.y);
		}

		// delegate post-effect setup to the renderer (custom shader / postEffects)
		if (!this._postEffectManaged) {
			renderer.beginPostEffect(this);
		}

		// apply the defined tint
		renderer.setTint(this.tint);

		// apply blending if different from "normal"
		if (this.blendMode !== renderer.getBlendMode()) {
			renderer.setBlendMode(this.blendMode);
		}
	}

	/**
	 * draw this ImageLayer (automatically called by melonJS)
	 * @protected
	 * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
	 * @param {Camera2d} [viewport] - the viewport to (re)draw
	 */
	draw(renderer, viewport) {
		const width = this.width;
		const height = this.height;
		const bw = viewport.bounds.width;
		const bh = viewport.bounds.height;
		const ax = this.anchorPoint.x;
		const ay = this.anchorPoint.y;
		const rx = this.ratio.x;
		const ry = this.ratio.y;
		const vZoom = viewport.zoom;

		let x, y;

		if (rx === 0 && ry === 0) {
			// static image
			x = this.pos.x + ax * (bw - width);
			y = this.pos.y + ay * (bh - height);
		} else {
			// parallax — compute position from the current viewport passed to draw()
			x =
				ax * (rx - 1) * (bw - viewport.width) +
				this.offset.x -
				rx * viewport.pos.x;
			y =
				ay * (ry - 1) * (bh - viewport.height) +
				this.offset.y -
				ry * viewport.pos.y;

			if (this.repeatX) {
				x = x % width;
			}
			if (this.repeatY) {
				y = y % height;
			}
		}

		// for zoomed cameras, scale positions and pattern to match the world view
		renderer.translate(x * vZoom, y * vZoom);
		renderer.scale(vZoom, vZoom);

		renderer.drawPattern(
			this._pattern,
			0,
			0,
			viewport.width * 2,
			viewport.height * 2,
		);
	}

	// called when the layer is removed from the game world or a container
	onDeactivateEvent() {
		// cancel all event subscriptions
		off(VIEWPORT_ONCHANGE, this.updateLayer, this);
		off(VIEWPORT_ONRESIZE, this.resize, this);
		off(LEVEL_LOADED, this.updateLayer, this);
		off(ONCONTEXT_RESTORED, this.createPattern, this);
	}

	/**
	 * Destroy function
	 * @ignore
	 */
	destroy() {
		vector2dPool.release(this.ratio);
		this.ratio = undefined;
		super.destroy();
	}
}
