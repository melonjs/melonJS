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
import WebGPUPrimitiveBatcher from "./batchers/primitive_batcher.js";
import WebGPUQuadBatcher from "./batchers/quad_batcher.js";
import WebGPUBatcher from "./batchers/webgpu_batcher.js";
import WebGPUBufferArena from "./buffer/arena.js";
import WebGPUUniformRing from "./buffer/uniformring.js";
import WebGPUPipelineCache, {
	DEPTH_STENCIL_FORMAT,
	normalizeBlendMode,
} from "./pipeline/cache.js";
import { WebGPUFrameTexture } from "./texture/frametexture.js";
import WebGPUTextureStore from "./texture/store.js";

// scratch matrix for the affine-components form of transform()
const tempMatrix = new Matrix3d();
// scratch: the projection saved across a blitEffect quad
const blitSavedProjection = new Matrix3d();

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

		// capability flags stay at their base-class `false` defaults
		// (supportsDepthBuffer / supportsShaderTileLayers /
		// supportsRetainedMesh): they describe what the backend can DO
		// today, not what it will grow — each flips when its path lands

		// create a texture cache
		this.cache = new TextureCache(this);

		// the model/view matrix lives in the base-owned RenderState — same
		// aliasing as the WebGL backend
		this.currentTransform = this.renderState.currentTransform;

		// active Gradient (setColor(Gradient)); phase 1 only honors it on
		// fillRect via the Canvas-baked gradient texture
		/** @ignore */
		this.currentGradient = null;
		/** @ignore */
		this.gradientShapeWarned = false;

		// scratch vertices for fillRect (2 triangles) and fillPolygon
		/** @ignore */
		this.rectTriangles = Array.from({ length: 6 }, () => {
			return { x: 0, y: 0 };
		});
		/** @ignore */
		this.polyVerts = [];
		// scratch bounds for the clipRect screen-space AABB derivation
		/** @ignore */
		this.clipAABB = new Bounds();
		// the stencil reference the masked render phase compares against
		/** @ignore */
		this.maskVisibleRef = 0;

		/**
		 * the batchers registered with this renderer, by name
		 * @type {Map<string, object>}
		 * @ignore
		 */
		this.batchers = new Map();

		/**
		 * the currently active batcher
		 * @ignore
		 */
		this.currentBatcher = null;

		// GPU-facing infrastructure, created by init() once a device exists
		/** @ignore */
		this.pipelineCache = null;
		/** @ignore */
		this.vertexArena = null;
		/** @ignore */
		this.uniformRing = null;
		/** @ignore */
		this.textureStore = null;

		// per-frame recording state
		/** @ignore */
		this.commandEncoder = null;
		/** @ignore */
		this.renderPass = null;
		// the active offscreen render target (null = the canvas). Retargeting
		// is a pass break: the next pass opens on the target's color view.
		/** @ignore */
		this.currentRenderTarget = null;
		// consumed as the next pass's colorLoadOp "clear" (fresh target)
		/** @ignore */
		this.pendingColorClear = false;
		/** @ignore */
		this.pendingClearValue = null;
		/** @ignore */
		this.pendingStencilClear = false;
		// the canvas GPUTexture handle of the current frame — kept beside its
		// view because captureFrame copies from the TEXTURE, not the view
		/** @ignore */
		this.frameTexture = null;
		// the shared frame-capture slot (screen_texture builtin), lazy
		/** @ignore */
		this.captureTexture = undefined;
		// 1×1 transparent stand-in bound where a declared texture has no
		// source yet (never-captured screen_texture, unset setTexture slot)
		/** @ignore */
		this.stubTexture = null;
		// per-depth projection save slots for nested post-effect passes
		/** @ignore */
		this.effectProjectionStack = [];
		/** @ignore */
		this.effectPassDepth = 0;
		// per-bind effect uniform snapshots (created by init)
		/** @ignore */
		this.effectUniformArena = null;
		// monotonically increasing frame id — the texture store uses it to
		// detect same-frame content changes that need a fresh texture
		/** @ignore */
		this.frameId = 0;
		// GPUTextures replaced mid-frame: destroying them immediately would
		// invalidate draws already recorded against them (submit rejects the
		// whole command buffer) — they retire at frame end, after submit
		/** @ignore */
		this.retiredTextures = [];
		// the lineWidth value written into the current frame-globals slot —
		// the primitive batcher compares against THIS (not its own cache)
		// because clear() rewrites the slot every frame
		/** @ignore */
		this.currentFrameLineWidth = 1;
		/** @ignore */
		this.frameTextureView = null;
		/** @ignore */
		this.depthTexture = null;
		/** @ignore */
		this.currentPipeline = null;
		/** @ignore */
		this.currentFrameBinding = null;
		/** @ignore */
		this.scissorActive = false;
		// premultiplied-alpha flag mirrored from setBlendMode (pipeline key)
		/** @ignore */
		this.premultipliedAlpha = true;
		// stencil mode consulted by the pipeline lookup: "none"|"write"|"test"
		/** @ignore */
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
		this.adapter = adapter;

		this.device = await adapter.requestDevice();

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
		this.textureStore = new WebGPUTextureStore(this);
		this.createDepthTexture();

		// register the built-in batchers (device-dependent, so here rather
		// than the constructor — a device-loss restore re-runs this path)
		if (this.batchers.size === 0) {
			this.addBatcher(new WebGPUQuadBatcher(this), "quad", true);
			this.addBatcher(new WebGPUPrimitiveBatcher(this), "primitive");
		}

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
	 */
	createDepthTexture(width, height) {
		const canvas = this.getCanvas();
		width = Math.max(1, width ?? canvas.width);
		height = Math.max(1, height ?? canvas.height);
		if (
			this.depthTexture &&
			this.depthTexture.width === width &&
			this.depthTexture.height === height
		) {
			return;
		}
		if (this.depthTexture) {
			// recorded passes may reference the old attachment — retire it
			this.retireTexture(this.depthTexture);
		}
		this.depthTexture = this.device.createTexture({
			label: "melonJS depth-stencil",
			size: [width, height],
			format: DEPTH_STENCIL_FORMAT,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});
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
		this.beginPass({
			colorLoadOp: "clear",
			clearValue: { r, g, b, a },
			stencilLoadOp: "clear",
		});

		// the frame's first frame-globals slot
		this.pushFrameGlobals();

		// a new frame is a new render pass on the active target — same
		// per-frame signal the WebGL backend emits from its clear()
		emit(RENDER_TARGET_CHANGED, this.renderTarget);
	}

	/**
	 * open a render pass on the current frame's encoder (creating the
	 * encoder and acquiring the canvas texture on first use this frame)
	 * @param {object} [opts] - load operations for the pass
	 * @ignore
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
		// every attachment of a pass must have identical dimensions — the
		// shared depth-stencil tracks the active target's size (targets are
		// canvas-sized in the 2D flow, so this recreates nothing in practice)
		const [width, height] = this.getTargetSize();
		this.createDepthTexture(width, height);
		this.renderPass = this.commandEncoder.beginRenderPass({
			label: "melonJS pass",
			colorAttachments: [
				{
					view: colorView,
					loadOp: colorLoadOp ?? "load",
					clearValue,
					storeOp: "store",
				},
			],
			depthStencilAttachment: {
				view: this.depthTexture.createView(),
				depthLoadOp: "clear",
				depthClearValue: 1.0,
				depthStoreOp: "discard",
				stencilLoadOp: stencilLoadOp ?? "load",
				stencilClearValue: 0,
				stencilStoreOp: "store",
			},
		});
		this.renderPass.setViewport(0, 0, width, height, 0, 1);
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
	 */
	retireTexture(texture) {
		if (this.commandEncoder !== null) {
			this.retiredTextures.push(texture);
		} else {
			texture.destroy();
		}
	}

	/**
	 * The 1×1 transparent-black stand-in view — bound where a declared
	 * effect texture has no source yet, so bind groups stay valid.
	 * @returns {GPUTextureView} the stub view
	 * @ignore
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
	 */
	captureFrame() {
		if (typeof this.device === "undefined") {
			return null;
		}
		this.currentBatcher?.flush();
		if (this.renderPass !== null) {
			this.renderPass.end();
			this.renderPass = null;
		}
		// resolve the source texture: the active target, or the canvas
		// (acquired now if nothing drew yet this frame)
		let source;
		const [width, height] = this.getTargetSize();
		if (this.currentRenderTarget !== null) {
			source = this.currentRenderTarget.texture;
		} else {
			if (this.frameTexture === null) {
				this.frameTexture = this.context.getCurrentTexture();
				this.frameTextureView = this.frameTexture.createView();
			}
			source = this.frameTexture;
		}
		// (re)allocate the shared capture at the source size
		let capture = this.captureTexture;
		if (
			typeof capture === "undefined" ||
			capture.width !== width ||
			capture.height !== height
		) {
			capture?.destroy();
			capture = new WebGPUFrameTexture(this, width, height);
			this.captureTexture = capture;
		}
		if (this.commandEncoder === null) {
			this.commandEncoder = this.device.createCommandEncoder({
				label: "melonJS frame",
			});
		}
		this.commandEncoder.copyTextureToTexture(
			{ texture: source },
			{ texture: capture.gpuTexture },
			[width, height],
		);
		return capture;
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
		this.currentPipeline = null;
		// the recorded draws are dropped with the command buffer, so any
		// texture retired during the frame can go now
		this.destroyRetiredTextures();
	}

	/**
	 * destroy GPUTextures replaced mid-frame, now that the command buffer
	 * referencing them has been submitted (or abandoned)
	 * @ignore
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

		this.setBatcher("quad");

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
		);
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
	 * gradient fills of arbitrary shapes need the stencil gradient-mask
	 * machinery (deferred with post effects) — fall back to a solid fill
	 * with a one-time console warning
	 * @ignore
	 */
	warnGradientShape() {
		if (this.gradientShapeWarned !== true) {
			this.gradientShapeWarned = true;
			console.warn(
				"WebGPURenderer: gradient fills of non-rectangular shapes are " +
					"not supported yet — falling back to a solid fill",
			);
		}
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
			this.warnGradientShape();
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
			this.warnGradientShape();
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
			this.warnGradientShape();
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
			this.warnGradientShape();
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
	}

	/**
	 * rebuild every GPU-facing resource after a device loss — the WebGPU
	 * analogue of the WebGL context-restore path
	 * @ignore
	 */
	async restoreDevice() {
		// tear down everything tied to the dead device
		this.abandonFrame();
		this.textureStore?.destroy();
		this.vertexArena?.destroy();
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
		this.depthTexture = null;
		this.device = undefined;
		this.adapter = undefined;
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
			this.uniformRing?.destroy();
			this.pipelineCache?.clear();
			this.captureTexture?.destroy();
			this.captureTexture = undefined;
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
			this.context.unconfigure();
			this.device.destroy();
			this.device = undefined;
			this.adapter = undefined;
		}
		this.isContextValid = false;
	}
}
