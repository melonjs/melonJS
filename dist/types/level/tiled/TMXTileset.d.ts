/**
 * @classdesc
 * a TMX Tile Set Object
 */
export default class TMXTileset {
    /**
     *  @param {object} tileset - tileset data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#tileset})
     */
    constructor(tileset: object);
    TileProperties: any[];
    imageCollection: HTMLImageElement[];
    firstgid: number;
    lastgid: number;
    name: any;
    tilewidth: number;
    tileheight: number;
    spacing: number;
    margin: number;
    tileoffset: Vector2d;
    /**
     * Tileset contains animated tiles
     * @public
     * @type {boolean}
     * @name TMXTileset#isAnimated
     */
    public isAnimated: boolean;
    /**
     * true if the tileset is a "Collection of Image" Tileset
     * @public
     * @type {boolean}
     * @name TMXTileset#isCollection
     */
    public isCollection: boolean;
    /**
     * the tileset class
     * @public
     * @type {boolean}
     * @name TMXTileset#class
     */
    public class: boolean;
    /**
     * Tileset animations
     * @private
     */
    private animations;
    /**
     * Remember the last update timestamp to prevent too many animation updates
     * @private
     */
    private _lastUpdate;
    image: HTMLImageElement | undefined;
    texture: any;
    atlas: any;
    /**
     * return the tile image from a "Collection of Image" tileset
     * @name TMXTileset#getTileImage
     * @public
     * @param {number} gid
     * @returns {Image} corresponding image or undefined
     */
    public getTileImage(gid: number): new (width?: number | undefined, height?: number | undefined) => HTMLImageElement;
    /**
     * set the tile properties
     * @ignore
     */
    setTileProperty(gid: any, prop: any): void;
    /**
     * return true if the gid belongs to the tileset
     * @name TMXTileset#contains
     * @public
     * @param {number} gid
     * @returns {boolean}
     */
    public contains(gid: number): boolean;
    /**
     * Get the view (local) tile ID from a GID, with animations applied
     * @name TMXTileset#getViewTileId
     * @public
     * @param {number} gid - Global tile ID
     * @returns {number} View tile ID
     */
    public getViewTileId(gid: number): number;
    /**
     * return the properties of the specified tile
     * @name TMXTileset#getTileProperties
     * @public
     * @param {number} tileId
     * @returns {object}
     */
    public getTileProperties(tileId: number): object;
    update(dt: any): boolean;
    drawTile(renderer: any, dx: any, dy: any, tmxTile: any): void;
}
import Vector2d from "./../../math/vector2.js";
