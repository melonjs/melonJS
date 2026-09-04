import { off, on, TEXTURE2D_DESTROYED } from "../../../system/event.ts";
import { transformQuadCorners } from "../../gpu/quadcorners.ts";
import UniformBlock from "../buffer/uniformblock.js";
import { MAX_LIGHTS } from "../lighting/constants.ts";
import {
	BLOCK_FLOATS,
	HEADER_FLOATS,
	writeLight2dBlock,
} from "../lighting/std140.ts";
import { buildLitMultiTextureFragment } from "./../shaders/multitexture-lit.js";
import quadMultiLitVertex from "./../shaders/quad-multi-lit.vert";
import { WebGLTextureStore } from "../texture/store.js";
import QuadBatcher from "./quad_batcher.js";

/**
 * additional import for TypeScript
 * @import {TextureAtlas} from "./../../texture/atlas.js";
 */

/**
 * Lit-aware variant of `QuadBatcher` for the SpriteIlluminator workflow.
 *
 * Adds a 5th vertex attribute (`aNormalTextureId`) so each quad knows
 * which slot its normal map occupies, and owns the per-frame
 * `Light2dBlock` uniform buffer that the lit fragment shader iterates.
 *
 * Colors and normal maps share ONE slot pool the same size as `QuadBatcher`'s
 * (#1585) — a normal map is allocated a unit like any other texture, and
 * `aNormalTextureId` records which one. The `WebGLRenderer` only
 * dispatches sprites here when the scene actually needs lighting (active
 * `Light2d` AND the sprite has a `normalMap`); unlit sprites stay on
 * `QuadBatcher` and pay nothing.
 * @category Rendering
 */
