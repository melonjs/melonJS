// The orthogonal part of the TMX layer shader: appended to
// tmxlayer-common.wgsl. The WGSL port of orthogonal-tmxlayer.frag.
//
// `uOverflow` is how many cells a tile reaches past its own, across and up.

// `MAX_OVERFLOW`, the bound of both loops, is declared ahead of this file
// (see `TMX_ORIENTATIONS` in gpu/tmxlayer_orientation.js).

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
	let fp = footprint(worldPx);

	let gx = i32(geomCell.x);
	let gy = i32(geomCell.y);
	let overflowX = i32(tmx.uOverflow.x + 0.5);
	let overflowY = i32(tmx.uOverflow.y + 0.5);

	// fast path: tiles fit the cell exactly — only the geometric cell can
	// contain this fragment's tile
	if (overflowX == 0 && overflowY == 0) {
		let only = tryRenderCell(gx, gy, worldPx, fp);
		if (!only.hit) {
			discard;
		}
		return layerColor(only.color);
	}

	// slow path: oversized tiles. Scan candidates dy high→low, dx low→high,
	// front to back — "right-down" render order puts later cells on top —
	// each texel behind the ones before it, until the fragment is opaque
	var result = vec4f(0.0);
	var opaque = false;
	for (var idy = 0; idy <= MAX_OVERFLOW; idy++) {
		let dy = MAX_OVERFLOW - idy;
		if (dy > overflowY) {
			continue;
		}
		for (var dx = 0; dx <= MAX_OVERFLOW; dx++) {
			if (dx > overflowX) {
				break;
			}
			let candidate = tryRenderCell(gx - dx, gy + dy, worldPx, fp);
			if (candidate.hit && under(&result, candidate.color)) {
				opaque = true;
				break;
			}
		}
		if (opaque) {
			break;
		}
	}
	if (result.a <= 0.0) {
		discard;
	}
	return layerColor(result);
}
