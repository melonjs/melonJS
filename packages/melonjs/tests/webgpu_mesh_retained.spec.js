import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import { WebGPURenderer } from "../src/index.js";
import WebGPUMeshBatcher from "../src/video/webgpu/batchers/mesh_batcher.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * The retained mesh path on WebGPU — the GL retained-geometry contract
 * (upload once, placement by uniforms, `needsUpdate` invalidation) plus
 * the queue-law hardening this backend demands: a version bump on a mesh
 * that already drew this frame lands in FRESH buffers with the old pair
 * retired, never an in-place write.
 */
function makeRetainedMesh(overrides = {}) {
	return {
		originalVertices: new Float32Array([
			-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
		]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		_indicesOriginal: new Uint16Array([0, 1, 2, 0, 2, 3]),
		_geometryVersion: 0,
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

const MODEL = (() => {
	// stand-in model matrix: identity with a translation — only .val is read
	const val = new Float32Array(16);
	val[0] = val[5] = val[10] = val[15] = 1;
	val[12] = 32;
	val[13] = 16;
	return { val };
})();

describe("WebGPU retained mesh geometry (mock device)", () => {
	let renderer;
	let batcher;

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPUMeshBatcher(renderer);
	});

	function geometryWrites() {
		return renderer.calls.writes.filter((w) => {
			return (
				w.buffer.label === "melonJS retained mesh vertices" ||
				w.buffer.label === "melonJS retained mesh indices"
			);
		});
	}

	it("uploads once and redraws from resident buffers (zero re-upload)", () => {
		const mesh = makeRetainedMesh();
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
		expect(geometryWrites()).toHaveLength(2);
		expect(renderer.calls.drawIndexed).toEqual([6]);

		renderer.frameId++;
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
		batcher.drawRetainedMesh(mesh, MODEL, 0xff00ff00);
		// still just the original two geometry writes — placement and tint
		// changes ride the uniform snapshot alone
		expect(geometryWrites()).toHaveLength(2);
		expect(renderer.calls.drawIndexed).toEqual([6, 6, 6]);
	});

	it("binds the retained buffers, not the arenas, and stamps the draw frame", () => {
		const mesh = makeRetainedMesh();
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);

		const geometry = batcher.retained.get(mesh);
		expect(geometry).toBeDefined();
		const vBind = renderer.calls.vertexBufferBinds.at(-1);
		expect(vBind.buffer).toBe(geometry.vertexBuffer);
		const iBind = renderer.calls.indexBufferBinds.at(-1);
		expect(iBind.buffer).toBe(geometry.indexBuffer);
		expect(iBind.format).toBe("uint16");
		expect(geometry.lastDrawnFrameId).toBe(renderer.frameId);
	});

	it("the model matrix lands in the uniform snapshot (placement is uniforms, not geometry)", () => {
		batcher.drawRetainedMesh(makeRetainedMesh(), MODEL, 0xffffffff);
		const uniformWrite = renderer.calls.writes.find((w) => {
			return w.buffer === renderer.effectUniformArena.page;
		});
		expect(uniformWrite.floats[12]).toBe(32);
		expect(uniformWrite.floats[13]).toBe(16);
	});

	it("a geometry version bump re-uploads exactly once", () => {
		const mesh = makeRetainedMesh();
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
		expect(geometryWrites()).toHaveLength(2);

		renderer.frameId++;
		mesh._geometryVersion++;
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
		expect(geometryWrites()).toHaveLength(4);

		renderer.frameId++;
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
		expect(geometryWrites()).toHaveLength(4);
	});

	it("a cross-frame version bump re-uses the buffers in place (no retire)", () => {
		const mesh = makeRetainedMesh();
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
		const geometry = batcher.retained.get(mesh);
		const vertexBuffer = geometry.vertexBuffer;

		renderer.frameId++;
		mesh._geometryVersion++;
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
		expect(geometry.vertexBuffer).toBe(vertexBuffer);
		expect(renderer.calls.retiredBuffers).toHaveLength(0);
	});

	it("a SAME-frame version bump after a draw goes to fresh buffers and retires the old pair (queue law)", () => {
		const mesh = makeRetainedMesh();
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
		const geometry = batcher.retained.get(mesh);
		const oldVertexBuffer = geometry.vertexBuffer;
		const oldIndexBuffer = geometry.indexBuffer;

		// same frame (Sprite3d UV animation, a second camera draw)
		mesh._geometryVersion++;
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
		expect(geometry.vertexBuffer).not.toBe(oldVertexBuffer);
		expect(renderer.calls.retiredBuffers).toEqual([
			oldVertexBuffer,
			oldIndexBuffer,
		]);
	});

	it("uint32 indices keep their format; odd uint16 counts pad the write to 4 bytes", () => {
		const wide = makeRetainedMesh({
			_indicesOriginal: new Uint32Array([0, 1, 2, 0, 2, 3]),
		});
		batcher.drawRetainedMesh(wide, MODEL, 0xffffffff);
		expect(renderer.calls.indexBufferBinds.at(-1).format).toBe("uint32");

		// one triangle = 3 uint16 = 6 bytes → padded to 8
		const odd = makeRetainedMesh({
			_indicesOriginal: new Uint16Array([0, 1, 2]),
		});
		batcher.drawRetainedMesh(odd, MODEL, 0xffffffff);
		const indexWrite = renderer.calls.writes.find((w) => {
			return w.buffer.label === "melonJS retained mesh indices" && w.size === 8;
		});
		expect(indexWrite).toBeDefined();
		expect(renderer.calls.drawIndexed.at(-1)).toBe(3);
	});

	it("deleteMeshGeometry releases through every batcher and forgets the mesh", () => {
		const mesh = makeRetainedMesh();
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);
		const geometry = batcher.retained.get(mesh);
		const buffers = [geometry.vertexBuffer, geometry.indexBuffer];

		// `deleteMeshGeometry` also purges the transparent queue, so the stub
		// needs that method — the real one lives on the base `Renderer`
		const stub = {
			batchers: new Map([["mesh", batcher]]),
			removeQueuedTransparent: () => {},
		};
		WebGPURenderer.prototype.deleteMeshGeometry.call(stub, mesh);
		expect(batcher.retained.has(mesh)).toBe(false);
		expect(renderer.calls.retiredBuffers).toEqual(buffers);
	});

	it("a device-loss re-init drops every retained geometry", () => {
		batcher.drawRetainedMesh(makeRetainedMesh(), MODEL, 0xffffffff);
		batcher.drawRetainedMesh(makeRetainedMesh(), MODEL, 0xffffffff);
		expect(batcher.retained.size).toBe(2);
		batcher.init(renderer);
		expect(batcher.retained.size).toBe(0);
	});

	it("an accumulated draw right after a retained one flows through the arenas untouched", () => {
		const mesh = makeRetainedMesh();
		batcher.drawRetainedMesh(mesh, MODEL, 0xffffffff);

		batcher.addMesh(
			{
				...makeRetainedMesh(),
				vertices: makeRetainedMesh().originalVertices,
				indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
			},
			0xffffffff,
		);
		batcher.flush();
		const vBind = renderer.calls.vertexBufferBinds.at(-1);
		expect(vBind.buffer).toBe(renderer.vertexArena.page);
		const iBind = renderer.calls.indexBufferBinds.at(-1);
		expect(iBind.buffer).toBe(renderer.indexArena.page);
		expect(renderer.calls.drawIndexed).toEqual([6, 6]);
	});
});
