/**
 * additional import for TypeScript
 * @import Renderable from "../../renderable/renderable.js";
 * @import {Color} from "../../math/color.ts";
 * @import {Bounds} from "../../physics/bounds.ts";
 * @import Camera2d from "../../camera/camera2d.ts";
 */

/**
 * What every layer of a tile map takes from its description, whatever it
 * draws its tiles from: its name, its draw order, its opacity, its blend
 * mode and its tint. A layer is placed by its top left corner.
 * @param {Renderable} layer - the layer
 * @param {object} def - its description
 * @param {string} [def.name] - the layer's name
 * @param {number} [def.z=0] - its draw order
 * @param {number} [def.opacity=1] - its opacity (0 hides it)
 * @param {string} [def.blendMode] - its blend mode
 * @param {Color|string} [def.tint] - a tint for its tiles, as a color or a CSS color string
 * @ignore
 */
export function applyLayerDefinition(layer, def) {
	layer.name = def.name ?? "";

	// for displaying order
	layer.pos.z = def.z ?? 0;

	// a layer is placed by its top left corner
	layer.anchorPoint.set(0, 0);

	// layer opacity
	layer.setOpacity(def.opacity ?? 1);

	// layer blend mode
	if (def.blendMode !== undefined) {
		layer.blendMode = def.blendMode;
	}

	// layer tint
	if (typeof def.tint === "string") {
		layer.tint.parseCSS(def.tint);
	} else if (def.tint !== undefined) {
		layer.tint.copy(def.tint);
	}
}

/**
 * How a layer of a tile map scrolls with the camera, as the layer's
 * definition gives it: see {@link TileLayer#ratio},
 * {@link TileLayer#parallaxOrigin}, {@link TileLayer#parallaxAnchor} and
 * {@link TileLayer#parallaxScale}.
 * @typedef {object} LayerScrolling
 * @property {number|{x: number, y: number}} [ratio=1] - the scrolling ratio, one number for both axes or one for each
 * @property {{x: number, y: number}} [parallaxOrigin] - where the camera is when the layer is where it was placed
 * @property {{x: number, y: number}} [parallaxAnchor] - the point of the view that is measured, from (0, 0), its top left corner, to (1, 1)
 * @property {number} [parallaxScale=1] - the layer's size, scaled from the origin
 */

/**
 * set how a layer scrolls with the camera: what the settings give, the rest
 * left as it is
 * @param {Renderable} layer - a tile layer
 * @param {LayerScrolling} [settings] - the settings
 * @ignore
 */
export function setLayerScrolling(layer, settings = {}) {
	const { parallaxScale } = settings;
	for (const name of SCROLLING_VECTORS) {
		const value = settings[name];
		if (value !== undefined && value !== null) {
			setPair(layer[name], value, name);
		}
	}
	if (parallaxScale !== undefined && parallaxScale !== null) {
		layer.parallaxScale = parallaxScale;
	}
	layer.isDirty = true;
}

/**
 * the scrolling settings of a layer that are a pair of numbers, across and
 * down
 * @ignore
 */
const SCROLLING_VECTORS = Object.freeze([
	"ratio",
	"parallaxOrigin",
	"parallaxAnchor",
]);

/**
 * every scrolling setting of a layer, the origin before the ratio: a layer
 * that gives both keeps its own origin
 * @ignore
 */
export const SCROLLING_SETTINGS = Object.freeze([
	"parallaxOrigin",
	"parallaxAnchor",
	"parallaxScale",
	"ratio",
]);

/**
 * Set a pair of numbers from one number, for both, or from an `{x, y}`. A
 * part left out keeps the value it has. A part that is not a number throws:
 * a layer placed by one would be drawn nowhere.
 * @param {Vector2d} pair - the pair to set
 * @param {number|{x?: number, y?: number}} value - what to set it to
 * @param {string} name - the setting, for the error
 * @ignore
 */
function setPair(pair, value, name) {
	const single = typeof value === "number";
	const parts = typeof value === "object" && !Array.isArray(value);
	const x = single ? value : parts ? (value.x ?? pair.x) : Number.NaN;
	const y = single ? value : parts ? (value.y ?? pair.y) : Number.NaN;
	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		throw new Error(
			`a layer's ${name} must be a number, or an {x, y} of numbers: ${JSON.stringify(value)}`,
		);
	}
	pair.set(x, y);
}

/**
 * a part of a layer's ratio as the placement reads it: a part that is not a
 * number (the vector set with one argument, the field replaced) scrolls
 * with the world, rather than placing the layer nowhere
 * @ignore
 */
function ratioPart(value) {
	return Number.isFinite(value) ? value : 1;
}

/**
 * a layer's scale, as it can be set: more than 0
 * @param {number} scale - the scale asked for
 * @returns {number} the scale
 * @ignore
 */
