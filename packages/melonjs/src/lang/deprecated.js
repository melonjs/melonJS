import { game } from "../application/application.ts";
import Body from "../physics/builtin/body.js";
import { hasFullscreenSupport, isFullscreen } from "../system/fullscreen.ts";
import CanvasRenderer from "../video/canvas/canvas_renderer.js";
import CanvasRenderTarget from "../video/rendertarget/canvasrendertarget.js";
import { WebGLBatcher } from "../video/webgl/batchers/batcher.js";
import PrimitiveBatcher from "../video/webgl/batchers/primitive_batcher.js";
import QuadBatcher from "../video/webgl/batchers/quad_batcher.js";
import WebGLRenderer from "../video/webgl/webgl_renderer.js";
import { warning } from "./console.js";

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
	 * @param {string} [attributes.context="2d"] - the context type to be created ("2d", "webgl" — creates a WebGL 2 context, or "webgpu")
	 * @param {boolean} [attributes.transparent=false] - whether to enable transparency on the canvas
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
 * set the line width used when stroking shapes
 * @public
 * @param {number} width - the line width in pixels
 * @deprecated since 17.3.0
 * @see lineWidth
 */
CanvasRenderer.prototype.setLineWidth = function (width) {
	warning("setLineWidth", "lineWidth", "17.3.0");
	this.lineWidth = width;
};

/**
 * set the line width used when stroking shapes
 * @public
 * @param {number} width - the line width in pixels
 * @deprecated since 17.3.0
 * @see lineWidth
 */
WebGLRenderer.prototype.setLineWidth = function (width) {
	warning("setLineWidth", "lineWidth", "17.3.0");
	this.lineWidth = width;
};

/**
 * @deprecated since 18.1.0
 * @see WebGLBatcher
 */
export class Compositor extends WebGLBatcher {
	/** @param {any[]} args */
	constructor(...args) {
		warning("Compositor", "WebGLBatcher", "18.1.0");
		super(...args);
	}
}

/**
 * @deprecated since 18.1.0
 * @see PrimitiveBatcher
 */
export class PrimitiveCompositor extends PrimitiveBatcher {
	/** @param {any[]} args */
	constructor(...args) {
		warning("PrimitiveCompositor", "PrimitiveBatcher", "18.1.0");
		super(...args);
	}
}

/**
 * @deprecated since 18.1.0
 * @see QuadBatcher
 */
export class QuadCompositor extends QuadBatcher {
	/** @param {any[]} args */
	constructor(...args) {
		warning("QuadCompositor", "QuadBatcher", "18.1.0");
		super(...args);
	}
}

/**
 * @deprecated since 18.1.0 — use currentBatcher instead
 */
Object.defineProperty(WebGLRenderer.prototype, "currentCompositor", {
	get() {
		warning("currentCompositor", "currentBatcher", "18.1.0");
		return this.currentBatcher;
	},
	set(value) {
		warning("currentCompositor", "currentBatcher", "18.1.0");
		this.currentBatcher = value;
	},
});

/**
 * @deprecated since 18.1.0 — use batchers instead
 */
Object.defineProperty(WebGLRenderer.prototype, "compositors", {
	get() {
		warning("compositors", "batchers", "18.1.0");
		return this.batchers;
	},
	set(value) {
		warning("compositors", "batchers", "18.1.0");
		this.batchers = value;
	},
});

/**
 * @deprecated since 18.1.0 — use addBatcher instead
 */
WebGLRenderer.prototype.addCompositor = function (
	compositor,
	name = "default",
	activate = false,
) {
	warning("addCompositor", "addBatcher", "18.1.0");
	return this.addBatcher(compositor, name, activate);
};

/**
 * @deprecated since 18.1.0 — use setBatcher instead
 */
WebGLRenderer.prototype.setCompositor = function (name = "default", shader) {
	warning("setCompositor", "setBatcher", "18.1.0");
	return this.setBatcher(name, shader);
};

/**
 * @namespace Math
 * @deprecated since 18.0.0
 * Use lowercase `math` export instead.
 */
export * as Math from "./../math/math.ts";

/**
 * Triggers a fullscreen request. Requires fullscreen support from the browser/device.
 *
 * Re-exported under `me.device.*` for backwards compatibility; the canonical
 * post-19.7 entry point is `Application#requestFullscreen`, which uses the
 * Application's own `parentElement` instead of the deprecated global-game canvas lookup.
 * @param {Element} [element] - the element to be set in full-screen mode
 * @deprecated since 19.7.0 — use {@link Application#requestFullscreen} instead.
 */
export function requestFullscreen(element) {
	warning(
		"device.requestFullscreen",
		"Application#requestFullscreen",
		"19.7.0",
	);
	if (!hasFullscreenSupport || isFullscreen()) {
		return;
	}
	const target = element ?? game.getParentElement();
	const request =
		target.requestFullscreen ||
		target.webkitRequestFullscreen ||
		target.mozRequestFullScreen ||
		target.msRequestFullscreen;
	const result = request?.call(target);
	if (result instanceof Promise) {
		result.catch(console.error);
	}
}

/**
 * Exit fullscreen mode. Requires fullscreen support from the browser/device.
 *
 * Re-exported under `me.device.*` for backwards compatibility; the canonical
 * post-19.7 entry point is `Application#exitFullscreen`.
 * @deprecated since 19.7.0 — use {@link Application#exitFullscreen} instead.
 */
export function exitFullscreen() {
	warning("device.exitFullscreen", "Application#exitFullscreen", "19.7.0");
	if (!hasFullscreenSupport || !isFullscreen()) {
		return;
	}
	const doc = globalThis.document;
	const exit =
		doc.exitFullscreen ||
		doc.webkitExitFullscreen ||
		doc.mozCancelFullScreen ||
		doc.msExitFullscreen;
	const result = exit?.call(doc);
	if (result instanceof Promise) {
		result.catch(console.error);
	}
}

/**
 * add collision mesh based on a JSON object
 * (this will also apply any physic properties defined in the given JSON file)
 * @public
 * @param {object} json - a JSON object as exported from a Physics Editor tool
 * @param {string} [id] - an optional shape identifier within the given the json object
 * @returns {number} how many shapes were added to the body
 * @deprecated since 20.7.0
 * @see Renderable#bodyDef
 * @example
 * // deprecated: reaches the builtin solver only
 * this.body.fromJSON(me.loader.getJSON("shapesdef"), "banana");
 *
 * // the portable replacement, resolved before any adapter sees it
 * // (preload with { name: "shapesdef", type: "json", src: … })
 * this.bodyDef = { type: "dynamic", shapes: "shapesdef", id: "banana" };
 */
Body.prototype.fromJSON = function (json, id) {
	warning(
		"Body#fromJSON",
		"renderable.bodyDef = { type, shapes: <loader key>, id: <body name> }, which works on the builtin, matter and planck backends alike",
		"20.7.0",
	);
	return this._fromJSON(json, id);
};
