import { vector2dPool } from "../../../math/vector2d.ts";
import { boundsPool } from "../../../physics/bounds.ts";
import TMXLayer from "./../TMXLayer.js";
import TMXOrthogonalRenderer from "./TMXOrthogonalRenderer.js";

/**
 * an Oblique Map Renderer (Tiled 1.12+)
 * Extends the orthogonal renderer with a 2D shear transform
 * controlled by the map's skewx/skewy attributes.
 * @category Tilemap
 */
export default class TMXObliqueRenderer extends TMXOrthogonalRenderer {
	/**
	 * @param {TMXTileMap} map - the TMX map
	 */
	constructor(map) {
		super(map);

		/**
		 * horizontal pixel offset per tile row
		 * @type {number}
		 */
		this.skewX = map.skewx;

		/**
		 * vertical pixel offset per tile column
		 * @type {number}
		 */
		this.skewY = map.skewy;

		/**
		 * horizontal shear factor (skewX / tileheight)
		 * @type {number}
		 */
		this.shearX = this.tileheight !== 0 ? this.skewX / this.tileheight : 0;

		/**
		 * vertical shear factor (skewY / tilewidth)
		 * @type {number}
		 */
		this.shearY = this.tilewidth !== 0 ? this.skewY / this.tilewidth : 0;

		/**
		 * determinant of the shear matrix (for inverse transform)
		 * @type {number}
		 */
		this._det = 1 - this.shearX * this.shearY;
	}

	/**
	 * return true if the renderer can render the specified layer
	 * @ignore
	 */
	canRender(layer) {
		return (
			layer.orientation === "oblique" &&
			this.tilewidth === layer.tilewidth &&
			this.tileheight === layer.tileheight
		);
	}

	/**
	 * return the bounding rect for this map renderer
	 * @param {TMXLayer} [layer] - calculate the bounding rect for a specific layer
	 * @returns {Bounds}
	 */
	getBounds(layer) {
		const bounds = layer instanceof TMXLayer ? boundsPool.get() : this.bounds;
		const cols = layer instanceof TMXLayer ? layer.cols : this.cols;
		const rows = layer instanceof TMXLayer ? layer.rows : this.rows;
		const w = cols * this.tilewidth;
		const h = rows * this.tileheight;

		// the sheared rectangle forms a parallelogram; compute its AABB
		// corners: (0,0), (w, skewY*cols), (skewX*rows, h), (w+skewX*rows, h+skewY*cols)
		const sx = this.skewX * rows;
		const sy = this.skewY * cols;

		const minX = Math.min(0, sx, sy * this.shearX, w + sx);
		const minY = Math.min(0, sy, sx * this.shearY, h + sy);
		const maxX = Math.max(0, w, w + sx, sx);
		const maxY = Math.max(0, h, h + sy, sy);

		bounds.setMinMax(minX, minY, maxX, maxY);
		return bounds;
	}

	/**
	 * return the tile position corresponding to the specified pixel
	 * @ignore
	 */
	pixelToTileCoords(x, y, v) {
		const ret = v || vector2dPool.get();
		// inverse shear: [1, -shearX; -shearY, 1] / det
		const px = (x - this.shearX * y) / this._det;
		const py = (y - this.shearY * x) / this._det;
		return ret.set(px / this.tilewidth, py / this.tileheight);
	}

	/**
	 * return the pixel position corresponding of the specified tile
	 * @ignore
	 */
	tileToPixelCoords(x, y, v) {
		const ret = v || vector2dPool.get();
		const px = x * this.tilewidth;
		const py = y * this.tileheight;
		// apply shear
		return ret.set(px + this.shearX * py, this.shearY * px + py);
	}

