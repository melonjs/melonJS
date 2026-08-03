import { GPU_TEXTURE_CACHE_RESET, off, on } from "../../../system/event.ts";
import { COMPRESSED_FORMATS, uploadCompressedTexture } from "./compressed.js";

/**
 * Renderer-owned GPU texture store for the WebGPU backend — the counterpart
 * of `MaterialBatcher`'s createTexture2D/bindTexture2D/deleteTexture2D tier,
 * kept on the renderer (rather than a batcher) so the quad path and the
 * future mesh / tile-layer paths share one resident-texture map.
 *
 * The engine-side bookkeeping is untouched: `TextureCache` still allocates
 * the logical "unit" for each `(source, repeat)` pair; here a unit keys a
 * `{GPUTexture, view, bind groups}` record instead of a GL texture binding.
 * Bind groups pair the texture view with a cached `GPUSampler` — one bind
 * group per (texture, sampler) combination, invalidated wholesale when the
 * filter setting changes (textures stay resident; only the pairing is
 * rebuilt — the WebGPU analogue of `_reapplyTextureFilter`, without the
 * re-parameterization).
 * @ignore
 */
export default class WebGPUTextureStore {
	/**
	 * @param {import("../webgpu_renderer.js").default} renderer - the owning renderer
	 */
	constructor(renderer) {
		this.renderer = renderer;
		this.device = renderer.device;
		/** @type {Map<number, {texture: GPUTexture, view: GPUTextureView, source: object, width: number, height: number, frameId: number, bindGroupBySampler: Map<string, GPUBindGroup>}>} */
		this.records = new Map();
		/** @type {Map<string, GPUSampler>} */
		this.samplers = new Map();

		// drop every unit → texture association when the cache resets
		// (unit numbers get reassigned; resident GPU textures would map to
		// the wrong sources). Mirrors MaterialBatcher._onTextureCacheReset.
		this.onCacheReset = () => {
			this.releaseAll();
		};
		on(GPU_TEXTURE_CACHE_RESET, this.onCacheReset);
	}

	/**
	 * resolve (creating on first use) the sampler for a filter/wrap combo
	 * @param {string} filter - "nearest" | "linear"
	 * @param {string} repeat - engine wrap mode string
	 * @returns {GPUSampler} the sampler
	 * @ignore
	 */
	getSampler(filter, repeat) {
		// same per-axis mapping as MaterialBatcher.createTexture2D
		const addressModeU = /^repeat(-x)?$/.test(repeat)
			? "repeat"
			: "clamp-to-edge";
		const addressModeV = /^repeat(-y)?$/.test(repeat)
			? "repeat"
			: "clamp-to-edge";
		const key = `${filter}|${addressModeU}|${addressModeV}`;
		let sampler = this.samplers.get(key);
		if (typeof sampler === "undefined") {
			sampler = this.device.createSampler({
				label: `melonJS sampler ${key}`,
				magFilter: filter,
				minFilter: filter,
				addressModeU,
				addressModeV,
			});
			this.samplers.set(key, sampler);
		}
		return sampler;
	}

