// melonJS WebGPU orthogonal TMX layer shader — the WGSL port of
// orthogonal-tmxlayer.vert/frag (WebGL2).
//
// Per fragment: recover the world-pixel position from the quad UV, walk
// candidate cells (the geometric cell, plus cells whose oversized
// bottom-aligned tiles could reach this fragment), fetch GIDs from the
// per-layer index texture, and sample the tileset atlas at the correct
// sub-region. One draw per tileset — the GID-range guard discards cells
// belonging to other tilesets.
//
// Index texture encoding (rgba8unorm, one cell per texel):
//   R = GID low byte, G = GID high byte, B = flip mask (H|V<<1|AD<<2)
// Animation lookup (rgba8unorm, 1 row): per local id, the CURRENT frame's
// local id, same R/G byte-pair encoding.
//
// textureLoad replaces texelFetch (byte-exact, no sampler); the atlas
// sample uses textureSampleLevel — the sample sites sit in non-uniform
// control flow, where implicit-derivative sampling is not allowed (WGSL
// uniformity rule; atlases are single-level so the output is identical).

struct FrameUniforms {
	projection : mat4x4<f32>,
	lineWidth : f32,
};

struct TMXUniforms {
	uMapSize : vec2f,
	uCellSize : vec2f,
	uTileSize : vec2f,
	uOverflow : vec2f,
	uTilesetCols : vec2f,
	uInvTilesetSize : vec2f,
	uTilesetMargin : vec4f, // (marginX, marginY, spacingX, spacingY)
	uGidRange : vec2f,      // (firstgid, lastgid)
	uVisibleStart : vec2f,
	uVisibleSize : vec2f,
	uOpacity : f32,
	uAnimSize : f32,        // entries in the anim lookup, 0 when disabled
	uTint : vec4f,
};

@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;
@group(1) @binding(0) var uTexture : texture_2d<f32>;   // tileset atlas
@group(1) @binding(1) var uSampler : sampler;
@group(3) @binding(0) var<uniform> tmx : TMXUniforms;
@group(3) @binding(1) var uTileIndex : texture_2d<f32>; // per-layer GID index
@group(3) @binding(2) var uAnimLookup : texture_2d<f32>;

struct VSOut {
	@builtin(position) position : vec4f,
	@location(0) vRegion : vec2f,
	@location(1) vColor : vec4f,
};

@vertex
fn vertex_main(
	@location(0) aVertex : vec3f,
	@location(1) aRegion : vec2f,
	@location(2) aColor : vec4f,
	@location(3) aTextureId : f32,
) -> VSOut {
	var out : VSOut;
	let clip = uFrame.projection * vec4f(aVertex, 1.0);
	// GL-convention clip z in [-w, w] -> WebGPU [0, w]
	out.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
	out.vColor = vec4f(aColor.bgr * aColor.a, aColor.a);
	out.vRegion = aRegion;
	return out;
}

const MAX_OVERFLOW : i32 = 4;

struct CellSample {
	hit : bool,
	color : vec4f,
}

// Try to render the tile at cell (cx, cy) for the current fragment —
// identical logic to the GLSL tryRenderCell, returning a hit/color pair
// (WGSL has no out parameters).
fn tryRenderCell(cx : i32, cy : i32, worldPx : vec2f) -> CellSample {
	var miss : CellSample;
	miss.hit = false;
	miss.color = vec4f(0.0);

	let mapW = i32(tmx.uMapSize.x);
	let mapH = i32(tmx.uMapSize.y);
	if (cx < 0 || cx >= mapW || cy < 0 || cy >= mapH) {
		return miss;
	}

	// byte-exact read: rgba8unorm texel back to byte ints
	let cellF = textureLoad(uTileIndex, vec2i(cx, cy), 0);
	let cell = vec4u(cellF * 255.0 + 0.5);
	let firstGid = i32(tmx.uGidRange.x);
	let gid = i32(cell.r) | (i32(cell.g) << 8u);
	if (gid < firstGid || gid > i32(tmx.uGidRange.y)) {
		return miss;
	}

	// oversized tiles are bottom-aligned vertically, left-aligned horizontally
	let tileWorldOrigin = vec2f(
		f32(cx) * tmx.uCellSize.x,
		(f32(cy) + 1.0) * tmx.uCellSize.y - tmx.uTileSize.y,
	);
	var inTile = (worldPx - tileWorldOrigin) / tmx.uTileSize;
	if (inTile.x < 0.0 || inTile.x >= 1.0 || inTile.y < 0.0 || inTile.y >= 1.0) {
		return miss;
	}

	// flip mask + axis-swap trick: AD transposes; with AD set, H and V
	// swap their effective axes (matches the legacy buildFlipTransform)
	let flipMask = i32(cell.b);
	let flipH = f32(flipMask & 1);
	let flipV = f32((flipMask >> 1u) & 1);
	let flipAD = f32((flipMask >> 2u) & 1);
	inTile = mix(inTile, inTile.yx, vec2f(flipAD));
	let effH = mix(flipH, flipV, flipAD);
	let effV = mix(flipV, flipH, flipAD);
	inTile.x = mix(inTile.x, 1.0 - inTile.x, effH);
	inTile.y = mix(inTile.y, 1.0 - inTile.y, effV);

	var localId = gid - firstGid;

	// animated tiles: swap the local id for the current frame's id (the
	// CPU rewrites the lookup in lockstep with tileset.update)
	if (tmx.uAnimSize > 0.5) {
		let animF = textureLoad(uAnimLookup, vec2i(localId, 0), 0);
		let animTexel = vec4u(animF * 255.0 + 0.5);
		localId = i32(animTexel.r) | (i32(animTexel.g) << 8u);
	}

	let row = floor(f32(localId) / tmx.uTilesetCols.x);
	let col = f32(localId) - row * tmx.uTilesetCols.x;
	let tileOriginPx = tmx.uTilesetMargin.xy
		+ vec2f(col, row) * (tmx.uTileSize + tmx.uTilesetMargin.zw);
	let texelPx = tileOriginPx + inTile * tmx.uTileSize;
	let texelUV = texelPx * tmx.uInvTilesetSize;

	let sampled = textureSampleLevel(uTexture, uSampler, texelUV, 0.0);
	if (sampled.a <= 0.0) {
		return miss;
	}
	var out : CellSample;
	out.hit = true;
	out.color = sampled;
	return out;
}

@fragment
fn fragment_main(in : VSOut) -> @location(0) vec4f {
	let tileCoord = tmx.uVisibleStart + in.vRegion * tmx.uVisibleSize;
	let geomCell = floor(tileCoord);
	let worldPx = tileCoord * tmx.uCellSize;

	let gx = i32(geomCell.x);
	let gy = i32(geomCell.y);
	let overflowX = i32(tmx.uOverflow.x + 0.5);
	let overflowY = i32(tmx.uOverflow.y + 0.5);

	var result : CellSample;

	// fast path: tiles fit the cell exactly — only the geometric cell can
	// contain this fragment's tile
	if (overflowX == 0 && overflowY == 0) {
		result = tryRenderCell(gx, gy, worldPx);
		if (!result.hit) {
			discard;
		}
		return vec4f(result.color.rgb, result.color.a * tmx.uOpacity) * tmx.uTint;
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
			let candidate = tryRenderCell(gx - dx, gy + dy, worldPx);
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
	return vec4f(result.color.rgb, result.color.a * tmx.uOpacity) * tmx.uTint;
}