export default class LitQuadBatcher extends QuadBatcher {
	/**
	 * @ignore
	 * @internal
	 */
	init(renderer) {
		// One shared pool, same size as the unlit batcher's (#1585). This used
		// to be HALVED, because the fragment shader declared a second
		// `uNormalSampler0..n-1` set and 2n samplers had to fit the device — and
		// the upper half was then reserved permanently, so a lit scene could
		// never allocate more than half the units the device reported. The
		// shader now addresses ONE sampler set with two per-quad ids, so a
		// normal map is just another texture competing for the same slots. The
		// split became dynamic: sprites sharing a normal map cost one slot
		// between them, rather than every scene paying half its budget upfront.
		const pool = renderer.maxTextures;
		this.maxBatchTextures = pool;

		// Skip QuadBatcher.init (its attribute layout / shader differ) and
		// invoke MaterialBatcher.init directly with the lit configuration.
		Object.getPrototypeOf(QuadBatcher.prototype).init.call(this, renderer, {
			attributes: [
				{
					// vec3: (x, y, z). z carries `renderable.depth` for
					// perspective projection (Camera3d). Stride = 32 bytes.
					name: "aVertex",
					format: "float32x3",
					offset: 0 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aRegion",
					format: "float32x2",
					offset: 3 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aColor",
					format: "unorm8x4",
					offset: 5 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aTextureId",
					format: "float32",
					offset: 6 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aNormalTextureId",
					format: "float32",
					offset: 7 * Float32Array.BYTES_PER_ELEMENT,
				},
			],
			shader: {
				vertex: quadMultiLitVertex,
				fragment: buildLitMultiTextureFragment(pool),
			},
		});

		// Reuse the parent's setup helpers — they're agnostic to the
		// shader/attribute layout, just iterate `this.maxBatchTextures`.
		this.bindColorSamplers();
		this.createIndexBuffer();

		this.useMultiTexture = true;

		/**
		 * normal-map texture per color slot — keyed by the same unit index as
		 * `boundTextures`. Used by `addQuad` to detect when a normal-map slot
		 * needs (re-)uploading, mirroring the color-texture cache.
		 * @type {Array<HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap|null>}
		 * @ignore
		 * @internal
		 */
		this.boundNormalMaps = new Array(pool).fill(null);

		/**
		 * Per-slot content `version` of the normal map currently bound there. An
		 * animated source keeps a stable canvas reference across re-bakes but
		 * bumps its `version`, so `addQuad` compares this (not just the reference)
		 * to know when to re-bind/re-upload. `-1` = nothing bound.
		 * @type {number[]}
		 * @ignore
		 * @internal
		 */
		this.boundNormalVersions = new Array(pool).fill(-1);

		/**
		 * Residency for normal-map sources — the same shared policy the colour
		 * path uses, just a separate instance: normal maps live outside the
		 * colour `TextureCache`, so their handles are this batcher's to own.
		 *
		 * This used to be a hand-rolled `Map<source, {tex, version}>`. It was
		 * the correct DESIGN before the colour path had one (which is why the
		 * normal path never suffered the re-upload storm), but keeping a third
		 * copy of the logic is how the two drifted in the first place.
		 *
		 * Re-created rather than cleared here on purpose: `init()` re-runs on
		 * context restore, where the old handles died with the context — and
		 * `destroy()` releases the previous instance first, so nothing leaks.
		 * @type {TextureStore}
		 * @ignore
		 * @internal
		 */
		this.normalStore?.releaseAll();
		this.normalStore = new WebGLTextureStore(this.gl);

		/**
		 * Which slot in the shared pool each normal-map source currently holds.
		 * Normal maps are not in the color `TextureCache` (they are raw sources
		 * with their own GL textures), so their unit assignment is tracked here
		 * while the unit itself comes from the same allocator the colors use.
		 * @type {Map<HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap, number>}
		 * @ignore
		 * @internal
		 */
		this.normalUnits = new Map();
		/**
		 * @ignore
		 * @internal
		 */
		this._cacheEpoch = 0;

		/**
		 * @ignore
		 * @internal
		 */
		this._lightCount = 0;
		/**
		 * @ignore
		 * @internal
		 */
		this._maxLights = MAX_LIGHTS;

		// `init` is re-run on context restore (WebGLRenderer.reset), against a
		// new context and a freshly compiled program — so drop the old block
		// rather than leaking it, and let `bind` re-establish the binding.
		this.lightBlock?.destroy();

		/**
		 * The `Light2dBlock` uniform buffer. Filled by
		 * {@link LitQuadBatcher#setLightUniforms}, which no longer needs the
		 * program bound — a buffer upload is independent of `useProgram`.
		 * @type {UniformBlock}
		 * @ignore
		 * @internal
		 */
		// Claim a binding point once and hold it: `init()` re-runs on context
		// restore, and claiming again each time would walk through the
		// device's budget over a long session.
		/**
		 * @ignore
		 * @internal
		 */
		this._bindingPoint ??= renderer.reserveUniformBindingPoint();
		this.lightBlock = new UniformBlock(
			renderer.gl,
			BLOCK_FLOATS,
			this._bindingPoint,
		);
		/**
		 * @ignore
		 * @internal
		 */
		this._lightBlockProgram = null;
		// Bind immediately rather than waiting for the first activation. An
		// active-but-unbound uniform block is INVALID_OPERATION at draw time,
		// not a read of zeroes — so a renderer that never draws lit content
		// would otherwise carry a program that cannot legally draw at all.
		this._bindLightBlock();

		// release the cached GL texture when a Texture2d normal-map source
		// (e.g. a per-level NoiseTexture2d) is destroyed — `normalMapTextures`
		// keys sources strongly and is otherwise only emptied on full reset
		if (!this._onTexture2dDestroyed) {
			this._onTexture2dDestroyed = (source) => {
				this.evictNormalMap(source);
			};
			on(TEXTURE2D_DESTROYED, this._onTexture2dDestroyed);
		}
	}

