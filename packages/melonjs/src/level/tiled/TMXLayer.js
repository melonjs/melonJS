import { Rect } from "../../geometries/rectangle.ts";
import { warnOnce } from "../../lang/console.js";
import { vector2dPool } from "../../math/vector2d.ts";
import { boundsPool } from "../../physics/bounds.ts";
import Renderable from "../../renderable/renderable.js";
import CanvasRenderer from "../../video/canvas/canvas_renderer";
import { createCanvas } from "../../video/canvas_factory.js";
import { TMX_ORIENTATIONS } from "../../video/gpu/tmxlayer_orientation.js";
import {
	TMX_CLEAR_BIT_MASK,
	TMX_FLIP_AD,
	TMX_FLIP_H,
	TMX_FLIP_V,
} from "./constants.js";
import Tile from "./TMXTile.js";
import * as TMXUtils from "./TMXUtils.js";

/**
 * additional import for TypeScript
 * @import TMXRenderer from "./renderer/TMXRenderer.js";
 * @import TMXTileset from "./TMXTileset.js";
 * @import TMXTilesetGroup from "./TMXTilesetGroup.js";
 * @import {Vector2d} from "../../math/vector2d.ts";
 */
// flip-mask bit layout for layerData's G channel
const FLIP_H_BIT = 1 << 0;
const FLIP_V_BIT = 1 << 1;
const FLIP_AD_BIT = 1 << 2;

// The largest tiles the shader path draws are the bounds of the loops of the
// fragment shaders, which are declared from the same numbers (see
// `TMX_ORIENTATIONS`). An orthogonal tile can reach so many cells past its
// own.
const ORTHOGONAL_MAX_OVERFLOW = TMX_ORIENTATIONS.orthogonal.limits.MAX_OVERFLOW;
// "an isometric", "a staggered", "a hexagonal": a layer's kind, in a reason
const kindOf = (orientation) => {
	return `${orientation === "isometric" ? "an" : "a"} ${orientation}`;
};
const oneTilesetReason = (orientation) => {
	return `tiles of more than one tileset in ${kindOf(orientation)} layer`;
};
// A diagonal flip turns a tile a quarter: one that is not square then covers
// other pixels than its own image's rectangle, which is all the shader looks
// at.
const DIAGONAL_NOT_SQUARE = "a tile that is not square, flipped diagonally";

// the area an offset camera shows, handed to the tile renderers in its place
// (made on first use)
let viewRect;
// the area to draw, in the grid of a layer that does not start at the map's
// origin (made on first use)
let cellRect;

/**
 * extract a 3-bit flip mask from a raw 32-bit GID (Tiled's flip bits live in
 * the upper 3 bits)
 * @ignore
 * @internal
 */
function flipMaskFromGid(gid) {
	return (
		(gid & TMX_FLIP_H ? FLIP_H_BIT : 0) |
		(gid & TMX_FLIP_V ? FLIP_V_BIT : 0) |
		(gid & TMX_FLIP_AD ? FLIP_AD_BIT : 0)
	);
}

/**
 * extract a 3-bit flip mask from a Tile object's boolean flip flags
 * @ignore
 * @internal
 */
function flipMaskFromTile(tile) {
	return (
		(tile.flippedX ? FLIP_H_BIT : 0) |
		(tile.flippedY ? FLIP_V_BIT : 0) |
		(tile.flippedAD ? FLIP_AD_BIT : 0)
	);
}

/**
 * reconstruct a legacy 32-bit GID (with Tiled's high flip bits set) from the
 * cleaned GID and a 3-bit flip mask, for passing to the Tile constructor
 * @ignore
 * @internal
 */
function gidWithFlips(gid, flipMask) {
	return (
		gid |
		(flipMask & FLIP_H_BIT ? TMX_FLIP_H : 0) |
		(flipMask & FLIP_V_BIT ? TMX_FLIP_V : 0) |
		(flipMask & FLIP_AD_BIT ? TMX_FLIP_AD : 0)
	);
}

/**
 * Decode a tiled layer's data blob directly into the typed-array layerData.
 * `data` holds `width` x `height` cells whose top left one is the map's tile
 * (`x`, `y`): a whole finite layer, or one chunk of an infinite map's layer.
 * A cell outside the layer's grid is left out, never wrapped into another row.
 * Data that does not hold exactly `width` x `height` tiles throws
 * @ignore
 * @internal
 */
function setLayerData(layer, data, x, y, width, height, chunk = false) {
	// as Tiled does, refuse data that does not fill the cells exactly: a
	// missing tile would otherwise be left empty, without a word
	if (data.length !== width * height) {
		const where = chunk ? ` (the chunk at ${x}, ${y})` : "";
		throw new Error(
			`Tiled layer "${layer.name}" has ${data.length} tiles of data for its ${width} x ${height} cells${where}`,
		);
	}
	let idx = 0;
	const cols = layer.cols;
	const rows = layer.rows;
	const layerData = layer.layerData;
	// where the data's first cell sits in the layer's grid
	const offsetX = x - layer.startx;
	const offsetY = y - layer.starty;
	// One-shot warning when a layer's flip-stripped GID won't fit in the
	// `Uint16Array` cell — silent truncation would render the wrong tile.
	// 65535 is far above any realistic tileset size, but flag it loudly
	// so users with degenerate maps notice immediately.
	let overflowedGid = 0;
	for (let row = 0; row < height; row++) {
		const cy = row + offsetY;
		for (let col = 0; col < width; col++) {
			const rawGid = data[idx++];
			const cx = col + offsetX;
			if (rawGid !== 0 && cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
				const flatIdx = (cy * cols + cx) * 2;
				const cleanGid = rawGid & TMX_CLEAR_BIT_MASK;
				if (cleanGid > 0xffff && overflowedGid === 0) {
					overflowedGid = cleanGid;
				}
				layerData[flatIdx] = cleanGid;
				layerData[flatIdx + 1] = flipMaskFromGid(rawGid);
			}
		}
	}
	if (overflowedGid !== 0) {
		console.warn(
			"melonJS: TMX layer contains GID " +
				overflowedGid +
				" which exceeds the 16-bit cell capacity (max 65535). Tiles will be truncated and render incorrectly.",
		);
	}
}

/**
 * the cells an infinite map's layer covers, in the map's tile coordinates:
 * the map's own area and every chunk of the layer. Tiled gives a TMX layer
 * the map's size whatever its chunks hold, and a JSON one the chunks' bounds
 * (`startx`, `starty`), which can start left of or above the map. The start
 * is moved to an even column and row, so that a staggered or hexagonal
 * layer's cells keep the stagger of the map's tiles they hold
 * @ignore
 * @internal
 */
