/**
 * @classdesc
 * a basic tile object
 * @augments Bounds
 */
export default class Tile extends Bounds {
    /**
     * @param {number} x - x index of the Tile in the map
     * @param {number} y - y index of the Tile in the map
     * @param {number} gid - tile gid
     * @param {TMXTileset} tileset - the corresponding tileset object
     */
    constructor(x: number, y: number, gid: number, tileset: TMXTileset);
    /**
     * tileset
     * @type {TMXTileset}
     */
    tileset: TMXTileset;
    /**
     * the tile transformation matrix (if defined)
     * @ignore
     */
    currentTransform: Matrix2d | null;
    col: number;
    row: number;
    /**
     * tileId
     * @type {number}
     */
    tileId: number;
    /**
     * True if the tile is flipped horizontally
     * @type {boolean}
     */
    flippedX: boolean;
    /**
     * True if the tile is flipped vertically
     * @type {boolean}
     */
    flippedY: boolean;
    /**
     * True if the tile is flipped anti-diagonally
     * @type {boolean}
     */
    flippedAD: boolean;
    /**
     * Global flag that indicates if the tile is flipped
     * @type {boolean}
     */
    flipped: boolean;
    /**
     * set the transformation matrix for this tile
     * @ignore
     */
    setTileTransform(transform: any): void;
    /**
     * return a renderable object for this Tile object
     * @param {object} [settings] - see {@link Sprite}
     * @returns {Renderable} a me.Sprite object
     */
    getRenderable(settings?: object | undefined): Renderable;
}
import Bounds from "./../../physics/bounds.js";
import Matrix2d from "./../../math/matrix2.js";
