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
     * @public
     * @type {TMXTileset}
     * @name Tile#tileset
     */
    public tileset: TMXTileset;
    /**
     * the tile transformation matrix (if defined)
     * @ignore
     */
    currentTransform: Matrix2d | null;
    col: number;
    row: number;
    /**
     * tileId
     * @public
     * @type {number}
     * @name Tile#tileId
     */
    public tileId: number;
    /**
     * True if the tile is flipped horizontally<br>
     * @public
     * @type {boolean}
     * @name Tile#flipX
     */
    public flippedX: boolean;
    /**
     * True if the tile is flipped vertically<br>
     * @public
     * @type {boolean}
     * @name Tile#flippedY
     */
    public flippedY: boolean;
    /**
     * True if the tile is flipped anti-diagonally<br>
     * @public
     * @type {boolean}
     * @name Tile#flippedAD
     */
    public flippedAD: boolean;
    /**
     * Global flag that indicates if the tile is flipped<br>
     * @public
     * @type {boolean}
     * @name Tile#flipped
     */
    public flipped: boolean;
    /**
     * set the transformation matrix for this tile
     * @ignore
     */
    setTileTransform(transform: any): void;
    /**
     * return a renderable object for this Tile object
     * @name Tile#getRenderable
     * @public
     * @param {object} [settings] - see {@link Sprite}
     * @returns {Renderable} a me.Sprite object
     */
    public getRenderable(settings?: object | undefined): Renderable;
}
import Bounds from "./../../physics/bounds.js";
import Matrix2d from "./../../math/matrix2.js";