function chunksExtent(map, chunks) {
	let minX = 0;
	let minY = 0;
	let maxX = map.cols;
	let maxY = map.rows;
	for (let i = 0, len = chunks.length; i < len; i++) {
		const chunk = chunks[i];
		minX = Math.min(minX, +chunk.x);
		minY = Math.min(minY, +chunk.y);
		maxX = Math.max(maxX, +chunk.x + +chunk.width);
		maxY = Math.max(maxY, +chunk.y + +chunk.height);
	}
	minX -= minX & 1;
	minY -= minY & 1;
	return { x: minX, y: minY, cols: maxX - minX, rows: maxY - minY };
}

/**
 * a TMX Tile Layer Object
 * Tiled QT 0.7.x format
 * @category Tilemap
 */
export default class TMXLayer extends Renderable {
	/**
	 * @param {object} map - layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
	 * @param {object} data - layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
	 * @param {number} tilewidth - width of each tile in pixels
	 * @param {number} tileheight - height of each tile in pixels
	 * @param {string} orientation - "isometric" or "orthogonal"
	 * @param {TMXTilesetGroup} tilesets - tileset as defined in Tiled
	 * @param {number} z - z-index position
	 */
	constructor(map, data, tilewidth, tileheight, orientation, tilesets, z) {
		// super constructor
		super(0, 0, 0, 0);

		// tile width & height
		this.tilewidth = data.tilewidth || tilewidth;
		this.tileheight = data.tileheight || tileheight;

		// layer orientation
		this.orientation = orientation;

		/**
		 * Horizontal layer offset in tiles
		 * @default 0
		 * @type {number}
		 */
		this.x = 0;

		/**
		 * Vertical layer offset in tiles
		 * @default 0
		 * @type {number}
		 */
		this.y = 0;

		/**
		 * The Layer corresponding Tilesets
		 * @type {TMXTilesetGroup}
		 */
		this.tilesets = tilesets;

		// the default tileset (used as cache in cellAt)
		this.tileset = this.tilesets ? this.tilesets.getTilesetByIndex(0) : null;

		// Biggest tile size to draw
		this.maxTileSize = {
			width: 0,
			height: 0,
		};
		/**
		 * how far a tileset's `tileoffset` moves its tiles, at most, across
		 * and down: with `maxTileSize`, how far from its cell a tile of this
		 * layer can be drawn
		 * @ignore
		 */
		this.maxTileOffset = { x: 0, y: 0 };
		/**
		 * The one tileset a layer of an isometric, staggered or hexagonal
		 * map draws with on the shader path:
		 * `undefined` for an empty layer (it takes the tileset of the first
		 * tile set), `null` for a layer that path cannot draw, or that was
		 * not checked for it.
		 * @ignore
		 */
		this._shaderTileset = null;
		// how far a `tileoffset` moves tiles, each way
		let offsetLeft = 0;
		let offsetTop = 0;
		let offsetRight = 0;
		let offsetBottom = 0;
		for (let i = 0; i < this.tilesets.length; i++) {
			const tileset = this.tilesets.getTilesetByIndex(i);
			offsetLeft = Math.max(offsetLeft, -tileset.tileoffset.x);
			offsetRight = Math.max(offsetRight, tileset.tileoffset.x);
			offsetTop = Math.max(offsetTop, -tileset.tileoffset.y);
			offsetBottom = Math.max(offsetBottom, tileset.tileoffset.y);
			this.maxTileOffset.x = Math.max(
				this.maxTileOffset.x,
				Math.abs(tileset.tileoffset.x),
			);
			this.maxTileOffset.y = Math.max(
				this.maxTileOffset.y,
				Math.abs(tileset.tileoffset.y),
			);
			this.maxTileSize.width = Math.max(
				this.maxTileSize.width,
				tileset.tilewidth,
			);
			this.maxTileSize.height = Math.max(
				this.maxTileSize.height,
				tileset.tileheight,
			);
		}
		// A tile larger than its cell reaches past it: up and to the right,
		// as a tile stands on the bottom left of its cell (any way on an
		// oblique map)
		// (the cell is the map renderer's: on a staggered or a hexagonal map
		// it can be a pixel less than the map's tile size)
		const grid = map.getRenderer?.();
		const cellWidth = grid?.tilewidth ?? this.tilewidth;
		const cellHeight = grid?.tileheight ?? this.tileheight;
		const overX = Math.max(this.maxTileSize.width - cellWidth, 0);
		const overY = Math.max(this.maxTileSize.height - cellHeight, 0);
		const upRight = orientation !== "oblique";
		/**
		 * How far past the layer's grid its tiles can be drawn, on each
		 * side: by tiles larger than a cell, and by a tileset's
		 * `tileoffset`. The layer is in view as far as they reach (see
		 * {@link TMXLayer#getDrawBounds}).
		 * @ignore
		 */
		this._reach = {
			left: (upRight ? 0 : overX) + offsetLeft,
			top: overY + offsetTop,
			right: overX + offsetRight,
			bottom: (upRight ? 0 : overY) + offsetBottom,
		};

		/**
		 * All animated tilesets in this layer
		 * @type {TMXTileset[]}
		 */
		this.animatedTilesets = [];

		/**
		 * Layer contains tileset animations
		 * @type {boolean}
		 */
		this.isAnimated = false;

		/**
		 * the order in which tiles on orthogonal tile layers are rendered.
		 * (valid values are "left-down", "left-up", "right-down", "right-up").
		 * Tiled sets it on the map, which every layer follows
		 * @type {string}
		 * @default "right-down"
		 */
		this.renderorder = data.renderorder || map.renderorder || "right-down";

		/**
		 * the layer class
		 * @type {string}
		 */
		this.class = data.class;

		// for displaying order
		this.pos.z = z;

		// tiled default coordinates are top-left
		this.anchorPoint.set(0, 0);

		// additional TMX flags
		this.name = data.name;

		/**
		 * the column, in the map's tile coordinates, of the layer's first
		 * column. 0, except on an infinite map whose layer holds tiles left of
		 * the map's origin: there it is negative, and the layer's columns are
		 * `startx` to `startx + cols - 1`, the column numbers Tiled shows
		 * @type {number}
		 * @default 0
		 */
		this.startx = 0;

		/**
		 * the row, in the map's tile coordinates, of the layer's first row.
		 * 0, except on an infinite map whose layer holds tiles above the map's
		 * origin: there it is negative, and the layer's rows are `starty` to
		 * `starty + rows - 1`, the row numbers Tiled shows
		 * @type {number}
		 * @default 0
		 */
		this.starty = 0;

		/**
		 * the number of columns in the layer
		 * @type {number}
		 */
		this.cols = +data.width;

		/**
		 * the number of rows in the layer
		 * @type {number}
		 */
		this.rows = +data.height;

		// an infinite map's layer covers the map and every one of its chunks
		const chunks = map.infinite === 1 ? (data.chunks ?? []) : undefined;
		if (chunks !== undefined) {
			const extent = chunksExtent(map, chunks);
			this.startx = extent.x;
			this.starty = extent.y;
			this.cols = extent.cols;
			this.rows = extent.rows;
		}

		// layer opacity
		const visible = typeof data.visible !== "undefined" ? +data.visible : 1;
		this.setOpacity(visible ? +data.opacity : 0);

		// layer blend mode (Tiled 1.12+)
		this.blendMode = TMXUtils.tiledBlendMode(data.mode);

		// layer tint
		if (typeof data.tintcolor === "string") {
			// Tiled provides #RRGGBB or #AARRGGBB
			this.tint.parseHex(data.tintcolor, true);
		}

		// check if we have any user-defined properties
		TMXUtils.applyTMXProperties(this, data);

		// set a renderer
		this.setRenderer(map.getRenderer());

		/**
		 * The raw tile data for this layer. Each cell occupies two consecutive
		 * `Uint16` slots: the GID (with flip bits stripped) and a 3-bit flip
		 * mask. Cell `(x, y)` is at `layerData[(y * cols + x) * 2]` (row-major),
		 * counted from the layer's first cell: the map's tile
		 * `(x + startx, y + starty)`.
		 *
		 * The 16-bit GID slot caps per-tileset GIDs at 65 535. This matches the
		 * planned WebGL2 shader path (`RG16UI` index texture) — switching to
		 * `Uint32Array` would force a truncating copy at GPU upload time.
		 * @type {Uint16Array}
		 */
		this.layerData = new Uint16Array(this.cols * this.rows * 2);

		/**
		 * Lazy view cache of Tile objects, indexed by `y * cols + x` (row-major).
		 * Allocated lazily on the first `cellAt` / `getTile` call — the renderer
		 * hot path reads `layerData` directly and never touches this cache, so
		 * for games that never call `getTile`/`cellAt` from user code, this
		 * stays `null` for the layer's lifetime. Invalidated entry-by-entry by
		 * `setTile` and `clearTile`. The raw bytes in `layerData` are the source
		 * of truth; this exists only to preserve stable Tile identity across
		 * repeated user-facing reads.
		 * @type {Array<Tile|null>|null}
		 * @ignore
		 * @internal
		 */
		this.cachedTile = null;

		/**
		 * Monotonically-increasing counter bumped by `setTile` and `clearTile`.
		 * Renderers can compare against a stashed value to detect mutations and
		 * decide whether to re-upload the layer data to the GPU.
		 * @type {number}
		 */
		this.dataVersion = 0;

		/**
		 * How this layer is rendered. Resolved by `onActivateEvent` to one of:
		 *   - `"shader"`   — GPU procedural shader path, on WebGL 2 and WebGPU, for orthogonal, isometric, staggered and hexagonal maps (single quad per tileset, fragment GID lookup)
		 *   - `"prerender"`— offscreen-canvas bake at activation, blitted as one drawImage per frame
		 *   - `"perTile"`  — per-frame loop, one drawImage per visible tile
		 *
		 * User code may set this to one of the above values (or the special
		 * `"auto"`) before the layer is activated to override the engine's
		 * default choice; Tiled custom properties named `renderMode` are
		 * applied automatically via `applyTMXProperties`. If a forced mode
		 * is ineligible (e.g. `"shader"` on Canvas), a one-shot warning is
		 * emitted at activation and the layer falls back to the legacy path.
		 * @type {string}
		 * @default "auto"
		 */
		this.renderMode = "auto";

		if (map.infinite === 0) {
			// initialize and set the layer data
			setLayerData(
				this,
				TMXUtils.decode(data.data, data.encoding, data.compression),
				0,
				0,
				this.cols,
				this.rows,
			);
		} else if (chunks !== undefined) {
			// infinite map, initialize per chunk
			for (let i = 0, len = chunks.length; i < len; i++) {
				const chunk = chunks[i];
				setLayerData(
					this,
					TMXUtils.decode(chunk.data, data.encoding, data.compression),
					+chunk.x,
					+chunk.y,
					+chunk.width,
					+chunk.height,
					true,
				);
			}
		}

		// the layer's place and size in the world: the area its tiles are
		// drawn in, which `contains` (and so `getTile`) checks. On a
		// staggered or hexagonal map it reaches past `cols * tilewidth`, on
		// an oblique one it can start left of 0, and on an infinite map's
		// layer left of and above the map's origin
		const bounds = this.getRenderer().getBounds(this);
		const origin = this._cellOrigin(vector2dPool.get());
		/**
		 * where the layer is in its map, with nothing moving it: what `pos`
		 * is measured from to know how far the layer was moved
		 * @ignore
		 */
		this._mapPos = { x: bounds.left + origin.x, y: bounds.top + origin.y };
		this.width = bounds.width;
		this.height = bounds.height;
		// the layer's offset in Tiled moves it from there, as setting `pos`
		// does afterwards: its tiles are drawn, and found, where it is
		this.pos.x = this._mapPos.x + (+data.offsetx || 0);
		this.pos.y = this._mapPos.y + (+data.offsety || 0);
		vector2dPool.release(origin);
		boundsPool.release(bounds);
	}

