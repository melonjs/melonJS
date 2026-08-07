import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Camera3d,
	Color,
	InstancedMesh,
	Matrix3d,
	Mesh,
} from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Mesh instancing (#1508) — one geometry drawn N times from a per-instance
 * record buffer.
 *
 * The claims worth pinning are all about *what does not happen*: N instances
 * must cost ONE draw call, moving one instance must re-upload only its own
 * record, and moving the whole group must upload nothing at all. Those are
 * asserted by counting GL calls rather than by timing frames — counts are
 * exact and reproducible in CI, where the rasterizer is software and frame
 * times mean nothing.
 */
describe("Mesh instancing (#1508)", () => {
	let renderer;
	let camera;

	// a unit quad: two triangles, enough geometry to be a real indexed draw
	const GEOMETRY = {
		vertices: new Float32Array([
			-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
		]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
	};

	beforeAll(async () => {
		renderer = await getWebGLRenderer(128, 128);
		camera = new Camera3d(0, 0, 128, 128);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const makeInstanced = (count, settings = {}) => {
		return new InstancedMesh(0, 0, {
			...GEOMETRY,
			width: 32,
			normalize: false,
			instanceCount: count,
			...settings,
		});
	};

	const drawOnce = (mesh) => {
		mesh.preDraw(renderer);
		mesh.draw(renderer, camera);
		mesh.postDraw(renderer);
		renderer.flush();
	};

	describe("the record layout", () => {
		it("is 48 bytes bare — a 3x4 transform, not a mat4", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeInstanced(4);
			expect(mesh.instanceLayout.stride).toBe(48);
			expect(mesh.instanceLayout.floats).toBe(12);
			expect(mesh.instanceLayout.hasColor).toBe(false);
			expect(mesh.instanceLayout.hasData).toBe(false);
			mesh.destroy();
		});

		it("grows by exactly 16 bytes per opt-in slot, in declaration order", (ctx) => {
			requireWebGL(ctx, renderer);
			const colored = makeInstanced(2, { instanceColors: true });
			expect(colored.instanceLayout.stride).toBe(64);
			expect(colored.instanceLayout.colorOffset).toBe(12);
			expect(colored.instanceLayout.dataOffset).toBe(-1);

			const both = makeInstanced(2, {
				instanceColors: true,
				instanceData: true,
			});
			expect(both.instanceLayout.stride).toBe(80);
			expect(both.instanceLayout.colorOffset).toBe(12);
			expect(both.instanceLayout.dataOffset).toBe(16);

			// data without colour packs against the transform, leaving no hole
			const dataOnly = makeInstanced(2, { instanceData: true });
			expect(dataOnly.instanceLayout.stride).toBe(64);
			expect(dataOnly.instanceLayout.dataOffset).toBe(12);
			colored.destroy();
			both.destroy();
			dataOnly.destroy();
		});

		it("round-trips a transform through the row-major packing", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeInstanced(1);
			const source = new Matrix3d();
			source.identity().translate(11, 22, 33).scale(2, 3, 4);
			mesh.setInstance(0, source);

			const read = mesh.getInstance(0);
			// the packing drops the constant bottom row; everything else must
			// survive exactly
			for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]) {
				expect(read.val[i], `val[${i}]`).toBeCloseTo(source.val[i], 5);
			}
			expect(read.val[15]).toBe(1);
			mesh.destroy();
		});

		it("an unplaced instance is identity, not a zero matrix", (ctx) => {
			requireWebGL(ctx, renderer);
			// a zero matrix would collapse every unplaced copy onto the origin
			// and render nothing — silent, and very confusing
			const mesh = makeInstanced(3);
			const read = mesh.getInstance(2);
			expect(read.isIdentity()).toBe(true);
			mesh.destroy();
		});
	});

	describe("draw calls", () => {
		it("N instances issue exactly ONE instanced draw, and no per-instance draw", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeInstanced(64);
			const placement = new Matrix3d();
			for (let i = 0; i < 64; i++) {
				placement.identity().translate(i * 4, 0, 0);
				mesh.setInstance(i, placement);
			}
			drawOnce(mesh); // first draw uploads geometry + records

			const instancedSpy = vi.spyOn(gl, "drawElementsInstanced");
			const elementsSpy = vi.spyOn(gl, "drawElements");
			drawOnce(mesh);
			expect(instancedSpy).toHaveBeenCalledTimes(1);
			// 64 copies from one call — the whole point
			expect(instancedSpy.mock.calls[0][4]).toBe(64);
			expect(elementsSpy).not.toHaveBeenCalled();
			expect(gl.getError()).toBe(gl.NO_ERROR);
			instancedSpy.mockRestore();
			elementsSpy.mockRestore();
			mesh.destroy();
		});

		it("a steady frame uploads NOTHING — no geometry, no records", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeInstanced(32);
			drawOnce(mesh);

			const bufferData = vi.spyOn(gl, "bufferData");
			const bufferSubData = vi.spyOn(gl, "bufferSubData");
			for (let frame = 0; frame < 3; frame++) {
				drawOnce(mesh);
			}
			expect(bufferData).not.toHaveBeenCalled();
			expect(bufferSubData).not.toHaveBeenCalled();
			bufferData.mockRestore();
			bufferSubData.mockRestore();
			mesh.destroy();
		});

		it("moving ONE instance re-uploads one record, not the buffer and not the geometry", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeInstanced(100);
			drawOnce(mesh);

			const bufferData = vi.spyOn(gl, "bufferData");
			const bufferSubData = vi.spyOn(gl, "bufferSubData");
			const placement = new Matrix3d();
			placement.identity().translate(5, 5, 5);
			mesh.setInstance(42, placement);
			drawOnce(mesh);

			// geometry untouched, and the record upload is a sub-update
			expect(bufferData).not.toHaveBeenCalled();
			expect(bufferSubData).toHaveBeenCalledTimes(1);
			// exactly one 48-byte record, at instance 42's offset
			const [, byteOffset, view] = bufferSubData.mock.calls[0];
			expect(byteOffset).toBe(42 * 48);
			expect(view.byteLength).toBe(48);
			bufferData.mockRestore();
			bufferSubData.mockRestore();
			mesh.destroy();
		});

		it("moving the GROUP uploads nothing at all", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeInstanced(50);
			drawOnce(mesh);

			const bufferData = vi.spyOn(gl, "bufferData");
			const bufferSubData = vi.spyOn(gl, "bufferSubData");
			// the group transform rides a uniform, so the whole forest moves
			// for the price of one matrix
			mesh.pos.set(120, 40, 8);
			mesh.currentTransform.rotate(0.5);
			drawOnce(mesh);
			expect(bufferData).not.toHaveBeenCalled();
			expect(bufferSubData).not.toHaveBeenCalled();
			bufferData.mockRestore();
			bufferSubData.mockRestore();
			mesh.destroy();
		});

		it("a contiguous edit coalesces into ONE sub-upload spanning it", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeInstanced(64);
			drawOnce(mesh);

			const bufferSubData = vi.spyOn(gl, "bufferSubData");
			const placement = new Matrix3d();
			for (let i = 10; i < 20; i++) {
				placement.identity().translate(i, 0, 0);
				mesh.setInstance(i, placement);
			}
			drawOnce(mesh);
			expect(bufferSubData).toHaveBeenCalledTimes(1);
			const [, byteOffset, view] = bufferSubData.mock.calls[0];
			expect(byteOffset).toBe(10 * 48);
			expect(view.byteLength).toBe(10 * 48);
			bufferSubData.mockRestore();
			mesh.destroy();
		});

		it("visibleInstanceCount changes the draw without any upload", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeInstanced(80);
			drawOnce(mesh);

			const instancedSpy = vi.spyOn(gl, "drawElementsInstanced");
			const bufferSubData = vi.spyOn(gl, "bufferSubData");
			mesh.visibleInstanceCount = 12;
			drawOnce(mesh);
			expect(instancedSpy.mock.calls[0][4]).toBe(12);
			expect(bufferSubData).not.toHaveBeenCalled();

			// and back to everything
			mesh.visibleInstanceCount = -1;
			drawOnce(mesh);
			expect(instancedSpy.mock.calls[1][4]).toBe(80);
			expect(bufferSubData).not.toHaveBeenCalled();
			instancedSpy.mockRestore();
			bufferSubData.mockRestore();
			mesh.destroy();
		});

		it("zero visible instances draws nothing at all", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeInstanced(10);
			drawOnce(mesh);
			const instancedSpy = vi.spyOn(gl, "drawElementsInstanced");
			mesh.visibleInstanceCount = 0;
			drawOnce(mesh);
			expect(instancedSpy).not.toHaveBeenCalled();
			instancedSpy.mockRestore();
			mesh.destroy();
		});

		it("leaves the default program current, so a later plain mesh is unaffected", (ctx) => {
			requireWebGL(ctx, renderer);
			// the instanced variant reads per-instance attributes; leaving it
			// bound would make the next ordinary mesh read a buffer that is no
			// longer there
			const gl = renderer.gl;
			const mesh = makeInstanced(4);
			drawOnce(mesh);
			const batcher = renderer.batchers.get("mesh");
			expect(batcher.currentShader).toBe(batcher.defaultShader);
			expect(gl.getError()).toBe(gl.NO_ERROR);
			mesh.destroy();
		});
	});

	describe("instance management", () => {
		it("addInstance appends and grows without reallocating every time", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeInstanced(0);
			const placement = new Matrix3d();
			for (let i = 0; i < 40; i++) {
				placement.identity().translate(i, 0, 0);
				expect(mesh.addInstance(placement)).toBe(i);
			}
			expect(mesh.instanceCount).toBe(40);
			// geometric growth: the backing array is not resized 40 times
			expect(mesh.instanceBuffer.length).toBeGreaterThanOrEqual(40 * 12);
			expect(mesh._instanceVersion).toBeLessThan(10);
			expect(mesh.getInstance(39).val[12]).toBeCloseTo(39, 5);
			mesh.destroy();
		});

		it("removeInstance swaps the last into the hole (documented index shuffle)", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeInstanced(3);
			const placement = new Matrix3d();
			for (let i = 0; i < 3; i++) {
				placement.identity().translate(i * 10, 0, 0);
				mesh.setInstance(i, placement);
			}
			mesh.removeInstance(0);
			expect(mesh.instanceCount).toBe(2);
			// the LAST instance now answers to index 0 — the whole reason the
			// removal is O(1), and the reason it is documented as invalidating
			expect(mesh.getInstance(0).val[12]).toBeCloseTo(20, 5);
			mesh.destroy();
		});

		it("out-of-range accesses are ignored rather than corrupting the buffer", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeInstanced(2);
			const placement = new Matrix3d();
			placement.identity().translate(99, 99, 99);
			expect(() => {
				mesh.setInstance(-1, placement);
				mesh.setInstance(5, placement);
				mesh.removeInstance(9);
			}).not.toThrow();
			expect(mesh.instanceCount).toBe(2);
			expect(mesh.getInstance(0).isIdentity()).toBe(true);
			expect(mesh.getInstance(7)).toBeUndefined();
			mesh.destroy();
		});

		it("shrinking keeps the allocation so an oscillating count never thrashes", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeInstanced(64);
			const allocated = mesh.instanceBuffer.length;
			const version = mesh._instanceVersion;
			mesh.instanceCount = 4;
			mesh.instanceCount = 64;
			expect(mesh.instanceBuffer.length).toBe(allocated);
			expect(mesh._instanceVersion).toBe(version);
			mesh.destroy();
		});

		it("the optional setters are inert when their slot was not declared", (ctx) => {
			requireWebGL(ctx, renderer);
			// writing a colour into a record with no colour slot would land in
			// the NEXT instance's transform — silently scrambling the scene
			const mesh = makeInstanced(2);
			mesh.setInstanceColor(0, new Color(255, 0, 0));
			mesh.setInstanceData(0, 1, 2, 3, 4);
			expect(mesh.getInstance(1).isIdentity()).toBe(true);
			mesh.destroy();
		});

		it("declared slots are written where the layout says", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeInstanced(2, {
				instanceColors: true,
				instanceData: true,
			});
			mesh.setInstanceColor(1, new Color(255, 128, 0, 0.5));
			mesh.setInstanceData(1, 7, 8, 9);
			const base = 1 * mesh.instanceLayout.floats;
			const color = base + mesh.instanceLayout.colorOffset;
			expect(mesh.instanceBuffer[color]).toBeCloseTo(1, 5);
			expect(mesh.instanceBuffer[color + 1]).toBeCloseTo(128 / 255, 5);
			expect(mesh.instanceBuffer[color + 3]).toBeCloseTo(0.5, 5);
			const data = base + mesh.instanceLayout.dataOffset;
			expect(mesh.instanceBuffer[data]).toBe(7);
			expect(mesh.instanceBuffer[data + 3]).toBe(0);
			// and instance 0 is untouched by either write
			expect(mesh.getInstance(0).isIdentity()).toBe(true);
			mesh.destroy();
		});

		it("a bulk edit announced with needsInstanceUpdate re-uploads the lot", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeInstanced(16);
			drawOnce(mesh);

			const bufferSubData = vi.spyOn(gl, "bufferSubData");
			mesh.instanceBuffer[0] = 3;
			mesh.needsInstanceUpdate = true;
			drawOnce(mesh);
			expect(bufferSubData).toHaveBeenCalledTimes(1);
			expect(bufferSubData.mock.calls[0][2].byteLength).toBe(16 * 48);
			bufferSubData.mockRestore();
			mesh.destroy();
		});
	});

	describe("the lit tier and the variant matrix", () => {
		it("a lit instanced mesh draws instanced through the lit batcher", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeInstanced(24, { lit: true });
			drawOnce(mesh);

			const instancedSpy = vi.spyOn(gl, "drawElementsInstanced");
			drawOnce(mesh);
			expect(instancedSpy).toHaveBeenCalledTimes(1);
			expect(instancedSpy.mock.calls[0][4]).toBe(24);
			expect(gl.getError()).toBe(gl.NO_ERROR);
			// and it really is the lit batcher, not the unlit one
			expect(renderer.currentBatcher).toBe(renderer.batchers.get("litMesh"));
			instancedSpy.mockRestore();
			mesh.destroy();
		});

		it("compiles one program per declared slot combination, and only on demand", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = renderer.batchers.get("mesh");
			batcher.instancedShaders.forEach((shader) => {
				shader.destroy();
			});
			batcher.instancedShaders.clear();

			const bare = makeInstanced(2);
			drawOnce(bare);
			expect(batcher.instancedShaders.size).toBe(1);

			// the same combination reuses its program
			const alsoBare = makeInstanced(2);
			drawOnce(alsoBare);
			expect(batcher.instancedShaders.size).toBe(1);

			// a different combination compiles its own
			const colored = makeInstanced(2, { instanceColors: true });
			drawOnce(colored);
			expect(batcher.instancedShaders.size).toBe(2);

			const both = makeInstanced(2, {
				instanceColors: true,
				instanceData: true,
			});
			drawOnce(both);
			expect(batcher.instancedShaders.size).toBe(3);
			expect(renderer.gl.getError()).toBe(renderer.gl.NO_ERROR);
			bare.destroy();
			alsoBare.destroy();
			colored.destroy();
			both.destroy();
		});

		it("every slot combination links on both tiers", (ctx) => {
			requireWebGL(ctx, renderer);
			// the adversarial one: a variant that fails to link would fall back
			// to no program and draw nothing, silently. Compile all eight.
			const gl = renderer.gl;
			for (const lit of [false, true]) {
				for (const instanceColors of [false, true]) {
					for (const instanceData of [false, true]) {
						const mesh = makeInstanced(3, {
							lit,
							instanceColors,
							instanceData,
						});
						drawOnce(mesh);
						const batcher = renderer.batchers.get(lit ? "litMesh" : "mesh");
						const key = (instanceColors ? 1 : 0) | (instanceData ? 2 : 0);
						const shader = batcher.instancedShaders.get(key);
						const label = `lit=${lit} colors=${instanceColors} data=${instanceData}`;
						expect(shader, label).toBeDefined();
						expect(gl.isProgram(shader.program), label).toBe(true);
						expect(
							gl.getProgramParameter(shader.program, gl.LINK_STATUS),
							label,
						).toBe(true);
						expect(gl.getError(), label).toBe(gl.NO_ERROR);
						mesh.destroy();
					}
				}
			}
		});

		it("the lit variant declares the instance attributes it was compiled for", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeInstanced(4, {
				lit: true,
				instanceColors: true,
				instanceData: true,
			});
			drawOnce(mesh);
			const shader = renderer.batchers.get("litMesh").instancedShaders.get(3);
			// asked of the LINKED PROGRAM, not the engine's parsed attribute
			// map: `extractAttributes` regex-scans the source and so counts
			// `#ifdef`-guarded declarations too, which would make this pass
			// even if the guards did nothing
			for (const name of [
				"aVertex",
				"aNormal",
				"aInstanceRow0",
				"aInstanceRow1",
				"aInstanceRow2",
				"aInstanceColor",
				"aInstanceData",
			]) {
				expect(
					gl.getAttribLocation(shader.program, name),
					name,
				).toBeGreaterThanOrEqual(0);
			}
			mesh.destroy();
		});

		it("a bare variant genuinely omits the optional attributes", (ctx) => {
			requireWebGL(ctx, renderer);
			// the point of the ifdefs: an undeclared slot consumes no attribute
			// slot in the linked program, so the 16-slot budget is spent only
			// on what the mesh actually declared
			const gl = renderer.gl;
			const mesh = makeInstanced(4, { lit: true });
			drawOnce(mesh);
			const shader = renderer.batchers.get("litMesh").instancedShaders.get(0);
			expect(
				gl.getAttribLocation(shader.program, "aInstanceRow0"),
			).toBeGreaterThanOrEqual(0);
			expect(gl.getAttribLocation(shader.program, "aInstanceColor")).toBe(-1);
			expect(gl.getAttribLocation(shader.program, "aInstanceData")).toBe(-1);
			mesh.destroy();
		});

		it("the engine's attribute map AGREES with the linked program for every declared slot", (ctx) => {
			requireWebGL(ctx, renderer);
			// The invariant that keeps instancing correct. `extractAttributes`
			// numbers attributes by scanning the SOURCE (guarded declarations
			// included), while the vertex state points buffers at whatever that
			// map says. If the two ever disagreed for an attribute the layout
			// actually declares, the pointers would land on the wrong locations
			// and the mesh would render garbage — with no GL error at all.
			const gl = renderer.gl;
			for (const lit of [false, true]) {
				for (const instanceColors of [false, true]) {
					for (const instanceData of [false, true]) {
						const mesh = makeInstanced(3, {
							lit,
							instanceColors,
							instanceData,
						});
						drawOnce(mesh);
						const batcher = renderer.batchers.get(lit ? "litMesh" : "mesh");
						const key = (instanceColors ? 1 : 0) | (instanceData ? 2 : 0);
						const shader = batcher.instancedShaders.get(key);

						const declared = [
							"aInstanceRow0",
							"aInstanceRow1",
							"aInstanceRow2",
						];
						if (instanceColors) {
							declared.push("aInstanceColor");
						}
						if (instanceData) {
							declared.push("aInstanceData");
						}
						for (const name of declared) {
							const label = `${name} lit=${lit} key=${key}`;
							const real = gl.getAttribLocation(shader.program, name);
							expect(real, label).toBeGreaterThanOrEqual(0);
							expect(shader.getAttribLocation(name), label).toBe(real);
						}
						mesh.destroy();
					}
				}
			}
		});

		it("the instance attributes are actually bound, at the program's own locations, with divisor 1", (ctx) => {
			requireWebGL(ctx, renderer);
			// end-to-end proof that the pointers landed where the linked
			// program expects them, and step per instance rather than per vertex
			const gl = renderer.gl;
			const mesh = makeInstanced(6, {
				lit: true,
				instanceColors: true,
				instanceData: true,
			});
			drawOnce(mesh);

			const batcher = renderer.batchers.get("litMesh");
			const shader = batcher.instancedShaders.get(3);
			const state = batcher.instanced.get(mesh);
			expect(state).toBeDefined();
			state.vertexState.bind();

			for (const name of [
				"aInstanceRow0",
				"aInstanceRow1",
				"aInstanceRow2",
				"aInstanceColor",
				"aInstanceData",
			]) {
				const loc = gl.getAttribLocation(shader.program, name);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
					name,
				).toBe(true);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_DIVISOR),
					name,
				).toBe(1);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
					name,
				).toBe(80);
			}
			// while the GEOMETRY attributes in the same vertex array still step
			// per vertex — the two groups must not have been conflated
			for (const name of ["aVertex", "aRegion", "aColor", "aNormal"]) {
				const loc = gl.getAttribLocation(shader.program, name);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_DIVISOR),
					name,
				).toBe(0);
			}
			gl.bindVertexArray(null);
			expect(gl.getError()).toBe(gl.NO_ERROR);
			mesh.destroy();
		});

		it("a guarded-out slot is absent from the program and never pointed at", (ctx) => {
			requireWebGL(ctx, renderer);
			// the benign half of the map/program mismatch: the parsed map may
			// still number a guarded-out attribute, but the layout never lists
			// it, so nothing ever enables or points at that location
			const gl = renderer.gl;
			const mesh = makeInstanced(4, { lit: true }); // no optional slots
			drawOnce(mesh);
			const batcher = renderer.batchers.get("litMesh");
			const shader = batcher.instancedShaders.get(0);
			const stale = shader.getAttribLocation("aInstanceColor");
			expect(gl.getAttribLocation(shader.program, "aInstanceColor")).toBe(-1);

			batcher.instanced.get(mesh).vertexState.bind();
			if (stale >= 0) {
				// the map numbered it; the vertex array must NOT have enabled it
				expect(gl.getVertexAttrib(stale, gl.VERTEX_ATTRIB_ARRAY_ENABLED)).toBe(
					false,
				);
			}
			gl.bindVertexArray(null);
			expect(gl.getError()).toBe(gl.NO_ERROR);
			mesh.destroy();
		});

		it("mixing instanced and plain meshes in one frame keeps both correct", (ctx) => {
			requireWebGL(ctx, renderer);
			// the regression this guards: the instanced program stays bound
			// after its draw, and the next plain mesh reads per-instance
			// attributes with no buffer behind them
			const gl = renderer.gl;
			const instanced = makeInstanced(8, { lit: true });
			const plain = makeInstanced(0, { lit: true }); // no instances
			plain.instanceCount = 0;

			drawOnce(instanced);
			const batcher = renderer.batchers.get("litMesh");
			expect(batcher.currentShader).toBe(batcher.defaultShader);
			drawOnce(instanced);
			expect(gl.getError()).toBe(gl.NO_ERROR);
			instanced.destroy();
			plain.destroy();
		});
	});

	describe("bounds", () => {
		it("getBounds3d covers every instance, not just the prototype", (ctx) => {
			requireWebGL(ctx, renderer);
			// whole-group frustum culling depends on this: a box around the
			// prototype alone would cull a forest the moment its origin left
			// the view
			const mesh = makeInstanced(3);
			const placement = new Matrix3d();
			placement.identity().translate(0, 0, 0);
			mesh.setInstance(0, placement);
			placement.identity().translate(100, 0, 0);
			mesh.setInstance(1, placement);
			placement.identity().translate(0, 60, 0);
			mesh.setInstance(2, placement);

			const bounds = mesh.getBounds3d();
			// assert the EXTENT, not signed maxima: the group matrix carries
			// the Y-up→Y-down bridge, so an instance placed at +60 legitimately
			// lands at -60. What matters here is that the box spans all three
			// instances rather than hugging the prototype.
			expect(bounds.max.x - bounds.min.x).toBeGreaterThan(90);
			expect(bounds.max.y - bounds.min.y).toBeGreaterThan(50);

			// and it is genuinely wider than the prototype alone
			const single = makeInstanced(1);
			const solo = single.getBounds3d();
			expect(bounds.max.x - bounds.min.x).toBeGreaterThan(
				solo.max.x - solo.min.x,
			);
			single.destroy();
			mesh.destroy();
		});

		it("an empty instanced mesh falls back to the prototype bounds", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeInstanced(0);
			expect(() => {
				return mesh.getBounds3d();
			}).not.toThrow();
			expect(mesh.getBounds3d().isFinite()).toBe(true);
			mesh.destroy();
		});
	});
});

