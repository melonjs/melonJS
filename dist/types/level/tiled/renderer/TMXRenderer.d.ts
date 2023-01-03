/**
 * @classdesc
 * The map renderer base class
 */
export default class TMXRenderer {
    /**
     * @param {number} cols - width of the tilemap in tiles
     * @param {number} rows - height of the tilemap in tiles
     * @param {number} tilewidth - width of each tile in pixels
     * @param {number} tileheight - height of each tile in pixels
     */
    constructor(cols: number, rows: number, tilewidth: number, tileheight: number);
    cols: number;
    rows: number;
    tilewidth: number;
    tileheight: number;
    bounds: Bounds;
    /**
     * return true if the renderer can render the specified map or layer
     * @param {TMXTileMap|TMXLayer} component - TMX Map or Layer
     * @returns {boolean}
     */
    canRender(component: TMXTileMap | TMXLayer): boolean;
    /**
     * return the bounding rect for this map renderer
     * @param {TMXLayer} [layer] - calculate the bounding rect for a specific layer (will return a new bounds object)
     * @returns {Bounds}
     */
    getBounds(layer?: TMXLayer | undefined): Bounds;
    /**
     * return the tile position corresponding to the specified pixel
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Vector2d} [v] - an optional vector object where to put the return values
     * @returns {Vector2d}
     */
    pixelToTileCoords(x: number, y: number, v?: any): Vector2d;
    /**
     * return the pixel position corresponding of the specified tile
     * @param {number} col - tile horizontal position
     * @param {number} row - tile vertical position
     * @param {Vector2d} [v] - an optional vector object where to put the return values
     * @returns {Vector2d}
     */
    tileToPixelCoords(col: number, row: number, v?: any): Vector2d;
    /**
     * draw the given tile at the specified layer
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer object
     * @param {number} x - X coordinate where to draw the tile
     * @param {number} y - Y coordinate where to draw the tile
     * @param {Tile} tile - the tile object to draw
     */
    drawTile(renderer: CanvasRenderer | WebGLRenderer, x: number, y: number, tile: Tile): void;
    /**
     * draw the given TMX Layer for the given area
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer object
     * @param {TMXLayer} layer - a TMX Layer object
     * @param {Rect} rect - the area of the layer to draw
     */
    drawTileLayer(renderer: CanvasRenderer | WebGLRenderer, layer: TMXLayer, rect: Rect): void;
}
import Bounds from "./../../../physics/bounds.js";
import TMXLayer from "./../TMXLayer.js";
