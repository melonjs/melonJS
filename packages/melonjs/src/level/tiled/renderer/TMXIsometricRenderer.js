import { vector2dPool } from "../../../math/vector2d.ts";
import { boundsPool } from "../../../physics/bounds.ts";
import TMXLayer from "./../TMXLayer.js";
import TMXRenderer from "./TMXRenderer.js";

/**
 * an Isometric Map Renderer
 * @category Tilemap
 */
export default class TMXIsometricRenderer extends TMXRenderer {
	/**
	 * @param {TMXTileMap} map - the TMX map
	 */
	constructor(map) {
		super(map.cols, map.rows, map.tilewidth, map.tileheight);

		this.hTilewidth = this.tilewidth / 2;
		this.hTileheight = this.tileheight / 2;
		this.originX = this.rows * this.hTilewidth;
	}

	/**
	 * return true if the renderer can render the specified layer
	 * @ignore
	 */
	canRender(layer) {
		return layer.orientation === "isometric" && super.canRender(layer);
	}

	/**
	 * return the bounding rect for this map renderer
	 * @ignore
	 */
	getBounds(layer) {
		const bounds = layer instanceof TMXLayer ? boundsPool.get() : this.bounds;
		bounds.setMinMax(
			0,
			0,
			(this.cols + this.rows) * (this.tilewidth / 2),
			(this.cols + this.rows) * (this.tileheight / 2),
		);
		return bounds;
	}

	/**
	 * return the tile position corresponding to the specified pixel
	 * @ignore
	 */
	pixelToTileCoords(x, y, v) {
		const ret = v || vector2dPool.get();
		return ret.set(
			y / this.tileheight + (x - this.originX) / this.tilewidth,
			y / this.tileheight - (x - this.originX) / this.tilewidth,
		);
	}

	/**
	 * return the pixel position corresponding of the specified tile
	 * @ignore
	 */
	tileToPixelCoords(x, y, v) {
		const ret = v || vector2dPool.get();
		return ret.set(
			(x - y) * this.hTilewidth + this.originX,
			(x + y) * this.hTileheight,
		);
	}

	/**
	 * fix the position of Objects to match
	 * the way Tiled places them
	 * @ignore
	 */
	adjustPosition(obj) {
		const tileX = obj.x / this.hTilewidth;
		const tileY = obj.y / this.tileheight;
		const isoPos = vector2dPool.get();

		this.tileToPixelCoords(tileX, tileY, isoPos);

		obj.x = isoPos.x;
		obj.y = isoPos.y;

		vector2dPool.release(isoPos);
	}

	/**
	 * draw the tile map (legacy entry point — accepts a fully-constructed Tile)
	 * @ignore
	 */
	drawTile(renderer, x, y, tmxTile) {
		const tileset = tmxTile.tileset;
		// draw the tile
		tileset.drawTile(
			renderer,
			((this.cols - 1) * tileset.tilewidth + (x - y) * tileset.tilewidth) >> 1,
			(-tileset.tilewidth + (x + y) * tileset.tileheight) >> 2,
			tmxTile,
		);
	}

	/**
	 * draw a tile from raw (gid, flipMask, tileset) data — used by the hot
	 * rendering loop to bypass Tile construction
	 * @ignore
	 */
	drawTileRaw(renderer, x, y, gid, flipMask, tileset) {
		tileset.drawTileRaw(
			renderer,
			((this.cols - 1) * tileset.tilewidth + (x - y) * tileset.tilewidth) >> 1,
			(-tileset.tilewidth + (x + y) * tileset.tileheight) >> 2,
			gid,
			flipMask,
		);
	}

