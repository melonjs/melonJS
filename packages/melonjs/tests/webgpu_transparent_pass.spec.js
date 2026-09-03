import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import { Color, Matrix3d } from "../src/index.js";
import { instanceRecordLayout } from "../src/video/gpu/instancerecord.ts";
import Renderer from "../src/video/renderer.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import WebGPUMeshBatcher from "../src/video/webgpu/batchers/mesh_batcher.js";
import meshWGSL from "../src/video/webgpu/shaders/mesh.wgsl";
import meshLitWGSL from "../src/video/webgpu/shaders/mesh-lit.wgsl";
import WebGPURenderer from "../src/video/webgpu/webgpu_renderer.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * The transparent pass (#1516) on WebGPU.
 *
 * The pass is backend-neutral by design — the queue and the sort live on the
 * base `Renderer` — but the two halves that are NOT shared are exactly the
 * two that can drift silently: the routing predicate, duplicated in each
 * backend's `drawMesh`, and the per-entry blend state, which each backend
 * installs its own way. A divergence renders correctly on the machine the
 * author happened to test and wrongly on the other, with nothing failing.
 */

/**
 * Drive a backend's REAL `drawMesh` far enough to see whether the predicate
 * routed, without a GPU behind it.
 *
 * The predicate returns before touching any device state, so a routed draw
 * completes; an unrouted one continues into the recording path and throws on
 * the absent context. That throw is the "did not route" signal and nothing
 * else is read from it — the drawing path itself is covered by the specs that
 * own it.
 * @param {Function} RendererClass - the backend under test
 * @param {object} mesh - the mesh to offer
 * @param {number} alpha - the global alpha in force
 * @param {boolean} flushing - whether a drain is already running
 * @param {boolean} retained - whether a model matrix is supplied
 * @returns {object[]} the `queueTransparent` argument lists recorded
 */
const routeThrough = (
	RendererClass,
	mesh,
	{ alpha = 1, flushing = false, retained = true } = {},
) => {
	const queued = [];
	const probe = Object.create(RendererClass.prototype);
	Object.assign(probe, {
		currentTint: new Color(255, 255, 255, 1),
		getGlobalAlpha: () => {
			return alpha;
		},
		queueTransparent: (...args) => {
			return queued.push(args);
		},
		_transparentFlushing: flushing,
	});
	try {
		probe.drawMesh(mesh, retained ? new Matrix3d() : undefined);
	} catch {
		// past the predicate and into the device path — not under test here
	}
	return queued;
};

const BACKENDS = [
	["WebGL", WebGLRenderer],
	["WebGPU", WebGPURenderer],
];

describe("the routing predicate agrees across backends", () => {
	// Each case names what the predicate must decide and why. Run against both
	// backends from one table: the point is not that either is individually
	// right, but that a change to one and not the other cannot pass.
	const CASES = [
		{
			what: "a faded mesh routes",
			mesh: {},
			opts: { alpha: 0.5 },
			routes: true,
		},
		{
			what: "an opaque mesh does not",
			mesh: {},
			opts: {},
			routes: false,
		},
		{
			what: "`transparent: true` routes at full opacity",
			mesh: { transparent: true },
			opts: {},
			routes: true,
		},
		{
			what: "`transparent: false` never routes",
			mesh: { transparent: false },
			opts: { alpha: 0.5 },
			routes: false,
		},
		{
			what: "an internal decal quad routes",
			mesh: { _blendedDraw: true },
			opts: {},
			routes: true,
		},
		{
			what: "a non-retained draw never routes",
			mesh: { transparent: true },
			opts: { retained: false },
			routes: false,
		},
		{
			what: "nothing routes during a drain",
			mesh: { transparent: true },
			opts: { flushing: true },
			routes: false,
		},
	];

	for (const [name, RendererClass] of BACKENDS) {
		describe(name, () => {
			for (const { what, mesh, opts, routes } of CASES) {
				it(what, () => {
					const queued = routeThrough(RendererClass, mesh, opts);
					expect(queued).toHaveLength(routes ? 1 : 0);
				});
			}

			it('hands the decal quads `"normal"` and everything else its own mode', () => {
				const [decal] = routeThrough(RendererClass, {
					_blendedDraw: true,
					blendMode: "additive",
				});
				// an internal decal is not a place to honour a stray blendMode
				expect(decal[3]).toBe("normal");
				const [glow] = routeThrough(
					RendererClass,
					{ transparent: true, blendMode: "additive" },
					{},
				);
				expect(glow[3]).toBe("additive");
			});
		});
	}

	it("routes on the same alpha threshold on both backends", () => {
		// 254/255 rounds to a packed alpha below 0xff and must route; a true
		// 1.0 must not. The boundary is where an accumulated container opacity
		// of 0.999 lands, so a backend drifting by one step here would defer
		// (or fail to defer) an entire scene.
		for (const [, RendererClass] of BACKENDS) {
			expect(
				routeThrough(RendererClass, {}, { alpha: 254 / 255 }),
			).toHaveLength(1);
			expect(routeThrough(RendererClass, {}, { alpha: 1 })).toHaveLength(0);
		}
	});
});

