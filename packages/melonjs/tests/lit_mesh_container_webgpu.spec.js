import "./helpers/webgpu-globals.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// initialize the module graph through the package index BEFORE any deep
// import — a bare deep import of state.ts hits the camera module cycle
import { Matrix3d, state } from "../src/index.js";
import { BLOCK3D_BYTES } from "../src/video/webgl/lighting/std140.ts";
import WebGPULitMeshBatcher from "../src/video/webgpu/batchers/lit_mesh_batcher.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * The WebGPU half of `lit_mesh_container.spec.js`: a lit mesh in a moved or
 * turned container must be lit in its own frame there too. Both backends
 * pack their lights with the same `packMeshLights`, and this pins that the
 * WebGPU lit batcher hands it the renderer's light space as the WebGL one
 * does, so the two cannot drift apart. Mock device: no pixels here, the
 * uploaded light block is read back instead.
 */
const lamp = () => {
	return {
		type: "point",
		position: { x: 10, y: 20, z: 30 },
		direction: { x: 0, y: 0, z: 0 },
		color: { r: 255, g: 255, b: 255 },
		intensity: 1,
		range: 100,
	};
};

const litMesh = () => {
	return {
		vertices: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]),
		originalVertices: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]),
		normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
		originalNormals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1]),
		indices: new Uint16Array([0, 1, 2]),
		_indicesOriginal: new Uint16Array([0, 1, 2]),
		_geometryVersion: 0,
		vertexCount: 3,
		texture: { id: "atlas" },
		textureRepeat: undefined,
		vertexColors: undefined,
		alphaCutoff: 0,
		emissive: undefined,
		lit: true,
		cullBackFaces: true,
		rightHanded: false,
	};
};

describe("WebGPU lit mesh lights follow the mesh's frame", () => {
	let renderer;
	let batcher;
	let currentSpy;

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPULitMeshBatcher(renderer);
		currentSpy = vi.spyOn(state, "current").mockReturnValue({
			_activeLights3d: new Set([lamp()]),
		});
	});

	afterEach(() => {
		currentSpy.mockRestore();
	});

	const lastBlock = () => {
		const writes = renderer.calls.writes.filter((w) => {
			return (
				w.buffer === renderer.effectUniformArena.page &&
				w.size === BLOCK3D_BYTES
			);
		});
		return writes.at(-1).floats;
	};

	// the first light's position sits right after the 8-float header
	const lampPosition = (f) => {
		return [f[8], f[9], f[10]];
	};

	it("carries the lights into the frame the renderer reports", () => {
		const space = new Matrix3d();
		space.translate(-1000, 0, 0);
		renderer._lightSpaceInverse = () => {
			return space;
		};
		batcher.addMesh(litMesh(), 0xffffffff);
		batcher.flush();
		expect(lampPosition(lastBlock())).toEqual([-990, 20, 30]);
	});

	it("leaves them as authored when the renderer reports none", () => {
		renderer._lightSpaceInverse = () => {
			return null;
		};
		batcher.addMesh(litMesh(), 0xffffffff);
		batcher.flush();
		expect(lampPosition(lastBlock())).toEqual([10, 20, 30]);
	});

	it("and on a renderer that has no light space at all", () => {
		delete renderer._lightSpaceInverse;
		batcher.addMesh(litMesh(), 0xffffffff);
		batcher.flush();
		expect(lampPosition(lastBlock())).toEqual([10, 20, 30]);
	});
});
