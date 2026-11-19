#version 300 es
// Full precision, whatever the application asked for its other shaders
// (`highPrecisionShader`): a fragment's position is in pixels of the map,
// and a gid has 16 bits, which the 16 bits a phone can give a `mediump`
// value do not hold past a small map. The engine's `setPrecision` step
// leaves a shader that declares its own alone.
precision highp float;
precision highp int;

// Fragment shader for the TMX layer GPU renderers (WebGL2 / GLSL ES 3.00):
// the part every map orientation shares. An orientation's own file follows
// it in the program (`orthogonal-tmxlayer.frag`, `isometric-tmxlayer.frag`,
// `staggered-tmxlayer.frag` for staggered and hexagonal maps) and gives the two things that differ: where a cell's tile is drawn
// (`tileOrigin`), and which cells could cover a fragment, front to back
// (`main`).
//
// Per fragment, `main`:
//   1. recovers the fragment's position in the layer from the host UV,
//   2. walks the cells whose tile could cover it, the one drawn last first,
//   3. and for each, `tryRenderCell` fetches the GID from the per-layer
//      index texture and samples the tileset atlas at the right sub-region.
// Each texel found goes behind the ones before it (`under`), until the
// fragment is opaque: the soft edge of a tile shows the tile behind it, as
// it does when the tiles are drawn one over the other.
//
// Index texture encoding (`RGBA8`, one cell per texel):
//   R = GID low byte
//   G = GID high byte    (combined: R | (G << 8) = 16-bit GID)
//   B = flip mask        (bit 0 = H, bit 1 = V, bit 2 = AD)
//   A = unused
//
// Animation lookup (`RGBA8`, 1 row, `tileCount` texels wide): per local
// tile id, the CURRENT frame's local id, same R/G byte-pair encoding.
//
// Why `sampler2D` + float decode rather than `usampler2D`: the engine's
// multi-texture default shader declares `uSampler0..uSamplerN-1` as
// `sampler2D` — all of them are active for WebGL's draw-time validation.
// A `usampler2D`-backed `RGBA8UI` texture cached at any of those units
// (units 0..15 on a typical 16-unit fragment stage) would mismatch when
// the default shader next draws sprites, killing every quad with
// `GL_INVALID_OPERATION`. Staying on regular RGBA8 keeps the cache
// path coherent — the cost is one `floor(c * 255 + 0.5)` per fetch.
//
// `texelFetch` is still used (vs `texture()`) for byte-exact reads —
// it bypasses interpolation, so the integer byte values come out
// unmolested even on a normalized-float sampler.

in vec2 vRegion;
in vec4 vColor;

uniform sampler2D uSampler;      // tileset atlas (RGBA)
uniform sampler2D uTileIndex;    // per-layer GID index (RGBA8)
uniform sampler2D uAnimLookup;   // per-tileset animation table (RGBA8)

uniform vec2 uMapSize;
uniform vec2 uCellSize;
uniform vec2 uTileSize;
uniform vec2 uOverflow;          // how far a tile reaches past its cell (see each `main`)
uniform vec2 uTilesetCols;
uniform vec2 uInvTilesetSize;
uniform vec4 uTilesetMargin;     // (marginX, marginY, spacingX, spacingY)
uniform vec2 uGidRange;          // (firstgid, lastgid)
uniform vec2 uVisibleStart;
uniform vec2 uVisibleSize;
uniform int  uAnimSize;          // number of entries in uAnimLookup, 0 if disabled
uniform float uOpacity;
uniform vec4 uTint;
uniform float uMipmaps;          // 1 under the "linear-mipmap" filter, else 0

out vec4 fragColor;

// Where the tile of cell (cx, cy) is drawn from: the top left corner of its
// image, in the same pixels as `worldPx`. Defined per orientation.
vec2 tileOrigin(int cx, int cy);

// What sampling the atlas needs of a fragment, the same for every cell
// tried for it: taken once, in `main`, where control flow is still uniform.
//
// `gradX` / `gradY` are the atlas coordinate's screen derivatives. The atlas
// coordinate itself jumps from one tile to the next, so its own derivatives
// would pick a tiny mip level along every tile edge; a texel of the atlas is
// a world pixel, so the world's derivatives are the atlas's.
//
// `inset` keeps a sample half a texel of the level it reads inside its tile,
// so filtering never blends in the next tile of the tileset, or the spacing
// around it, along the tile's edge: a seam between two tiles (never past the
// tile's centre). Without mipmaps that level is the full-size art; under
// them, the deepest level read is the next one up once the level is past a
// whole number, by more than a rounding error: drawn at its size, the
// derivatives are 1 give or take a few ulps, and level 0 it is. Sampled
// nearest, the sample stays in the same texel
struct Footprint {
	vec2 gradX;
	vec2 gradY;
	vec2 inset;
};

