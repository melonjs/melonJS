/**
 * melonJS — Starsweep: the nebula shader, in GLSL and in WGSL.
 *
 * The `apply` function a `ShaderEffect` runs for each pixel, written
 * twice, once for WebGL and once for WebGPU: drifting space clouds in two
 * colours over the sky colour, and a grid of twinkling stars. Used by
 * `NebulaBackdrop`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

export const nebulaGlsl = `
uniform float uTime;
uniform float uAspect;
uniform vec3 uSky;
uniform vec3 uColorA;
uniform vec3 uColorB;

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
		u.y
	);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		v += a * noise(p);
		p *= 2.03;
		a *= 0.5;
	}
	return v;
}

vec4 apply(vec4 color, vec2 uv) {
	vec2 p = vec2(uv.x * uAspect, uv.y) * 3.0;
	float t = uTime * 0.03;
	// domain-warped clouds, two layers drifting at different speeds
	float n = fbm(p + vec2(t, -t * 0.6) + fbm(p * 0.6 - t) * 1.4);
	float m = fbm(p * 1.6 - vec2(t * 1.4, t * 0.4));
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

export const nebulaWgsl = `
struct NebulaUniforms {
	uSky : vec3f,
	uTime : f32,
	uColorA : vec3f,
	uAspect : f32,
	uColorB : vec3f,
};
@group(3) @binding(0) var<uniform> fx : NebulaUniforms;

fn hash(q : vec2f) -> f32 {
	var p = fract(q * vec2f(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

fn noise(p : vec2f) -> f32 {
	let i = floor(p);
	let f = fract(p);
	let u = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2f(1.0, 0.0)), u.x),
		mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), u.x),
		u.y
	);
}

fn fbm(q : vec2f) -> f32 {
	var p = q;
	var v = 0.0;
	var a = 0.5;
	for (var i = 0; i < 5; i++) {
		v += a * noise(p);
		p *= 2.03;
		a *= 0.5;
	}
	return v;
}

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let p = vec2f(uv.x * fx.uAspect, uv.y) * 3.0;
	let t = fx.uTime * 0.03;
	let n = fbm(p + vec2f(t, -t * 0.6) + fbm(p * 0.6 - t) * 1.4);
	let m = fbm(p * 1.6 - vec2f(t * 1.4, t * 0.4));
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
