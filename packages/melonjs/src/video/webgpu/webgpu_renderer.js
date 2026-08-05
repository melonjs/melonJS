import { Color, colorPool } from "../../math/color.ts";
import { Matrix3d } from "../../math/matrix3d.ts";
import { Bounds } from "../../physics/bounds.ts";
import {
	CANVAS_ONRESIZE,
	emit,
	GAME_RESET,
	ONCONTEXT_LOST,
	ONCONTEXT_RESTORED,
	off,
	on,
	RENDER_TARGET_CHANGED,
} from "../../system/event.ts";
import RadialGradientEffect from "../effects/radialGradient.js";
import { Gradient } from "../gradient.js";
import Renderer from "../renderer.js";
import RenderTargetPool from "../rendertarget/render_target_pool.js";
import WebGPURenderTarget from "../rendertarget/webgpurendertarget.js";
import { createAtlas, TextureAtlas } from "../texture/atlas.js";
import TextureCache from "../texture/cache.js";
import { dashPath, dashSegments } from "../utils/dash.js";
import {
	generateJoinCircles,
	generateTriangleFan,
} from "../utils/tessellation.js";
// pure CPU lighting math shared with the GL backend (published std140
// layout, no GL calls)
import {
	createLightUniformScratch,
	packLights,
} from "../webgl/lighting/pack.ts";
import WebGPULitMeshBatcher from "./batchers/lit_mesh_batcher.js";
import WebGPULitQuadBatcher from "./batchers/lit_quad_batcher.js";
import WebGPUMeshBatcher from "./batchers/mesh_batcher.js";
import WebGPUPrimitiveBatcher from "./batchers/primitive_batcher.js";
import WebGPUQuadBatcher from "./batchers/quad_batcher.js";
import WebGPUBatcher from "./batchers/webgpu_batcher.js";
import WebGPUBufferArena from "./buffer/arena.js";
import WebGPUUniformRing from "./buffer/uniformring.js";
import WebGPUPipelineCache, {
	DEPTH_STENCIL_FORMAT,
	normalizeBlendMode,
} from "./pipeline/cache.js";
import OrthogonalTMXLayerGPURenderer from "./renderers/tmxlayer/orthogonal.js";
import { COMPRESSION_FEATURES } from "./texture/compressed.js";
import { WebGPUFrameTexture } from "./texture/frametexture.js";
import WebGPUTextureStore from "./texture/store.js";

// scratch matrix for the affine-components form of transform()
const tempMatrix = new Matrix3d();
// scratch: the projection saved across a blitEffect quad
const blitSavedProjection = new Matrix3d();

/**
 * Resolve the depth half of a pass's load/store ops — split out pure so the
 * single-clear-per-target-per-frame policy is unit-testable without a
 * device. Until the first mesh ever draws, the ops are the original
 * clear/discard pair: the depth half costs pure-2D applications nothing and
 * their passes stay byte-identical. Once the mesh path is active, depth
 * persists across pass restarts (load/store — the GL parity where the depth
 * buffer survives mid-frame stencil clears and captures) and clears only
 * where a clear is armed: frame start, render-target change, or a fresh
 * attachment (whose "load" would read zeros and fail every LEQUAL test).
 * @param {boolean} meshDepthActive - whether drawMesh has ever run
 * @param {boolean} pendingDepthClear - whether a depth clear is armed
 * @returns {{depthLoadOp: string, depthStoreOp: string}} the pass ops
 * @ignore
 * @internal
 */
export function resolveDepthOps(meshDepthActive, pendingDepthClear) {
	if (meshDepthActive !== true) {
		return { depthLoadOp: "clear", depthStoreOp: "discard" };
	}
	return {
		depthLoadOp: pendingDepthClear === true ? "clear" : "load",
		depthStoreOp: "store",
	};
}

/**
 * The **experimental** WebGPU renderer.
 *
 * The asynchronous bootstrap — `getContext("webgpu")` at construction, then
 * adapter/device negotiation and canvas configuration in
 * {@link WebGPURenderer#init} (the reason {@link Application#init} is
 * asynchronous at all) — plus the core 2D frame pipeline: one command
 * encoder and one render pass per frame, opened by {@link
 * WebGPURenderer#clear} and submitted by {@link WebGPURenderer#flush}, with
 * a `depth24plus-stencil8` attachment carried from day one (the stencil
 * half serves masks; the depth half is reserved for the mesh path).
 *
 * It is **opt-in only**: `renderer: video.WEBGPU` (or the `#webgpu` URI
 * fragment). `video.AUTO` never selects it, and will not until it reaches
 * feature parity with the WebGL backend.
 * @augments Renderer
 * @category Rendering
 */
export default class WebGPURenderer extends Renderer {
	/**
	 * @param {ApplicationSettings} options - The renderer parameters
	 */
	constructor(options) {
		// parent constructor — acquires the GPUCanvasContext handle
		// (synchronous; throws when WebGPU is unavailable, which
		// `Application.init()` surfaces as a rejection)
		super(Object.assign(options, { context: "webgpu" }));

		/**
		 * The WebGPU adapter, set once {@link WebGPURenderer#init} resolves.
		 * @type {GPUAdapter|undefined}
		 * @readonly
		 */
		this.adapter = undefined;

		/**
		 * The WebGPU device, set once {@link WebGPURenderer#init} resolves.
		 * @name device
		 * @type {GPUDevice|undefined}
		 * @readonly
		 */
		this.device = undefined;

		/**
		 * The WebGPU canvas context
		 * @name context
		 * @type {GPUCanvasContext}
		 */
		this.context = this.renderTarget.context;

		/**
		 * The preferred canvas texture format reported by the platform,
		 * set once {@link WebGPURenderer#init} resolves.
		 * @type {string|undefined}
		 * @readonly
		 */
		this.preferredFormat = undefined;

		// there is no renderer to draw with until init() resolves
		this.isContextValid = false;

		// set the renderer type
		this.type = "WebGPU";

		// user-supplied shaders for this backend are WGSL. GLSL consumers
		// (ShaderEffect bodies, {vertex, fragment} shader assets) key off
		// this and correctly refuse to hand this backend GLSL source
		/** @type {"glsl"|"wgsl"|null} */
		this.shaderLanguage = "wgsl";

		// capability flags describe what the backend can DO today

		// orthogonal TMX layers draw through the WGSL shader tile path
		this.supportsShaderTileLayers = true;
		// the mesh tier: depth-tested drawing (the depth half of the shared
		// attachment) and retained model-space mesh geometry — Camera3d
		// scenes take the uniforms-only drawMesh(mesh, modelMatrix) path
		this.supportsDepthBuffer = true;
		this.supportsRetainedMesh = true;
		// lazy orientation-specific GPU tilemap renderer (device-scoped:
		// dropped on device loss, rebuilt on first use)
		/** @ignore
		 * @internal */
		this.orthogonalTMXRenderer = undefined;

		// create a texture cache
		this.cache = new TextureCache(this);

		// the model/view matrix lives in the base-owned RenderState — same
		// aliasing as the WebGL backend
		this.currentTransform = this.renderState.currentTransform;

		// active Gradient (setColor(Gradient)) — honored on fillRect via
		// the Canvas-baked gradient texture, and on arbitrary shapes by
		// clipping that baked rect through the stencil (gradientMask)
		/** @ignore
		 * @internal */
		this.currentGradient = null;

		// scratch vertices for fillRect (2 triangles) and fillPolygon
		/** @ignore
		 * @internal */
		this.rectTriangles = Array.from({ length: 6 }, () => {
			return { x: 0, y: 0 };
		});
		/** @ignore
		 * @internal */
		this.polyVerts = [];
		// scratch bounds for the clipRect screen-space AABB derivation
		/** @ignore
		 * @internal */
		this.clipAABB = new Bounds();
		// the stencil reference the masked render phase compares against
		/** @ignore
		 * @internal */
		this.maskVisibleRef = 0;

		/**
		 * the batchers registered with this renderer, by name
		 * @type {Map<string, object>}
		 * @ignore
		 * @internal
		 */
		this.batchers = new Map();

		/**
		 * the currently active batcher
		 * @ignore
		 * @internal
		 */
		this.currentBatcher = null;

		// GPU-facing infrastructure, created by init() once a device exists
		/** @ignore
		 * @internal */
		this.pipelineCache = null;
		/** @ignore
		 * @internal */
		this.vertexArena = null;
		// per-frame index regions for the accumulated mesh path
		/** @ignore
		 * @internal */
		this.indexArena = null;
		/** @ignore
		 * @internal */
		this.uniformRing = null;
		/** @ignore
		 * @internal */
		this.textureStore = null;

		// per-frame recording state
		/** @ignore
		 * @internal */
		this.commandEncoder = null;
		/** @ignore
		 * @internal */
		this.renderPass = null;
		// the active offscreen render target (null = the canvas). Retargeting
		// is a pass break: the next pass opens on the target's color view.
		/** @ignore
		 * @internal */
		this.currentRenderTarget = null;
		// consumed as the next pass's colorLoadOp "clear" (fresh target)
		/** @ignore
		 * @internal */
		this.pendingColorClear = false;
		/** @ignore
		 * @internal */
		this.pendingClearValue = null;
		/** @ignore
		 * @internal */
		this.pendingStencilClear = false;
		// consumed as the next pass's depthLoadOp "clear" once the mesh path
		// is active — armed at frame start, on render-target changes and on
		// depth-attachment recreation (single clear per target per frame,
		// the GL mesh-mode policy)
		/** @ignore
		 * @internal */
		this.pendingDepthClear = false;
		// sticky: flips true on the first drawMesh ever and stays — before
		// that, every pass keeps the original clear/discard depth ops and
		// pure-2D applications see zero change
		/** @ignore
		 * @internal */
		this.meshDepthActive = false;
		// the split-screen camera viewport (top-left origin, canvas passes
		// only) — null = full target. Persists across frames like gl.viewport
		/** @ignore
		 * @internal */
		this.viewportRect = null;
		// one-shot warn: a customShader (ShaderEffect fast path) cannot host
		// a mesh draw on this backend
		/** @ignore
		 * @internal */
		this.meshEffectWarned = false;
		// the canvas GPUTexture handle of the current frame — kept beside its
		// view because captureFrame copies from the TEXTURE, not the view
		/** @ignore
		 * @internal */
		this.frameTexture = null;
		// the shared frame-capture slot (screen_texture builtin), lazy
		/** @ignore
		 * @internal */
		this.captureTexture = undefined;
		// 1×1 transparent stand-in bound where a declared texture has no
		// source yet (never-captured screen_texture, unset setTexture slot)
		/** @ignore
		 * @internal */
		this.stubTexture = null;
		// per-depth projection save slots for nested post-effect passes
		/** @ignore
		 * @internal */
		this.effectProjectionStack = [];
		/** @ignore
		 * @internal */
		this.effectPassDepth = 0;
		// per-bind effect uniform snapshots (created by init)
		/** @ignore
		 * @internal */
		this.effectUniformArena = null;
		// monotonically increasing frame id — the texture store uses it to
		// detect same-frame content changes that need a fresh texture
		/** @ignore
		 * @internal */
		this.frameId = 0;
		// GPUTextures replaced mid-frame: destroying them immediately would
		// invalidate draws already recorded against them (submit rejects the
		// whole command buffer) — they retire at frame end, after submit
		/** @ignore
		 * @internal */
		this.retiredTextures = [];
		// the lineWidth value written into the current frame-globals slot —
		// the primitive batcher compares against THIS (not its own cache)
		// because clear() rewrites the slot every frame
		/** @ignore
		 * @internal */
		this.currentFrameLineWidth = 1;
		/** @ignore
		 * @internal */
		this.frameTextureView = null;
		/** @ignore
		 * @internal */
		this.depthTexture = null;
		// MSAA state (antiAlias: true): canvas passes render into a shared
		// multisampled color texture resolving into the canvas view, with a
		// matching multisampled depth-stencil twin. Offscreen render targets
		// stay single-sampled — GL parity, where only the default
		// framebuffer is ever antialiased and pool FBOs are not.
		/** @ignore
		 * @internal */
		this.canvasSampleCount = 1;
		/** @ignore
		 * @internal */
		this.msaaColorTexture = null;
		/** @ignore
		 * @internal */
		this.msaaColorView = null;
		/** @ignore
		 * @internal */
		this.msaaDepthTexture = null;
		/** @ignore
		 * @internal */
		this.currentPipeline = null;
		/** @ignore
		 * @internal */
		this.currentFrameBinding = null;
		/** @ignore
		 * @internal */
		this.scissorActive = false;
		// premultiplied-alpha flag mirrored from setBlendMode (pipeline key)
		/** @ignore
		 * @internal */
		this.premultipliedAlpha = true;
		// stencil mode consulted by the pipeline lookup: "none"|"write"|"test"
		/** @ignore
		 * @internal */
		this.stencilMode = "none";

		// reset the renderer on game reset (stored so destroy() can
		// unsubscribe — a rejected-then-retried `Application.init()`
		// constructs a fresh renderer per attempt, and the event bus must
		// not pin every abandoned one for the page's lifetime)
		this.onGameReset = () => {
			this.reset();
		};
		on(GAME_RESET, this.onGameReset);

		// keep the depth-stencil attachment sized with the canvas
		this.onCanvasResize = () => {
			if (typeof this.device !== "undefined") {
				this.flush();
				this.createDepthTexture();
			}
			// a stored split-screen viewport was un-flipped against the OLD
			// canvas height — drop it, like the GL resize path's
			// setViewport(0, 0, width, height); cameras re-set theirs next
			// frame
			this.viewportRect = null;
		};
		on(CANVAS_ONRESIZE, this.onCanvasResize);
	}

