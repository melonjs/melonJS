import { renderer } from "./../video/video.js";
import { game } from "../index.js";
import Sprite from "./sprite.js";
import * as stringUtil from "./../utils/string.ts";
import {
	eventEmitter,
	LEVEL_LOADED,
	ONCONTEXT_RESTORED,
	VIEWPORT_ONCHANGE,
	VIEWPORT_ONRESIZE,
} from "../system/event.ts";
import { vector2dPool } from "../math/vector2d.ts";

/**
 * additional import for TypeScript
 * @import {Vector2d} from "../math/vector2d.js";
 */

/**
 * a generic Image Layer Object
 */
export default class ImageLayer extends Sprite {
	/**
	 * @param {number} x - x coordinate
	 * @param {number} y - y coordinate
	 * @param {object} settings - ImageLayer properties
	 * @param {HTMLImageElement|HTMLCanvasElement|string} settings.image - Image reference. See {@link loader.getImage}
	 * @param {string} [settings.name="me.ImageLayer"] - layer name
	 * @param {number} [settings.z=0] - z-index position
	 * @param {number|Vector2d} [settings.ratio=1.0] - Scrolling ratio to be applied. See {@link ImageLayer#ratio}
	 * @param {"repeat"|"repeat-x"|"repeat-y"|"no-repeat"} [settings.repeat="repeat"] - define if and how an Image Layer should be repeated. See {@link ImageLayer#repeat}
	 * @param {number|Vector2d} [settings.anchorPoint=<0.0,0.0>] - Define how the image is anchored to the viewport bound. By default, its upper-left corner is anchored to the viewport bounds upper left corner.
	 * @example
	 * // create a repetitive background pattern on the X axis using the citycloud image asset
	 * me.game.world.addChild(new me.ImageLayer(0, 0, {
	 *     image:"citycloud",
	 *     repeat :"repeat-x"
	 * }), 1);
	 */
	constructor(x, y, settings) {
		// call the constructor
		super(x, y, settings);

		// render in screen coordinates
		this.floating = true;

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
			// little hack for backward compatiblity
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

		// on context lost, all previous textures are destroyed
		this.boundCreatePattern = this.createPattern.bind(this);
		eventEmitter.addListener(ONCONTEXT_RESTORED, this.boundCreatePattern);
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
		this.resize(game.viewport.width, game.viewport.height);
		this.createPattern();
	}

	// called when the layer is added to the game world or a container
	onActivateEvent() {
		this.boundUpdateLayer = this.updateLayer.bind(this);
		this.boundResize = this.resize.bind(this);
		// register to the viewport change notification
		eventEmitter.addListener(VIEWPORT_ONCHANGE, this.boundUpdateLayer);
		eventEmitter.addListener(VIEWPORT_ONRESIZE, this.boundResize);
		// force a first refresh when the level is loaded
		eventEmitter.addListener(LEVEL_LOADED, this.boundUpdateLayer);
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
		this._pattern = renderer.createPattern(this.image, this._repeat);
	}

	/**
	 * updateLayer function
	 * @ignore
	 */
	updateLayer() {
		const rx = this.ratio.x;
		const ry = this.ratio.y;

		const viewport = game.viewport;

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
	 * override the default predraw function
	 * as repeat and anchor are managed directly in the draw method
	 * @ignore
	 */
	preDraw(renderer) {
		// save the context
		renderer.save();

		// apply the defined alpha value
		renderer.setGlobalAlpha(renderer.globalAlpha() * this.getOpacity());

		// apply the defined tint, if any
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

		let x = this.pos.x;
		let y = this.pos.y;

		if (this.ratio.x === 0 && this.ratio.y === 0) {
			// static image
			x = x + ax * (bw - width);
			y = y + ay * (bh - height);
		}

		renderer.translate(x, y);
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
		eventEmitter.removeListener(VIEWPORT_ONCHANGE, this.boundUpdateLayer);
		eventEmitter.removeListener(VIEWPORT_ONRESIZE, this.boundResize);
		eventEmitter.removeListener(LEVEL_LOADED, this.boundUpdateLayer);
	}

	/**
	 * Destroy function
	 * @ignore
	 */
	destroy() {
		vector2dPool.release(this.ratio);
		this.ratio = undefined;
		eventEmitter.removeListener(ONCONTEXT_RESTORED, this.boundCreatePattern);
		super.destroy();
	}
}
