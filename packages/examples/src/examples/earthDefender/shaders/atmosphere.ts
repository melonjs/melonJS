/**
 * melonJS — Earth Defender: the air around the planet.
 *
 * The globe ended at its silhouette, hard, against the nebula. Nothing
 * else says "planet" as economically as the band of lit air just past the
 * limb, and nothing else makes the black edge of a sphere read as distance
 * rather than as a cut-out.
 *
 * It is a billboard, not a shell. A sphere seen head on has
 * `N.V = sqrt(1 - r*r)` at screen radius `r`, so everything about how the
 * air is angled to the viewer is a function of the distance from the
 * middle of the quad, which is exactly what a flat quad has. The same
 * reasoning the craft's shield is built on.
 *
 * Two terms. A wide band fading outward is the air itself, and a tight
 * line right at the silhouette is the part of it you are looking through
 * edge on, which is where it is densest. The quad is larger than the
 * planet and drawn BEHIND it, so the planet occludes everything inside
 * its own outline and what survives is the ring.
 *
 * And it is brighter on the lit side. `uSun` is the screen direction the
 * light arrives from, so the atmosphere swells where the sun is and
 * thins to almost nothing on the night limb, which is what stops it
 * reading as a sticker ring drawn round the planet.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

const glsl = `
uniform float uInner;
uniform float uFalloff;
uniform float uExposure;
uniform vec2 uSun;
uniform vec3 uColor;

vec4 apply(vec4 color, vec2 uv) {
	vec2 d = (uv - vec2(0.5)) * 2.0;
	float r = length(d);
	if (r > 1.0) {
		return vec4(0.0);
	}

	// how far past the planet's own outline this fragment is
	float beyond = r - uInner;
	// the air, thinning outward
	float bt = max(beyond, 0.0) / uFalloff;
	float band = exp(-bt * bt);
	// and the dense line at the limb, where you look through the most of it.
	// x * x rather than pow(x, 2.0): beyond goes negative inside the
	// outline, and pow of a negative base is undefined in GLSL
	float rt = beyond / (uFalloff * 0.14);
	float rim = exp(-rt * rt);

	// brightest where the light comes from, almost gone on the night limb
	float lit = 0.18 + 0.82 * max(0.0, dot(d / max(r, 0.0001), uSun));

	// Driven so the DAY limb clears the scene's bloom threshold and the
	// engine's BloomEffect spreads it, the same way the shield's rim is fed.
	// lit falls to 0.18 on the night limb, so only the sunward side blooms
	// and the terminator still reads as a terminator.
	float energy = (band * 0.85 + rim * 1.7) * lit;
	vec3 mapped = vec3(1.0) - exp(-uColor * energy * uExposure);
	float cut = smoothstep(1.0, 0.92, r);
	return vec4(mapped * cut * color.a, color.a * cut);
}
`;

const wgsl = `
struct AtmosphereUniforms {
	uInner : f32,
	uFalloff : f32,
	uExposure : f32,
	uSun : vec2f,
	uColor : vec3f,
};
@group(3) @binding(0) var<uniform> fx : AtmosphereUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let d = (uv - vec2f(0.5)) * 2.0;
	let r = length(d);
	if (r > 1.0) {
		return vec4f(0.0);
	}

	let beyond = r - fx.uInner;
	let bt = max(beyond, 0.0) / fx.uFalloff;
	let band = exp(-bt * bt);
	let rt = beyond / (fx.uFalloff * 0.14);
	let rim = exp(-rt * rt);

	let lit = 0.18 + 0.82 * max(0.0, dot(d / max(r, 0.0001), fx.uSun));

	let energy = (band * 0.85 + rim * 1.7) * lit;
	let mapped = vec3f(1.0) - exp(-fx.uColor * energy * fx.uExposure);
	let cut = smoothstep(1.0, 0.92, r);
	return vec4f(mapped * cut * color.a, color.a * cut);
}
`;

/** the dual-language bodies for the planet's atmosphere */
export const atmosphere = { glsl, wgsl };