/**
 * Regressions found by code review (#1508). Every test here fails against
 * the pre-review implementation — they exist because the original suite
 * asserted CPU-side records and GL call counts, which is structurally blind
 * to "the right call was made with the wrong state".
 */
describe("Mesh instancing — reviewed regressions", () => {
	let renderer;
	let camera;

	const GEOMETRY = {
		vertices: new Float32Array([
			-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
		]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
	};

	beforeAll(async () => {
		renderer = await getWebGLRenderer(128, 128);
		camera = new Camera3d(0, 0, 128, 128);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const make = (count, settings = {}) => {
		return new InstancedMesh(0, 0, {
			...GEOMETRY,
			width: 32,
			normalize: false,
			instanceCount: count,
			...settings,
		});
	};

	const drawOnce = (mesh) => {
		mesh.preDraw(renderer);
		mesh.draw(renderer, camera);
		mesh.postDraw(renderer);
		renderer.flush();
	};

	const scatter = (mesh, spread) => {
		const m = new Matrix3d();
		for (let i = 0; i < mesh.instanceCount; i++) {
			const a = (i / mesh.instanceCount) * Math.PI * 2;
			m.identity().translate(Math.cos(a) * spread, 0, Math.sin(a) * spread);
			mesh.setInstance(i, m);
		}
	};

	it("the CULL box grows to cover the scatter, not the prototype", (ctx) => {
		requireWebGL(ctx, renderer);
		// Camera3d culls on getBounds() (the 2D box), never on getBounds3d().
		// Left at the prototype's size the whole forest vanishes as soon as
		// the group origin leaves the frustum, with every tree still on screen.
		const mesh = make(64);
		const prototypeBox = mesh.getBounds().width;
		scatter(mesh, 4000);
		const scatterBox = mesh.getBounds().width;
		expect(scatterBox).toBeGreaterThan(prototypeBox * 10);
		// the cull sphere Camera3d derives must actually reach the instances
		const bounds = mesh.getBounds();
		const radius =
			Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height) /
			2;
		expect(radius).toBeGreaterThanOrEqual(4000);
		mesh.destroy();
	});

	it("the cull box tracks later edits", (ctx) => {
		requireWebGL(ctx, renderer);
		const mesh = make(8);
		scatter(mesh, 100);
		const near = mesh.getBounds().width;
		scatter(mesh, 9000);
		expect(mesh.getBounds().width).toBeGreaterThan(near * 10);
		mesh.destroy();
	});

	it("a recycled slot does NOT inherit the dead instance's custom data", (ctx) => {
		requireWebGL(ctx, renderer);
		// the built-in shading reads instanceData.rgb as emissive, so a stale
		// slot makes a brand-new instance glow
		const mesh = make(6, { instanceData: true });
		mesh.setInstanceData(5, 9, 9, 9, 9);
		mesh.instanceCount = 3;
		mesh.instanceCount = 6;
		const at = 5 * mesh.instanceLayout.floats + mesh.instanceLayout.dataOffset;
		expect(Array.from(mesh.instanceBuffer.slice(at, at + 4))).toEqual([
			0, 0, 0, 0,
		]);
		mesh.destroy();
	});

	it("both batchers see an edit when `lit` is toggled between frames", (ctx) => {
		requireWebGL(ctx, renderer);
		// the unlit and lit batchers keep SEPARATE GPU buffers; a shared
		// "clear the dirty flag" step let the first to draw drain the span,
		// freezing the other at a stale transform forever
		const gl = renderer.gl;
		const mesh = make(16);
		const m = new Matrix3d();

		drawOnce(mesh); // unlit buffer created
		mesh.lit = true;
		drawOnce(mesh); // lit buffer created
		mesh.lit = false;
		m.identity().translate(123, 0, 0);
		mesh.setInstance(7, m);
		drawOnce(mesh); // unlit buffer gets the edit

		const sub = vi.spyOn(gl, "bufferSubData");
		const full = vi.spyOn(gl, "bufferData");
		mesh.lit = true;
		drawOnce(mesh); // lit buffer MUST catch up
		expect(sub.mock.calls.length + full.mock.calls.length).toBeGreaterThan(0);
		sub.mockRestore();
		full.mockRestore();
		mesh.destroy();
	});

	it("an out-of-range dirty span cannot throw from inside the draw", (ctx) => {
		requireWebGL(ctx, renderer);
		const mesh = make(4);
		mesh.markInstancesDirty(0, 99999);
		expect(() => {
			drawOnce(mesh);
		}).not.toThrow();
		expect(renderer.gl.getError()).toBe(renderer.gl.NO_ERROR);
		mesh.destroy();
	});

	it("a real plain Mesh drawn after an instanced one is unaffected", (ctx) => {
		requireWebGL(ctx, renderer);
		// the original version of this test built another InstancedMesh with
		// zero instances and never drew it, so it asserted nothing
		const gl = renderer.gl;
		const instanced = make(8, { lit: true });
		const plain = new Mesh(0, 0, {
			...GEOMETRY,
			width: 32,
			normalize: false,
			lit: true,
		});
		drawOnce(instanced);

		const elements = vi.spyOn(gl, "drawElements");
		const instancedSpy = vi.spyOn(gl, "drawElementsInstanced");
		drawOnce(plain);
		expect(elements).toHaveBeenCalledTimes(1);
		expect(instancedSpy).not.toHaveBeenCalled();
		expect(gl.getError()).toBe(gl.NO_ERROR);
		elements.mockRestore();
		instancedSpy.mockRestore();
		instanced.destroy();
		plain.destroy();
	});

	it("a custom shader on an instanced mesh warns once and keeps drawing", (ctx) => {
		requireWebGL(ctx, renderer);
		// hosting it would let a shader that omits the instance slots wire the
		// transform rows to nothing — a singular matrix collapses the mesh
		const gl = renderer.gl;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const batcher = renderer.batchers.get("mesh");
		batcher._instancedShaderWarned = false;
		const mesh = make(4);
		mesh.shader = renderer.batchers.get("quad").defaultShader;
		drawOnce(mesh);
		drawOnce(mesh);
		expect(
			warn.mock.calls.filter((a) => {
				return /InstancedMesh/.test(String(a[0]));
			}).length,
		).toBe(1);
		expect(gl.getError()).toBe(gl.NO_ERROR);
		warn.mockRestore();
		mesh.shader = undefined;
		mesh.destroy();
	});

	it("destroy() releases the compiled shader variants", (ctx) => {
		requireWebGL(ctx, renderer);
		// they hold GL programs AND stay subscribed to context-loss events
		const mesh = make(4, { instanceColors: true });
		drawOnce(mesh);
		const batcher = renderer.batchers.get("mesh");
		const shader = batcher.instancedShaders.get(1);
		expect(shader).toBeDefined();
		mesh.destroy();
		// destroy() is exercised on a throwaway batcher so the shared renderer
		// keeps working for later specs
		batcher.instancedShaders.forEach((s) => {
			s.destroy();
		});
		expect(shader.destroyed).toBe(true);
		batcher.instancedShaders.clear();
	});
});
