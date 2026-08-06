import RenderTarget from "./rendertarget.ts";

/**
 * WebGPU offscreen render target — the WebGPU counterpart of the WebGL
 * FBO-backed {@link WebGLRenderTarget}, used by the post-effect chain
 * through the shared {@link RenderTargetPool}.
 *
 * Owns one color `GPUTexture` (renderable AND sampleable — the whole point
 * of a post-effect target) in the renderer's preferred canvas format, so
 * pipelines keyed on that format serve canvas and offscreen passes alike.
 * The depth-stencil attachment is NOT per-target: every pass shares the
 * renderer's canvas-sized depth-stencil texture (targets in this flow are
 * canvas-sized, only one pass is open at a time — and sharing the stencil
 * means a mask active around a post-effect renderable keeps clipping its
 * offscreen content, which is what masks promise).
 *
 * Under the recording model "binding" a target is a pass break: draws
 * recorded after {@link WebGPURenderer#setRenderTarget} land in a new pass
 * whose color attachment is this texture. Mid-frame resize/destroy retire
 * the texture (a texture referenced by recorded draws must not be
 * destroyed before submit).
 * @augments RenderTarget
 * @category Rendering
 */
export default class WebGPURenderTarget extends RenderTarget {
	/**
	 * @param {import("../webgpu/webgpu_renderer.js").default} renderer - the owning renderer
	 * @param {number} width - width in pixels
	 * @param {number} height - height in pixels
	 */
	constructor(renderer, width, height, options = {}) {
		super();
		this.renderer = renderer;
		this.width = 0;
		this.height = 0;
		/**
		 * MSAA sample count for scene rasterization into this target
		 * (1 = single-sampled). When > 1 the target owns a multisampled
		 * color texture that passes rasterize into and resolve into
		 * `texture` at every pass end — so anything sampling the target
		 * always sees resolved pixels.
		 * @type {number}
		 */
		this.sampleCount = options.sampleCount ?? 1;
		/** @type {GPUTexture|null} */
		this.texture = null;
		/** @type {GPUTextureView|null} */
		this.colorView = null;
		/** the multisampled render half, when sampleCount > 1 @type {GPUTexture|null} */
		this.msaaTexture = null;
		/** @type {GPUTextureView|null} */
		this.msaaView = null;
		/**
		 * bumped whenever the backing texture is reallocated — cached bind
		 * groups referencing the old view key on this
		 * @type {number}
		 */
		this.generation = 0;
		// lazy (view + linear clamp sampler) pairing against the material
		// layout — what a blit binds at group 1 to sample this target
		this.materialBindGroup = null;
		this.materialBindGroupGeneration = -1;
		// consumed by the renderer as a colorLoadOp "clear" on next retarget
		this.pendingClear = false;

		this.resize(width, height);
	}

	/**
	 * (Re)create the backing texture at the given size. No-op when the size
	 * is unchanged; otherwise the old texture retires (mid-frame safe) and
	 * `generation` advances so stale bind groups rebuild.
	 * @param {number} width - new width in pixels
	 * @param {number} height - new height in pixels
	 */
	resize(width, height) {
		width = Math.max(1, width | 0);
		height = Math.max(1, height | 0);
		if (this.width === width && this.height === height) {
			return;
		}
		if (this.texture !== null) {
			this.renderer.retireTexture(this.texture);
		}
		this.width = width;
		this.height = height;
		this.texture = this.renderer.device.createTexture({
			label: "melonJS render target",
			size: [width, height],
			format: this.renderer.preferredFormat,
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT |
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_SRC,
		});
		this.colorView = this.texture.createView();
		if (this.sampleCount > 1) {
			if (this.msaaTexture !== null) {
				this.renderer.retireTexture(this.msaaTexture);
			}
			// per-target (not the renderer's shared canvas MSAA texture):
			// nested effect brackets interleave passes on DIFFERENT targets,
			// and a mid-frame pass restart loads the stored samples back —
			// sharing one multisampled texture would load another target's
			this.msaaTexture = this.renderer.device.createTexture({
				label: "melonJS render target msaa",
				size: [width, height],
				sampleCount: this.sampleCount,
				format: this.renderer.preferredFormat,
				usage: GPUTextureUsage.RENDER_ATTACHMENT,
			});
			this.msaaView = this.msaaTexture.createView();
		}
		this.generation++;
	}

	/**
	 * Request a clear on next use: consumed as the pass's `colorLoadOp:
	 * "clear"` when the renderer next targets this — cheaper than a clearing
	 * draw, and the WebGPU analogue of `clearRenderTarget`.
	 */
	clear() {
		this.pendingClear = true;
	}

