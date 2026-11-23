import { GID_MASK } from "./constants.js";

/**
 * additional import for TypeScript
 * @import Tileset from "./Tileset.js";
 */
/**
 * the tilesets a map or a layer draws from: each takes a range of global tile
 * ids from its `firstgid`, and a cell's id names one tile of one of them
 * @category Tilemap
 */
export default class TilesetGroup {
	/**
	 * @param {Tileset[]} [tilesets] - the tilesets to start with
	 */
	constructor(tilesets = []) {
		this.tilesets = [];
		this.length = 0;
		// cache last matched tileset — consecutive tiles usually share the same tileset
		/**
		 * @ignore
		 * @internal
		 */
		this._lastTileset = null;
		for (const tileset of tilesets) {
			this.add(tileset);
		}
	}

	/**
	 * add a tileset to the tileset group
	 * @param {Tileset} tileset
	 */
	add(tileset) {
		this.tilesets.push(tileset);
		this.length++;
	}

	/**
	 * return the tileset at the specified index
	 * @param {number} i
	 * @returns {Tileset} corresponding tileset
	 */
	getTilesetByIndex(i) {
		return this.tilesets[i];
	}

	/**
	 * return the tileset corresponding to the specified id <br>
	 * will throw an exception if no matching tileset is found
	 * @param {number} gid
	 * @returns {Tileset} corresponding tileset
	 */
	getTilesetByGid(gid) {
		// clear the gid of all flip/rotation flags
		gid &= GID_MASK;

		// fast path: check cached tileset first (high hit rate for sequential tile data)
		const last = this._lastTileset;
		if (last !== null && last.contains(gid)) {
			return last;
		}

		let invalidRange = -1;
		const tilesets = this.tilesets;

		// cycle through all tilesets
		for (let i = 0, len = tilesets.length; i < len; i++) {
			const ts = tilesets[i];
			// return the corresponding tileset if matching
			if (ts.contains(gid)) {
				this._lastTileset = ts;
				return ts;
			}
			// typically indicates a layer with no asset loaded (collision?)
			if (ts.firstgid === ts.lastgid && gid >= ts.firstgid) {
				invalidRange = i;
			}
		}
		// return the tileset with the invalid range
		if (invalidRange !== -1) {
			const fallback = tilesets[invalidRange];
			this._lastTileset = fallback;
			return fallback;
		}
		throw new Error(`no matching tileset found for gid ${gid}`);
	}

	/**
	 * the tileset a gid belongs to, or undefined when none of the group has
	 * it: {@link TilesetGroup#getTilesetByGid} for a caller that expects there
	 * may be none
	 * @param {number} gid
	 * @returns {Tileset|undefined} the tileset, if any
	 */
	findTileset(gid) {
		try {
			return this.getTilesetByGid(gid);
		} catch {
			return undefined;
		}
	}
}
