/**
 * melonJS — Jungle Rabbit: a rippling river surface.
 *
 * The water already carries a `NoiseTexture2d`, which gives the surface its
 * broken, glittering texture — but noise has no DIRECTION and no relief, so
 * on its own the river reads as sparkling rather than as moving water.
 *
 * This is a `ShaderEffect` hosted on a `Mesh` — the thing #1658 was opened
 * about. A hosted effect is a COLOUR hook: it runs after the mesh has been
 * placed, lit and textured, and it cannot move a vertex. So these ripples are
 * not displacement — they are the SHADING displacement would have produced.
 *
 * A height field `h(uv, t)` is summed from three crossing wave trains, and
 * because each term is a sine of an argument linear in `uv`, its gradient is
 * available in closed form — one `cos` per wave, no sampling and no
 * neighbour taps. That gradient becomes a surface normal, and lighting it
 * gives every crest a lit face and a shaded one.
 *
 * That light/dark pairing travelling across the surface is what the eye reads
 * as water deforming. A purely additive highlight — which is what this was
 * first — reads instead as white patches sliding over a flat sheet, because a
 * flat sheet is exactly what it is.
 *
 * Three trains rather than two, at frequencies with no common factor: two
 * beat against each other and the interference repeats visibly, which reads
 * as a rolling moiré rather than as a river.
 *
 * Frequencies are tuned to the plane's own UVs rather than to 0..1: the water
 * samples a REPEATING texture, so `vRegion` runs about 0..2.9 across the
 * channel and −4.6..14.6 along it (`RIPPLE_UV`). A 0..1-shaped shader would
 * land dozens of cycles per pixel here and alias into noise.
 *
 * `color` arrives PREMULTIPLIED, so the shading scales `rgb` and leaves alpha
 * alone, and the glint is scaled by coverage — the surface is translucent,
 * and adding unscaled light would make the shallow edges glow brighter than
 * the deep middle.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

const glsl = `
uniform float uTime;

vec4 apply(vec4 color, vec2 uv) {
	// Each train contributes its height and its exact gradient: the
	// derivative of A·sin(k·uv + φ) with respect to uv is A·k·cos(k·uv + φ).
	float h = 0.0;
	vec2 grad = vec2(0.0);

	vec2 d1 = vec2(0.87, 0.49);
	float p1 = dot(uv, d1) * 5.3 + uTime * 1.55;
	h += sin(p1) * 0.55;
	grad += d1 * (5.3 * 0.55 * cos(p1));

	vec2 d2 = vec2(-0.44, 0.90);
	float p2 = dot(uv, d2) * 8.9 - uTime * 2.10;
	h += sin(p2) * 0.32;
	grad += d2 * (8.9 * 0.32 * cos(p2));

	vec2 d3 = vec2(0.62, -0.78);
	float p3 = dot(uv, d3) * 14.6 + uTime * 3.30;
	h += sin(p3) * 0.14;
	grad += d3 * (14.6 * 0.14 * cos(p3));

	// the normal of the surface that height field describes. The middle term
	// is the slope scale: larger flattens the water, smaller corrugates it
	vec3 n = normalize(vec3(-grad.x, 2.4, -grad.y));

	// A low, raking light. Coming in almost flat is what drops the far side
	// of each crest into shade instead of lifting the whole surface.
	vec3 lightDir = normalize(vec3(-0.45, 0.82, 0.36));
	float lambert = max(dot(n, lightDir), 0.0);

	// the lit/shaded pairing — the part that actually reads as relief
	vec3 shaded = color.rgb * mix(0.80, 1.16, lambert);

	// and a tight glint riding the crests, so the surface still sparkles
	float glint = pow(lambert, 42.0) * max(h, 0.0) * 0.55;

	return vec4(shaded + glint * color.a, color.a);
}
`;

const wgsl = `
struct RippleUniforms {
	uTime : f32,
};
@group(3) @binding(0) var<uniform> fx : RippleUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	var h = 0.0;
	var grad = vec2f(0.0, 0.0);

	let d1 = vec2f(0.87, 0.49);
	let p1 = dot(uv, d1) * 5.3 + fx.uTime * 1.55;
	h += sin(p1) * 0.55;
	grad += d1 * (5.3 * 0.55 * cos(p1));

	let d2 = vec2f(-0.44, 0.90);
	let p2 = dot(uv, d2) * 8.9 - fx.uTime * 2.10;
	h += sin(p2) * 0.32;
	grad += d2 * (8.9 * 0.32 * cos(p2));

	let d3 = vec2f(0.62, -0.78);
	let p3 = dot(uv, d3) * 14.6 + fx.uTime * 3.30;
	h += sin(p3) * 0.14;
	grad += d3 * (14.6 * 0.14 * cos(p3));

	let n = normalize(vec3f(-grad.x, 2.4, -grad.y));
	let lightDir = normalize(vec3f(-0.45, 0.82, 0.36));
	let lambert = max(dot(n, lightDir), 0.0);

	let shaded = color.rgb * mix(vec3f(0.80), vec3f(1.16), vec3f(lambert));
	let glint = pow(lambert, 42.0) * max(h, 0.0) * 0.55;

	return vec4f(shaded + glint * color.a, color.a);
}
`;

/** the dual-language bodies for the river's rippling surface */
export const ripples = { glsl, wgsl };
