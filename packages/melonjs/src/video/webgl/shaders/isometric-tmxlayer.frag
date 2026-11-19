// The isometric part of the TMX layer fragment shader: appended to
// `tmxlayer-common.frag`.
//
// A fragment's position is in the layer's pixels, measured across from the
// map's top corner (the renderer takes the map's `originX` and the
// tileset's `tileoffset` off before it gets here), so the cell maths below
// is that of `TMXIsometricRenderer` with no origin in it.
//
// The tile of cell (col, row) is drawn as its whole image, bottom-aligned on
// the cell's diamond: with u = col - row and s = col + row, its left edge is
// at (u - 1) half grid widths and its bottom edge at (s + 2) half grid
// heights. So the cells whose image covers a fragment are a run of `u`, as
// long as the image is wide in half grid widths, and a run of `s`, as long
// as it is tall in half grid heights: `uOverflow` holds the two lengths.
// Only pairs of the same parity are cells.
//
// The CPU renderer draws rows of constant `s` from the top of the screen
// down, each from left to right. The last tile drawn is the one in front,
// so the scan here goes the other way, s high→low then u high→low, and puts
// each texel behind the ones before it until the fragment is opaque: an
// opaque texel ends it at once, and the soft edge of a tile shows the tiles
// behind it.

// `MAX_ROWS` and `MAX_COLS`, the bounds of the two runs, are declared ahead
// of this file (see `TMX_ORIENTATIONS` in `gpu/tmxlayer_orientation.js`): a
// layer of larger tiles is left to the CPU renderer.

// the left of the cell's diamond, and as far above its bottom as the tile
// is tall
vec2 tileOrigin(int cx, int cy) {
	return vec2(
		float(cx - cy - 1) * uCellSize.x * 0.5,
		float(cx + cy + 2) * uCellSize.y * 0.5 - uTileSize.y
	);
}

void main(void) {
	vec2 worldPx = uVisibleStart + vRegion * uVisibleSize;
	Footprint fp = footprint(worldPx);

	vec2 halfCell = uCellSize * 0.5;
	// the rightmost and the lowest cell whose image can reach the fragment
	int uMax = int(floor(worldPx.x / halfCell.x)) + 1;
	int sMax = int(floor((worldPx.y + uTileSize.y) / halfCell.y)) - 2;
	int spanU = int(uOverflow.x + 0.5);
	int spanS = int(uOverflow.y + 0.5);

	vec4 result = vec4(0.0);
	vec4 texel;
	bool opaque = false;
	// rows past the map's last one, or before its first, hold no cell: most
	// of a fragment's run, along the bottom of the map and above its top
	int sLast = int(uMapSize.x) + int(uMapSize.y) - 2;
	for (int j = max(sMax - sLast, 0); j < MAX_ROWS; j++) {
		int s = sMax - j;
		if (j >= spanS || s < 0) break;
		// the first u of this row's parity, then every other one
		int u = uMax - ((uMax + s) & 1);
		for (int i = 0; i < MAX_COLS; i++) {
			if (uMax - u >= spanU) break;
			if (tryRenderCell((s + u) / 2, (s - u) / 2, worldPx, fp, texel)) {
				if (under(result, texel)) {
					opaque = true;
					break;
				}
			}
			u -= 2;
		}
		if (opaque) break;
	}
	if (result.a <= 0.0) discard;
	fragColor = layerColor(result);
}
