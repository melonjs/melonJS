import "./helpers/webgpu-globals.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	Camera2d,
	Color,
	ColorMatrix,
	ShaderEffect,
	WebGPURenderer,
} from "../src/index.js";
import state from "../src/state/state.ts";
import ToneMappingEffect from "../src/video/effects/tonemap.js";
import { instanceRecordLayout } from "../src/video/gpu/instancerecord.ts";
import WebGPUMeshBatcher from "../src/video/webgpu/batchers/mesh_batcher.js";
import WebGPUQuadBatcher from "../src/video/webgpu/batchers/quad_batcher.js";
import WebGPUPipelineCache from "../src/video/webgpu/pipeline/cache.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * The warm-up builds pipelines ahead of the draws, from keys it works out
 * itself. If one of those keys differs from the draw's by a character the
 * warm-up compiles something nothing will ask for, the draw compiles its own
 * on first use, and the stall is back with nothing failing.
 *
 * So every case here warms through the REAL renderer methods and then draws
 * through the REAL draw path — the quad batcher's flush and blit, the
 * renderer's own `drawMesh` and the mesh batcher behind it — against a real
 * pipeline cache on a mock device, and asserts the draw built nothing.
 */

const BODY = `
struct Fx { uStrength : f32, };
@group(3) @binding(0) var<uniform> fx : Fx;
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	return vec4f(color.rgb * fx.uStrength, color.a);
}
`;

const MODEL = (() => {
	const val = new Float32Array(16);
	val[0] = val[5] = val[10] = val[15] = 1;
	return { val };
})();

/** the renderer methods under test, lifted off the real prototype */
const WARM_METHODS = [
	"_queueWarm",
	"_flushWarm",
	"_collectWarms",
	"_whenWarmed",
	"_warmFogStates",
	"_warmCameraColorMatrices",
	"_warmInstancedDraw",
	"_warmRenderable",
	"_warmPostEffects",
	"_warmDraw",
	"_warmHostedEffect",
	"_warmMeshDraw",
	"_warmMeshDrawFog",
	"_warmAdvancedBlend",
	"_warmToneMap",
	"_sceneTargets",
	"_canWarm",
	"_meshBatcherFor",
	"_effectFamily",
	"_postEffectCapacity",
	"_hostsMeshEffect",
	"drawMesh",
];

/**
 * The mock renderer, given a real pipeline cache and the renderer state the
 * warm-up and `drawMesh` read.
 * @param {object} [options] - `{hdr}` puts the camera's targets in half-float
 * @returns {object} the renderer
 */
function makeRenderer(options = {}) {
	const renderer = createMockWebGPURenderer();
	const device = renderer.device;
	let built = 0;
	Object.assign(device, {
		createShaderModule(descriptor) {
			return { label: descriptor.label };
		},
		createPipelineLayout(descriptor) {
			return descriptor;
		},
		createRenderPipeline(descriptor) {
			built++;
			return { descriptor };
		},
	});
	renderer.pipelinesBuilt = () => {
		return built;
	};
	renderer.pipelineCache = new WebGPUPipelineCache(device, "bgra8unorm");
	for (const name of WARM_METHODS) {
		renderer[name] = WebGPURenderer.prototype[name];
	}
	const quad = new WebGPUQuadBatcher(renderer);
	const mesh = new WebGPUMeshBatcher(renderer);
	Object.assign(renderer, {
		canvasFormat: "bgra8unorm",
		canvasSampleCount: 1,
		preferredFormat: "bgra8unorm",
		_colorFormat: options.hdr === true ? "rgba16float" : "bgra8unorm",
		isContextValid: true,
		supportsRetainedMesh: true,
		supportsInstancing: true,
		settings: { prewarm: true },
		_fog3d: null,
		batchers: new Map([
			["quad", quad],
			["mesh", mesh],
		]),
		currentTint: new Color(255, 255, 255, 1),
		_transparentFlushing: false,
		_replayBlend: null,
		meshDepthActive: true,
		queued: [],
		queueTransparent(...args) {
			this.queued.push(args);
		},
		setBatcher(name) {
			return this.batchers.get(name);
		},
		getCanvas() {
			return { width: 320, height: 240 };
		},
		_postEffectPool() {
			return { reserve() {} };
		},
	});
	return { renderer, quad, mesh };
}

