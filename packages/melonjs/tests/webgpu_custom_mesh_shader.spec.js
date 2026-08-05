import "./helpers/webgpu-globals.js";
import { describe, expect, it, vi } from "vitest";
import { Color, GLShader, WebGPURenderer } from "../src/index.js";
import WebGPULitMeshBatcher from "../src/video/webgpu/batchers/lit_mesh_batcher.js";
import WebGPUMeshBatcher from "../src/video/webgpu/batchers/mesh_batcher.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

// a minimal-but-plausible custom module (the exact text is irrelevant to
// the mock device — registration keys on it verbatim)
const TOON_WGSL = `
@vertex
fn vertex_main(@location(0) aVertex : vec3f) -> @builtin(position) vec4f {
	return vec4f(aVertex, 1.0);
}
@fragment
fn fragment_main() -> @location(0) vec4f {
	return vec4f(1.0);
}
`;

// a WGSL-only custom shader: no GL context, no GLSL pair — the dual
// GLShader shape a WebGPU-only game constructs directly
function makeToonShader(label) {
	return new GLShader(undefined, { wgsl: TOON_WGSL, label });
}

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
		cullBackFaces: false,
		rightHanded: false,
		...overrides,
	};
}

describe("GLShader — WGSL realization (isWebGPU)", () => {
	it("a wgsl-only shader carries the module, flags itself, and stays quiet", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const shader = makeToonShader("toon");
		expect(shader.wgsl).toBe(TOON_WGSL);
		expect(shader.isWebGPU).toBe(true);
		expect(shader.isWebGL).toBe(false);
		expect(shader.shared).toBe(false);
		expect(shader.wgslValid).toBe(true);
		expect(shader.label).toBe("toon");
		// it has a realization — no "no usable realization" warning
		expect(warn).not.toHaveBeenCalled();
		// and no GL program to bind — GL-side entry points are inert no-ops
		expect(shader.program).toBe(null);
		expect(() => {
			shader.bind();
			shader.setUniform("uAnything", 1);
		}).not.toThrow();
		warn.mockRestore();
	});

	it("a shader with NO realization at all warns and stays inert", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const shader = new GLShader(undefined, {
			vertex: "void main(){}",
			fragment: "void main(){}",
		});
		expect(shader.isWebGL).toBe(false);
		expect(shader.isWebGPU).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toMatch(/realization/);
		warn.mockRestore();
	});

	it("registerWGSL namespaces the module per host and caches per host key", () => {
		const renderer = createMockWebGPURenderer();
		const cache = renderer.pipelineCache;
		const shader = makeToonShader();

		const meshKey = shader.registerWGSL(cache, "mesh", [], "mesh");
		const again = shader.registerWGSL(cache, "mesh", [], "mesh");
		const litKey = shader.registerWGSL(cache, "meshLit", [], "meshLit");

		expect(again).toBe(meshKey);
		// distinct families per host — the module text is suffixed with the
		// host key so the cache's text-dedup cannot collapse them
		expect(litKey).not.toBe(meshKey);
		expect(cache.modules[meshKey].code).toBe(
			`${TOON_WGSL}\n// melonJS host: mesh`,
		);
		expect(cache.modules[litKey].code).toBe(
			`${TOON_WGSL}\n// melonJS host: meshLit`,
		);
	});

	it("a device-generation change (cache epoch) re-registers and clears an invalid verdict", () => {
		const renderer = createMockWebGPURenderer();
		const cache = renderer.pipelineCache;
		const shader = makeToonShader();

		shader.registerWGSL(cache, "mesh", [], "mesh");
		shader.wgslValid = false;
		expect(shader._wgslRegistrations.epoch).toBe(cache.epoch);

		cache.epoch += 1;
		const key = shader.registerWGSL(cache, "mesh", [], "mesh");
		expect(shader._wgslRegistrations.epoch).toBe(cache.epoch);
		expect(shader._wgslRegistrations.keys.get("mesh")).toBe(key);
		// a fresh device gets a fresh validation verdict
		expect(shader.wgslValid).toBe(true);
	});

	it("async WGSL validation errors flip wgslValid=false and warn once", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const shader = makeToonShader("broken");
		const cache = {
			epoch: 7,
			registerShader() {
				return "effect:9";
			},
			modules: {
				"effect:9": {
					getCompilationInfo() {
						return Promise.resolve({
							messages: [
								{ type: "error", lineNum: 3, message: "unknown identifier" },
								{ type: "info", lineNum: 1, message: "fine" },
							],
						});
					},
				},
			},
		};

		shader.registerWGSL(cache, "mesh", [], "mesh");
		await Promise.resolve();
		await Promise.resolve();
		expect(shader.wgslValid).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toMatch(/broken/);
		expect(warn.mock.calls[0][0]).toMatch(/line 3/);
		warn.mockRestore();
	});
});

