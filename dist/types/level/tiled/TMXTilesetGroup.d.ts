/**
 * @classdesc
 * an object containing all tileset
 */
export default class TMXTilesetGroup {
    tilesets: any[];
    length: number;
    /**
     * add a tileset to the tileset group
     * @name TMXTilesetGroup#add
     * @public
     * @param {TMXTileset} tileset
     */
    public add(tileset: TMXTileset): void;
    /**
     * return the tileset at the specified index
     * @name TMXTilesetGroup#getTilesetByIndex
     * @public
     * @param {number} i
     * @returns {TMXTileset} corresponding tileset
     */
    public getTilesetByIndex(i: number): TMXTileset;
    /**
     * return the tileset corresponding to the specified id <br>
     * will throw an exception if no matching tileset is found
     * @name TMXTilesetGroup#getTilesetByGid
     * @public
     * @param {number} gid
     * @returns {TMXTileset} corresponding tileset
     */
    public getTilesetByGid(gid: number): TMXTileset;
}
