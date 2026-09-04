import { GPU_TEXTURE_CACHE_RESET, off, on } from "../../../system/event.ts";
import { WebGLBatcher } from "./batcher.js";

/**
 * additional import for TypeScript
 * @import {TextureAtlas} from "./../../texture/atlas.js";
 */

/**
 * Base class for batchers that manage WebGL textures and material properties.
 * Provides texture creation, binding, uploading, and deletion.
 * @category Rendering
 */
/**
 * Immutable-storage bookkeeping: `texStorage2D` allocations can never be
 * respecified, so each GL texture's allocated shape is recorded here and a
 * mismatching re-upload replaces the texture object outright. WeakMap so
 * deleted textures drop their records with them.
 * @type {WeakMap<WebGLTexture, {width: number, height: number, levels: number, format: number}>}
 * @ignore
 * @internal
 */
const immutableStorage = new WeakMap();

/**
 * full mip chain length for a base size (immutable storage allocates the
 * whole pyramid up front)
 * @ignore
 * @internal
 */
function mipLevels(w, h) {
	return Math.floor(Math.log2(Math.max(w, h))) + 1;
}

export class MaterialBatcher extends WebGLBatcher {
	/**
	 * Initialize the textured batcher
	 * @ignore
	 * @internal
	 */
	init(renderer, settings) {
		super.init(renderer, settings);

		// invalidate the active-unit tracking (see the currentTextureUnit
		// accessor — the state lives on the renderer, shared by all batchers)
		this.currentTextureUnit = -1;

		/**
		 * bound textures by unit
		 * @ignore
		 * @internal
		 */
		this.boundTextures = [];

		/**
		 * Units whose texture CONTENT changed since the last upload (a
		 * canvas re-bake announced via `CanvasRenderTarget.invalidate`).
		 * Consumed by {@link MaterialBatcher#uploadTexture}, which then
		 * re-uploads INTO the existing texture — with immutable storage a
		 * same-shape re-upload is a pure `texSubImage2D`, so a ticking
		 * Text / gradient re-bake never re-allocates.
		 * @type {Set<number>}
		 * @ignore
		 * @internal
		 */
		this.dirtyUnits = new Set();

		/**
		 * track the current sampler unit to avoid redundant gl.uniform1i calls
		 * @ignore
		 * @internal
		 */
		this.currentSamplerUnit = -1;

		// Drop our `texture → unit` tracking whenever the renderer-wide
		// texture cache reassigns units. Without this, our
		// `bindTexture2D` short-circuit (`texture ===
		// boundTextures[unit]`) would skip the actual `gl.bindTexture`
		// call after a reset — the unit on the GPU is now occupied by
		// whichever texture triggered the reset (or whichever batcher
		// drew next), and we'd sample that one instead. Symptom was
		// meshes coming out black and sprites/bullets coming out
		// white. Inherited by every MaterialBatcher subclass
		// (QuadBatcher, LitQuadBatcher, MeshBatcher) so each one gets
		// the same handler automatically — PrimitiveBatcher extends
		// `Batcher` directly and has no texture state, so it doesn't
		// need this.
		if (!this._onCacheReset) {
			// delegate to an overridable method so subclasses that track extra
			// per-unit bindings (lit normal maps) can drop those on a reset too
			/**
			 * @ignore
			 * @internal
			 */
			this._onCacheReset = () => {
				this._onTextureCacheReset();
			};
			on(GPU_TEXTURE_CACHE_RESET, this._onCacheReset);
		}
	}

	/**
	 * Drop every cached texture binding after a {@link GPU_TEXTURE_CACHE_RESET}
	 * (the shared texture cache reassigned units — our per-unit view is stale).
	 * Subclasses that pair extra samplers to units (lit normal maps) override to
	 * forget those too; without that they'd assume the extra texture is still
	 * resident and skip re-binding it after the reset.
	 * @ignore
	 * @internal
	 */
	_onTextureCacheReset() {
		this.boundTextures.length = 0;
		this.dirtyUnits.clear();
		this.currentTextureUnit = -1;
		this.currentSamplerUnit = -1;
	}

