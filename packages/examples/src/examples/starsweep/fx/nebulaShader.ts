/**
 * melonJS — Starsweep: the nebula shader, in GLSL and in WGSL.
 *
 * The `apply` function a `ShaderEffect` runs for each pixel, written
 * twice, once for WebGL and once for WebGPU: drifting space clouds in two
 * colours over the sky colour, and a grid of twinkling stars.
 *
 * The clouds come from the engine's noise: a seamless `NoiseTexture2d` of
 * fractal Perlin noise, baked once (see `NebulaBackdrop.ts`) and bound as
 * `uNoise`. Each layer samples it, the first through a second sample of it
 * (domain warping), both drifting with time. Only the stars hash their
 * grid cell here: a smooth noise does not scatter single bright points.
 *
 * It is a `"shader"` asset, preloaded with the rest (see
 * `ExampleStarsweep.ts`): the loader compiles it while loading, and
 * `loader.getShader` hands every screen's `NebulaBackdrop` the same
 * instance, so it is never compiled again.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

/** how many tiles of the noise texture span the screen's height */
const NOISE_TILES = 0.75;

const glsl = `
uniform float uTime;
uniform float uAspect;
uniform vec3 uSky;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform sampler2D uNoise;

// a cell's own random value, for the stars
float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

// the baked fractal noise, tiling as it scrolls
float cloud(vec2 p) {
	return texture2D(uNoise, p * ${NOISE_TILES / 3}).r;
}

vec4 apply(vec4 color, vec2 uv) {
	vec2 p = vec2(uv.x * uAspect, uv.y) * 3.0;
	float t = uTime * 0.03;
	// domain-warped clouds, two layers drifting at different speeds
	float n = cloud(p + vec2(t, -t * 0.6) + cloud(p * 0.6 - t) * 1.4);
	float m = cloud(p * 1.6 - vec2(t * 1.4, t * 0.4));
	vec3 col = uSky;
	col = mix(col, uColorA, smoothstep(0.42, 0.9, n) * 0.6);
	col = mix(col, uColorB, smoothstep(0.5, 0.95, m) * 0.5);
	// a star field on a grid, one star in a few cells, each twinkling
	vec2 g = p * 26.0;
	vec2 id = floor(g);
	vec2 f = fract(g) - 0.5;
	float h = hash(id);
	float star = step(0.982, h) * smoothstep(0.14, 0.0, length(f));
	star *= 0.55 + 0.45 * sin(uTime * 2.5 + h * 80.0);
	col += vec3(star);
	return vec4(col, 1.0);
}
`;

const wgsl = `
struct NebulaUniforms {
	uSky : vec3f,
	uTime : f32,
	uColorA : vec3f,
	uAspect : f32,
	uColorB : vec3f,
};
@group(3) @binding(0) var<uniform> fx : NebulaUniforms;
@group(3) @binding(1) var uNoise : texture_2d<f32>;
@group(3) @binding(2) var uNoiseSampler : sampler;

fn hash(q : vec2f) -> f32 {
	var p = fract(q * vec2f(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

fn cloud(p : vec2f) -> f32 {
	return textureSample(uNoise, uNoiseSampler, p * ${NOISE_TILES / 3}).r;
}

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let p = vec2f(uv.x * fx.uAspect, uv.y) * 3.0;
	let t = fx.uTime * 0.03;
	let n = cloud(p + vec2f(t, -t * 0.6) + cloud(p * 0.6 - t) * 1.4);
	let m = cloud(p * 1.6 - vec2f(t * 1.4, t * 0.4));
	var col = fx.uSky;
	col = mix(col, fx.uColorA, smoothstep(0.42, 0.9, n) * 0.6);
	col = mix(col, fx.uColorB, smoothstep(0.5, 0.95, m) * 0.5);
	let g = p * 26.0;
	let id = floor(g);
	let f = fract(g) - 0.5;
	let h = hash(id);
	var star = step(0.982, h) * smoothstep(0.14, 0.0, length(f));
	star *= 0.55 + 0.45 * sin(fx.uTime * 2.5 + h * 80.0);
	col += vec3f(star);
	return vec4f(col, 1.0);
}
`;

/** the shader's asset name */
export const NEBULA_SHADER = "starsweep-nebula";

/** the shader's source, for the preload: one body per shading language */
export const nebula = { glsl, wgsl };
