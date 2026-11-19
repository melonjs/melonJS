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
// dx low→high and picks the FIRST match. `uOverflow` is how many cells a
// tile reaches past its own, across and up.

const int MAX_OVERFLOW = 4;

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
	vec2 dWorldX = dFdx(worldPx);
	vec2 dWorldY = dFdy(worldPx);

	int gx = int(geomCell.x);
	int gy = int(geomCell.y);
	int overflowX = int(uOverflow.x + 0.5);
	int overflowY = int(uOverflow.y + 0.5);

	vec4 result;

	// Fast path: tiles fit the cell exactly (the common case) — only the
	// geometric cell can contain this fragment's tile.
	if (overflowX == 0 && overflowY == 0) {
		if (!tryRenderCell(gx, gy, worldPx, dWorldX, dWorldY, result)) {
			discard;
		}
		fragColor = layerColor(result);
		return;
	}

	// Slow path: oversized tiles. Walk candidates dy high→low, dx low→high
	// and pick the FIRST match — render order is "right-down" so later
	// cells go on top.
	bool found = false;
	for (int idy = 0; idy <= MAX_OVERFLOW; idy++) {
		int dy = MAX_OVERFLOW - idy;
		if (dy > overflowY) continue;
		for (int dx = 0; dx <= MAX_OVERFLOW; dx++) {
			if (dx > overflowX) break;
			if (tryRenderCell(gx - dx, gy + dy, worldPx, dWorldX, dWorldY, result)) {
				found = true;
				break;
			}
		}
		if (found) break;
	}
	if (!found) discard;
	fragColor = layerColor(result);
}
