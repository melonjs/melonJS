// melonJS WebGPU TMX layer shader — the WGSL port of tmxlayer.vert and
// tmxlayer-common.frag (WebGL2): the part every map orientation shares. An
// orientation's own file follows it in the module (tmxlayer-orthogonal.wgsl,
// tmxlayer-isometric.wgsl, tmxlayer-staggered.wgsl for staggered and
// hexagonal maps) and gives the two things that differ: where a
// cell's tile is drawn (`tileOrigin`), and which cells could cover a
// fragment, front to back (`fragment_main`).
//
// Per fragment: recover the fragment's position in the layer from the quad
// UV, walk the cells whose tile could cover it, the one drawn last first,
// fetch GIDs from the per-layer index texture, and sample the tileset atlas
// at the correct sub-region. One draw per tileset — the GID-range guard
// discards cells belonging to other tilesets.
//
// Index texture encoding (rgba8unorm, one cell per texel):
//   R = GID low byte, G = GID high byte, B = flip mask (H|V<<1|AD<<2)
// Animation lookup (rgba8unorm, 1 row): per local id, the CURRENT frame's
// local id, same R/G byte-pair encoding.
//
// textureLoad replaces texelFetch (byte-exact, no sampler); the atlas
// sample uses textureSampleGrad, with derivatives taken once per fragment —
// the sample sites sit in non-uniform control flow, where
// implicit-derivative sampling is not allowed (WGSL uniformity rule).

struct FrameUniforms {
	projection : mat4x4<f32>,
	lineWidth : f32,
};

struct TMXUniforms {
	uMapSize : vec2f,
	uCellSize : vec2f,
	uTileSize : vec2f,
	uOverflow : vec2f,      // how far a tile reaches past its cell (see each fragment_main)
	uTilesetCols : vec2f,
	uInvTilesetSize : vec2f,
	uTilesetMargin : vec4f, // (marginX, marginY, spacingX, spacingY)
	uGidRange : vec2f,      // (firstgid, lastgid)
	uVisibleStart : vec2f,
	uVisibleSize : vec2f,
	uOpacity : f32,
	uAnimSize : f32,        // entries in the anim lookup, 0 when disabled
	uTint : vec4f,
	uMipmaps : f32,         // 1 under the "linear-mipmap" filter, else 0
	// a staggered or hexagonal map's (see tmxlayer-staggered.wgsl); they
	// fill what was the block's padding
	uStaggerMode : f32,     // 1 when the stagger axis is x, + 2 when the index is even
	uStagger : vec2f,       // (columnwidth, rowheight)
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

struct CellSample {
	hit : bool,
	color : vec4f,
}

// What sampling the atlas needs of a fragment, the same for every cell
// tried for it: taken once, in `fragment_main`, where control flow is still
// uniform (see `footprint` in tmxlayer-common.frag).
struct Footprint {
	gradX : vec2f,
	gradY : vec2f,
	inset : vec2f,
}

fn footprint(worldPx : vec2f) -> Footprint {
	let dWorldX = dpdx(worldPx);
	let dWorldY = dpdy(worldPx);
	// keep the sample half a texel of the level it reads inside the tile,
	// so filtering never blends in the next tile of the tileset, or the
	// spacing around it, along the tile's edge: a seam between two tiles
	// (never past the tile's centre). Without mipmaps that level is the
	// full-size art; under them, the deepest level read is the next one up
	// once the level is past a whole number, by more than a rounding error:
	// drawn at its size, the derivatives are 1 give or take a few ulps, and
	// level 0 it is. Sampled nearest, the sample stays in the same texel
	let lod = ceil(log2(max(max(length(dWorldX), length(dWorldY)), 1.0)) - 0.01);
	let inset = min(vec2f(0.5 * exp2(lod * tmx.uMipmaps)), tmx.uTileSize * 0.5);
	return Footprint(dWorldX * tmx.uInvTilesetSize, dWorldY * tmx.uInvTilesetSize, inset);
}

// Try to render the tile at cell (cx, cy) for the current fragment —
// identical logic to the GLSL tryRenderCell, returning a hit/color pair
// (WGSL has no out parameters).
fn tryRenderCell(cx : i32, cy : i32, worldPx : vec2f, fp : Footprint) -> CellSample {
	var miss : CellSample;
	miss.hit = false;
	miss.color = vec4f(0.0);

	let mapW = i32(tmx.uMapSize.x);
	let mapH = i32(tmx.uMapSize.y);
	if (cx < 0 || cx >= mapW || cy < 0 || cy >= mapH) {
		return miss;
	}

	// the cell's tile does not reach the fragment (where it is drawn from
	// is the orientation's own): known before anything is fetched
	var inTile = (worldPx - tileOrigin(cx, cy)) / tmx.uTileSize;
	if (inTile.x < 0.0 || inTile.x >= 1.0 || inTile.y < 0.0 || inTile.y >= 1.0) {
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

	// the tile's place in the atlas, in whole numbers: a float division
	// may land a hair under the row it should
	let cols = i32(tmx.uTilesetCols.x);
	let row = localId / cols;
	// a tile the tileset's image does not hold (an image cropped since the
	// map was saved): nothing to draw
	if (row >= i32(tmx.uTilesetCols.y)) {
		return miss;
	}
	let tileOriginPx = tmx.uTilesetMargin.xy
		+ vec2f(f32(localId - row * cols), f32(row)) * (tmx.uTileSize + tmx.uTilesetMargin.zw);
	var texelPx = tileOriginPx + inTile * tmx.uTileSize;
	texelPx = clamp(texelPx, tileOriginPx + fp.inset, tileOriginPx + tmx.uTileSize - fp.inset);

	// explicit gradients, so the sample is legal here (non-uniform control
	// flow); a sampler without mipmaps clamps to level 0, as before
	let sampled = textureSampleGrad(
		uTexture,
		uSampler,
		texelPx * tmx.uInvTilesetSize,
		fp.gradX,
		fp.gradY,
	);
	if (sampled.a <= 0.0) {
		return miss;
	}
	var out : CellSample;
	out.hit = true;
	out.color = sampled;
	return out;
}

// A fragment is opaque from this alpha on: nothing behind it would change a
// channel by half a step of 8 bits
const OPAQUE : f32 = 0.998;

// Put a texel behind what a fragment has so far, both premultiplied: what
// drawing the tiles back to front, each over the last, comes to, taken from
// the front. Returns whether the fragment is opaque now, and nothing behind
// it can show
fn under(color : ptr<function, vec4f>, texel : vec4f) -> bool {
	*color += (1.0 - (*color).a) * texel;
	return (*color).a >= OPAQUE;
}

// the layer's opacity and tint applied to a texel. The texel is
// premultiplied, as the blending expects: the opacity scales its color as
// well as its alpha. The tint colors it; its alpha is not an opacity, as on
// a sprite
fn layerColor(texel : vec4f) -> vec4f {
	return texel * tmx.uOpacity * vec4f(tmx.uTint.rgb, 1.0);
}