/**
 * A mesh shaped for the retained WebGPU path. Mirrors
 * `webgpu_mesh_retained.spec.js`.
 * @param {object} overrides - fields to replace
 * @returns {object} the mesh stand-in
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
		alphaCutoff: 0,
		lit: false,
		cullBackFaces: true,
		rightHanded: false,
		...overrides,
	};
}

/**
 * The same, plus the per-instance fields `instanceBufferFor` consumes.
 * @param {object} overrides - fields to replace
 * @returns {object} the instanced mesh stand-in
 */
function makeInstancedMesh(overrides = {}) {
	const layout = instanceRecordLayout(false, false);
	const instanceCount = 2;
	return makeRetainedMesh({
		instanceLayout: layout,
		instanceCount,
		visibleInstanceCount: instanceCount,
		instanceBuffer: new Float32Array(
			(instanceCount * layout.stride) / Float32Array.BYTES_PER_ELEMENT,
		),
		instanceUpload: () => {
			return { full: true, first: 0, count: instanceCount, revision: 1 };
		},
		clearInstanceDirty: () => {},
		...overrides,
	});
}

const MODEL = new Matrix3d();

describe("the replay installs its blend state (mock device)", () => {
	let renderer;
	let batcher;
	let states;

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPUMeshBatcher(renderer);
		// the mock's key carries the blend token and the premultiplied bit but
		// not the depth-write axis, so snapshot the mesh state as it is asked for
		states = [];
		const get = renderer.pipelineCache.get.bind(renderer.pipelineCache);
		renderer.pipelineCache.get = (...args) => {
			states.push({ ...args[5] });
			return get(...args);
		};
	});

	/** the blend token and premultiplied bit out of the last pipeline key */
	const lastKey = () => {
		const parts = renderer.calls.pipelineKeys.at(-1).split("|");
		return { blend: parts[2], premultiplied: parts[3] };
	};

	const DRAWS = [
		[
			"retained",
			(mesh) => {
				return batcher.drawRetainedMesh(mesh, MODEL, 0x80ffffff);
			},
			makeRetainedMesh,
		],
		[
			"instanced",
			(mesh) => {
				return batcher.drawInstancedMesh(mesh, MODEL, 0x80ffffff);
			},
			makeInstancedMesh,
		],
	];

	for (const [name, drawIt, make] of DRAWS) {
		describe(name, () => {
			it("carries the entry's own blend mode into the pipeline", () => {
				renderer._replayBlend = "additive";
				drawIt(make());
				expect(lastKey().blend).toBe("additive");
			});

			it("stops writing depth for a replayed entry", () => {
				renderer._replayBlend = "normal";
				drawIt(make());
				expect(states.at(-1).depthWrite).toBe(false);
			});

			it("leaves the ordinary draw exactly as it was", () => {
				renderer._replayBlend = null;
				drawIt(make());
				expect(lastKey().blend).toBe("none");
				// `undefined`, not `true`: the axis reads `!== false`, so an
				// unset value keeps the key byte-identical to before the pass
				expect(states.at(-1).depthWrite).toBeUndefined();
			});

			it("stays premultiplied after straight-alpha content drew earlier", () => {
				// `premultipliedAlpha` describes source TEXTURES and is mutable —
				// anything drawing a straight-alpha atlas earlier in the frame
				// leaves it `false`. The mesh vertex stage premultiplies its own
				// output unconditionally, so honouring the flag here selects
				// `src-alpha` and applies alpha a SECOND time.
				renderer.premultipliedAlpha = false;
				renderer._replayBlend = "normal";
				drawIt(make());
				expect(lastKey().premultiplied).toBe("true");
			});
		});
	}
});