	/**
	 * Unsubscribe the `TEXTURE2D_DESTROYED` listener; delegates to
	 * `MaterialBatcher.destroy()` for the texture-cache-reset one.
	 * @ignore
	 * @internal
	 */
	destroy() {
		if (this._onTexture2dDestroyed) {
			off(TEXTURE2D_DESTROYED, this._onTexture2dDestroyed);
			this._onTexture2dDestroyed = null;
		}
		this.lightBlock?.destroy();
		this.lightBlock = undefined;
		this._lightBlockProgram = null;
		super.destroy();
	}

	/**
	 * No unit reservation any more (#1585). This used to claim
	 * `[maxBatchTextures, 2*maxBatchTextures)` permanently on first bind,
	 * because the lit shader's normal samplers were bound to those fixed
	 * units — which took half the pool away from every allocator for the rest
	 * of the session, and collided with the top units `ShaderEffect` and
	 * `toFrameTexture` claim. Normal maps now go through the shared allocator
	 * like everything else, so there is nothing to hold back.
	 * @ignore
	 * @internal
	 */
	bind() {
		super.bind();
		this._bindLightBlock();
	}

	/**
	 * Point the active program's `Light2dBlock` at our uniform buffer.
	 *
	 * A block binding is *program* state, and the program can change under us
	 * in three ways: a context restore recompiles it, `setBatcher` can host a
	 * {@link ShaderEffect} on this batcher, and `init` re-runs on reset. Rather
	 * than hook each of those, re-bind whenever the program is not the one we
	 * last bound — a pointer compare per `bind`, and self-healing.
	 *
	 * A hosted `ShaderEffect` is a plain unlit ES 1.00 program with no light
	 * block, so `bindTo` reports failure and we simply record it, leaving the
	 * next real lit program to bind normally.
	 * @ignore
	 * @internal
	 */
	_bindLightBlock() {
		const shader = this.currentShader || this.defaultShader;
		const program = shader?.program;
		if (!program || program === this._lightBlockProgram) {
			return;
		}
		this._lightBlockProgram = program;
		this.lightBlock.bindTo(program, "Light2dBlock");
	}

	/**
	 * Release the cached GL texture uploaded for the given normal-map source
	 * and clear any slot bookkeeping referencing it. Safe to call for images
	 * that were never bound.
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap} image - normal-map source
	 */
	evictNormalMap(image) {
		if (this.normalStore.peek(image) !== undefined) {
			this.normalStore.destroyTexture(image);
			this.releaseNormalUnit(image);
			for (let i = 0; i < this.boundNormalMaps.length; i++) {
				if (this.boundNormalMaps[i] === image) {
					this.boundNormalMaps[i] = null;
					this.boundNormalVersions[i] = -1;
				}
			}
		}
	}

	/**
	 * @ignore
	 * @internal
	 */
	reset() {
		// QuadBatcher.reset rebuilds the index buffer, rebinds color
		// samplers, and resets `useMultiTexture`. MaterialBatcher.reset
		// (called transitively) iterates `this.renderer.maxTextures` —
		// covering both color and paired-normal slots — and deletes
		// every bound GL texture, so our normal-map textures are
		// already disposed by the time we get here. We just need to
		// drop the JS references and re-bind the per-frame uniforms.
		super.reset();
		// `MaterialBatcher.reset` releases the renderer's colour store; normal
		// maps live outside it, in this batcher's own map, so their GL textures
		// are ours to delete. Before #1585 they were freed incidentally, by
		// `reset` walking `boundTextures` — which stopped being the sole
		// reference to a handle, so freeing has to be explicit now.
		this.normalStore.releaseAll(true);
		this.boundNormalMaps.fill(null);
		this.boundNormalVersions.fill(-1);
		this.normalUnits.clear();
		this._lightCount = 0;
		// zero the header (count + ambient) and push it, so a reset mid-scene
		// leaves the shader reading "no lights" rather than the previous
		// frame's set — the light array past the count is never read.
		this.lightBlock.data.fill(0, 0, HEADER_FLOATS);
		this.lightBlock.upload(HEADER_FLOATS);
	}