	/**
	 * The area the layer draws in: its bounds, which are its grid's, and as
	 * far past them as its tiles reach. A tile larger than its cell, or
	 * moved by its tileset's `tileoffset`, is drawn outside the grid, and a
	 * camera has the layer in view while such a tile is (see
	 * `Camera2d#isVisible`). The layer's bounds, `width` and `height` stay
	 * the grid's.
	 * @returns {Bounds} that area, in the same coordinates as `getBounds()`
	 * @ignore
	 */
	getDrawBounds() {
		const bounds = this.getBounds();
		const reach = this._reach;
		/** @ignore */
		this._drawBounds ??= boundsPool.get();
		this._drawBounds.setMinMax(
			bounds.left - reach.left,
			bounds.top - reach.top,
			bounds.right + reach.right,
			bounds.bottom + reach.bottom,
		);
		return this._drawBounds;
	}

	/**
	 * where, in world pixels, the layer's renderer draws the tile in the
	 * layer's first column and row, less where it draws the map's tile (0, 0):
	 * (0, 0), but on an infinite map's layer that starts left of or above the
	 * map's origin
	 * @param {Vector2d} v - the vector to set
	 * @returns {Vector2d} v
	 * @ignore
	 * @internal
	 */
	_cellOrigin(v) {
		if (this.startx === 0 && this.starty === 0) {
			return v.set(0, 0);
		}
		const renderer = this.getRenderer();
		const zero = renderer.tileToPixelCoords(0, 0, vector2dPool.get());
		renderer.tileToPixelCoords(this.startx, this.starty, v);
		v.sub(zero);
		vector2dPool.release(zero);
		return v;
	}

