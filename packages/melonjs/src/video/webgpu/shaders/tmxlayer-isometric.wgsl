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

// bounds of the two runs: tiles up to 8 grid heights tall and 4 grid widths
// wide (the layer falls back to the CPU renderer past them)
const MAX_ROWS : i32 = 16;
const MAX_COLS : i32 = 4;

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
	let dWorldX = dpdx(worldPx);
	let dWorldY = dpdy(worldPx);

	let halfCell = tmx.uCellSize * 0.5;
	// the rightmost and the lowest cell whose image can reach the fragment
	let uMax = i32(floor(worldPx.x / halfCell.x)) + 1;
	let sMax = i32(floor((worldPx.y + tmx.uTileSize.y) / halfCell.y)) - 2;
	let spanU = i32(tmx.uOverflow.x + 0.5);
	let spanS = i32(tmx.uOverflow.y + 0.5);

	var result = vec4f(0.0);
	var opaque = false;
	for (var j = 0; j < MAX_ROWS; j++) {
		if (j >= spanS) {
			break;
		}
		let s = sMax - j;
		// the first u of this row's parity, then every other one
		var u = uMax - ((uMax + s) & 1);
		for (var i = 0; i < MAX_COLS; i++) {
			if (uMax - u >= spanU) {
				break;
			}
			let candidate = tryRenderCell((s + u) / 2, (s - u) / 2, worldPx, dWorldX, dWorldY);
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