	/**
	 * Also drop the normal-map binding when its unit is invalidated. A normal
	 * map occupies a unit in the shared pool, so anything that binds a GL unit
	 * directly — {@link WebGLRenderer#toFrameTexture}'s scratch unit,
	 * {@link ShaderEffect#_prepareTextures}'s extra samplers — can clobber one.
	 * Forget it here, or the next lit draw assumes the normal is still resident,
	 * skips re-binding, and samples the clobbering texture as a normal map.
	 * @param {number} unit - the GL texture unit to invalidate
	 * @ignore
	 * @internal
	 */
	invalidateUnit(unit) {
		super.invalidateUnit(unit);
		const stale = this.boundNormalMaps?.[unit];
		if (stale != null) {
			// unit-driven, not source-driven: whatever clobbered this GL unit
			// bound directly, so drop our belief about it. The allocator claim
			// is deliberately NOT released — the clobberer (a toFrameTexture
			// scratch bind, a ShaderEffect sampler) is squatting there outside
			// the allocator's accounting, and handing the unit to a colour
			// texture now would put two textures on it.
			this.normalUnits?.delete(stale);
			this.boundNormalMaps[unit] = null;
			this.boundNormalVersions[unit] = -1;
		}
	}

	/**
	 * On a full texture-cache reset, also forget the paired normal-map
	 * bindings — the base handler only clears the color `boundTextures`, so a
	 * lit draw after a reset would otherwise assume a normal map is still bound
	 * (and skip re-binding it) while its GL unit may have been reused for a
	 * color texture. The `?.` guards a reset firing before `init` allocates the
	 * arrays (none does today; hardens against future init reordering).
	 * @ignore
	 * @internal
	 */
	_onTextureCacheReset() {
		super._onTextureCacheReset();
		this.boundNormalMaps?.fill(null);
		this.boundNormalVersions?.fill(-1);
		this.normalUnits?.clear();
		// `addQuad` resolves a color unit and a normal unit in sequence; the
		// second allocation can exhaust the pool and wipe the first. Bumping a
		// counter here is how it notices and re-resolves, rather than stamping
		// a stale unit into the vertex stream.
		this._cacheEpoch = (this._cacheEpoch ?? 0) + 1;
	}

	/**
	 * Upload the per-frame Light2d data used by the lit fragment path.
	 * Called once per camera per frame (before the world tree walk).
	 * Lights past `MAX_LIGHTS` are silently ignored.
	 *
	 * Coordinates must be supplied in the same space as the renderer's
	 * pre-projection vertex coords (i.e. camera-local / FBO-local),
	 * matching `Stage.drawLighting`'s convention.
	 *
	 * The data goes into the `Light2dBlock` uniform buffer, which is
	 * independent of which program is current — so unlike the uniform arrays
	 * this replaced, calling it does not disturb the active shader. The
	 * upload is skipped outright when the packed bytes are unchanged, so a
	 * scene whose lights are static still costs nothing per frame.
	 * @param {object} uniforms
	 * @param {Float32Array} uniforms.positions - flat array of `[x, y, radius, intensity]` per light, length = 4 * count
	 * @param {Float32Array} uniforms.colors - flat array of `[r, g, b]` per light, length = 3 * count
	 * @param {Float32Array} [uniforms.heights] - flat array of per-light height, length >= count
	 * @param {number} uniforms.count - number of lights to render (clamped to MAX_LIGHTS)
	 * @param {number[]} [uniforms.ambient] - `[r, g, b]` ambient floor (0..1 each)
	 */
	setLightUniforms(uniforms) {
		this._lightCount = Math.min(uniforms.count | 0, this._maxLights);
		// write straight into the block's own staging buffer — that is what
		// `UniformBlock.data` is for, and `upload` sends exactly it
		this.lightBlock.upload(writeLight2dBlock(this.lightBlock.data, uniforms));
	}

