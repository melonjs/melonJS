import Renderable from "../../renderable/renderable.js";
import { applyLayerDefinition, viewStart } from "./layer.js";

/**
 * additional import for TypeScript
 * @import Tileset from "./Tileset.js";
 */

// where the view starts in a layer's coordinates, while it is drawn
const VIEW_START = { x: 0, y: 0 };

// what a list grows by, in tiles
const GROW = 64;

/**
 * @typedef {object} PlacedTile
 * @property {number} x - where the tile's left edge is, in pixels from the layer's origin
 * @property {number} y - where the tile's top edge is, in pixels from the layer's origin
 * @property {number} tileId - the tile, by its id within the tileset (0 is the first)
 * @property {number} [flip=0] - 1 to mirror it across, 2 to mirror it down, 3 for both
 * @property {number} [alpha=1] - its opacity, from 0 to 1
 */

/**
 * A layer of tiles placed freely: a list of tiles of one tileset, each at a
 * position in pixels, drawn in the order of the list. Where a
 * {@link TileLayer} holds one tile a cell of a grid, this one takes what a
 * grid cannot: tiles stacked on one another, tiles off the grid, tiles larger
 * or smaller than the cells, tiles each with an opacity.
 *
 * Only the tiles in view are drawn. A tile the tileset animates
 * ({@link Tileset#setTileAnimation}) is animated here too.
 * @category Tilemap
 * @example
 * const decals = new me.PlacedTileLayer({
 *     name: "decals",
 *     tileset: new me.Tileset({ image: "props", tilewidth: 16, tileheight: 16 }),
 *     tiles: [
 *         { x: 40, y: 12, tileId: 7 },
 *         // over the first, mirrored and half transparent
 *         { x: 44, y: 16, tileId: 9, flip: 1, alpha: 0.5 },
 *     ],
 * });
 * app.world.addChild(decals, 3);
 */
export default class PlacedTileLayer extends Renderable {
	/**
	 * @param {object} def - what the layer is
	 * @param {Tileset} def.tileset - the tileset its tiles come from
	 * @param {PlacedTile[]} [def.tiles] - its tiles, in the order they are drawn
	 * @param {string} [def.name] - the layer's name
	 * @param {number} [def.width] - its width in pixels; by default as far as its tiles reach
	 * @param {number} [def.height] - its height in pixels; by default as far as its tiles reach
	 * @param {number} [def.z=0] - its draw order
	 * @param {number} [def.opacity=1] - its opacity (0 hides it)
	 * @param {number} [def.offsetx=0] - where its origin is across, in pixels
	 * @param {number} [def.offsety=0] - where its origin is down, in pixels
	 * @param {string} [def.blendMode] - its blend mode
	 * @param {Color|string} [def.tint] - a tint for its tiles, as a color or a CSS color string
	 * @param {string} [def.class] - a class name of the game's own
	 */
	constructor(def) {
		super(def.offsetx ?? 0, def.offsety ?? 0, def.width ?? 0, def.height ?? 0);

		/**
		 * the tileset the layer's tiles come from
		 * @type {Tileset}
		 */
		this.tileset = def.tileset;

		/**
		 * a class name of the game's own
		 * @type {string|undefined}
		 */
		this.class = def.class;

		/**
		 * the size given for the layer, which its tiles can only widen
		 * @ignore
		 */
		this._minWidth = def.width ?? 0;
		/** @ignore */
		this._minHeight = def.height ?? 0;

		// the tiles, side by side: x and y, then the tile id, the flip and
		// the opacity of each
		/** @ignore */
		this._pos = new Float32Array(GROW * 2);
		/** @ignore */
		this._ids = new Uint32Array(GROW);
		/** @ignore */
		this._flips = new Uint8Array(GROW);
		/** @ignore */
		this._alphas = new Float32Array(GROW);
		/** @ignore */
		this._count = 0;

		// its name, draw order, opacity, blend mode and tint, as a tile
		// layer takes them
		applyLayerDefinition(this, def);

		if (def.tiles !== undefined) {
			for (const tile of def.tiles) {
				this.addTile(tile.x, tile.y, tile.tileId, tile.flip, tile.alpha);
			}
		}
	}

	/**
	 * the number of tiles in the layer
	 * @type {number}
	 */
	get length() {
		return this._count;
	}

