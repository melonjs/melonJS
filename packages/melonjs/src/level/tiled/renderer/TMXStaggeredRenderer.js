import { degToRad } from "./../../../math/math.ts";
import { vector2dPool } from "../../../math/vector2d.ts";
import TMXHexagonalRenderer from "./TMXHexagonalRenderer.js";

/**
 * a Staggered Map Renderer
 * @category Tilemap
 */
export default class TMXStaggeredRenderer extends TMXHexagonalRenderer {
	/**
	 * return true if the renderer can render the specified layer
	 * @ignore
	 * @internal
	 */
	canRender(layer) {
		return layer.orientation === "staggered" && super.canRender(layer);
	}

	/**
	 * return the tile position corresponding to the specified pixel: the
	 * column and row of the tile whose diamond holds it, plus where in that
	 * diamond it is (each in [0, 1)), so that rounded down it is the tile.
	 * As Tiled's `StaggeredRenderer::screenToTileCoords`
	 * @ignore
	 * @internal
	 */
	pixelToTileCoords(x, y, v) {
		let ret = v || vector2dPool.get();

		let alignedX = x;
		let alignedY = y;

		if (this.staggerX) {
			alignedX -= this.staggerEven ? this.sideoffsetx : 0;
		} else {
			alignedY -= this.staggerEven ? this.sideoffsety : 0;
		}

		// Start with the coordinates of a grid-aligned tile
		let referencePoint = vector2dPool.get(
			Math.floor(alignedX / this.tilewidth),
			Math.floor(alignedY / this.tileheight),
		);

		// Relative x and y position on the base square of the grid-aligned
		// tile, measured before the reference point becomes a tile's column
		// and row below (the square of row 1 is the tile of row 2)
		const relX = alignedX - referencePoint.x * this.tilewidth;
		const relY = alignedY - referencePoint.y * this.tileheight;

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

		// Check whether the cursor is in any of the corners (neighboring
		// tiles): the square holds its tile's diamond, and a corner of each
		// of four neighbours, one at most
		const y_pos = relX * (this.tileheight / this.tilewidth);

		if (this.sideoffsety - y_pos > relY) {
			referencePoint = this.topLeft(
				referencePoint.x,
				referencePoint.y,
				referencePoint,
			);
		} else if (-this.sideoffsety + y_pos > relY) {
			referencePoint = this.topRight(
				referencePoint.x,
				referencePoint.y,
				referencePoint,
			);
		} else if (this.sideoffsety + y_pos < relY) {
			referencePoint = this.bottomLeft(
				referencePoint.x,
				referencePoint.y,
				referencePoint,
			);
		} else if (this.sideoffsety * 3 - y_pos < relY) {
			referencePoint = this.bottomRight(
				referencePoint.x,
				referencePoint.y,
				referencePoint,
			);
		}

		ret = this.tileToPixelCoords(referencePoint.x, referencePoint.y, ret);

		ret.set(x - ret.x, y - ret.y);

		// Start with the coordinates of a grid-aligned tile
		ret.set(
			ret.x - this.tilewidth / 2,
			ret.y * (this.tilewidth / this.tileheight),
		);

		ret
			.div(this.tilewidth / Math.sqrt(2))
			.rotate(degToRad(-45))
			.add(referencePoint);

		vector2dPool.release(referencePoint);

		return ret;
	}
}
