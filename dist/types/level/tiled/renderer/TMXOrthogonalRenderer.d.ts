/**
 * @classdesc
 * an Orthogonal Map Renderder
 * @augments TMXRenderer
 */
export default class TMXOrthogonalRenderer extends TMXRenderer {
    /**
     * @param {TMXTileMap} map - the TMX map
     */
    constructor(map: TMXTileMap);
    /**
     * return true if the renderer can render the specified layer
     * @ignore
     */
    canRender(layer: any): boolean;
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