	/**
	 * draw the tile map
	 * @ignore
	 */
	drawTileLayer(renderer, layer, rect) {
		// cache a couple of useful references
		let tileset = layer.tileset;

		// get top-left and bottom-right tile position
		const rowItr = this.pixelToTileCoords(
			rect.pos.x - tileset.tilewidth,
			rect.pos.y - tileset.tileheight,
			vector2dPool.get(),
		).floorSelf();
		const tileEnd = this.pixelToTileCoords(
			rect.pos.x + rect.width + tileset.tilewidth,
			rect.pos.y + rect.height + tileset.tileheight,
			vector2dPool.get(),
		).ceilSelf();

		const rectEnd = this.tileToPixelCoords(
			tileEnd.x,
			tileEnd.y,
			vector2dPool.get(),
		);

		// Determine the tile and pixel coordinates to start at
		const startPos = this.tileToPixelCoords(
			rowItr.x,
			rowItr.y,
			vector2dPool.get(),
		);
		startPos.x -= this.hTilewidth;
		startPos.y += this.tileheight;

		/* Determine in which half of the tile the top-left corner of the area we
		 * need to draw is. If we're in the upper half, we need to start one row
		 * up due to those tiles being visible as well. How we go up one row
		 * depends on whether we're in the left or right half of the tile.
		 */
		const inUpperHalf = startPos.y - rect.pos.y > this.hTileheight;
		const inLeftHalf = rect.pos.x - startPos.x < this.hTilewidth;

		if (inUpperHalf) {
			if (inLeftHalf) {
				rowItr.x--;
				startPos.x -= this.hTilewidth;
			} else {
				rowItr.y--;
				startPos.x += this.hTilewidth;
			}
			startPos.y -= this.hTileheight;
		}

		// Determine whether the current row is shifted half a tile to the right
		let shifted = inUpperHalf ^ inLeftHalf;

		// initialize the columnItr vector
		const columnItr = vector2dPool.get().setV(rowItr);

		// main drawing loop — read (gid, flipMask) straight from the typed
		// array and resolve the tileset with a short-circuit cache.
		// NOTE: the iso hot loop bypasses `this.drawTileRaw` because it has
		// already computed pixel coords (`x`, `y/2`) from the staggered scan;
		// going through drawTileRaw would re-derive them from layer-cell coords
		// and lose the precomputation.
		const layerCols = layer.cols;
		const layerRows = layer.rows;
		const data = layer.layerData;
		const tilesets = layer.tilesets;
		let tilesetCache = tileset;
		if (tilesetCache === null) {
			vector2dPool.release(columnItr);
			vector2dPool.release(rowItr);
			vector2dPool.release(tileEnd);
			vector2dPool.release(rectEnd);
			vector2dPool.release(startPos);
			return;
		}
		for (
			let y = startPos.y * 2;
			y - this.tileheight * 2 < rectEnd.y * 2;
			y += this.tileheight
		) {
			columnItr.setV(rowItr);
			for (let x = startPos.x; x < rectEnd.x; x += this.tilewidth) {
				const cx = columnItr.x;
				const cy = columnItr.y;
				// bounds check (this loop didn't disable it in the old path)
				if (cx >= 0 && cx < layerCols && cy >= 0 && cy < layerRows) {
					const idx = (cy * layerCols + cx) * 2;
					const gid = data[idx];
					if (gid !== 0) {
						const flipMask = data[idx + 1];
						if (!tilesetCache.contains(gid)) {
							tilesetCache = tilesets.getTilesetByGid(gid);
						}
						const offset = tilesetCache.tileoffset;
						tilesetCache.drawTileRaw(
							renderer,
							offset.x + x,
							offset.y + y / 2 - tilesetCache.tileheight,
							gid,
							flipMask,
						);
					}
				}

				// Advance to the next column
				columnItr.x++;
				columnItr.y--;
			}

			// Advance to the next row
			if (!shifted) {
				rowItr.x++;
				startPos.x += this.hTilewidth;
				shifted = true;
			} else {
				rowItr.y++;
				startPos.x -= this.hTilewidth;
				shifted = false;
			}
		}

		vector2dPool.release(columnItr);
		vector2dPool.release(rowItr);
		vector2dPool.release(tileEnd);
		vector2dPool.release(rectEnd);
		vector2dPool.release(startPos);
	}
}