	// called when the layer is added to the game world or a container
	onActivateEvent() {
		// afresh: a layer taken out of a container and put back is
		// activated again
		this.animatedTilesets = [];
		// A container with a size of its own (one a level was loaded into)
		// is in view by its bounds, before its children are asked: each one
		// the layer is in is told that the layer can draw outside them (its
		// tiles' reach, its offset, an infinite map's first chunks)
		/** @ignore */
		this._toldAncestors = [];
		for (let node = this.ancestor; node; node = node.ancestor) {
			(node._drawPast ??= new Set()).add(this);
			this._toldAncestors.push(node);
		}
		if (this.tilesets) {
			const tileset = this.tilesets.tilesets;
			for (let i = 0; i < tileset.length; i++) {
				if (tileset[i].isAnimated) {
					this.animatedTilesets.push(tileset[i]);
				}
			}
		}

		this.isAnimated = this.animatedTilesets.length > 0;

		// resolve renderMode: shader > prerender > perTile, taking into
		// account user-forced values, Application/world settings, and the
		// per-layer preRender hint
		this._resolveRenderMode();

		// if pre-rendering method is in use, bake the layer into an offscreen
		// canvas, drawn as one image from then on
		if (this.renderMode === "prerender" && !this.canvasRenderer) {
			this._bakePreRender();
		}
		// keep `preRender` boolean in sync with the resolved mode (legacy
		// callers still read it; `Renderer.drawTileLayer` itself reads
		// `layer.canvasRenderer`)
		this.preRender = this.renderMode === "prerender";

		this.isDirty = true;
	}

	/**
	 * Bake every tile of the layer into its offscreen canvas. The canvas
	 * covers what the map renderer gives as the layer's bounds, which on a
	 * hexagonal, staggered or oblique map reach past `cols * tilewidth`
	 * (and on an oblique one, left of or above 0), grown on every side by
	 * how far an oversized or offset tile can reach past its cell. `_preRenderX` /
	 * `_preRenderY` are where the canvas's top left corner sits.
	 * @ignore
	 * @internal
	 */
	_bakePreRender() {
		const renderer = this.getRenderer();
		const bounds = renderer.getBounds(this);
		// an oversized tile reaches past its cell (which way depends on the
		// orientation: up and to the right, any way on an oblique map), and
		// a tileset's offset moves all of its tiles
		const overX = Math.max(
			this.maxTileSize.width - (renderer.tilewidth ?? this.tilewidth),
			0,
		);
		const overY = Math.max(
			this.maxTileSize.height - (renderer.tileheight ?? this.tileheight),
			0,
		);
		let left = bounds.left - overX;
		let top = bounds.top - overY;
		let right = bounds.right + overX;
		let bottom = bounds.bottom + overY;
		boundsPool.release(bounds);
		let offset = false;
		for (let i = 0; i < this.tilesets.length; i++) {
			const { x, y } = this.tilesets.getTilesetByIndex(i).tileoffset;
			left += Math.min(x, 0);
			right += Math.max(x, 0);
			top += Math.min(y, 0);
			bottom += Math.max(y, 0);
			offset = offset || x !== 0 || y !== 0;
		}
		const x = Math.floor(left);
		const y = Math.floor(top);
		const width = Math.max(Math.ceil(right) - x, 1);
		const height = Math.max(Math.ceil(bottom) - y, 1);

		const previous = this.canvasRenderer?.getCanvas();
		if (previous?.width === width && previous?.height === height) {
			this.canvasRenderer.clearRect(0, 0, width, height);
		} else {
			// not resized: a renderer's resize is announced to the whole
			// game, whose own renderer would take the canvas's size
			this.canvasRenderer?.destroy();
			this.canvasRenderer = new CanvasRenderer({
				canvas: createCanvas(width, height),
				width,
				height,
				transparent: true,
			});
		}
		/** @ignore */
		this._preRenderX = x;
		/** @ignore */
		this._preRenderY = y;
		/**
		 * whether a tile changed at runtime can be redrawn in its cell alone,
		 * overlapping no other: an orthogonal map whose tiles all fit their
		 * cell, with no offset. Anywhere else the layer is baked again
		 * @ignore
		 */
		this._preRenderInPlace =
			this.orientation === "orthogonal" &&
			this.maxTileSize.width <= this.tilewidth &&
			this.maxTileSize.height <= this.tileheight &&
			!offset;
		/** @ignore */
		this._preRenderStale = false;
		/**
		 * whether the baked canvas changed since the layer last drew it: the
		 * renderer drawing it keeps a copy (a texture on the GPU, a tinted
		 * image on Canvas) to refresh
		 * @ignore
		 */
		this._preRenderChanged = true;

		this.canvasRenderer.save();
		this.canvasRenderer.translate(-x, -y);
		renderer.drawTileLayer(
			this.canvasRenderer,
			this,
			new Rect(x, y, width, height),
		);
		this.canvasRenderer.restore();
	}

	/**
	 * Bring the baked canvas up to date with the tile at (x, y), just set or
	 * cleared: redrawn in its cell where that is exact, else baked again
	 * before the layer next draws
	 * @param {number} x - the tile's column, in the map's tile coordinates
	 * @param {number} y - the tile's row, in the map's tile coordinates
	 * @ignore
	 * @internal
	 */
	_preRenderCell(x, y) {
		if (this.preRender !== true || this.canvasRenderer === undefined) {
			return;
		}
		if (this._preRenderInPlace !== true) {
			this._preRenderStale = true;
			return;
		}
		// the bake holds the layer's grid from its first cell
		const cx = x - this.startx;
		const cy = y - this.starty;
		const canvas = this.canvasRenderer;
		canvas.save();
		canvas.translate(-this._preRenderX, -this._preRenderY);
		canvas.clearRect(
			cx * this.tilewidth,
			cy * this.tileheight,
			this.tilewidth,
			this.tileheight,
		);
		const tile = this.cellAt(x, y, false);
		if (tile !== null) {
			this.getRenderer().drawTile(canvas, cx, cy, tile);
		}
		canvas.restore();
		this._preRenderChanged = true;
	}

