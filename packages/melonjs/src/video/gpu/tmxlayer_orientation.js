/**
 * What the GPU tile layer renderers need to know of a map orientation, the
 * same on WebGL and WebGPU: each backend brings the shader text, and reads
 * the rest from here ({@link TMX_ORIENTATIONS}).
 *
 * - `region`: the part of a layer a view shows, for the tiles of one
 *   tileset. A region is the quad to draw (`x`, `y`, `width`, `height`, in
 *   the layer's pixels), the shader's `uVisibleStart` and `uVisibleSize`
 *   (the quad's corner and size, in the units the orientation's fragment
 *   shader works in) and its `uOverflow`.
 * - `tilesetsOf`: the tilesets a layer is drawn with, one pass each.
 * - `draws`: whether a layer can be drawn at all (its `renderMode` can be
 *   set to "shader" by hand, after it was found unfit for it).
 * - `limits`: the bounds of the loops of the orientation's fragment shader,
 *   declared in it as constants of the same names, and what a layer is
 *   checked against before it takes the GPU path.
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
		// a staggered or hexagonal map's: its column width and row height,
		// and its stagger axis and index as the shader reads them
		staggerX: 0,
		staggerY: 0,
		staggerMode: 0,
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

	// A tile larger than its cell is drawn from the cell's bottom left
	// corner: it reaches to the right of its cell and above it, so the tiles
	// of the last column and of the first row reach past the grid. The quad
	// covers that too, by the layer's LARGEST tile, so that it is the same
	// for every tileset of the layer (the shader drops what a pass has no
	// tile for).
	const largest = layer.maxTileSize ?? {
		width: tileset.tilewidth,
		height: tileset.tileheight,
	};
	const reachX = Math.max(0, Math.ceil(largest.width / tileWidth) - 1);
	const reachY = Math.max(0, Math.ceil(largest.height / tileHeight) - 1);

	// compute the visible region in tile-coord space
	const startTileX = Math.max(0, Math.floor(rect.pos.x / tileWidth));
	const startTileY = Math.max(-reachY, Math.floor(rect.pos.y / tileHeight));
	const endTileX = Math.min(
		layer.cols + reachX,
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
 * The view, cut to where a layer's tiles can be, on whole pixels: the quad
 * to draw, for an orientation whose shader works in the layer's pixels.
 * @param {object} rect - the visible viewport rect (world coords)
 * @param {number} left - where the tiles can be, in the layer's pixels
 * @param {number} top - where the tiles can be
 * @param {number} right - where the tiles can be
 * @param {number} bottom - where the tiles can be
 * @param {number} originX - where the shader's pixels are measured from
 * @param {number} originY - where the shader's pixels are measured from
 * @param {object} out - the region to fill
 * @returns {boolean} false when the view shows none of it
 * @ignore
 */
function viewIn(rect, left, top, right, bottom, originX, originY, out) {
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
	out.startX = x0 - originX;
	out.startY = y0 - originY;
	out.sizeX = out.width;
	out.sizeY = out.height;
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

	if (
		!viewIn(rect, left, top, right, bottom, originX + offsetX, offsetY, out)
	) {
		return false;
	}
	// how many cells' images reach a pixel: as many across as the image is
	// wide in half grid widths, as many down as it is tall in half grid
	// heights
	out.overflowX = Math.ceil(tileset.tilewidth / halfWidth);
	out.overflowY = Math.ceil(tileset.tileheight / halfHeight);
	return true;
}

/**
 * The part of a staggered or hexagonal layer a view shows, for the tiles of
 * one tileset: the two are one geometry (see `staggered-tmxlayer.frag`),
 * the second with cells longer by its `hexsidelength`.
 *
 * As on an isometric map, the quad is the view, cut to where the tileset's
 * tiles can be, and the shader works in the layer's pixels with the
 * `tileoffset` taken off.
 * @param {TMXLayer} layer - the layer
 * @param {object} rect - the visible viewport rect (world coords)
 * @param {object} tileset - the tileset whose tiles are drawn
 * @param {object} out - the region to fill
 * @returns {boolean} false when the view shows nothing of the layer
 * @ignore
 * @internal
 */
