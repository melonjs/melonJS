import { Vector2d, vector2dPool } from "../../../math/vector2d.ts";
import TMXHexagonalRenderer from "./TMXHexagonalRenderer.js";
import { degToRad } from "./../../../math/math.ts";

/**
 * a Staggered Map Renderder
 */
export default class TMXStaggeredRenderer extends TMXHexagonalRenderer {
	/**
	 * return true if the renderer can render the specified layer
	 * @ignore
	 */
	canRender(layer) {
		return layer.orientation === "staggered" && super.canRender(layer);
	}

	/**
	 * return the tile position corresponding to the specified pixel
	 * @ignore
	 */
	pixelToTileCoords(x, y, v) {
		let ret = v || new Vector2d();

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
		const rel = vector2dPool.get(
			alignedX - referencePoint.x * this.tilewidth,
			alignedY - referencePoint.y * this.tileheight,
		);

		// Check whether the cursor is in any of the corners (neighboring tiles)
		const y_pos = rel.x * (this.tileheight / this.tilewidth);

		if (this.sideoffsety - y_pos > rel.y) {
			referencePoint = this.topLeft(
				referencePoint.x,
				referencePoint.y,
				referencePoint,
			);
		}
		if (-this.sideoffsety + y_pos > rel.y) {
			referencePoint = this.topRight(
				referencePoint.x,
				referencePoint.y,
				referencePoint,
			);
		}
		if (this.sideoffsety + y_pos < rel.y) {
			referencePoint = this.bottomLeft(
				referencePoint.x,
				referencePoint.y,
				referencePoint,
			);
		}
		if (this.sideoffsety * 3 - y_pos < rel.y) {
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
		vector2dPool.release(rel);

		return ret;
	}
}
