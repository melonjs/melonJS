/* eslint-disable no-unused-vars */

import pool from "./../../../system/pooling.js";
import TMXLayer from "./../TMXLayer.js";
import Bounds from "./../../../physics/bounds.js";

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
    constructor(cols, rows, tilewidth, tileheight) {
        this.cols = cols;
        this.rows = rows;
        this.tilewidth = tilewidth;
        this.tileheight = tileheight;
        this.bounds = new Bounds();
    }

    /**
     * return true if the renderer can render the specified map or layer
     * @param {TMXTileMap|TMXLayer} component - TMX Map or Layer
     * @returns {boolean}
     */
    canRender(component) {
        return (
            /*
            // layers can have different size within
            // the same maps, so commenting these two lines
            (this.cols === component.cols) &&
            (this.rows === component.rows) &&
            */
            (this.tilewidth === component.tilewidth) &&
            (this.tileheight === component.tileheight)
        );
    }

    /**
     * return the bounding rect for this map renderer
     * @param {TMXLayer} [layer] - calculate the bounding rect for a specific layer (will return a new bounds object)
     * @returns {Bounds}
     */
    getBounds(layer) {
        let bounds = layer instanceof TMXLayer ? pool.pull("Bounds") : this.bounds;
        bounds.setMinMax(
            0, 0,
            this.cols * this.tilewidth,
            this.rows * this.tileheight
        );
        return bounds;
    }

    /**
     * return the tile position corresponding to the specified pixel
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Vector2d} [v] - an optional vector object where to put the return values
     * @returns {Vector2d}
     */
    pixelToTileCoords(x, y, v) {
        return v;
    }

    /**
     * return the pixel position corresponding of the specified tile
     * @param {number} col - tile horizontal position
     * @param {number} row - tile vertical position
     * @param {Vector2d} [v] - an optional vector object where to put the return values
     * @returns {Vector2d}
     */
    tileToPixelCoords(col, row, v) {
        return v;
    }

    /**
     * draw the given tile at the specified layer
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer object
     * @param {number} x - X coordinate where to draw the tile
     * @param {number} y - Y coordinate where to draw the tile
     * @param {Tile} tile - the tile object to draw
     */
    drawTile(renderer, x, y, tile) {
    }

    /**
     * draw the given TMX Layer for the given area
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer object
     * @param {TMXLayer} layer - a TMX Layer object
     * @param {Rect} rect - the area of the layer to draw
     */
    drawTileLayer(renderer, layer, rect) {
    }

}


/* eslint-enable no-unused-vars */