describe("WebGPUMeshBatcher — hosted custom shader family", () => {
	it("activeShaderKey routes to the custom family, per host, and falls back when invalid", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const litBatcher = new WebGPULitMeshBatcher(renderer);
		const shader = makeToonShader();

		// no custom shader → the built-in family
		expect(batcher.activeShaderKey()).toBe(batcher.shaderKey);

		batcher.customShader = shader;
		const customKey = batcher.activeShaderKey();
		expect(customKey).not.toBe(batcher.shaderKey);
		// stable across lookups (registered once)
		expect(batcher.activeShaderKey()).toBe(customKey);

		// the lit host realizes the same instance as a different family
		litBatcher.customShader = shader;
		const litCustomKey = litBatcher.activeShaderKey();
		expect(litCustomKey).not.toBe(customKey);
		expect(litCustomKey).not.toBe(litBatcher.shaderKey);

		// failed validation → built-in shading (the mesh keeps drawing)
		shader.wgslValid = false;
		expect(batcher.activeShaderKey()).toBe(batcher.shaderKey);
	});

	it("an accumulated flush records its pipeline under the custom family", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const shader = makeToonShader();

		batcher.customShader = shader;
		batcher.addMesh(makeMesh(), 0xffffffff);
		batcher.flush();

		const customKey = shader._wgslRegistrations.keys.get("mesh");
		const lastKey = renderer.calls.pipelineKeys.at(-1);
		expect(lastKey.startsWith(`${customKey}|`)).toBe(true);
		// the draw itself is unchanged — same indexed geometry
		expect(renderer.calls.drawIndexed).toEqual([6]);
	});
});

describe("WebGPURenderer.drawMesh — custom shader routing (real prototype over a stub)", () => {
	function makeStub(batcher) {
		return {
			batchers: new Map([["mesh", batcher]]),
			currentBatcher: batcher,
			setBatcher(name) {
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

	it("routes a WGSL-carrying shader to the batcher for the draw, then clears it", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const stub = makeStub(batcher);
		const shader = makeToonShader();
		stub.customShader = shader;

		WebGPURenderer.prototype.drawMesh.call(stub, makeMesh());

		// the flush inside drawMesh saw the custom family…
		const customKey = shader._wgslRegistrations.keys.get("mesh");
		expect(typeof customKey).toBe("string");
		expect(renderer.calls.pipelineKeys.at(-1).startsWith(`${customKey}|`)).toBe(
			true,
		);
		// …and no warning fired — this is the supported path
		expect(stub.meshEffectWarned).toBe(false);
		// per-mesh state: never leaks into the next draw
		expect(batcher.customShader).toBe(null);

		stub.customShader = undefined;
		WebGPURenderer.prototype.drawMesh.call(stub, makeMesh());
		expect(
			renderer.calls.pipelineKeys.at(-1).startsWith(`${batcher.shaderKey}|`),
		).toBe(true);
	});

	it("an exception mid-draw still clears the batcher's custom shader", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const stub = makeStub(batcher);
		stub.customShader = makeToonShader();
		batcher.addMesh = () => {
			throw new Error("boom");
		};

		expect(() => {
			WebGPURenderer.prototype.drawMesh.call(stub, makeMesh());
		}).toThrow("boom");
		// the finally bracket: the hosted module never leaks into a later
		// mesh (or the frame-end drain) after a mid-draw failure
		expect(batcher.customShader).toBe(null);
	});

	it("clone() carries the wgsl module, label and flags (caller-owned copy)", () => {
		const shader = new GLShader(undefined, {
			wgsl: TOON_WGSL,
			label: "toon",
		});
		shader.shared = true;
		const copy = shader.clone();
		expect(copy.wgsl).toBe(TOON_WGSL);
		expect(copy.label).toBe("toon");
		expect(copy.isWebGPU).toBe(true);
		expect(copy.isWebGL).toBe(false);
		// ownership never carries — the clone is caller-owned
		expect(copy.shared).toBe(false);
	});

	it("a shader with no wgsl module still warns once and draws with built-in shading", () => {
		const renderer = createMockWebGPURenderer();
		const batcher = new WebGPUMeshBatcher(renderer);
		const stub = makeStub(batcher);
		// a ShaderEffect (or GLSL-only GLShader) in the slot — not hostable
		stub.customShader = { enabled: true };
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		WebGPURenderer.prototype.drawMesh.call(stub, makeMesh());
		WebGPURenderer.prototype.drawMesh.call(stub, makeMesh());
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toMatch(/Mesh/);
		expect(
			renderer.calls.pipelineKeys.at(-1).startsWith(`${batcher.shaderKey}|`),
		).toBe(true);
		expect(renderer.calls.drawIndexed).toEqual([6, 6]);
		warn.mockRestore();
	});
});
