/**
 * @classdesc
 * an object containing all tileset
 */
export default class TMXTilesetGroup {
    tilesets: any[];
    length: number;
    /**
     * add a tileset to the tileset group
     * @param {TMXTileset} tileset
     */
    add(tileset: TMXTileset): void;
    /**
     * return the tileset at the specified index
     * @param {number} i
     * @returns {TMXTileset} corresponding tileset
     */
    getTilesetByIndex(i: number): TMXTileset;
    /**
     * return the tileset corresponding to the specified id <br>
     * will throw an exception if no matching tileset is found
     * @param {number} gid
     * @returns {TMXTileset} corresponding tileset
     */
    getTilesetByGid(gid: number): TMXTileset;
}
