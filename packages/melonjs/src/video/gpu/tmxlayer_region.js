/**
 * The part of a tile layer a view shows, as the GPU tile layer renderers
 * need it: the same on WebGL and WebGPU, so both read it from here.
 *
 * A region is the quad to draw (`x`, `y`, `width`, `height`, in the layer's
 * pixels), the shader's `uVisibleStart` and `uVisibleSize` (the quad's
 * corner and size, in the units the orientation's fragment shader works in)
 * and its `uOverflow`.
 * @import { default as TMXLayer } from "../../level/tiled/TMXLayer.js";
 */

/**
 * @returns {object} an empty region, for a renderer to fill again and again
 * @ignore
 */
export function createRegion() {
	return {
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		startX: 0,
		startY: 0,
		sizeX: 0,
		sizeY: 0,
		overflowX: 0,
		overflowY: 0,
	};
}

/**
 * The cells of an orthogonal layer a view shows, for the tiles of one
 * tileset: the quad covers them, and the shader works in cells.
 * @param {TMXLayer} layer - the layer
 * @param {object} rect - the visible viewport rect (world coords)
 * @param {object} tileset - the tileset whose tiles are drawn
 * @param {object} out - the region to fill
 * @returns {boolean} false when the view shows nothing of the layer
 * @ignore
 * @internal
 */
export function orthogonalRegion(layer, rect, tileset, out) {
	const tileWidth = layer.tilewidth;
	const tileHeight = layer.tileheight;

	// compute the visible region in tile-coord space
	const startTileX = Math.max(0, Math.floor(rect.pos.x / tileWidth));
	const startTileY = Math.max(0, Math.floor(rect.pos.y / tileHeight));
	const endTileX = Math.min(
		layer.cols,
		Math.ceil((rect.pos.x + rect.width) / tileWidth),
	);
	const endTileY = Math.min(
		layer.rows,
		Math.ceil((rect.pos.y + rect.height) / tileHeight),
	);

	// visible rect entirely outside the layer — nothing to draw
	if (endTileX <= startTileX || endTileY <= startTileY) {
		return false;
	}

	// quad world coords
	out.x = startTileX * tileWidth;
	out.y = startTileY * tileHeight;
	out.width = (endTileX - startTileX) * tileWidth;
	out.height = (endTileY - startTileY) * tileHeight;

	// visible region in tile units (matches the quad's [0..1] UV span —
	// shader recovers the per-fragment tile coord as
	// `uVisibleStart + uv * uVisibleSize`)
	out.startX = startTileX;
	out.startY = startTileY;
	out.sizeX = endTileX - startTileX;
	out.sizeY = endTileY - startTileY;

	// how many cells a tile reaches past its own, across and up
	out.overflowX = Math.max(0, Math.ceil(tileset.tilewidth / tileWidth) - 1);
	out.overflowY = Math.max(0, Math.ceil(tileset.tileheight / tileHeight) - 1);
	return true;
}

/**
 * The part of an isometric layer a view shows, for the tiles of one tileset:
 * the same on every GPU backend, so their renderers share it.
 *
 * The quad is the view, cut to where the tileset's tiles can be: a tile is
 * drawn as its whole image, bottom-aligned on its cell's diamond and moved by
 * the tileset's `tileoffset`, so tall tiles reach above the map's top corner
 * and wide ones past its right one.
 *
 * The shader works in the layer's pixels, measured across from the map's top
 * corner and with the `tileoffset` taken off: both are in `startX` /
 * `startY`, and the shader needs neither.
 * @param {TMXLayer} layer - the layer
 * @param {object} rect - the visible viewport rect (world coords)
 * @param {object} tileset - the tileset whose tiles are drawn
 * @param {object} out - the region to fill
 * @returns {boolean} false when the view shows nothing of the layer
 * @ignore
 * @internal
 */
export function isometricRegion(layer, rect, tileset, out) {
	const halfWidth = layer.tilewidth / 2;
	const halfHeight = layer.tileheight / 2;
	const originX = layer.getRenderer().originX;
	const offsetX = tileset.tileoffset.x;
	const offsetY = tileset.tileoffset.y;
	const cols = layer.cols;
	const rows = layer.rows;

	// where the tiles can be: from the left of the cell (0, rows - 1) to the
	// right of the image of (cols - 1, 0), from the top of the image of
	// (0, 0) to the bottom of the diamond of (cols - 1, rows - 1)
	const left = originX - rows * halfWidth + offsetX;
	const right = originX + (cols - 2) * halfWidth + tileset.tilewidth + offsetX;
	const top = layer.tileheight - tileset.tileheight + offsetY;
	const bottom = (cols + rows) * halfHeight + offsetY;

	// the view, cut to it, on whole pixels
	const x0 = Math.floor(Math.max(rect.pos.x, left));
	const y0 = Math.floor(Math.max(rect.pos.y, top));
	const x1 = Math.ceil(Math.min(rect.pos.x + rect.width, right));
	const y1 = Math.ceil(Math.min(rect.pos.y + rect.height, bottom));
	if (x1 <= x0 || y1 <= y0) {
		return false;
	}

	out.x = x0;
	out.y = y0;
	out.width = x1 - x0;
	out.height = y1 - y0;
	out.startX = x0 - originX - offsetX;
	out.startY = y0 - offsetY;
	out.sizeX = out.width;
	out.sizeY = out.height;
	// how many cells' images reach a pixel: as many across as the image is
	// wide in half grid widths, as many down as it is tall in half grid
	// heights
	out.overflowX = Math.ceil(tileset.tilewidth / halfWidth);
	out.overflowY = Math.ceil(tileset.tileheight / halfHeight);
	return true;
}