	/**
	 * Resolve `this.renderMode` to one of "shader" / "prerender" / "perTile"
	 * based on eligibility checks and user/world hints. Emits a single
	 * `console.warn` at activation when a forced mode is ineligible, or
	 * when an auto-eligible mode falls back due to a layer feature the GPU
	 * path doesn't support (orientation, collection-of-image tileset, etc.).
	 * @ignore
	 * @internal
	 */
	_resolveRenderMode() {
		const root = this.ancestor?.getRootAncestor?.();
		const renderer = this.parentApp?.renderer;
		const gpuAllowed = root?.gpuTilemap !== false;
		const preRenderHint =
			typeof this.preRender === "boolean" ? this.preRender : root?.preRender;

		const elig = this._checkShaderEligibility(renderer, gpuAllowed);
		/**
		 * whether the shader path can draw the layer, as its tiles are now
		 * (kept up to date by `setTile`): a layer asked for that path by
		 * hand when it cannot is drawn tile by tile
		 * @ignore
		 */
		this._shaderFit = elig.ok;

		const requested = this.renderMode;
		// explicit "shader" — honor if eligible, warn otherwise
		if (requested === "shader") {
			if (elig.ok) {
				return; // already "shader"
			}
			console.warn(
				`melonJS: layer "${this.name}" forced renderMode "shader" not available (${elig.reason}) — falling back to perTile`,
			);
			this.renderMode = "perTile";
			return;
		}
		// explicit "prerender" — honor unless animated (cache would go stale)
		if (requested === "prerender") {
			if (this.isAnimated) {
				console.warn(
					`melonJS: layer "${this.name}" forced renderMode "prerender" disabled (layer has animated tiles) — falling back to perTile`,
				);
				this.renderMode = "perTile";
			}
			return;
		}
		// explicit "perTile" — pass through
		if (requested === "perTile") {
			return;
		}
		// auto-resolve: shader > prerender > perTile
		if (elig.ok) {
			this.renderMode = "shader";
			return;
		}
		// only emit an info warning when the user enabled gpuTilemap and
		// the fallback is meaningful. Layer-specific limitations (isometric
		// orientation, collection-of-image tileset, etc.) get a per-layer
		// warning because they're actionable per layer. The renderer-wide
		// "no WebGL2 context" case gets a single session-scoped warning
		// — emitted from the first TMX layer that hits it, so apps with
		// no tilemap loaded stay quiet.
		if (gpuAllowed) {
			if (elig.reason === "no-gpu-renderer") {
				warnOnce(
					"melonJS: gpuTilemap is enabled but the active renderer has no GPU tile-layer support — falling back to the legacy tile renderer for every tile layer",
				);
			} else {
				console.warn(
					`melonJS: layer "${this.name}" using legacy tile renderer (${elig.reason})`,
				);
			}
		}
		if (preRenderHint && !this.isAnimated) {
			this.renderMode = "prerender";
			return;
		}
		this.renderMode = "perTile";
	}

	/**
	 * Check whether this layer is eligible for the WebGL2 shader path.
	 * @param {object} renderer
	 * @param {boolean} gpuAllowed - whether `gpuTilemap` is enabled at the world level
	 * @returns {{ok: boolean, reason?: string}}
	 * @ignore
	 * @internal
	 */
	_checkShaderEligibility(renderer, gpuAllowed) {
		if (!gpuAllowed) {
			return { ok: false, reason: "gpuTilemap disabled" };
		}
		if (!renderer || renderer.supportsShaderTileLayers !== true) {
			return { ok: false, reason: "no-gpu-renderer" };
		}
		if (TMX_ORIENTATIONS[this.orientation] === undefined) {
			return {
				ok: false,
				reason: `no gpu renderer supported yet for "${this.orientation}" orientation`,
			};
		}
		if (!this.tilesets || this.tilesets.tilesets.length === 0) {
			return { ok: false, reason: "no tilesets" };
		}
		// the path keeps a texel per cell: no more of them, either way, than
		// the largest texture has
		const maxTexture = renderer.maxTextureSize ?? Infinity;
		if (this.cols > maxTexture || this.rows > maxTexture) {
			return {
				ok: false,
				reason: `more columns or rows than the largest texture has pixels (${maxTexture})`,
			};
		}
		if (this.orientation !== "orthogonal") {
			return this._checkOverlappingShaderEligibility(renderer);
		}
		// the shader iterates a fixed-size loop over candidate cells to
		// support oversized tiles (tile dim > cell dim) drawn bottom-aligned.
		// Loop bound is MAX_OVERFLOW + 1; anything beyond would silently clip,
		// so refuse the shader path for layers with extreme oversampling.
		const MAX_OVERFLOW_CELLS = ORTHOGONAL_MAX_OVERFLOW;
		for (const ts of this.tilesets.tilesets) {
			const reason = this._tilesetReason(ts, renderer);
			if (reason !== undefined) {
				return { ok: false, reason };
			}
			if (ts.tileoffset.x !== 0 || ts.tileoffset.y !== 0) {
				return { ok: false, reason: "non-zero tileoffset" };
			}
			const overflowX = Math.ceil(ts.tilewidth / this.tilewidth) - 1;
			const overflowY = Math.ceil(ts.tileheight / this.tileheight) - 1;
			if (overflowX > MAX_OVERFLOW_CELLS || overflowY > MAX_OVERFLOW_CELLS) {
				return {
					ok: false,
					reason: `tile overflow exceeds shader limit (${MAX_OVERFLOW_CELLS} cells)`,
				};
			}
		}
		const overlap = this._checkOrthogonalOverlap();
		if (overlap !== undefined) {
			return { ok: false, reason: overlap };
		}
		if (this._hasDiagonalFlipNotSquare()) {
			return { ok: false, reason: DIAGONAL_NOT_SQUARE };
		}
		return { ok: true };
	}

