import Texture2d from "../../texture/texture2d.ts";

/**
 * The WebGPU counterpart of the WebGL `FrameTexture`: a GPU-resident
 * capture of the frame rendered so far, refreshed IN PLACE by
 * {@link WebGPURenderer#captureFrame} via `copyTextureToTexture` — an
 * encoder-ordered command, so the copy sees exactly the draws recorded
 * before the capture point and none after (no queue-write retroactivity).
 *
 * Effects sample it through the `screen_texture` builtin: the effect's
 * group-3 bind group binds `view`, keyed by `generation` so a size-change
 * reallocation rebuilds stale bind groups. `isGPUResident` keeps the
 * `setTexture` discriminant contract of the WebGL twin.
 * @augments Texture2d
 * @ignore
 */
export class WebGPUFrameTexture extends Texture2d {
	/**
	 * monotonic generation source shared by every capture instance
	 * @ignore
	 */
	static generationCounter = 0;

	/**
	 * @param {import("../webgpu_renderer.js").default} renderer - the owning renderer
	 * @param {number} width - capture width in pixels
	 * @param {number} height - capture height in pixels
	 */
	constructor(renderer, width, height) {
		super();
		this.renderer = renderer;
		/**
		 * marks this as a live GPU-resident source — see {@link ShaderEffect#setTexture}
		 * @type {boolean}
		 */
		this.isGPUResident = true;
		/** @type {GPUTexture} */
		this.gpuTexture = null;
		this.realloc(width, height);
	}

	/**
	 * (Re)allocate the backing texture at the given size, keeping this
	 * object's identity — the caller-owned-refresh contract of
	 * `toFrameTexture({target})`. The old texture is retired (draws
	 * already recorded against it stay valid) and `generation` advances,
	 * so bind groups referencing the old view re-key instead of pointing
	 * at a destroyed texture and failing every subsequent submit.
	 * @param {number} width - capture width in pixels
	 * @param {number} height - capture height in pixels
	 */
	realloc(width, height) {
		if (this.gpuTexture !== null) {
			this.renderer.retireTexture(this.gpuTexture);
		}
		/** @type {number} */
		this.width = width;
		/** @type {number} */
		this.height = height;
		/**
		 * unique per allocation (module-wide counter) — the bind-group key
		 * @type {number}
		 */
		this.generation = ++WebGPUFrameTexture.generationCounter;
		this.gpuTexture = this.renderer.device.createTexture({
			label: "melonJS frame capture",
			size: [width, height],
			format: this.renderer.preferredFormat,
			usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
		});
		/** @type {GPUTextureView} */
		this.view = this.gpuTexture.createView();
	}

	/**
	 * The opaque GPU-resident backing — itself.
	 * @returns {WebGPUFrameTexture}
	 */
	getTexture() {
		return this;
	}

	/**
	 * Release the backing texture (retired if a frame is recording, so
	 * draws already recorded against it stay valid). Idempotent.
	 */
	destroy() {
		if (this.gpuTexture !== null) {
			this.renderer.retireTexture(this.gpuTexture);
			this.gpuTexture = null;
			this.view = null;
		}
	}
}

export default WebGPUFrameTexture;
