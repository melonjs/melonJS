import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Camera3d, loader, Mesh } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Per-material diffuse textures on a multi-material mesh (#1573).
 *
 * A multi-material OBJ used to bind whichever `map_Kd` came first for the
 * whole model, so a crate with wood sides and a metal lid rendered entirely
 * in wood. Each material's *colour* already composed correctly (it is baked
 * per-vertex at construction), which made the asymmetry the confusing part.
 *
 * What is pinned here is both halves of the fix: the resolution — which
 * index ranges end up needing their own texture, and which collapse — and
 * the draw, where the ranges must become one indexed draw each over the same
 * buffers, and a model that needs no split must still issue exactly the one
 * draw call it always did.
 *
 * The fixture (`tests/public/data/models/multitex.*`) is four single-triangle
 * material groups:
 *
 *   alpha → multitex-a.png   \ adjacent + same map: must MERGE
 *   beta  → multitex-a.png   /
 *   gamma → multitex-b.png     the switch
 *   plain → (no map_Kd)        falls back to the mesh texture (a)
 *
 * so the expected plan is three ranges: a[0..6), b[6..9), a[9..12).
 */
describe("Mesh per-material textures (#1573)", () => {
	let renderer;
	let camera;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(128, 128);
		camera = new Camera3d(0, 0, 128, 128);
		await loader.load({
			name: "multitex",
			type: "obj",
			src: "/data/models/multitex.obj",
		});
		await loader.load({
			name: "multitex",
			type: "mtl",
			src: "/data/models/multitex.mtl",
		});
		await loader.load({
			name: "multitex_missing",
			type: "mtl",
			src: "/data/models/multitex-missing.mtl",
		});
		await loader.load({
			name: "multitex_kdonly",
			type: "mtl",
			src: "/data/models/multitex-kdonly.mtl",
		});
		// a single-material OBJ + MTL pair, the no-split control
		await loader.load({
			name: "single",
			type: "obj",
			src: "/data/models/single.obj",
		});
		await loader.load({
			name: "single",
			type: "mtl",
			src: "/data/models/cube.mtl",
		});
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const makeMesh = (settings = {}) => {
		return new Mesh(0, 0, {
			model: "multitex",
			material: "multitex",
			width: 32,
			...settings,
		});
	};

	// ── resolution ──────────────────────────────────────────────────────

	describe("resolving the draw plan", () => {
		it("splits into one range per distinct texture, merging adjacent sharers", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh();
			const groups = mesh.textureGroups;
			expect(groups).toBeDefined();
			expect(groups).toHaveLength(3);

			expect(groups[0].start).toBe(0);
			// alpha + beta collapsed into one range rather than two draws
			expect(groups[0].count).toBe(6);
			expect(groups[1].start).toBe(6);
			expect(groups[1].count).toBe(3);
			expect(groups[2].start).toBe(9);
			expect(groups[2].count).toBe(3);

			// distinct maps → distinct atlases; the merged pair and the
			// map-less fallback both land on the SAME atlas object, which is
			// what makes merging by identity correct
			expect(groups[0].texture).not.toBe(groups[1].texture);
			expect(groups[2].texture).toBe(groups[0].texture);
			mesh.destroy();
		});

		it("covers every index exactly once, in order", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh();
			let cursor = 0;
			for (const group of mesh.textureGroups) {
				expect(group.start).toBe(cursor);
				cursor += group.count;
			}
			expect(cursor).toBe(mesh.indices.length);
			mesh.destroy();
		});

		it("hangs each material's own texture on its group descriptor", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh();
			expect(
				mesh.groups.map((g) => {
					return g.materialName;
				}),
			).toEqual(["alpha", "beta", "gamma", "plain"]);
			expect(mesh.groups[0].texture).toBe(mesh.groups[1].texture);
			expect(mesh.groups[2].texture).not.toBe(mesh.groups[0].texture);
			// no map_Kd of its own → the mesh-level texture
			expect(mesh.groups[3].texture).toBe(mesh.texture);
			mesh.destroy();
		});

		it("mesh.texture stays the first map_Kd — what a consumer ignoring the split draws", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh();
			expect(mesh.texture).toBe(mesh.textureGroups[0].texture);
			mesh.destroy();
		});

		it("stays undefined for a single-material model", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = new Mesh(0, 0, {
				model: "single",
				material: "single",
				width: 32,
			});
			expect(mesh.textureGroups).toBeUndefined();
			mesh.destroy();
		});

		it("stays undefined for a Kd-only multi-material model", (ctx) => {
			requireWebGL(ctx, renderer);
			// every group falls back to the same (white-pixel) texture, so
			// there is nothing to switch — colour is baked per-vertex
			const mesh = new Mesh(0, 0, {
				model: "multitex",
				material: "multitex_kdonly",
				width: 32,
			});
			expect(mesh.textureGroups).toBeUndefined();
			mesh.destroy();
		});

		it("an explicit `texture:` suppresses the split entirely", (ctx) => {
			requireWebGL(ctx, renderer);
			// asking for one texture is asking for one texture — the MTL's
			// per-material maps must not override the caller
			const mesh = makeMesh({ texture: "multitex-b.png" });
			expect(mesh.textureGroups).toBeUndefined();
			mesh.destroy();
		});

		it("warns and falls back when a material's map_Kd never loaded", (ctx) => {
			requireWebGL(ctx, renderer);
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const mesh = makeMesh({ material: "multitex_missing" });
			// the missing map names itself in the warning rather than
			// throwing the whole mesh away
			expect(warn).toHaveBeenCalled();
			expect(
				warn.mock.calls.some((c) => {
					return /multitex-nowhere/.test(c[0]);
				}),
			).toBe(true);
			// gamma degraded to the mesh texture, so alpha/beta/gamma/plain all
			// share one binding and no split is needed at all
			expect(mesh.textureGroups).toBeUndefined();
			warn.mockRestore();
			mesh.destroy();
		});
	});

	// ── the WebGL draw ──────────────────────────────────────────────────

	describe("the retained draw", () => {
		const drawOnce = (mesh) => {
			mesh.preDraw(renderer);
			mesh.draw(renderer, camera);
			mesh.postDraw(renderer);
			renderer.flush();
		};

		it("issues one indexed draw per range, at the right byte offsets", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeMesh();
			drawOnce(mesh); // first draw uploads the geometry

			const spy = vi.spyOn(gl, "drawElements");
			drawOnce(mesh);
			expect(spy).toHaveBeenCalledTimes(3);
			// (mode, count, type, byteOffset) — 12 indices as Uint16, so the
			// offsets are index × 2. An offset in INDICES rather than bytes
			// would draw the wrong triangles without any GL error.
			expect(spy.mock.calls[0][1]).toBe(6);
			expect(spy.mock.calls[0][3]).toBe(0);
			expect(spy.mock.calls[1][1]).toBe(3);
			expect(spy.mock.calls[1][3]).toBe(12);
			expect(spy.mock.calls[2][1]).toBe(3);
			expect(spy.mock.calls[2][3]).toBe(18);
			expect(gl.getError()).toBe(gl.NO_ERROR);
			spy.mockRestore();
			mesh.destroy();
		});

		it("REGRESSION: a single-texture mesh still issues exactly ONE draw", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = new Mesh(0, 0, {
				model: "single",
				material: "single",
				width: 32,
			});
			drawOnce(mesh);

			const spy = vi.spyOn(gl, "drawElements");
			drawOnce(mesh);
			expect(spy).toHaveBeenCalledTimes(1);
			expect(spy.mock.calls[0][3]).toBe(0);
			spy.mockRestore();
			mesh.destroy();
		});

		it("binds each range's own texture, and re-uses the shared one", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh();
			drawOnce(mesh);

			const batcher = renderer.currentBatcher;
			const bound = [];
			const original = batcher.applyMeshMaterial;
			batcher.applyMeshMaterial = function (target, texture) {
				bound.push(texture);
				return original.call(this, target, texture);
			};
			drawOnce(mesh);
			delete batcher.applyMeshMaterial;

			// the three ranges resolve in order, and the last returns to the
			// first's atlas rather than picking up a third binding
			expect(bound).toHaveLength(3);
			expect(bound[0]).toBe(mesh.textureGroups[0].texture);
			expect(bound[1]).toBe(mesh.textureGroups[1].texture);
			expect(bound[2]).toBe(bound[0]);
			mesh.destroy();
		});

		it("points the sampler at a different unit for the switching range", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh();
			drawOnce(mesh);

			const batcher = renderer.currentBatcher;
			const units = [];
			const original = batcher.bindSamplerUnit;
			batcher.bindSamplerUnit = function (unit) {
				units.push(unit);
				return original.call(this, unit);
			};
			drawOnce(mesh);
			delete batcher.bindSamplerUnit;

			// three ranges' worth of sampler binds happen inside the draw loop,
			// after the pre-pass that resolved them: the middle one must differ
			// from its neighbours, and the third must return to the first's unit
			const inLoop = units.slice(-3);
			expect(inLoop[0]).not.toBe(inLoop[1]);
			expect(inLoop[2]).toBe(inLoop[0]);
			mesh.destroy();
		});

		it("does not leave the split bound for the next mesh", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const split = makeMesh();
			const plain = new Mesh(0, 0, {
				model: "single",
				material: "single",
				width: 32,
			});
			drawOnce(split);
			drawOnce(plain);

			const spy = vi.spyOn(gl, "drawElements");
			drawOnce(split);
			drawOnce(plain);
			// 3 for the split model, then 1 for the plain one — the plain mesh
			// must not inherit the previous mesh's ranges
			expect(spy).toHaveBeenCalledTimes(4);
			expect(spy.mock.calls[3][1]).toBe(plain.indices.length);
			expect(gl.getError()).toBe(gl.NO_ERROR);
			spy.mockRestore();
			split.destroy();
			plain.destroy();
		});
	});

	// ── the WebGL accumulated (Camera2d) draw ───────────────────────────

	describe("the accumulated draw", () => {
		const drawOnce2d = (mesh) => {
			mesh.preDraw(renderer);
			mesh.draw(renderer);
			mesh.postDraw(renderer);
			renderer.flush();
		};

		it("flushes between ranges so each lands under its own texture", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeMesh();
			// no viewport and no world-space flag → the 2D accumulated path
			expect(mesh._useWorldSpace).not.toBe(true);
			drawOnce2d(mesh);

			const spy = vi.spyOn(gl, "drawElements");
			drawOnce2d(mesh);
			// one flush per texture change: a[0..6) and b[6..9) and a[9..12)
			expect(spy).toHaveBeenCalledTimes(3);
			// every range's triangles are accounted for (2 + 1 + 1 triangles)
			const drawn = spy.mock.calls.reduce((sum, call) => {
				return sum + call[1];
			}, 0);
			expect(drawn).toBe(mesh.indices.length);
			expect(gl.getError()).toBe(gl.NO_ERROR);
			spy.mockRestore();
			mesh.destroy();
		});

		it("REGRESSION: an unsplit mesh accumulates in ONE draw", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = new Mesh(0, 0, {
				model: "single",
				material: "single",
				width: 32,
			});
			drawOnce2d(mesh);

			const spy = vi.spyOn(gl, "drawElements");
			drawOnce2d(mesh);
			expect(spy).toHaveBeenCalledTimes(1);
			expect(spy.mock.calls[0][1]).toBe(mesh.indices.length);
			spy.mockRestore();
			mesh.destroy();
		});
	});
});