	/**
	 * Negotiate the GPU adapter and device, configure the canvas context,
	 * and build the GPU-facing infrastructure (pipeline cache, buffer
	 * arenas, depth-stencil attachment). Awaited by {@link Application#init}
	 * right after construction — a WebGPU device cannot be acquired
	 * synchronously, which is what this hook exists for.
	 * @override
	 * @returns {Promise<void>} resolves once the device is configured
	 * @throws {Error} (as a rejection) when WebGPU is unavailable or no
	 * suitable adapter is found
	 */
	async init() {
		// idempotent while the device is live: Application.init()'s AUTO
		// case awaits a full init during backend negotiation, then its
		// common path awaits init again on the winner — a second
		// negotiation would leak the first device. (restoreDevice clears
		// `device` before re-running, so the restore path passes through.)
		if (typeof this.device !== "undefined" && this.isContextValid === true) {
			return;
		}
		const gpu = globalThis.navigator?.gpu;
		if (typeof gpu === "undefined") {
			throw new Error(
				"WebGPU is not available in this environment (no `navigator.gpu`)",
			);
		}

		// WebGPU's GPUPowerPreference enum has no "default" member (the
		// WebGL vocabulary melonJS settings use) — omit the hint entirely
		// unless one of the two valid values was explicitly asked for
		const { powerPreference } = this.settings;
		const adapter = await gpu.requestAdapter(
			powerPreference === "high-performance" || powerPreference === "low-power"
				? { powerPreference }
				: undefined,
		);
		if (adapter === null) {
			throw new Error(
				"WebGPU: no suitable GPUAdapter found (adapter request returned null)",
			);
		}
		// the WebGPU analogue of GL's failIfMajorPerformanceCaveat: a
		// fallback adapter is software rendering — reject it when the app
		// asked for hardware-or-nothing (under AUTO this falls through to
		// the WebGL candidate, which honors the same setting)
		if (
			this.settings.failIfMajorPerformanceCaveat === true &&
			adapter.isFallbackAdapter === true
		) {
			throw new Error(
				"WebGPU: only a fallback (software) adapter is available and failIfMajorPerformanceCaveat is set",
			);
		}
		this.adapter = adapter;

		// request the compressed-texture families the adapter offers, so
		// the loader's dds/ktx/pvr/pkm assets can upload natively
		this.device = await adapter.requestDevice({
			requiredFeatures: COMPRESSION_FEATURES.filter((feature) => {
				return adapter.features.has(feature);
			}),
		});

		// identify the driver in the console header, same as the WebGL
		// backend does through its debug-renderer-info strings. The
		// GPUAdapterInfo fields are heavily redacted for anti-fingerprinting:
		// `description` / `device` are usually empty, and vendor/architecture
		// can repeat one token (Safari on Apple Silicon reports "apple" for
		// both) — prefer the richest non-empty field, dedupe the rest
		const info = adapter.info;
		if (typeof info !== "undefined") {
			this.GPURenderer =
				info.description ||
				info.device ||
				[...new Set([info.vendor, info.architecture].filter(Boolean))].join(
					" ",
				) ||
				undefined;
			// the GL backend's GPUVendor twin (debug-renderer-info UNMASKED_VENDOR)
			this.GPUVendor = info.vendor || undefined;
		}

		// a lost device is this backend's context loss. `device.lost`
		// settles exactly once, including on an explicit `destroy()` —
		// only announce losses the application did not ask for, then
		// attempt a transparent recovery on a fresh device
		void this.device.lost.then((lossInfo) => {
			if (lossInfo.reason !== "destroyed") {
				this.isContextValid = false;
				emit(ONCONTEXT_LOST, this);
				void this.restoreDevice().catch((err) => {
					console.warn("WebGPU device restore failed:", err);
				});
			}
		});

		this.preferredFormat = gpu.getPreferredCanvasFormat();
		this.context.configure({
			device: this.device,
			format: this.preferredFormat,
			alphaMode: this.settings.transparent ? "premultiplied" : "opaque",
			// COPY_SRC on top of the default: captureFrame() copies the
			// canvas texture into the shared capture (screen_texture builtin)
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
		});

		// GPU-facing infrastructure, in dependency order
		this.pipelineCache = new WebGPUPipelineCache(
			this.device,
			this.preferredFormat,
		);
		this.uniformRing = new WebGPUUniformRing(
			this.device,
			this.pipelineCache.frameLayout,
			this.pipelineCache.clearFrameLayout,
		);
		this.vertexArena = new WebGPUBufferArena(this.device, {
			label: "melonJS vertex arena",
		});
		this.effectUniformArena = new WebGPUBufferArena(this.device, {
			label: "melonJS effect uniform arena",
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			pageSize: 64 << 10,
		});
		this.indexArena = new WebGPUBufferArena(this.device, {
			label: "melonJS index arena",
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		});
		this.textureStore = new WebGPUTextureStore(this);
		// antiAlias maps to 4× MSAA on canvas passes (the GL context's
		// antialias flag equivalent); 4× is universally supported for the
		// canvas and depth formats
		this.canvasSampleCount = this.settings.antiAlias === true ? 4 : 1;
		this.pipelineCache.sampleCount = this.canvasSampleCount;
		this.createDepthTexture();

		// register the built-in batchers (device-dependent, so here rather
		// than the constructor — a device-loss restore re-runs this path).
		// A custom batcher override rides the quad/primitive slots exactly
		// like the WebGL renderer's constructor — `addBatcher` rejects a
		// non-WebGPUBatcher class loudly, so a GL-only custom batcher fails
		// with a clear message instead of mid-draw
		if (this.batchers.size === 0) {
			const CustomBatcher = this.settings.batcher || this.settings.compositor;
			this.addBatcher(
				new (CustomBatcher || WebGPUQuadBatcher)(this),
				"quad",
				true,
			);
			this.addBatcher(
				new (CustomBatcher || WebGPUPrimitiveBatcher)(this),
				"primitive",
			);
			if (!CustomBatcher) {
				this.addBatcher(new WebGPULitQuadBatcher(this), "litQuad");
			}
			this.addBatcher(new WebGPUMeshBatcher(this), "mesh");
			this.addBatcher(new WebGPULitMeshBatcher(this), "litMesh");
		}

		// apply the configured blend mode up front (the GL constructor's
		// parity): before the first GAME_RESET, out-of-bracket draws (unit
		// tests, pre-stage drawing) would otherwise run on RenderState's
		// "none" default with blending disabled
		this.setBlendMode(this.settings.blendMode);

		this.isContextValid = true;
	}

	/**
	 * (re)create the shared depth-stencil attachment. Defaults to the canvas
	 * size; `beginPass` passes the active target's size because every
	 * attachment of a pass must have identical dimensions (in the 2D flow
	 * all targets are canvas-sized, so this recreates nothing per frame).
	 * @param {number} [width] - required width (defaults to the canvas)
	 * @param {number} [height] - required height (defaults to the canvas)
	 * @ignore
	 * @internal
	 */
	createDepthTexture(width, height, sampleCount = 1) {
		const canvas = this.getCanvas();
		width = Math.max(1, width ?? canvas.width);
		height = Math.max(1, height ?? canvas.height);
		// single-sampled and multisampled passes each keep their own
		// attachment (a pass's attachments must share one sample count)
		const slot = sampleCount > 1 ? "msaaDepthTexture" : "depthTexture";
		const current = this[slot];
		if (current && current.width === width && current.height === height) {
			return;
		}
		if (current) {
			// recorded passes may reference the old attachment — retire it
			this.retireTexture(current);
		}
		this[slot] = this.device.createTexture({
			label: `melonJS depth-stencil${sampleCount > 1 ? " msaa" : ""}`,
			size: [width, height],
			format: DEPTH_STENCIL_FORMAT,
			sampleCount,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});
		// a fresh attachment read with a "load" op is all zeros — every
		// LEQUAL test would fail — so recreation always arms a depth clear
		this.pendingDepthClear = true;
	}

	/**
	 * (re)create the shared multisampled color texture canvas passes render
	 * into (resolved into the canvas view at every pass end).
	 * @param {number} width - required width in pixels
	 * @param {number} height - required height in pixels
	 * @ignore
	 * @internal
	 */
	createMsaaColorTexture(width, height) {
		const current = this.msaaColorTexture;
		if (current && current.width === width && current.height === height) {
			return;
		}
		if (current) {
			this.retireTexture(current);
		}
		this.msaaColorTexture = this.device.createTexture({
			label: "melonJS msaa color",
			size: [width, height],
			format: this.preferredFormat,
			sampleCount: this.canvasSampleCount,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});
		this.msaaColorView = this.msaaColorTexture.createView();
	}

	/**
	 * Begin the frame: reset the per-frame allocators, acquire the canvas
	 * texture, and open the frame's command encoder and render pass with a
	 * clear load — the WebGPU realization of `gl.clearColor + gl.clear`.
	 * Called by `Application.draw()` at the top of every frame.
	 * @override
	 */
	clear() {
		if (typeof this.device === "undefined") {
			return;
		}
		const canvas = this.getCanvas();
		if (canvas.width === 0 || canvas.height === 0) {
			return;
		}

		// a pass still open here means the previous frame aborted between
		// clear() and flush() (an exception mid-draw) — drop it, un-submitted
		if (this.renderPass !== null) {
			this.abandonFrame();
		}

		this.vertexArena.reset();
		this.indexArena.reset();
		this.uniformRing.reset();
		this.effectUniformArena.reset();
		this.frameId++;
		// a frame always begins on the canvas, outside any effect bracket
		// (an exception that escaped between begin/endPostEffect last frame
		// must not leave the projection stack wound up)
		this.currentRenderTarget = null;
		this.pendingColorClear = false;
		this.effectPassDepth = 0;
		this._renderTargetPool?.reset?.();
		// clear() also resets the stroke line width, like the GL backend
		this.lineWidth = 1;
		this.stencilMode = "none";
		this.maskLevel = 0;

		const [r, g, b, a] = this.backgroundColor.toArray();
		// frame start clears every attachment half, depth included
		this.pendingDepthClear = true;
		this.beginPass({
			colorLoadOp: "clear",
			clearValue: { r, g, b, a },
			stencilLoadOp: "clear",
		});

		// the frame's first frame-globals slot
		this.pushFrameGlobals();

		// a new frame is a new render pass on the active target — same
		// per-frame signal the WebGL backend emits from its clear()
		// the event payload is the RENDERER on every other emitter (both
		// backends), and subscribers filter on `emitter === this.renderer`
		emit(RENDER_TARGET_CHANGED, this);
	}

	/**
	 * open a render pass on the current frame's encoder (creating the
	 * encoder and acquiring the canvas texture on first use this frame)
	 * @param {object} [opts] - load operations for the pass
	 * @ignore
	 * @internal
	 */
	beginPass(opts = {}) {
		if (this.commandEncoder === null) {
			this.commandEncoder = this.device.createCommandEncoder({
				label: "melonJS frame",
			});
		}
		// the pass's color attachment: the active render target's view, or
		// the canvas texture (acquired once per frame)
		let colorView;
		const target = this.currentRenderTarget;
		if (target !== null) {
			colorView = target.colorView;
		} else {
			if (this.frameTextureView === null) {
				this.frameTexture = this.context.getCurrentTexture();
				this.frameTextureView = this.frameTexture.createView();
			}
			colorView = this.frameTextureView;
		}
		// a retarget with a pending clear opens with a clearing load — the
		// WebGPU analogue of clearRenderTarget, no clearing draw needed
		let colorLoadOp = opts.colorLoadOp;
		let clearValue = opts.clearValue;
		let stencilLoadOp = opts.stencilLoadOp;
		if (typeof colorLoadOp === "undefined" && this.pendingColorClear) {
			colorLoadOp = "clear";
			clearValue = this.pendingClearValue ?? { r: 0, g: 0, b: 0, a: 0 };
			if (typeof stencilLoadOp === "undefined" && this.pendingStencilClear) {
				stencilLoadOp = "clear";
			}
		}
		this.pendingColorClear = false;
		this.pendingClearValue = null;
		this.pendingStencilClear = false;
		// every attachment of a pass must have identical dimensions AND one
		// sample count — canvas passes are multisampled when antiAlias is
		// on (resolving into the canvas view), offscreen targets never are
		// (GL parity: only the default framebuffer is antialiased)
		const [width, height] = this.getTargetSize();
		const sampleCount = target === null ? this.canvasSampleCount : 1;
		this.createDepthTexture(width, height, sampleCount);
		// every pipeline recorded into this pass must declare its count —
		// the cache keys on it, so both variants coexist compiled
		this.pipelineCache.sampleCount = sampleCount;
		let colorAttachment;
		if (sampleCount > 1) {
			this.createMsaaColorTexture(width, height);
			colorAttachment = {
				view: this.msaaColorView,
				// resolved into the canvas view at every pass end; samples
				// are stored so mid-frame restarts can load them back
				resolveTarget: colorView,
				loadOp: colorLoadOp ?? "load",
				clearValue,
				storeOp: "store",
			};
		} else {
			colorAttachment = {
				view: colorView,
				loadOp: colorLoadOp ?? "load",
				clearValue,
				storeOp: "store",
			};
		}
		// resolve AFTER createDepthTexture — a recreation arms the clear
		const { depthLoadOp, depthStoreOp } = resolveDepthOps(
			this.meshDepthActive,
			this.pendingDepthClear,
		);
		this.pendingDepthClear = false;
		this.renderPass = this.commandEncoder.beginRenderPass({
			label: "melonJS pass",
			colorAttachments: [colorAttachment],
			depthStencilAttachment: {
				view: (sampleCount > 1
					? this.msaaDepthTexture
					: this.depthTexture
				).createView(),
				depthLoadOp,
				depthClearValue: 1.0,
				depthStoreOp,
				stencilLoadOp: stencilLoadOp ?? "load",
				stencilClearValue: 0,
				stencilStoreOp: "store",
			},
		});
		this.applyViewport();
		this.applyScissor();
		// a new pass resets the stencil reference to 0 — re-apply the mask
		// reference so content masked ACROSS a pass restart (post-effect
		// retargets, captures) keeps testing against the right level
		this.renderPass.setStencilReference(this.maskVisibleRef);
		// pipeline/bind state does not carry across passes
		this.currentPipeline = null;
	}

