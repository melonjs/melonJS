/**
 * melonJS — Earth Defender: the blast wave a rock leaves behind.
 *
 * A spherical CAP laid on the globe where the rock died, drawn additively,
 * with the whole wave shaped in the fragment stage. Nothing about it is
 * painted: the ring, its width, its speed and its fade are all functions of
 * one number, the age of the blast, which the game hands over as `uAge`
 * running 0 to 1.
 *
 * A cap and not a quad. A flat quad tangent to the planet is fine while it
 * is small and near the middle of the frame, and reads as a sticker
 * standing off the surface the moment it is either large or near the limb.
 * The mesh is a patch of a UNIT sphere, so scaling it to the altitude the
 * blast happened at gives exactly the planet's curvature, at any size.
 *
 * Which is why the blast's size is NOT the mesh's scale: the mesh scale is
 * pinned to the altitude, and `uSize` tells the shader what fraction of its
 * own patch the wave is allowed to fill. Two different jobs that a single
 * scale factor cannot do at once.
 *
 * The front DECELERATES. A front that expands linearly reads as a circle
 * being scaled up, because that is exactly what it is; a real blast dumps
 * its energy at the start and slows as it spreads, so the radius goes as
 * `1 - (1 - t)^2` and the band widens as it goes. Widening is what makes
 * it dissolve rather than stop.
 *
 * It is a BAND, not a line: solid behind the front and fading to nothing
 * at the leading edge, with a soft inner edge behind it. A thin ring reads
 * as a drawn circle; a band with a gradient reads as a volume of hot gas
 * being pushed outward, which is what it is meant to be.
 *
 * It is red on purpose, and white only at the very centre and only at the
 * very beginning: a blast that is uniformly white is a flashbulb, and one
 * that never reaches white has nothing hot in it.
 *
 * `uSize` comes from the radius of the rock that made it, so a pebble
 * leaves a puff and a boulder leaves something worth flying away from.
 *
 * Driven past one and squeezed back with `1 - exp(-x)`, the same tone
 * curve the bolts and the shield use, so the front saturates into the
 * bloom pass instead of clipping flat. See the HDR note in `constants.ts`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

const glsl = `
uniform float uAge;
uniform float uSize;
uniform float uExposure;
uniform vec3 uColor;

vec4 apply(vec4 color, vec2 uv) {
	vec2 d = (uv - vec2(0.5)) * 2.0;
	// 0 at the middle of the blast, 1 where the blast has to have died,
	// which is a fraction of the patch rather than all of it
	float r = length(d) / max(uSize, 0.001);
	if (r > 1.0) {
		return vec4(0.0);
	}
	float t = clamp(uAge, 0.0, 1.0);

	// the front: fast, then slowing, with the band behind it widening
	float front = 1.0 - (1.0 - t) * (1.0 - t);
	float width = 0.22 + 0.34 * t;
	float inner = max(0.0, front - width);
	// full just behind the front and gone AT it, which is the gradient to
	// transparent on the outer edge
	float ring = smoothstep(front, inner, r);
	// and a soft inner edge, so the band has a back as well as a front
	ring *= smoothstep(inner - 0.20, inner + 0.03, r);

	// ragged rather than perfectly round: a blast off a lump of rock is
	// not a circle, and the eye reads the wobble as debris
	float ang = atan(d.y, d.x);
	ring *= 0.72 + 0.28 * sin(ang * 7.0 + t * 3.0);

	// the flash at the middle, gone almost at once
	float core = exp(-(r * r) / 0.05) * (1.0 - t) * (1.0 - t) * (1.0 - t);

	// and the whole thing fading as it goes
	float fade = 1.0 - t;
	float energy = (ring * 2.0 + core * 3.8) * fade;

	// Its own red nearly everywhere, white only at the very middle of the
	// very first frames. The white is an ADDITION to every channel, so a
	// generous one bleaches the blast into a flashbulb and throws away the
	// colour that makes it read as fire.
	vec3 hot = uColor * energy + vec3(core * 0.8 * fade);
	vec3 mapped = vec3(1.0) - exp(-hot * uExposure);
	float cut = smoothstep(1.0, 0.93, r);
	return vec4(mapped * cut * color.a, color.a * cut);
}
`;

const wgsl = `
struct ShockUniforms {
	uAge : f32,
	uSize : f32,
	uExposure : f32,
	uColor : vec3f,
};
@group(3) @binding(0) var<uniform> fx : ShockUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let d = (uv - vec2f(0.5)) * 2.0;
	let r = length(d) / max(fx.uSize, 0.001);
	if (r > 1.0) {
		return vec4f(0.0);
	}
	let t = clamp(fx.uAge, 0.0, 1.0);

	let front = 1.0 - (1.0 - t) * (1.0 - t);
	let width = 0.22 + 0.34 * t;
	let inner = max(0.0, front - width);
	var ring = smoothstep(front, inner, r);
	ring *= smoothstep(inner - 0.20, inner + 0.03, r);

	let ang = atan2(d.y, d.x);
	ring *= 0.72 + 0.28 * sin(ang * 7.0 + t * 3.0);

	let core = exp(-(r * r) / 0.05) * (1.0 - t) * (1.0 - t) * (1.0 - t);

	let fade = 1.0 - t;
	let energy = (ring * 2.0 + core * 3.8) * fade;

	let hot = fx.uColor * energy + vec3f(core * 0.8 * fade);
	let mapped = vec3f(1.0) - exp(-hot * fx.uExposure);
	let cut = smoothstep(1.0, 0.93, r);
	return vec4f(mapped * cut * color.a, color.a * cut);
}
`;

/** the dual-language bodies for a rock's blast wave */
export const shockwave = { glsl, wgsl };
