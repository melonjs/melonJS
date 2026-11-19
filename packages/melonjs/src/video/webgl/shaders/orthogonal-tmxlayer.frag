// The orthogonal part of the TMX layer fragment shader: appended to
// `tmxlayer-common.frag`.
//
// Fast path: when the tileset has no oversized tiles (`uOverflow == (0, 0)`)
// — the common case for grid-aligned maps — only the geometric cell can
// hold this fragment's tile, so we skip the candidate loop entirely and
// run a single `tryRenderCell` call. The loop branch is on a uniform
// value, coherent across the wave, and trims 25 worst-case loop
// iterations + their guard checks to a single inlined function call.
//
// Slow path: tiles drawing larger than the cell are bottom-aligned
// vertically and left-aligned horizontally. Render order is "right-down":
// later cells end up on top, so the candidate loop scans dy high→low,
// dx low→high, the tile in front first, and puts each texel behind the
// ones before it until the fragment is opaque. `uOverflow` is how many
// cells a tile reaches past its own, across and up.

// `MAX_OVERFLOW`, the bound of both loops, is declared ahead of this file
// (see `TMX_ORIENTATIONS` in `gpu/tmxlayer_orientation.js`): a layer whose
// tiles reach further is left to the CPU renderer.

// a tile is bottom-aligned on its cell, and left-aligned
vec2 tileOrigin(int cx, int cy) {
	return vec2(
		float(cx) * uCellSize.x,
		(float(cy) + 1.0) * uCellSize.y - uTileSize.y
	);
}

void main(void) {
	vec2 tileCoord = uVisibleStart + vRegion * uVisibleSize;
	vec2 geomCell = floor(tileCoord);
	vec2 worldPx = tileCoord * uCellSize;
	Footprint fp = footprint(worldPx);

	int gx = int(geomCell.x);
	int gy = int(geomCell.y);
	int overflowX = int(uOverflow.x + 0.5);
	int overflowY = int(uOverflow.y + 0.5);

	vec4 result = vec4(0.0);

	// Fast path: tiles fit the cell exactly (the common case) — only the
	// geometric cell can contain this fragment's tile.
	if (overflowX == 0 && overflowY == 0) {
		if (!tryRenderCell(gx, gy, worldPx, fp, result)) {
			discard;
		}
		fragColor = layerColor(result);
		return;
	}

	// Slow path: oversized tiles. Walk candidates dy high→low, dx low→high,
	// front to back — render order is "right-down" so later cells go on
	// top — until the fragment is opaque.
	vec4 texel;
	bool opaque = false;
	for (int idy = 0; idy <= MAX_OVERFLOW; idy++) {
		int dy = MAX_OVERFLOW - idy;
		if (dy > overflowY) continue;
		for (int dx = 0; dx <= MAX_OVERFLOW; dx++) {
			if (dx > overflowX) break;
			if (tryRenderCell(gx - dx, gy + dy, worldPx, fp, texel)) {
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
