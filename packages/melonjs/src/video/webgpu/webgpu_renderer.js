import {
	emit,
	GAME_RESET,
	ONCONTEXT_LOST,
	off,
	on,
} from "../../system/event.ts";
import Renderer from "../renderer.js";
import TextureCache from "../texture/cache.js";

/**
 * The **experimental** WebGPU renderer.
 *
 * What exists today is the asynchronous bootstrap — the part of a WebGPU
 * backend that shapes the rest of the engine: `getContext("webgpu")` at
 * construction, then adapter/device negotiation and canvas configuration in
 * {@link WebGPURenderer#init} (the reason {@link Application#init} is
 * asynchronous at all) — plus a real per-frame {@link WebGPURenderer#clear
 * clear pass}. Every other drawing method is still the base {@link Renderer}
 * no-op, so a WebGPU application boots, runs its loop, resizes correctly and
 * clears to its background color — and renders nothing else.
 *
 * It is therefore **opt-in only**: `renderer: video.WEBGPU` (or the
 * `#webgpu` URI fragment). `video.AUTO` never selects it, and will not
 * until it reaches feature parity with the WebGL backend.
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

		// reset the renderer on game reset (stored so destroy() can
		// unsubscribe — a rejected-then-retried `Application.init()`
		// constructs a fresh renderer per attempt, and the event bus must
		// not pin every abandoned one for the page's lifetime)
		this._onGameReset = () => {
			this.reset();
		};
		on(GAME_RESET, this._onGameReset);
	}

	/**
	 * Negotiate the GPU adapter and device, and configure the canvas
	 * context against them. Awaited by {@link Application#init} right
	 * after construction — a WebGPU device cannot be acquired
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
		// only announce losses the application did not ask for
		void this.device.lost.then((lossInfo) => {
			if (lossInfo.reason !== "destroyed") {
				this.isContextValid = false;
				emit(ONCONTEXT_LOST, this);
			}
		});

		this.preferredFormat = gpu.getPreferredCanvasFormat();
		this.context.configure({
			device: this.device,
			format: this.preferredFormat,
			alphaMode: this.settings.transparent ? "premultiplied" : "opaque",
		});

		this.isContextValid = true;
	}

	/**
	 * Clear the frame to the renderer's background color — a full clear
	 * render pass, the canonical first WebGPU submission. The one visible
	 * thing the experimental backend does: per-frame proof that the
	 * negotiated device, queue and configured context work end-to-end.
	 * @override
	 */
	clear() {
		if (typeof this.device === "undefined") {
			return;
		}
		// a zero-sized canvas (auto-scale inside a hidden/collapsed parent)
		// has no valid current texture — submitting a pass against it would
		// generate a device validation error every frame
		const canvas = this.getCanvas();
		if (canvas.width === 0 || canvas.height === 0) {
			return;
		}
		const [r, g, b, a] = this.backgroundColor.toArray();
		const encoder = this.device.createCommandEncoder();
		const pass = encoder.beginRenderPass({
			colorAttachments: [
				{
					view: this.context.getCurrentTexture().createView(),
					clearValue: { r, g, b, a },
					loadOp: "clear",
					storeOp: "store",
				},
			],
		});
		pass.end();
		this.device.queue.submit([encoder.finish()]);
	}

	/**
	 * Returns the WebGPU canvas context
	 * @returns {GPUCanvasContext} the WebGPU canvas context
	 */
	getContext() {
		return this.context;
	}

	/**
	 * Release the GPU device and unconfigure the canvas context.
	 * Called by {@link Application#destroy}.
	 * @override
	 */
	destroy() {
		off(GAME_RESET, this._onGameReset);
		if (typeof this.device !== "undefined") {
			this.context.unconfigure();
			this.device.destroy();
			this.device = undefined;
			this.adapter = undefined;
		}
		this.isContextValid = false;
	}
}