	/**
	 * add a tile to the end of the list: it is drawn over the ones before it
	 * @param {number} x - where its left edge is, in pixels from the layer's origin
	 * @param {number} y - where its top edge is, in pixels from the layer's origin
	 * @param {number} tileId - the tile, by its id within the tileset
	 * @param {number} [flip=0] - 1 to mirror it across, 2 to mirror it down, 3 for both
	 * @param {number} [alpha=1] - its opacity, from 0 to 1
	 * @returns {number} the tile's place in the list
	 */
	addTile(x, y, tileId, flip = 0, alpha = 1) {
		const index = this._count;
		if (index === this._ids.length) {
			const size = index * 2;
			const grown = (Type, old, per = 1) => {
				const array = new Type(size * per);
				array.set(old);
				return array;
			};
			this._pos = grown(Float32Array, this._pos, 2);
			this._ids = grown(Uint32Array, this._ids);
			this._flips = grown(Uint8Array, this._flips);
			this._alphas = grown(Float32Array, this._alphas);
		}
		this._pos[index * 2] = x;
		this._pos[index * 2 + 1] = y;
		this._ids[index] = tileId;
		this._flips[index] = flip & 3;
		this._alphas[index] = alpha;
		this._count = index + 1;

		// the layer reaches as far as its tiles do
		const tileset = this.tileset;
		const right = Math.max(this.width, this._minWidth, x + tileset.tilewidth);
		const bottom = Math.max(
			this.height,
			this._minHeight,
			y + tileset.tileheight,
		);
		if (right !== this.width || bottom !== this.height) {
			this.resize(right, bottom);
		}
		this.isDirty = true;
		return index;
	}

	/**
	 * the tile at a place in the list
	 * @param {number} index - its place in the list, from 0
	 * @returns {PlacedTile|undefined} a description of the tile (a copy), or undefined past the end
	 */
	getTile(index) {
		if (!(index >= 0 && index < this._count)) {
			return undefined;
		}
		return {
			x: this._pos[index * 2],
			y: this._pos[index * 2 + 1],
			tileId: this._ids[index],
			flip: this._flips[index],
			alpha: this._alphas[index],
		};
	}

	/**
	 * change the tile at a place in the list
	 * @param {number} index - its place in the list, from 0
	 * @param {number} tileId - the tile to show there, by its id within the tileset
	 * @param {number} [flip] - 1 to mirror it across, 2 to mirror it down, 3 for both; kept as it is by default
	 * @param {number} [alpha] - its opacity, from 0 to 1; kept as it is by default
	 */
	setTile(index, tileId, flip, alpha) {
		if (!(index >= 0 && index < this._count)) {
			throw new RangeError(
				`melonJS: no tile ${index} in a layer of ${this._count}`,
			);
		}
		this._ids[index] = tileId;
		if (flip !== undefined) {
			this._flips[index] = flip & 3;
		}
		if (alpha !== undefined) {
			this._alphas[index] = alpha;
		}
		this.isDirty = true;
	}

	/**
	 * the tiles covering a point, bottom-most first
	 * @param {number} x - the point, in pixels from the layer's origin
	 * @param {number} y - the point, in pixels from the layer's origin
	 * @returns {number[]} their places in the list
	 */
	tilesAt(x, y) {
		const found = [];
		const { tilewidth, tileheight } = this.tileset;
		const pos = this._pos;
		for (let i = 0; i < this._count; i++) {
			const tx = pos[i * 2];
			const ty = pos[i * 2 + 1];
			if (x >= tx && x < tx + tilewidth && y >= ty && y < ty + tileheight) {
				found.push(i);
			}
		}
		return found;
	}

	/**
	 * remove every tile
	 */
	clear() {
		this._count = 0;
		this.resize(this._minWidth, this._minHeight);
		this.isDirty = true;
	}

	/**
	 * @ignore
	 */
	update(dt) {
		// the tileset's animated tiles move on
		if (this.tileset.isAnimated && this.tileset.update(dt)) {
			this.isDirty = true;
		}
		return super.update(dt) || this.isDirty;
	}

	/**
	 * draw the tiles in view, in the order of the list
	 * @ignore
	 */
	draw(renderer, rect) {
		const count = this._count;
		if (count === 0) {
			return;
		}
		// where the view starts, in the coordinates the tiles are in
		const start = viewStart(this, rect, VIEW_START);
		const viewX = start.x - this.pos.x;
		const viewY = start.y - this.pos.y;
		const viewRight = viewX + rect.width;
		const viewBottom = viewY + rect.height;

		const tileset = this.tileset;
		const firstgid = tileset.firstgid;
		const { tilewidth, tileheight } = tileset;
		// a tileset's `tileoffset` moves its tiles, as on a grid
		const offsetX = tileset.tileoffset.x;
		const offsetY = tileset.tileoffset.y;
		const pos = this._pos;
		const ids = this._ids;
		const flips = this._flips;
		const alphas = this._alphas;
		const baseAlpha = renderer.globalAlpha();
		let alpha = 1;

		renderer.translate(this.pos.x, this.pos.y);
		for (let i = 0; i < count; i++) {
			const x = pos[i * 2] + offsetX;
			const y = pos[i * 2 + 1] + offsetY;
			if (
				x >= viewRight ||
				y >= viewBottom ||
				x + tilewidth <= viewX ||
				y + tileheight <= viewY
			) {
				continue;
			}
			const tileAlpha = alphas[i];
			if (tileAlpha !== alpha) {
				alpha = tileAlpha;
				renderer.setGlobalAlpha(baseAlpha * alpha);
			}
			tileset.drawTileRaw(renderer, x, y, ids[i] + firstgid, flips[i]);
		}
		if (alpha !== 1) {
			renderer.setGlobalAlpha(baseAlpha);
		}
		renderer.translate(-this.pos.x, -this.pos.y);
	}
}
