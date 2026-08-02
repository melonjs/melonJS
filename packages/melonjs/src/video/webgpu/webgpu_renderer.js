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
} from "../../system/event.ts";
import { Gradient } from "../gradient.js";
import Renderer from "../renderer.js";
import { createAtlas, TextureAtlas } from "../texture/atlas.js";
import TextureCache from "../texture/cache.js";
import { dashPath, dashSegments } from "../utils/dash.js";
import {
	generateJoinCircles,
	generateTriangleFan,
} from "../utils/tessellation.js";
import WebGPUPrimitiveBatcher from "./batchers/primitive_batcher.js";
import WebGPUQuadBatcher from "./batchers/quad_batcher.js";
import WebGPUBufferArena from "./buffer_arena.js";
import WebGPUPipelineCache, {
	DEPTH_STENCIL_FORMAT,
	normalizeBlendMode,
} from "./pipeline_cache.js";
import WebGPUTextureStore from "./texture_store.js";
import WebGPUUniformRing from "./uniform_ring.js";

// scratch matrix for the affine-components form of transform()
const _tempMatrix = new Matrix3d();

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
		this._currentGradient = null;
		/** @ignore */
		this._gradientShapeWarned = false;

		// scratch vertices for fillRect (2 triangles) and fillPolygon
		/** @ignore */
		this._rectTriangles = Array.from({ length: 6 }, () => {
			return { x: 0, y: 0 };
		});
		/** @ignore */
		this._polyVerts = [];
		// scratch bounds for the clipRect screen-space AABB derivation
		/** @ignore */
		this._clipAABB = new Bounds();
		// the stencil reference the masked render phase compares against
		/** @ignore */
		this._maskVisibleRef = 0;

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
		this._encoder = null;
		/** @ignore */
		this._pass = null;
		/** @ignore */
		this._frameView = null;
		/** @ignore */
		this._depthTexture = null;
		/** @ignore */
		this._currentPipeline = null;
		/** @ignore */
		this._currentFrameBinding = null;
		/** @ignore */
		this._scissorActive = false;
		// premultiplied-alpha flag mirrored from setBlendMode (pipeline key)
		/** @ignore */
		this._premultipliedAlpha = true;
		// stencil mode consulted by the pipeline lookup: "none"|"write"|"test"
		/** @ignore */
		this._stencilMode = "none";

		// reset the renderer on game reset (stored so destroy() can
		// unsubscribe — a rejected-then-retried `Application.init()`
		// constructs a fresh renderer per attempt, and the event bus must
		// not pin every abandoned one for the page's lifetime)
		this._onGameReset = () => {
			this.reset();
		};
		on(GAME_RESET, this._onGameReset);

		// keep the depth-stencil attachment sized with the canvas
		this._onCanvasResize = () => {
			if (typeof this.device !== "undefined") {
				this.flush();
				this._createDepthTexture();
			}
		};
		on(CANVAS_ONRESIZE, this._onCanvasResize);
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
				void this._restoreDevice().catch((err) => {
					console.warn("WebGPU device restore failed:", err);
				});
			}
		});

		this.preferredFormat = gpu.getPreferredCanvasFormat();
		this.context.configure({
			device: this.device,
			format: this.preferredFormat,
			alphaMode: this.settings.transparent ? "premultiplied" : "opaque",
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
		this.textureStore = new WebGPUTextureStore(this);
		this._createDepthTexture();

		// register the built-in batchers (device-dependent, so here rather
		// than the constructor — a device-loss restore re-runs this path)
		if (this.batchers.size === 0) {
			this.addBatcher(new WebGPUQuadBatcher(this), "quad", true);
			this.addBatcher(new WebGPUPrimitiveBatcher(this), "primitive");
		}

		this.isContextValid = true;
	}

	/**
	 * (re)create the depth-stencil attachment at the current canvas size
	 * @ignore
	 */
	_createDepthTexture() {
		const canvas = this.getCanvas();
		const width = Math.max(1, canvas.width);
		const height = Math.max(1, canvas.height);
		if (
			this._depthTexture &&
			this._depthTexture.width === width &&
			this._depthTexture.height === height
		) {
			return;
		}
		this._depthTexture?.destroy();
		this._depthTexture = this.device.createTexture({
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
		if (this._pass !== null) {
			this._abandonFrame();
		}

		this.vertexArena.reset();
		this.uniformRing.reset();
		// clear() also resets the stroke line width, like the GL backend
		this.lineWidth = 1;
		this._stencilMode = "none";
		this.maskLevel = 0;

		const [r, g, b, a] = this.backgroundColor.toArray();
		this._beginPass({
			colorLoadOp: "clear",
			clearValue: { r, g, b, a },
			stencilLoadOp: "clear",
		});

		// the frame's first frame-globals slot
		this._currentFrameBinding = this.uniformRing.pushFrameGlobals(
			this.projectionMatrix,
			this.lineWidth,
		);
	}

	/**
	 * open a render pass on the current frame's encoder (creating the
	 * encoder and acquiring the canvas texture on first use this frame)
	 * @param {object} [opts] - load operations for the pass
	 * @ignore
	 */
	_beginPass(opts = {}) {
		if (this._encoder === null) {
			this._encoder = this.device.createCommandEncoder({
				label: "melonJS frame",
			});
		}
		if (this._frameView === null) {
			this._frameView = this.context.getCurrentTexture().createView();
		}
		this._pass = this._encoder.beginRenderPass({
			label: "melonJS pass",
			colorAttachments: [
				{
					view: this._frameView,
					loadOp: opts.colorLoadOp ?? "load",
					clearValue: opts.clearValue,
					storeOp: "store",
				},
			],
			depthStencilAttachment: {
				view: this._depthTexture.createView(),
				depthLoadOp: "clear",
				depthClearValue: 1.0,
				depthStoreOp: "discard",
				stencilLoadOp: opts.stencilLoadOp ?? "load",
				stencilClearValue: 0,
				stencilStoreOp: "store",
			},
		});
		const canvas = this.getCanvas();
		this._pass.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
		this._applyScissor();
		// pipeline/bind state does not carry across passes
		this._currentPipeline = null;
	}

	/**
	 * a draw is about to be recorded outside the clear()/flush() bracket
	 * (unit tests, user code) — open a pass that preserves the canvas.
	 * Also the pass-restart primitive: masks break the pass to clear the
	 * stencil, post effects will break it to retarget.
	 * @ignore
	 */
	_ensurePass() {
		if (this._pass === null) {
			this._beginPass();
		}
		return this._pass;
	}

	/**
	 * end the open pass and submit the frame's command buffer
	 * @override
	 */
	flush() {
		this.currentBatcher?.flush();
		if (this._pass !== null) {
			this._pass.end();
			this._pass = null;
		}
		if (this._encoder !== null) {
			this.device.queue.submit([this._encoder.finish()]);
			this._encoder = null;
			this._frameView = null;
		}
	}

	/**
	 * drop the open pass and encoder without submitting (mid-frame
	 * exception recovery, reset, destroy)
	 * @ignore
	 */
	_abandonFrame() {
		if (this._pass !== null) {
			this._pass.end();
			this._pass = null;
		}
		// an encoder cannot be discarded explicitly — finish it and drop
		// the command buffer unsubmitted
		if (this._encoder !== null) {
			this._encoder.finish();
			this._encoder = null;
		}
		this._frameView = null;
		this._currentPipeline = null;
	}

	/**
	 * re-apply the current scissor state to the open pass
	 * @ignore
	 */
	_applyScissor() {
		if (this._pass === null) {
			return;
		}
		const canvas = this.getCanvas();
		if (this._scissorActive === true) {
			const s = this.currentScissor;
			this._pass.setScissorRect(s[0], s[1], s[2], s[3]);
		} else {
			this._pass.setScissorRect(0, 0, canvas.width, canvas.height);
		}
	}

	/**
	 * Clear the current clip region with the given color — a full-viewport
	 * triangle clipped by the active scissor, drawn with blending replaced
	 * (WebGPU has no scissored clear operation). Used mid-frame by
	 * ColorLayer and Container backgrounds.
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
		const pass = this._ensurePass();

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
			this._stencilMode === "test" ? "test" : "none",
		);
		pass.setPipeline(pipeline);
		pass.setBindGroup(0, slot.bindGroup, [slot.dynamicOffset]);
		pass.draw(3);
		// the clear draw invalidated the tracked pipeline/bindings
		this._currentPipeline = null;
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
				_tempMatrix.setTransform(
					a,
					b,
					0,
					0,
					c,
					d,
					0,
					0,
					0,
					0,
					1,
					0,
					e,
					f,
					0,
					1,
				),
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
		this.renderState.save(this._scissorActive === true);
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
		const curActive = this._scissorActive === true;
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
				this._scissorActive = result.scissorActive === true;
				this._applyScissor();
			}
		}
		// sync gradient and shader from renderState
		this._currentGradient = this.renderState.currentGradient;
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
			this._currentGradient = color;
		} else {
			this.renderState.currentGradient = null;
			this._currentGradient = null;
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
			this._premultipliedAlpha !== premultipliedAlpha
		) {
			this.currentBatcher?.flush();
			this.currentBlendMode = normalized;
			this._premultipliedAlpha = premultipliedAlpha;
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
		if (this.uniformRing !== null && this._pass !== null) {
			this._currentFrameBinding = this.uniformRing.pushFrameGlobals(
				this.projectionMatrix,
				this.lineWidth,
			);
		}
	}

	/**
	 * push a fresh frame-globals slot after a lineWidth change
	 * @ignore
	 */
	_pushFrameGlobals() {
		this._currentFrameBinding = this.uniformRing.pushFrameGlobals(
			this.projectionMatrix,
			this.lineWidth,
		);
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
			if (this._scissorActive) {
				// drain pending vertices under the active scissor first
				this.currentBatcher?.flush();
				this._scissorActive = false;
				this._applyScissor();
			}
			return;
		}

		// derive the screen-space AABB by feeding the rect's 4 corners
		// through `currentTransform` — any rotation collapses to the
		// rotated-rect AABB on screen, same as the GL scissor (#1349)
		const aabb = this._clipAABB;
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
			if (this._scissorActive) {
				this.currentBatcher?.flush();
				this._scissorActive = false;
				this._applyScissor();
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
			this._scissorActive &&
			cs[0] === sx &&
			cs[1] === sy &&
			cs[2] === sw &&
			cs[3] === sh
		) {
			return; // already at the right scissor
		}
		// drain vertices queued under the previous clip state
		this.currentBatcher?.flush();
		this._scissorActive = true;
		cs[0] = sx;
		cs[1] = sy;
		cs[2] = sw;
		cs[3] = sh;
		this._applyScissor();
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
			if (this._pass !== null) {
				this._pass.end();
				this._pass = null;
			}
			this._beginPass({ stencilLoadOp: "clear" });
		}

		this.maskLevel++;
		if (this.maskLevel > 0xff) {
			this.maskLevel = 0xff;
			if (this._maskDepthWarned !== true) {
				this._maskDepthWarned = true;
				console.warn(
					"melonJS: setMask nesting deeper than 255 — mask level clamped",
				);
			}
		}

		// write phase: every fragment of the mask shape increments the
		// stencil (color writes disabled by the pipeline variant)
		this._stencilMode = "write";
		this.fill(mask);
		this.currentBatcher?.flush();

		// render phase: draw only where the stencil matches
		this._stencilMode = "test";
		this._maskVisibleRef = invert === true ? 0 : this.maskLevel;
		this._ensurePass().setStencilReference(this._maskVisibleRef);
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
		this._stencilMode = "none";
		this._maskVisibleRef = 0;
	}

	/**
	 * gradient fills of arbitrary shapes need the stencil gradient-mask
	 * machinery (deferred with post effects) — fall back to a solid fill
	 * with a one-time console warning
	 * @ignore
	 */
	_warnGradientShape() {
		if (this._gradientShapeWarned !== true) {
			this._gradientShapeWarned = true;
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
		if (this._currentGradient) {
			this._warnGradientShape();
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
		if (this._currentGradient) {
			this._warnGradientShape();
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
		if (this._currentGradient) {
			this._warnGradientShape();
		}
		this.setBatcher("primitive");
		this.translate(poly.pos.x, poly.pos.y);
		const indices = poly.getIndices();
		const points = poly.points;
		const verts = this._polyVerts;
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
		if (this._currentGradient) {
			// toCanvas() bakes the gradient through the Canvas 2D API and
			// draws it as a textured quad — same path as the GL backend
			const canvas = this._currentGradient.toCanvas(this, x, y, width, height);
			this.drawImage(canvas, 0, 0, width, height, x, y, width, height);
			return;
		}
		this.setBatcher("primitive");
		// 2 triangles directly — avoids path2D + earcut overhead
		const right = x + width;
		const bottom = y + height;
		const pts = this._rectTriangles;
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
		if (this._currentGradient) {
			this._warnGradientShape();
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
	async _restoreDevice() {
		// tear down everything tied to the dead device
		this._abandonFrame();
		this.textureStore?.destroy();
		this.vertexArena?.destroy();
		this.uniformRing?.destroy();
		this.pipelineCache?.clear();
		this._depthTexture = null;
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
		this._abandonFrame();
		super.reset();
		// re-init batchers when recovering from a device loss, plain reset
		// otherwise — the same split as the WebGL restore path
		for (const batcher of this.batchers.values()) {
			if (this.isContextValid === false) {
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
		off(GAME_RESET, this._onGameReset);
		off(CANVAS_ONRESIZE, this._onCanvasResize);
		this._abandonFrame();
		if (typeof this.device !== "undefined") {
			for (const batcher of this.batchers.values()) {
				batcher.destroy();
			}
			this.textureStore?.destroy();
			this.vertexArena?.destroy();
			this.uniformRing?.destroy();
			this.pipelineCache?.clear();
			this._depthTexture?.destroy();
			this._depthTexture = null;
			this.context.unconfigure();
			this.device.destroy();
			this.device = undefined;
			this.adapter = undefined;
		}
		this.isContextValid = false;
	}
}
