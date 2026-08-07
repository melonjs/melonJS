import { GPU_TEXTURE_CACHE_RESET, off, on } from "../../../system/event.ts";
import mipblitWGSL from "../shaders/mipblit.wgsl";
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
	getSampler(filter, repeat, mipmaps = false) {
		// same per-axis mapping as MaterialBatcher.createTexture2D
		const addressModeU = /^repeat(-x)?$/.test(repeat)
			? "repeat"
			: "clamp-to-edge";
		const addressModeV = /^repeat(-y)?$/.test(repeat)
			? "repeat"
			: "clamp-to-edge";
		const key = `${filter}|${addressModeU}|${addressModeV}|${mipmaps ? "mip" : "flat"}`;
		let sampler = this.samplers.get(key);
		if (typeof sampler === "undefined") {
			sampler = this.device.createSampler({
				label: `melonJS sampler ${key}`,
				magFilter: filter,
				minFilter: filter,
				addressModeU,
				addressModeV,
				// mip: trilinear minification over the generated chain (the
				// mesh path), with 4× anisotropy — oblique surfaces (ground
				// planes, walls at grazing angles) keep detail that plain
				// trilinear blurs away. Valid because the mip variant is
				// only built fully linear. flat: clamp every consumer to
				// level 0, so a texture UPGRADED to a mip chain by a mesh
				// keeps rendering byte-identically for the sprites sharing it
				...(mipmaps
					? { mipmapFilter: "linear", maxAnisotropy: 4 }
					: { lodMinClamp: 0, lodMaxClamp: 0 }),
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
			record.source !== source ||
			// a mip-wanting consumer over a resident level-0-only record —
			// same source, but the texture must be rebuilt with a chain
			(options.mipmaps === true &&
				record.compressed !== true &&
				(record.mipLevelCount ?? 1) === 1)
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
						// 2D consumers stay lod-clamped to level 0 (sprites
						// sharing the asset render byte-identically) …
						view: gpuTexture.createView({
							baseMipLevel: 0,
							mipLevelCount: 1,
						}),
						// … while a mip-wanting consumer (the mesh path) can
						// sample the AUTHORED chain — compressed assets ship
						// their mips pre-encoded, no generation needed (the GL
						// twin: TEXTURE_MAX_LEVEL caps the chain to what the
						// asset carries)
						fullView: gpuTexture.createView(),
						mipLevelCount: source.mipmaps.length,
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
				return this.bindGroupFor(
					record,
					texture,
					wrap,
					options.mipmaps === true,
				);
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
				// a mip-wanting consumer (the mesh path) upgrades a resident
				// level-0-only texture to a full chain — never the reverse:
				// flat consumers of a mipped record sample level 0 via their
				// lod-clamped sampler
				(options.mipmaps === true && (record.mipLevelCount ?? 1) === 1) ||
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
				// full chain down to 1×1 when the mesh path asks for mips
				const mipLevelCount =
					options.mipmaps === true
						? Math.floor(Math.log2(Math.max(width, height))) + 1
						: 1;
				const gpuTexture = this.device.createTexture({
					label: "melonJS texture",
					size: [width, height],
					format: "rgba8unorm",
					mipLevelCount,
					// RENDER_ATTACHMENT is required by copyExternalImageToTexture
					// (and by the mip-chain blit passes)
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
					mipLevelCount,
					bindGroupBySampler: new Map(),
				};
				this.records.set(unit, record);
			} else {
				// same-size unit reuse, not yet drawn this frame (recycled
				// unit, or a video frame): keep the resident texture + bind
				// groups, adopt the source
				record.source = source;
			}

			// An HTMLVideoElement without a current frame has no backing
			// resource and copyExternalImageToTexture THROWS (autoplay
			// blocked, first frame not yet decoded) — where GL's texImage2D
			// silently uploads nothing. Skip the copy; the video path
			// re-uploads with force every frame, so the content lands the
			// moment a frame exists.
			const frameless =
				typeof HTMLVideoElement !== "undefined" &&
				source instanceof HTMLVideoElement &&
				source.readyState < 2;
			if (frameless === false) {
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
				if ((record.mipLevelCount ?? 1) > 1) {
					this.generateMipmaps(record);
				}
			}
		}

		// stamp: this record's texture is (about to be) referenced by draws
		// recorded in the current frame
		record.frameId = this.renderer.frameId;

		// stash for getResidentRecord — composers (the lit batcher) build
		// combined bind groups from the raw view
		this.lastRecord = record;

		return this.bindGroupFor(record, texture, wrap, options.mipmaps === true);
	}

	/**
	 * Build the full mip chain of a freshly-uploaded record: one blit pass
	 * per level, each rendering the previous level with linear filtering.
	 * Runs in its own encoder submitted immediately — queue ordering places
	 * it after the level-0 copy (a queue operation) and before the frame's
	 * own command buffer, so the frame's draws sample a complete chain.
	 * @param {object} record - the resident record (mipLevelCount > 1)
	 * @ignore
	 */
	generateMipmaps(record) {
		const device = this.device;
		if (typeof this.mipPipeline === "undefined") {
			const module = device.createShaderModule({
				label: "melonJS mip blit",
				code: mipblitWGSL,
			});
			this.mipLayout = device.createBindGroupLayout({
				label: "melonJS mip blit layout",
				entries: [
					{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
					{ binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
				],
			});
			// deliberately NOT a pipeline-cache family: mip passes have no
			// depth-stencil attachment and target the texture format, both
			// of which every cached pipeline hard-declares otherwise
			this.mipPipeline = device.createRenderPipeline({
				label: "melonJS mip blit",
				layout: device.createPipelineLayout({
					bindGroupLayouts: [this.mipLayout],
				}),
				vertex: { module, entryPoint: "vertex_main" },
				fragment: {
					module,
					entryPoint: "fragment_main",
					targets: [{ format: "rgba8unorm" }],
				},
				primitive: { topology: "triangle-list" },
			});
			this.mipSampler = device.createSampler({
				label: "melonJS mip blit sampler",
				magFilter: "linear",
				minFilter: "linear",
			});
		}
		const encoder = device.createCommandEncoder({ label: "melonJS mipgen" });
		for (let level = 1; level < record.mipLevelCount; level++) {
			const bindGroup = device.createBindGroup({
				label: "melonJS mip blit binding",
				layout: this.mipLayout,
				entries: [
					{
						binding: 0,
						resource: record.texture.createView({
							baseMipLevel: level - 1,
							mipLevelCount: 1,
						}),
					},
					{ binding: 1, resource: this.mipSampler },
				],
			});
			const pass = encoder.beginRenderPass({
				colorAttachments: [
					{
						view: record.texture.createView({
							baseMipLevel: level,
							mipLevelCount: 1,
						}),
						loadOp: "clear",
						storeOp: "store",
					},
				],
			});
			pass.setPipeline(this.mipPipeline);
			pass.setBindGroup(0, bindGroup);
			pass.draw(3);
			pass.end();
		}
		device.queue.submit([encoder.finish()]);
	}

	/**
	 * Resolve the view + sampler a resident record should be bound with,
	 * plus the cache key identifying that pair. Shared by the one-texture
	 * material path and the mesh path, so the two cannot drift on which
	 * view a mip-wanting consumer gets.
	 * @ignore
	 */
	viewAndSampler(record, texture, wrap, wantMips) {
		const filter =
			typeof texture.filter === "string"
				? texture.filter
				: this.renderer.getDefaultTextureFilter();
		// trilinear only for the consumer that asked for mips, over a record
		// that has them, with linear filtering ("nearest" opts out — crisp
		// pixel-art models); everyone else stays lod-clamped to level 0
		const mip =
			wantMips === true &&
			(record.mipLevelCount ?? 1) > 1 &&
			filter === "linear";
		return {
			// compressed records keep a level-0 `view` for 2D consumers and a
			// `fullView` over the authored chain for mip sampling;
			// generated-chain records have one full view serving both (the
			// sampler's lod clamp does the 2D restriction there)
			view: mip ? (record.fullView ?? record.view) : record.view,
			sampler: this.getSampler(filter, wrap, mip),
			key: `${filter}|${wrap}|${mip ? "mip" : "flat"}`,
		};
	}

	/**
	 * The group-1 material for a MESH: the diffuse texture/sampler pair plus
	 * the per-texel opacity pair (MTL `map_d`, #1575).
	 *
	 * Always four bindings. A mesh with no alpha map passes the shared white
	 * pixel, whose red channel is 1 — so the shader's multiply is a no-op and
	 * the same pipeline layout serves both cases rather than splitting the
	 * mesh family in two.
	 * @param {TextureAtlas} texture - the diffuse texture
	 * @param {TextureAtlas} alphaTexture - the opacity map, or the white pixel
	 * @param {object} [options] - wrap / mipmap options, as `getBinding` takes
	 * @returns {GPUBindGroup} the group-1 bind group
	 * @ignore
	 */
	getMeshBinding(texture, alphaTexture, options = {}) {
		// residency first: this is the call that uploads either source, so it
		// must happen before the records are read back
		this.getBinding(texture, options);
		this.getBinding(alphaTexture, options);

		const wrapFor = (t) => {
			return typeof options.repeat === "string"
				? options.repeat
				: (t.repeat ?? "no-repeat");
		};
		const wrap = wrapFor(texture);
		const alphaWrap = wrapFor(alphaTexture);
		const record = this.records.get(this.renderer.cache.getUnit(texture, wrap));
		const alphaRecord = this.records.get(
			this.renderer.cache.getUnit(alphaTexture, alphaWrap),
		);
		if (record === undefined || alphaRecord === undefined) {
			// a source that failed to become resident — the caller keeps its
			// previous binding rather than recording a draw against nothing
			return null;
		}

		const diffuse = this.viewAndSampler(
			record,
			texture,
			wrap,
			options.mipmaps === true,
		);
		const alpha = this.viewAndSampler(
			alphaRecord,
			alphaTexture,
			alphaWrap,
			false,
		);
		// Cached on the diffuse record, keyed FIRST by the alpha record object
		// and then by the two sampler keys. One diffuse texture is often drawn
		// by several meshes with different opacity maps, and keying on the
		// diffuse sampler alone would hand the second mesh the first mesh's
		// cut-outs. Keying on the record OBJECT (not its unit) also retires
		// the entry naturally: a re-upload builds a new record, which simply
		// misses rather than serving a bind group over a destroyed view.
		if (record.meshBindGroups === undefined) {
			record.meshBindGroups = new Map();
		}
		let byAlpha = record.meshBindGroups.get(alphaRecord);
		if (byAlpha === undefined) {
			byAlpha = new Map();
			record.meshBindGroups.set(alphaRecord, byAlpha);
		}
		const key = `${diffuse.key}|${alpha.key}`;
		let bindGroup = byAlpha.get(key);
		if (bindGroup === undefined) {
			bindGroup = this.device.createBindGroup({
				label: "melonJS mesh material",
				layout: this.renderer.pipelineCache.meshMaterialLayout,
				entries: [
					{ binding: 0, resource: diffuse.view },
					{ binding: 1, resource: diffuse.sampler },
					{ binding: 2, resource: alpha.view },
					{ binding: 3, resource: alpha.sampler },
				],
			});
			byAlpha.set(key, bindGroup);
		}
		return bindGroup;
	}

	/**
	 * the per-sampler material bind group for a resident record (shared by
	 * the image and compressed upload paths)
	 * @ignore
	 */
	bindGroupFor(record, texture, wrap, wantMips = false) {
		const resolved = this.viewAndSampler(record, texture, wrap, wantMips);
		let bindGroup = record.bindGroupBySampler.get(resolved.key);
		if (typeof bindGroup === "undefined") {
			bindGroup = this.device.createBindGroup({
				label: "melonJS material",
				layout: this.renderer.pipelineCache.materialLayout,
				entries: [
					{ binding: 0, resource: resolved.view },
					{ binding: 1, resource: resolved.sampler },
				],
			});
			record.bindGroupBySampler.set(resolved.key, bindGroup);
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
