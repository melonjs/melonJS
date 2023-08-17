import { TMX_CLEAR_BIT_MASK } from "./constants";

/**
 * @classdesc
 * an object containing all tileset
 */
export default class TMXTilesetGroup {

    constructor() {
        this.tilesets = [];
        this.length = 0;
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
        let invalidRange = -1;

        // clear the gid of all flip/rotation flags
        gid &= TMX_CLEAR_BIT_MASK;

        // cycle through all tilesets
        for (let i = 0, len = this.tilesets.length; i < len; i++) {
            // return the corresponding tileset if matching
            if (this.tilesets[i].contains(gid)) {
                return this.tilesets[i];
            }
            // typically indicates a layer with no asset loaded (collision?)
            if (this.tilesets[i].firstgid === this.tilesets[i].lastgid &&
                gid >= this.tilesets[i].firstgid) {
                // store the id if the [firstgid .. lastgid] is invalid
                invalidRange = i;
            }
        }
        // return the tileset with the invalid range
        if (invalidRange !== -1) {
            return this.tilesets[invalidRange];
        }
        else {
            throw new Error("no matching tileset found for gid " + gid);
        }
    }
}