	/**
	 * Bind a normal-map image to the given GL texture unit. Uploads on
	 * first use (via `uploadNormalMap`) and rebinds the cached
	 * `WebGLTexture` on subsequent calls. Mirrors the
	 * `bindTexture2D` / `createTexture2D` split used by `MaterialBatcher`,
	 * but for normal-map textures which live outside the color
	 * `TextureCache` (cached per-image in `normalMapTextures`).
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap} image - normal-map source
	 * @param {number} unit - GL texture unit the normal map is resolved to
	 */
	bindNormalMap(image, unit) {
		// `image.version` (the dynamic-texture revision; absent => 0/static)
		// lets an animated source force a re-upload by bumping it — only when
		// it actually changed, not every frame. The store compares it and
		// re-uploads into the SAME handle, so an animated source does not churn
		// a new texture object per frame.
		const record = this.normalStore.getResidentRecord(image, {
			version: image.version ?? 0,
			upload: (handle) => {
				return this.createTexture2D(
					unit,
					image,
					this.renderer._glTextureFilter(),
					"no-repeat",
					image.width,
					image.height,
					// normal maps store linear-encoded surface normals;
					// multiplying through alpha would corrupt the encoding
					false,
					undefined,
					handle,
					false,
				);
			},
		});
		// `bindTexture2D` updates `boundTextures[unit]` and `currentTextureUnit`
		// so subsequent colour binds don't land on the wrong unit thinking it is
		// still free. `flush=false` so the in-progress lit batch is undisturbed.
		this.bindTexture2D(record.handle, unit, false);
		// the variant is fixed for normal maps, but the sampler still has to be
		// bound or the unit keeps whatever the previous texture left there
		this.renderer.samplerCache.bind(
			unit,
			this.renderer.samplerCache.get(this.renderer._glTextureFilter()),
		);
	}

	/**
	 * Drop a normal map's slot claim and hand the unit back to the allocator.
	 *
	 * A normal map claims its unit through `allocateTextureUnit()`, which has no
	 * key to release against — so without this the unit stayed marked used for
	 * the rest of the session and the pool drained monotonically as normal maps
	 * came and went, until something forced a full reset.
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap} image - normal-map source
	 * @ignore
	 * @internal
	 */
	releaseNormalUnit(image) {
		const unit = this.normalUnits?.get(image);
		if (unit === undefined) {
			return;
		}
		this.normalUnits.delete(image);
		this.boundNormalMaps[unit] = null;
		this.boundNormalVersions[unit] = -1;
		// the slot was claimed keylessly, so occupancy is the only record of it
		this.renderer.cache.usedUnits.delete(unit);
	}

	/**
	 * Resolve a normal-map source to its slot in the shared pool, uploading and
	 * binding it if it is not already resident.
	 *
	 * A version-only bump (an animated source re-baking into the same canvas
	 * reference) re-uploads into the same GL handle and needs no flush —
	 * `version` only changes between frames, and the batch is flushed at every
	 * frame/camera boundary, so no in-flight vertex references stale content.
	 * A DIFFERENT source landing on a live slot does need the pending vertices
	 * drawn first.
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap} normalMap - the source
	 * @returns {number} the slot to write into `aNormalTextureId`
	 * @ignore
	 * @internal
	 */
	resolveNormalUnit(normalMap) {
		const version = normalMap.version ?? 0;
		const held = this.normalUnits.get(normalMap);

		if (held !== undefined && this.boundNormalMaps[held] === normalMap) {
			if (this.boundNormalVersions[held] !== version) {
				this.bindNormalMap(normalMap, held);
				this.boundNormalVersions[held] = version;
			}
			return held;
		}

		// may flush and wipe every assignment when the pool is exhausted —
		// `addQuad` re-checks `_cacheEpoch` for exactly that reason
		// A freshly claimed slot is always vacant: `freeSlot()` only returns
		// units absent from occupancy, and a normal map's claim is held until it
		// is explicitly released or the pool is wiped (which clears these arrays
		// too). So there is never a live normal map to displace here.
		const unit = this.renderer.cache.allocateTextureUnit();
		this.bindNormalMap(normalMap, unit);
		// Colors and normal maps share one pool since #1585, so a unit this
		// batcher binds a normal map onto may be one ANOTHER batcher still
		// believes holds its color texture — it would then skip re-binding and
		// sample the normal map. Under the old fixed reservation that was
		// impossible; now it has to be announced. `except` is `this`, whose own
		// bookkeeping `bindNormalMap` just updated correctly.
		this.renderer.invalidateTextureUnit(unit, this);
		// `boundTextures[unit]` deliberately keeps pointing at the normal map's
		// GL texture: `uploadNormalMap` reads it back to cache the handle, and
		// `MaterialBatcher.reset()` walks that array to DELETE every texture it
		// owns. Clearing it here leaked one GL texture per normal map per reset.
		this.normalUnits.set(normalMap, unit);
		this.boundNormalMaps[unit] = normalMap;
		this.boundNormalVersions[unit] = version;
		return unit;
	}

