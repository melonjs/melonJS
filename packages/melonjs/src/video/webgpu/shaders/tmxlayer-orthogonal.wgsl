// The orthogonal part of the TMX layer shader: appended to
// tmxlayer-common.wgsl. The WGSL port of orthogonal-tmxlayer.frag.
//
// `uOverflow` is how many cells a tile reaches past its own, across and up.

const MAX_OVERFLOW : i32 = 4;

// a tile is bottom-aligned on its cell, and left-aligned
fn tileOrigin(cx : i32, cy : i32) -> vec2f {
	return vec2f(
		f32(cx) * tmx.uCellSize.x,
		(f32(cy) + 1.0) * tmx.uCellSize.y - tmx.uTileSize.y,
	);
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	let tileCoord = tmx.uVisibleStart + in.vRegion * tmx.uVisibleSize;
	let geomCell = floor(tileCoord);
	let worldPx = tileCoord * tmx.uCellSize;
	let dWorldX = dpdx(worldPx);
	let dWorldY = dpdy(worldPx);

	let gx = i32(geomCell.x);
	let gy = i32(geomCell.y);
	let overflowX = i32(tmx.uOverflow.x + 0.5);
	let overflowY = i32(tmx.uOverflow.y + 0.5);

	var result : CellSample;

	// fast path: tiles fit the cell exactly — only the geometric cell can
	// contain this fragment's tile
	if (overflowX == 0 && overflowY == 0) {
		result = tryRenderCell(gx, gy, worldPx, dWorldX, dWorldY);
		if (!result.hit) {
			discard;
		}
		return layerColor(result.color);
	}

	// slow path: oversized tiles. Scan candidates dy high→low, dx low→high
	// and take the FIRST match — "right-down" render order puts later
	// cells on top
	var found = false;
	for (var idy = 0; idy <= MAX_OVERFLOW; idy++) {
		let dy = MAX_OVERFLOW - idy;
		if (dy > overflowY) {
			continue;
		}
		for (var dx = 0; dx <= MAX_OVERFLOW; dx++) {
			if (dx > overflowX) {
				break;
			}
			let candidate = tryRenderCell(gx - dx, gy + dy, worldPx, dWorldX, dWorldY);
			if (candidate.hit) {
				result = candidate;
				found = true;
				break;
			}
		}
		if (found) {
			break;
		}
	}
	if (!found) {
		discard;
	}
	return layerColor(result.color);
}