export function checkParallaxScale(scale) {
	if (typeof scale !== "number" || !(scale > 0) || scale === Infinity) {
		throw new Error(
			`a layer's parallaxScale must be more than 0: ${String(scale)}`,
		);
	}
	return scale;
}

/**
 * whether a layer is drawn anywhere but where it was placed: it scrolls at
 * a pace of its own, or is scaled
 * @param {Renderable} layer - a tile layer
 * @returns {boolean} true if it is
 * @ignore
 */
export function hasParallax(layer) {
	return (
		ratioPart(layer.ratio?.x) !== 1 ||
		ratioPart(layer.ratio?.y) !== 1 ||
		layer.parallaxScale !== 1
	);
}

/**
 * Where the view starts, read in the coordinates a layer's `pos` is in.
 *
 * The view is the camera's, in the world's coordinates, shifted by the
 * camera's offset (a look ahead, a shake: it shows other tiles without
 * moving). The layer is drawn where its ancestors put it: a world moved to
 * centre a map smaller than the view, a container the game moved. Read in the
 * layer's own coordinates, the view starts that much earlier. A camera other
 * than the default one draws the world unmoved.
 * @param {Renderable} layer - the layer being drawn
 * @param {object} view - the view handed to `draw`: a camera, or a rectangle
 * @param {{x: number, y: number}} out - takes the result
 * @returns {{x: number, y: number}} `out`
 * @ignore
 */
export function viewStart(layer, view, out) {
	// A floating layer is drawn in the screen's coordinates, wherever the
	// camera is: the view is the screen. The layer's own `pos` is then a
	// place on the screen; inside a floating container it is placed from
	// that container, as any child is.
	if (layer.isFloating === true) {
		out.x = 0;
		out.y = 0;
		const container = layer.ancestor;
		if (
			layer.floating !== true &&
			container !== undefined &&
			container !== null
		) {
			const at = container.getAbsolutePosition();
			out.x -= at.x;
			out.y -= at.y;
		}
		return out;
	}
	let x = view.pos.x;
	let y = view.pos.y;
	const offset = view.offset;
	if (offset !== undefined) {
		x += offset.x;
		y += offset.y;
	}
	const parent = layer.ancestor;
	if (parent !== undefined && parent !== null) {
		const at = parent.getAbsolutePosition();
		x -= at.x;
		y -= at.y;
		// asked of the camera: a plain rectangle is no camera
		if (view.isDefault === false) {
			let root = parent;
			while (root.ancestor) {
				root = root.ancestor;
			}
			x += root.pos.x;
			y += root.pos.y;
		}
	}
	out.x = x;
	out.y = y;
	return out;
}

/**
 * Where a parallax puts what the layer draws, for a view: a point `p` of the
 * coordinates the layer's `pos` is in is drawn at
 * `out + out.scale * (p - origin)`.
 *
 * The layer's origin is moved by the part of the way to the view's anchor
 * (its top left corner, by default) that its ratio leaves, to a whole pixel,
 * and the layer is scaled from it: every part of a layer cut in several (a
 * level's layer can be) is then drawn on the same pixels, on every renderer.
 * @param {Renderable} layer - the layer: its `ratio`, `parallaxOrigin`, `parallaxAnchor` and `parallaxScale`
 * @param {number} viewX - where the view starts, across
 * @param {number} viewY - where the view starts, down
 * @param {number} viewWidth - the view's width
 * @param {number} viewHeight - the view's height
 * @param {{x: number, y: number, scale: number}} out - takes the result
 * @returns {{x: number, y: number, scale: number}} `out`
 * @ignore
 */
export function parallaxPlacement(
	layer,
	viewX,
	viewY,
	viewWidth,
	viewHeight,
	out,
) {
	const origin = layer.parallaxOrigin;
	const anchor = layer.parallaxAnchor;
	// a ratio of 1 scrolls with the world: the layer stays on its origin
	out.scale = layer.parallaxScale;
	out.x = Math.round(
		origin.x +
			(viewX + viewWidth * anchor.x - origin.x) *
				(1 - ratioPart(layer.ratio?.x)),
	);
	out.y = Math.round(
		origin.y +
			(viewY + viewHeight * anchor.y - origin.y) *
				(1 - ratioPart(layer.ratio?.y)),
	);
	return out;
}

/**
 * the frame a layer with a parallax is drawn in for a view, kept between
 * {@link enterParallax} and {@link leaveParallax}
 * @typedef {object} ParallaxFrame
 * @property {number} x - where the frame is, across
 * @property {number} y - where the frame is, down
 * @property {number} scale - its scale
 * @property {number} originX - where the layer's own (0, 0) is in the frame
 * @property {number} originY - where the layer's own (0, 0) is in the frame
 * @property {number} viewX - the view in the layer's own coordinates: its left
 * @property {number} viewY - its top
 * @property {number} viewWidth - its width
 * @property {number} viewHeight - its height
 * @ignore
 */

