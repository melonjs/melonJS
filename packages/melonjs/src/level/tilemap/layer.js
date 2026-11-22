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
 * How a layer of a tile map follows the camera, for a backdrop that scrolls
 * slower than the level, or a foreground that scrolls faster.
 * @typedef {object} LayerParallax
 * @property {number} [x=0] - how much of the camera's movement across the
 * layer follows, from -1 to 1: 0 for a layer that scrolls with the world, 1
 * for one that stays where it is on the screen, 0.5 for one that scrolls at
 * half the pace, a negative value for one that scrolls faster than the world
 * @property {number} [y=0] - the same, down
 * @property {number} [originX=0] - where the camera's centre is, across, when
 * the layer is where it was placed, in the coordinates the layer's `pos` is in
 * @property {number} [originY=0] - the same, down
 * @property {number} [scale=1] - the layer's size, scaled from that origin:
 * 0.5 for a layer drawn at half its size, as one further away
 */

/**
 * a layer's parallax as the layer keeps it: every value set, or undefined
 * for a parallax that changes nothing
 * @param {LayerParallax} [parallax] - the parallax asked for
 * @returns {LayerParallax|undefined} the parallax
 * @ignore
 */
export function readParallax(parallax) {
	if (parallax === undefined || parallax === null) {
		return undefined;
	}
	const read = {
		x: parallax.x ?? 0,
		y: parallax.y ?? 0,
		originX: parallax.originX ?? 0,
		originY: parallax.originY ?? 0,
		scale: parallax.scale ?? 1,
	};
	if (!(read.scale > 0)) {
		throw new Error(
			`a layer's parallax scale must be more than 0: ${String(parallax.scale)}`,
		);
	}
	return read.x === 0 && read.y === 0 && read.scale === 1 ? undefined : read;
}

/**
 * Where a parallax puts what the layer draws, for a view: a point `p` of the
 * coordinates the layer's `pos` is in is drawn at
 * `out + out.scale * (p - origin)`.
 *
 * The layer's origin is moved by the part of the way to the view's centre
 * its factors say, to a whole pixel, and the layer is scaled from it: every
 * part of a layer cut in several (a level's layer can be) is then drawn on
 * the same pixels, on every renderer.
 * @param {LayerParallax} parallax - the layer's parallax
 * @param {number} viewX - where the view starts, across
 * @param {number} viewY - where the view starts, down
 * @param {number} viewWidth - the view's width
 * @param {number} viewHeight - the view's height
 * @param {{x: number, y: number, scale: number}} out - takes the result
 * @returns {{x: number, y: number, scale: number}} `out`
 * @ignore
 */
export function parallaxPlacement(
	parallax,
	viewX,
	viewY,
	viewWidth,
	viewHeight,
	out,
) {
	const { originX, originY } = parallax;
	out.scale = parallax.scale;
	out.x = Math.round(originX + (viewX + viewWidth / 2 - originX) * parallax.x);
	out.y = Math.round(originY + (viewY + viewHeight / 2 - originY) * parallax.y);
	return out;
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
		layer.parallax,
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
	const { originX, originY } = layer.parallax;
	out.setMinMax(
		atX + place.x + scale * (area.left - atX - originX),
		atY + place.y + scale * (area.top - atY - originY),
		atX + place.x + scale * (area.right - atX - originX),
		atY + place.y + scale * (area.bottom - atY - originY),
	);
	return out;
}