	/**
	 * Add a textured quad with optional paired normal map.
	 * @param {TextureAtlas} texture - Source texture atlas
	 * @param {number} x - Destination x-coordinate
	 * @param {number} y - Destination y-coordinate
	 * @param {number} w - Destination width
	 * @param {number} h - Destination height
	 * @param {number} u0 - Texture UV (u0) value
	 * @param {number} v0 - Texture UV (v0) value
	 * @param {number} u1 - Texture UV (u1) value
	 * @param {number} v1 - Texture UV (v1) value
	 * @param {number} tint - tint color (UINT32 argb)
	 * @param {boolean} [reupload=false] - Force the texture to be reuploaded
	 * @param {HTMLImageElement|HTMLCanvasElement|null} [normalMap=null] - paired normal-map (SpriteIlluminator workflow)
	 */
	addQuad(
		texture,
		x,
		y,
		w,
		h,
		u0,
		v0,
		u1,
		v1,
		tint,
		reupload = false,
		normalMap = null,
	) {
		const vertexData = this.vertexData;

		if (vertexData.isFull(4)) {
			this.flush();
		}

		let unit;

		if (this.useMultiTexture) {
			unit = this.uploadTexture(texture, w, h, reupload, false);
			// Desync guard, not the normal path: the cache and this batcher are
			// both sized from `renderer.maxTextures`, so the allocator cannot
			// return an out-of-range unit unless something reassigns one of them
			// at runtime. Cheap enough to keep as a net.
			if (unit >= this.maxBatchTextures) {
				this.flush();
				this.renderer.cache.resetUnitAssignments();
				this.boundNormalMaps.fill(null);
				this.boundNormalVersions.fill(-1);
				unit = this.uploadTexture(texture, w, h, reupload, false);
			}
		} else {
			unit = this.uploadTexture(texture, w, h, reupload);
			if (unit !== this.currentSamplerUnit) {
				this.currentShader.setUniform("uSampler", unit);
				this.currentSamplerUnit = unit;
			}
			// feed the effect's `noise_uv` builtin — see QuadBatcher.addQuad
			if (typeof this.currentShader._setNoiseUVRect === "function") {
				const source = texture.getTexture();
				this.currentShader._setNoiseUVRect(
					source.width || source.videoWidth || 1,
					source.height || source.videoHeight || 1,
					w,
					h,
					Math.min(u0, u1),
					Math.min(v0, v1),
				);
			}
			// direct atlas sampling: uv.y grows downward — see
			// QuadBatcher.addQuad
			this.currentShader._setUVYDir?.(1);
		}

		let normalTextureId = -1;
		if (normalMap !== null && this.useMultiTexture) {
			const epoch = this._cacheEpoch;
			normalTextureId = this.resolveNormalUnit(normalMap);
			if (this._cacheEpoch !== epoch) {
				// Claiming the normal's slot exhausted the pool and wiped every
				// assignment, so the color unit resolved above is stale. Only the
				// color: the normal claimed AFTER the wipe, so its slot is live.
				// Re-resolving cannot wipe again either — the normal is the sole
				// occupant and the pool never resolves below two slots.
				unit = this.uploadTexture(texture, w, h, reupload, false);
			}
			if (normalTextureId === unit) {
				// Reachable when reservations leave only ONE assignable slot: the
				// normal claims it, the color's re-resolve wipes and claims the
				// same one. Sampling the sprite's own albedo as its normal map
				// wrecks the lighting silently, so take the unlit path instead —
				// flat shading is wrong, but visibly and recoverably so.
				normalTextureId = -1;
			}
		}

		// Stamp per-sprite depth onto z BEFORE the transform — see
		// `QuadBatcher.addQuad` for the full rationale (shared corner pool)
		const [vec0, vec1, vec2, vec3] = transformQuadCorners(
			this.viewMatrix,
			x,
			y,
			w,
			h,
			this.renderer.currentDepth,
		);

		const textureId = this.useMultiTexture ? unit : 0;
		vertexData.push(
			vec0.x,
			vec0.y,
			vec0.z,
			u0,
			v0,
			tint,
			textureId,
			normalTextureId,
		);
		vertexData.push(
			vec1.x,
			vec1.y,
			vec1.z,
			u1,
			v0,
			tint,
			textureId,
			normalTextureId,
		);
		vertexData.push(
			vec2.x,
			vec2.y,
			vec2.z,
			u0,
			v1,
			tint,
			textureId,
			normalTextureId,
		);
		vertexData.push(
			vec3.x,
			vec3.y,
			vec3.z,
			u1,
			v1,
			tint,
			textureId,
			normalTextureId,
		);
	}