/**
 * a frame to hand {@link enterParallax}
 * @returns {ParallaxFrame} the frame
 * @ignore
 */
export function parallaxFrame() {
	return {
		x: 0,
		y: 0,
		scale: 1,
		originX: 0,
		originY: 0,
		viewX: 0,
		viewY: 0,
		viewWidth: 0,
		viewHeight: 0,
	};
}

/**
 * Start drawing a layer with a parallax: the renderer is moved and scaled
 * to where the parallax puts the layer for this view, so that the layer
 * draws in its own coordinates, and the view is given in those coordinates,
 * to tell what of the layer is in it. {@link leaveParallax} undoes it.
 * @param {Renderer} renderer - the renderer
 * @param {Renderable} layer - the layer
 * @param {number} viewX - where the view starts, across
 * @param {number} viewY - where the view starts, down
 * @param {number} viewWidth - the view's width
 * @param {number} viewHeight - the view's height
 * @param {number} x - where the layer's own (0, 0) is with no parallax
 * @param {number} y - where the layer's own (0, 0) is with no parallax
 * @param {ParallaxFrame} frame - takes the frame
 * @returns {ParallaxFrame} `frame`
 * @ignore
 */
export function enterParallax(
	renderer,
	layer,
	viewX,
	viewY,
	viewWidth,
	viewHeight,
	x,
	y,
	frame,
) {
	parallaxPlacement(layer, viewX, viewY, viewWidth, viewHeight, frame);
	const scale = frame.scale;
	frame.originX = x - layer.parallaxOrigin.x;
	frame.originY = y - layer.parallaxOrigin.y;
	frame.viewX = (viewX - frame.x) / scale - frame.originX;
	frame.viewY = (viewY - frame.y) / scale - frame.originY;
	frame.viewWidth = viewWidth / scale;
	frame.viewHeight = viewHeight / scale;
	renderer.translate(frame.x, frame.y);
	renderer.scale(scale, scale);
	renderer.translate(frame.originX, frame.originY);
	return frame;
}

/**
 * put the renderer back where {@link enterParallax} found it
 * @param {Renderer} renderer - the renderer
 * @param {ParallaxFrame} frame - the frame it gave
 * @ignore
 */
export function leaveParallax(renderer, frame) {
	renderer.translate(-frame.originX, -frame.originY);
	renderer.scale(1 / frame.scale, 1 / frame.scale);
	renderer.translate(-frame.x, -frame.y);
}

/**
 * A container with a size of its own (one a level was loaded into) is in
 * view by its bounds, before its children are asked. A layer that can draw
 * outside them (its tiles' reach, its offset, an infinite map's first
 * chunks, a parallax) tells each container it is in, when it is activated.
 * @param {Renderable} layer - the layer
 * @ignore
 */
export function tellAncestorsOfDrawArea(layer) {
	layer._toldAncestors = [];
	for (let node = layer.ancestor; node; node = node.ancestor) {
		(node._drawPast ??= new Set()).add(layer);
		layer._toldAncestors.push(node);
	}
}

/**
 * the layer is deactivated: the containers it told forget it
 * @param {Renderable} layer - the layer
 * @ignore
 */
export function untellAncestorsOfDrawArea(layer) {
	for (const node of layer._toldAncestors ?? []) {
		node._drawPast?.delete(layer);
	}
	layer._toldAncestors = undefined;
}

const PLACE = { x: 0, y: 0, scale: 1 };
const START = { x: 0, y: 0 };

/**
 * The area a layer with a parallax is drawn in, for a camera: its own area,
 * moved and scaled as the parallax does for where that camera looks.
 * @param {Renderable} layer - the layer
 * @param {Bounds} area - the area it draws in with no parallax, in the world
 * @param {Camera2d} camera - the camera
 * @param {Bounds} out - takes the result
 * @returns {Bounds} `out`
 * @ignore
 */
export function parallaxBounds(layer, area, camera, out) {
	const view = camera.worldView;
	const start = viewStart(layer, camera, START);
	const place = parallaxPlacement(
		layer,
		start.x,
		start.y,
		view.width,
		view.height,
		PLACE,
	);
	// the area is the world's; the parallax is in the coordinates the layer
	// is placed in, its container's
	const parent = layer.ancestor;
	const at = parent ? parent.getAbsolutePosition() : undefined;
	const atX = at?.x ?? 0;
	const atY = at?.y ?? 0;
	const scale = place.scale;
	const originX = layer.parallaxOrigin.x;
	const originY = layer.parallaxOrigin.y;
	out.setMinMax(
		atX + place.x + scale * (area.left - atX - originX),
		atY + place.y + scale * (area.top - atY - originY),
		atX + place.x + scale * (area.right - atX - originX),
		atY + place.y + scale * (area.bottom - atY - originY),
	);
	return out;
}
