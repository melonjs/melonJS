/**
 * @classdesc
 * a TMX Tile Layer Object
 * Tiled QT 0.7.x format
 * @augments Renderable
 */
export default class TMXLayer extends Renderable {
    /**
     * @param {object} map - layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
     * @param {object} data - layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
     * @param {number} tilewidth - width of each tile in pixels
     * @param {number} tileheight - height of each tile in pixels
     * @param {string} orientation - "isometric" or "orthogonal"
     * @param {TMXTilesetGroup} tilesets - tileset as defined in Tiled
     * @param {number} z - z-index position
     */
    constructor(map: object, data: object, tilewidth: number, tileheight: number, orientation: string, tilesets: TMXTilesetGroup, z: number);
    tilewidth: any;
    tileheight: any;
    orientation: string;
    /**
     * Horizontal layer offset in tiles
     * @default 0
     * @type {number}
     */
    x: number;
    /**
     * Vertical layer offset in tiles
     * @default 0
     * @type {number}
     */
    y: number;
    /**
     * The Layer corresponding Tilesets
     * @type {TMXTilesetGroup}
     */
    tilesets: TMXTilesetGroup;
    tileset: any;
    maxTileSize: {
        width: number;
        height: number;
    };
    /**
     * All animated tilesets in this layer
     * @type {TMXTileset[]}
     */
    animatedTilesets: TMXTileset[];
    /**
     * Layer contains tileset animations
     * @type {boolean}
     */
    isAnimated: boolean;
    /**
     * the order in which tiles on orthogonal tile layers are rendered.
     * (valid values are "left-down", "left-up", "right-down", "right-up")
     * @type {string}
     * @default "right-down"
     */
    renderorder: string;
    /**
     * the layer class
     * @type {string}
     */
    class: string;
    name: any;
    cols: number;
    rows: number;
    layerData: any[];
    onActivateEvent(): void;
    preRender: any;
    canvasRenderer: any;
    onDeactivateEvent(): void;
    /**
     * Set the TMX renderer for this layer object
     * @param {TMXRenderer} renderer
     * @example
     * // use the parent map default renderer
     * let layer = new me.TMXLayer(...);
     * layer.setRenderer(map.getRenderer());
     */
    setRenderer(renderer: TMXRenderer): void;
    renderer: any;
    /**
     * Return the layer current renderer object
     * @returns {TMXRenderer} renderer
     */
    getRenderer(): TMXRenderer;
    /**
     * Return the TileId of the Tile at the specified position
     * @param {number} x - X coordinate (in world/pixels coordinates)
     * @param {number} y - Y coordinate (in world/pixels coordinates)
     * @returns {number} TileId or null if there is no Tile at the given position
     */
    getTileId(x: number, y: number): number;
    /**
     * Return the Tile object at the specified position
     * @param {number} x - X coordinate (in world/pixels coordinates)
     * @param {number} y - Y coordinate (in world/pixels coordinates)
     * @returns {Tile} corresponding tile or null if there is no defined tile at the coordinate or if outside of the layer bounds
     * @example
     * // get the TMX Map Layer called "Front layer"
     * let layer = me.game.world.getChildByName("Front Layer")[0];
     * // get the tile object corresponding to the latest pointer position
     * let tile = layer.getTile(me.input.pointer.x, me.input.pointer.y);
     */
    getTile(x: number, y: number): Tile;
    /**
     * assign the given Tile object to the specified position
     * @param {Tile} tile - the tile object to be assigned
     * @param {number} x - x coordinate (in world/pixels coordinates)
     * @param {number} y - y coordinate (in world/pixels coordinates)
     * @returns {Tile} the tile object
     */
    setTile(tile: Tile, x: number, y: number): Tile;
    /**
     * return a new the Tile object corresponding to the given tile id
     * @param {number} tileId - tileId
     * @param {number} x - X coordinate (in world/pixels coordinates)
     * @param {number} y - Y coordinate (in world/pixels coordinates)
     * @returns {Tile} the tile object
     */
    getTileById(tileId: number, x: number, y: number): Tile;
    /**
     * Return the Tile object at the specified tile coordinates
     * @param {number} x - x position of the tile (in Tile unit)
     * @param {number} y - x position of the tile (in Tile unit)
     * @param {number} [boundsCheck=true] - check first if within the layer bounds
     * @returns {Tile} corresponding tile or null if there is no defined tile at the position or if outside of the layer bounds
     * @example
     * // return the first tile at offset 0, 0
     * let tile = layer.cellAt(0, 0);
     */
    cellAt(x: number, y: number, boundsCheck?: number | undefined): Tile;
    /**
     * clear the tile at the specified position
     * @param {number} x - X coordinate (in map coordinates: row/column)
     * @param {number} y - Y coordinate (in map coordinates: row/column)
     * @example
     * me.game.world.getChildByType(me.TMXLayer).forEach(function(layer) {
     *     // clear all tiles at the given x,y coordinates
     *     layer.clearTile(x, y);
     * });
     */
    clearTile(x: number, y: number): void;
    /**
     * update animations in a tileset layer
     * @ignore
     */
    update(dt: any): boolean;
    /**
     * draw a tileset layer
     * @ignore
     */
    draw(renderer: any, rect: any): void;
}
import Renderable from "./../../renderable/renderable.js";
import Tile from "./TMXTile.js";
