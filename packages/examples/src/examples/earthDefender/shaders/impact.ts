/**
 * melonJS — Earth Defender: the shell ringing when the craft is struck.
 *
 * `domeRipple` rings the SHELL. The dome is the largest surface in the
 * frame and until now it reacted to nothing: rocks bounced off the craft's
 * shield a body-length above it and the glass never registered any of it.
 * Three rings leave the point of contact, decelerating the way the blast
 * wave does, and fade as they spread.
 *
 * It is drawn on the same spherical CAP the blast waves use, for the same
 * reason: a flat quad tangent to the planet reads as a sticker standing
 * off the glass the moment it is large, and this one is deliberately
 * large. A hosted effect on the dome mesh itself would have been the
 * obvious route and cannot work — a colour hook gets the texture
 * coordinate and no normal, and the UVs of the shell say nothing about
 * where on it the impact happened.
 *
 * Driven entirely by uniforms the game sets: no clock of its own, so
 * nothing here drifts over a long session.
 *
 * `damageVignette` is its companion, the red that closes in at the edges of
 * the frame as the shield goes. It is a shader too, hosted on a
 * screen-filling floating QUAD rather than on the viewport: a floating sprite
 * is an ordinary quad, which is the tier with the full effect feature set,
 * and it leaves the pass under the HUD rather than over it.
 *
 * The quad's own texture is blank. Everything the vignette looks like is
 * generated per fragment from `uv`, so there is no gradient to bake and no
 * canvas to keep in step with the screen size.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

const rippleGlsl = `
uniform float uAge;
uniform float uSize;
uniform float uExposure;
uniform vec3 uColor;

vec4 apply(vec4 color, vec2 uv) {
	vec2 d = (uv - vec2(0.5)) * 2.0;
	float r = length(d) / max(uSize, 0.001);
	if (r > 1.0) {
		return vec4(0.0);
	}
	float t = clamp(uAge, 0.0, 1.0);

	// the leading ring, fast then slowing, with two more trailing it
	float front = 1.0 - (1.0 - t) * (1.0 - t);
	float rings = 0.0;
	for (int i = 0; i < 3; i++) {
		float phase = front - float(i) * 0.17;
		if (phase > 0.0) {
			rings += exp(-pow((r - phase) / 0.045, 2.0)) * (1.0 - float(i) * 0.3);
		}
	}

	// gone by the time it reaches the edge of its own patch, and gone by
	// the end of its life wherever it got to
	float fade = (1.0 - t) * (1.0 - r);
	float energy = rings * fade;
	vec3 mapped = vec3(1.0) - exp(-uColor * energy * uExposure);
	return vec4(mapped * color.a, color.a * min(1.0, energy));
}
`;

const rippleWgsl = `
struct RippleUniforms {
	uAge : f32,
	uSize : f32,
	uExposure : f32,
	uColor : vec3f,
};
@group(3) @binding(0) var<uniform> fx : RippleUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let d = (uv - vec2f(0.5)) * 2.0;
	let r = length(d) / max(fx.uSize, 0.001);
	if (r > 1.0) {
		return vec4f(0.0);
	}
	let t = clamp(fx.uAge, 0.0, 1.0);

	let front = 1.0 - (1.0 - t) * (1.0 - t);
	var rings = 0.0;
	for (var i = 0; i < 3; i++) {
		let phase = front - f32(i) * 0.17;
		if (phase > 0.0) {
			rings += exp(-pow((r - phase) / 0.045, 2.0)) * (1.0 - f32(i) * 0.3);
		}
	}

	let fade = (1.0 - t) * (1.0 - r);
	let energy = rings * fade;
	let mapped = vec3f(1.0) - exp(-fx.uColor * energy * fx.uExposure);
	return vec4f(mapped * color.a, color.a * min(1.0, energy));
}
`;

/** rings crossing the shell from where something struck it */
export const domeRipple = { glsl: rippleGlsl, wgsl: rippleWgsl };

const vignetteGlsl = `
uniform vec3 uColor;

vec4 apply(vec4 color, vec2 uv) {
	vec2 d = (uv - vec2(0.5)) * 2.0;
	// the corners are further out than the edges, which is what makes the
	// red close in from the four corners rather than as a flat border
	float r = length(d);
	// clear through the middle of the frame, so what the player is aiming at
	// is never tinted, and ramping up only over the last third
	float k = smoothstep(0.55, 1.05, r);
	// color.a is the sprite's own opacity, which the game drives from how
	// much shield is left; the texture under it is blank on purpose
	float a = k * color.a;
	return vec4(uColor * a, a);
}
`;

const vignetteWgsl = `
struct VignetteUniforms {
	uColor : vec3f,
};
@group(3) @binding(0) var<uniform> fx : VignetteUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let d = (uv - vec2f(0.5)) * 2.0;
	let r = length(d);
	let k = smoothstep(0.55, 1.05, r);
	let a = k * color.a;
	return vec4f(fx.uColor * a, a);
}
`;

/** the red closing in at the edges of the frame as the shield goes */
export const damageVignette = { glsl: vignetteGlsl, wgsl: vignetteWgsl };
