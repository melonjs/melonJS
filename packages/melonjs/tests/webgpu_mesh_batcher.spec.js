import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Color, WebGPURenderer } from "../src/index.js";
import { instanceRecordLayout } from "../src/video/gpu/instancerecord.ts";
import WebGPULitMeshBatcher from "../src/video/webgpu/batchers/lit_mesh_batcher.js";
import WebGPUMeshBatcher, {
	MESH_UNIFORM_SIZE,
} from "../src/video/webgpu/batchers/mesh_batcher.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * A duck-typed mesh in the shape the batcher consumes — the accumulated
 * path reads working `vertices` (CPU-projected), `uvs`, `indices`, and the
 * material fields. A unit quad split into two triangles by default.
 */
function makeMesh(overrides = {}) {
	return {
		vertices: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		vertexCount: 4,
		texture: { id: "atlas" },
		textureRepeat: undefined,
		vertexColors: undefined,
		alphaCutoff: 0,
		emissive: undefined,
		lit: false,
		cullBackFaces: true,
		rightHanded: false,
		...overrides,
	};
}

describe("WebGPUMeshBatcher (mock device)", () => {
	let renderer;
	let batcher;

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPUMeshBatcher(renderer);
	});

	it("freezes the 36-byte unlit layout with a float32x4 color", () => {
		expect(batcher.stride).toBe(36);
		expect(batcher.vertexSize).toBe(9);
		expect(
			batcher.attributes.map((a) => {
				return a.format;
			}),
		).toEqual([
			"float32x3",
			"float32x2",
			// four floats, deliberately not unorm8x4 — layout parity with GL
			"float32x4",
		]);
	});

	it("registers the mesh family with the four-group layout list and its own vertex layout", () => {
		// dedup by module text: a second batcher re-registers the same key
		const again = new WebGPUMeshBatcher(renderer);
		expect(again.shaderKey).toBe(batcher.shaderKey);
		expect(renderer.pipelineCache.effectLayouts.has("mesh:u240")).toBe(true);
		// 176 before #1575, 208 before fog — grown by the specular vec4 and the
		// eye position, then by the fog colour and fog params
		expect(MESH_UNIFORM_SIZE).toBe(240);
	});

	it("addMesh dedups indexed vertices: 6 indices land as 4 vertices + drawIndexed(6)", () => {
		batcher.addMesh(makeMesh(), 0xffffffff);
		batcher.flush();

		// writes: [0] uniform snapshot, [1] vertex bytes, [2] index bytes
		const vertexWrite = renderer.calls.writes.find((w) => {
			return w.buffer === renderer.vertexArena.page;
		});
		expect(vertexWrite.size).toBe(4 * 36);
		const indexWrite = renderer.calls.writes.find((w) => {
			return w.buffer === renderer.indexArena.page;
		});
		expect(indexWrite.size).toBe(6 * 4);
		const indices = new Uint32Array(
			indexWrite.view.buffer,
			0,
			indexWrite.size >> 2,
		);
		expect(Array.from(indices)).toEqual([0, 1, 2, 0, 2, 3]);
		expect(renderer.calls.drawIndexed).toEqual([6]);
	});

	it("mesh flushes force blend none, carry the mesh axes in the key, and bind all four groups", () => {
		renderer.currentBlendMode = "additive";
		batcher.meshState.cullMode = "back";
		batcher.meshState.frontFace = "cw";
		batcher.addMesh(makeMesh(), 0xffffffff);
		batcher.flush();

		expect(renderer.calls.pipelineKeys).toHaveLength(1);
		expect(renderer.calls.pipelineKeys[0]).toBe(
			`${batcher.shaderKey}|triangle-list|none|true|none|mesh:back:cw`,
		);
		const indices = renderer.calls.bindGroups.map((b) => {
			return b.index;
		});
		expect(indices).toContain(0);
		expect(indices).toContain(1);
		expect(indices).toContain(2);
		expect(indices).toContain(3);
		// group 2 is the shared empty filler on the unlit family
		const lights = renderer.calls.bindGroups.find((b) => {
			return b.index === 2;
		});
		expect(lights.group).toBe(renderer.pipelineCache.emptyBindGroup);
	});

	it("snapshots the per-draw uniforms at their pinned offsets", () => {
		const mesh = makeMesh({
			alphaCutoff: 0.5,
			emissive: new Float32Array([0.25, 0.5, 0.75]),
		});
		// tint = ARGB 0x80(A) 40(R) 80(G) c0(B)
		batcher.addMesh(mesh, 0x804080c0);
		batcher.flush();

		const uniformWrite = renderer.calls.writes.find((w) => {
			return w.buffer === renderer.effectUniformArena.page;
		});
		expect(uniformWrite.size).toBe(MESH_UNIFORM_SIZE);
		const f = uniformWrite.floats;
		// model = identity (accumulated path)
		expect(f[0]).toBe(1);
		expect(f[5]).toBe(1);
		expect(f[10]).toBe(1);
		expect(f[15]).toBe(1);
		// view = renderer.currentTransform (identity in the mock)
		expect(f[16]).toBe(1);
		expect(f[21]).toBe(1);
		// tint rgba floats
		expect(f[32]).toBeCloseTo(0x40 / 255);
		expect(f[33]).toBeCloseTo(0x80 / 255);
		expect(f[34]).toBeCloseTo(0xc0 / 255);
		expect(f[35]).toBeCloseTo(0x80 / 255);
		// params.x = alphaCutoff, emissive rgb
		expect(f[36]).toBe(0.5);
		expect(f[40]).toBe(0.25);
		expect(f[41]).toBe(0.5);
		expect(f[42]).toBe(0.75);

		// the snapshot binds at group 3 with the region's dynamic offset
		const group3 = renderer.calls.bindGroups.find((b) => {
			return b.index === 3;
		});
		expect(group3.dynamicOffsets).toEqual([uniformWrite.offset]);
	});

	it("two draws snapshot two distinct uniform regions (queue-write law)", () => {
		batcher.addMesh(makeMesh(), 0xffffffff);
		batcher.flush();
		batcher.addMesh(makeMesh(), 0xff0000ff);
		batcher.flush();

		const uniformWrites = renderer.calls.writes.filter((w) => {
			return w.buffer === renderer.effectUniformArena.page;
		});
		expect(uniformWrites).toHaveLength(2);
		expect(uniformWrites[0].offset).not.toBe(uniformWrites[1].offset);
		const offsets = renderer.calls.bindGroups
			.filter((b) => {
				return b.index === 3;
			})
			.map((b) => {
				return b.dynamicOffsets[0];
			});
		expect(offsets).toEqual([uniformWrites[0].offset, uniformWrites[1].offset]);
	});

	it("per-vertex colors ride aColor as floats; the tint stays a uniform", () => {
		const mesh = makeMesh({
			// vertex 1 = opaque red, others white
			vertexColors: new Uint32Array([
				0xffffffff, 0xffff0000, 0xffffffff, 0xffffffff,
			]),
		});
		batcher.addMesh(mesh, 0xffffffff);
		batcher.flush();

		const vertexWrite = renderer.calls.writes.find((w) => {
			return w.buffer === renderer.vertexArena.page;
		});
		// vertex 1 starts at float 9; color floats at +5 (r,g,b,a)
		expect(vertexWrite.floats[9 + 5]).toBeCloseTo(1);
		expect(vertexWrite.floats[9 + 6]).toBeCloseTo(0);
		expect(vertexWrite.floats[9 + 7]).toBeCloseTo(0);
		expect(vertexWrite.floats[9 + 8]).toBeCloseTo(1);
	});

	it("the mesh's textureRepeat and mip request reach the texture store", () => {
		batcher.addMesh(makeMesh({ textureRepeat: "repeat" }), 0xffffffff);
		// the mock renderer's default filter is linear → the mesh path
		// asks for the generated mip chain
		expect(renderer.calls.textureBindings[0].options).toEqual({
			repeat: "repeat",
			mipmaps: true,
		});
	});

	it("a nearest-filtered mesh texture opts out of mipmaps", () => {
		batcher.addMesh(
			makeMesh({ texture: { id: "atlas", filter: "nearest" } }),
			0xffffffff,
		);
		expect(renderer.calls.textureBindings[0].options.mipmaps).toBe(false);
	});

	it("an over-capacity mesh chunks across flushes with every index accounted for", () => {
		// a triangle fan of maxVertex+2 vertices: every triangle shares
		// vertex 0, so dedup matters and the fan cannot fit one flush
		const maxVertex = batcher.vertexData.maxVertex;
		const vertCount = maxVertex + 2;
		const vertices = new Float32Array(vertCount * 3);
		const uvs = new Float32Array(vertCount * 2);
		const triCount = vertCount - 2;
		const indices = new Uint32Array(triCount * 3);
		for (let t = 0; t < triCount; t++) {
			indices[t * 3] = 0;
			indices[t * 3 + 1] = t + 1;
			indices[t * 3 + 2] = t + 2;
		}
		batcher.addMesh(
			makeMesh({ vertices, uvs, indices, vertexCount: vertCount }),
			0xffffffff,
		);
		batcher.flush();

		expect(renderer.calls.drawIndexed.length).toBeGreaterThan(1);
		const totalIndices = renderer.calls.drawIndexed.reduce((a, b) => {
			return a + b;
		}, 0);
		expect(totalIndices).toBe(triCount * 3);
	});

	it("reset drops pending staging and cached uniform bind groups", () => {
		batcher.addMesh(makeMesh(), 0xffffffff);
		batcher.reset();
		expect(batcher.indexCount).toBe(0);
		expect(batcher.vertexData.vertexCount).toBe(0);
		expect(batcher.uniformBinding).toBe(null);
		batcher.flush();
		expect(renderer.calls.drawIndexed).toHaveLength(0);
	});
});

