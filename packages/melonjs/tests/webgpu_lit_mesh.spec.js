import "./helpers/webgpu-globals.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// initialize the module graph through the package index BEFORE any deep
// import — a bare deep import of state.ts hits the camera module cycle
import { state } from "../src/index.js";
import {
	BLOCK3D_BYTES,
	BLOCK3D_FLOATS,
	writeLight3dBlock,
} from "../src/video/webgl/lighting/std140.ts";
import WebGPULitMeshBatcher from "../src/video/webgpu/batchers/lit_mesh_batcher.js";
import WebGPUMeshBatcher from "../src/video/webgpu/batchers/mesh_batcher.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * The lit mesh tier on WebGPU — Light3d packing into the std140 block
 * (byte-equal with the shared writer), the fresh-region-per-change
 * snapshot rule, the white-ambient fallback, and the 48-byte lit vertex
 * layout with its degenerate-normal substitution.
 */
function makeLitMesh(overrides = {}) {
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
		...overrides,
	};
}

function makeSun(overrides = {}) {
	return {
		type: "directional",
		direction: { x: 0, y: 0, z: 1 },
		color: { r: 255, g: 128, b: 0 },
		intensity: 1,
		...overrides,
	};
}

describe("WebGPULitMeshBatcher (mock device)", () => {
	let renderer;
	let batcher;
	let currentSpy;

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPULitMeshBatcher(renderer);
		currentSpy = vi.spyOn(state, "current").mockReturnValue({
			_activeLights3d: new Set(),
		});
	});

	afterEach(() => {
		currentSpy.mockRestore();
	});

	function setLights(...lights) {
		currentSpy.mockReturnValue({ _activeLights3d: new Set(lights) });
	}

	function lightWrites() {
		return renderer.calls.writes.filter((w) => {
			return (
				w.buffer === renderer.effectUniformArena.page &&
				w.size === BLOCK3D_BYTES
			);
		});
	}

	it("freezes the 48-byte lit layout (base + aNormal) under its own key", () => {
		expect(batcher.stride).toBe(48);
		expect(batcher.vertexSize).toBe(12);
		expect(batcher.attributes.at(-1)).toMatchObject({
			name: "aNormal",
			format: "float32x3",
			offset: 36,
		});
		// distinct family from the unlit batcher, same group-3 layout
		const unlit = new WebGPUMeshBatcher(renderer);
		expect(batcher.shaderKey).not.toBe(unlit.shaderKey);
		expect(batcher.meshLayout).toBe(unlit.meshLayout);
	});

	it("the snapshot bytes are byte-equal with writeLight3dBlock's output", () => {
		const sun = makeSun();
		setLights(sun);
		batcher.addMesh(makeLitMesh(), 0xffffffff);
		batcher.flush();

		const expected = new Float32Array(BLOCK3D_FLOATS);
		writeLight3dBlock(expected, {
			count: 1,
			// directional: range sentinel -1, position unused
			posRange: new Float32Array([0, 0, 0, -1]),
			// surface→light: negated travel direction, normalized (the
			// negation makes the zero components NEGATIVE zero — byte-equal
			// means matching those bits too), no cone
			dirCone: new Float32Array([-0, -0, -1, -1]),
			colorInner: new Float32Array([1, 128 / 255, 0, 0]),
			ambient: [0, 0, 0],
		});
		const write = lightWrites().at(-1);
		expect(Array.from(write.floats)).toEqual(Array.from(expected));

		// and the block binds at group 2 with the region's dynamic offset
		const group2 = renderer.calls.bindGroups.find((b) => {
			return b.index === 2;
		});
		expect(group2.dynamicOffsets).toEqual([write.offset]);
	});

	it("no 3D lights at all → fullbright white ambient (unlit parity)", () => {
		batcher.addMesh(makeLitMesh(), 0xffffffff);
		batcher.flush();
		const f = lightWrites().at(-1).floats;
		expect(f[0]).toBe(0); // count
		expect([f[4], f[5], f[6]]).toEqual([1, 1, 1]); // white ambient
	});

	it("an ambient-only scene keeps its real ambient (no white override)", () => {
		setLights({
			type: "ambient",
			color: { r: 255, g: 0, b: 0 },
			intensity: 0.5,
			direction: { x: 0, y: 0, z: 0 },
		});
		batcher.addMesh(makeLitMesh(), 0xffffffff);
		batcher.flush();
		const f = lightWrites().at(-1).floats;
		expect(f[4]).toBeCloseTo(0.5);
		expect(f[5]).toBe(0);
		expect(f[6]).toBe(0);
	});

	it("a static rig re-uses the frame's snapshot; a light change lands in a fresh region", () => {
		const sun = makeSun();
		setLights(sun);
		const mesh = makeLitMesh();
		batcher.addMesh(mesh, 0xffffffff);
		batcher.flush();
		expect(lightWrites()).toHaveLength(1);

		// same frame, unchanged lights: zero new uploads
		batcher.addMesh(mesh, 0xffffffff);
		batcher.flush();
		expect(lightWrites()).toHaveLength(1);

		// same frame, mutated light: fresh region, distinct offset (the
		// queue-write law — recorded draws keep their own bytes)
		sun.intensity = 0.25;
		batcher.addMesh(mesh, 0xffffffff);
		batcher.flush();
		const writes = lightWrites();
		expect(writes).toHaveLength(2);
		expect(writes[1].offset).not.toBe(writes[0].offset);
	});

	it("a new frame re-snapshots even an unchanged rig (the arena was reset)", () => {
		setLights(makeSun());
		const mesh = makeLitMesh();
		batcher.addMesh(mesh, 0xffffffff);
		batcher.flush();
		renderer.frameId++;
		batcher.addMesh(mesh, 0xffffffff);
		batcher.flush();
		expect(lightWrites()).toHaveLength(2);
	});

	it("accumulated vertices carry world-space normals; the tint stays a uniform", () => {
		batcher.addMesh(makeLitMesh(), 0xffffffff);
		batcher.flush();
		const vertexWrite = renderer.calls.writes.find((w) => {
			return w.buffer === renderer.vertexArena.page;
		});
		expect(vertexWrite.size).toBe(3 * 48);
		// vertex 0 normal at floats 9..11
		expect(vertexWrite.floats[9]).toBe(0);
		expect(vertexWrite.floats[10]).toBe(0);
		expect(vertexWrite.floats[11]).toBe(1);
	});

	it("retained lit geometry substitutes a unit vector for degenerate normals", () => {
		const mesh = makeLitMesh({
			originalNormals: new Float32Array([0, 0, 1, 0, 0, 0, 0, 0, 1]),
		});
		const model = { val: new Float32Array(16) };
		model.val[0] = model.val[5] = model.val[10] = model.val[15] = 1;
		batcher.drawRetainedMesh(mesh, model, 0xffffffff);

		const vertexWrite = renderer.calls.writes.find((w) => {
			return w.buffer.label === "melonJS retained mesh vertices";
		});
		// vertex 1 (floats 12..23): degenerate → (0, 1, 0)
		expect(vertexWrite.floats[12 + 9]).toBe(0);
		expect(vertexWrite.floats[12 + 10]).toBe(1);
		expect(vertexWrite.floats[12 + 11]).toBe(0);
	});

	it("reset drops the light snapshot alongside the base state", () => {
		setLights(makeSun());
		batcher.addMesh(makeLitMesh(), 0xffffffff);
		batcher.flush();
		batcher.reset();
		expect(batcher.lightBinding).toBe(null);
		expect(batcher.lightBindGroups.size).toBe(0);
	});

	it("a re-init against the surviving cache keeps the lights layout and re-arms the snapshot state", () => {
		setLights(makeSun());
		batcher.addMesh(makeLitMesh(), 0xffffffff);
		batcher.flush();
		const layout = batcher.lightsLayout;
		const key = batcher.shaderKey;

		// the reset-with-valid-device window: same device, same cache —
		// the module short-circuit must not orphan a fresh layout, and
		// the arena-scoped snapshot state must not survive
		batcher.init(renderer);
		expect(batcher.shaderKey).toBe(key);
		expect(batcher.lightsLayout).toBe(layout);
		expect(batcher.lightBinding).toBe(null);
		expect(batcher.lightBindGroups.size).toBe(0);

		// and the batcher still functions end to end after the re-init
		batcher.addMesh(makeLitMesh(), 0xffffffff);
		batcher.flush();
		expect(renderer.calls.drawIndexed.at(-1)).toBe(3);
	});

	it("a device change rebuilds the lights layout on the new device", () => {
		const layout = batcher.lightsLayout;
		const fresh = createMockWebGPURenderer();
		batcher.init(fresh);
		expect(batcher.lightsLayout).not.toBe(layout);
		// a second lit instance against the SAME cache also gets its own
		// live layout despite the module short-circuit
		const sibling = new WebGPULitMeshBatcher(fresh);
		expect(sibling.lightsLayout).toBeDefined();
		expect(sibling.shaderKey).toBe(batcher.shaderKey);
	});
});
