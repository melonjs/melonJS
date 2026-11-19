// The isometric part of the TMX layer shader: appended to
// tmxlayer-common.wgsl. The WGSL port of isometric-tmxlayer.frag, where the
// cell maths is explained.
//
// A fragment's position is in the layer's pixels, measured across from the
// map's top corner. With u = col - row and s = col + row, the cells whose
// tile image covers it are a run of `u` and a run of `s`, of the lengths in
// `uOverflow`, scanned s high→low then u high→low: the reverse of the order
// the CPU renderer draws in, each texel put behind the ones before it until
// the fragment is opaque.

// `MAX_ROWS` and `MAX_COLS`, the bounds of the two runs, are declared ahead
// of this file (see `TMX_ORIENTATIONS` in gpu/tmxlayer_orientation.js).

// the left of the cell's diamond, and as far above its bottom as the tile
// is tall
fn tileOrigin(cx : i32, cy : i32) -> vec2f {
	return vec2f(
		f32(cx - cy - 1) * tmx.uCellSize.x * 0.5,
		f32(cx + cy + 2) * tmx.uCellSize.y * 0.5 - tmx.uTileSize.y,
	);
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	let worldPx = tmx.uVisibleStart + in.vRegion * tmx.uVisibleSize;
	let fp = footprint(worldPx);

	let halfCell = tmx.uCellSize * 0.5;
	// the rightmost and the lowest cell whose image can reach the fragment
	let uMax = i32(floor(worldPx.x / halfCell.x)) + 1;
	let sMax = i32(floor((worldPx.y + tmx.uTileSize.y) / halfCell.y)) - 2;
	let spanU = i32(tmx.uOverflow.x + 0.5);
	let spanS = i32(tmx.uOverflow.y + 0.5);

	var result = vec4f(0.0);
	var opaque = false;
	// rows past the map's last one, or before its first, hold no cell: most
	// of a fragment's run, along the bottom of the map and above its top
	let sLast = i32(tmx.uMapSize.x) + i32(tmx.uMapSize.y) - 2;
	for (var j = max(sMax - sLast, 0); j < MAX_ROWS; j++) {
		let s = sMax - j;
		if (j >= spanS || s < 0) {
			break;
		}
		// the first u of this row's parity, then every other one
		var u = uMax - ((uMax + s) & 1);
		for (var i = 0; i < MAX_COLS; i++) {
			if (uMax - u >= spanU) {
				break;
			}
			let candidate = tryRenderCell((s + u) / 2, (s - u) / 2, worldPx, fp);
			if (candidate.hit && under(&result, candidate.color)) {
				opaque = true;
				break;
			}
			u -= 2;
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