	/**
	 * The per-draw entry point: resolve the atlas to a bind group pairing
	 * its resident GPU texture with the currently-applicable sampler,
	 * uploading the source on first use (or re-uploading when forced — the
	 * video-frame path).
	 * @param {object} texture - a TextureAtlas
	 * @param {object} [options] - resolution options
	 * @param {boolean} [options.force=false] - re-upload the source pixels
	 * @param {string} [options.repeat] - per-use wrap override (else texture.repeat)
	 * @returns {GPUBindGroup} the material bind group for this draw
	 */
	getBinding(texture, options = {}) {
		const wrap =
			typeof options.repeat === "string"
				? options.repeat
				: (texture.repeat ?? "no-repeat");
		const unit = this.renderer.cache.getUnit(texture, wrap);
		let record = this.records.get(unit);
		const source = texture.getTexture();

		// A unit number is not a stable identity: the TextureCache recycles
		// units when sources are unloaded (stage switches free the loading
		// screen's assets, for instance), and there is no per-unit release
		// event — so a resident record must be validated against the SOURCE
		// it was uploaded from, or a recycled unit serves stale pixels.
		if (
			typeof record === "undefined" ||
			options.force === true ||
			record.source !== source
		) {
			// compressed sources (parsed dds/ktx/pvr/pkm) carry pre-encoded
			// block data: a dedicated createTexture + per-mip writeTexture
			// path, and static content — no same-frame re-upload concerns
			if (source.compressed === true) {
				if (typeof record === "undefined" || record.source !== source) {
					const metrics = COMPRESSED_FORMATS.get(source.format);
					if (typeof metrics === "undefined") {
						throw new Error(
							`WebGPUTextureStore: unsupported compressed texture format 0x${source.format.toString(16)}`,
						);
					}
					if (typeof record !== "undefined") {
						this.retire(record.texture);
					}
					const gpuTexture = this.device.createTexture({
						label: "melonJS compressed texture",
						size: [source.width, source.height],
						format: metrics.format,
						mipLevelCount: source.mipmaps.length,
						// compressed formats cannot be render attachments
						usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
					});
					uploadCompressedTexture(this.device, gpuTexture, source, metrics);
					record = {
						texture: gpuTexture,
						// GL parity: the GL backend samples compressed textures
						// with plain LINEAR/NEAREST min filters and never the
						// mip chain — restrict the bind-group view to level 0
						// (the full chain stays uploaded in the texture)
						view: gpuTexture.createView({
							baseMipLevel: 0,
							mipLevelCount: 1,
						}),
						source,
						width: source.width,
						height: source.height,
						frameId: -1,
						compressed: true,
						bindGroupBySampler: new Map(),
					};
					this.records.set(unit, record);
				}
				record.frameId = this.renderer.frameId;
				this.lastRecord = record;
				return this.bindGroupFor(record, texture, wrap);
			}
			// prefer real pixel dimensions; HTMLVideoElement exposes them
			// through videoWidth/videoHeight (width/height default to 0)
			const width = source.width || source.videoWidth || 1;
			const height = source.height || source.videoHeight || 1;

			// An in-place re-upload is retroactive: queue writes execute
			// before EVERY draw recorded this frame, so a record already
			// sampled this frame must get a fresh texture or earlier draws
			// would show the new pixels (shared canvases — gradients, Text —
			// bake different content into the same source mid-frame).
			if (
				typeof record === "undefined" ||
				record.width !== width ||
				record.height !== height ||
				record.frameId === this.renderer.frameId ||
				// a recycled unit whose resident texture came from the
				// compressed path cannot adopt an image source: its format
				// is non-renderable and copyExternalImageToTexture would
				// fail validation while the stale pixels kept serving
				record.compressed === true
			) {
				// (re)create at the source size; the replaced texture retires
				// at frame end — destroying it now would invalidate draws
				// already recorded against it (submit rejects the whole frame)
				if (typeof record !== "undefined") {
					this.retire(record.texture);
				}
				const gpuTexture = this.device.createTexture({
					label: "melonJS texture",
					size: [width, height],
					format: "rgba8unorm",
					// RENDER_ATTACHMENT is required by copyExternalImageToTexture
					usage:
						GPUTextureUsage.TEXTURE_BINDING |
						GPUTextureUsage.COPY_DST |
						GPUTextureUsage.RENDER_ATTACHMENT,
				});
				record = {
					texture: gpuTexture,
					view: gpuTexture.createView(),
					source,
					width,
					height,
					frameId: -1,
					bindGroupBySampler: new Map(),
				};
				this.records.set(unit, record);
			} else {
				// same-size unit reuse, not yet drawn this frame (recycled
				// unit, or a video frame): keep the resident texture + bind
				// groups, adopt the source
				record.source = source;
			}

			// same premultiplication convention as the GL path's
			// UNPACK_PREMULTIPLY_ALPHA_WEBGL default; no flipY (both APIs
			// store row 0 = image top)
			this.device.queue.copyExternalImageToTexture(
				{ source },
				{
					texture: record.texture,
					premultipliedAlpha: texture.premultipliedAlpha !== false,
				},
				[record.width, record.height],
			);
		}

		// stamp: this record's texture is (about to be) referenced by draws
		// recorded in the current frame
		record.frameId = this.renderer.frameId;

		// stash for getResidentRecord — composers (the lit batcher) build
		// combined bind groups from the raw view
		this.lastRecord = record;

		return this.bindGroupFor(record, texture, wrap);
	}

