import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Matrix3d } from "../src/index.js";
import WebGPUMeshBatcher, {
	MESH_UNIFORM_SIZE,
} from "../src/video/webgpu/batchers/mesh_batcher.js";
import meshWGSL from "../src/video/webgpu/shaders/mesh.wgsl";
import {
	buildInstancedMeshWGSL,
	LIT_INSTANCED,
	UNLIT_INSTANCED,
} from "../src/video/webgpu/shaders/mesh-instanced.js";
import meshLitWGSL from "../src/video/webgpu/shaders/mesh-lit.wgsl";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * Distance fog on the WebGPU backend (#1622).
 *
 * WebGPU carries fog in the per-draw `MeshUniforms` snapshot rather than as
 * loose uniforms, so what is testable here is the byte layout: fog has to land
 * at the floats the WGSL struct declares, and it has to be ZERO when no fog is
 * installed — zero is mode 0, which is what makes a scene without fog identical
 * to one built before fog existed.
 */
const MODEL = new Matrix3d();

function makeMesh(overrides = {}) {
	const quad = new Float32Array([
		-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
	]);
	return {
		// the retained path reads model-space geometry, not the projected copy
		originalVertices: quad,
		vertices: quad,
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		_indicesOriginal: new Uint16Array([0, 1, 2, 0, 2, 3]),
		_geometryVersion: 0,
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		vertexCount: 4,
		texture: { id: "atlas" },
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

describe("WebGPU mesh distance fog (#1622)", () => {
	let renderer;
	let batcher;

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPUMeshBatcher(renderer);
	});

	const snapshot = () => {
		const write = renderer.calls.writes.find((w) => {
			return w.size === MESH_UNIFORM_SIZE;
		});
		expect(write).toBeDefined();
		return write.floats;
	};

	// the mock renderer is a stub without the base `Renderer` methods, so the
	// field the batcher reads is set directly — `setFog` only assigns it
	const install = (state) => {
		renderer._fog3d = state;
	};

	const fog = (over) => {
		return {
			mode: 1,
			near: 12,
			invRange: 0.25,
			density: 0,
			color: new Float32Array([0.25, 0.5, 0.75]),
			...over,
		};
	};

	describe("the uniform block", () => {
		it("grew to 240 bytes, and the layout key moved with it", () => {
			// 176 before #1575, 208 before fog
			expect(MESH_UNIFORM_SIZE).toBe(240);
			expect(renderer.pipelineCache.effectLayouts.has("mesh:u240")).toBe(true);
		});

		it("writes the fog colour at 52-54 and the params at 56-59", () => {
			install(fog());
			batcher.drawRetainedMesh(makeMesh(), MODEL, 0xffffffff);
			const floats = snapshot();
			// model 0-15, view 16-31, tint 32-35, params 36-39, emissive 40-43,
			// specular 44-47, eye 48-51
			expect(Array.from(floats.slice(52, 55))).toEqual([0.25, 0.5, 0.75]);
			expect(Array.from(floats.slice(56, 60))).toEqual([1, 12, 0.25, 0]);
		});

		it("leaves every fog float at zero when no fog is installed", () => {
			install(null);
			batcher.drawRetainedMesh(makeMesh(), MODEL, 0xffffffff);
			const floats = snapshot();
			// zero is mode 0 — the shader returns the colour untouched
			expect(Array.from(floats.slice(52, 60))).toEqual([
				0, 0, 0, 0, 0, 0, 0, 0,
			]);
		});

		it("does not let fog overlap the eye position", () => {
			// one float of drift and the specular highlight follows the fog
			install(fog({ mode: 2, density: 0.5 }));
			batcher.drawRetainedMesh(makeMesh(), MODEL, 0xffffffff);
			const floats = snapshot();
			expect(floats[51]).toBe(0);
			expect(floats[56]).toBe(2);
			expect(floats[59]).toBe(0.5);
		});
	});

	describe("the per-mesh opt-out", () => {
		it("zeroes the mode for a mesh with fog === false", () => {
			install(fog());
			batcher.drawRetainedMesh(makeMesh({ fog: false }), MODEL, 0xffffffff);
			const floats = snapshot();
			expect(floats[56]).toBe(0);
		});

		it("fogs a mesh with fog === true and one that never set it", () => {
			install(fog());
			batcher.drawRetainedMesh(makeMesh({ fog: true }), MODEL, 0xffffffff);
			expect(snapshot()[56]).toBe(1);
		});
	});

	describe("the derived instanced modules", () => {
		it("writes the fog varying in both tiers", () => {
			for (const [source, tier] of [
				[meshWGSL, UNLIT_INSTANCED],
				[meshLitWGSL, LIT_INSTANCED],
			]) {
				const module = buildInstancedMeshWGSL(source, {
					...tier,
					hasColor: false,
					hasData: false,
				});
				// the builder's own guards would throw on a varying that VSOut
				// declares and the body never writes; this pins the pairing
				expect(module).toContain("out.vFogDepth");
			}
		});

		it("keeps the instance slot clear of the fog varying's location", () => {
			// vFogDepth took the location the instance slot used to sit at, so
			// these must have moved — the builder throws on a duplicate, which
			// makes this a guard against a silent zeroed-fog build
			expect(UNLIT_INSTANCED.varyingLocation).toBe(3);
			expect(LIT_INSTANCED.varyingLocation).toBe(5);
		});
	});
});
