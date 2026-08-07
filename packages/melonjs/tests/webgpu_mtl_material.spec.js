import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import WebGPUMeshBatcher, {
	MESH_UNIFORM_SIZE,
} from "../src/video/webgpu/batchers/mesh_batcher.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * MTL specular and alpha maps on WebGPU (#1575).
 *
 * Two things this backend does that the GL one does not: the material
 * scalars ride a packed uniform block, so an offset that drifts silently
 * shades the wrong thing; and the opacity map needs a SECOND texture in
 * group 1, which is the first time the mesh family's bind group differs
 * from the shared 2D one.
 */
const DIFFUSE = { id: "diffuse" };
const MASK_A = { id: "mask-a" };
const MASK_B = { id: "mask-b" };

function makeMesh(overrides = {}) {
	return {
		originalVertices: new Float32Array([
			-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
		]),
		vertices: new Float32Array([
			-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
		]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		_indicesOriginal: new Uint16Array([0, 1, 2, 0, 2, 3]),
		_geometryVersion: 0,
		vertexCount: 4,
		texture: DIFFUSE,
		textureRepeat: undefined,
		vertexColors: undefined,
		alphaCutoff: 0,
		emissive: undefined,
		specular: undefined,
		shininess: 0,
		alphaMap: undefined,
		lit: false,
		cullBackFaces: true,
		rightHanded: false,
		textureGroups: undefined,
		...overrides,
	};
}

const MODEL = (() => {
	const val = new Float32Array(16);
	val[0] = val[5] = val[10] = val[15] = 1;
	return { val };
})();

describe("WebGPU MTL specular and alpha maps (#1575)", () => {
	let renderer;
	let batcher;

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPUMeshBatcher(renderer);
	});

	// the one uniform snapshot a single draw writes
	const snapshot = () => {
		const write = renderer.calls.writes.find((w) => {
			return w.size === MESH_UNIFORM_SIZE;
		});
		expect(write).toBeDefined();
		return write.floats;
	};

	describe("the uniform block", () => {
		it("grew to 208 bytes: specular at float 44, eye at 48", () => {
			expect(MESH_UNIFORM_SIZE).toBe(208);
			const mesh = makeMesh({
				specular: new Float32Array([0.25, 0.5, 0.75]),
				shininess: 64,
			});
			batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
			const floats = snapshot();
			// model 0-15, view 16-31, tint 32-35, params 36-39, emissive 40-43
			expect(Array.from(floats.slice(44, 48))).toEqual([0.25, 0.5, 0.75, 64]);
		});

		it("ADVERSARIAL: specular does not overlap emissive", () => {
			// one float of drift and a mesh's glow becomes its highlight
			const mesh = makeMesh({
				emissive: new Float32Array([1, 0, 0]),
				specular: new Float32Array([0, 0, 1]),
				shininess: 8,
			});
			batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
			const floats = snapshot();
			expect(Array.from(floats.slice(40, 44))).toEqual([1, 0, 0, 0]);
			expect(Array.from(floats.slice(44, 48))).toEqual([0, 0, 1, 8]);
		});

		it("ADVERSARIAL: a Ks with shininess 0 writes ZERO specular", () => {
			// the gate lives on the CPU as well as in the shader — writing the
			// colour and relying on the exponent alone would light a highlight
			// for any custom shader reading the block directly
			const mesh = makeMesh({
				specular: new Float32Array([1, 1, 1]),
				shininess: 0,
			});
			batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
			expect(Array.from(snapshot().slice(44, 48))).toEqual([0, 0, 0, 0]);
		});

		it("carries the alpha-map flag in params.y, beside the cutout", () => {
			batcher.drawRetainedMesh(
				makeMesh({ alphaCutoff: 0.5, alphaMap: MASK_A }),
				MODEL,
				0xffffffff,
			);
			const floats = snapshot();
			expect(floats[36]).toBe(0.5);
			expect(floats[37]).toBe(1);

			renderer = createMockWebGPURenderer();
			batcher = new WebGPUMeshBatcher(renderer);
			batcher.drawRetainedMesh(
				makeMesh({ alphaCutoff: 0.5 }),
				MODEL,
				0xffffffff,
			);
			expect(snapshot()[37]).toBe(0);
		});

		it("writes the camera position as the view's inverse translation", () => {
			// a rigid view's inverse translation is -Rᵀ·t; with an identity
			// basis that is simply the negated translation
			const view = renderer.currentTransform.val;
			view[12] = 10;
			view[13] = -20;
			view[14] = 30;
			batcher.drawRetainedMesh(
				makeMesh({ specular: new Float32Array([1, 1, 1]), shininess: 4 }),
				MODEL,
				0xffffffff,
			);
			expect(Array.from(snapshot().slice(48, 51))).toEqual([-10, 20, -30]);
		});
	});

	describe("the group-1 material", () => {
		it("binds the alpha map as the second texture pair", () => {
			batcher.drawRetainedMesh(
				makeMesh({ alphaMap: MASK_A }),
				MODEL,
				0xffffffff,
			);
			const bound = renderer.calls.textureBindings.at(-1);
			expect(bound.texture).toBe(DIFFUSE);
			expect(bound.alphaTexture).toBe(MASK_A);
		});

		it("passes the diffuse texture as filler when there is no map", () => {
			// reusing a resident texture costs no extra unit and no upload; the
			// shader weights the sample away via params.y
			batcher.drawRetainedMesh(makeMesh(), MODEL, 0xffffffff);
			const bound = renderer.calls.textureBindings.at(-1);
			expect(bound.texture).toBe(DIFFUSE);
			expect(bound.alphaTexture).toBe(DIFFUSE);
		});

		it("ADVERSARIAL: one diffuse with two different masks gets two bind groups", () => {
			// the trap the mesh bind-group cache is keyed against: caching on
			// the diffuse record alone would hand the second mesh the first
			// mesh's cut-outs
			batcher.drawRetainedMesh(
				makeMesh({ alphaMap: MASK_A }),
				MODEL,
				0xffffffff,
			);
			const first = renderer.calls.materialBinds.at(-1);
			batcher.drawRetainedMesh(
				makeMesh({ alphaMap: MASK_B }),
				MODEL,
				0xffffffff,
			);
			const second = renderer.calls.materialBinds.at(-1);
			expect(first).not.toBe(second);
		});

		it("ADVERSARIAL: the same pair re-uses one bind group", () => {
			// the converse — a fresh bind group per draw would defeat the cache
			// and churn a GPU object every frame
			const mesh = makeMesh({ alphaMap: MASK_A });
			batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
			const first = renderer.calls.materialBinds.at(-1);
			renderer.frameId++;
			batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
			expect(renderer.calls.materialBinds.at(-1)).toBe(first);
		});

		it("registers the mesh family against the four-binding layout", () => {
			// group 1 is the mesh layout, not the shared 2D material layout —
			// the pipeline would fail validation against the wrong one
			expect(batcher.bindGroupLayoutList(renderer.pipelineCache)[1]).toBe(
				renderer.pipelineCache.meshMaterialLayout,
			);
		});
	});
});
