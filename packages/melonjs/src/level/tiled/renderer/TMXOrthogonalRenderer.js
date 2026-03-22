import { vector2dPool } from "../../../math/vector2d.ts";
import TMXRenderer from "./TMXRenderer.js";

/**
 * an Orthogonal Map Renderder
 * @category Tilemap
 */
export default class TMXOrthogonalRenderer extends TMXRenderer {
	/**
	 * @param {TMXTileMap} map - the TMX map
	 */
	constructor(map) {
		super(map.cols, map.rows, map.tilewidth, map.tileheight);
	}

	/**
	 * return true if the renderer can render the specified layer
	 * @ignore
	 */
	canRender(layer) {
		return layer.orientation === "orthogonal" && super.canRender(layer);
	}

	/**
	 * return the tile position corresponding to the specified pixel
	 * @ignore
	 */
	pixelToTileCoords(x, y, v) {
		const ret = v || vector2dPool.get();
		return ret.set(x / this.tilewidth, y / this.tileheight);
	}

	/**
	 * return the pixel position corresponding of the specified tile
	 * @ignore
	 */
	tileToPixelCoords(x, y, v) {
		const ret = v || vector2dPool.get();
		return ret.set(x * this.tilewidth, y * this.tileheight);
	}

	/**
	 * draw the tile map
	 * @ignore
	 */
	drawTile(renderer, x, y, tmxTile) {
		const tileset = tmxTile.tileset;
		// draw the tile
		tileset.drawTile(
			renderer,
			tileset.tileoffset.x + x * this.tilewidth,
			tileset.tileoffset.y + (y + 1) * this.tileheight - tileset.tileheight,
			tmxTile,
		);
	}

	/**
	 * draw the tile map
	 * @ignore
	 */
	drawTileLayer(renderer, layer, rect) {
		let incX = 1;
		let incY = 1;

		// get top-left and bottom-right tile position
		const start = this.pixelToTileCoords(
			Math.max(rect.pos.x - (layer.maxTileSize.width - layer.tilewidth), 0),
			Math.max(rect.pos.y - (layer.maxTileSize.height - layer.tileheight), 0),
			vector2dPool.get(),
		).floorSelf();

		const end = this.pixelToTileCoords(
			rect.pos.x + rect.width + this.tilewidth,
			rect.pos.y + rect.height + this.tileheight,
			vector2dPool.get(),
		).ceilSelf();

		//ensure we are in the valid tile range
		end.x = Math.min(end.x, this.cols);
		end.y = Math.min(end.y, this.rows);

		switch (layer.renderorder) {
			case "right-up":
				// swapping start.y and end.y
				end.y = start.y + (start.y = end.y) - end.y;
				incY = -1;
				break;
			case "left-down":
				// swapping start.x and end.x
				end.x = start.x + (start.x = end.x) - end.x;
				incX = -1;
				break;
			case "left-up":
				// swapping start.x and end.x
				end.x = start.x + (start.x = end.x) - end.x;
				// swapping start.y and end.y
				end.y = start.y + (start.y = end.y) - end.y;
				incX = -1;
				incY = -1;
				break;
			default: // right-down
				break;
		}

		// main drawing loop
		for (let y = start.y; y !== end.y; y += incY) {
			for (let x = start.x; x !== end.x; x += incX) {
				const tmxTile = layer.cellAt(x, y, false);
				if (tmxTile) {
					this.drawTile(renderer, x, y, tmxTile);
				}
			}
		}

		vector2dPool.release(start);
		vector2dPool.release(end);
	}
}
