import { Bounds, boundsPool } from "./../../../physics/bounds.ts";
import TMXLayer from "./../TMXLayer.js";

// where each Tiled `objectalignment` puts a tile object's position, as a
// fraction of its width and height from its top left ("unspecified" is
// not listed: the renderer picks the orientation's default)
const OBJECT_ALIGNMENT = new Map([
	["topleft", [0, 0]],
	["top", [0.5, 0]],
	["topright", [1, 0]],
	["left", [0, 0.5]],
	["center", [0.5, 0.5]],
	["right", [1, 0.5]],
	["bottomleft", [0, 1]],
	["bottom", [0.5, 1]],
	["bottomright", [1, 1]],
]);

/**
 * additional import for TypeScript
 * @import CanvasRenderer from "../../../video/canvas/canvas_renderer.js";
 * @import {Rect} from "../../../geometries/rectangle.ts";
 * @import TMXTileMap from "../TMXTileMap.js";
 * @import Tile from "../TMXTile.js";
 * @import {Vector2d} from "../../../math/vector2d.ts";
 * @import WebGLRenderer from "../../../video/webgl/webgl_renderer.js";
 * @import Renderer from "../../../video/renderer.js";
 */
/**
 * The map renderer base class
 * @category Tilemap
 */
export default class TMXRenderer {
	/**
	 * @param {number} cols - width of the tilemap in tiles
	 * @param {number} rows - height of the tilemap in tiles
	 * @param {number} tilewidth - width of each tile in pixels
	 * @param {number} tileheight - height of each tile in pixels
	 */
	constructor(cols, rows, tilewidth, tileheight) {
		this.cols = cols;
		this.rows = rows;
		this.tilewidth = tilewidth;
		this.tileheight = tileheight;
		this.bounds = new Bounds();
	}

	/**
	 * return true if the renderer can render the specified map or layer
	 * @param {TMXTileMap|TMXLayer} component - TMX Map or Layer
	 * @returns {boolean}
	 */
	canRender(component) {
		return (
			/*
            // layers can have different size within
            // the same maps, so commenting these two lines
            (this.cols === component.cols) &&
            (this.rows === component.rows) &&
            */
			this.tilewidth === component.tilewidth &&
			this.tileheight === component.tileheight
		);
	}

	/**
	 * return the bounding rect for this map renderer
	 * @param {TMXLayer} [layer] - calculate the bounding rect for a specific layer (will return a new bounds object)
	 * @returns {Bounds}
	 */
	getBounds(layer) {
		const bounds = layer instanceof TMXLayer ? boundsPool.get() : this.bounds;
		bounds.setMinMax(
			0,
			0,
			this.cols * this.tilewidth,
			this.rows * this.tileheight,
		);
		return bounds;
	}

	/**
	 * return the tile position corresponding to the specified pixel
	 * @param {number} x - X coordinate
	 * @param {number} y - Y coordinate
	 * @param {Vector2d} [v] - an optional vector object where to put the return values
	 * @returns {Vector2d}
	 */
	pixelToTileCoords(x, y, v) {
		return v;
	}

	/**
	 * return the pixel position corresponding of the specified tile
	 * @param {number} col - tile horizontal position
	 * @param {number} row - tile vertical position
	 * @param {Vector2d} [v] - an optional vector object where to put the return values
	 * @returns {Vector2d}
	 */
	tileToPixelCoords(col, row, v) {
		return v;
	}

	/**
	 * fix the position of Objects to match
	 * the way Tiled places them
	 * @param {object} obj - a TMX Object with gid, x, y, height properties
	 */
	adjustPosition(obj) {
		// only adjust position if obj.gid is defined
		if (typeof obj.gid === "number") {
			this.alignTileObject(obj, "bottomleft");
		}
	}

	/**
	 * move a tile object from the point Tiled anchors it at to its top left,
	 * where melonJS places renderables. The point is the tileset's
	 * `objectalignment`, or `fallback` when the tileset leaves it unspecified
	 * @param {object} obj - a TMX Object with x, y, width, height and rotation properties
	 * @param {string} fallback - the alignment Tiled uses for this orientation
	 * @ignore
	 * @internal
	 */
	alignTileObject(obj, fallback) {
		const offset =
			OBJECT_ALIGNMENT.get(obj.tile?.tileset.objectalignment) ??
			OBJECT_ALIGNMENT.get(fallback);
		const ax = offset[0] !== 0 ? obj.width * offset[0] : 0;
		const ay = offset[1] !== 0 ? obj.height * offset[1] : 0;
		obj.x -= ax;
		obj.y -= ay;
		// Tiled turns a tile object about that point, while its sprite and
		// body turn about their top left: move the top left to where turning
		// about the point leaves it
		if (obj.rotation) {
			const cos = Math.cos(obj.rotation);
			const sin = Math.sin(obj.rotation);
			obj.x += ax - (ax * cos - ay * sin);
			obj.y += ay - (ax * sin + ay * cos);
		}
	}

	/**
	 * draw the given tile at the specified layer
	 * @param {Renderer} renderer - a renderer object
	 * @param {number} x - X coordinate where to draw the tile
	 * @param {number} y - Y coordinate where to draw the tile
	 * @param {Tile} tile - the tile object to draw
	 */
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	drawTile(renderer, x, y, tile) {}

	/**
	 * draw the given TMX Layer for the given area
	 * @param {Renderer} renderer - a renderer object
	 * @param {TMXLayer} layer - a TMX Layer object
	 * @param {Rect} rect - the area of the layer to draw
	 */
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	drawTileLayer(renderer, layer, rect) {}
}
