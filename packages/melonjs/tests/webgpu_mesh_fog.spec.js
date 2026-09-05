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
import meshShadowWGSL from "../src/video/webgpu/shaders/mesh-shadow-instanced.wgsl";
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

	const fog = (over = {}) => {
		// The camera bakes the height integral into two operands before it
		// reaches a batcher. With no camera rotation the world-up axis in view
		// space is (0, 1, 0), so the falloff lands entirely in y — these tests
		// keep expressing the fog in the world terms an author uses.
		const { heightFalloff: k = 0, fogHeight = 0, cameraY = 0, ...rest } = over;
		return {
			mode: 1,
			near: 12,
			invRange: 0.25,
			density: 0,
			color: new Float32Array([0.25, 0.5, 0.75]),
			// uniform fog: a zero falloff collapses the height integral to 1
			heightAxis: new Float32Array([0, k, 0]),
			heightBase: Math.exp(
				Math.min(30, Math.max(-30, k * (cameraY - fogHeight))),
			),
			...rest,
		};
	};

	describe("the uniform block", () => {
		it("grew to 256 bytes, and the layout key moved with it", () => {
			// 176 before #1575, 208 before fog, 240 before its height falloff
			expect(MESH_UNIFORM_SIZE).toBe(256);
			expect(renderer.pipelineCache.effectLayouts.has("mesh:u256")).toBe(true);
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

		it("zeroes the colour and params when no fog is installed", () => {
			install(null);
			batcher.drawRetainedMesh(makeMesh(), MODEL, 0xffffffff);
			const floats = snapshot();
			// zero is mode 0 — the shader returns the colour untouched. The
			// height block at 60-63 is NOT all zero: see the height describe,
			// where `w` is deliberately the neutral 1.
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

	describe("the height block at 60-63 (#1641)", () => {
		it("carries the falloff axis and the baked altitude term", () => {
			// xyz is the world-up axis in VIEW space with the falloff folded
			// in, w the pre-baked exp. The shader dots xyz against a
			// view-space position, which is the only way it can recover a
			// world height: `Container.draw` folds every ancestor into `view`,
			// so the position it computes is the mesh's parent space.
			install(fog({ heightFalloff: 0.02, fogHeight: 100, cameraY: 300 }));
			batcher.drawRetainedMesh(makeMesh(), MODEL, 0xffffffff);
			const floats = snapshot();
			expect(Array.from(floats.slice(60, 63))).toEqual([
				0,
				Math.fround(0.02),
				0,
			]);
			expect(floats[63]).toBeCloseTo(Math.exp(0.02 * (300 - 100)), 4);
		});

		it("carries all three axis components, not just y", () => {
			// Every other test here uses an unturned camera, whose axis is
			// (0, k, 0) — so dropping x or z is invisible. Once the camera
			// pitches or yaws the axis is a real direction, and the whole
			// point of the fix is that the shader dots against it.
			const axis = new Float32Array([0.004, -0.011, 0.007]);
			install(fog({ heightAxis: axis }));
			batcher.drawRetainedMesh(makeMesh(), MODEL, 0xffffffff);
			const floats = snapshot();
			expect(Array.from(floats.slice(60, 63))).toEqual([
				Math.fround(0.004),
				Math.fround(-0.011),
				Math.fround(0.007),
			]);
		});

		it("stays neutral, not zero, when no fog is installed", () => {
			// w multiplies the WHOLE height factor, so a 0 here would cancel
			// the fog rather than leave it uniform. The other three are zero,
			// which makes the shader's dot product 0 and takes its series
			// limit — the two together are exactly 1.
			install(null);
			batcher.drawRetainedMesh(makeMesh(), MODEL, 0xffffffff);
			const floats = snapshot();
			expect(Array.from(floats.slice(60, 63))).toEqual([0, 0, 0]);
			expect(floats[63]).toBe(1);
		});

		it("stays neutral for a mesh that opted out", () => {
			install(fog({ heightFalloff: 0.05, cameraY: 400 }));
			batcher.drawRetainedMesh(makeMesh({ fog: false }), MODEL, 0xffffffff);
			const floats = snapshot();
			expect(Array.from(floats.slice(60, 63))).toEqual([0, 0, 0]);
			expect(floats[63]).toBe(1);
		});

		it("is exactly neutral at falloff 0, whatever the heights say", () => {
			// uniform fog must stay bit-identical to the fog that shipped
			// before the falloff existed
			install(fog({ heightFalloff: 0, fogHeight: -900, cameraY: 250 }));
			batcher.drawRetainedMesh(makeMesh(), MODEL, 0xffffffff);
			const floats = snapshot();
			expect(Array.from(floats.slice(60, 64))).toEqual([0, 0, 0, 1]);
		});

		it("does not run past the end of the block", () => {
			// 63 is the last float in the 256-byte block; one more and the
			// write would spill into the next draw's region
			install(fog({ heightFalloff: 0.02 }));
			batcher.drawRetainedMesh(makeMesh(), MODEL, 0xffffffff);
			expect(snapshot().length).toBe(MESH_UNIFORM_SIZE / 4);
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

	describe("the WGSL agrees with what the CPU packs", () => {
		// Nothing in this suite compiles WGSL: the mock device records calls,
		// and headless Chromium has no `navigator.gpu` to compile against. A
		// module that would fail `createShaderModule` on a real device ships
		// green — a reintroduced `f32` argument against the `vec3f` signature
		// passes every test here. These are the cheap structural guards that
		// at least pin the contract this change altered.
		const SOURCES = [
			["mesh.wgsl", meshWGSL],
			["mesh-lit.wgsl", meshLitWGSL],
			["mesh-shadow-instanced.wgsl", meshShadowWGSL],
		];

		it("takes a view-space position, in every module that fogs", () => {
			for (const [name, src] of SOURCES) {
				expect(src, name).toContain("fn fog_height_factor(viewPos : vec3f)");
				// and reads the axis as a direction, not a scalar height
				expect(src, name).toContain("dot(uMesh.fogHeight.xyz, viewPos)");
				expect(src, name).toContain("return uMesh.fogHeight.w * t;");
			}
		});

		it("never passes a PRE-VIEW height to it again", () => {
			// the #1641 bug, in the shape it had: `model * position` read for
			// its `.y`. That position is the mesh's parent space.
			for (const [name, src] of SOURCES) {
				expect(src, name).not.toMatch(/fog_height_factor\([^)]*\.y\)/);
				expect(src, name).not.toMatch(/fog_height_factor\(\s*worldPos\./);
			}
		});

		it("keeps the derived instanced bodies type-compatible", () => {
			// these are assembled from JS strings, so they cannot be checked
			// by reading a .wgsl file — and a mismatch here is invisible to
			// every other test in this suite
			for (const [source, tier, name] of [
				[meshWGSL, UNLIT_INSTANCED, "unlit instanced"],
				[meshLitWGSL, LIT_INSTANCED, "lit instanced"],
			]) {
				const module = buildInstancedMeshWGSL(source, {
					...tier,
					hasColor: false,
					hasData: false,
				});
				// passes a vec3f, and nothing that ends in `.y)`
				expect(module, name).toMatch(
					/fog_height_factor\(\s*viewPos(\.xyz)?\s*\)/,
				);
				expect(module, name).not.toMatch(/fog_height_factor\([^)]*\.y\)/);
				// and declares the `viewPos` it passes, exactly once
				expect((module.match(/let viewPos\b/g) ?? []).length, name).toBe(1);
			}
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