Footprint footprint(vec2 worldPx) {
	vec2 dWorldX = dFdx(worldPx);
	vec2 dWorldY = dFdy(worldPx);
	float lod = ceil(log2(max(max(length(dWorldX), length(dWorldY)), 1.0)) - 0.01);
	vec2 inset = min(vec2(0.5 * exp2(lod * uMipmaps)), uTileSize * 0.5);
	return Footprint(dWorldX * uInvTilesetSize, dWorldY * uInvTilesetSize, inset);
}

// Try to render the tile at cell (cx, cy) for the current fragment.
// Returns true and writes the sampled color to `outColor` when the cell
// contains a visible, in-range tile whose pixel covers this fragment.
// Identical logic for both fast and slow paths — GLSL inlines this
// trivially so there's no function-call overhead at runtime.
bool tryRenderCell(int cx, int cy, vec2 worldPx, Footprint fp, out vec4 outColor) {
	int mapW = int(uMapSize.x);
	int mapH = int(uMapSize.y);
	if (cx < 0 || cx >= mapW || cy < 0 || cy >= mapH) {
		return false;
	}

	// the cell's tile does not reach the fragment: known before anything
	// is fetched
	vec2 inTile = (worldPx - tileOrigin(cx, cy)) / uTileSize;
	if (inTile.x < 0.0 || inTile.x >= 1.0 || inTile.y < 0.0 || inTile.y >= 1.0) {
		return false;
	}

	// `texelFetch` skips filtering — the 8-bit channel values come back
	// as normalized floats, decoded to byte ints below
	vec4 cellF = texelFetch(uTileIndex, ivec2(cx, cy), 0);
	uvec4 cell = uvec4(cellF * 255.0 + 0.5);
	int firstGid = int(uGidRange.x);
	int gid = int(cell.r) | (int(cell.g) << 8);
	if (gid < firstGid || gid > int(uGidRange.y)) {
		return false;
	}

	// flip mask + axis-swap trick: see TMX shader-path flip spec.
	// AD performs a transpose; with AD set, H and V swap their effective
	// axes (matches the legacy `buildFlipTransform`).
	int flipMask = int(cell.b);
	float flipH = float(flipMask & 1);
	float flipV = float((flipMask >> 1) & 1);
	float flipAD = float((flipMask >> 2) & 1);
	inTile = mix(inTile, inTile.yx, flipAD);
	float effH = mix(flipH, flipV, flipAD);
	float effV = mix(flipV, flipH, flipAD);
	inTile.x = mix(inTile.x, 1.0 - inTile.x, effH);
	inTile.y = mix(inTile.y, 1.0 - inTile.y, effV);

	int localId = gid - firstGid;

	// animation: if the tileset has animated tiles, swap the local id for
	// its current frame's id via the lookup texture (CPU updates the
	// lookup in lockstep with `tileset.update(dt)`).
	if (uAnimSize > 0) {
		vec4 animF = texelFetch(uAnimLookup, ivec2(localId, 0), 0);
		uvec4 animTexel = uvec4(animF * 255.0 + 0.5);
		localId = int(animTexel.r) | (int(animTexel.g) << 8);
	}

	// the tile's place in the atlas, in whole numbers: a float division
	// may land a hair under the row it should
	int cols = int(uTilesetCols.x);
	int row = localId / cols;
	// a tile the tileset's image does not hold (an image cropped since the
	// map was saved): nothing to draw
	if (row >= int(uTilesetCols.y)) {
		return false;
	}
	vec2 tileOriginPx = uTilesetMargin.xy
		+ vec2(float(localId - row * cols), float(row)) * (uTileSize + uTilesetMargin.zw);
	vec2 texelPx = tileOriginPx + inTile * uTileSize;
	texelPx = clamp(texelPx, tileOriginPx + fp.inset, tileOriginPx + uTileSize - fp.inset);

	vec4 sampled = textureGrad(uSampler, texelPx * uInvTilesetSize, fp.gradX, fp.gradY);
	if (sampled.a <= 0.0) {
		return false;
	}
	outColor = sampled;
	return true;
}

// A fragment is opaque from this alpha on: nothing behind it would change a
// channel by half a step of 8 bits
const float OPAQUE = 0.998;

// Put a texel behind what a fragment has so far, both premultiplied: what
// drawing the tiles back to front, each over the last, comes to, taken from
// the front. Returns whether the fragment is opaque now, and nothing behind
// it can show
bool under(inout vec4 color, vec4 texel) {
	color += (1.0 - color.a) * texel;
	return color.a >= OPAQUE;
}

// the layer's opacity and tint applied to a texel. The texel is
// premultiplied, as the blending expects: the opacity scales its color as
// well as its alpha. The tint colors it; its alpha is not an opacity, as on
// a sprite
vec4 layerColor(vec4 texel) {
	return texel * uOpacity * vec4(uTint.rgb, 1.0);
}

