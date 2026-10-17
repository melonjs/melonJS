/**
 * melonJS — Earth Defender: the light a laser bolt throws on the dome.
 *
 * A bolt flies OUTSIDE the glass shell, so the shell is the surface it has
 * something to light. This is that light: a quad laid flat against the
 * curvature under each bolt, drawn additively, with the pool itself shaped
 * entirely in the fragment stage rather than painted into a texture.
 *
 * A `ShaderEffect` hosted on a `Mesh` is a COLOUR hook. It runs after the
 * quad has been placed and cannot move a vertex, which is exactly the right
 * shape for this: the placement is the game's job, since the quad has to
 * track a point on a sphere, and everything the effect does is decide how
 * bright each texel of that quad is.
 *
 * Why a shader and not a texture: the pool is not still. It has a hot core
 * that flickers at the rate the bolt's own emission does, and a ring of
 * light spreading outward from where the bolt is closest to the glass, and
 * both of those are functions of time. A texture would have to be either a
 * frame sequence or a lie.
 *
 * `uPhase` is per bolt. Every pool shares one clock, and without a phase
 * offset a volley of three bolts pulses in lockstep, which reads as one
 * light with three heads rather than three lights.
 *
 * `color` arrives PREMULTIPLIED, so both `rgb` and `a` scale by coverage.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

const glsl = `
uniform float uTime;
uniform float uPhase;
uniform float uExposure;

vec4 apply(vec4 color, vec2 uv) {
	// 0 at the centre of the quad, 1 where the pool has to have died, so
	// the quad's own edges never show as a square of light
	vec2 d = uv - vec2(0.5);
	float r = min(length(d) * 2.0, 1.0);
	float fade = 1.0 - r;

	// the hot centre, tight and bright
	float core = pow(fade, 3.5);
	// the ring: one expanding wavefront per emission, its width growing as
	// it goes so it dissolves instead of stopping
	float t = fract(uTime * 2.2 + uPhase);
	float ring = exp(-pow((r - t) / (0.06 + t * 0.22), 2.0)) * (1.0 - t);
	// and the flicker the bolt itself has
	float pulse = 0.82 + 0.18 * sin(uTime * 26.0 + uPhase * 6.283);

	// The pool's intensity is computed WITHOUT a ceiling and squeezed down
	// afterwards, which is the same HDR response the bolt itself gets: the
	// middle of the pool saturates while the edge keeps lifting, so the
	// light spreads instead of ending at a rim. See the HDR note in
	// constants.ts.
	float energy = (core * pulse * 2.6 + ring * 1.1) * fade;
	float a = 1.0 - exp(-energy * uExposure);
	return vec4(color.rgb * a, color.a * a);
}
`;

const wgsl = `
struct DomeGlowUniforms {
	uTime : f32,
	uPhase : f32,
	uExposure : f32,
};
@group(3) @binding(0) var<uniform> fx : DomeGlowUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let d = uv - vec2f(0.5, 0.5);
	let r = min(length(d) * 2.0, 1.0);
	let fade = 1.0 - r;

	let core = pow(fade, 3.5);
	let t = fract(fx.uTime * 2.2 + fx.uPhase);
	let ring = exp(-pow((r - t) / (0.06 + t * 0.22), 2.0)) * (1.0 - t);
	let pulse = 0.82 + 0.18 * sin(fx.uTime * 26.0 + fx.uPhase * 6.283);

	let energy = (core * pulse * 2.6 + ring * 1.1) * fade;
	let a = 1.0 - exp(-energy * fx.uExposure);
	return vec4f(color.rgb * a, color.a * a);
}
`;

/** the dual-language bodies for the pool of light under a bolt */
export const domeGlow = { glsl, wgsl };