describe("the instanced ground-shadow decal defers exactly once", () => {
	// The guard is what stops the replay re-queueing what it is replaying. On
	// WebGL an inversion fails 7 tests; on WebGPU it failed none — the mock
	// suite never runs the replay -> drawInstancedShadow path, so the same
	// mutation left every instanced shadow queued forever and never drawn.
	for (const [name, RendererClass] of BACKENDS) {
		it(`${name} queues outside a drain and draws inside one`, () => {
			const queued = [];
			const drawn = [];
			const probe = Object.create(RendererClass.prototype);
			Object.assign(probe, {
				currentTint: new Color(255, 255, 255, 1),
				getGlobalAlpha: () => {
					return 1;
				},
				queueTransparent: (...args) => {
					return queued.push(args);
				},
				setBatcher: () => {},
				currentBatcher: {
					drawInstancedShadow: (...a) => {
						return drawn.push(a);
					},
				},
				_transparentFlushing: false,
			});
			const mesh = { instanceLayout: {} };
			const quad = { lit: false };

			probe.drawInstancedShadow(mesh, new Matrix3d(), quad);
			expect(queued, `${name} defers outside a drain`).toHaveLength(1);
			expect(drawn, `${name} does not draw it yet`).toHaveLength(0);
			// the instanced mesh rides along so the replay can find its buffer
			expect(queued[0][4]).toBe(mesh);

			probe._transparentFlushing = true;
			probe.drawInstancedShadow(mesh, new Matrix3d(), quad);
			expect(queued, `${name} does not re-queue during a drain`).toHaveLength(
				1,
			);
			expect(drawn, `${name} draws it during a drain`).toHaveLength(1);
		});
	}
});

describe("the WGSL shaders keep the cutout before the tint", () => {
	// Both WGSL twins were completely unpinned: reverting the discard to
	// post-tint alpha — the fade-pop bug — survived the whole suite, because
	// there is no adapter in CI and nothing else reads the source. Order in
	// the text is a crude pin, but it catches exactly that revert.
	for (const [name, source] of [
		["mesh.wgsl", meshWGSL],
		["mesh-lit.wgsl", meshLitWGSL],
	]) {
		it(`${name} discards on material alpha, before the tint multiply`, () => {
			const fragment = source.slice(source.indexOf("@fragment"));
			const discard = fragment.indexOf("uMesh.params.x");
			const tint = fragment.indexOf("in.vColor");
			expect(discard, `${name}: no cutout found`).toBeGreaterThan(-1);
			expect(tint, `${name}: no tint multiply found`).toBeGreaterThan(-1);
			// the tint must be applied AFTER the discard, or a fading cutout
			// mesh vanishes at its own threshold
			expect(discard).toBeLessThan(tint);
		});
	}
});

describe("the queue itself is backend-neutral", () => {
	it("lives on the base renderer, not on either backend", () => {
		// the sort, the pool, the per-target keying and the drain guards are
		// all shared code; only the routing predicate and the blend
		// installation are duplicated, and those are pinned above
		for (const method of [
			"queueTransparent",
			"flushTransparent",
			"flushTransparentPass",
			"transparentQueue",
			"transparentTarget",
			"removeQueuedTransparent",
		]) {
			expect(typeof Renderer.prototype[method]).toBe("function");
			expect(
				Object.hasOwn(WebGPURenderer.prototype, method) ||
					Object.hasOwn(WebGLRenderer.prototype, method),
			).toBe(false);
		}
	});

	it("both backends drain their own pass before unbinding its target", () => {
		// The queue is keyed by render target, so a pass that ends without
		// draining strands its entries: the key returns to the pool and the
		// next pass to claim it would replay them into a target they were
		// never recorded for. Each backend contributes the same one call at
		// the same point — asserted here rather than assumed, because a
		// backend quietly missing it is invisible until something renders in
		// the wrong buffer.
		for (const [name, RendererClass] of BACKENDS) {
			let drained = 0;
			const probe = Object.create(RendererClass.prototype);
			Object.assign(probe, {
				flushTransparentPass: () => {
					return drained++;
				},
				postEffects: undefined,
			});
			const renderable = {
				// two effects force the offscreen path; one non-managed effect
				// takes the customShader fast path and never binds a target
				postEffects: [{ enabled: true }, { enabled: true }],
				_postEffectManaged: false,
			};
			try {
				probe.endPostEffect(renderable);
			} catch {
				// past the drain and into the device path — not under test
			}
			expect(drained, `${name} drained its pass`).toBe(1);
		}
	});

	it("neither backend drains a pass that never bound a target", () => {
		// the single-effect fast path composites through `customShader` with
		// no offscreen target, so there is no separate queue to put down
		for (const [name, RendererClass] of BACKENDS) {
			let drained = 0;
			const probe = Object.create(RendererClass.prototype);
			Object.assign(probe, {
				flushTransparentPass: () => {
					return drained++;
				},
			});
			try {
				probe.endPostEffect({
					postEffects: [{ enabled: true }],
					_postEffectManaged: false,
				});
			} catch {
				// not under test
			}
			expect(drained, `${name} left the fast path alone`).toBe(0);
		}
	});
});