describe("WebGPURenderer.drawMesh (real prototype over a stub)", () => {
	function makeStub(batcher) {
		return {
			batchers: new Map([["mesh", batcher]]),
			currentBatcher: batcher,
			setBatcherNames: [],
			setBatcher(name) {
				this.setBatcherNames.push(name);
				return this.batchers.get(name);
			},
			currentTint: new Color(255, 255, 255, 1),
			getGlobalAlpha() {
				return 1;
			},
			customShader: undefined,
			meshDepthActive: false,
			meshEffectWarned: false,
			pendingDepthClear: false,
		};
	}

	it("activates the depth path and maps culling to the pipeline axes", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const stub = makeStub(batcher);

		WebGPURenderer.prototype.drawMesh.call(stub, makeMesh());
		expect(stub.meshDepthActive).toBe(true);
		// accumulated + left-handed: culling on, ccw (the CW flip is
		// retained-path only — accumulated vertices are already bridged)
		expect(batcher.meshState).toEqual({ cullMode: "back", frontFace: "ccw" });
		expect(renderer.calls.drawIndexed).toEqual([6]);

		WebGPURenderer.prototype.drawMesh.call(
			stub,
			makeMesh({ cullBackFaces: false }),
		);
		expect(batcher.meshState.cullMode).toBe("none");
	});

	it("the activation flip arms a depth clear ONCE (the activation-frame pass carries discard ops)", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const stub = makeStub(batcher);

		// first-ever mesh draw: the open pass was begun pre-mesh with
		// depthStoreOp "discard" — a later non-arming pass restart (mask,
		// capture) must clear rather than load the discarded contents
		WebGPURenderer.prototype.drawMesh.call(stub, makeMesh());
		expect(stub.meshDepthActive).toBe(true);
		expect(stub.pendingDepthClear).toBe(true);

		// steady state: no re-arm per draw (that would defeat the
		// depth-persists-across-restarts policy)
		stub.pendingDepthClear = false;
		WebGPURenderer.prototype.drawMesh.call(stub, makeMesh());
		expect(stub.pendingDepthClear).toBe(false);
	});

	it("a customShader warns once, and the mesh still draws (un-effected)", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const stub = makeStub(batcher);
		stub.customShader = { enabled: true };
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		WebGPURenderer.prototype.drawMesh.call(stub, makeMesh());
		WebGPURenderer.prototype.drawMesh.call(stub, makeMesh());
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toMatch(/Mesh/);
		// the meshes drew regardless
		expect(renderer.calls.drawIndexed).toEqual([6, 6]);
		warn.mockRestore();
	});

	it("lit meshes route to the litMesh batcher when registered", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const litBatcher = new WebGPULitMeshBatcher(renderer);
		const stub = makeStub(batcher);
		stub.batchers.set("litMesh", litBatcher);

		WebGPURenderer.prototype.drawMesh.call(stub, makeMesh());
		WebGPURenderer.prototype.drawMesh.call(
			stub,
			makeMesh({
				lit: true,
				normals: new Float32Array(12),
			}),
		);
		expect(stub.setBatcherNames).toEqual(["mesh", "litMesh"]);
		// per-mesh axes land on the batcher that draws, and the two
		// batchers hold INDEPENDENT state objects
		expect(litBatcher.meshState).not.toBe(batcher.meshState);
	});

	it("an active stencil mask threads through the mesh flush key", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		renderer.stencilMode = "test";
		batcher.addMesh(makeMesh(), 0xffffffff);
		batcher.flush();
		expect(renderer.calls.pipelineKeys[0]).toContain("|test|mesh:");
	});

	it("index-capacity-limited meshes chunk too (few vertices, many triangles)", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		// 4 vertices shared by more triangles than the index staging holds
		const triCount = Math.floor(batcher.indexData.length / 3) + 50;
		const indices = new Uint32Array(triCount * 3);
		for (let t = 0; t < triCount; t++) {
			indices[t * 3] = 0;
			indices[t * 3 + 1] = 1 + (t % 2);
			indices[t * 3 + 2] = 2 + (t % 2);
		}
		batcher.addMesh(makeMesh({ indices }), 0xffffffff);
		batcher.flush();

		expect(renderer.calls.drawIndexed.length).toBeGreaterThan(1);
		const total = renderer.calls.drawIndexed.reduce((a, b) => {
			return a + b;
		}, 0);
		expect(total).toBe(triCount * 3);
	});
});