	/**
	 * make this target the active draw destination (a pass break under the
	 * recording model)
	 * @override
	 */
	bind() {
		this.renderer.setRenderTarget(this);
	}

	/**
	 * restore the canvas as the draw destination
	 * @override
	 */
	unbind() {
		this.renderer.setRenderTarget(null);
	}

	/**
	 * The group-1 (material) bind group sampling this target with a linear
	 * clamp sampler — what the effect blit binds as its source. Rebuilt
	 * lazily when the backing texture was reallocated.
	 * @returns {GPUBindGroup} the bind group
	 * @ignore
	 */
	getMaterialBindGroup() {
		if (
			this.materialBindGroup === null ||
			this.materialBindGroupGeneration !== this.generation
		) {
			const renderer = this.renderer;
			this.materialBindGroup = renderer.device.createBindGroup({
				label: "melonJS render-target material",
				layout: renderer.pipelineCache.materialLayout,
				entries: [
					{ binding: 0, resource: this.colorView },
					{
						binding: 1,
						resource: renderer.textureStore.getSampler("linear", "no-repeat"),
					},
				],
			});
			this.materialBindGroupGeneration = this.generation;
		}
		return this.materialBindGroup;
	}

	/**
	 * Synchronous readback is impossible under WebGPU — use
	 * {@link WebGPURenderTarget#readPixels}.
	 * @throws {Error} always
	 * @override
	 */
	getImageData() {
		throw new Error(
			"WebGPURenderTarget.getImageData: WebGPU readback is asynchronous — use `await target.readPixels()` instead",
		);
	}

	/**
	 * Asynchronously read back this target's pixels.
	 * @param {number} [x=0] - x of the top-left corner
	 * @param {number} [y=0] - y of the top-left corner
	 * @param {number} [width=this.width] - width of the area to read
	 * @param {number} [height=this.height] - height of the area to read
	 * @returns {Promise<ImageData>} the pixel data (RGBA order)
	 */
	async readPixels(x = 0, y = 0, width = this.width, height = this.height) {
		const renderer = this.renderer;
		const device = renderer.device;
		// clamp the read window to the target (an out-of-bounds copy is a
		// validation error, where a caller passing only x/y expects a crop)
		x = Math.max(0, x | 0);
		y = Math.max(0, y | 0);
		width = Math.max(1, Math.min(width | 0, this.width - x));
		height = Math.max(1, Math.min(height | 0, this.height - y));
		// bytesPerRow must be a multiple of 256
		const bytesPerRow = (width * 4 + 255) & ~255;
		const buffer = device.createBuffer({
			label: "melonJS readback",
			size: bytesPerRow * height,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		});
		try {
			// pending draws into this target must land before the copy
			renderer.flush();
			const encoder = device.createCommandEncoder({
				label: "melonJS readback",
			});
			encoder.copyTextureToBuffer(
				{ texture: this.texture, origin: { x, y } },
				{ buffer, bytesPerRow },
				[width, height],
			);
			device.queue.submit([encoder.finish()]);
			await buffer.mapAsync(GPUMapMode.READ);
			const mapped = new Uint8Array(buffer.getMappedRange());
			const out = new Uint8ClampedArray(width * height * 4);
			const bgra = renderer.preferredFormat.startsWith("bgra");
			for (let row = 0; row < height; row++) {
				const src = row * bytesPerRow;
				const dst = row * width * 4;
				for (let px = 0; px < width; px++) {
					const s = src + px * 4;
					const d = dst + px * 4;
					if (bgra) {
						out[d] = mapped[s + 2];
						out[d + 1] = mapped[s + 1];
						out[d + 2] = mapped[s];
					} else {
						out[d] = mapped[s];
						out[d + 1] = mapped[s + 1];
						out[d + 2] = mapped[s + 2];
					}
					out[d + 3] = mapped[s + 3];
				}
			}
			buffer.unmap();
			return new ImageData(out, width, height);
		} finally {
			buffer.destroy();
		}
	}

	/**
	 * Release the backing texture (retired when a frame is recording).
	 * @override
	 */
	destroy() {
		if (this.texture !== null) {
			this.renderer.retireTexture(this.texture);
			this.texture = null;
			this.colorView = null;
		}
		if (this.msaaTexture !== null) {
			this.renderer.retireTexture(this.msaaTexture);
			this.msaaTexture = null;
			this.msaaView = null;
		}
		this.materialBindGroup = null;
		this.width = 0;
		this.height = 0;
	}
}