/** point the cache at a target, the way `setRenderTarget` does per pass */
function bindTarget(renderer, format, sampleCount) {
	renderer.pipelineCache.format = format;
	renderer.pipelineCache.sampleCount = sampleCount;
}

/** let the warm-up queue run: it compiles a microtask after it is asked */
async function settle() {
	for (let i = 0; i < 10; i++) {
		await Promise.resolve();
	}
}

function makeEffect() {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const effect = new ShaderEffect({ shaderLanguage: "wgsl" }, { wgsl: BODY });
	warn.mockRestore();
	return effect;
}

const ATLAS = {
	getTexture() {
		return { width: 64, height: 32 };
	},
};

function makeMesh(overrides = {}) {
	return {
		originalVertices: new Float32Array([
			-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
		]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		_indicesOriginal: new Uint16Array([0, 1, 2, 0, 2, 3]),
		_geometryVersion: 0,
		vertexCount: 4,
		texture: { id: "atlas" },
		alphaCutoff: 0,
		lit: false,
		cullBackFaces: true,
		rightHanded: false,
		depthTest: true,
		transparent: undefined,
		blendMode: "normal",
		postEffects: [],
		...overrides,
	};
}

/**
 * An `InstancedMesh` as the instanced draw path reads it: `makeMesh` plus the
 * per-instance records and their upload plan.
 * @param {object} [overrides] - fields to replace
 * @returns {object} the mesh
 */
function makeInstancedMesh(overrides = {}) {
	const layout = instanceRecordLayout(false, false);
	return makeMesh({
		cullBackFaces: false,
		instanceLayout: layout,
		instanceCount: 2,
		visibleInstanceCount: 2,
		instanceBuffer: new Float32Array((layout.stride / 4) * 2),
		instanceUpload() {
			return { full: true, first: 0, count: 2, revision: 1 };
		},
		clearInstanceDirty() {},
		_castsGroundShadow() {
			return true;
		},
		...overrides,
	});
}

describe("warm-up keys match the draw path (WebGPU)", () => {
	let renderer;
	let quad;

	beforeEach(() => {
		({ renderer, quad } = makeRenderer({ hdr: true }));
	});

	it("an effect alone on a sprite: the sprite's own draw", async () => {
		const effect = makeEffect();
		const sprite = { postEffects: [effect], blendMode: "additive" };
		renderer._warmPostEffects(sprite);
		await settle();
		const warmed = renderer.pipelinesBuilt();

		// drawn onto the canvas, and into the camera's half-float capture
		// when the camera runs a chain of its own
		for (const [format, samples] of [
			["bgra8unorm", 1],
			["rgba16float", 1],
		]) {
			bindTarget(renderer, format, samples);
			renderer.currentBlendMode = "additive";
			renderer.customShader = effect;
			quad.addQuad(ATLAS, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
			quad.flush();
		}
		expect(renderer.pipelinesBuilt()).toBe(warmed);
	});

	it("a sprite chain: mid-chain into its ping-pong, last back onto the scene", async () => {
		const first = makeEffect();
		const second = makeEffect();
		const sprite = { postEffects: [first, second], blendMode: "normal" };
		renderer._warmPostEffects(sprite);
		await settle();
		const warmed = renderer.pipelinesBuilt();
		const source = {
			getMaterialBindGroup() {
				return {};
			},
		};
		// the order `endPostEffect` binds them in (pinned by the flow spec):
		// effect 1 into the 8-bit ping-pong, blending off ...
		bindTarget(renderer, "bgra8unorm", 1);
		quad.blitTexture(source, 0, 0, 320, 240, first, false);
		// ... and the last one back with the sprite's blend, onto the canvas
		// or into the camera's capture
		renderer.currentBlendMode = "normal";
		for (const format of ["bgra8unorm", "rgba16float"]) {
			bindTarget(renderer, format, 1);
			quad.blitTexture(source, 0, 0, 320, 240, second, true);
		}
		expect(renderer.pipelinesBuilt()).toBe(warmed);
	});

	it("a camera chain: either effect mid-chain or last", async () => {
		const bloom = makeEffect();
		const flash = makeEffect();
		const camera = {
			postEffects: [bloom, flash],
			_postEffectManaged: true,
			blendMode: "normal",
		};
		renderer._warmPostEffects(camera);
		await settle();
		const warmed = renderer.pipelinesBuilt();
		const source = {
			getMaterialBindGroup() {
				return {};
			},
		};
		for (const effect of [bloom, flash]) {
			// mid-chain: into the camera's half-float ping-pong
			bindTarget(renderer, "rgba16float", 1);
			quad.blitTexture(source, 0, 0, 320, 240, effect, false);
			// last: onto the canvas
			bindTarget(renderer, "bgra8unorm", 1);
			quad.blitTexture(source, 0, 0, 320, 240, effect, false);
		}
		expect(renderer.pipelinesBuilt()).toBe(warmed);
	});

	it("an effect hosted by a transparent mesh: the transparent pass", async () => {
		const effect = makeEffect();
		const host = makeMesh({
			postEffects: [effect],
			transparent: true,
			blendMode: "additive",
			cullBackFaces: false,
		});
		renderer._warmPostEffects(host);
		await settle();
		const warmed = renderer.pipelinesBuilt();
		expect(warmed).toBeGreaterThan(0);

		for (const format of ["bgra8unorm", "rgba16float"]) {
			bindTarget(renderer, format, 1);
			// the replay `flushTransparentPass` runs: blend and shader restored
			// from the queued entry
			renderer._transparentFlushing = true;
			renderer._replayBlend = "additive";
			renderer.customShader = effect;
			renderer.drawMesh(host, MODEL);
		}
		expect(renderer.pipelinesBuilt()).toBe(warmed);
	});

	it("an effect hosted by an opaque mesh: opaque now, blended once faded", async () => {
		const effect = makeEffect();
		// `transparent` left unset: opaque at full alpha, blended when faded
		const host = makeMesh({ postEffects: [effect], cullBackFaces: true });
		renderer._warmPostEffects(host);
		await settle();
		const warmed = renderer.pipelinesBuilt();

		bindTarget(renderer, "rgba16float", 1);
		renderer.customShader = effect;
		renderer.drawMesh(host, MODEL);
		expect(renderer.queued).toHaveLength(0);
		renderer._transparentFlushing = true;
		renderer._replayBlend = "normal";
		renderer.drawMesh(host, MODEL);
		expect(renderer.pipelinesBuilt()).toBe(warmed);
	});

	it("a mesh's own draw, without an effect", async () => {
		const host = makeMesh({ cullBackFaces: true, depthTest: false });
		renderer._warmDraw(host);
		await settle();
		const warmed = renderer.pipelinesBuilt();
		expect(warmed).toBeGreaterThan(0);
		bindTarget(renderer, "bgra8unorm", 1);
		renderer.customShader = undefined;
		renderer.drawMesh(host, MODEL);
		expect(renderer.pipelinesBuilt()).toBe(warmed);
	});

	it("a sprite's own draw, with its blend mode", async () => {
		const sprite = { blendMode: "multiply" };
		renderer._warmDraw(sprite);
		await settle();
		const warmed = renderer.pipelinesBuilt();
		for (const format of ["bgra8unorm", "rgba16float"]) {
			bindTarget(renderer, format, 1);
			renderer.customShader = undefined;
			renderer.currentBlendMode = "multiply";
			quad.addQuad(ATLAS, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
			quad.flush();
		}
		expect(renderer.pipelinesBuilt()).toBe(warmed);
	});

	it("warms nothing for a container's own draw, or a camera's", async () => {
		renderer._warmDraw({ children: [], blendMode: "normal" });
		renderer._warmDraw({ _postEffectManaged: true, blendMode: "normal" });
		await settle();
		expect(renderer.pipelinesBuilt()).toBe(0);
	});

	it("follows a mesh's fog state into the key", async () => {
		renderer._fog3d = {
			color: [0, 0, 0],
			mode: 1,
			near: 0,
			invRange: 1,
			density: 0,
			heightAxis: [0, 0, 0],
			heightBase: 1,
		};
		const host = makeMesh();
		renderer._warmDraw(host);
		await settle();
		const warmed = renderer.pipelinesBuilt();
		bindTarget(renderer, "bgra8unorm", 1);
		renderer.drawMesh(host, MODEL);
		expect(renderer.pipelinesBuilt()).toBe(warmed);
	});

	describe("fog, as the stage's cameras will draw it", () => {
		const FOG = {
			color: [0, 0, 0],
			mode: 1,
			near: 0,
			invRange: 1,
			density: 0,
			heightAxis: [0, 0, 0],
			heightBase: 1,
		};
		/** a camera that installs `FOG` when it draws, or none */
		const camera = (fogged) => {
			return {
				_fog3dState() {
					return fogged ? FOG : null;
				},
			};
		};
		/** make the current stage's cameras these */
		const stageWith = (...cameras) => {
			return vi.spyOn(state, "current").mockReturnValue({
				cameras: new Map(
					cameras.map((c, i) => {
						return [`camera${i}`, c];
					}),
				),
			});
		};

		beforeEach(() => {
			renderer.shaderLanguage = "wgsl";
			// Between frames the renderer still holds the fog of the camera
			// that drew LAST. After a state change that is the previous
			// screen's: a loading screen, with none.
			renderer._fog3d = null;
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("warms a fogged camera's variant while the renderer still holds none", async () => {
			stageWith(camera(true));
			const host = makeMesh();
			renderer._queueWarm(host);
			await settle();
			const warmed = renderer.pipelinesBuilt();
			expect(warmed).toBeGreaterThan(0);
			// the camera installs its fog as it starts drawing
			renderer._fog3d = FOG;
			bindTarget(renderer, "bgra8unorm", 1);
			renderer.drawMesh(host, MODEL);
			expect(renderer.pipelinesBuilt()).toBe(warmed);
		});

		it("warms both variants for a fogged camera and a clear one", async () => {
			// a fogged 3D view with a clear minimap, say
			stageWith(camera(true), camera(false));
			const host = makeMesh();
			renderer._queueWarm(host);
			await settle();
			const warmed = renderer.pipelinesBuilt();
			bindTarget(renderer, "bgra8unorm", 1);
			for (const fog of [FOG, null]) {
				renderer._fog3d = fog;
				renderer.drawMesh(host, MODEL);
			}
			expect(renderer.pipelinesBuilt()).toBe(warmed);
		});

		it("warms only the clear variant when no camera has fog", async () => {
			stageWith(camera(false));
			const host = makeMesh();
			renderer._queueWarm(host);
			await settle();
			const clear = renderer.pipelinesBuilt();
			renderer._fog3d = null;
			bindTarget(renderer, "bgra8unorm", 1);
			renderer.drawMesh(host, MODEL);
			expect(renderer.pipelinesBuilt()).toBe(clear);
			// and nothing was spent on a fogged one nobody will draw
			const { renderer: both } = makeRenderer({ hdr: true });
			both.shaderLanguage = "wgsl";
			both._fog3d = null;
			vi.restoreAllMocks();
			stageWith(camera(true), camera(false));
			both._queueWarm(makeMesh());
			await settle();
			expect(both.pipelinesBuilt()).toBeGreaterThan(clear);
		});
	});

	describe("an InstancedMesh", () => {
		it("its own draw, which used to be left to the first frame", async () => {
			const host = makeInstancedMesh({
				_castsGroundShadow() {
					return false;
				},
			});
			renderer._warmDraw(host);
			await settle();
			const warmed = renderer.pipelinesBuilt();
			expect(warmed).toBeGreaterThan(0);
			bindTarget(renderer, "bgra8unorm", 1);
			renderer.customShader = undefined;
			renderer.drawMesh(host, MODEL);
			expect(renderer.pipelinesBuilt()).toBe(warmed);
		});

		it("its ground shadow, when it casts one", async () => {
			const host = makeInstancedMesh();
			renderer._warmDraw(host);
			await settle();
			const warmed = renderer.pipelinesBuilt();
			bindTarget(renderer, "bgra8unorm", 1);
			renderer.customShader = undefined;
			renderer.drawMesh(host, MODEL);
			renderer.batchers
				.get("mesh")
				.drawInstancedShadow(host, MODEL, 0xffffffff, makeMesh());
			expect(renderer.pipelinesBuilt()).toBe(warmed);
		});

		it("no shadow family for one that casts none", async () => {
			renderer._warmDraw(
				makeInstancedMesh({
					_castsGroundShadow() {
						return false;
					},
				}),
			);
			await settle();
			const without = renderer.pipelinesBuilt();
			const { renderer: other } = makeRenderer({ hdr: true });
			other._warmDraw(makeInstancedMesh());
			await settle();
			expect(other.pipelinesBuilt()).toBeGreaterThan(without);
		});
	});

	describe("a camera's built-in colour matrix", () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("is made and warmed last in the camera's chain once the stage is built", async () => {
			renderer.shaderLanguage = "wgsl";
			// what `camera.colorMatrix.contrast(...)` leaves on a camera
			const camera = {
				postEffects: [],
				_postEffectManaged: true,
				blendMode: "normal",
				colorMatrix: new ColorMatrix().contrast(1.2),
				_colorMatrixEffect: null,
				_syncColorMatrixEffect: Camera2d.prototype._syncColorMatrixEffect,
			};
			vi.spyOn(state, "current").mockReturnValue({
				cameras: new Map([["default", camera]]),
			});
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			// any warm-up flush: here, a sprite entering the world
			renderer._queueWarm({ blendMode: "normal" });
			await settle();
			warn.mockRestore();
			// built before the frame rather than inside the camera's draw
			expect(camera._colorMatrixEffect).not.toBe(null);
			// and the camera's own list left as it was
			expect(camera.postEffects).toEqual([]);
			const warmed = renderer.pipelinesBuilt();
			const source = {
				getMaterialBindGroup() {
					return {};
				},
			};
			// last in the chain: onto the canvas
			bindTarget(renderer, "bgra8unorm", 1);
			quad.blitTexture(
				source,
				0,
				0,
				320,
				240,
				camera._colorMatrixEffect,
				false,
			);
			expect(renderer.pipelinesBuilt()).toBe(warmed);
		});
	});

	describe("what a state change waits on before it draws", () => {
		const drawMultiply = () => {
			for (const format of ["bgra8unorm", "rgba16float"]) {
				bindTarget(renderer, format, 1);
				renderer.customShader = undefined;
				renderer.currentBlendMode = "multiply";
				quad.addQuad(ATLAS, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
				quad.flush();
			}
		};

		it("the pipelines its stage queued, until they are built", async () => {
			renderer.shaderLanguage = "wgsl";
			renderer._queueWarm({ blendMode: "multiply" });
			const ready = renderer._whenWarmed();
			expect(ready).toBeInstanceOf(Promise);
			// run now rather than left to the microtask: the stage is built
			expect(renderer.pipelineCache.pending.size).toBeGreaterThan(0);
			await ready;
			expect(renderer.pipelineCache.pending.size).toBe(0);
			// so the first frame finds what it draws with
			const warmed = renderer.pipelinesBuilt();
			drawMultiply();
			expect(renderer.pipelinesBuilt()).toBe(warmed);
		});

		it("nothing, for a stage that queued nothing or has it all", async () => {
			renderer.shaderLanguage = "wgsl";
			expect(renderer._whenWarmed()).toBeUndefined();
			renderer._queueWarm({ blendMode: "multiply" });
			await renderer._whenWarmed();
			// the same stage, entered a second time
			renderer._queueWarm({ blendMode: "multiply" });
			expect(renderer._whenWarmed()).toBeUndefined();
		});
	});

	it("the tone curve: last in the camera chain, onto the canvas", async () => {
		renderer.shaderLanguage = "wgsl";
		renderer._toneMapEffect = new ToneMappingEffect(renderer, { mode: "aces" });
		renderer._warmToneMap();
		await settle();
		const warmed = renderer.pipelinesBuilt();
		expect(warmed).toBe(1);
		bindTarget(renderer, "bgra8unorm", 1);
		quad.blitTexture(
			{
				getMaterialBindGroup() {
					return {};
				},
			},
			0,
			0,
			320,
			240,
			renderer._toneMapEffect,
			false,
		);
		expect(renderer.pipelinesBuilt()).toBe(warmed);
	});

	it("only warms the canvas when the camera's targets share its format", async () => {
		({ renderer } = makeRenderer({ hdr: false }));
		const effect = makeEffect();
		renderer._warmPostEffects({ postEffects: [effect], blendMode: "normal" });
		await settle();
		// one target shape, so one pipeline
		expect(renderer.pipelinesBuilt()).toBe(1);
	});
});
