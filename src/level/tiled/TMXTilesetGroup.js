
// bitmask constants to check for flipped & rotated tiles
const TMX_CLEAR_BIT_MASK = ~(0x80000000 | 0x40000000 | 0x20000000);

/**
 * @classdesc
 * an object containing all tileset
 */
class TMXTilesetGroup {

    constructor() {
        this.tilesets = [];
        this.length = 0;
    }

    /**
     * add a tileset to the tileset group
     * @name TMXTilesetGroup#add
     * @public
     * @param {TMXTileset} tileset
     */
    add(tileset) {
        this.tilesets.push(tileset);
        this.length++;
    }

    /**
     * return the tileset at the specified index
     * @name TMXTilesetGroup#getTilesetByIndex
     * @public
     * @param {number} i
     * @returns {TMXTileset} corresponding tileset
     */
    getTilesetByIndex(i) {
        return this.tilesets[i];
    }

    /**
     * return the tileset corresponding to the specified id <br>
     * will throw an exception if no matching tileset is found
     * @name TMXTilesetGroup#getTilesetByGid
     * @public
     * @param {number} gid
     * @returns {TMXTileset} corresponding tileset
     */
    getTilesetByGid(gid) {
        var invalidRange = -1;

        // clear the gid of all flip/rotation flags
        gid &= TMX_CLEAR_BIT_MASK;

        // cycle through all tilesets
        for (var i = 0, len = this.tilesets.length; i < len; i++) {
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
};

export default TMXTilesetGroup;
