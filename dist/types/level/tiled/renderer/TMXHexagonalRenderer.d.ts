/**
 * @classdesc
 * an Hexagonal Map Renderder
 * @augments TMXRenderer
 */
export default class TMXHexagonalRenderer extends TMXRenderer {
    /**
     * @param {TMXTileMap} map - the TMX map
     */
    constructor(map: TMXTileMap);
    hexsidelength: any;
    staggerX: boolean;
    staggerEven: boolean;
    sidelengthx: any;
    sidelengthy: any;
    sideoffsetx: number;
    sideoffsety: number;
    columnwidth: any;
    rowheight: any;
    centers: Vector2d[];
    /**
     * return true if the renderer can render the specified layer
     * @ignore
     */
    canRender(layer: any): boolean;
    /**
     * return the bounding rect for this map renderer
     * @ignore
     */
    getBounds(layer: any): object;
    /**
     * @ignore
     */
    doStaggerX(x: any): number | false;
    /**
     * @ignore
     */
    doStaggerY(y: any): number | false;
    /**
     * @ignore
     */
    topLeft(x: any, y: any, v: any): any;
    /**
     * @ignore
     */
    topRight(x: any, y: any, v: any): any;
    /**
     * @ignore
     */
    bottomLeft(x: any, y: any, v: any): any;
    /**
     * @ignore
     */
    bottomRight(x: any, y: any, v: any): any;
    /**
     * return the tile position corresponding to the specified pixel
     * @ignore
     */
    pixelToTileCoords(x: any, y: any, v: any): any;
    /**
     * return the pixel position corresponding of the specified tile
     * @ignore
     */
    tileToPixelCoords(x: any, y: any, v: any): any;
    /**
     * fix the position of Objects to match
     * the way Tiled places them
     * @ignore
     */
    adjustPosition(obj: any): void;
    /**
     * draw the tile map
     * @ignore
     */
    drawTile(renderer: any, x: any, y: any, tmxTile: any): void;
    /**
     * draw the tile map
     * @ignore
     */
    drawTileLayer(renderer: any, layer: any, rect: any): void;
}
import TMXRenderer from "./TMXRenderer.js";
import Vector2d from "./../../../math/vector2.js";