	/**
	 * pixel dimensions of the active draw destination — the current render
	 * target, or the canvas
	 * @returns {[number, number]} [width, height]
	 * @ignore
	 * @internal
	 */
	getTargetSize() {
		const target = this.currentRenderTarget;
		if (target !== null) {
			return [target.width, target.height];
		}
		const canvas = this.getCanvas();
		return [canvas.width, canvas.height];
	}

	/**
	 * Switch the active draw destination — a pass break under the recording
	 * model: pending vertices drain, the open pass ends, and the next pass
	 * (opened lazily by `ensurePass`) targets the given render target's
	 * color view, or the canvas when `target` is null.
	 * @param {import("../rendertarget/webgpurendertarget.js").default|null} target - the render target, or null for the canvas
	 * @param {object} [options] - retarget options
	 * @param {boolean} [options.clear=false] - open the next pass with a clearing color load
	 * @ignore
	 * @internal
	 */
	setRenderTarget(target, options = {}) {
		this.currentBatcher?.flush();
		if (this.renderPass !== null) {
			this.renderPass.end();
			this.renderPass = null;
		}
		this.currentRenderTarget = target ?? null;
		this.pendingColorClear =
			options.clear === true || (target?.pendingClear ?? false);
		this.pendingClearValue = options.clearValue ?? null;
		this.pendingStencilClear = options.clearStencil === true;
		// a target change re-arms the depth clear in BOTH directions — the
		// GL RENDER_TARGET_CHANGED re-arm: each destination gets one depth
		// clear per frame (the shared attachment holds the other target's
		// depth, which is stale data from this destination's point of view)
		this.pendingDepthClear = true;
		if (target) {
			target.pendingClear = false;
		}
	}

	/**
	 * Dispose of a GPUTexture safely: while a frame is recording, the
	 * texture may be referenced by already-recorded draws — destroying it
	 * would make the whole `queue.submit()` fail validation — so it parks
	 * on the retired list and is destroyed after submit (or abandon).
	 * @param {GPUTexture} texture - the texture to dispose of
	 * @ignore
	 * @internal
	 */
	retireTexture(texture) {
		if (this.commandEncoder !== null) {
			this.retiredTextures.push(texture);
		} else {
			texture.destroy();
		}
	}

	/**
	 * Dispose of a GPUBuffer safely — the buffer twin of
	 * {@link WebGPURenderer#retireTexture}, and the same reasoning: a buffer
	 * referenced by already-recorded draws (retained mesh geometry) must
	 * outlive the frame's submit. GPUBuffer and GPUTexture share the
	 * `destroy()` contract, so retired buffers ride the same list.
	 * @param {GPUBuffer} buffer - the buffer to dispose of
	 * @ignore
	 * @internal
	 */
	retireBuffer(buffer) {
		this.retireTexture(buffer);
	}

	/**
	 * The 1×1 transparent-black stand-in view — bound where a declared
	 * effect texture has no source yet, so bind groups stay valid.
	 * @returns {GPUTextureView} the stub view
	 * @ignore
	 * @internal
	 */
	getStubTextureView() {
		if (this.stubTexture === null) {
			this.stubTexture = this.device.createTexture({
				label: "melonJS stub texture",
				size: [1, 1],
				format: "rgba8unorm",
				usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
			});
			this.device.queue.writeTexture(
				{ texture: this.stubTexture },
				new Uint8Array(4),
				{},
				[1, 1],
			);
			this.stubTextureView = this.stubTexture.createView();
		}
		return this.stubTextureView;
	}

	/**
	 * Restrict rendering to a sub-rectangle of the canvas — the split-screen
	 * camera surface (`Camera2d`/`Camera3d._setupNonDefaultProjection`).
	 * Callers pass GL-convention rects with a BOTTOM-left origin (the flip is
	 * baked into the camera code, which the GL backend depends on); WebGPU
	 * viewports are top-left, so it is un-flipped here. The rect applies to
	 * canvas passes only — offscreen post-effect targets always render full
	 * size, like the GL pool path re-viewporting per target.
	 * @param {number} x - viewport x (pixels)
	 * @param {number} y - viewport y, bottom-left origin (pixels)
	 * @param {number} width - viewport width (pixels)
	 * @param {number} height - viewport height (pixels)
	 * @override
	 */
	setViewport(x, y, width, height) {
		// dynamic pass state applies to draws recorded after the call —
		// vertices queued under the previous viewport must land first
		this.currentBatcher?.flush();
		const canvas = this.getCanvas();
		this.viewportRect = {
			x,
			y: canvas.height - y - height,
			width,
			height,
		};
		this.applyViewport();
	}

	/**
	 * apply the effective viewport to the open pass (re-run on every pass
	 * restart — pass state does not carry across passes)
	 * @ignore
	 * @internal
	 */
	applyViewport() {
		if (this.renderPass === null) {
			return;
		}
		const [targetWidth, targetHeight] = this.getTargetSize();
		let x = 0;
		let y = 0;
		let width = targetWidth;
		let height = targetHeight;
		const rect = this.viewportRect;
		if (rect != null && this.currentRenderTarget === null) {
			// clamp — a viewport extending past the attachment is a WebGPU
			// validation error, not a GL-style silent clip (stale rects
			// survive canvas resizes)
			x = Math.min(Math.max(rect.x, 0), targetWidth);
			y = Math.min(Math.max(rect.y, 0), targetHeight);
			width = Math.min(rect.width, targetWidth - x);
			height = Math.min(rect.height, targetHeight - y);
			if (width <= 0 || height <= 0) {
				x = 0;
				y = 0;
				width = targetWidth;
				height = targetHeight;
			}
		}
		this.renderPass.setViewport(x, y, width, height, 0, 1);
	}

	/**
	 * disable the scissor test — pass-model realization of the GL call
	 * (pending vertices drain, the open pass widens back to the target)
	 * @override
	 */
	disableScissor() {
		if (this.scissorActive === true) {
			this.currentBatcher?.flush();
			this.scissorActive = false;
			this.applyScissor();
		}
	}

	/**
	 * Capture everything drawn so far into the shared frame-capture slot —
	 * the backing of the `screen_texture` effect builtin. A pass break: the
	 * open pass ends, an encoder-ordered `copyTextureToTexture` snapshots
	 * the active destination (render target or canvas), and drawing resumes
	 * lazily with a preserving load. The capture is copy-only (never a
	 * render attachment), so the very next pass can sample it hazard-free.
	 * @returns {import("./texture/frametexture.js").WebGPUFrameTexture|null} the shared capture, or null when no device
	 * @ignore
	 * @internal
	 */
	captureFrame() {
		return this.toFrameTexture();
	}

	/**
	 * Capture the current frame — everything drawn to the active target so
	 * far — into a {@link Texture2d}, entirely on the GPU (an encoder-ordered
	 * `copyTextureToTexture`; no readback round-trip). Same contract as the
	 * WebGL backend's `toFrameTexture`: a shared, renderer-owned slot by
	 * default, `target: null` for a fresh caller-owned capture, or a prior
	 * capture as `target` to refresh it in place; `options.region` captures
	 * a sub-region (framebuffer pixels, bottom-left origin — converted to
	 * this backend's top-left copy origin internally).
	 *
	 * Two documented divergences from the GL capture:
	 * - alpha is preserved (the GL path captures into an opaque RGB texture)
	 * - row 0 of the capture is the TOP of the frame (matching `screen_uv`),
	 *   where the GL capture is bottom-up — GLSL bodies sampling a capture
	 *   flip with `1.0 - uv.y`; their WGSL twins must not.
	 * @param {object} [options]
	 * @param {Texture2d|null} [options.target] - omit for the shared renderer
	 *   slot; a prior capture to refresh it in place; `null` to mint a fresh,
	 *   caller-owned capture (`destroy()` it yourself when done)
	 * @param {Bounds|{x: number, y: number, width: number, height: number}} [options.region] - capture
	 *   only this sub-region; defaults to the whole frame
	 * @returns {Texture2d|null} a GPU-resident texture holding the captured
	 *   frame, or null when no device is available
	 */
	toFrameTexture(options = {}) {
		if (typeof this.device === "undefined") {
			return null;
		}

		const [fullWidth, fullHeight] = this.getTargetSize();

		// resolve the capture rect (same clamp rules as the GL backend:
		// origin clamped into the frame first, then sized to what remains)
		let x = 0;
		let y = 0;
		let w = fullWidth;
		let h = fullHeight;
		const region = options.region;
		if (typeof region !== "undefined") {
			x = Math.min(Math.max(0, Math.floor(region.x || 0)), fullWidth - 1);
			y = Math.min(Math.max(0, Math.floor(region.y || 0)), fullHeight - 1);
			const rw = Number.isFinite(region.width)
				? Math.ceil(region.width)
				: fullWidth - x;
			const rh = Number.isFinite(region.height)
				? Math.ceil(region.height)
				: fullHeight - y;
			w = Math.max(1, Math.min(fullWidth - x, rw));
			h = Math.max(1, Math.min(fullHeight - y, rh));
		}

		// a non-null target must be a capture THIS renderer returned — any
		// other Texture2d has no GPU backing here, and a foreign capture
		// would retire textures on the wrong device
		if (typeof options.target !== "undefined" && options.target !== null) {
			if (!(options.target instanceof WebGPUFrameTexture)) {
				throw new Error(
					"WebGPURenderer.toFrameTexture: `target` must be a capture returned by this method",
				);
			}
			if (options.target.renderer !== this) {
				throw new Error(
					"WebGPURenderer.toFrameTexture: `target` belongs to a different renderer",
				);
			}
		}

		// drain pending geometry + end the pass: the copy is encoder-ordered,
		// so it sees exactly the draws recorded before this point
		this.currentBatcher?.flush();
		if (this.renderPass !== null) {
			this.renderPass.end();
			this.renderPass = null;
		}

		// resolve the source texture: the active target, or the canvas
		// (acquired now if nothing drew yet this frame)
		let source;
		if (this.currentRenderTarget !== null) {
			source = this.currentRenderTarget.texture;
		} else {
			if (this.frameTexture === null) {
				this.frameTexture = this.context.getCurrentTexture();
				this.frameTextureView = this.frameTexture.createView();
			}
			source = this.frameTexture;
		}

		// destination: the shared slot, a fresh caller-owned capture, or the
		// given capture refreshed in place
		const shared = typeof options.target === "undefined";
		let frame = shared
			? this.captureTexture
			: options.target === null
				? undefined
				: options.target;

		if (typeof frame === "undefined") {
			frame = new WebGPUFrameTexture(this, w, h);
			if (shared) {
				this.captureTexture = frame;
			}
		} else if (
			frame.width !== w ||
			frame.height !== h ||
			frame.gpuTexture === null
		) {
			// size change or released backing: reallocate keeping the object
			// identity — generation advances so stale bind groups re-key
			frame.realloc(w, h);
		}

		if (this.commandEncoder === null) {
			this.commandEncoder = this.device.createCommandEncoder({
				label: "melonJS frame",
			});
		}
		// convert the public bottom-left region origin to the copy's
		// top-left one
		this.commandEncoder.copyTextureToTexture(
			{ texture: source, origin: [x, fullHeight - y - h] },
			{ texture: frame.gpuTexture },
			[w, h],
		);
		return frame;
	}

	/**
	 * Begin a post-effect pass for the given renderable — the WebGPU
	 * realization of the WebGL FBO path: the renderable's whole content
	 * renders into a pooled offscreen target, composited by
	 * {@link WebGPURenderer#endPostEffect}. The single-effect fast path
	 * (customShader, no offscreen target) mirrors the WebGL split.
	 * @param {Renderable} renderable - the renderable carrying postEffects
	 * @returns {boolean} true when an offscreen pass began
	 * @override
	 * @ignore
	 * @internal
	 */
	beginPostEffect(renderable) {
		const effects = renderable.postEffects.filter((fx) => {
			return fx.enabled !== false;
		});
		if (effects.length === 0) {
			this.customShader = undefined;
			return false;
		}
		// single effect on a non-managed renderable: fast path (no target)
		if (effects.length === 1 && !renderable._postEffectManaged) {
			this.customShader = effects[0];
			return false;
		}

		// pooled path: children render with the default pipeline
		this.customShader = undefined;

		const isCamera = renderable._postEffectManaged;
		const canvas = this.getCanvas();

		this.save();
		// save the current projection (not part of the render state stack) —
		// one preallocated slot per nesting depth
		let savedProjection = this.effectProjectionStack[this.effectPassDepth];
		if (typeof savedProjection === "undefined") {
			savedProjection = this.effectProjectionStack[this.effectPassDepth] =
				new Matrix3d();
		}
		savedProjection.copy(this.projectionMatrix);
		this.effectPassDepth++;

		this._renderTargetPool ??= new RenderTargetPool((w, h) => {
			return new WebGPURenderTarget(this, w, h);
		});
		const rt = this._renderTargetPool.begin(
			isCamera,
			effects.length,
			canvas.width,
			canvas.height,
		);
		// retarget with the appropriate clear: a camera's offscreen pass
		// starts like a frame (background color + fresh stencil), a
		// sprite's starts transparent so unpainted texels stay see-through
		if (isCamera) {
			const [r, g, b, a] = this.backgroundColor.toArray();
			this.setRenderTarget(rt, {
				clear: true,
				clearValue: { r, g, b, a },
				clearStencil: true,
			});
		} else {
			this.setRenderTarget(rt, { clear: true });
		}
		this.disableScissor();
		this.setGlobalAlpha(1.0);
		this.setBlendMode("normal");
		return true;
	}

