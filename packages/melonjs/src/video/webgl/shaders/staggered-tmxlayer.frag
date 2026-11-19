// The staggered and hexagonal part of the TMX layer fragment shader:
// appended to `tmxlayer-common.frag`.
//
// Both maps are one geometry, in the layer's pixels (the renderer takes the
// tileset's `tileoffset` off before a position gets here). Cells stand in
// lines, a `rowheight` apart down the screen; in a line they are two
// `columnwidth` apart, and every other line is shifted by one `columnwidth`
// (which ones, `staggerindex` says). A hexagonal map's cells are longer by
// its `hexsidelength`, which is in those two lengths already.
//
// What `staggeraxis` changes is which cell a place in a line is:
//   "y": a line is a row of the map, and its cells are that row's columns;
//   "x": a row of the map is two lines, its columns alternating between
//        them, so a line holds every other column of one row.
//
// The tile of a cell is drawn as its whole image, standing on the bottom
// left of the cell. So the cells whose image covers a fragment are a run of
// lines, as long as the image is tall in row heights, and in each a run of
// cells, as long as it is wide in cell spacings: `uOverflow` holds the two
// lengths. The CPU renderer draws the lines from the top of the screen
// down, each from the left: the scan here goes the other way, and puts each
// texel behind the ones before it until the fragment is opaque.
//
// `MAX_ROWS` and `MAX_COLS`, the bounds of the two runs, are declared ahead
// of this file (see `TMX_ORIENTATIONS` in `gpu/tmxlayer_orientation.js`): a
// layer of larger tiles is left to the CPU renderer.

uniform vec2 uStagger;       // (columnwidth, rowheight)
uniform float uStaggerMode;  // 1 when the stagger axis is x, + 2 when the index is even

// whether a line is one of the shifted ones: 1, or 0
int shifted(int line) {
	return (line & 1) ^ (int(uStaggerMode) >> 1);
}

// the bottom left of the cell's box, less the tile's height
vec2 tileOrigin(int cx, int cy) {
	bool staggerX = (int(uStaggerMode) & 1) == 1;
	// the cell's line, and how far along it the cell is
	int line = staggerX ? 2 * cy + shifted(cx) : cy;
	float x = staggerX
		? float(cx) * uStagger.x
		: float(2 * cx + shifted(cy)) * uStagger.x;
	return vec2(x, float(line) * uStagger.y + uCellSize.y - uTileSize.y);
}

void main(void) {
	vec2 worldPx = uVisibleStart + vRegion * uVisibleSize;
	Footprint fp = footprint(worldPx);

	bool staggerX = (int(uStaggerMode) & 1) == 1;
	float spacing = uStagger.x * 2.0;
	// the lowest line whose image can reach the fragment
	int lineMax = int(floor((worldPx.y - uCellSize.y + uTileSize.y) / uStagger.y));
	int spanK = int(uOverflow.x + 0.5);
	int spanL = int(uOverflow.y + 0.5);
	// lines past the map's last one, or before its first, hold no cell
	int lineLast = (staggerX ? 2 * int(uMapSize.y) : int(uMapSize.y)) - 1;

	vec4 result = vec4(0.0);
	vec4 texel;
	bool opaque = false;
	for (int j = max(lineMax - lineLast, 0); j < MAX_ROWS; j++) {
		int line = lineMax - j;
		if (j >= spanL || line < 0) break;
		int shift = shifted(line);
		// the rightmost cell of the line whose image can reach the fragment
		int kMax = int(floor((worldPx.x - float(shift) * uStagger.x) / spacing));
		for (int i = 0; i < MAX_COLS; i++) {
			if (i >= spanK) break;
			int k = kMax - i;
			int cx = staggerX ? 2 * k + shift : k;
			int cy = staggerX ? line >> 1 : line;
			if (tryRenderCell(cx, cy, worldPx, fp, texel)) {
				if (under(result, texel)) {
					opaque = true;
					break;
				}
			}
		}
		if (opaque) break;
	}
	if (result.a <= 0.0) discard;
	fragColor = layerColor(result);
}
