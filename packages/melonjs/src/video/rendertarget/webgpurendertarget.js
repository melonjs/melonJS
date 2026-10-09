import RenderTarget from "./rendertarget.ts";

/**
 * Decode one IEEE half (the `rgba16float` channel type) to a JS number.
 *
 * Written out rather than using `Float16Array`, which is recent enough that
 * a readback would throw on browsers this backend otherwise runs on.
 * @param {number} h - the 16 raw bits
 * @returns {number} the value
 * @ignore
 * @internal
 */
function halfToFloat(h) {
	const sign = h & 0x8000 ? -1 : 1;
	const exponent = (h & 0x7c00) >> 10;
	const fraction = h & 0x03ff;
	if (exponent === 0) {
		// subnormal, including zero
		return sign * 2 ** -14 * (fraction / 1024);
	}
	if (exponent === 0x1f) {
		return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
	}
	return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

/**
 * WebGPU offscreen render target — the WebGPU counterpart of the WebGL
 * FBO-backed {@link WebGLRenderTarget}, used by the post-effect chain
 * through the shared {@link RenderTargetPool}.
 *
 * Owns one color `GPUTexture` (renderable AND sampleable — the whole point
 * of a post-effect target). Its format is the renderer's preferred canvas
 * format by default, so pipelines keyed on that format serve canvas and
 * offscreen passes alike, and `"rgba16float"` for the camera chain under the
 * `hdr` setting. The pipeline cache already keys on format, so both kinds
 * coexist compiled.
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
		/**
		 * Texture format of the color attachment, defaulting to the surface's
		 * preferred format. The renderer passes `"rgba16float"` for the
		 * camera chain when the `hdr` setting is on, which is what lets the
		 * chain carry values above 1 instead of clamping at every write.
		 *
		 * Both halves take it, or the MSAA resolve has nothing to resolve
		 * between, and every pipeline recorded into a pass targeting this
		 * must declare the same one — `setRenderTarget` drives that through
		 * the pipeline cache, which already keys on format.
		 * @type {string}
		 */
		this.format = options.format ?? renderer.preferredFormat;
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
			format: this.format,
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
				format: this.format,
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
	 * @internal
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
	 * {@link RenderTarget#toImageData}.
	 *
	 * Kept, and kept throwing, so the two backends that DO read back
	 * synchronously can still be used that way without this one silently
	 * returning something wrong.
	 * @throws {Error} always
	 */
	getImageData() {
		throw new Error(
			"WebGPURenderTarget.getImageData: WebGPU readback is asynchronous — use `await target.toImageData()` instead",
		);
	}

	/**
	 * Read back pixel data from this render target.
	 *
	 * The portable readback, and the ONLY form this backend can offer: WebGPU
	 * maps its buffer asynchronously, which is why the shared contract is a
	 * promise. See {@link RenderTarget#toImageData}.
	 * @param {number} [x=0] - x of the top-left corner
	 * @param {number} [y=0] - y of the top-left corner
	 * @param {number} [width=this.width] - width of the area to read
	 * @param {number} [height=this.height] - height of the area to read
	 * @returns {Promise<ImageData>} the pixel data (RGBA order)
	 */
	async toImageData(x = 0, y = 0, width = this.width, height = this.height) {
		const renderer = this.renderer;
		const device = renderer.device;
		// clamp the read window to the target (an out-of-bounds copy is a
		// validation error, where a caller passing only x/y expects a crop)
		x = Math.max(0, x | 0);
		y = Math.max(0, y | 0);
		width = Math.max(1, Math.min(width | 0, this.width - x));
		height = Math.max(1, Math.min(height | 0, this.height - y));
		// A half-float attachment is EIGHT bytes per pixel, not four. Reading
		// it with the 8-bit stride would walk half the rows and return a
		// buffer that looks plausible and is wrong, which is worse than a
		// failure.
		const half = this.format === "rgba16float";
		const bytesPerPixel = half ? 8 : 4;
		// bytesPerRow must be a multiple of 256
		const bytesPerRow = (width * bytesPerPixel + 255) & ~255;
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
			const out = new Uint8ClampedArray(width * height * 4);
			if (half) {
				// Clamped, not tone mapped. A value above 1 has nowhere to go
				// in an 8-bit `ImageData`, and quietly applying a curve here
				// would make the readback disagree with what the canvas
				// showed: the frame on screen went through whatever tone map
				// the game installed, and guessing a different one would be
				// worse than clipping.
				const words = new Uint16Array(buffer.getMappedRange());
				const stride = bytesPerRow / 2;
				for (let row = 0; row < height; row++) {
					const src = row * stride;
					const dst = row * width * 4;
					for (let px = 0; px < width; px++) {
						const s = src + px * 4;
						const d = dst + px * 4;
						// Uint8ClampedArray does the clamping; the 255 scale
						// is the only arithmetic needed
						out[d] = halfToFloat(words[s]) * 255;
						out[d + 1] = halfToFloat(words[s + 1]) * 255;
						out[d + 2] = halfToFloat(words[s + 2]) * 255;
						out[d + 3] = halfToFloat(words[s + 3]) * 255;
					}
				}
				buffer.unmap();
				buffer.destroy();
				return new ImageData(out, width, height);
			}
			const mapped = new Uint8Array(buffer.getMappedRange());
			// rgba16float is RGBA by name; only the 8-bit surface format can
			// be the swapped one
			// THIS target's format, not the canvas's: an offscreen target can
			// be rgba while the surface is bgra, and reading one through the
			// other's channel order swaps red and blue
			const bgra = this.format.startsWith("bgra");
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
