/**
 * melonJS — Jungle Rabbit: the sun's lens flare.
 *
 * A `ShaderEffect` hosted on a screen-filling sprite rather than a post-effect
 * on the camera. That is an ordering decision, not a performance one: a
 * camera's post-effect brackets the WHOLE world draw, floating children
 * included, so it would wash straight over the HUD. A quad ordered by depth
 * draws after the world and before the score, which is where a flare belongs.
 *
 * Because the quad fills the frame, its own `uv` IS screen space — which is why
 * this needs none of `screen_uv` / `screen_texture`, the builtins a hosted
 * effect is not allowed (#1658). The sprite's own texture is never read either:
 * `apply` ignores the incoming `color` and returns its own alpha, so the image
 * exists only to give the effect a quad to run on.
 *
 * ## Why spikes, and why a shader at all
 *
 * The first version of this was four additive sprites. On a bright daylight sky
 * they were invisible: additive light saturates every channel to white, and a
 * soft disc at low alpha reads as a smudge. A sky has no STRUCTURE, so shape is
 * what survives it — a thin bright ray is legible against pale blue where a
 * round glow is not. Spikes are an angular function, which a handful of quads
 * cannot express and a fragment shader gets for one `sin`.
 *
 * The ghosts survive here for the same reason they died as sprites only if they
 * stay dim: they are a coloured bloom along the sun's line, not four more dots.
 *
 * Everything is driven by where the sun lands on screen, so steering and
 * jumping sweep the whole flare across the frame — the only reason a flare is
 * worth having.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

/*
 * The parameters, written once per language because the two bodies must agree.
 * `uSunX`/`uSunY` are the sun in the quad's uv space; `uIntensity` fades the
 * lot as the sun nears the edge of the frame.
 *
 * Three scalars rather than a `vec2` and a float: all-`f32` members need no
 * thought about WGSL's uniform alignment rules, and there are only three.
 *
 * No `uUVYDir`. It corrects bodies that do vertical UV arithmetic on the WebGL
 * POOLED path, and a single effect on a plain renderable never takes it — the
 * direct path has `uv.y` growing downward on both backends, same as WebGPU.
 */

/** frame aspect (480x270): undo it, or a round burst comes out an ellipse */
const ASPECT = "1.7777778";

/**
 * Master opacity for the whole effect — burst, streak and ghosts alike.
 *
 * One knob rather than a dozen: the relative balance between the elements is
 * tuned, so dimming the lot is a single multiply. Raise it and every part comes
 * up together; the individual constants set proportion, this sets presence.
 *
 * Deliberately low. A flare is atmosphere, not a game element — the moment it
 * is obvious enough to look AT, it is competing with the river for the player's
 * attention, and the river is the thing being steered.
 */
const STRENGTH = "0.44";

/** where the ghost chain pivots in uv x — see `ghostAt` for why not 0.5 */
const PIVOT_X = "0.425";

