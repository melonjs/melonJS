import { describe, expect, it } from "vitest";
import { parseWGSLBody } from "../src/video/effects/wgsl/parse.js";
import {
	assignBuiltinBindings,
	buildWGSLModule,
} from "../src/video/effects/wgsl/scaffold.js";

/**
 * The assembled WGSL module around an effect body. Snapshots pin the full
 * text per builtin permutation (the WGSL counterpart of the generated-GLSL
 * golden); the explicit assertions pin the conventions that must never
 * drift silently: the clip-z remap, the packed-color premultiply, y-down
 * screen_uv, and collision-free builtin binding assignment.
 */
describe("WGSL effect scaffold", () => {
	function moduleFor(body) {
		const parsed = parseWGSLBody(body);
		expect(parsed.ok).toBe(true);
		return buildWGSLModule(body, parsed);
	}

	const PLAIN =
		"fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }";

	it("plain body: full module snapshot", () => {
		expect(moduleFor(PLAIN).code).toMatchSnapshot();
	});

	it("all builtins: full module snapshot", () => {
		expect(
			moduleFor(`
struct Fx { uStrength : f32, };
@group(3) @binding(0) var<uniform> fx : Fx;
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let scene = textureSample(screen_texture, screen_sampler, screen_uv);
	return mix(color, scene, fx.uStrength * noise_uv.x);
}
`).code,
		).toMatchSnapshot();
	});

	it("carries the frozen cross-backend conventions", () => {
		const code = moduleFor(PLAIN).code;
		// GL-convention clip z remap — without it depth-carrying vertices clip away
		expect(code).toContain("(clip.z + clip.w) * 0.5");
		// packed-ARGB premultiply (little-endian unorm8x4 arrives BGRA)
		expect(code).toContain("aColor.bgr * aColor.a");
		// frozen 28-byte quad vertex layout, locations 0-3
		expect(code).toContain("@location(3) aTextureId : f32");
		// the blit source rides the material group
		expect(code).toContain("@group(1) @binding(0) var uTexture");
	});

	it("screen_uv is y-down (capture row 0 = screen top, no flip)", () => {
		const code = moduleFor(`
fn apply(color : vec4f, uv : vec2f) -> vec4f { return vec4f(screen_uv, 0.0, color.a); }
`).code;
		expect(code).toContain("0.5 - ndc.y * 0.5");
	});

	it("builtin bindings are assigned above the highest user binding", () => {
		const body = `
struct Fx { uStrength : f32, };
@group(3) @binding(0) var<uniform> fx : Fx;
@group(3) @binding(1) var uNoise : texture_2d<f32>;
@group(3) @binding(2) var uNoiseSampler : sampler;
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let n = textureSample(uNoise, uNoiseSampler, noise_uv);
	let scene = textureSample(screen_texture, screen_sampler_repeat, screen_uv);
	return mix(color, scene, n.x * fx.uStrength);
}
`;
		const parsed = parseWGSLBody(body);
		const bindings = assignBuiltinBindings(parsed);
		// user bindings occupy 0..2 → ME at 3, capture at 4, sampler at 5
		expect(bindings.me).toBe(3);
		expect(bindings.screenTexture).toBe(4);
		expect(bindings.screenSamplerRepeat).toBe(5);
		expect(bindings.screenSamplerClamp).toBe(-1);
		const code = buildWGSLModule(body, parsed).code;
		expect(code).toContain("@group(3) @binding(3) var<uniform> ME");
		expect(code).toContain("@group(3) @binding(4) var screen_texture");
		expect(code).toContain("@group(3) @binding(5) var screen_sampler_repeat");
	});

	it("the user body is embedded verbatim", () => {
		const body = `
// a very specific comment that must survive
fn apply(color : vec4f, uv : vec2f) -> vec4f { return color * 0.5; }
`;
		expect(moduleFor(body).code).toContain(body);
	});
});
