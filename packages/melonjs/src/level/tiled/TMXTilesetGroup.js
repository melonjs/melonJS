import { TMX_CLEAR_BIT_MASK } from "./constants";

/**
 * an object containing all tileset
 */
export default class TMXTilesetGroup {
	constructor() {
		this.tilesets = [];
		this.length = 0;
		// cache last matched tileset — consecutive tiles usually share the same tileset
		this._lastTileset = null;
	}

	/**
	 * add a tileset to the tileset group
	 * @param {TMXTileset} tileset
	 */
	add(tileset) {
		this.tilesets.push(tileset);
		this.length++;
	}

	/**
	 * return the tileset at the specified index
	 * @param {number} i
	 * @returns {TMXTileset} corresponding tileset
	 */
	getTilesetByIndex(i) {
		return this.tilesets[i];
	}

	/**
	 * return the tileset corresponding to the specified id <br>
	 * will throw an exception if no matching tileset is found
	 * @param {number} gid
	 * @returns {TMXTileset} corresponding tileset
	 */
	getTilesetByGid(gid) {
		// clear the gid of all flip/rotation flags
		gid &= TMX_CLEAR_BIT_MASK;

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
}
