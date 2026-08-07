import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loader, Mesh } from "../src/index.js";
import { parseMTL } from "../src/loader/parsers/mtl.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * MTL material fidelity (#1575) — specular (`Ks`/`Ns`) and per-texel opacity
 * (`map_d`).
 *
 * The parser recognised ~20 properties and consumed five, so an authored
 * highlight was read and thrown away and an alpha map was rejected outright.
 * Both destinations already existed: the lit mesh path shades, and
 * `alphaCutoff` already discards.
 *
 * The traps these pin are mostly about what must NOT switch on. `Ns` of 0 is
 * the format's "no highlight", and exporters cheerfully write a bright `Ks`
 * beside it — so a matte material that gained a highlight would be a
 * regression visible on every model in the wild.
 */
describe("MTL specular and alpha maps (#1575)", () => {
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(128, 128);
		await loader.load({
			name: "mtl_material",
			type: "mtl",
			src: "/data/models/multitex-material.mtl",
		});
		for (const name of ["alpha", "beta", "gamma", "plain"]) {
			await loader.load({
				name: `mat_${name}`,
				type: "obj",
				src: `/data/models/mat-${name}.obj`,
			});
		}
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const makeMesh = (material) => {
		return new Mesh(0, 0, {
			model: `mat_${material}`,
			material: "mtl_material",
			width: 32,
		});
	};

	// ── the parser ──────────────────────────────────────────────────────

	describe("parsing", () => {
		it("reads Ks, Ns and map_d instead of ignoring them", () => {
			const materials = parseMTL(
				["newmtl m", "Ks 0.25 0.5 0.75", "Ns 128", "map_d mask.png"].join("\n"),
				"assets/",
			);
			expect(materials.m.Ks).toEqual([0.25, 0.5, 0.75]);
			expect(materials.m.Ns).toBe(128);
			// resolved relative to the .mtl, exactly like map_Kd
			expect(materials.m.map_d).toBe("assets/mask.png");
		});

		it("defaults to no specular and no alpha map", () => {
			const materials = parseMTL("newmtl m\nKd 1 1 1", "");
			expect(materials.m.Ks).toEqual([0, 0, 0]);
			expect(materials.m.Ns).toBe(0);
			expect(materials.m.map_d).toBe(null);
		});

		it("no longer warns that Ks / map_d are unsupported", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			parseMTL("newmtl m\nKs 1 1 1\nNs 10\nmap_d m.png", "");
			expect(warn).not.toHaveBeenCalled();
			warn.mockRestore();
		});

		it("still warns for maps that genuinely are not consumed", () => {
			// the set shrank; it must not have emptied
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			parseMTL("newmtl m\nmap_bump b.png", "");
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
		});
	});

	// ── specular ────────────────────────────────────────────────────────

	describe("specular", () => {
		it("carries Ks and Ns onto the mesh", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh("alpha");
			// Float32Array — compare per component rather than deep-equalling
			// against doubles
			expect(mesh.specular[0]).toBeCloseTo(0.8, 6);
			expect(mesh.specular[1]).toBeCloseTo(0.9, 6);
			expect(mesh.specular[2]).toBeCloseTo(1, 6);
			expect(mesh.shininess).toBe(64);
			mesh.destroy();
		});

		it("ADVERSARIAL: a bright Ks with Ns 0 stays matte", (ctx) => {
			requireWebGL(ctx, renderer);
			// what exporters write for a non-glossy material. Reading Ks alone
			// would put a full-strength white highlight on every such surface
			const mesh = makeMesh("beta");
			expect(mesh.shininess).toBe(0);
			expect(mesh.specular).toBeUndefined();
			mesh.destroy();
		});

		it("ADVERSARIAL: an Ns with no Ks stays matte", (ctx) => {
			requireWebGL(ctx, renderer);
			// a black specular colour contributes nothing, so switching the
			// term on for it would only cost the pow() per light per pixel
			const mesh = makeMesh("gamma");
			expect(mesh.specular).toBeUndefined();
			expect(mesh.shininess).toBe(0);
			mesh.destroy();
		});

		it("a material with neither leaves the mesh purely diffuse", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh("plain");
			expect(mesh.specular).toBeUndefined();
			expect(mesh.shininess).toBe(0);
			mesh.destroy();
		});

		it("the shader masks the highlight by the UNWRAPPED Lambert term", async () => {
			// Half-Lambert lifts the shadowed side to 0.25 at 90 degrees, so
			// reusing it for specular would light a highlight on a surface
			// facing away from the light. Pinned on the source: there is no
			// pixel-level harness for a lit mesh here, and this is the one
			// place the two terms must NOT share a factor.
			const [glsl, wgsl] = await Promise.all([
				import("../src/video/webgl/shaders/mesh-lit.frag?raw"),
				import("../src/video/webgpu/shaders/mesh-lit.wgsl?raw"),
			]);
			expect(glsl.default).toContain("max(dot(N, L), 0.0)");
			expect(wgsl.default).toContain("max(dot(n, lightDir), 0.0)");
			// and both gate on the exponent, not the colour
			expect(glsl.default).toContain("uShininess > 0.0");
			expect(wgsl.default).toContain("shininess > 0.0");
		});
	});

	// ── alpha maps ──────────────────────────────────────────────────────

	describe("alpha maps", () => {
		it("resolves map_d onto the mesh, distinct from the diffuse texture", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh("alpha");
			expect(mesh.alphaMap).toBeDefined();
			expect(mesh.alphaMap).not.toBe(mesh.texture);
			mesh.destroy();
		});

		it("is undefined for a material without one", (ctx) => {
			requireWebGL(ctx, renderer);
			expect(makeMesh("plain").alphaMap).toBeUndefined();
		});

		it("the MTL loader fetches map_d as well as map_Kd", () => {
			// both maps must be resident without the caller preloading either
			expect(loader.getImage("/data/models/multitex-alpha.png")).not.toBe(null);
			expect(loader.getImage("/data/models/multitex-a.png")).not.toBe(null);
		});

		it("ADVERSARIAL: a missing map_d warns and keeps the mesh renderable", (ctx) => {
			requireWebGL(ctx, renderer);
			// the mesh loses its cut-outs, which is far easier to diagnose
			// than a model that never appeared
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const mesh = new Mesh(0, 0, {
				model: "mat_plain",
				material: "mtl_material",
				width: 32,
				alphaMap: "not-a-real-map.png",
			});
			expect(warn).toHaveBeenCalled();
			expect(mesh.alphaMap).toBeUndefined();
			warn.mockRestore();
			mesh.destroy();
		});

		it("ADVERSARIAL: the map multiplies alpha BEFORE the cutout", async () => {
			// the other order — threshold, then scale — cuts nothing out,
			// because a fragment that survived the test keeps its alpha
			// whatever the map says. Pinned on both shader sources, in both
			// tiers, since the ordering is invisible to a call-count test.
			const sources = await Promise.all([
				import("../src/video/webgl/shaders/mesh.frag?raw"),
				import("../src/video/webgl/shaders/mesh-lit.frag?raw"),
				import("../src/video/webgpu/shaders/mesh.wgsl?raw"),
				import("../src/video/webgpu/shaders/mesh-lit.wgsl?raw"),
			]);
			for (const source of sources) {
				const text = source.default;
				const sampled = text.indexOf("uAlphaMap");
				const cutoff = Math.max(
					text.indexOf("uAlphaCutoff);"),
					text.indexOf("< uAlphaCutoff"),
					text.indexOf("uMesh.params.x"),
				);
				expect(sampled).toBeGreaterThan(-1);
				expect(cutoff).toBeGreaterThan(sampled);
			}
		});

		it("ADVERSARIAL: both backends weight the sample rather than branch", async () => {
			// One backend branching and the other multiplying is exactly how
			// the emissive early-return diverged in #1572. Weighting also
			// keeps the WGSL sample in uniform control flow.
			const [glsl, wgsl] = await Promise.all([
				import("../src/video/webgl/shaders/mesh-lit.frag?raw"),
				import("../src/video/webgpu/shaders/mesh-lit.wgsl?raw"),
			]);
			expect(glsl.default).toContain("mix(1.0,");
			expect(wgsl.default).toContain("mix(1.0,");
			expect(glsl.default).not.toContain("if (uHasAlphaMap)");
		});
	});
});
