import { describe, expect, it } from "vitest";
import { parseWGSLBody } from "../src/video/effects/wgsl/parse.js";

/**
 * The declaration-only WGSL body parser: what the engine learns from a
 * body (uniform struct → setUniform map, texture/sampler pairs, builtin
 * references) and — just as important — every malformed shape it must
 * refuse. A refused body disables the effect (warn + inert); it must
 * never produce a partially-parsed result the bind-group builder would
 * mis-consume.
 */
describe("WGSL body parser", () => {
	const VALID = `
		struct FxUniforms {
			uStrength : f32,
			uColor : vec3f,
		};
		@group(3) @binding(0) var<uniform> fx : FxUniforms;

		fn apply(color : vec4f, uv : vec2f) -> vec4f {
			return vec4f(color.rgb * fx.uColor * fx.uStrength, color.a);
		}
	`;

	it("parses the uniform struct into a name → placement map", () => {
		const parsed = parseWGSLBody(VALID);
		expect(parsed.ok).toBe(true);
		expect(parsed.uniformVar).toBe("fx");
		expect(parsed.layout.get("uStrength")).toMatchObject({ offset: 0 });
		expect(parsed.layout.get("uColor")).toMatchObject({ offset: 16, size: 12 });
		expect(parsed.structSize).toBe(32);
	});

	it("a body without a uniform struct parses with an empty layout", () => {
		const parsed = parseWGSLBody(
			"fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }",
		);
		expect(parsed.ok).toBe(true);
		expect(parsed.layout.size).toBe(0);
		expect(parsed.structSize).toBe(0);
	});

	it("collects texture/sampler pairs at explicit consecutive bindings", () => {
		const parsed = parseWGSLBody(`
			@group(3) @binding(1) var uNoise : texture_2d<f32>;
			@group(3) @binding(2) var uNoiseSampler : sampler;
			fn apply(color : vec4f, uv : vec2f) -> vec4f {
				return color * textureSample(uNoise, uNoiseSampler, uv);
			}
		`);
		expect(parsed.ok).toBe(true);
		expect(parsed.textures).toEqual([
			{
				name: "uNoise",
				binding: 1,
				samplerName: "uNoiseSampler",
				samplerBinding: 2,
			},
		]);
		expect(parsed.maxUserBinding).toBe(2);
	});

	it("detects builtin references, honoring the owns-declaration guard", () => {
		const withBuiltins = parseWGSLBody(`
			fn apply(color : vec4f, uv : vec2f) -> vec4f {
				let scene = textureSample(screen_texture, screen_sampler, screen_uv);
				return mix(color, scene, noise_uv.x);
			}
		`);
		expect(withBuiltins.ok).toBe(true);
		expect(withBuiltins.builtins).toMatchObject({
			screenTexture: true,
			screenSamplerClamp: true,
			screenUV: true,
			noiseUV: true,
		});

		// a body declaring its own screen_uv keeps it user-managed
		const own = parseWGSLBody(`
			fn apply(color : vec4f, uv : vec2f) -> vec4f {
				var screen_uv : vec2f = uv;
				return vec4f(screen_uv, 0.0, color.a);
			}
		`);
		expect(own.ok).toBe(true);
		expect(own.builtins.screenUV).toBe(false);
	});

	it("declarations inside comments are ignored", () => {
		const parsed = parseWGSLBody(`
			// @group(3) @binding(0) var<uniform> fake : NotReal;
			/* struct NotReal { x : f32, }; uses screen_texture too */
			fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }
		`);
		expect(parsed.ok).toBe(true);
		expect(parsed.structSize).toBe(0);
		expect(parsed.builtins.screenTexture).toBe(false);
	});

	describe("refused shapes (each disables the effect, never throws)", () => {
		it("missing apply()", () => {
			const parsed = parseWGSLBody("fn main() -> vec4f { return vec4f(); }");
			expect(parsed.ok).toBe(false);
			expect(parsed.error).toMatch(/fn apply/);
		});

		it("uniform var without its struct", () => {
			const parsed = parseWGSLBody(`
				@group(3) @binding(0) var<uniform> fx : Missing;
				fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }
			`);
			expect(parsed.ok).toBe(false);
			expect(parsed.error).toMatch(/Missing/);
		});

		it("unsupported uniform member type", () => {
			const parsed = parseWGSLBody(`
				struct Fx { flag : bool, };
				@group(3) @binding(0) var<uniform> fx : Fx;
				fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }
			`);
			expect(parsed.ok).toBe(false);
			expect(parsed.error).toMatch(/unsupported/);
		});

		it("texture without its adjacent sampler", () => {
			const parsed = parseWGSLBody(`
				@group(3) @binding(1) var uNoise : texture_2d<f32>;
				fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }
			`);
			expect(parsed.ok).toBe(false);
			expect(parsed.error).toMatch(/sampler at @binding\(2\)/);
		});

		it("orphan sampler", () => {
			const parsed = parseWGSLBody(`
				@group(3) @binding(1) var s : sampler;
				fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }
			`);
			expect(parsed.ok).toBe(false);
			expect(parsed.error).toMatch(/no texture/);
		});

		it("texture squatting on binding 0 (reserved for the uniform struct)", () => {
			const parsed = parseWGSLBody(`
				@group(3) @binding(0) var uNoise : texture_2d<f32>;
				@group(3) @binding(1) var s : sampler;
				fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }
			`);
			expect(parsed.ok).toBe(false);
		});

		it("screen_texture referenced without either builtin sampler", () => {
			const parsed = parseWGSLBody(`
				fn apply(color : vec4f, uv : vec2f) -> vec4f {
					return textureLoad(screen_texture, vec2i(uv), 0);
				}
			`);
			expect(parsed.ok).toBe(false);
			expect(parsed.error).toMatch(/screen_sampler/);
		});

		it("an unclassifiable group-3 declaration", () => {
			const parsed = parseWGSLBody(`
				@group(3) @binding(4) var<storage> big : array<f32>;
				fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }
			`);
			expect(parsed.ok).toBe(false);
			expect(parsed.error).toMatch(/binding\(4\)/);
		});
	});
});