	/**
	 * the per-sampler material bind group for a resident record (shared by
	 * the image and compressed upload paths)
	 * @ignore
	 */
	bindGroupFor(record, texture, wrap) {
		const filter =
			typeof texture.filter === "string"
				? texture.filter
				: this.renderer.getDefaultTextureFilter();
		const samplerKey = `${filter}|${wrap}`;
		let bindGroup = record.bindGroupBySampler.get(samplerKey);
		if (typeof bindGroup === "undefined") {
			bindGroup = this.device.createBindGroup({
				label: "melonJS material",
				layout: this.renderer.pipelineCache.materialLayout,
				entries: [
					{ binding: 0, resource: record.view },
					{ binding: 1, resource: this.getSampler(filter, wrap) },
				],
			});
			record.bindGroupBySampler.set(samplerKey, bindGroup);
		}
		return bindGroup;
	}

	/**
	 * Ensure the texture is resident (same upload/validation path as
	 * getBinding) and return its record — callers composing their own bind
	 * groups (the lit batcher pairs the color view with a normal map) need
	 * the raw view rather than the standard material group.
	 * @param {object} texture - the texture atlas to resolve
	 * @param {object} [options] - same options as getBinding
	 * @returns {object} the resident record ({texture, view, width, height, …})
	 */
	getResidentRecord(texture, options) {
		this.getBinding(texture, options);
		return this.lastRecord;
	}

	/**
	 * Dispose of a GPUTexture safely: while a frame is being recorded the
	 * texture may be referenced by already-recorded draws (destroying it
	 * would make `queue.submit()` reject the whole command buffer), so it
	 * parks on the renderer's retired list and is destroyed after submit.
	 * @param {GPUTexture} gpuTexture - the texture to dispose of
	 * @ignore
	 */
	retire(gpuTexture) {
		this.renderer.retireTexture(gpuTexture);
	}

	/**
	 * drop every (texture, sampler) bind-group pairing while keeping the
	 * textures resident — the filter setting changed and the next draw
	 * re-pairs each texture with the newly-resolved sampler
	 */
	invalidateBindGroups() {
		for (const record of this.records.values()) {
			record.bindGroupBySampler.clear();
		}
	}

	/**
	 * Destroy the resident GPU texture(s) associated with an image — every
	 * `(source, repeat)` unit the cache knows about, mirroring
	 * `MaterialBatcher.deleteTexture2D`'s multi-repeat sweep.
	 * @param {object} texture - a TextureAtlas
	 */
	destroyTexture(texture) {
		const units = this.renderer.cache.peekAllUnits?.(texture) ?? [];
		for (const unit of units) {
			const record = this.records.get(unit);
			if (record) {
				this.retire(record.texture);
				this.records.delete(unit);
			}
		}
	}

	/**
	 * drop every unit association and dispose of the resident textures
	 */
	releaseAll() {
		for (const record of this.records.values()) {
			this.retire(record.texture);
		}
		this.records.clear();
	}

	/**
	 * full teardown (device loss / renderer destroy)
	 */
	destroy() {
		off(GPU_TEXTURE_CACHE_RESET, this.onCacheReset);
		this.releaseAll();
		this.samplers.clear();
	}
}