	/**
	 * The GL texture unit currently active (`gl.activeTexture`). Tracked on
	 * the RENDERER, not per batcher: the active unit is global GL state
	 * shared by every batcher instance, and a per-batcher copy desyncs as
	 * soon as another batcher (or a blit, or an FBO pass) moves the active
	 * unit — the stale copy then lets `bindTexture2D` skip `gl.activeTexture`
	 * and bind (or upload) a texture onto whatever unit is REALLY active.
	 * Symptom was video force-re-uploads overwriting a mesh texture with
	 * video frames after a mesh pass.
	 * @type {number}
	 * @ignore
	 * @internal
	 */
	get currentTextureUnit() {
		return this.renderer._activeTextureUnit;
	}

	set currentTextureUnit(unit) {
		this.renderer._activeTextureUnit = unit;
	}

	/**
	 * Free resources used by the batcher. Currently unsubscribes the
	 * texture-cache-reset listener so a discarded batcher doesn't keep
	 * accumulating handlers (relevant on context loss / renderer
	 * teardown).
	 * @ignore
	 * @internal
	 */
	destroy() {
		if (this._onCacheReset) {
			off(GPU_TEXTURE_CACHE_RESET, this._onCacheReset);
			this._onCacheReset = null;
		}
		super.destroy();
	}

	/**
	 * Reset batcher internal state
	 * @ignore
	 * @internal
	 */
	reset() {
		super.reset();

		// The store owns every colour-texture handle since #1585, so releasing
		// them means asking it — walking `boundTextures` would miss any texture
		// not currently assigned a unit, and would double-free the ones that are.
		this.renderer.textureStore?.releaseAll(true);
		this.boundTextures.length = 0;
		this.dirtyUnits.clear();
		this.currentTextureUnit = -1;
		this.currentSamplerUnit = -1;
	}

	/**
	 * Create a WebGL texture from an image
	 * @param {number} unit - Destination texture unit
	 * @param {Image|HTMLCanvasElement|ImageData|Uint8Array[]|Float32Array[]} [pixels=null] - Source image
	 * @param {number} filter - gl.LINEAR or gl.NEAREST
	 * @param {string} [repeat="no-repeat"] - Image repeat behavior
	 * @param {number} [w=pixels.width] - Source image width
	 * @param {number} [h=pixels.height] - Source image height
	 * @param {boolean} [premultipliedAlpha=true] - Multiplies the alpha channel into the other color channels
	 * @param {boolean} [mipmap=true] - Whether mipmap levels should be generated
	 * @returns {WebGLTexture} a WebGL texture
	 */
	createTexture2D(
		unit,
		pixels = null,
		filter,
		repeat = "no-repeat",
		w = pixels.width,
		h = pixels.height,
		premultipliedAlpha = true,
		mipmap = true,
		texture,
		flush = true,
	) {
		const gl = this.gl;
		// WebGL 2: REPEAT wrap and mipmaps work on NPOT textures — no
		// power-of-two gating (the WebGL 1 clamp-downgrade path is gone)
		const rs =
			repeat.search(/^repeat(-x)?$/) === 0 ? gl.REPEAT : gl.CLAMP_TO_EDGE;
		const rt =
			repeat.search(/^repeat(-y)?$/) === 0 ? gl.REPEAT : gl.CLAMP_TO_EDGE;

		let currentTexture = texture;
		if (!currentTexture) {
			currentTexture = gl.createTexture();
		}

		this.bindTexture2D(currentTexture, unit, flush);

		// `bindTexture2D` skips the GL calls entirely when its bookkeeping says
		// the texture is already bound and active — but the uploads below
		// write through whatever unit/binding is REALLY active in GL. Force
		// both (uploads are a cold path) so a re-upload can never land on a
		// foreign texture even if the tracked state went stale.
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, currentTexture);
		this.currentTextureUnit = unit;

