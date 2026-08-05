import { afterEach, describe, expect, it, vi } from "vitest";
import { ShaderEffect } from "../src/index.js";

/**
 * The dual-language body contract, device-free: ShaderEffect picks the
 * body matching `renderer.shaderLanguage`, degrades to the inert stub
 * when none matches (warn + enabled=false — the Canvas contract
 * generalized), and the WGSL realization's CPU mirror places setUniform
 * values at the parsed offsets. Only surfaces that need no live GPU/GL
 * are exercised here; the GLSL realization keeps its own WebGL-gated
 * suites, and the WebGPU draw path is covered by the post-effect specs.
 */
describe("ShaderEffect dual-language bodies", () => {
	const WGSL_BODY = `
struct Fx {
	uStrength : f32,
	uColor : vec3f,
	uTime : f32,
};
@group(3) @binding(0) var<uniform> fx : Fx;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return vec4f(color.rgb * fx.uColor * fx.uStrength, color.a);
}
`;
	const GLSL_BODY = `
uniform float uStrength;
vec4 apply(vec4 color, vec2 uv) { return color * uStrength; }
`;

	const wgslRenderer = { shaderLanguage: "wgsl" };
	const glslRenderer = { shaderLanguage: "glsl", gl: undefined };
	const canvasRenderer = { shaderLanguage: null };

	const created = [];
	function make(renderer, body) {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const effect = new ShaderEffect(renderer, body);
		warn.mockRestore();
		created.push(effect);
		return effect;
	}

	afterEach(() => {
		for (const effect of created.splice(0)) {
			if (!effect.destroyed) {
				effect.destroy();
			}
		}
	});

	describe("body dispatch matrix", () => {
		it("a WGSL renderer realizes the wgsl body", () => {
			const effect = make(wgslRenderer, { wgsl: WGSL_BODY });
			expect(effect.enabled).toBe(true);
			expect(effect.wgslRealization).toBeDefined();
			expect(effect._shader).toBeUndefined();
		});

		it("a WGSL renderer with a dual body picks wgsl", () => {
			const effect = make(wgslRenderer, { glsl: GLSL_BODY, wgsl: WGSL_BODY });
			expect(effect.enabled).toBe(true);
			expect(effect.wgslRealization).toBeDefined();
		});

		it("a bare string keeps meaning GLSL: inert on a WGSL renderer", () => {
			const effect = make(wgslRenderer, GLSL_BODY);
			expect(effect.enabled).toBe(false);
			expect(effect.wgslRealization).toBeUndefined();
		});

		it("a {glsl}-only body is inert on a WGSL renderer", () => {
			expect(make(wgslRenderer, { glsl: GLSL_BODY }).enabled).toBe(false);
		});

		it("a {wgsl}-only body is inert on a GLSL renderer (no GL program built)", () => {
			const effect = make(glslRenderer, { wgsl: WGSL_BODY });
			expect(effect.enabled).toBe(false);
			expect(effect._shader).toBeUndefined();
		});

		it("every shape is inert on a renderer with no shading language", () => {
			expect(make(canvasRenderer, GLSL_BODY).enabled).toBe(false);
			expect(
				make(canvasRenderer, { glsl: GLSL_BODY, wgsl: WGSL_BODY }).enabled,
			).toBe(false);
		});

		it("an invalid WGSL body warns with the parse reason and stays inert", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const effect = new ShaderEffect(wgslRenderer, {
				wgsl: "fn not_apply() -> f32 { return 1.0; }",
			});
			created.push(effect);
			expect(effect.enabled).toBe(false);
			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining("invalid WGSL body"),
			);
			warn.mockRestore();
		});

		it("inert stubs keep the full no-op contract (Canvas parity)", () => {
			const effect = make(wgslRenderer, GLSL_BODY);
			expect(() => {
				effect.setUniform("uStrength", 1);
				effect.setTime(2);
				effect.destroy();
			}).not.toThrow();
			expect(effect.destroyed).toBe(true);
		});
	});

	describe("WGSL uniform mirror", () => {
		it("setUniform writes bytes at the parsed offsets (vec3 alignment included)", () => {
			const effect = make(wgslRenderer, { wgsl: WGSL_BODY });
			effect.setUniform("uStrength", 0.5);
			effect.setUniform("uColor", [0.25, 0.5, 0.75]);

			const mirror = effect.wgslRealization.f32;
			expect(mirror[0]).toBeCloseTo(0.5);
			// uColor aligns to 16 → floats 4..6
			expect([mirror[4], mirror[5], mirror[6]]).toEqual([0.25, 0.5, 0.75]);
		});

		it("an unknown uniform name warns once and is ignored", () => {
			const effect = make(wgslRenderer, { wgsl: WGSL_BODY });
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			effect.setUniform("uNope", 1);
			effect.setUniform("uNope", 2);
			expect(warn).toHaveBeenCalledTimes(1);
			warn.mockRestore();
		});

		it("setTime writes uTime only when the struct declares it", () => {
			const withTime = make(wgslRenderer, { wgsl: WGSL_BODY });
			expect(withTime.setTime(3)).toBe(withTime);
			const offset = withTime.wgslRealization.layout.get("uTime").offset >> 2;
			expect(withTime.wgslRealization.f32[offset]).toBe(3);

			const without = make(wgslRenderer, {
				wgsl: "fn apply(color : vec4f, uv : vec2f) -> vec4f { return color; }",
			});
			expect(() => {
				return without.setTime(3);
			}).not.toThrow();
		});

		it("mat3x3f values land on vec4-strided columns (9-float column-major input)", () => {
			const effect = make(wgslRenderer, {
				wgsl: `
struct Fx { uMat : mat3x3f, };
@group(3) @binding(0) var<uniform> fx : Fx;
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return vec4f(fx.uMat * color.rgb, color.a);
}
`,
			});
			effect.setUniform("uMat", [1, 2, 3, 4, 5, 6, 7, 8, 9]);
			const mirror = effect.wgslRealization.f32;
			// columns at float offsets 0/4/8, each 3 floats + padding
			expect([...mirror.slice(0, 3)]).toEqual([1, 2, 3]);
			expect([...mirror.slice(4, 7)]).toEqual([4, 5, 6]);
			expect([...mirror.slice(8, 11)]).toEqual([7, 8, 9]);
		});

		it("boolean values normalize to 0/1 like the GLSL path", () => {
			const effect = make(wgslRenderer, { wgsl: WGSL_BODY });
			effect.setUniform("uStrength", true);
			expect(effect.wgslRealization.f32[0]).toBe(1);
			effect.setUniform("uStrength", false);
			expect(effect.wgslRealization.f32[0]).toBe(0);
		});

		it("_setNoiseUVRect feeds the ME mirror when noise_uv is used", () => {
			const effect = make(wgslRenderer, {
				wgsl: "fn apply(color : vec4f, uv : vec2f) -> vec4f { return vec4f(noise_uv, 0.0, color.a); }",
			});
			effect._setNoiseUVRect(256, 128, 64, 32, 0.5, 0.25);
			const me = effect.wgslRealization.meMirror;
			expect([...me.slice(0, 6)]).toEqual([64, 32, 256, 128, 128, 32]);
		});
	});

	describe("setTexture on the WGSL realization", () => {
		const TEXTURED = `
@group(3) @binding(1) var uNoise : texture_2d<f32>;
@group(3) @binding(2) var uNoiseSampler : sampler;
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return color * textureSample(uNoise, uNoiseSampler, uv);
}
`;

		it("stores entries for declared textures, refuses undeclared names", () => {
			const effect = make(wgslRenderer, { wgsl: TEXTURED });
			const image = { width: 8, height: 8 };
			effect.setTexture("uNoise", image, "repeat");
			expect(effect._extraTextures.get("uNoise")).toMatchObject({
				image,
				repeat: "repeat",
			});

			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			effect.setTexture("uUndeclared", image);
			expect(effect._extraTextures.has("uUndeclared")).toBe(false);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining("uUndeclared"));
			warn.mockRestore();
		});

		it("rejects HTMLVideoElement sources with a TypeError on every backend", () => {
			const effect = make(wgslRenderer, { wgsl: TEXTURED });
			expect(() => {
				effect.setTexture("uNoise", { videoWidth: 640 });
			}).toThrow(TypeError);
		});
	});

	describe("clone", () => {
		it("replays user-set values and extra textures, resets shared", () => {
			const original = make(wgslRenderer, { wgsl: WGSL_BODY });
			original.setUniform("uStrength", 0.75);
			original.setUniform("uColor", [1, 0, 0]);
			original.shared = true;

			const copy = original.clone();
			created.push(copy);
			expect(copy.enabled).toBe(true);
			expect(copy.shared).toBe(false);
			expect(copy.wgslRealization).not.toBe(original.wgslRealization);
			expect(copy.wgslRealization.f32[0]).toBeCloseTo(0.75);
			expect(copy.wgslRealization.f32[4]).toBe(1);
		});

		it("throws when cloning a destroyed effect", () => {
			const effect = make(wgslRenderer, { wgsl: WGSL_BODY });
			effect.destroy();
			expect(() => {
				return effect.clone();
			}).toThrow(/destroyed/);
		});
	});

	describe("destroy", () => {
		it("is idempotent and releases the GPU state handle", () => {
			const effect = make(wgslRenderer, { wgsl: WGSL_BODY });
			effect.destroy();
			effect.destroy();
			expect(effect.destroyed).toBe(true);
			expect(effect.enabled).toBe(false);
			expect(effect.wgslRealization.gpu).toBeNull();
		});
	});

	describe("_setUVYDir (directional-body orientation seam)", () => {
		it("DropShadow declares uUVYDir, defaults +1, and takes the pooled -1", async () => {
			const { default: DropShadowEffect } = await import(
				"../src/video/effects/dropShadow.js"
			);
			const effect = new DropShadowEffect(wgslRenderer);
			expect(effect.wgslRealization.hasUniform("uUVYDir")).toBe(true);
			// down is down until a renderer path says otherwise
			expect(effect.wgslRealization.values.get("uUVYDir")).toBe(1);
			// the GL pooled path flips it (WebGPU never calls with -1)
			effect._setUVYDir(-1);
			expect(effect.wgslRealization.values.get("uUVYDir")).toBe(-1);
			// cached: same direction re-fed per blit costs nothing
			effect._setUVYDir(-1);
			effect._setUVYDir(1);
			expect(effect.wgslRealization.values.get("uUVYDir")).toBe(1);
		});

		it("a body without the uniform ignores it silently", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const effect = make(wgslRenderer, { wgsl: WGSL_BODY });
			warn.mockClear();
			effect._setUVYDir(-1);
			expect(warn).not.toHaveBeenCalled();
			warn.mockRestore();
		});
	});
});
