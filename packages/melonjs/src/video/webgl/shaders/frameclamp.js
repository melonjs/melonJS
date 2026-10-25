/**
 * Keeping a sprite's samples inside its own frame, in the default sprite
 * shaders (GLSL ES 3.00). The WGSL twins live in `quad.wgsl` and
 * `quad-lit.wgsl`.
 *
 * A sprite cut from an atlas or a tileset draws one frame of a bigger
 * texture, and the texture goes on past the frame into the neighbouring
 * ones. Sampling reaches past the point it reads by half a texel of the
 * level it reads, so a sample near the frame's edge picks up a little of
 * the next frame. At full size that is half a texel, and mostly invisible;
 * read from a small mipmap level, a texel spans many of the art's pixels,
 * and the next frame's edge shows as a faint line along the sprite's.
 *
 * Every sprite vertex carries the UV of its quad's opposite corner
 * (`aFrame`), so with its own UV the vertex knows the quad's frame. The
 * fragment keeps its sample half a texel of the deepest level it reads
 * inside that frame, as the orthogonal tilemap shader keeps a tile's. A
 * quad with no frame of its own (a repeating pattern, a render target
 * blit) carries {@link FRAME_UNBOUNDED} instead and is left alone.
 *
 * `uFrameClamp` says how (see `gpu/frame.js`): 0 off, where every sprite
 * samples as it always did; 1 half a texel of the full-size art, for a tile
 * layer drawn tile by tile, whose tiles must not blend with the next tile
 * of their tileset; 2 half a texel of the level read, under the
 * `"linear-mipmap"` texture filter.
 * @ignore
 */

/**
 * The fragment-stage half: `frameSample(s, uv, gx, gy)` samples `s` at `uv`,
 * kept inside the quad's frame when `uFrameClamp` is on. `gx` and `gy` are
 * the UV's screen derivatives, taken where control flow is uniform (the
 * texture slot ladder is not), so the clamped sample reads the level the
 * unclamped one would.
 *
 * The vertex-stage half lives in `quad-multi.vert` and `quad-multi-lit.vert`
 * (static sources): `vFrame`, the quad's frame from the vertex's own UV and
 * `aFrame`, is the same for all four corners, so plain interpolation
 * carries it unchanged. `aFrame` is the fifth attribute of every sprite
 * layout: after the attributes a custom shader declares, so those keep
 * their locations, and before anything a layout adds (the lit extras), so
 * an effect's program reads it on any sprite layout.
 * @ignore
 * @internal
 */
export const FRAME_FRAGMENT_GLSL = `
uniform float uFrameClamp;
in vec4 vFrame;
vec4 frameSample(sampler2D s, vec2 uv, vec2 gx, vec2 gy) {
	if (uFrameClamp < 0.5) {
		return texture(s, uv);
	}
	vec2 size = vec2(textureSize(s, 0));
	// the deepest level read: the next one up once past a whole level, by
	// more than a rounding error (drawn at its size, the derivatives are 1
	// give or take a few ulps, and that is level 0). Without mipmaps, the
	// full-size art is the only level
	float lod = uFrameClamp > 1.5
		? ceil(log2(max(max(length(gx * size), length(gy * size)), 1.0)) - 0.01)
		: 0.0;
	// half a texel of it, never past the frame's centre
	vec2 inset = min(vec2(0.5 * exp2(lod)) / size, (vFrame.zw - vFrame.xy) * 0.5);
	return textureGrad(s, clamp(uv, vFrame.xy + inset, vFrame.zw - inset), gx, gy);
}
`;
