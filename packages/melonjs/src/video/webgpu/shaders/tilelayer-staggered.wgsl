// The staggered and hexagonal part of the tile layer shader: appended to
// tilelayer-common.wgsl. The WGSL port of staggered-tilelayer.frag, where the
// geometry is explained.
//
// Cells stand in lines, `tileLayer.uStagger.y` (a row height) apart down the
// screen; in a line they are two `tileLayer.uStagger.x` (a column width) apart,
// and every other line is shifted by one. With the stagger axis "y" a line
// is a row of the map; with "x" a row is two lines, its columns alternating
// between them.
//
// `MAX_ROWS` and `MAX_COLS`, the bounds of the two runs, are declared ahead
// of this file (see `TILELAYER_ORIENTATIONS` in gpu/tilelayer_orientation.js).

// whether a line is one of the shifted ones: 1, or 0
fn shifted(line : i32) -> i32 {
	return (line & 1) ^ (i32(tileLayer.uStaggerMode) >> 1u);
}

// the bottom left of the cell's box, less the tile's height
fn tileOrigin(cx : i32, cy : i32) -> vec2f {
	let staggerX = (i32(tileLayer.uStaggerMode) & 1) == 1;
	var line = cy;
	var x = f32(2 * cx + shifted(cy)) * tileLayer.uStagger.x;
	if (staggerX) {
		line = 2 * cy + shifted(cx);
		x = f32(cx) * tileLayer.uStagger.x;
	}
	return vec2f(x, f32(line) * tileLayer.uStagger.y + tileLayer.uCellSize.y - tileLayer.uTileSize.y);
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	let worldPx = tileLayer.uVisibleStart + in.vRegion * tileLayer.uVisibleSize;
	let fp = footprint(worldPx);

	let staggerX = (i32(tileLayer.uStaggerMode) & 1) == 1;
	let spacing = tileLayer.uStagger.x * 2.0;
	// the lowest line whose image can reach the fragment
	let lineMax = i32(floor((worldPx.y - tileLayer.uCellSize.y + tileLayer.uTileSize.y) / tileLayer.uStagger.y));
	let spanK = i32(tileLayer.uOverflow.x + 0.5);
	let spanL = i32(tileLayer.uOverflow.y + 0.5);
	// lines past the map's last one, or before its first, hold no cell
	var lineLast = i32(tileLayer.uMapSize.y) - 1;
	if (staggerX) {
		lineLast = 2 * i32(tileLayer.uMapSize.y) - 1;
	}

	var result = vec4f(0.0);
	var opaque = false;
	for (var j = max(lineMax - lineLast, 0); j < MAX_ROWS; j++) {
		let line = lineMax - j;
		if (j >= spanL || line < 0) {
			break;
		}
		let shift = shifted(line);
		// the rightmost cell of the line whose image can reach the fragment
		let kMax = i32(floor((worldPx.x - f32(shift) * tileLayer.uStagger.x) / spacing));
		for (var i = 0; i < MAX_COLS; i++) {
			if (i >= spanK) {
				break;
			}
			let k = kMax - i;
			var cx = k;
			var cy = line;
			if (staggerX) {
				cx = 2 * k + shift;
				cy = line >> 1u;
			}
			let candidate = tryRenderCell(cx, cy, worldPx, fp);
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