	/**
	 * Whether a tile of this layer is flipped diagonally and not square,
	 * which the shader path cannot draw. Only looks at the tiles when a
	 * tileset has tiles that are not square.
	 * @returns {boolean}
	 * @ignore
	 * @internal
	 */
	_hasDiagonalFlipNotSquare() {
		const tilesets = this.tilesets.tilesets;
		if (
			tilesets.every((tileset) => {
				return tileset.tilewidth === tileset.tileheight;
			})
		) {
			return false;
		}
		const data = this.layerData;
		for (let i = 0; i < data.length; i += 2) {
			if (data[i] !== 0 && (data[i + 1] & FLIP_AD_BIT) !== 0) {
				const tileset = this.tilesets.getTilesetByGid(data[i]);
				if (tileset.tilewidth !== tileset.tileheight) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Why the shader path cannot draw the tiles of a tileset, on any map, if
	 * it cannot.
	 * @param {TMXTileset} tileset - the tileset
	 * @param {object} [renderer] - the renderer, for its largest texture
	 * @returns {string|undefined} the reason, or undefined when it can
	 * @ignore
	 * @internal
	 */
	_tilesetReason(tileset, renderer) {
		if (tileset.isCollection) {
			return "collection-of-image tileset";
		}
		if (tileset.tilerendersize !== "tile") {
			return `tilerendersize "${tileset.tilerendersize}" not supported`;
		}
		// an animated tileset has a texel per tile, in one row
		const maxTexture = renderer?.maxTextureSize ?? Infinity;
		if (
			tileset.isAnimated &&
			tileset.lastgid - tileset.firstgid + 1 > maxTexture
		) {
			return `an animated tileset of more tiles than the largest texture has pixels (${maxTexture})`;
		}
		return undefined;
	}

	/**
	 * Whether a tileset's tiles are larger than a cell: they overlap the
	 * cells around theirs.
	 * @param {TMXTileset} tileset - the tileset
	 * @returns {boolean}
	 * @ignore
	 * @internal
	 */
	_largerThanCell(tileset) {
		return (
			tileset.tilewidth > this.tilewidth || tileset.tileheight > this.tileheight
		);
	}

	/**
	 * Check an orthogonal layer for tiles that overlap in a way the shader
	 * path does not keep, and note the tilesets its tiles come from.
	 *
	 * Tiles the size of a cell never overlap, and any layer of them is fine.
	 * Tiles larger than a cell lie over their neighbours, the one drawn last
	 * on top: the shader keeps that order among the tiles of ONE tileset (it
	 * draws a pass per tileset, each whole pass over the last), and for the
	 * map's default order alone, from the top down and the left across
	 * ("right-down").
	 * @returns {string|undefined} why the path cannot draw the layer, or
	 * undefined when it can
	 * @ignore
	 * @internal
	 */
	_checkOrthogonalOverlap() {
		/**
		 * the tilesets an orthogonal layer's tiles come from, when some of
		 * the map's are larger than a cell (`setTile` adds to them):
		 * undefined when none is, and nothing can overlap
		 * @ignore
		 */
		this._usedTilesets = undefined;
		if (
			!this.tilesets.tilesets.some((tileset) => {
				return this._largerThanCell(tileset);
			})
		) {
			return undefined;
		}
		const used = new Set();
		const data = this.layerData;
		let tileset = null;
		for (let i = 0; i < data.length; i += 2) {
			const gid = data[i];
			if (gid !== 0 && (tileset === null || !tileset.contains(gid))) {
				tileset = this.tilesets.getTilesetByGid(gid);
				used.add(tileset);
			}
		}
		this._usedTilesets = used;
		return this._orthogonalOverlapReason();
	}

	/**
	 * Why the tiles of the tilesets an orthogonal layer uses overlap in a way
	 * the shader path does not keep, if they do (see
	 * {@link TMXLayer#_checkOrthogonalOverlap}).
	 * @returns {string|undefined} the reason, or undefined
	 * @ignore
	 * @internal
	 */
	_orthogonalOverlapReason() {
		let larger = false;
		for (const tileset of this._usedTilesets) {
			larger = larger || this._largerThanCell(tileset);
		}
		if (!larger) {
			return undefined;
		}
		if (this._usedTilesets.size > 1) {
			return "tiles larger than the grid, of more than one tileset in a layer";
		}
		if (this.renderorder !== "right-down") {
			return `render order "${this.renderorder}" with tiles larger than the grid`;
		}
		return undefined;
	}

	/**
	 * Check whether this layer of an isometric, staggered or hexagonal map
	 * can take the shader path, and note the tileset it would draw with.
	 *
	 * On these maps tiles overlap (each is drawn as its whole image, over
	 * the ones behind it), and the shader path draws one tileset at a time:
	 * it can keep the tile drawn last among those of one tileset, not across
	 * two. So the layer's tiles must all come from the same tileset. Which
	 * one is found by looking at the tiles, not at the map's list: a map
	 * commonly has a tileset per layer.
	 * @returns {{ok: boolean, reason?: string}}
	 * @ignore
	 * @internal
	 */
	_checkOverlappingShaderEligibility(renderer) {
		this._shaderTileset = null;
		const kind = kindOf(this.orientation);
		// Half the tiles of an isometric grid of odd size stand half a pixel
		// off. Tile by tile, each is moved to a whole pixel; the shader has
		// one quad for all of them, and would draw those a pixel away. (A
		// staggered or a hexagonal map is laid out in whole numbers.)
		if (
			this.orientation === "isometric" &&
			(this.tilewidth % 2 !== 0 || this.tileheight % 2 !== 0)
		) {
			return { ok: false, reason: `${kind} grid of odd size` };
		}
		// Tiles overlap, and the shader draws the layer flat, then blends it
		// as one picture: where tile by tile each tile is blended over the
		// ones behind it, which shows with every mode but the normal one.
		if (this.blendMode !== "normal") {
			return {
				ok: false,
				reason: `blend mode "${this.blendMode}" on ${kind} layer`,
			};
		}
		const data = this.layerData;
		let tileset = null;
		for (let i = 0; i < data.length; i += 2) {
			const gid = data[i];
			if (gid !== 0 && (tileset === null || !tileset.contains(gid))) {
				if (tileset !== null) {
					return { ok: false, reason: oneTilesetReason(this.orientation) };
				}
				tileset = this.tilesets.getTilesetByGid(gid);
			}
		}
		if (tileset !== null) {
			const reason = this._overlappingTilesetReason(tileset, renderer);
			if (reason !== undefined) {
				return { ok: false, reason };
			}
		}
		if (this._hasDiagonalFlipNotSquare()) {
			return { ok: false, reason: DIAGONAL_NOT_SQUARE };
		}
		// an empty layer: its tileset is the first one a tile is set from
		this._shaderTileset = tileset ?? undefined;
		return { ok: true };
	}

	/**
	 * Why the shader path of an isometric, staggered or hexagonal map cannot
	 * draw the tiles of a tileset, if it cannot.
	 * @param {TMXTileset} tileset - the tileset
	 * @returns {string|undefined} the reason, or undefined when it can
	 * @ignore
	 * @internal
	 */
	_overlappingTilesetReason(tileset, renderer) {
		const unfit = this._tilesetReason(tileset, renderer);
		if (unfit !== undefined) {
			return unfit;
		}
		// The shader looks, for each pixel, at every cell whose tile image
		// could cover it: a bounded number, of lines of cells and of cells
		// in a line. On an isometric map the lines are half a grid height
		// apart and their cells a grid width; on the others, a row height
		// and two column widths
		const { MAX_ROWS, MAX_COLS } = TMX_ORIENTATIONS[this.orientation].limits;
		const map = this.getRenderer();
		const isometric = this.orientation === "isometric";
		const maxWidth =
			MAX_COLS * (isometric ? this.tilewidth : map.columnwidth * 2);
		const maxHeight =
			MAX_ROWS * (isometric ? this.tileheight / 2 : map.rowheight);
		if (tileset.tilewidth > maxWidth || tileset.tileheight > maxHeight) {
			return `tiles larger than the shader's limit (${maxWidth} by ${maxHeight} pixels on this grid)`;
		}
		return undefined;
	}

	/**
	 * A tile set at run time on a layer on the shader path: one that path
	 * cannot draw moves the layer back to the legacy renderer.
	 *
	 * That is a tile flipped diagonally and not square, and on a layer of an
	 * isometric, staggered or hexagonal map, which draws with one tileset, a
	 * tile of another one, or of one the path cannot draw.
	 * @param {number} gid - the gid of the tile just set
	 * @param {number} flipMask - its flips
	 * @ignore
	 * @internal
	 */
	_keepShaderEligible(gid, flipMask) {
		let reason;
		if (this.orientation === "orthogonal") {
			// a tileset the layer did not use yet, where tiles can overlap
			if (this._usedTilesets !== undefined) {
				const tileset = this.tilesets.getTilesetByGid(gid);
				if (!this._usedTilesets.has(tileset)) {
					this._usedTilesets.add(tileset);
					reason = this._orthogonalOverlapReason();
				}
			}
		} else if (this._shaderTileset?.contains(gid) !== true) {
			if (this._shaderTileset) {
				reason = oneTilesetReason(this.orientation);
			} else {
				// an empty layer takes its tileset from its first tile
				const tileset = this.tilesets.getTilesetByGid(gid);
				reason = this._overlappingTilesetReason(
					tileset,
					this.parentApp?.renderer,
				);
				if (reason === undefined) {
					this._shaderTileset = tileset;
				}
			}
		}
		if (reason === undefined && (flipMask & FLIP_AD_BIT) !== 0) {
			const tileset = this.tilesets.getTilesetByGid(gid);
			if (tileset.tilewidth !== tileset.tileheight) {
				reason = DIAGONAL_NOT_SQUARE;
			}
		}
		if (reason !== undefined) {
			this._shaderFit = false;
			this._shaderTileset = null;
			// drawn another way for now (by hand): nothing to move back
			if (this.renderMode === "shader") {
				console.warn(
					`melonJS: layer "${this.name}" back to the legacy tile renderer (${reason})`,
				);
				this.renderMode = "perTile";
			}
		}
	}

	// called when the layer is removed from the game world or a container
	onDeactivateEvent() {
		// renderer-side caches keyed by this layer (e.g. the WebGL2 shader
		// path's per-layer GID index texture) are cleared from the renderer's
		// own `reset()` path — tile layers only come and go on game reset.
		this.animatedTilesets = [];
		for (const node of this._toldAncestors ?? []) {
			node._drawPast?.delete(this);
		}
		this._toldAncestors = undefined;
		// keep canvasRenderer for reuse — dropping the reference would leak
		// event listeners registered by CanvasRenderer's constructor
	}

	/**
	 * Set the TMX renderer for this layer object
	 * @param {TMXRenderer} renderer
	 * @example
	 * // use the parent map default renderer
	 * let layer = new me.TMXLayer(...);
	 * layer.setRenderer(map.getRenderer());
	 */
	setRenderer(renderer) {
		this.renderer = renderer;
		this.isDirty = true;
	}

	/**
	 * Return the layer current renderer object
	 * @returns {TMXRenderer} renderer
	 */
	getRenderer() {
		return this.renderer;
	}

	/**
	 * Return the TileId of the Tile at the specified position
	 * @param {number} x - X coordinate (in world/pixels coordinates)
	 * @param {number} y - Y coordinate (in world/pixels coordinates)
	 * @returns {number} TileId or null if there is no Tile at the given position
	 */
	getTileId(x, y) {
		const tile = this.getTile(x, y);
		return tile ? tile.tileId : null;
	}

	/**
	 * Return the Tile object at the specified position
	 * @param {number} x - X coordinate (in world/pixels coordinates)
	 * @param {number} y - Y coordinate (in world/pixels coordinates)
	 * @returns {Tile} corresponding tile or null if there is no defined tile at the coordinate or if outside of the layer bounds:
	 * the tile drawn there, whose `col` and `row` are the cell {@link TMXLayer#cellAt} reads
	 * @example
	 * // get the TMX Map Layer called "Front layer"
	 * let layer = app.world.getChildByName("Front Layer")[0];
	 * // get the tile object corresponding to the latest pointer position
	 * let tile = layer.getTile(me.input.pointer.x, me.input.pointer.y);
	 */
	getTile(x, y) {
		let tile = null;

		if (this.contains(x, y)) {
			// in the map's pixels: back from where the layer was moved to
			const coord = this.getRenderer().pixelToTileCoords(
				x - (this.pos.x - this._mapPos.x),
				y - (this.pos.y - this._mapPos.y),
				vector2dPool.get(),
			);
			tile = this.cellAt(coord.x, coord.y);
			vector2dPool.release(coord);
		}
		return tile;
	}

	/**
	 * assign the given Tile object to the specified position (no change
	 * outside the layer)
	 * @param {Tile} tile - the tile object to be assigned
	 * @param {number} x - column, in the map's tile coordinates (as Tiled shows them: on an infinite map, from {@link TMXLayer#startx})
	 * @param {number} y - row, in the map's tile coordinates (on an infinite map, from {@link TMXLayer#starty})
	 * @returns {Tile} the tile object
	 */
	setTile(tile, x, y) {
		x = Math.floor(x);
		y = Math.floor(y);
		const cx = x - this.startx;
		const cy = y - this.starty;
		if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) {
			return tile;
		}
		const slot = cy * this.cols + cx;
		const idx = slot * 2;
		const cleanGid = tile.tileId & TMX_CLEAR_BIT_MASK;
		// `layerData` is a Uint16Array; writes silently truncate above
		// 0xFFFF. Warn once per layer so a runtime `setTile` with a
		// GID >= 65536 doesn't corrupt the cell undetected.
		if (cleanGid > 0xffff) {
			warnOnce(
				"melonJS: setTile received GID " +
					cleanGid +
					" which exceeds the 16-bit cell capacity (max 65535). Tile will be truncated and render incorrectly.",
			);
		}
		this.layerData[idx] = cleanGid;
		this.layerData[idx + 1] = flipMaskFromTile(tile);
		if (this.cachedTile !== null) {
			this.cachedTile[slot] = tile;
		}
		this.dataVersion++;
		this.isDirty = true;
		this._preRenderCell(x, y);
		// whichever way the layer is drawn now: it may be asked for the
		// shader path again
		if (this._shaderFit === true) {
			this._keepShaderEligible(cleanGid, this.layerData[idx + 1]);
		}
		return tile;
	}

	/**
	 * return a new Tile object for the given tile id, to place with {@link TMXLayer#setTile}
	 * @param {number} tileId - global tile id: the tileset's `firstgid` plus the tile's id in the tileset
	 * @param {number} x - column of the tile (in the map's tile coordinates), stored as its `col`
	 * @param {number} y - row of the tile (in the map's tile coordinates), stored as its `row`
	 * @returns {Tile} the tile object
	 * @example
	 * // turn the cell at column 3, row 5 into the tileset's tile 7
	 * const tileset = layer.tilesets.getTilesetByIndex(0);
	 * layer.setTile(layer.getTileById(tileset.firstgid + 7, 3, 5), 3, 5);
	 */
	getTileById(tileId, x, y) {
		if (!this.tileset.contains(tileId)) {
			// look for the corresponding tileset
			this.tileset = this.tilesets.getTilesetByGid(tileId);
		}
		return new Tile(x, y, tileId, this.tileset);
	}

	/**
	 * Return the Tile object at the specified tile coordinates
	 * @param {number} x - column, in the map's tile coordinates (as Tiled shows them: on an infinite map, from {@link TMXLayer#startx}); a fraction is rounded down
	 * @param {number} y - row, in the map's tile coordinates (on an infinite map, from {@link TMXLayer#starty}); a fraction is rounded down
	 * @param {number} [boundsCheck=true] - check first if within the layer bounds
	 * @returns {Tile} corresponding tile or null if there is no defined tile at the position or if outside of the layer bounds
	 * @example
	 * // return the first tile at offset 0, 0
	 * let tile = layer.cellAt(0, 0);
	 */
	cellAt(x, y, boundsCheck) {
		// rounded down, not toward 0: a point just left of or above the
		// layer (as `getTile` gives on an isometric or staggered map) is
		// at -0.5, outside it, not in its first column (NaN is still 0)
		const _x = Math.floor(x) || 0;
		const _y = Math.floor(y) || 0;
		// the cell in the layer's grid
		const cx = _x - this.startx;
		const cy = _y - this.starty;

		// boundsCheck only used internally by the tiled renderer, when the layer bound check was already done
		if (
			boundsCheck !== false &&
			(cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows)
		) {
			return null;
		}

		const slot = cy * this.cols + cx;
		const idx = slot * 2;
		const gid = this.layerData[idx];
		// `cellAt(x, y, false)` skips the explicit bounds check on the
		// coords for speed, but out-of-range reads from a typed array
		// return `undefined` — treat both that and an explicit empty
		// cell (gid 0) as "no tile" so we never push a bogus GID into
		// the tileset lookup path
		if (!gid) {
			return null;
		}

		// lazy-allocate the view cache on first user-facing query — the
		// renderer hot loop bypasses this method and reads layerData directly,
		// so games that never call cellAt/getTile keep cachedTile null forever
		if (this.cachedTile === null) {
			this.cachedTile = new Array(this.cols * this.rows).fill(null);
		} else {
			const cached = this.cachedTile[slot];
			if (cached !== null) {
				return cached;
			}
		}

		const flipMask = this.layerData[idx + 1];
		const tile = this.getTileById(gidWithFlips(gid, flipMask), _x, _y);
		this.cachedTile[slot] = tile;
		return tile;
	}

	/**
	 * clear the tile at the specified position (no change outside the layer)
	 * @param {number} x - column, in the map's tile coordinates (on an infinite map, from {@link TMXLayer#startx})
	 * @param {number} y - row, in the map's tile coordinates (on an infinite map, from {@link TMXLayer#starty})
	 * @example
	 * app.world.getChildByType(me.TMXLayer).forEach(function(layer) {
	 *     // clear all tiles at the given x,y coordinates
	 *     layer.clearTile(x, y);
	 * });
	 */
	clearTile(x, y) {
		x = Math.floor(x);
		y = Math.floor(y);
		const cx = x - this.startx;
		const cy = y - this.starty;
		if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) {
			return;
		}
		// clearing tile
		const slot = cy * this.cols + cx;
		const idx = slot * 2;
		this.layerData[idx] = 0;
		this.layerData[idx + 1] = 0;
		if (this.cachedTile !== null) {
			this.cachedTile[slot] = null;
		}
		this.dataVersion++;
		this.isDirty = true;
		this._preRenderCell(x, y);
	}

	/**
	 * update animations in a tileset layer
	 * @ignore
	 * @internal
	 */
	update(dt) {
		let result = this.isDirty;
		if (this.isAnimated) {
			for (let i = 0; i < this.animatedTilesets.length; i++) {
				result = this.animatedTilesets[i].update(dt) || result;
			}
		}
		return result;
	}

	/**
	 * draw a tileset layer
	 * @ignore
	 * @internal
	 */
	draw(renderer, rect) {
		// a tile changed since the layer was baked, where it could not be
		// redrawn alone
		if (this._preRenderStale === true && this.canvasRenderer !== undefined) {
			this._bakePreRender();
		}
		// the baked canvas changed: refresh the renderer's copy of it, its
		// texture on the GPU or a tinted image on Canvas
		if (this._preRenderChanged === true && this.canvasRenderer !== undefined) {
			this._preRenderChanged = false;
			this.canvasRenderer.renderTarget.invalidate(renderer);
			renderer.cache.tinted?.delete(this.canvasRenderer.getCanvas());
		}
		// whether the view is the default camera's, which draws the world
		// where its `pos` puts it (any other draws it unmoved): asked of the
		// camera, before a plain rectangle stands in for it below
		const unmovedWorld = rect.isDefault === false;
		// the camera's offset (a look ahead, a shake) shifts what it shows
		// without moving it: the tiles to draw are the ones in that view
		const offset = rect.offset;
		if (offset !== undefined && (offset.x !== 0 || offset.y !== 0)) {
			viewRect ??= new Rect(0, 0, 0, 0);
			viewRect.pos.set(rect.pos.x + offset.x, rect.pos.y + offset.y);
			rect = viewRect.setSize(rect.width, rect.height);
		}
		// The view is the camera's, in the world's coordinates, and the layer
		// is drawn where its ancestors put it: a world moved to centre a map
		// smaller than the view, a container the game moved. Read in the
		// layer's own coordinates, the view starts that much earlier. (A
		// camera other than the default one draws the world unmoved.)
		let shiftX = 0;
		let shiftY = 0;
		const parent = this.ancestor;
		if (parent !== undefined && parent !== null) {
			const at = parent.getAbsolutePosition();
			shiftX = at.x;
			shiftY = at.y;
			if (unmovedWorld) {
				let root = parent;
				while (root.ancestor) {
					root = root.ancestor;
				}
				shiftX -= root.pos.x;
				shiftY -= root.pos.y;
			}
		}
		// A layer moved from its place in the map, by its offset in Tiled or
		// by its `pos`, and an infinite map's layer that starts left of or
		// above the map's origin: the layer's renderer draws its grid from
		// its first cell, moved to where that cell's tile is in the world
		const movedX = this.pos.x - this._mapPos.x;
		const movedY = this.pos.y - this._mapPos.y;
		if (
			movedX !== 0 ||
			movedY !== 0 ||
			shiftX !== 0 ||
			shiftY !== 0 ||
			this.startx !== 0 ||
			this.starty !== 0
		) {
			const origin = this._cellOrigin(vector2dPool.get());
			origin.set(origin.x + movedX, origin.y + movedY);
			cellRect ??= new Rect(0, 0, 0, 0);
			cellRect.pos.set(
				rect.pos.x - shiftX - origin.x,
				rect.pos.y - shiftY - origin.y,
			);
			cellRect.setSize(rect.width, rect.height);
			renderer.translate(origin.x, origin.y);
			renderer.drawTileLayer(this, cellRect);
			renderer.translate(-origin.x, -origin.y);
			vector2dPool.release(origin);
			return;
		}
		// dispatch to the active renderer — picks shader / preRender / perTile
		// based on `this.renderMode` and the renderer's capabilities
		renderer.drawTileLayer(this, rect);
	}
}
