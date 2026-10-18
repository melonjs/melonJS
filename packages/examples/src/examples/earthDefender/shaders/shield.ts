/**
 * melonJS — Earth Defender: the craft's shield, as a shader.
 *
 * It was a billboard with a painted rim, and it read as a frosted marble
 * with the craft trapped inside it: the paint had to describe the whole
 * shell at once, so the middle could not be clear without the edge being
 * faint. Everything here is computed per fragment instead, from the one
 * quantity that actually matters, which is how obliquely you are looking
 * through the shell at that point.
 *
 * A sphere seen head on has `N.V = sqrt(1 - r*r)` at screen radius `r`, so
 * the grazing angle is known in closed form and the Fresnel-style falloff
 * that follows from it is one line. That is what makes a flat quad read as
 * a sphere rather than as a disc: the brightness is a function of the
 * geometry it is standing in for, not a gradient that resembles one.
 *
 * On top of it, two lights running round it, in opposite directions at
 * rates with no common factor. A shell that only glows is an object; a
 * shell with something travelling across it is a shell with power going
 * through it, and the pass never repeats so the eye keeps finding it.
 *
 * Each is a head with a tail behind it, wrapped around the whole
 * circumference, crossed with a band in the RADIUS. The radius half is
 * what makes it a light rather than a searchlight: an angular band alone
 * is a wedge, and a wedge reaches the middle, so it read as a beam coming
 * off the craft instead of something running round the shell. The tail is
 * measured as angle BEHIND the head in the direction of travel, so it
 * decays all the way round and the ring is never empty.
 *
 * Their positions arrive as `uSpinA` and `uSpinB`, already wrapped into one
 * turn by the game, rather than being derived here from a clock that only
 * ever grows. A shader that computes `mod(angle - uTime * rate, TAU)` is
 * fine for a minute and progressively coarser after that, as the number
 * being wrapped outgrows the precision of the part that matters: the
 * narrower of the two lights was visibly the first to suffer, which is the
 * one that went missing after a while.
 *
 * There is no panel structure. It had a hex grid to echo the dome, and at
 * the size this shell is actually drawn the cells were too small to read
 * as panels: they read as dirt on the lens. The shell is smooth energy,
 * and the only thing crossing it is the light.
 *
 * `uImpact` is the hit: it floods the shell, flares every cell edge, and
 * throws a ring out from the point of contact. `uColor` is the shield's
 * own colour, which the game mixes from full to empty, so the shell and
 * the bar in the corner are always the same colour.
 *
 * The whole thing is finally driven well past one and squeezed back with
 * `1 - exp(-x)`, the same tone curve the bolts use. That is what gives the
 * rim a core that saturates to white while the flanks keep their colour,
 * and what puts it in the range the bloom pass picks up. See the HDR note
 * in `constants.ts`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

const glsl = `
uniform float uTime;
uniform float uSpinA;
uniform float uSpinB;
uniform float uImpact;
uniform float uExposure;
uniform vec3 uColor;

// The shell's silhouette, as a fraction of the quad. It used to BE the quad,
// which left nowhere for a halo to go: anything outside the silhouette was
// outside the geometry. Pulling it in leaves the outer band free, so the
// shell sits tighter around the craft and the glow has somewhere to fall off.
const float SHELL = 0.62;
// how far the three channels part company at the rim
const float ABERRATION = 0.04;

float comet(float behind, float tail) {
	return exp(-behind / tail) * 0.16 + exp(-(behind * behind) / 0.03) * 2.2;
}

// Everything the shell does at ONE radius, so it can be taken three times at
// slightly different radii and split into channels.
float shell(float rq, float ang) {
	// radius within the shell, 0 at the middle and 1 at the silhouette
	float rs = rq / SHELL;
	if (rs > 1.04) {
		return 0.0;
	}
	float rc = min(rs, 1.0);
	float ndotv = sqrt(max(0.0, 1.0 - rc * rc));
	float fresnel = pow(1.0 - ndotv, 3.0);
	float shimmer = 0.85 + 0.15 * sin(uTime * 2.3 + rs * 7.0);

	float behindA = mod(ang - uSpinA, 6.28318531);
	float behindB = mod(uSpinB - ang, 6.28318531);
	// x * x rather than pow(x, 2.0): the base goes negative inside the rim,
	// and pow of a negative base is undefined in GLSL
	float band = (rs - 0.91) / 0.075;
	float onRim = exp(-band * band);
	float arcs = (comet(behindA, 1.5) * 0.85 + comet(behindB, 0.9) * 0.5) * onRim;

	float rw = (rs - (1.0 - uImpact)) * 7.0;
	float ring = exp(-rw * rw) * uImpact;

	float energy = fresnel * 1.25 * shimmer + arcs + uImpact * 0.3 + ring * 0.85;
	// a soft silhouette, so the shell's own edge never aliases
	return energy * smoothstep(1.04, 0.97, rs);
}

vec4 apply(vec4 color, vec2 uv) {
	vec2 d = (uv - vec2(0.5)) * 2.0;
	float r = length(d);
	if (r > 1.0) {
		return vec4(0.0);
	}
	float ang = atan(d.y, d.x);

	// Chromatic aberration. A shell thick enough to bend light bends each
	// wavelength by a different amount, and it bends most where you are
	// looking through the most of it, which is the rim. Ramped by radius so
	// the middle stays clean and only the edge fringes — a uniform split
	// reads as a printing error rather than as refraction.
	float ca = ABERRATION * smoothstep(0.2, 1.0, r / SHELL);
	vec3 energy = vec3(
		shell(r * (1.0 - ca), ang),
		shell(r, ang),
		shell(r * (1.0 + ca), ang)
	);

	// No painted halo. The rim is driven hard enough to clear the scene's
	// bloom threshold instead, and the engine BloomEffect spreads it,
	// which is what makes the light look like it is coming OFF the shell
	// rather than being a ring someone drew around it. It also means the
	// halo picks up the aberration fringe for free, because bloom spreads
	// whatever colour it finds.
	vec3 mapped = vec3(1.0) - exp(-uColor * energy * uExposure);
	// a soft cut at the QUAD's edge, so the halo fades out rather than ending
	float cut = smoothstep(1.0, 0.86, r);
	return vec4(mapped * cut * color.a, color.a * cut);
}
`;

const wgsl = `
struct ShieldUniforms {
	uTime : f32,
	uSpinA : f32,
	uSpinB : f32,
	uImpact : f32,
	uExposure : f32,
	uColor : vec3f,
};
@group(3) @binding(0) var<uniform> fx : ShieldUniforms;

const SHELL : f32 = 0.62;
const ABERRATION : f32 = 0.04;

fn comet(behind : f32, tail : f32) -> f32 {
	return exp(-behind / tail) * 0.16 + exp(-(behind * behind) / 0.03) * 2.2;
}

fn shell(rq : f32, ang : f32) -> f32 {
	let rs = rq / SHELL;
	if (rs > 1.04) {
		return 0.0;
	}
	let rc = min(rs, 1.0);
	let ndotv = sqrt(max(0.0, 1.0 - rc * rc));
	let fresnel = pow(1.0 - ndotv, 3.0);
	let shimmer = 0.85 + 0.15 * sin(fx.uTime * 2.3 + rs * 7.0);

	// "%" in WGSL is the REMAINDER, not a modulo: it keeps the sign of the
	// dividend, so half the ring comes back NEGATIVE, and exp(-behind/tail)
	// is then exp of a large POSITIVE number there. That is the fixed bright
	// half circle. GLSL mod has no such problem, which is why this only ever
	// showed on the WebGPU path.
	let behindA = ((ang - fx.uSpinA) % 6.28318531 + 6.28318531) % 6.28318531;
	let behindB = ((fx.uSpinB - ang) % 6.28318531 + 6.28318531) % 6.28318531;
	let band = (rs - 0.91) / 0.075;
	let onRim = exp(-band * band);
	let arcs = (comet(behindA, 1.5) * 0.85 + comet(behindB, 0.9) * 0.5) * onRim;

	let rw = (rs - (1.0 - fx.uImpact)) * 7.0;
	let ring = exp(-rw * rw) * fx.uImpact;

	let energy = fresnel * 1.25 * shimmer + arcs + fx.uImpact * 0.3 + ring * 0.85;
	return energy * smoothstep(1.04, 0.97, rs);
}

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let d = (uv - vec2f(0.5)) * 2.0;
	let r = length(d);
	if (r > 1.0) {
		return vec4f(0.0);
	}
	let ang = atan2(d.y, d.x);

	let ca = ABERRATION * smoothstep(0.2, 1.0, r / SHELL);
	let energy = vec3f(
		shell(r * (1.0 - ca), ang),
		shell(r, ang),
		shell(r * (1.0 + ca), ang)
	);

	let mapped = vec3f(1.0) - exp(-fx.uColor * energy * fx.uExposure);
	let cut = smoothstep(1.0, 0.86, r);
	return vec4f(mapped * cut * color.a, color.a * cut);
}
`;

/** the dual-language bodies for the craft's shield */
export const shieldShell = { glsl, wgsl };