export function staggeredRegion(layer, rect, tileset, out) {
	const map = layer.getRenderer();
	const columnWidth = map.columnwidth;
	const rowHeight = map.rowheight;
	const offsetX = tileset.tileoffset.x;
	const offsetY = tileset.tileoffset.y;
	const cols = layer.cols;
	const rows = layer.rows;

	// The cells' boxes: lines a row height apart, and in each, cells two
	// column widths apart, every other line shifted by one. A row of the map
	// is one line, or two when the stagger axis is x
	const lines = map.staggerX ? rows * 2 : rows;
	// the last box of a line, in column widths from the first (of a shifted
	// line, when the axis is y)
	const lastBox = map.staggerX ? cols - 1 : cols * 2 - 1;
	// where the tiles can be: from the left of the first box to the right of
	// the last one's image, from the top of the first line's images to the
	// bottom of the last line's boxes
	const left = offsetX;
	const right = lastBox * columnWidth + tileset.tilewidth + offsetX;
	// (a tile stands on the cell the map lays out, which can be a pixel
	// less than the map's tile size: see `TMXHexagonalRenderer`)
	const top = map.tileheight - tileset.tileheight + offsetY;
	const bottom = (lines - 1) * rowHeight + map.tileheight + offsetY;

	// the shader stands a tile on `uCellSize`, the map's tile size: where
	// the cell is shorter, its pixels are measured from as much lower
	const shorter = layer.tileheight - map.tileheight;
	if (
		!viewIn(rect, left, top, right, bottom, offsetX, offsetY - shorter, out)
	) {
		return false;
	}
	// how many cells' images reach a pixel: as many in a line as the image
	// is wide in cell spacings, as many lines as it is tall in row heights
	out.overflowX = Math.ceil(tileset.tilewidth / (columnWidth * 2));
	out.overflowY = Math.ceil(tileset.tileheight / rowHeight);
	out.staggerX = columnWidth;
	out.staggerY = rowHeight;
	out.staggerMode = (map.staggerX ? 1 : 0) + (map.staggerEven ? 2 : 0);
	return true;
}

/**
 * How many tiles a tileset's image has across: counted from the margin, a
 * tile plus the spacing apart, the last column going without its outer
 * margin, as Tiled and the tileset's own atlas count them.
 * @param {object} tileset - the tileset
 * @returns {number} the number of columns
 * @ignore
 * @internal
 */
export function atlasColumns(tileset) {
	return Math.max(
		1,
		Math.floor(
			(tileset.image.width - tileset.margin + tileset.spacing) /
				(tileset.tilewidth + tileset.spacing),
		),
	);
}

/**
 * How many tiles a tileset's image has down (see {@link atlasColumns}).
 * @param {object} tileset - the tileset
 * @returns {number} the number of rows
 * @ignore
 * @internal
 */
export function atlasRows(tileset) {
	return Math.max(
		1,
		Math.floor(
			(tileset.image.height - tileset.margin + tileset.spacing) /
				(tileset.tileheight + tileset.spacing),
		),
	);
}

/**
 * What the orientations whose tiles overlap share: a layer is drawn with
 * ONE tileset. A pass keeps the order of the tiles of one tileset, not
 * across two (`layer._shaderTileset`, found by the layer when it is checked
 * for this path).
 */
const ONE_TILESET = {
	/**
	 * @param {TMXLayer} layer - the layer
	 * @param {object[]} scratch - an array to fill
	 * @returns {object[]} that tileset, or none for an empty layer
	 */
	tilesetsOf(layer, scratch) {
		scratch.length = 0;
		if (layer._shaderTileset) {
			scratch.push(layer._shaderTileset);
		}
		return scratch;
	},
	/**
	 * not a layer with no tileset to draw with: one that was never
	 * checked, or whose tiles come from several (`null`; an empty layer
	 * has `undefined`, and draws nothing)
	 * @param {TMXLayer} layer - the layer
	 * @returns {boolean} whether the layer can be drawn
	 */
	draws(layer) {
		return layer._shaderTileset !== null && layer._shaderFit !== false;
	},
};

/**
 * The map orientations the GPU tile layer renderers draw.
 * @ignore
 * @internal
 */
export const TMX_ORIENTATIONS = {
	orthogonal: {
		region: orthogonalRegion,
		/**
		 * every tileset of the map: a pass shows the tiles of its own
		 * @param {TMXLayer} layer - the layer
		 * @returns {object[]} the tilesets
		 */
		tilesetsOf(layer) {
			return layer.tilesets.tilesets;
		},
		/**
		 * not a layer found unfit for this path, or made so by a tile set
		 * since (a layer never checked is drawn)
		 * @param {TMXLayer} layer - the layer
		 * @returns {boolean} whether the layer can be drawn
		 */
		draws(layer) {
			return layer._shaderFit !== false;
		},
		// how many cells a tile can reach past its own, across and up
		limits: { MAX_OVERFLOW: 4 },
	},
	isometric: {
		region: isometricRegion,
		...ONE_TILESET,
		// the cells whose image can reach a pixel: rows of them, half a
		// grid height apart, and in each, cells a grid width apart. So
		// tiles up to MAX_ROWS / 2 grid heights tall, MAX_COLS wide
		limits: { MAX_ROWS: 16, MAX_COLS: 4 },
	},
	// one geometry for both: lines of cells, a row height apart, and in
	// each, cells two column widths apart
	staggered: {
		region: staggeredRegion,
		...ONE_TILESET,
		staggered: true,
		limits: { MAX_ROWS: 16, MAX_COLS: 4 },
	},
	hexagonal: {
		region: staggeredRegion,
		...ONE_TILESET,
		staggered: true,
		limits: { MAX_ROWS: 16, MAX_COLS: 4 },
	},
};