	/**
	 * End a post-effect pass: retarget to the parent (or the canvas),
	 * refresh the shared frame capture for `screen_texture` consumers, and
	 * composite the offscreen content through the effect chain — one blit
	 * per effect, ping-ponging between pool targets for chains.
	 * @param {Renderable} renderable - the renderable passed to beginPostEffect
	 * @override
	 * @ignore
	 * @internal
	 */
	endPostEffect(renderable) {
		const effects = renderable.postEffects.filter((fx) => {
			return fx.enabled !== false;
		});
		if (effects.length === 0) {
			return;
		}
		// the fast path set customShader — nothing offscreen to composite
		if (effects.length === 1 && !renderable._postEffectManaged) {
			return;
		}

		const isCamera = renderable._postEffectManaged;
		const pool = this._renderTargetPool;
		const rt1 = pool.getCaptureTarget();
		const rt2 = pool.getPingPongTarget();
		const keepBlend = !isCamera;
		const canvas = this.getCanvas();
		const w = canvas.width;
		const h = canvas.height;

		// `screen_texture` builtin: for a CAMERA the "screen" is the scene
		// itself — capture the still-active offscreen target; for a sprite
		// chain it's everything behind it — captured after the retarget
		const needsScreenTexture = effects.some((fx) => {
			return fx._screenTextureUniforms?.length > 0;
		});
		if (needsScreenTexture && isCamera) {
			this.captureFrame();
		}

		const parentRT = pool.end();

		// clip the composite to the camera viewport for non-default cameras
		// (the offscreen content sits at the camera's screen position)
		if (isCamera && renderable.isDefault === false) {
			this.clipRect(
				renderable.screenX,
				renderable.screenY,
				renderable.width,
				renderable.height,
			);
		}

		this.setRenderTarget(parentRT);
		emit(RENDER_TARGET_CHANGED, this);

		if (needsScreenTexture && !isCamera) {
			this.captureFrame();
		}

		if (effects.length === 1) {
			this.blitEffect(rt1, 0, 0, w, h, effects[0], keepBlend);
		} else {
			// multi-pass: ping-pong between the two pool targets
			let src = rt1;
			let dst = rt2;
			for (let i = 0; i < effects.length - 1; i++) {
				this.setRenderTarget(dst, { clear: true });
				this.blitEffect(src, 0, 0, w, h, effects[i], false);
				const tmp = src;
				src = dst;
				dst = tmp;
			}
			this.setRenderTarget(parentRT);
			this.blitEffect(src, 0, 0, w, h, effects[effects.length - 1], keepBlend);
		}

		if (isCamera && renderable.isDefault === false) {
			this.disableScissor();
		}

		// restore renderer state and the projection saved in beginPostEffect
		this.restore();
		this.effectPassDepth--;
		this.projectionMatrix.copy(
			this.effectProjectionStack[this.effectPassDepth],
		);
		this.pushFrameGlobals();
	}

	/**
	 * Draw a pooled render target through an effect's pipeline as a
	 * screen-space quad — the compositing primitive of the post-effect
	 * chain. Blending is disabled for camera blits (the target is fully
	 * composited) and kept for per-sprite blits (transparent texels must
	 * not overwrite the scene).
	 * @param {import("../rendertarget/webgpurendertarget.js").default} source - the target to sample
	 * @param {number} x - destination x
	 * @param {number} y - destination y
	 * @param {number} width - destination width
	 * @param {number} height - destination height
	 * @param {ShaderEffect} effect - the effect to composite with
	 * @param {boolean} [keepBlend=false] - keep the current blend mode
	 * @override
	 */
	blitEffect(source, x, y, width, height, effect, keepBlend = false) {
		const batcher = this.setBatcher("quad");
		// screen-space ortho for the blit quad (not the camera's world
		// projection); restored — with a fresh frame-globals slot each way —
		// right after
		blitSavedProjection.copy(this.projectionMatrix);
		this.projectionMatrix.ortho(0, width, height, 0, -1, 1);
		this.pushFrameGlobals();
		batcher.blitTexture(source, x, y, width, height, effect, keepBlend);
		this.projectionMatrix.copy(blitSavedProjection);
		this.pushFrameGlobals();
	}

	/**
	 * a draw is about to be recorded outside the clear()/flush() bracket
	 * (unit tests, user code) — open a pass that preserves the canvas.
	 * Also the pass-restart primitive: masks break the pass to clear the
	 * stencil, post effects will break it to retarget.
	 * @ignore
	 * @internal
	 */
	ensurePass() {
		if (this.renderPass === null) {
			this.beginPass();
			// out-of-bracket draws can predate the first clear() of the
			// renderer's life — make sure a frame-globals slot exists
			if (this.currentFrameBinding === null && this.uniformRing !== null) {
				this.pushFrameGlobals();
			}
		}
		return this.renderPass;
	}

	/**
	 * end the open pass and submit the frame's command buffer
	 * @override
	 */
	flush() {
		this.currentBatcher?.flush();
		if (this.renderPass !== null) {
			this.renderPass.end();
			this.renderPass = null;
		}
		if (this.commandEncoder !== null) {
			this.device.queue.submit([this.commandEncoder.finish()]);
			this.commandEncoder = null;
			this.frameTextureView = null;
			this.frameTexture = null;
		}
		this.destroyRetiredTextures();
	}

	/**
	 * drop the open pass and encoder without submitting (mid-frame
	 * exception recovery, reset, destroy)
	 * @ignore
	 * @internal
	 */
	abandonFrame() {
		if (this.renderPass !== null) {
			this.renderPass.end();
			this.renderPass = null;
		}
		// an encoder cannot be discarded explicitly — finish it and drop
		// the command buffer unsubmitted
		if (this.commandEncoder !== null) {
			this.commandEncoder.finish();
			this.commandEncoder = null;
		}
		this.frameTextureView = null;
		this.frameTexture = null;
		// an abandoned frame may have died inside a post-effect bracket —
		// never leave an offscreen target active for the next frame
		this.currentRenderTarget = null;
		this.pendingColorClear = false;
		this.pendingDepthClear = false;
		this.currentPipeline = null;
		// the recorded draws are dropped with the command buffer, so any
		// texture retired during the frame can go now
		this.destroyRetiredTextures();
	}

	/**
	 * destroy GPUTextures replaced mid-frame, now that the command buffer
	 * referencing them has been submitted (or abandoned)
	 * @ignore
	 * @internal
	 */
	destroyRetiredTextures() {
		if (this.retiredTextures.length > 0) {
			for (const texture of this.retiredTextures) {
				texture.destroy();
			}
			this.retiredTextures.length = 0;
		}
	}

	/**
	 * re-apply the current scissor state to the open pass
	 * @ignore
	 * @internal
	 */
	applyScissor() {
		if (this.renderPass === null) {
			return;
		}
		const [width, height] = this.getTargetSize();
		if (this.scissorActive === true) {
			// clamp defensively: an out-of-attachment scissor is a WebGPU
			// validation error that invalidates the whole pass (GL clamps)
			const s = this.currentScissor;
			const x = Math.min(Math.max(s[0], 0), width);
			const y = Math.min(Math.max(s[1], 0), height);
			const w = Math.min(Math.max(s[2], 0), width - x);
			const h = Math.min(Math.max(s[3], 0), height - y);
			this.renderPass.setScissorRect(x, y, w, h);
		} else {
			this.renderPass.setScissorRect(0, 0, width, height);
		}
	}

	/**
	 * Clear the current clip region with the given color — a full-viewport
	 * triangle clipped by the active scissor, drawn with blending replaced
	 * (WebGPU has no scissored clear operation). Used mid-frame by
	 * ColorLayer and Container backgrounds.
	 *
	 * Deliberate divergence from the GL backend: because this is a draw,
	 * it honors an active stencil mask (GL's `gl.clear` ignores stencil and
	 * clears the whole scissor region) — under a mask, the clear fills the
	 * mask window only, which is the behavior masks actually promise.
	 * @param {Color|string} [color="#000000"] - css color
	 * @param {boolean} [opaque=false] - allow transparency or not
	 * @override
	 */
	clearColor(color = "#000000", opaque = false) {
		if (typeof this.device === "undefined") {
			return;
		}
		// pending vertices belong before the clear
		this.currentBatcher?.flush();
		const pass = this.ensurePass();

		let rgba;
		if (color instanceof Color) {
			rgba = color.toArray();
		} else {
			const _color = colorPool.get();
			rgba = _color.parseCSS(color).toArray();
			colorPool.release(_color);
		}
		const slot = this.uniformRing.pushClearColor(
			rgba[0],
			rgba[1],
			rgba[2],
			opaque === true ? 1.0 : rgba[3],
		);
		const pipeline = this.pipelineCache.get(
			"clear",
			"triangle-list",
			"none",
			true,
			// the clear respects the mask like any other draw
			this.stencilMode === "test" ? "test" : "none",
		);
		pass.setPipeline(pipeline);
		pass.setBindGroup(0, slot.bindGroup, [slot.dynamicOffset]);
		pass.draw(3);
		// the clear draw invalidated the tracked pipeline/bindings
		this.currentPipeline = null;
	}

	/**
	 * Erase the pixels in the given rectangular area by setting them to
	 * transparent black (rgba(0,0,0,0)).
	 * @param {number} x - x axis of the coordinate for the rectangle starting point.
	 * @param {number} y - y axis of the coordinate for the rectangle starting point.
	 * @param {number} width - The rectangle's width.
	 * @param {number} height - The rectangle's height.
	 * @override
	 */
	clearRect(x, y, width, height) {
		this.save();
		this.clipRect(x, y, width, height);
		// actual transparent black — the bare clearColor() default
		// ("#000000") parses with alpha 1 and would paint OPAQUE black
		this.clearColor("rgba(0,0,0,0)");
		this.restore();
	}

	/**
	 * Draw a TMX tile layer: WGSL-eligible layers (`renderMode ===
	 * "shader"`) draw through the GPU tile path — one quad per tileset,
	 * GID lookup in a per-layer index texture; everything else falls
	 * through to the base per-tile loop.
	 * @param {object} layer - the TMXLayer to draw
	 * @param {object} rect - the visible region in world coords
	 * @override
	 */
	drawTileLayer(layer, rect) {
		if (layer.renderMode === "shader" && layer.orientation === "orthogonal") {
			// device-scoped, lazily (re)built: a device loss rebuilds the
			// pipeline cache, detected via the epoch stamp
			if (
				this.orthogonalTMXRenderer === undefined ||
				this.orthogonalTMXRenderer.epoch !== this.pipelineCache.epoch
			) {
				this.orthogonalTMXRenderer = new OrthogonalTMXLayerGPURenderer(this);
			}
			this.orthogonalTMXRenderer.draw(layer, rect);
			return;
		}
		super.drawTileLayer(layer, rect);
	}

	/**
	 * Add a batcher to this renderer.
	 * @param {WebGPUBatcher} batcher - a batcher instance
	 * @param {string} [name="default"] - the batcher name
	 * @param {boolean} [activate=false] - true to set this batcher as the active one
	 */
	addBatcher(batcher, name = "default", activate = false) {
		// gate on the BACKEND base, not the neutral one: a neutral or
		// WebGL batcher has none of the pass/pipeline machinery and
		// would fail mid-activation instead
		if (!(batcher instanceof WebGPUBatcher)) {
			throw new Error(
				"addBatcher: batcher must be a WebGPUBatcher subclass (custom WebGPU batchers extend WebGPUBatcher)",
			);
		}
		if (typeof this.batchers.get(name) !== "undefined") {
			throw new Error("Invalid Batcher name");
		}
		this.batchers.set(name, batcher);
		if (activate === true) {
			this.setBatcher(name);
		}
	}

	/**
	 * Set the active batcher for this renderer — flush + unbind the
	 * outgoing one, bind the incoming. Unlike the GL backend there is no
	 * projection re-sync: the projection lives in the shared frame-globals
	 * bind group, not in per-program uniforms.
	 * @param {string} [name="default"] - a batcher name
	 * @returns {WebGPUBatcher} the now-active batcher
	 */
	setBatcher(name = "default") {
		const batcher = this.batchers.get(name);
		if (typeof batcher === "undefined") {
			throw new Error("Invalid Batcher");
		}
		if (this.currentBatcher !== batcher) {
			if (this.currentBatcher !== null) {
				this.currentBatcher.flush();
				this.currentBatcher.unbind();
			}
			this.currentBatcher = batcher;
			this.currentBatcher.bind();
		}
		return this.currentBatcher;
	}