	/**
	 * draw the tile map (legacy entry point — accepts a fully-constructed Tile)
	 * @ignore
	 */
	drawTile(renderer, x, y, tmxTile) {
		const tileset = tmxTile.tileset;
		// compute screen position with skew offset
		const dx = tileset.tileoffset.x + x * this.tilewidth + this.skewX * y;
		const dy =
			tileset.tileoffset.y +
			(y + 1) * this.tileheight -
			tileset.tileheight +
			this.skewY * x;
		tileset.drawTile(renderer, dx, dy, tmxTile);
	}

	/**
	 * draw a tile from raw (gid, flipMask, tileset) data — used by the hot
	 * rendering loop to bypass Tile construction
	 * @ignore
	 */
	drawTileRaw(renderer, x, y, gid, flipMask, tileset) {
		const dx = tileset.tileoffset.x + x * this.tilewidth + this.skewX * y;
		const dy =
			tileset.tileoffset.y +
			(y + 1) * this.tileheight -
			tileset.tileheight +
			this.skewY * x;
		tileset.drawTileRaw(renderer, dx, dy, gid, flipMask);
	}

	/**
	 * draw the given TMX Layer for the given area
	 * @ignore
	 */
	drawTileLayer(renderer, layer, rect) {
		let incX = 1;
		let incY = 1;

		// inverse-shear the visible rect to find the tile range in map space
		const rxMin = rect.pos.x;
		const ryMin = rect.pos.y;
		const rxMax = rect.pos.x + rect.width;
		const ryMax = rect.pos.y + rect.height;

		// un-shear all four corners and find the tile bounds
		const invCorners = [
			this.pixelToTileCoords(rxMin, ryMin, vector2dPool.get()),
			this.pixelToTileCoords(rxMax, ryMin, vector2dPool.get()),
			this.pixelToTileCoords(rxMin, ryMax, vector2dPool.get()),
			this.pixelToTileCoords(rxMax, ryMax, vector2dPool.get()),
		];

		let startX = Infinity;
		let startY = Infinity;
		let endX = -Infinity;
		let endY = -Infinity;
		for (const c of invCorners) {
			if (c.x < startX) {
				startX = c.x;
			}
			if (c.y < startY) {
				startY = c.y;
			}
			if (c.x > endX) {
				endX = c.x;
			}
			if (c.y > endY) {
				endY = c.y;
			}
		}
		for (const c of invCorners) {
			vector2dPool.release(c);
		}

		// add margin for oversize tiles
		startX = Math.max(
			Math.floor(
				startX - (layer.maxTileSize.width - layer.tilewidth) / this.tilewidth,
			),
			0,
		);
		startY = Math.max(
			Math.floor(
				startY -
					(layer.maxTileSize.height - layer.tileheight) / this.tileheight,
			),
			0,
		);
		endX = Math.min(Math.ceil(endX) + 1, this.cols);
		endY = Math.min(Math.ceil(endY) + 1, this.rows);

		switch (layer.renderorder) {
			case "right-up":
				endY = startY + (startY = endY) - endY;
				incY = -1;
				break;
			case "left-down":
				endX = startX + (startX = endX) - endX;
				incX = -1;
				break;
			case "left-up":
				endX = startX + (startX = endX) - endX;
				endY = startY + (startY = endY) - endY;
				incX = -1;
				incY = -1;
				break;
			default: // right-down
				break;
		}

		// main drawing loop — direct typed-array reads, short-circuit tileset cache
		const cols = layer.cols;
		const data = layer.layerData;
		const tilesets = layer.tilesets;
		let tilesetCache = layer.tileset;
		if (tilesetCache === null) {
			return;
		}
		for (let y = startY; y !== endY; y += incY) {
			for (let x = startX; x !== endX; x += incX) {
				const idx = (y * cols + x) * 2;
				const gid = data[idx];
				if (!gid) {
					continue;
				}
				const flipMask = data[idx + 1];
				if (!tilesetCache.contains(gid)) {
					tilesetCache = tilesets.getTilesetByGid(gid);
				}
				this.drawTileRaw(renderer, x, y, gid, flipMask, tilesetCache);
			}
		}
	}
}
