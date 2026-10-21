/**
 * melonJS — Platformer (Matter): the wind sway on the background hills.
 *
 * A `ShaderEffect` body that leans the round cactus pillars of the
 * background image from side to side, as if a breeze were going through
 * them. Each row of the image is sampled a little to the left or right, by
 * a sine of the time, and by more the higher up the row is: the tips move
 * most and the feet stay planted. It moves pixels, not geometry, so it costs
 * one texture read, the same as drawing the layer without it.
 *
 * `uBase` is the row the pillars stand on, as a fraction of the image height
 * (0 at the top). Nothing below it moves, so the hills they stand in stay put
 * while the pillars bend. At 1 the whole image is anchored at its bottom row
 * instead, which is the usual sway for a sprite whose feet are its last row.
 *
 * `uPhase` is the time already multiplied by the speed and wrapped to one
 * turn, in radians. The platformer runs with `highPrecisionShader: false`,
 * and on a phone a medium-precision float holds a handful of significant
 * digits: a raw clock in seconds would make the sway stutter a few minutes
 * into a session. Wrapped on the CPU, it never grows.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

const glsl = `
uniform float uStrength;
uniform float uBase;
uniform float uPhase;

vec4 apply(vec4 color, vec2 uv) {
	float bend = clamp((uBase - uv.y) / uBase, 0.0, 1.0);
	float sway = sin(uPhase + uv.y * 3.0) * uStrength * bend;
	return texture2D(uSampler, vec2(uv.x + sway, uv.y)) * vColor;
}
`;

const wgsl = `
struct SwayUniforms {
	uStrength : f32,
	uBase : f32,
	uPhase : f32,
};
@group(3) @binding(0) var<uniform> fx : SwayUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let bend = clamp((fx.uBase - uv.y) / fx.uBase, 0.0, 1.0);
	let sway = sin(fx.uPhase + uv.y * 3.0) * fx.uStrength * bend;
	return textureSample(uTexture, uSampler, vec2f(uv.x + sway, uv.y)) * vColor;
}
`;

/** the dual-language sway body, preloaded as a `"shader"` asset */
export const sway = { glsl, wgsl };
