import Vector2d from "./../../../math/vector2.js";
import pool from "./../../../system/pooling.js";
import TMXHexagonalRenderer from "./TMXHexagonalRenderer.js";
import { degToRad } from "./../../../math/math.js";


/**
 * @classdesc
 * a Staggered Map Renderder
 * @class TMXStaggeredRenderer
 * @memberof me
 * @augments me.TMXHexagonalRenderer
 * @param {me.TMXTileMap} map the TMX map
 */
class TMXStaggeredRenderer extends TMXHexagonalRenderer {

    /**
     * return true if the renderer can render the specified layer
     * @ignore
     */
    canRender(layer) {
        return (
            (layer.orientation === "staggered") &&
            super.canRender(layer)
        );
    }

    /**
     * return the tile position corresponding to the specified pixel
     * @ignore
     */
    pixelToTileCoords(x, y, v) {
        var ret = v || new Vector2d();

        var alignedX = x,
            alignedY = y;

        if (this.staggerX) {
            alignedX -= this.staggerEven ? this.sideoffsetx : 0;
        } else {
            alignedY -= this.staggerEven ? this.sideoffsety : 0;
        }

        // Start with the coordinates of a grid-aligned tile
        var referencePoint = pool.pull("Vector2d",
            Math.floor(alignedX / this.tilewidth),
            Math.floor(alignedY / this.tileheight)
        );

        // Adjust the reference point to the correct tile coordinates
        if (this.staggerX) {
            referencePoint.x = referencePoint.x * 2;
            if (this.staggerEven) {
                ++referencePoint.x;
            }
        } else {
            referencePoint.y = referencePoint.y * 2;
            if (this.staggerEven) {
                ++referencePoint.y;
            }
        }

        // Relative x and y position on the base square of the grid-aligned tile
        var rel = pool.pull("Vector2d",
            alignedX - referencePoint.x * this.tilewidth,
            alignedY - referencePoint.y * this.tileheight
        );

        // Check whether the cursor is in any of the corners (neighboring tiles)
        var y_pos = rel.x * (this.tileheight / this.tilewidth);

        if (this.sideoffsety - y_pos > rel.y) {
            referencePoint = this.topLeft(referencePoint.x, referencePoint.y, referencePoint);
        }
        if (-this.sideoffsety + y_pos > rel.y) {
            referencePoint = this.topRight(referencePoint.x, referencePoint.y, referencePoint);
        }
        if (this.sideoffsety + y_pos < rel.y) {
            referencePoint = this.bottomLeft(referencePoint.x, referencePoint.y, referencePoint);
        }
        if (this.sideoffsety * 3 - y_pos < rel.y) {
            referencePoint = this.bottomRight(referencePoint.x, referencePoint.y, referencePoint);
        }

        ret = this.tileToPixelCoords(referencePoint.x, referencePoint.y, ret);

        ret.set(x - ret.x, y - ret.y);

        // Start with the coordinates of a grid-aligned tile
        ret.set(
            ret.x - (this.tilewidth / 2),
            ret.y * (this.tilewidth / this.tileheight)
        );

        ret.div(this.tilewidth / Math.sqrt(2)).rotate(degToRad(-45)).add(referencePoint);

        pool.push(referencePoint);
        pool.push(rel);

        return ret;
    }
};

export default TMXStaggeredRenderer;