	/**
	 * Draw a textured triangle mesh — the mesh-path contract of the base
	 * renderer, on this backend's pipeline-state model. Unlike GL there is
	 * no device state to toggle: depth testing (write + LEQUAL) and the
	 * per-mesh face culling are axes of the pipeline the mesh batcher
	 * looks up per flush, and the once-per-target depth clear is the
	 * pass's `depthLoadOp` (armed by `clear()`/`setRenderTarget`).
	 * @param {object} mesh - a Mesh object with vertices, uvs, indices, and texture properties
	 * @param {Matrix3d} [modelMatrix] - the mesh's model matrix. When given,
	 *   the mesh is drawn from persistent model-space geometry and placed
	 *   entirely by uniforms; when omitted, its vertices are taken as
	 *   already positioned and accumulated through the batcher (the
	 *   2D-camera path).
	 * @override
	 */
	drawMesh(mesh, modelMatrix) {
		const retained = modelMatrix !== undefined;

		if (this.meshDepthActive !== true) {
			// the depth half of the attachment is live from here on — pass
			// restarts preserve it and clears follow the armed policy (see
			// resolveDepthOps). The pass open RIGHT NOW was begun with the
			// pre-mesh discard ops, so arm a clear as well: a mid-frame
			// restart on this activation frame (mask, capture) must CLEAR
			// rather than "load" the discarded — undefined — contents.
			// Costs one extra depth clear on this frame only.
			this.meshDepthActive = true;
			this.pendingDepthClear = true;
		}

		// a hosted custom shader (mesh.shader): a GLShader carrying a WGSL
		// module (isWebGPU) is a complete mesh-contract program — route it
		// to the batcher, which realizes it as its own shader family.
		// Anything else in the slot cannot host a mesh here — a ShaderEffect
		// (WGSL effect realizations are bound to the frozen quad vertex
		// layout) or a GLSL-only shader — so draw the mesh with the built-in
		// shading rather than dropping it, and say so once.
		const customShader =
			this.customShader != null && this.customShader.isWebGPU === true
				? this.customShader
				: null;
		if (
			this.customShader != null &&
			customShader === null &&
			this.meshEffectWarned !== true
		) {
			this.meshEffectWarned = true;
			console.warn(
				"melonJS: this custom shader cannot be hosted on a Mesh by the WebGPU renderer (it carries no `wgsl` module) — the mesh draws with the built-in shading",
			);
		}

		const batcher = this.setBatcher(
			mesh.lit === true && this.batchers.has("litMesh") ? "litMesh" : "mesh",
		);
		batcher.customShader = customShader;

		// per-mesh culling is a pipeline axis here. Retained geometry keeps
		// its authored winding, so the axis bridge's reflection (which
		// mirrors handedness) is undone by flipping which orientation counts
		// as front-facing; right-handed meshes are bridged by a rotation,
		// which preserves winding. Winding is irrelevant with culling off —
		// "ccw" there keeps the pipeline permutation count down.
		const culling = mesh.cullBackFaces === true;
		const state = batcher.meshState;
		state.cullMode = culling ? "back" : "none";
		state.frontFace =
			culling && retained && mesh.rightHanded !== true ? "cw" : "ccw";

		// finally: the hosted module is per-mesh state — a throw mid-draw
		// (e.g. an unsupported-format texture upload) must not leak it into
		// a later mesh (or the frame-end drain) that didn't ask for it
		try {
			const tint = this.currentTint.toUint32(this.getGlobalAlpha());
			if (retained) {
				batcher.drawRetainedMesh(mesh, modelMatrix, tint);
			} else {
				batcher.addMesh(mesh, tint);
				// drain the batcher only — renderer.flush() submits the frame
				batcher.flush();
			}
		} finally {
			batcher.customShader = null;
		}
	}

	/**
	 * Release any retained geometry held for the given mesh (called from
	 * `Mesh.onDeactivateEvent` / `Mesh.destroy`).
	 * @param {object} mesh - the mesh whose GPU geometry should be freed
	 */
	deleteMeshGeometry(mesh) {
		this.batchers.forEach((batcher) => {
			batcher.releaseRetained?.(mesh);
		});
	}

	/**
	 * Reset the transform to identity
	 */
	resetTransform() {
		this.currentTransform.identity();
	}

	/**
	 * adds a translation transformation to the current matrix
	 * @param {number} x - distance to move in the horizontal direction
	 * @param {number} y - distance to move in the vertical direction
	 */
	translate(x, y) {
		this.currentTransform.translate(x, y);
		if (this.settings.subPixel === false) {
			// snap position values to pixel grid
			const a = this.currentTransform.val;
			a[12] |= 0;
			a[13] |= 0;
		}
	}

	/**
	 * adds a rotation to the transformation matrix
	 * @param {number} angle - the rotation angle, clockwise in radians
	 */
	rotate(angle) {
		this.currentTransform.rotate(angle);
	}

	/**
	 * adds a scaling transformation to the renderer units
	 * @param {number} x - horizontal scaling factor
	 * @param {number} y - vertical scaling factor
	 */
	scale(x, y) {
		this.currentTransform.scale(x, y, 1);
	}

	/**
	 * Multiply the given matrix (or 2D affine components) into the current
	 * transformation matrix
	 * @param {Matrix2d|Matrix3d|number} a - a matrix, or the a component
	 * @param {number} [b] - the b component
	 * @param {number} [c] - the c component
	 * @param {number} [d] - the d component
	 * @param {number} [e] - the e component
	 * @param {number} [f] - the f component
	 */
	transform(a, b, c, d, e, f) {
		if (typeof a === "object") {
			// accepts both Matrix2d and Matrix3d (no temporary copy needed)
			this.currentTransform.multiply(a);
		} else {
			// individual 2D affine components
			this.currentTransform.multiply(
				tempMatrix.setTransform(a, b, 0, 0, c, d, 0, 0, 0, 0, 1, 0, e, f, 0, 1),
			);
		}
		if (this.settings.subPixel === false) {
			// snap position values to pixel grid
			const m = this.currentTransform.val;
			m[12] |= 0;
			m[13] |= 0;
		}
	}

	/**
	 * Reset then multiply the transformation matrix
	 * @param {Matrix2d|Matrix3d|number} a - a matrix, or the a component
	 * @param {number} [b] - the b component
	 * @param {number} [c] - the c component
	 * @param {number} [d] - the d component
	 * @param {number} [e] - the e component
	 * @param {number} [f] - the f component
	 */
	setTransform(a, b, c, d, e, f) {
		this.resetTransform();
		this.transform(a, b, c, d, e, f);
	}

	/**
	 * saves the entire state of the renderer onto the state stack
	 */
	save() {
		this.renderState.currentShader = this.customShader;
		this.renderState.save(this.scissorActive === true);
	}

	/**
	 * restores the most recently saved renderer state
	 */
	restore() {
		const canvas = this.getCanvas();
		// Peek at the to-be-restored scissor so vertices queued inside a
		// tighter clip drain under the CURRENT scissor before it widens —
		// otherwise they would flush later and visually escape their clip.
		const peek = this.renderState.peekScissor();
		const cur = this.currentScissor;
		const curActive = this.scissorActive === true;
		const willBeActive = peek !== null;
		const scissorChanging =
			curActive !== willBeActive ||
			(willBeActive &&
				(cur[0] !== peek[0] ||
					cur[1] !== peek[1] ||
					cur[2] !== peek[2] ||
					cur[3] !== peek[3]));
		if (scissorChanging) {
			this.currentBatcher?.flush();
		}
		const result = this.renderState.restore(canvas.width, canvas.height);
		if (result !== null) {
			this.setBlendMode(result.blendMode);
			if (scissorChanging) {
				this.scissorActive = result.scissorActive === true;
				this.applyScissor();
			}
		}
		// sync gradient and shader from renderState
		this.currentGradient = this.renderState.currentGradient;
		this.customShader = this.renderState.currentShader;
	}

	/**
	 * Multiply the global alpha
	 * @param {number} alpha - global alpha value (0..1)
	 */
	setGlobalAlpha(alpha) {
		this.currentColor.alpha = alpha;
	}

	/**
	 * Return the global alpha
	 * @returns {number} global alpha value
	 */
	getGlobalAlpha() {
		return this.currentColor.alpha;
	}

	/**
	 * Set the current fill & stroke style color
	 * @param {Color|string|Gradient} color - css color string or a Gradient object
	 */
	setColor(color) {
		if (color instanceof Gradient) {
			this.renderState.currentGradient = color;
			this.currentGradient = color;
		} else {
			this.renderState.currentGradient = null;
			this.currentGradient = null;
			const alpha = this.currentColor.alpha;
			this.currentColor.copy(color);
			this.currentColor.alpha *= alpha;
		}
	}

	/**
	 * Set the blend mode for subsequent draws. Under WebGPU blending is
	 * pipeline state: the change is recorded (after draining vertices
	 * queued under the previous mode) and the next batcher flush picks the
	 * matching pipeline variant.
	 * @param {string} [mode="normal"] - blend mode ("normal", "multiply", "additive"/"lighter", "screen", "darken", "lighten", "none")
	 * @param {boolean} [premultipliedAlpha=true] - whether textures use premultiplied alpha (affects the source blend factor)
	 * @returns {string} the blend mode actually applied
	 */
	setBlendMode(mode = "normal", premultipliedAlpha = true) {
		const normalized = normalizeBlendMode(mode);
		if (
			this.currentBlendMode !== normalized ||
			this.premultipliedAlpha !== premultipliedAlpha
		) {
			this.currentBatcher?.flush();
			this.currentBlendMode = normalized;
			this.premultipliedAlpha = premultipliedAlpha;
		}
		return this.currentBlendMode;
	}

	/**
	 * Set the projection matrix — pushes a fresh frame-globals slot so
	 * draws already recorded keep the projection they were queued under
	 * (floating containers swap the projection mid-frame).
	 * @param {Matrix3d} matrix - the new projection matrix
	 */
	setProjection(matrix) {
		this.currentBatcher?.flush();
		super.setProjection(matrix);
		// a slot is pushed even when no pass is open (slots are plain
		// buffer writes; the binding is consumed by the next flush) so the
		// projection is never stale after an explicit mid-frame flush()
		if (this.uniformRing !== null) {
			this.pushFrameGlobals();
		}
	}

	/**
	 * push a fresh frame-globals slot (projection + lineWidth); records the
	 * lineWidth written so batchers can detect when the slot goes stale
	 * @ignore
	 * @internal
	 */
	pushFrameGlobals() {
		this.currentFrameBinding = this.uniformRing.pushFrameGlobals(
			this.projectionMatrix,
			this.lineWidth,
		);
		this.currentFrameLineWidth = this.lineWidth;
	}

	/**
	 * Draw an image onto the frame (Canvas-compatible 3/5/9-argument forms).
	 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|ImageBitmap|OffscreenCanvas|VideoFrame} image - the source image
	 * @param {number} sx - source x (or destination x in the 3/5-arg forms)
	 * @param {number} sy - source y (or destination y in the 3/5-arg forms)
	 * @param {number} [sw] - source width
	 * @param {number} [sh] - source height
	 * @param {number} [dx] - destination x
	 * @param {number} [dy] - destination y
	 * @param {number} [dw] - destination width
	 * @param {number} [dh] - destination height
	 */
	drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
		if (typeof sw === "undefined") {
			sw = dw = image.width;
			sh = dh = image.height;
			dx = sx;
			dy = sy;
			sx = 0;
			sy = 0;
		} else if (typeof dx === "undefined") {
			dx = sx;
			dy = sy;
			dw = sw;
			dh = sh;
			sw = image.width;
			sh = image.height;
			sx = 0;
			sy = 0;
		}

		if (this.settings.subPixel === false) {
			// clamp to pixel grid
			dx |= 0;
			dy |= 0;
		}

		// same lit gate as the GL backend: only normal-mapped sprites in a
		// lit scene pay the lit path; everything else stays on "quad".
		// Two extra conditions this backend needs:
		// - an active customShader (the single-effect fast path) wins over
		//   the lit gate — the lit pipeline has no effect stage, so routing
		//   the quad there would silently drop the effect. A deliberate
		//   divergence from GL (which runs the effect's shader over its lit
		//   vertex stream): here the sprite draws effected-but-unlit rather
		//   than lit-but-uneffected, and never silently loses the effect.
		// - the light block must have been snapshotted THIS frame: the lit
		//   batcher's binding points into the per-frame effect-uniform arena,
		//   so a stale (previous-frame) binding would sample reused bytes.
		const lit = this.batchers.get("litQuad");
		const useLit =
			typeof lit !== "undefined" &&
			this.customShader == null &&
			this.activeLightCount > 0 &&
			this.currentNormalMap !== null &&
			lit.hasCurrentLightBinding(this.frameId);
		this.setBatcher(useLit ? "litQuad" : "quad");

