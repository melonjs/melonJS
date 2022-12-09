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
     * The Layer corresponding Tilesets
     * @public
     * @type {TMXTilesetGroup}
     * @name TMXLayer#tilesets
     */
    public tilesets: TMXTilesetGroup;
    tileset: any;
    maxTileSize: {
        width: number;
        height: number;
    };
    /**
     * All animated tilesets in this layer
     * @ignore
     * @type {TMXTileset[]}
     * @name TMXLayer#animatedTilesets
     */
    animatedTilesets: TMXTileset[];
    /**
     * Layer contains tileset animations
     * @public
     * @type {boolean}
     * @name TMXLayer#isAnimated
     */
    public isAnimated: boolean;
    /**
     * the order in which tiles on orthogonal tile layers are rendered.
     * (valid values are "left-down", "left-up", "right-down", "right-up")
     * @public
     * @type {string}
     * @default "right-down"
     * @name TMXLayer#renderorder
     */
    public renderorder: string;
    /**
     * the layer class
     * @public
     * @type {string}
     * @name class
     * @name TMXLayer#class
     */
    public class: string;
    name: any;
    cols: number;
    rows: number;
    preRender: boolean;
    onActivateEvent(): void;
    canvasRenderer: CanvasRenderer | undefined;
    onDeactivateEvent(): void;
    /**
     * Set the TMX renderer for this layer object
     * @name setRenderer
     * @memberof TMXLayer
     * @public
     * @param {TMXRenderer} renderer
     * @example
     * // use the parent map default renderer
     * var layer = new me.TMXLayer(...);
     * layer.setRenderer(map.getRenderer());
     */
    public setRenderer(renderer: TMXRenderer): void;
    renderer: any;
    /**
     * Return the layer current renderer object
     * @name getRenderer
     * @memberof TMXLayer
     * @public
     * @returns {TMXRenderer} renderer
     */
    public getRenderer(): TMXRenderer;
    /**
     * Return the TileId of the Tile at the specified position
     * @name getTileId
     * @memberof TMXLayer
     * @public
     * @param {number} x - X coordinate (in world/pixels coordinates)
     * @param {number} y - Y coordinate (in world/pixels coordinates)
     * @returns {number} TileId or null if there is no Tile at the given position
     */
    public getTileId(x: number, y: number): number;
    /**
     * Return the Tile object at the specified position
     * @name getTile
     * @memberof TMXLayer
     * @public
     * @param {number} x - X coordinate (in world/pixels coordinates)
     * @param {number} y - Y coordinate (in world/pixels coordinates)
     * @returns {Tile} corresponding tile or null if there is no defined tile at the coordinate or if outside of the layer bounds
     * @example
     * // get the TMX Map Layer called "Front layer"
     * var layer = me.game.world.getChildByName("Front Layer")[0];
     * // get the tile object corresponding to the latest pointer position
     * var tile = layer.getTile(me.input.pointer.x, me.input.pointer.y);
     */
    public getTile(x: number, y: number): Tile;
    /**
     * assign the given Tile object to the specified position
     * @name getTile
     * @memberof TMXLayer
     * @public
     * @param {Tile} tile - the tile object to be assigned
     * @param {number} x - x coordinate (in world/pixels coordinates)
     * @param {number} y - y coordinate (in world/pixels coordinates)
     * @returns {Tile} the tile object
     */
    public setTile(tile: Tile, x: number, y: number): Tile;
    /**
     * return a new the Tile object corresponding to the given tile id
     * @name setTile
     * @memberof TMXLayer
     * @public
     * @param {number} tileId - tileId
     * @param {number} x - X coordinate (in world/pixels coordinates)
     * @param {number} y - Y coordinate (in world/pixels coordinates)
     * @returns {Tile} the tile object
     */
    public getTileById(tileId: number, x: number, y: number): Tile;
    /**
     * Return the Tile object at the specified tile coordinates
     * @name cellAt
     * @memberof TMXLayer
     * @public
     * @param {number} x - x position of the tile (in Tile unit)
     * @param {number} y - x position of the tile (in Tile unit)
     * @param {number} [boundsCheck=true] - check first if within the layer bounds
     * @returns {Tile} corresponding tile or null if there is no defined tile at the position or if outside of the layer bounds
     * @example
     * // return the first tile at offset 0, 0
     * var tile = layer.cellAt(0, 0);
     */
    public cellAt(x: number, y: number, boundsCheck?: number | undefined): Tile;
    /**
     * clear the tile at the specified position
     * @name clearTile
     * @memberof TMXLayer
     * @public
     * @param {number} x - X coordinate (in map coordinates: row/column)
     * @param {number} y - Y coordinate (in map coordinates: row/column)
     * @example
     * me.game.world.getChildByType(me.TMXLayer).forEach(function(layer) {
     *     // clear all tiles at the given x,y coordinates
     *     layer.clearTile(x, y);
     * });
     */
    public clearTile(x: number, y: number): void;
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
import CanvasRenderer from "./../../video/canvas/canvas_renderer";
import Tile from "./TMXTile.js";
