#version 300 es

// Fragment shader for the orthogonal TMX layer GPU renderer (WebGL2 /
// GLSL ES 3.00).
//
// Per fragment the shader:
//   1. recovers the world-pixel position from the host UV,
//   2. walks candidate cells (geometric cell + cells whose oversized,
//      bottom-aligned tiles could reach this fragment),
//   3. fetches GIDs from the per-layer index texture, and
//   4. samples the tileset atlas at the correct sub-region.
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
// dx low→high and picks the FIRST match.
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

// The engine's `setPrecision` step injects precision declarations for
// float and int after the `#version` line, using whatever precision the
// renderer was configured with (`highPrecisionShader` setting on the
// Application). Individual shader files don't hardcode precision so the
// engine-wide preference applies.

in vec2 vRegion;
in vec4 vColor;

uniform sampler2D uSampler;      // tileset atlas (RGBA)
uniform sampler2D uTileIndex;    // per-layer GID index (RGBA8)
uniform sampler2D uAnimLookup;   // per-tileset animation table (RGBA8)

uniform vec2 uMapSize;
uniform vec2 uCellSize;
uniform vec2 uTileSize;
uniform vec2 uOverflow;
uniform vec2 uTilesetCols;
uniform vec2 uInvTilesetSize;
uniform vec4 uTilesetMargin;     // (marginX, marginY, spacingX, spacingY)
uniform vec2 uGidRange;          // (firstgid, lastgid)
uniform vec2 uVisibleStart;
uniform vec2 uVisibleSize;
uniform int  uAnimSize;          // number of entries in uAnimLookup, 0 if disabled
uniform float uOpacity;
uniform vec4 uTint;

out vec4 fragColor;

const int MAX_OVERFLOW = 4;

// Try to render the tile at cell (cx, cy) for the current fragment.
// Returns true and writes the sampled color to `outColor` when the cell
// contains a visible, in-range tile whose pixel covers this fragment.
// Identical logic for both fast and slow paths — GLSL inlines this
// trivially so there's no function-call overhead at runtime.
bool tryRenderCell(int cx, int cy, vec2 worldPx, out vec4 outColor) {
	int mapW = int(uMapSize.x);
	int mapH = int(uMapSize.y);
	if (cx < 0 || cx >= mapW || cy < 0 || cy >= mapH) {
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

	vec2 tileWorldOrigin = vec2(
		float(cx) * uCellSize.x,
		(float(cy) + 1.0) * uCellSize.y - uTileSize.y
	);
	vec2 inTile = (worldPx - tileWorldOrigin) / uTileSize;
	if (inTile.x < 0.0 || inTile.x >= 1.0 || inTile.y < 0.0 || inTile.y >= 1.0) {
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

	float row = floor(float(localId) / uTilesetCols.x);
	float col = float(localId) - row * uTilesetCols.x;
	vec2 tileOriginPx = uTilesetMargin.xy
		+ vec2(col, row) * (uTileSize + uTilesetMargin.zw);
	vec2 texelPx = tileOriginPx + inTile * uTileSize;
	vec2 texelUV = texelPx * uInvTilesetSize;

	vec4 sampled = texture(uSampler, texelUV);
	if (sampled.a <= 0.0) {
		return false;
	}
	outColor = sampled;
	return true;
}

void main(void) {
	vec2 tileCoord = uVisibleStart + vRegion * uVisibleSize;
	vec2 geomCell = floor(tileCoord);
	vec2 worldPx = tileCoord * uCellSize;

	int gx = int(geomCell.x);
	int gy = int(geomCell.y);
	int overflowX = int(uOverflow.x + 0.5);
	int overflowY = int(uOverflow.y + 0.5);

	vec4 result;

	// Fast path: tiles fit the cell exactly (the common case) — only the
	// geometric cell can contain this fragment's tile.
	if (overflowX == 0 && overflowY == 0) {
		if (!tryRenderCell(gx, gy, worldPx, result)) {
			discard;
		}
		result.a *= uOpacity;
		fragColor = result * uTint;
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
			if (tryRenderCell(gx - dx, gy + dy, worldPx, result)) {
				found = true;
				break;
			}
		}
		if (found) break;
	}
	if (!found) discard;
	result.a *= uOpacity;
	fragColor = result * uTint;
}
