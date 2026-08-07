import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import WebGPUMeshBatcher from "../src/video/webgpu/batchers/mesh_batcher.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * Per-material diffuse textures on WebGPU (#1573) — the same contract the
 * GL backend holds, expressed in this backend's vocabulary: one
 * `drawIndexed` per range with a `firstIndex`, and the group-1 material
 * binding moving between them.
 *
 * The mesh stand-ins carry `textureGroups` exactly as `Mesh` builds it, so
 * what is under test is the batcher's half of the split and nothing else.
 */
const WOOD = { id: "wood" };
const METAL = { id: "metal" };

function makeMesh(overrides = {}) {
	return {
		originalVertices: new Float32Array([
			-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
		]),
		// the accumulated path reads the CPU-projected pair, the retained one
		// the model-space original — a real Mesh carries both
		vertices: new Float32Array([
			-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
		]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		_indicesOriginal: new Uint16Array([0, 1, 2, 0, 2, 3]),
		_geometryVersion: 0,
		vertexCount: 4,
		texture: WOOD,
		textureRepeat: undefined,
		vertexColors: undefined,
		alphaCutoff: 0,
		emissive: undefined,
		lit: false,
		cullBackFaces: true,
		rightHanded: false,
		textureGroups: undefined,
		...overrides,
	};
}

// two ranges over the quad: the first triangle in wood, the second in metal
const SPLIT = [
	{ texture: WOOD, start: 0, count: 3 },
	{ texture: METAL, start: 3, count: 3 },
];

const MODEL = (() => {
	const val = new Float32Array(16);
	val[0] = val[5] = val[10] = val[15] = 1;
	return { val };
})();

describe("WebGPU per-material textures (#1573)", () => {
	let renderer;
	let batcher;

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPUMeshBatcher(renderer);
	});

	describe("the retained draw", () => {
		it("records one indexed range per texture group", () => {
			const mesh = makeMesh({ textureGroups: SPLIT });
			batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);

			expect(renderer.calls.drawIndexedArgs).toEqual([
				{ count: 3, instanceCount: 1, firstIndex: 0 },
				{ count: 3, instanceCount: 1, firstIndex: 3 },
			]);
		});

		it("REGRESSION: an unsplit mesh still records exactly ONE whole-mesh draw", () => {
			batcher.drawRetainedMesh(makeMesh(), MODEL, 0xffffffff);
			expect(renderer.calls.drawIndexed).toEqual([6]);
			// the unsplit path keeps its argument shape too — a `firstIndex` of
			// `undefined` is the whole buffer, same call it always made
			expect(renderer.calls.drawIndexedArgs).toEqual([
				{ count: 6, instanceCount: undefined, firstIndex: undefined },
			]);
		});

		it("re-binds group 1 for each range, with distinct bindings", () => {
			const mesh = makeMesh({ textureGroups: SPLIT });
			batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);

			const binds = renderer.calls.materialBinds;
			expect(binds).toHaveLength(2);
			expect(binds[0]).not.toBe(binds[1]);
			// each range asked the texture store for its OWN texture
			const requested = renderer.calls.textureBindings.map((b) => {
				return b.texture;
			});
			expect(requested).toContain(WOOD);
			expect(requested).toContain(METAL);
		});

		it("uploads the geometry ONCE for a split mesh — the ranges share buffers", () => {
			const mesh = makeMesh({ textureGroups: SPLIT });
			batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);

			const geometry = renderer.calls.writes.filter((w) => {
				return (
					w.buffer.label === "melonJS retained mesh vertices" ||
					w.buffer.label === "melonJS retained mesh indices"
				);
			});
			expect(geometry).toHaveLength(2);
			// one vertex buffer, one index buffer — bound once, drawn twice
			expect(renderer.calls.vertexBufferBinds).toHaveLength(1);
			expect(renderer.calls.indexBufferBinds).toHaveLength(1);
		});

		it("keeps the placement uniforms to ONE snapshot across the ranges", () => {
			const mesh = makeMesh({ textureGroups: SPLIT });
			batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
			// the split is a material change, not a placement change: re-arming
			// the uniform arena per range would burn a region per material
			const uniformWrites = renderer.calls.writes.filter((w) => {
				return w.buffer.label === undefined || /uniform/i.test(w.buffer.label);
			});
			expect(uniformWrites.length).toBeLessThanOrEqual(1);
		});
	});

	describe("the accumulated draw", () => {
		it("flushes between ranges so each records under its own binding", () => {
			const mesh = makeMesh({ textureGroups: SPLIT });
			batcher.addMesh(mesh, 0xffffffff);
			batcher.flush();

			// two recorded draws, three vertices each — one per range
			expect(renderer.calls.drawIndexed).toEqual([3, 3]);
			expect(renderer.calls.materialBinds).toHaveLength(2);
			expect(renderer.calls.materialBinds[0]).not.toBe(
				renderer.calls.materialBinds[1],
			);
		});

		it("REGRESSION: an unsplit mesh accumulates into ONE draw", () => {
			batcher.addMesh(makeMesh(), 0xffffffff);
			batcher.flush();
			expect(renderer.calls.drawIndexed).toEqual([6]);
		});

		it("ADVERSARIAL: a range's vertices are not leaked into the next one", () => {
			// the versioned remap is reset per chunk; a range that reused the
			// previous range's remap would emit indices pointing at vertices
			// that were already flushed away
			const mesh = makeMesh({ textureGroups: SPLIT });
			batcher.addMesh(mesh, 0xffffffff);
			batcher.flush();
			// 3 vertices per range (no sharing across the split), so each
			// flushed draw indexes only what it pushed
			expect(renderer.calls.drawIndexed).toEqual([3, 3]);
		});
	});
});