const glsl = `
uniform float uSunX;
uniform float uSunY;
uniform float uIntensity;

// Where a displaced ghost sits: on the line through the sun and the pivot, as
// a fraction of the distance between them — so at = 1 is the sun itself,
// at = 0 the pivot, and a negative value runs out the far side. Measured
// from the PIVOT, not the frame centre: offset the pivot while still measuring
// from the centre and the chain becomes a line parallel to the sun's axis but
// displaced off it, so the ghosts stop pointing at the sun at all.
//
// The chain would run through the frame centre — except the boat sits
// just below that centre, so a ghost landed squarely on the rabbit's head and
// pulled the eye off the thing being steered. Nudged off-axis: a flare's
// elements sitting slightly off the optical centre is ordinary, and it keeps
// the chain beside the player rather than on top of them.
vec2 ghostAt(vec2 sun, float at) {
	vec2 pivot = vec2(${PIVOT_X}, 0.5);
	return pivot + (sun - pivot) * at;
}

// Chromatic dispersion. Glass refracts each wavelength by a different amount,
// so a flare element carries a warm fringe on one side and a cool one on the
// other. This is what makes the chain read as an optical artefact rather than
// as coloured dots — and, like the spikes, it survives a bright sky because it
// is an EDGE. A flat hue added to pale blue just saturates to white.
const vec3 DISPERSE = vec3(1.16, 1.0, 0.86);

// a filled ghost, each channel at its own radius
vec3 ghost(vec2 uv, vec2 sun, float at, float size, vec3 tint) {
	vec2 d = (uv - ghostAt(sun, at)) * vec2(${ASPECT}, 1.0);
	vec3 sz = size * DISPERSE;
	return tint * exp(-vec3(dot(d, d)) / (sz * sz));
}

// A RING ghost. Filled discs are what the sprite version died of: added to a
// bright sky they saturate to white and the colour that makes a ghost read as
// lens glass is the first thing lost. An annulus keeps an edge, and an edge
// survives a background a fill cannot.
vec3 ring(vec2 uv, vec2 sun, float at, float radius, float w, vec3 tint) {
	vec2 d = (uv - ghostAt(sun, at)) * vec2(${ASPECT}, 1.0);
	vec3 e = (vec3(length(d)) - radius * DISPERSE) / w;
	return tint * exp(-e * e);
}

vec4 apply(vec4 color, vec2 uv) {
	vec2 sun = vec2(uSunX, uSunY);
	vec2 d = (uv - sun) * vec2(${ASPECT}, 1.0);
	float r = length(d);
	float a = atan(d.y, d.x);

	// The burst. A high power on |sin| is what turns a smooth wave into thin
	// spikes: by 22 the lobes are narrow and the gaps between them are flat.
	// Two sets at different counts, offset in phase, so it does not read as a
	// tidy fan.
	// Ray lengths VARY. A perfectly even fan is the thing that reads as
	// computer-generated — real glass scatters unevenly, so every ray reaching
	// exactly as far as its neighbours is the first tell. Two incommensurate
	// sines give each spike its own reach without needing a noise texture.
	float vary = 0.70 + 0.30 * sin(a * 4.0 + 0.9) * sin(a * 7.0 + 2.1);

	float spikes = pow(abs(sin(a * 9.0)), 22.0) * exp(-r * 15.0 / vary) * 0.36;
	float fine = pow(abs(sin(a * 21.0 + 0.6)), 30.0) * exp(-r * 22.0 / vary) * 0.21;

	// the glow the spikes sit in, and a tight core
	float halo = exp(-r * 18.0) * 0.07;
	float core = exp(-r * 46.0) * 0.24;

	// The anamorphic streak: a horizontal bar through the sun. This is the
	// cue that says "lens" faster than anything else in the frame, and it is
	// the one part of a flare an arcade game can push hard without looking
	// broken. Cool-tinted, the way anamorphic glass actually flares.
	float streak = exp(-abs(d.y) * 150.0) * exp(-abs(d.x) * 4.5) * 0.34;

	// warm, and held back in blue: this is ADDED to a pale blue sky, so a
	// neutral tint arrives white and stops looking like sunlight
	vec3 burst = vec3(1.0, 0.82, 0.55) * (spikes + fine + halo + core);
	burst += vec3(0.45, 0.65, 1.0) * streak;

	// The ghosts, kept deliberately dim. Bright ones saturate to white on this
	// sky and the colour that makes them read as lens glass is the first thing
	// lost.
	vec3 dots = ghost(uv, sun, 0.74, 0.018, vec3(0.38, 0.25, 0.08));
	dots += ghost(uv, sun, 0.56, 0.010, vec3(0.09, 0.31, 0.20));
	dots += ring(uv, sun, 0.36, 0.021, 0.007, vec3(0.26, 0.21, 0.24));
	dots += ring(uv, sun, 0.16, 0.012, 0.005, vec3(0.18, 0.21, 0.28));

	return vec4((burst + dots) * uIntensity * ${STRENGTH}, 1.0);
}
`;

const wgsl = `
struct FlareUniforms {
	uSunX : f32,
	uSunY : f32,
	uIntensity : f32,
};
@group(3) @binding(0) var<uniform> fx : FlareUniforms;

fn ghostAt(sun : vec2f, at : f32) -> vec2f {
	let pivot = vec2f(${PIVOT_X}, 0.5);
	return pivot + (sun - pivot) * at;
}

const DISPERSE = vec3f(1.16, 1.0, 0.86);

fn ghost(uv : vec2f, sun : vec2f, at : f32, size : f32, tint : vec3f) -> vec3f {
	let d = (uv - ghostAt(sun, at)) * vec2f(${ASPECT}, 1.0);
	let sz = size * DISPERSE;
	return tint * exp(-vec3f(dot(d, d)) / (sz * sz));
}

fn ring(uv : vec2f, sun : vec2f, at : f32, radius : f32, w : f32, tint : vec3f) -> vec3f {
	let d = (uv - ghostAt(sun, at)) * vec2f(${ASPECT}, 1.0);
	let e = (vec3f(length(d)) - radius * DISPERSE) / w;
	return tint * exp(-e * e);
}

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let sun = vec2f(fx.uSunX, fx.uSunY);
	let d = (uv - sun) * vec2f(${ASPECT}, 1.0);
	let r = length(d);
	let a = atan2(d.y, d.x);

	let vary = 0.70 + 0.30 * sin(a * 4.0 + 0.9) * sin(a * 7.0 + 2.1);

	let spikes = pow(abs(sin(a * 9.0)), 22.0) * exp(-r * 15.0 / vary) * 0.36;
	let fine = pow(abs(sin(a * 21.0 + 0.6)), 30.0) * exp(-r * 22.0 / vary) * 0.21;

	let halo = exp(-r * 18.0) * 0.07;
	let core = exp(-r * 46.0) * 0.24;

	let streak = exp(-abs(d.y) * 150.0) * exp(-abs(d.x) * 4.5) * 0.34;

	var burst = vec3f(1.0, 0.82, 0.55) * (spikes + fine + halo + core);
	burst += vec3f(0.45, 0.65, 1.0) * streak;

	var dots = ghost(uv, sun, 0.74, 0.018, vec3f(0.38, 0.25, 0.08));
	dots += ghost(uv, sun, 0.56, 0.010, vec3f(0.09, 0.31, 0.20));
	dots += ring(uv, sun, 0.36, 0.021, 0.007, vec3f(0.26, 0.21, 0.24));
	dots += ring(uv, sun, 0.16, 0.012, 0.005, vec3f(0.18, 0.21, 0.28));

	return vec4f((burst + dots) * fx.uIntensity * ${STRENGTH}, 1.0);
}
`;

/** the dual-language flare body, preloaded as a `"shader"` asset */
export const flare = { glsl, wgsl };