/**
 * Ground shadows on the instanced tier (#1515) — WebGPU only.
 *
 * The shadow module reads nothing but the three transform rows, so ONE module
 * serves every record shape. The vertex LAYOUT does not: the instance buffer's
 * `arrayStride` is baked into it, and that is 48 / 64 / 80 bytes depending on
 * which optional slots the records carry. Nothing about a wrong stride is
 * visible from a draw count — the blobs simply land at garbage positions.
 */
describe("instanced ground-shadow families (#1515)", () => {
	const layoutFor = (hasColor, hasData) => {
		return instanceRecordLayout(hasColor, hasData);
	};

	it("mints a distinct family per instance-record shape", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const plain = batcher.instancedShadowFamily(layoutFor(false, false));
		const coloured = batcher.instancedShadowFamily(layoutFor(true, false));
		const both = batcher.instancedShadowFamily(layoutFor(true, true));
		// a single cached family would hand the second scatter the first
		// one's stride
		expect(new Set([plain, coloured, both]).size).toBe(3);
	});

	it("reuses the family for a repeat of the same shape", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const a = batcher.instancedShadowFamily(layoutFor(true, false));
		const b = batcher.instancedShadowFamily(layoutFor(true, false));
		expect(a).toBe(b);
	});

	it("each family's instance buffer carries ITS OWN stride", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const seen = new Map();
		const spy = vi
			.spyOn(renderer.pipelineCache, "registerVertexLayout")
			.mockImplementation((key, buffers) => {
				seen.set(key, buffers[1].stride);
			});
		for (const [c, d] of [
			[false, false],
			[true, false],
			[true, true],
		]) {
			const layout = layoutFor(c, d);
			batcher.instancedShadowFamily(layout);
			// whichever key this shape registered under must carry its stride
			expect([...seen.values()]).toContain(layout.stride);
		}
		// three shapes, three strides, three layout keys
		expect(seen.size).toBe(3);
		expect(new Set(seen.values()).size).toBe(3);
		spy.mockRestore();
	});
});