		const texture = this.cache.get(image);
		// Video sources need their GPU texture refreshed as the video
		// plays — same duck-typed version-stamp convention as the WebGL
		// backend: re-upload only when a new frame was actually presented,
		// or every draw when no stamp is available.
		let reupload = false;
		if (typeof image.videoWidth !== "undefined") {
			if (image.version === undefined) {
				reupload = true;
			} else if (texture._videoFrameVersion !== image.version) {
				texture._videoFrameVersion = image.version;
				reupload = true;
			}
		}
		const uvs = texture.getUVs(sx, sy, sw, sh);
		this.currentBatcher.addQuad(
			texture,
			dx,
			dy,
			dw,
			dh,
			uvs[0],
			uvs[1],
			uvs[2],
			uvs[3],
			this.currentTint.toUint32(this.getGlobalAlpha()),
			reupload,
			useLit ? this.currentNormalMap : undefined,
		);
	}

	/**
	 * The compressed-texture families this device supports, in the same
	 * shape as the GL backend (one key per family; supported families hold
	 * an object of WebGL format constants — the values the loader parsers
	 * emit — unsupported ones are null, so the shared
	 * hasSupportedCompressedFormats works unchanged). PVRTC has no WebGPU
	 * equivalent and stays null.
	 * @returns {object} one key per extension family
	 * @override
	 */
	getSupportedCompressedTextureFormats() {
		if (typeof this.supportedCompressedFormats === "undefined") {
			const features = this.device?.features;
			const bc = features?.has("texture-compression-bc") === true;
			const etc2 = features?.has("texture-compression-etc2") === true;
			const astc = features?.has("texture-compression-astc") === true;
			const table = {
				astc: astc
					? {
							COMPRESSED_RGBA_ASTC_4x4_KHR: 0x93b0,
							COMPRESSED_RGBA_ASTC_5x4_KHR: 0x93b1,
							COMPRESSED_RGBA_ASTC_5x5_KHR: 0x93b2,
							COMPRESSED_RGBA_ASTC_6x5_KHR: 0x93b3,
							COMPRESSED_RGBA_ASTC_6x6_KHR: 0x93b4,
							COMPRESSED_RGBA_ASTC_8x5_KHR: 0x93b5,
							COMPRESSED_RGBA_ASTC_8x6_KHR: 0x93b6,
							COMPRESSED_RGBA_ASTC_8x8_KHR: 0x93b7,
							COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR: 0x93d0,
							COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR: 0x93d1,
							COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR: 0x93d2,
							COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR: 0x93d3,
							COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR: 0x93d4,
							COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR: 0x93d5,
							COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR: 0x93d6,
							COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR: 0x93d7,
						}
					: null,
				bptc: bc ? { COMPRESSED_RGBA_BPTC_UNORM_EXT: 0x8e8c } : null,
				s3tc: bc
					? {
							COMPRESSED_RGB_S3TC_DXT1_EXT: 0x83f0,
							COMPRESSED_RGBA_S3TC_DXT3_EXT: 0x83f2,
							COMPRESSED_RGBA_S3TC_DXT5_EXT: 0x83f3,
						}
					: null,
				s3tc_srgb: bc
					? {
							COMPRESSED_SRGB_S3TC_DXT1_EXT: 0x8c4c,
							COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT: 0x8c4d,
							COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT: 0x8c4e,
							COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT: 0x8c4f,
						}
					: null,
				pvrtc: null,
				// ETC1 payloads upload as ETC2 rgb8 (superset)
				etc1: etc2 ? { COMPRESSED_RGB_ETC1_WEBGL: 0x8d64 } : null,
				etc2: etc2
					? {
							COMPRESSED_RGB8_ETC2: 0x9274,
							COMPRESSED_SRGB8_ETC2: 0x9275,
							COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2: 0x9276,
							COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2: 0x9277,
							COMPRESSED_RGBA8_ETC2_EAC: 0x9278,
							COMPRESSED_SRGB8_ALPHA8_ETC2_EAC: 0x9279,
							COMPRESSED_R11_EAC: 0x9270,
							COMPRESSED_SIGNED_R11_EAC: 0x9271,
							COMPRESSED_RG11_EAC: 0x9272,
							COMPRESSED_SIGNED_RG11_EAC: 0x9273,
						}
					: null,
			};
			// no device = the renegotiation window after a device loss: the
			// all-null table is only valid for this instant and must not be
			// memoized, or the replacement device's families would stay
			// locked to null
			if (typeof this.device === "undefined") {
				return table;
			}
			this.supportedCompressedFormats = table;
		}
		return this.supportedCompressedFormats;
	}

	/**
	 * Pack the active 2D lights and hand the std140 block to the lit
	 * batcher — the WebGPU realization of the backend-neutral lighting
	 * contract (Camera2d calls this once per camera per frame).
	 * @param {Set<Light2d>|Array<Light2d>} lights - active lights
	 * @param {Color} ambient - the ambient lighting floor
	 * @param {number} [translateX=0] - camera translate x
	 * @param {number} [translateY=0] - camera translate y
	 * @override
	 */
	setLightUniforms(lights, ambient, translateX = 0, translateY = 0) {
		if (this.lightUniformsScratch === undefined) {
			this.lightUniformsScratch = createLightUniformScratch();
		}
		const packed = packLights(
			lights,
			ambient,
			translateX,
			translateY,
			this.lightUniformsScratch,
		);
		this.activeLightCount = packed.count;
		const lit = this.batchers.get("litQuad");
		if (lit && typeof lit.setLightUniforms === "function") {
			lit.setLightUniforms(packed);
		}
	}

	/**
	 * Draw a Light2d glow quad through the radial-gradient effect's
	 * single-effect fast path — the light's color and intensity ride the
	 * per-vertex tint, so back-to-back lights share the same pipeline.
	 * @param {Light2d} light - the light to draw
	 * @override
	 */
	drawLight(light) {
		if (this.lightShader === undefined) {
			this.lightShader = new RadialGradientEffect(this);
		}
		const previousShader = this.customShader;
		this.customShader = this.lightShader;
		const batcher = this.setBatcher("quad");
		batcher.addQuad(
			this.getLightAtlas(),
			light.pos.x,
			light.pos.y,
			light.width,
			light.height,
			0,
			0,
			1,
			1,
			// pack the light's color (RGB) and intensity (A) into the
			// vertex tint — the effect reads color.rgb / color.a
			light.color.toUint32(light.intensity),
		);
		this.customShader = previousShader;
	}

	/**
	 * Lazy-init a shared 1×1 white TextureAtlas used as the source texture
	 * for drawLight's procedural effect (same rationale as the GL backend)
	 * @returns {TextureAtlas}
	 * @ignore
	 * @internal
	 */
	getLightAtlas() {
		if (this.lightAtlas === undefined) {
			const canvas = globalThis.document
				? globalThis.document.createElement("canvas")
				: new OffscreenCanvas(1, 1);
			canvas.width = 1;
			canvas.height = 1;
			const ctx = canvas.getContext("2d");
			ctx.fillStyle = "#fff";
			ctx.fillRect(0, 0, 1, 1);
			// cache=false: the atlas is only ever drawn directly through
			// addQuad, so it needs no global TextureCache registration (and
			// this renderer method must not reach for the global game)
			this.lightAtlas = new TextureAtlas(
				createAtlas(1, 1, "lightWhite", "no-repeat"),
				canvas,
				false,
			);
		}
		return this.lightAtlas;
	}

	/**
	 * Draw a pattern within the given rectangle.
	 * @param {TextureAtlas} pattern - pattern object returned by {@link WebGPURenderer#createPattern}
	 * @param {number} x - x position where to draw the pattern
	 * @param {number} y - y position where to draw the pattern
	 * @param {number} width - width of the pattern
	 * @param {number} height - height of the pattern
	 */
	drawPattern(pattern, x, y, width, height) {
		const uvs = pattern.getUVs("0,0," + width + "," + height);
		this.setBatcher("quad");
		this.currentBatcher.addQuad(
			pattern,
			x,
			y,
			width,
			height,
			uvs[0],
			uvs[1],
			uvs[2],
			uvs[3],
			this.currentTint.toUint32(this.getGlobalAlpha()),
		);
	}

	/**
	 * Create a pattern with the specified repetition
	 * @param {HTMLImageElement|SVGImageElement|HTMLVideoElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas|VideoFrame} image - source image
	 * @param {string} [repeat="no-repeat"] - one of `"repeat"` / `"repeat-x"` / `"repeat-y"` / `"no-repeat"`
	 * @returns {TextureAtlas} the patterned texture created
	 */
	createPattern(image, repeat = "no-repeat") {
		const texture = new TextureAtlas(
			createAtlas(image.width, image.height, "pattern", repeat),
			image,
		);
		// warm the resident texture + sampler pairing
		this.textureStore.getBinding(texture);
		return texture;
	}

	/**
	 * clip the given region from the canvas — all future drawing is
	 * limited to it. The clip is a transform-derived screen-space AABB
	 * applied through the pass scissor (WebGPU's `setScissorRect` is
	 * top-left-origin, so the stored coords apply without the GL y-flip;
	 * it validates containment, so the box is clamped to the canvas).
	 * @param {number} x - x axis of the upper-left corner of the region
	 * @param {number} y - y axis of the upper-left corner of the region
	 * @param {number} width - the width of the region
	 * @param {number} height - the height of the region
	 */
	clipRect(x, y, width, height) {
		const canvas = this.getCanvas();
		// treat a non-finite transform as "no clip"
		const m = this.currentTransform;
		if (!Number.isFinite(m.tx) || !Number.isFinite(m.ty)) {
			if (this.scissorActive) {
				// drain pending vertices under the active scissor first
				this.currentBatcher?.flush();
				this.scissorActive = false;
				this.applyScissor();
			}
			return;
		}

		// derive the screen-space AABB by feeding the rect's 4 corners
		// through `currentTransform` — any rotation collapses to the
		// rotated-rect AABB on screen, same as the GL scissor (#1349)
		const aabb = this.clipAABB;
		aabb.clear();
		aabb.addFrame(x, y, x + width, y + height, m);
		let sx = Math.floor(aabb.min.x);
		let sy = Math.floor(aabb.min.y);
		let sw = Math.ceil(aabb.max.x - sx);
		let sh = Math.ceil(aabb.max.y - sy);

		// full-canvas coverage → caller intent is "no clip"
		if (
			sx <= 0 &&
			sy <= 0 &&
			sx + sw >= canvas.width &&
			sy + sh >= canvas.height
		) {
			if (this.scissorActive) {
				this.currentBatcher?.flush();
				this.scissorActive = false;
				this.applyScissor();
			}
			return;
		}

		this.setScissorRect(sx, sy, sw, sh);
	}

	/**
	 * Clamp a screen-space scissor box to the canvas and make it the
	 * active scissor (shared tail of {@link WebGPURenderer#clipRect} and
	 * {@link WebGPURenderer#enableScissor}).
	 * @param {number} sx - screen-space x
	 * @param {number} sy - screen-space y
	 * @param {number} sw - width
	 * @param {number} sh - height
	 * @ignore
	 * @internal
	 */
	setScissorRect(sx, sy, sw, sh) {
		const canvas = this.getCanvas();
		// clamp to the canvas — WebGPU raises a validation error on any
		// out-of-attachment scissor where GL silently clamps; degenerate
		// boxes become a 0-sized scissor (nothing draws), not an error
		if (sx < 0) {
			sw += sx;
			sx = 0;
		}
		if (sy < 0) {
			sh += sy;
			sy = 0;
		}
		sw = Math.max(0, Math.min(sw, canvas.width - sx));
		sh = Math.max(0, Math.min(sh, canvas.height - sy));

		const cs = this.currentScissor;
		if (
			this.scissorActive &&
			cs[0] === sx &&
			cs[1] === sy &&
			cs[2] === sw &&
			cs[3] === sh
		) {
			return; // already at the right scissor
		}
		// drain vertices queued under the previous clip state
		this.currentBatcher?.flush();
		this.scissorActive = true;
		cs[0] = sx;
		cs[1] = sy;
		cs[2] = sw;
		cs[3] = sh;
		this.applyScissor();
	}

	/**
	 * Enable the scissor test with the given rectangle (transformed by the
	 * current transform, like the WebGL renderer). Unlike
	 * {@link WebGPURenderer#clipRect} a full-canvas rectangle still
	 * enables the scissor rather than reading as "no clip".
	 * @param {number} x - x coordinate of the scissor rectangle
	 * @param {number} y - y coordinate of the scissor rectangle
	 * @param {number} width - width of the scissor rectangle
	 * @param {number} height - height of the scissor rectangle
	 * @override
	 */
	enableScissor(x, y, width, height) {
		const aabb = this.clipAABB;
		aabb.clear();
		aabb.addFrame(x, y, x + width, y + height, this.currentTransform);
		const sx = Math.floor(aabb.min.x);
		const sy = Math.floor(aabb.min.y);
		this.setScissorRect(
			sx,
			sy,
			Math.ceil(aabb.max.x - sx),
			Math.ceil(aabb.max.y - sy),
		);
	}

	/**
	 * Enable or disable blending — blend state is pipeline state on this
	 * backend, so this maps onto the blend-mode axis: disabling stashes
	 * the current mode and switches to "none" (source replaces
	 * destination), enabling restores the stashed mode.
	 * @param {boolean} enable - whether blending should be enabled
	 * @override
	 */
	setBlendEnabled(enable) {
		if (enable === false) {
			if (this.currentBlendMode !== "none") {
				this.savedBlendMode = this.currentBlendMode;
				this.setBlendMode("none", this.premultipliedAlpha);
			}
		} else if (typeof this.savedBlendMode === "string") {
			this.setBlendMode(this.savedBlendMode, this.premultipliedAlpha);
			this.savedBlendMode = undefined;
		}
	}

	/**
	 * Clear the current render target with transparent black — the
	 * offscreen-target analogue of a frame clear, realized as this
	 * backend's pass-level clear (the next pass on the target loads
	 * cleared content instead of recording a clearing draw).
	 * @override
	 */
	clearRenderTarget() {
		// anything already recorded against the target must land first —
		// the pass restart below is what applies the clear ordering
		this.currentBatcher?.flush();
		if (this.renderPass !== null) {
			this.renderPass.end();
			this.renderPass = null;
		}
		this.pendingColorClear = true;
		this.pendingClearValue = { r: 0, g: 0, b: 0, a: 0 };
		emit(RENDER_TARGET_CHANGED, this);
	}

	/**
	 * A mask limits rendering elements to the shape and position of the
	 * given mask object — realized on the stencil half of the pass's
	 * depth-stencil attachment, exactly like the GL backend: a write
	 * phase increments the stencil under the mask shape (color writes
	 * off), then the render phase only passes fragments where the stencil
	 * equals the current mask level (or 0 when inverted).
	 *
	 * Entering the first mask level clears the stencil, which WebGPU can
	 * only do at a pass boundary — the frame's pass is broken and
	 * restarted with `stencilLoadOp: "clear"` (color preserved).
	 * (Note: masks are not preserved through save/restore and need to be
	 * manually cleared, same as the other backends.)
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] - the shape defining the mask to be applied
	 * @param {boolean} [invert=false] - either the given shape should define what is visible (default) or the opposite
	 */
	setMask(mask, invert = false) {
		// drain everything drawn before the mask changes
		this.currentBatcher?.flush();

		if (this.maskLevel === 0) {
			// stencil clear = pass break (color survives via loadOp "load")
			if (this.renderPass !== null) {
				this.renderPass.end();
				this.renderPass = null;
			}
			this.beginPass({ stencilLoadOp: "clear" });
		}

		this.maskLevel++;
		if (this.maskLevel > 0xff) {
			this.maskLevel = 0xff;
			if (this.maskDepthWarned !== true) {
				this.maskDepthWarned = true;
				console.warn(
					"melonJS: setMask nesting deeper than 255 — mask level clamped",
				);
			}
		}

		// write phase: every fragment of the mask shape increments the
		// stencil (color writes disabled by the pipeline variant)
		this.stencilMode = "write";
		this.fill(mask);
		this.currentBatcher?.flush();

		// render phase: draw only where the stencil matches
		this.stencilMode = "test";
		this.maskVisibleRef = invert === true ? 0 : this.maskLevel;
		this.ensurePass().setStencilReference(this.maskVisibleRef);
	}

	/**
	 * disable the current mask
	 * @see WebGPURenderer#setMask
	 */
	clearMask() {
		if (this.maskLevel === 0) {
			return;
		}
		// drain masked vertices while the stencil test still applies
		this.currentBatcher?.flush();
		this.maskLevel = 0;
		this.stencilMode = "none";
		this.maskVisibleRef = 0;
	}

	/**
	 * Fill an arbitrary shape with the current gradient by clipping the
	 * baked-gradient rect to the shape through the stencil — the GL
	 * backend's #gradientMask re-expressed as pipeline stencil variants.
	 *
	 * Outside a mask: the stencil is cleared (a pass break), the shape's
	 * pixels are stamped with reference 1 ("tag": always/replace, color
	 * writes off), and the gradient rect draws under the "test" mode.
	 * Inside a mask: the shape's VISIBLE pixels (stencil low 7 bits equal
	 * to the mask's visible value — mask levels never use the high bit)
	 * get a high-bit marker via "mark", the gradient clips to the marker,
	 * then the marker is stripped and the mask's exact render test is
	 * re-installed.
	 * @ignore
	 * @internal
	 */
	gradientMask(drawShape, x, y, w, h) {
		const grad = this.currentGradient;
		const hasMask = this.maskLevel > 0;
		// the tag/untag phases re-enter the shape's public fill method —
		// null the gradient so they take the plain solid path
		this.currentGradient = null;

		this.currentBatcher?.flush();

		const visibleRef = this.maskVisibleRef;
		let markRef = 1;

		if (hasMask) {
			markRef = 0x80 | visibleRef;
			this.stencilMode = "mark";
			this.ensurePass().setStencilReference(markRef);
		} else {
			// stencil clear = pass break (color survives via loadOp "load")
			if (this.renderPass !== null) {
				this.renderPass.end();
				this.renderPass = null;
			}
			this.beginPass({ stencilLoadOp: "clear" });
			this.stencilMode = "tag";
			this.ensurePass().setStencilReference(markRef);
		}
		drawShape();
		this.currentBatcher?.flush();

		// clip the gradient fill (a baked-texture quad) to the marked pixels
		this.stencilMode = "test";
		this.ensurePass().setStencilReference(markRef);
		this.currentGradient = grad;
		this.fillRect(x, y, w, h);
		this.currentBatcher?.flush();

		if (hasMask) {
			// clear the marker: replace writes the reference — a no-op on
			// unmarked visible pixels, and it strips the high bit from the
			// marked ones
			this.currentGradient = null;
			this.stencilMode = "mark";
			this.ensurePass().setStencilReference(visibleRef);
			drawShape();
			this.currentBatcher?.flush();
			this.currentGradient = grad;
			// re-install the exact render test setMask had established
			this.stencilMode = "test";
		} else {
			this.stencilMode = "none";
		}
		this.ensurePass().setStencilReference(this.maskVisibleRef);
	}

	/**
	 * Stroke an arc at the specified coordinates with given radius, start and end points
	 * @param {number} x - arc center point x-axis
	 * @param {number} y - arc center point y-axis
	 * @param {number} radius - arc radius
	 * @param {number} start - start angle in radians
	 * @param {number} end - end angle in radians
	 * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokeArc(x, y, radius, start, end, antiClockwise = false, fill = false) {
		if (fill === true) {
			this.fillArc(x, y, radius, start, end, antiClockwise);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.arc(x, y, radius, start, end, antiClockwise);
		this.currentBatcher.drawVertices("line-list", this.path2D.points);
	}

	/**
	 * Fill an arc at the specified coordinates with given radius, start and end points
	 * @param {number} x - arc center point x-axis
	 * @param {number} y - arc center point y-axis
	 * @param {number} radius - arc radius
	 * @param {number} start - start angle in radians
	 * @param {number} end - end angle in radians
	 * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
	 */
	fillArc(x, y, radius, start, end, antiClockwise = false) {
		if (this.currentGradient) {
			this.gradientMask(
				() => {
					this.fillArc(x, y, radius, start, end, antiClockwise);
				},
				x - radius,
				y - radius,
				radius * 2,
				radius * 2,
			);
			return;
		}
		this.setBatcher("primitive");
		let diff = Math.abs(end - start);
		if (antiClockwise) {
			diff = Math.PI * 2 - diff;
		}
		const segments = Math.max(
			4,
			Math.round((diff * radius) / this.path2D.arcResolution),
		);
		const startAngle = antiClockwise ? end : start;
		this.currentBatcher.drawVertices(
			"triangle-list",
			generateTriangleFan(
				x,
				y,
				radius,
				radius,
				startAngle,
				startAngle + diff,
				segments,
			),
		);
	}

	/**
	 * Stroke an ellipse at the specified coordinates with given radius
	 * @param {number} x - ellipse center point x-axis
	 * @param {number} y - ellipse center point y-axis
	 * @param {number} w - horizontal radius of the ellipse
	 * @param {number} h - vertical radius of the ellipse
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokeEllipse(x, y, w, h, fill = false) {
		if (fill === true) {
			this.fillEllipse(x, y, w, h);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.ellipse(x, y, w, h, 0, 0, 360);
		this.currentBatcher.drawVertices("line-list", this.path2D.points);
	}

	/**
	 * Fill an ellipse at the specified coordinates with given radius
	 * @param {number} x - ellipse center point x-axis
	 * @param {number} y - ellipse center point y-axis
	 * @param {number} w - horizontal radius of the ellipse
	 * @param {number} h - vertical radius of the ellipse
	 */
	fillEllipse(x, y, w, h) {
		if (this.currentGradient) {
			this.gradientMask(
				() => {
					this.fillEllipse(x, y, w, h);
				},
				x - w,
				y - h,
				w * 2,
				h * 2,
			);
			return;
		}
		this.setBatcher("primitive");
		const segments = Math.max(
			8,
			Math.round((Math.PI * (w + h)) / this.path2D.arcResolution),
		);
		this.currentBatcher.drawVertices(
			"triangle-list",
			generateTriangleFan(x, y, w, h, 0, Math.PI * 2, segments),
		);
	}

	/**
	 * Stroke a line between the given two points
	 * @param {number} startX - the start x coordinate
	 * @param {number} startY - the start y coordinate
	 * @param {number} endX - the end x coordinate
	 * @param {number} endY - the end y coordinate
	 */
	strokeLine(startX, startY, endX, endY) {
		this.setBatcher("primitive");
		const dash = this.renderState.lineDash;
		if (dash.length > 0) {
			const segments = dashSegments(startX, startY, endX, endY, dash);
			if (segments.length > 0) {
				this.currentBatcher.drawVertices("line-list", segments);
			}
		} else {
			this.path2D.beginPath();
			this.path2D.moveTo(startX, startY);
			this.path2D.lineTo(endX, endY);
			this.currentBatcher.drawVertices("line-list", this.path2D.points);
		}
	}

	/**
	 * Fill a line between the given two points
	 * @param {number} startX - the start x coordinate
	 * @param {number} startY - the start y coordinate
	 * @param {number} endX - the end x coordinate
	 * @param {number} endY - the end y coordinate
	 */
	fillLine(startX, startY, endX, endY) {
		this.strokeLine(startX, startY, endX, endY);
	}

	/**
	 * Stroke a Polygon on the screen with the current color
	 * @param {Polygon} poly - the shape to draw
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokePolygon(poly, fill = false) {
		if (fill === true) {
			this.fillPolygon(poly);
			return;
		}
		const points = poly.points;
		const len = points.length;

		this.translate(poly.pos.x, poly.pos.y);

		this.setBatcher("primitive");
		this.path2D.beginPath();
		for (let i = 0; i < len - 1; i++) {
			const curPoint = points[i];
			const nextPoint = points[i + 1];
			this.path2D.moveTo(curPoint.x, curPoint.y);
			this.path2D.lineTo(nextPoint.x, nextPoint.y);
		}
		this.path2D.closePath();
		const dash = this.renderState.lineDash;
		if (dash.length > 0) {
			const pts = this.path2D.points;
			const dashed = dashPath(pts, dash);
			if (dashed.length > 0) {
				this.currentBatcher.drawVertices("line-list", dashed);
			}
		} else {
			this.currentBatcher.drawVertices("line-list", this.path2D.points);
		}
		// add round joins at vertices for thick lines
		if (this.lineWidth > 1) {
			const radius = this.lineWidth / 2;
			const joinPoints = [];
			for (let i = 1; i < len; i++) {
				joinPoints.push(points[i]);
			}
			const lastPoint = points[len - 1];
			const firstPoint = points[0];
			if (!lastPoint.equals(firstPoint)) {
				joinPoints.push(firstPoint);
			}
			this.currentBatcher.drawVertices(
				"triangle-list",
				generateJoinCircles(joinPoints, radius),
			);
		}

		this.translate(-poly.pos.x, -poly.pos.y);
	}

	/**
	 * Fill a Polygon on the screen
	 * @param {Polygon} poly - the shape to draw
	 */
	fillPolygon(poly) {
		if (this.currentGradient) {
			const bounds = poly.getBounds();
			// translate to polygon's local space so gradient coords match
			this.translate(poly.pos.x, poly.pos.y);
			this.gradientMask(
				() => {
					// draw polygon vertices directly (already translated)
					this.setBatcher("primitive");
					const indices = poly.getIndices();
					const points = poly.points;
					const verts = this.polyVerts;
					const len = indices.length;
					while (verts.length < len) {
						verts.push({ x: 0, y: 0 });
					}
					for (let i = 0; i < len; i++) {
						const src = points[indices[i]];
						verts[i].x = src.x;
						verts[i].y = src.y;
					}
					this.currentBatcher.drawVertices("triangle-list", verts, len);
				},
				// use local bounds (subtract pos since getBounds includes it)
				bounds.x - poly.pos.x,
				bounds.y - poly.pos.y,
				bounds.width,
				bounds.height,
			);
			this.translate(-poly.pos.x, -poly.pos.y);
			return;
		}
		this.setBatcher("primitive");
		this.translate(poly.pos.x, poly.pos.y);
		const indices = poly.getIndices();
		const points = poly.points;
		const verts = this.polyVerts;
		const len = indices.length;

		// grow the scratch array if needed
		while (verts.length < len) {
			verts.push({ x: 0, y: 0 });
		}

		// copy point coordinates so drawVertices won't mutate the polygon
		for (let i = 0; i < len; i++) {
			const src = points[indices[i]];
			verts[i].x = src.x;
			verts[i].y = src.y;
		}

		this.currentBatcher.drawVertices("triangle-list", verts, len);
		this.translate(-poly.pos.x, -poly.pos.y);
	}

	/**
	 * Draw a stroke rectangle at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the rectangle starting point
	 * @param {number} y - y axis of the coordinate for the rectangle starting point
	 * @param {number} width - the rectangle's width
	 * @param {number} height - the rectangle's height
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokeRect(x, y, width, height, fill = false) {
		if (fill === true) {
			this.fillRect(x, y, width, height);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.rect(x, y, width, height);
		this.currentBatcher.drawVertices("line-list", this.path2D.points);
		// add round joins at corners for thick lines
		if (this.lineWidth > 1) {
			const radius = this.lineWidth / 2;
			this.currentBatcher.drawVertices(
				"triangle-list",
				generateJoinCircles(
					[
						{ x, y },
						{ x: x + width, y },
						{ x: x + width, y: y + height },
						{ x, y: y + height },
					],
					radius,
				),
			);
		}
	}

	/**
	 * Draw a filled rectangle at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the rectangle starting point
	 * @param {number} y - y axis of the coordinate for the rectangle starting point
	 * @param {number} width - the rectangle's width
	 * @param {number} height - the rectangle's height
	 */
	fillRect(x, y, width, height) {
		if (this.currentGradient) {
			// toCanvas() bakes the gradient through the Canvas 2D API and
			// draws it as a textured quad — same path as the GL backend
			const canvas = this.currentGradient.toCanvas(this, x, y, width, height);
			this.drawImage(canvas, 0, 0, width, height, x, y, width, height);
			return;
		}
		this.setBatcher("primitive");
		// 2 triangles directly — avoids path2D + earcut overhead
		const right = x + width;
		const bottom = y + height;
		const pts = this.rectTriangles;
		pts[0].x = x;
		pts[0].y = y;
		pts[1].x = right;
		pts[1].y = y;
		pts[2].x = x;
		pts[2].y = bottom;
		pts[3].x = right;
		pts[3].y = y;
		pts[4].x = right;
		pts[4].y = bottom;
		pts[5].x = x;
		pts[5].y = bottom;
		this.currentBatcher.drawVertices("triangle-list", pts);
	}

	/**
	 * Stroke a rounded rectangle at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the rounded rectangle starting point
	 * @param {number} y - y axis of the coordinate for the rounded rectangle starting point
	 * @param {number} width - the rounded rectangle's width
	 * @param {number} height - the rounded rectangle's height
	 * @param {number} radius - the rounded corner's radius
	 * @param {boolean} [fill=false] - also fill the shape with the current color if true
	 */
	strokeRoundRect(x, y, width, height, radius, fill = false) {
		if (fill === true) {
			this.fillRoundRect(x, y, width, height, radius);
			return;
		}
		this.setBatcher("primitive");
		this.path2D.beginPath();
		this.path2D.roundRect(x, y, width, height, radius);
		this.currentBatcher.drawVertices("line-list", this.path2D.points);
	}

	/**
	 * Draw a rounded filled rectangle at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the rounded rectangle starting point
	 * @param {number} y - y axis of the coordinate for the rounded rectangle starting point
	 * @param {number} width - the rounded rectangle's width
	 * @param {number} height - the rounded rectangle's height
	 * @param {number} radius - the rounded corner's radius
	 */
	fillRoundRect(x, y, width, height, radius) {
		if (this.currentGradient) {
			this.gradientMask(
				() => {
					this.fillRoundRect(x, y, width, height, radius);
				},
				x,
				y,
				width,
				height,
			);
			return;
		}
		this.setBatcher("primitive");
		const r = Math.min(radius, width / 2, height / 2);
		const verts = [];

		// inner cross: 3 rects (6 triangles = 18 vertices)
		verts.push(
			{ x, y: y + r },
			{ x: x + width, y: y + r },
			{ x, y: y + height - r },
			{ x: x + width, y: y + r },
			{ x: x + width, y: y + height - r },
			{ x, y: y + height - r },
		);
		verts.push(
			{ x: x + r, y },
			{ x: x + width - r, y },
			{ x: x + r, y: y + r },
			{ x: x + width - r, y },
			{ x: x + width - r, y: y + r },
			{ x: x + r, y: y + r },
		);
		verts.push(
			{ x: x + r, y: y + height - r },
			{ x: x + width - r, y: y + height - r },
			{ x: x + r, y: y + height },
			{ x: x + width - r, y: y + height - r },
			{ x: x + width - r, y: y + height },
			{ x: x + r, y: y + height },
		);

		// 4 corner arcs as triangle fans
		const cornerSegments = Math.max(
			4,
			Math.round((Math.PI * r) / 2 / this.path2D.arcResolution),
		);
		const PI = Math.PI;
		verts.push(
			...generateTriangleFan(x + r, y + r, r, r, PI, PI * 1.5, cornerSegments),
		);
		verts.push(
			...generateTriangleFan(
				x + width - r,
				y + r,
				r,
				r,
				PI * 1.5,
				PI * 2,
				cornerSegments,
			),
		);
		verts.push(
			...generateTriangleFan(
				x + width - r,
				y + height - r,
				r,
				r,
				0,
				PI * 0.5,
				cornerSegments,
			),
		);
		verts.push(
			...generateTriangleFan(
				x + r,
				y + height - r,
				r,
				r,
				PI * 0.5,
				PI,
				cornerSegments,
			),
		);

		this.currentBatcher.drawVertices("triangle-list", verts);
	}

	/**
	 * Stroke a Point at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the point
	 * @param {number} y - y axis of the coordinate for the point
	 */
	strokePoint(x, y) {
		this.strokeLine(x, y, x + 1, y + 1);
	}

	/**
	 * Draw a point at the specified coordinates
	 * @param {number} x - x axis of the coordinate for the point
	 * @param {number} y - y axis of the coordinate for the point
	 */
	fillPoint(x, y) {
		this.strokePoint(x, y);
	}

	/**
	 * starts a new path by emptying the list of sub-paths
	 */
	beginPath() {
		this.path2D.beginPath();
	}

	/**
	 * begins a new sub-path at the point specified by the given (x, y) coordinates
	 * @param {number} x - the x axis of the point
	 * @param {number} y - the y axis of the point
	 */
	moveTo(x, y) {
		this.path2D.moveTo(x, y);
	}

	/**
	 * adds a straight line to the current sub-path
	 * @param {number} x - the x axis of the point
	 * @param {number} y - the y axis of the point
	 */
	lineTo(x, y) {
		this.path2D.lineTo(x, y);
	}

	/**
	 * Adds a quadratic Bezier curve to the current sub-path.
	 * @param {number} cpx - the x-axis coordinate of the control point
	 * @param {number} cpy - the y-axis coordinate of the control point
	 * @param {number} x - the x-axis coordinate of the end point
	 * @param {number} y - the y-axis coordinate of the end point
	 */
	quadraticCurveTo(cpx, cpy, x, y) {
		this.path2D.quadraticCurveTo(cpx, cpy, x, y);
	}

	/**
	 * Adds a cubic Bezier curve to the current sub-path.
	 * @param {number} cp1x - the x-axis coordinate of the first control point
	 * @param {number} cp1y - the y-axis coordinate of the first control point
	 * @param {number} cp2x - the x-axis coordinate of the second control point
	 * @param {number} cp2y - the y-axis coordinate of the second control point
	 * @param {number} x - the x-axis coordinate of the end point
	 * @param {number} y - the y-axis coordinate of the end point
	 */
	bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
		this.path2D.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
	}

	/**
	 * Adds a circular arc to the current sub-path, using the given control points and radius.
	 * @param {number} x1 - the x-axis coordinate of the first control point
	 * @param {number} y1 - the y-axis coordinate of the first control point
	 * @param {number} x2 - the x-axis coordinate of the second control point
	 * @param {number} y2 - the y-axis coordinate of the second control point
	 * @param {number} radius - the arc's radius; must be non-negative
	 */
	arcTo(x1, y1, x2, y2, radius) {
		this.path2D.arcTo(x1, y1, x2, y2, radius);
	}

	/**
	 * creates a rectangular path whose starting point is at (x, y)
	 * @param {number} x - the x axis of the coordinate for the rectangle starting point
	 * @param {number} y - the y axis of the coordinate for the rectangle starting point
	 * @param {number} width - the rectangle's width
	 * @param {number} height - the rectangle's height
	 */
	rect(x, y, width, height) {
		this.path2D.rect(x, y, width, height);
	}

	/**
	 * adds a rounded rectangle to the current path
	 * @param {number} x - the x axis of the coordinate for the rectangle starting point
	 * @param {number} y - the y axis of the coordinate for the rectangle starting point
	 * @param {number} width - the rectangle's width
	 * @param {number} height - the rectangle's height
	 * @param {number} radii - the corner radius
	 */
	roundRect(x, y, width, height, radii) {
		this.path2D.roundRect(x, y, width, height, radii);
	}

	/**
	 * add a straight line from the current point to the start of the current sub-path
	 */
	closePath() {
		this.path2D.closePath();
	}

	/**
	 * stroke the given shape or the current defined path
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse|Bounds} [shape] - a shape object to stroke
	 * @param {boolean} [fill=false] - fill the shape with the current color if true
	 */
	stroke(shape, fill) {
		if (typeof shape === "undefined") {
			this.setBatcher("primitive");
			if (fill === true) {
				// draw all triangles
				this.currentBatcher.drawVertices(
					"triangle-list",
					this.path2D.triangulatePath(),
				);
			} else {
				const dash = this.renderState.lineDash;
				if (dash.length > 0) {
					const pts = this.path2D.points;
					const dashed = dashPath(pts, dash);
					if (dashed.length > 0) {
						this.currentBatcher.drawVertices("line-list", dashed);
					}
				} else {
					this.currentBatcher.drawVertices("line-list", this.path2D.points);
				}
			}
		} else {
			// dispatches to strokeRect/strokePolygon/etc. via the base class
			super.stroke(shape, fill);
		}
	}

	/**
	 * fill the given shape or the current defined path
	 * @param {Rect|RoundRect|Polygon|Line|Ellipse|Bounds} [shape] - a shape object to fill
	 */
	fill(shape) {
		this.stroke(shape, true);
	}

	/**
	 * Enable/disable anti-aliasing — under WebGPU this only drives the
	 * default sampler filter: textures stay resident and every
	 * (texture, sampler) bind-group pairing is rebuilt on next draw.
	 * @param {boolean} [enable=false] - whether to enable anti-aliasing
	 */
	setAntiAlias(enable = false) {
		super.setAntiAlias(enable);
		this.currentBatcher?.flush();
		this.textureStore?.invalidateBindGroups();
		// the lit tier caches combined color+normal bind groups and the
		// quad tier caches composed segment groups outside the store —
		// each embeds samplers resolved from the default filter
		this.batchers.get("litQuad")?.clearMaterialCache();
		this.batchers.get("quad")?.clearMaterialCache();
	}

	/**
	 * Set the default texture filter at runtime, decoupled from
	 * {@link WebGPURenderer#setAntiAlias} — same re-pairing mechanism.
	 * @param {"auto"|"nearest"|"linear"} [mode="auto"] - `"auto"` follows `antiAlias`
	 */
	setTextureFilter(mode = "auto") {
		super.setTextureFilter(mode);
		this.currentBatcher?.flush();
		this.textureStore?.invalidateBindGroups();
		// the lit tier caches combined color+normal bind groups and the
		// quad tier caches composed segment groups outside the store —
		// each embeds samplers resolved from the default filter
		this.batchers.get("litQuad")?.clearMaterialCache();
		this.batchers.get("quad")?.clearMaterialCache();
	}

	/**
	 * rebuild every GPU-facing resource after a device loss — the WebGPU
	 * analogue of the WebGL context-restore path
	 * @ignore
	 * @internal
	 */
	async restoreDevice() {
		// tear down everything tied to the dead device
		this.abandonFrame();
		this.textureStore?.destroy();
		this.vertexArena?.destroy();
		this.indexArena?.destroy();
		this.uniformRing?.destroy();
		this.pipelineCache?.clear();
		// device-scoped post-effect state: the shared capture, pool targets
		// and stub die with the device; effect GPU realizations self-heal
		// via the pipeline-cache epoch
		this.captureTexture = undefined;
		this._renderTargetPool?.destroy();
		this._renderTargetPool = null;
		this.effectUniformArena?.destroy();
		this.effectUniformArena = null;
		this.stubTexture = null;
		this.stubTextureView = null;
		this.currentRenderTarget = null;
		// tile-path lookup textures died with the device; the epoch check
		// in drawTileLayer rebuilds the renderer lazily
		this.orthogonalTMXRenderer = undefined;
		this.depthTexture = null;
		this.msaaDepthTexture = null;
		this.msaaColorTexture = null;
		this.msaaColorView = null;
		this.device = undefined;
		this.adapter = undefined;
		// the replacement device may offer different compression families
		this.supportedCompressedFormats = undefined;
		// renegotiate + rebuild (init also re-registers batcher layouts);
		// resident textures lazily re-upload because the cache still maps
		// sources to atlases while the unit assignments start fresh
		this.cache.resetUnitAssignments();
		await this.init();
		// re-init the batchers against the new device
		for (const batcher of this.batchers.values()) {
			batcher.init(this);
		}
		emit(ONCONTEXT_RESTORED, this);
	}

	/**
	 * Returns the WebGPU canvas context
	 * @returns {GPUCanvasContext} the WebGPU canvas context
	 */
	getContext() {
		return this.context;
	}

	/**
	 * Reset the renderer state
	 * @override
	 */
	reset() {
		this.abandonFrame();
		// a reset can land mid-post-effect-pass — unwind the bracket state
		this.effectPassDepth = 0;
		this.customShader = undefined;
		// level transition: free the per-layer/per-tileset lookup textures
		this.orthogonalTMXRenderer?.reset();
		super.reset();
		// re-init batchers when recovering from a device loss, plain reset
		// otherwise — the same split as the WebGL restore path. A reset
		// landing INSIDE the device renegotiation window (device gone,
		// replacement not granted yet) can only reset: init needs a device,
		// and restoreDevice re-inits every batcher once one exists
		for (const batcher of this.batchers.values()) {
			if (this.isContextValid === false && typeof this.device !== "undefined") {
				batcher.init(this);
			} else {
				batcher.reset();
			}
		}
	}

	/**
	 * Release the GPU device, unconfigure the canvas context, and tear
	 * down every GPU-facing cache. Called by {@link Application#destroy}.
	 * @override
	 */
	destroy() {
		off(GAME_RESET, this.onGameReset);
		off(CANVAS_ONRESIZE, this.onCanvasResize);
		this.abandonFrame();
		if (typeof this.device !== "undefined") {
			for (const batcher of this.batchers.values()) {
				batcher.destroy();
			}
			this.textureStore?.destroy();
			this.vertexArena?.destroy();
			this.indexArena?.destroy();
			this.uniformRing?.destroy();
			this.pipelineCache?.clear();
			this.captureTexture?.destroy();
			this.captureTexture = undefined;
			this.orthogonalTMXRenderer = undefined;
			this._renderTargetPool?.destroy();
			this._renderTargetPool = null;
			this.effectUniformArena?.destroy();
			this.effectUniformArena = null;
			this.stubTexture?.destroy();
			this.stubTexture = null;
			this.stubTextureView = null;
			this.currentRenderTarget = null;
			this.depthTexture?.destroy();
			this.depthTexture = null;
			this.msaaDepthTexture?.destroy();
			this.msaaDepthTexture = null;
			this.msaaColorTexture?.destroy();
			this.msaaColorTexture = null;
			this.msaaColorView = null;
			this.context.unconfigure();
			this.device.destroy();
			this.device = undefined;
			this.adapter = undefined;
		}
		this.isContextValid = false;
	}
}
