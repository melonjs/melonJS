/**
 * Keeping an effect's samples inside the sprite's own frame.
 *
 * A sprite drawn from an atlas or a tileset shows one frame of a bigger
 * texture, and the texture goes on past that frame into the neighbouring
 * ones. An effect that samples away from the fragment it shades (a glow, an
 * outline, a blur, a shadow, a distortion) reads those neighbours along the
 * frame's edge, and draws them. The quad batchers hand the effect the frame
 * it draws, as `ME_frame` (its UV rect: left, top, right, bottom) and
 * `ME_frame_half` (half a texel of its texture, in UV), through
 * `ShaderEffect#_setFrameRect`. `frameTexel()` reads a texel of that frame:
 * transparent outside it, and kept half a texel inside it, so filtering
 * never reaches over the edge. Only where another frame could be: a side of
 * the frame that is the texture's own edge is left unbounded, and so is a
 * pass over a whole texture (a render target blit, a mesh). There, sampling
 * is what it always was.
 * @ignore
 */

/**
 * the uniforms and `frameTexel()`, for a GLSL effect body
 * @ignore
 */
export const FRAME_GLSL = `
uniform vec4 ME_frame;
uniform vec2 ME_frame_half;
vec4 frameTexel(vec2 p) {
	vec2 inside = step(ME_frame.xy, p) * step(p, ME_frame.zw);
	vec2 q = clamp(p, ME_frame.xy + ME_frame_half, ME_frame.zw - ME_frame_half);
	return texture2D(uSampler, q) * (inside.x * inside.y);
}
`;

/**
 * the members to add to a WGSL effect's uniform struct, which `frameTexel()`
 * reads through the effect's `fx` binding
 * @ignore
 */
export const FRAME_WGSL_MEMBERS = `
	ME_frame : vec4f,
	ME_frame_half : vec2f,`;

/**
 * `frameTexel()` for a WGSL effect body, sampling with implicit derivatives
 * (uniform control flow only), and `frameTexelLevel()`, sampling level 0,
 * which works anywhere
 * @ignore
 */
export const FRAME_WGSL = `
fn frameUV(p : vec2f) -> vec2f {
	return clamp(p, fx.ME_frame.xy + fx.ME_frame_half, fx.ME_frame.zw - fx.ME_frame_half);
}
fn frameInside(p : vec2f) -> f32 {
	let inside = step(fx.ME_frame.xy, p) * step(p, fx.ME_frame.zw);
	return inside.x * inside.y;
}
fn frameTexel(p : vec2f) -> vec4f {
	return textureSample(uTexture, uSampler, frameUV(p)) * frameInside(p);
}
fn frameTexelLevel(p : vec2f) -> vec4f {
	return textureSampleLevel(uTexture, uSampler, frameUV(p), 0.0) * frameInside(p);
}
`;
