import { ellipsePool } from "./../geometries/ellipse.ts";
import { colorPool } from "./../math/color.ts";
import pool from "../system/legacy_pool.js";
import Renderable from "./renderable.js";
import CanvasRenderTarget from "../video/rendertarget/canvasrendertarget.js";

/**
 * additional import for TypeScript
 * @import {Color} from "./../math/color.ts";
 * @import {Ellipse} from "./../geometries/ellipse.ts";
 * @import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../video/webgl/webgl_renderer.js";
 */

/** @ignore */
function createGradient(light) {
	const context = light.texture.context;

	const x1 = light.texture.width / 2;
	const y1 = light.texture.height / 2;

	const radiusX = light.radiusX;
	const radiusY = light.radiusY;

	let scaleX;
	let scaleY;
	let invScaleX;
	let invScaleY;
	let gradient;

	light.texture.clear();

	if (radiusX >= radiusY) {
		scaleX = 1;
		invScaleX = 1;
		scaleY = radiusY / radiusX;
		invScaleY = radiusX / radiusY;
		gradient = context.createRadialGradient(
			x1,
			y1 * invScaleY,
			0,
			x1,
			radiusY * invScaleY,
			radiusX,
		);
	} else {
		scaleY = 1;
		invScaleY = 1;
		scaleX = radiusX / radiusY;
		invScaleX = radiusY / radiusX;
		gradient = context.createRadialGradient(
			x1 * invScaleX,
			y1,
			0,
			x1 * invScaleX,
			y1,
			radiusY,
		);
	}

	gradient.addColorStop(0, light.color.toRGBA(light.intensity));
	gradient.addColorStop(1, light.color.toRGBA(0.0));

	context.fillStyle = gradient;

	context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
	context.fillRect(
		0,
		0,
		light.texture.width * invScaleX,
		light.texture.height * invScaleY,
	);
}

/**
 * A 2D point light.
 * Note: this is a very experimental and work in progress feature, that provides a simple spot light effect.
 * The light effect is best rendered in WebGL, as they are few limitations when using the Canvas Renderer
 * (multiple lights are not supported, alpha component of the ambient light is ignored)
 * @see stage.lights
 */
export default class Light2d extends Renderable {
	/**
	 * @param {number} x - The horizontal position of the light.
	 * @param {number} y - The vertical position of the light.
	 * @param {number} radiusX - The horizontal radius of the light.
	 * @param {number} [radiusY=radiusX] - The vertical radius of the light.
	 * @param {Color|string} [color="#FFF"] - the color of the light
	 * @param {number} [intensity=0.7] - The intensity of the light.
	 */
	constructor(
		x,
		y,
		radiusX,
		radiusY = radiusX,
		color = "#FFF",
		intensity = 0.7,
	) {
		// call the parent constructor
		super(x, y, radiusX * 2, radiusY * 2);

		/**
		 * the color of the light
		 * @type {Color}
		 * @default "#FFF"
		 */
		this.color = colorPool.get().parseCSS(color);

		/**
		 * The horizontal radius of the light
		 * @type {number}
		 */
		this.radiusX = radiusX;

		/**
		 * The vertical radius of the light
		 * @type {number}
		 */
		this.radiusY = radiusY;

		/**
		 * The intensity of the light
		 * @type {number}
		 * @default 0.7
		 */
		this.intensity = intensity;

		/**
		 * the default blend mode to be applied when rendering this light
		 * @type {string}
		 * @default "lighter"
		 * @see CanvasRenderer#setBlendMode
		 * @see WebGLRenderer#setBlendMode
		 */
		this.blendMode = "lighter";

		/** @ignore */
		this.visibleArea = ellipsePool.get(
			this.centerX,
			this.centerY,
			this.width,
			this.height,
		);

		/** @ignore */
		this.texture = new CanvasRenderTarget(this.width, this.height, {
			offscreenCanvas: false,
		});

		this.anchorPoint.set(0, 0);

		createGradient(this);
	}

	/**
	 * returns a geometry representing the visible area of this light
	 * @returns {Ellipse} the light visible mask
	 */
	getVisibleArea() {
		return this.visibleArea.setShape(
			this.getBounds().centerX,
			this.getBounds().centerY,
			this.width,
			this.height,
		);
	}

	/**
	 * update function
	 * @param {number} dt - time since the last update in milliseconds.
	 * @returns {boolean} true if dirty
	 */
	update() {
		return true;
	}

	/**
	 * draw this Light2d (automatically called by melonJS)
	 * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
	 * @param {Camera2d} [viewport] - the viewport to (re)draw
	 */
	draw(renderer) {
		renderer.drawImage(
			this.texture.canvas,
			this.getBounds().x,
			this.getBounds().y,
		);
	}

	/**
	 * Destroy function<br>
	 * @ignore
	 */
	destroy() {
		colorPool.release(this.color);
		this.color = undefined;
		pool.push(this.texture);
		this.texture.destroy();
		this.texture = undefined;
		ellipsePool.release(this.visibleArea);
		this.visibleArea = undefined;
		super.destroy();
	}
}
