import { warning } from "./console.js";
import CanvasRenderTarget from "../video/rendertarget/canvasrendertarget.js";
import CanvasRenderer from "../video/canvas/canvas_renderer.js";
import WebGLRenderer from "../video/webgl/webgl_renderer.js";

/*
 * placeholder for all deprecated classes and corresponding alias for backward compatibility
 */

/**
 * @deprecated since 17.1.0
 * @see CanvasRenderTarget
 */
export class CanvasTexture extends CanvasRenderTarget {
	/**
	 * @param {number} width - the desired width of the canvas
	 * @param {number} height - the desired height of the canvas
	 * @param {object} attributes - The attributes to create both the canvas and context
	 * @param {boolean} [attributes.context="2d"] - the context type to be created ("2d", "webgl", "webgl2")
	 * @param {boolean} [attributes.offscreenCanvas=false] - will create an offscreenCanvas if true instead of a standard canvas
	 * @param {boolean} [attributes.willReadFrequently=false] - Indicates whether or not a lot of read-back operations are planned
	 * @param {boolean} [attributes.antiAlias=false] - Whether to enable anti-aliasing, use false (default) for a pixelated effect.
	 */
	constructor(width, height, attributes) {
		warning("CanvasTexture", "CanvasRenderTarget", "17.1.0");
		super(width, height, attributes);
	}
}

/**
 * return the height of the system Canvas
 * @public
 * @name setLineWidth
 * @memberof CanvasRenderer#
 * @deprecated since 17.3.0
 * @see lineWidth
 */
CanvasRenderer.prototype.setLineWidth = function (width) {
	warning("setLineWidth", "lineWidth", "17.3.0");
	this.lineWidth = width;
};

/**
 * return the height of the system Canvas
 * @public
 * @name setLineWidth
 * @memberof WebGLRenderer#
 * @deprecated since 17.3.0
 * @see lineWidth
 */
WebGLRenderer.prototype.setLineWidth = function (width) {
	warning("setLineWidth", "lineWidth", "17.3.0");
	this.lineWidth = width;
};

/**
 * @namespace Math
 * @deprecated since 18.0.0
 * Use lowercase `math` export instead.
 */
export * as Math from "./../math/math.ts";
