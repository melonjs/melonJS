import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, Mesh, video, WebGLRenderer } from "../src/index.js";

/**
 * Tests for the decoupled default texture filter (`textureFilter` setting),
 * which separates texture sampling smoothness from the polygon-edge MSAA that
 * `antiAlias` controls.
 *
 * The resolver lives on the base `Renderer` (backend-neutral, returns
 * `"linear"` / `"nearest"`); the WebGL renderer maps it to a GL enum via
 * `_glTextureFilter()`. The per-mesh `Mesh.textureFilter` override still wins.
 *
 * Adversarial cases assert the precedence and that an explicit filter is NOT
 * clobbered by toggling `antiAlias` (the bug the decoupling exists to prevent).
 */
describe("default texture filter (decoupled from antiAlias)", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			video.init(64, 64, {
				parent: "screen",
				renderer: video.WEBGL,
				// software GL in headless chromium trips the "major performance
				// caveat" flag — opt out so the WebGL renderer is actually created
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			// genuine WebGL absence — tests skip via requireWebGL below
		}
		if (video.renderer instanceof WebGLRenderer) {
			renderer = video.renderer;
		}
	});

	afterAll(() => {
		try {
			video.init(64, 64, { parent: "screen", renderer: video.AUTO });
		} catch {
			// ignore
		}
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	// restore a known baseline before each test (other specs share `video`)
	beforeEach(() => {
		if (renderer) {
			renderer.settings.textureFilter = "auto";
			renderer.settings.antiAlias = false;
		}
	});

	// ── resolver truth table (backend-neutral mode) ────────────────────────
	describe("getDefaultTextureFilter() resolution", () => {
		it("auto + antiAlias:false → nearest", (ctx) => {
			requireWebGL(ctx);
			renderer.settings.textureFilter = "auto";
			renderer.settings.antiAlias = false;
			expect(renderer.getDefaultTextureFilter()).toBe("nearest");
		});

		it("auto + antiAlias:true → linear", (ctx) => {
			requireWebGL(ctx);
			renderer.settings.textureFilter = "auto";
			renderer.settings.antiAlias = true;
			expect(renderer.getDefaultTextureFilter()).toBe("linear");
		});

		it("explicit 'linear' overrides antiAlias:false", (ctx) => {
			requireWebGL(ctx);
			renderer.settings.textureFilter = "linear";
			renderer.settings.antiAlias = false;
			expect(renderer.getDefaultTextureFilter()).toBe("linear");
		});

		it("explicit 'nearest' overrides antiAlias:true", (ctx) => {
			requireWebGL(ctx);
			renderer.settings.textureFilter = "nearest";
			renderer.settings.antiAlias = true;
			expect(renderer.getDefaultTextureFilter()).toBe("nearest");
		});

		it("ADVERSARIAL: an unknown/unset mode falls back to the antiAlias path", (ctx) => {
			requireWebGL(ctx);
			// @ts-expect-error — exercising the defensive fallback
			renderer.settings.textureFilter = undefined;
			renderer.settings.antiAlias = true;
			expect(renderer.getDefaultTextureFilter()).toBe("linear");
			renderer.settings.antiAlias = false;
			expect(renderer.getDefaultTextureFilter()).toBe("nearest");
		});
	});

	// ── GL enum mapping ────────────────────────────────────────────────────
	describe("_glTextureFilter() maps the mode to a GL enum", () => {
		it("maps linear → gl.LINEAR and nearest → gl.NEAREST", (ctx) => {
			requireWebGL(ctx);
			const gl = renderer.gl;
			renderer.settings.textureFilter = "linear";
			expect(renderer._glTextureFilter()).toBe(gl.LINEAR);
			renderer.settings.textureFilter = "nearest";
			expect(renderer._glTextureFilter()).toBe(gl.NEAREST);
		});
	});

	// ── runtime setter, decoupled from setAntiAlias ────────────────────────
	describe("setTextureFilter() / setAntiAlias() independence", () => {
		it("setTextureFilter records the mode and resolves accordingly", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear");
			expect(renderer.settings.textureFilter).toBe("linear");
			expect(renderer.getDefaultTextureFilter()).toBe("linear");
		});

		it("ADVERSARIAL: an explicit filter is NOT clobbered by toggling antiAlias", (ctx) => {
			requireWebGL(ctx);
			// pin a crisp filter, then turn MSAA on/off — the texture filter must
			// stay 'nearest' (the whole point of decoupling)
			renderer.setTextureFilter("nearest");
			renderer.setAntiAlias(true);
			expect(renderer.getDefaultTextureFilter()).toBe("nearest");
			renderer.setAntiAlias(false);
			expect(renderer.getDefaultTextureFilter()).toBe("nearest");
		});

		it("ADVERSARIAL: with 'auto', toggling antiAlias DOES move the filter", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("auto");
			renderer.setAntiAlias(true);
			expect(renderer.getDefaultTextureFilter()).toBe("linear");
			renderer.setAntiAlias(false);
			expect(renderer.getDefaultTextureFilter()).toBe("nearest");
		});
	});

	// ── per-mesh override precedence ───────────────────────────────────────
	describe("Mesh.textureFilter overrides the global default", () => {
		// a real (non-white-pixel) texture — the per-mesh override only applies to
		// a real texture, never the shared white-pixel fallback
		const makeTex = () => {
			const c = document.createElement("canvas");
			c.width = 2;
			c.height = 2;
			c.getContext("2d").fillRect(0, 0, 2, 2);
			return c;
		};
		const tri = {
			vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
			uvs: new Float32Array([0, 0, 0, 0, 0, 0]),
			indices: new Uint16Array([0, 1, 2]),
		};

		it("ADVERSARIAL: a 'nearest' mesh stays nearest even when the global is 'linear'", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear"); // global says smooth
			const mesh = new Mesh(0, 0, {
				...tri,
				texture: makeTex(),
				width: 10,
				normalize: false,
				textureFilter: "nearest", // ...but this mesh wants crisp
			});
			// the per-mesh override is baked onto the resolved texture, winning
			// over the global default used by uploadTexture
			expect(mesh.texture.filter).toBe(renderer.gl.NEAREST);
		});

		it("a mesh with no textureFilter leaves the texture on the global default", (ctx) => {
			requireWebGL(ctx);
			renderer.setTextureFilter("linear");
			const mesh = new Mesh(0, 0, {
				...tri,
				texture: makeTex(),
				width: 10,
				normalize: false,
				// no per-mesh textureFilter → texture.filter stays undefined, so
				// uploadTexture applies the global default (_glTextureFilter)
			});
			expect(mesh.texture.filter).toBeUndefined();
		});
	});
});
