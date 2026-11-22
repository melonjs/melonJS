/**
 * additional import for TypeScript
 * @import Renderable from "../../renderable/renderable.js";
 * @import {Color} from "../../math/color.ts";
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