		// Immutable storage (`texStorage2D` + sized formats): allocate the
		// complete texture — every mip level, explicit RGBA8 layout — once,
		// and update contents with `texSubImage2D` thereafter. The driver
		// then skips per-draw completeness validation (the texture is
		// known-complete forever) and same-size re-uploads (video frames,
		// Text/gradient re-bakes) are pure data copies — the same model as
		// the WebGPU texture store. `TextureResource` sources own their
		// upload call and keep classic mutable storage.
		const resourceOwned =
			pixels !== null && typeof pixels.upload === "function";
		const compressed = pixels !== null && pixels.compressed === true;
		if (!resourceOwned) {
			const storageW = Math.max(1, w | 0);
			const storageH = Math.max(1, h | 0);
			const levels = compressed
				? pixels.mipmaps.length
				: mipmap === true
					? mipLevels(storageW, storageH)
					: 1;
			const format = compressed ? pixels.format : gl.RGBA8;
			let storage = immutableStorage.get(currentTexture);
			if (
				storage &&
				(storage.width !== storageW ||
					storage.height !== storageH ||
					storage.levels !== levels ||
					storage.format !== format)
			) {
				// immutable storage can never be respecified — a shape change
				// replaces the texture object outright (the engine's stores
				// already treat size changes as recreation on every backend)
				gl.deleteTexture(currentTexture);
				currentTexture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, currentTexture);
				this.boundTextures[unit] = currentTexture;
				storage = undefined;
			}
			if (!storage) {
				gl.texStorage2D(gl.TEXTURE_2D, levels, format, storageW, storageH);
				immutableStorage.set(currentTexture, {
					width: storageW,
					height: storageH,
					levels,
					format,
				});
			}
		}

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rs);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, rt);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);

		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultipliedAlpha);

		if (resourceOwned) {
			// `TextureResource` path: the resource owns its upload (raw
			// buffer, future synthesized sources, etc.). Keeps every
			// backend-specific upload call in one place per source type.
			// The resource's `upload(context, target)` contract is
			// renderer-agnostic — we pass `gl` here because this is the
			// WebGL batcher; a future WebGPU batcher would pass its own
			// `renderer.getContext()` result and the resource subclass
			// implementing that backend would handle it.
			pixels.upload(gl, gl.TEXTURE_2D);
		} else if (compressed) {
			// immutable storage was allocated with exactly the authored
			// levels, so the chain is inherently complete — the old
			// TEXTURE_MAX_LEVEL cap is subsumed by the `levels` parameter
			const mipmaps = pixels.mipmaps;
			for (let i = 0; i < mipmaps.length; i++) {
				gl.compressedTexSubImage2D(
					gl.TEXTURE_2D,
					i,
					0,
					0,
					mipmaps[i].width,
					mipmaps[i].height,
					pixels.format,
					mipmaps[i].data,
				);
			}
		} else if (pixels === null) {
			// allocation without data — WebGL guarantees zero-initialized
			// storage, so texStorage2D alone is the blank texture
		} else if (typeof pixels.byteLength !== "undefined") {
			gl.texSubImage2D(
				gl.TEXTURE_2D,
				0,
				0,
				0,
				w,
				h,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				pixels,
				0,
			);
		} else {
			// any TexImageSource (image, canvas, OffscreenCanvas, video,
			// ImageBitmap): WebGL2's DOM overload of texSubImage2D uploads
			// the source at its natural size into the allocated storage.
			// (OffscreenCanvas deliberately NOT routed through
			// transferToImageBitmap — that call is destructive and blanked
			// re-uploads; see the plinko-planck particle regression.)
			gl.texSubImage2D(
				gl.TEXTURE_2D,
				0,
				0,
				0,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				pixels,
			);
		}

		// WebGL 2 mipmaps NPOT textures fine — no POT gate. generateMipmap
		// fills the pre-allocated immutable chain in place.
		if (
			mipmap === true &&
			(pixels === null || (!compressed && !resourceOwned))
		) {
			gl.generateMipmap(gl.TEXTURE_2D);
		}

		return currentTexture;
	}

	/**
	 * delete the given WebGL texture
	 * @param {WebGLTexture|TextureAtlas} texture - a WebGL texture or TextureAtlas to delete
	 */
	deleteTexture2D(texture) {
		if (typeof texture.getTexture === "function") {
			// Iterate every atlas registered under this image — post-#1448,
			// the multimap can hold multiple atlases per image — and, per
			// atlas, EVERY (source, repeat) unit: a single atlas can own
			// several per-repeat units via the per-use wrap override
			// (meshes' `textureRepeat`, #1503), which a per-repeat
			// `peekUnit` lookup (keyed on the atlas's current `repeat`
			// field) would miss. `cache.delete(image)` below frees all of
			// those units; any GL texture left behind in
			// `boundTextures[unit]` would make a later allocation of the
			// same unit look "already uploaded" and bind a stale texture.
			const image = texture.getTexture();
			const cache = this.renderer.cache;
			// The store owns the handle since #1585, so it has to do the
			// freeing: deleting it here left the store holding a record whose
			// texture no longer existed, and the next resolve for this source
			// would hand that dead handle straight back to a draw.
			const record = this.renderer.textureStore?.peek(image);
			if (record !== undefined) {
				this.unbindTexture2D(record.handle);
			}
			this.renderer.textureStore?.destroyTexture(image);
			if (cache.has(image)) {
				for (const atlas of cache.cache.get(image)) {
					for (const unit of cache.peekAllUnits(atlas)) {
						// drop the per-unit belief too, or a later allocation of
						// the same unit looks "already bound" and samples nothing
						this.invalidateUnit(unit);
					}
				}
			}
			cache.delete(image);
		} else {
			this.gl.deleteTexture(texture);
			this.unbindTexture2D(texture);
		}
	}

	/**
	 * returns the WebGL texture associated to the given texture unit
	 * @param {number} unit - Texture unit to which a texture is bound
	 * @returns {WebGLTexture} texture a WebGL texture
	 */
	getTexture2D(unit) {
		return this.boundTextures[unit];
	}

	/**
	 * assign the given WebGL texture to the current batch
	 * @param {WebGLTexture} texture - a WebGL texture
	 * @param {number} unit - Texture unit to which the given texture is bound
	 */
	bindTexture2D(texture, unit, flush = true) {
		const gl = this.gl;

		if (texture !== this.boundTextures[unit]) {
			if (flush) {
				this.flush();
			}
			if (this.currentTextureUnit !== unit) {
				this.currentTextureUnit = unit;
				gl.activeTexture(gl.TEXTURE0 + unit);
			}
			gl.bindTexture(gl.TEXTURE_2D, texture);
			this.boundTextures[unit] = texture;
		} else if (this.currentTextureUnit !== unit) {
			if (flush) {
				this.flush();
			}
			this.currentTextureUnit = unit;
			gl.activeTexture(gl.TEXTURE0 + unit);
		}
	}

	/**
	 * unbind the given WebGL texture, forcing it to be reuploaded
	 * @param {WebGLTexture} [texture] - a WebGL texture
	 * @param {number} [unit] - Texture unit to unbind from
	 * @returns {number} unit the unit number that was associated with the given texture
	 */
	/**
	 * Announce that the SOURCE content behind `unit` changed (same object,
	 * new pixels — a canvas re-bake): the next {@link MaterialBatcher#uploadTexture}
	 * for it re-uploads into the existing texture in place instead of
	 * discarding it. The allocation-preserving counterpart of
	 * {@link MaterialBatcher#unbindTexture2D}.
	 * @param {number} unit - the texture unit whose content is stale
	 * @ignore
	 * @internal
	 */
	markTextureDirty(unit) {
		this.dirtyUnits.add(unit);
	}

	unbindTexture2D(texture, unit) {
		if (typeof unit === "undefined") {
			unit = this.boundTextures.indexOf(texture);
		}
		if (unit !== -1) {
			delete this.boundTextures[unit];
			if (unit === this.currentTextureUnit) {
				this.currentTextureUnit = -1;
			}
		}
		return unit;
	}

	/**
	 * Forget whatever texture this batcher believes is bound to `unit`, so the
	 * next bind to it re-issues the GL bind. Used when a GL texture unit is
	 * clobbered OUTSIDE this batcher's own accounting — e.g.
	 * {@link WebGLRenderer#toFrameTexture}, which binds its capture to a scratch
	 * unit directly (not via the shared texture cache), so a different batcher's
	 * unit cache would otherwise skip a needed re-bind. Subclasses that pair
	 * extra samplers to the same unit (lit normal maps) override to drop those
	 * too.
	 * @param {number} unit - the GL texture unit to invalidate
	 * @ignore
	 * @internal
	 */
	invalidateUnit(unit) {
		delete this.boundTextures[unit];
		if (this.currentTextureUnit === unit) {
			this.currentTextureUnit = -1;
		}
	}

	/**
	 * @ignore
	 * @internal
	 * @param {TextureAtlas|TextureResource} texture
	 * @param {number} [w] - ignored when the source has its own `width` (the
	 *   common case); kept for the legacy signature where callers passed a
	 *   destination size. Forwarded only as a last-resort default.
	 * @param {number} [h] - same as `w`.
	 * @param {boolean} [force=false]
	 * @param {boolean} [flush=true]
	 * @param {string} [repeat] - per-use wrap-mode override (a mesh's
	 *   `textureRepeat`, #1503) — sampled with this wrap without mutating
	 *   the shared atlas's `repeat`. The texture-unit cache keys by
	 *   `(source, repeat)`, so each wrap gets its own unit + GL texture.
	 *   Omit to use `texture.repeat`.
	 */
	uploadTexture(texture, w, h, force = false, flush = true, repeat) {
		const wrap = typeof repeat === "string" ? repeat : texture.repeat;
		const unit = this.renderer.cache.getUnit(texture, wrap);
		// honor a resource-specified filter (e.g. tilemap index textures need
		// NEAREST regardless of the global setting, or a Mesh's own
		// `textureFilter`), otherwise fall back to the renderer-wide default
		// (the `textureFilter` setting, decoupled from MSAA — see
		// WebGLRenderer#getDefaultTextureFilter). Resolved before the branch
		// because the sampler binding below needs it whether or not this call
		// uploads.
		let filter =
			typeof texture.filter !== "undefined"
				? texture.filter
				: this.renderer._glTextureFilter();
		// the STRING form ("nearest"/"linear") is what non-GL renderers store
		// (the WebGPU texture store consumes it directly) — an atlas that met
		// one of those first must still upload correctly here, so map it to the
		// GL enum instead of feeding texParameteri a string
		if (filter === "nearest") {
			filter = this.gl.NEAREST;
		} else if (filter === "linear") {
			filter = this.gl.LINEAR;
		}

		// TWO independent decisions, not one (#1585). Whether this unit already
		// holds the texture decides a BIND; whether the source's content is
		// current decides an UPLOAD. Conflating them — which is what reading
		// `boundTextures[unit]` alone did — meant a texture that merely moved
		// units was rebuilt from scratch, because the handle was reachable only
		// through that array and a cache reset cleared it.
		const source = texture.getTexture();
		// `HTMLVideoElement` exposes its real pixel dimensions through
		// `videoWidth`/`videoHeight`; `width`/`height` default to 0 until the
		// element is explicitly sized. Prefer the regular width/height when
		// non-zero, otherwise fall back to the video-specific properties, and
		// finally to the caller-supplied w/h for sources that have neither.
		const texW = source.width || source.videoWidth || w;
		const texH = source.height || source.videoHeight || h;
		// a video with no decoded frame yet (readyState < HAVE_CURRENT_DATA)
		// has nothing to upload — texImage2D on it is browser-dependent (an
		// exception on some engines, an empty upload plus a GL error on
		// others). Allocate a blank texture instead and skip the copy; the
		// video path force-re-uploads every frame, so content lands the moment
		// a frame exists — same contract as the WebGPU store.
		const frameless =
			typeof source.videoWidth !== "undefined" && source.readyState < 2;

		// `markTextureDirty` announces that the SOURCE behind a unit changed
		// (same object, new pixels — a canvas re-bake), so it forces a
		// re-upload. It is a CONTENT signal, not a binding one: a merely stale
		// binding is handled by the unconditional bind below.
		const dirty = this.dirtyUnits.delete(unit);
		const version = source.version ?? 0;

		// Fast path: already resident and current. Taken for all but a handful
		// of the hundreds of quads in a frame, so it must allocate NOTHING —
		// the options object and the upload closure below are per-call garbage
		// that the steady state has no use for.
		let record = this.renderer.textureStore.peek(source);
		if (
			record === undefined ||
			force === true ||
			dirty === true ||
			record.version !== version
		) {
			record = this.renderer.textureStore.getResidentRecord(source, {
				version,
				force: force === true || dirty === true,
				upload: (handle) => {
					return this.createTexture2D(
						unit,
						frameless ? null : source,
						filter,
						wrap,
						texW,
						texH,
						texture.premultipliedAlpha,
						undefined,
						handle,
						flush,
					);
				},
			});
		}

		// bind unconditionally — cheap, and the only thing that guarantees this
		// unit really holds this texture. `bindTexture2D` no-ops when its
		// bookkeeping already agrees.
		this.bindTexture2D(record.handle, unit, flush);

		// The variant (wrap + filter) rides a sampler object rather than the
		// texture's own parameters, so one upload can serve a source drawn at
		// several repeat modes. `createTexture2D` still sets the texture
		// parameters too, which keeps any path that binds no sampler working
		// exactly as before.
		this.renderer.samplerCache.bind(
			unit,
			this.renderer.samplerCache.get(filter, wrap, false),
		);

		return flush ? this.currentTextureUnit : unit;
	}
}