	/**
	 * Override `blitTexture` so the FBO blit pushes `-1` as the unlit
	 * sentinel (this batcher's vertex layout includes `aNormalTextureId`).
	 * @param {WebGLTexture} source - the raw GL texture to blit
	 * @param {number} x - destination x
	 * @param {number} y - destination y
	 * @param {number} width - destination width
	 * @param {number} height - destination height
	 * @param {GLShader|ShaderEffect} shader - the shader effect to apply
	 */
	blitTexture(source, x, y, width, height, shader) {
		const gl = this.gl;

		this.useShader(shader);

		// keep the batcher's texture-unit bookkeeping aligned with the GL
		// state we just mutated — see `QuadBatcher.blitTexture`.
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, source);
		this.currentTextureUnit = 0;
		this.boundTextures[0] = source;
		shader.setUniform("uSampler", 0);

		// `noise_uv` builtin: a blit is a full-frame quad — identity rect
		shader._setNoiseUVRect?.(width, height, width, height, 0, 0);

		// bottom-up capture FBO: uv.y grows upward inside apply() — see
		// QuadBatcher.blitTexture
		shader._setUVYDir?.(-1);

		// transform corners through the renderer transform — see
		// `QuadBatcher.blitTexture` for the rationale. Only caller today
		// is `WebGLRenderer.blitEffect`, which resets `currentTransform`
		// to identity, so the matrix branch is dormant in practice.
		// Explicit z = 0: the shared corner pool is Vector3d.
		const [vec0, vec1, vec2, vec3] = transformQuadCorners(
			this.viewMatrix,
			x,
			y,
			width,
			height,
			0,
		);

		// blits are always rendered at z = 0 (screen-space, ortho)
		const tint = 0xffffffff;
		this.vertexData.push(vec0.x, vec0.y, 0, 0, 1, tint, 0, -1);
		this.vertexData.push(vec1.x, vec1.y, 0, 1, 1, tint, 0, -1);
		this.vertexData.push(vec2.x, vec2.y, 0, 0, 0, tint, 0, -1);
		this.vertexData.push(vec3.x, vec3.y, 0, 1, 0, tint, 0, -1);

		this.flush();

		// see QuadBatcher.blitTexture — unit 0 is nulled renderer-wide
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, null);
		this.currentTextureUnit = -1;
		this.renderer.invalidateTextureUnit(0);

		this.useShader(this.defaultShader);
	}
}
