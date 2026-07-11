import { off, on, TEXTURE2D_DESTROYED } from "../../../system/event.ts";
import { MAX_LIGHTS } from "../lighting/constants.ts";
import { buildLitMultiTextureFragment } from "./../shaders/multitexture-lit.js";
import quadMultiLitVertex from "./../shaders/quad-multi-lit.vert";
import QuadBatcher, { V_ARRAY } from "./quad_batcher.js";

/**
 * additional import for TypeScript
 * @import {TextureAtlas} from "./../../texture/atlas.js";
 */

/**
 * Lit-aware variant of `QuadBatcher` for the SpriteIlluminator workflow.
 *
 * Adds a 5th vertex attribute (`aNormalTextureId`) so each quad knows
 * which paired normal-map sampler to read, and bundles the per-frame
 * light uniforms (`uLightPos`, `uLightColor`, `uLightHeight`, `uAmbient`)
 * that the lit fragment shader iterates.
 *
 * Texture-slot capacity is halved relative to `QuadBatcher` because each
 * sprite may need a paired (color, normal) sampler — color goes to unit
 * `n`, normal to unit `maxBatchTextures + n`. The `WebGLRenderer` only
 * dispatches sprites here when the scene actually needs lighting (active
 * `Light2d` AND the sprite has a `normalMap`); unlit sprites stay on
 * `QuadBatcher` and pay nothing.
 * @category Rendering
 */
export default class LitQuadBatcher extends QuadBatcher {
	/**
	 * @ignore
	 */
	init(renderer) {
		// halve the texture cap: each color slot is paired with a normal
		// slot at offset `+ maxBatchTextures` so the WebGL1 8-unit minimum
		// still affords at least 4 lit sprites per batch.
		const halved = Math.min(
			Math.max(1, Math.floor(renderer.maxTextures / 2)),
			16,
		);
		this.maxBatchTextures = halved;

		// Skip QuadBatcher.init (its attribute layout / shader differ) and
		// invoke MaterialBatcher.init directly with the lit configuration.
		Object.getPrototypeOf(QuadBatcher.prototype).init.call(this, renderer, {
			attributes: [
				{
					// vec3: (x, y, z). z carries `renderable.depth` for
					// perspective projection (Camera3d). Stride = 32 bytes.
					name: "aVertex",
					size: 3,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 0 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aRegion",
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 3 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aColor",
					size: 4,
					type: renderer.gl.UNSIGNED_BYTE,
					normalized: true,
					offset: 5 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aTextureId",
					size: 1,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 6 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aNormalTextureId",
					size: 1,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 7 * Float32Array.BYTES_PER_ELEMENT,
				},
			],
			shader: {
				vertex: quadMultiLitVertex,
				fragment: buildLitMultiTextureFragment(halved),
			},
		});

		// Reuse the parent's setup helpers — they're agnostic to the
		// shader/attribute layout, just iterate `this.maxBatchTextures`.
		this.bindColorSamplers();
		this.bindNormalSamplers();
		this.createIndexBuffer();

		this.useMultiTexture = true;

		/**
		 * normal-map texture per color slot — keyed by the same unit index as
		 * `boundTextures`. Used by `addQuad` to detect when a normal-map slot
		 * needs (re-)uploading, mirroring the color-texture cache.
		 * @type {Array<HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap|null>}
		 * @ignore
		 */
		this.boundNormalMaps = new Array(halved).fill(null);

		/**
		 * Per-slot content `version` of the normal map currently bound there. An
		 * animated source keeps a stable canvas reference across re-bakes but
		 * bumps its `version`, so `addQuad` compares this (not just the reference)
		 * to know when to re-bind/re-upload. `-1` = nothing bound.
		 * @type {number[]}
		 * @ignore
		 */
		this.boundNormalVersions = new Array(halved).fill(-1);

		/**
		 * Map from a normal-map source image to its uploaded GL texture and the
		 * source `version` it was uploaded at. A source that bumps its `version`
		 * (e.g. an animated {@link NoiseTexture2d}) is re-uploaded on next bind —
		 * the three.js `Texture.needsUpdate` model, scoped to normal maps which
		 * live outside the color `TextureCache`.
		 * @type {Map<HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap, {tex: WebGLTexture, version: number}>}
		 * @ignore
		 */
		this.normalMapTextures = new Map();

		this._lightCount = 0;
		this._maxLights = MAX_LIGHTS;
		this.defaultShader.setUniform("uLightCount", 0);
		this.defaultShader.setUniform("uAmbient", [0, 0, 0]);

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
	 */
	destroy() {
		if (this._onTexture2dDestroyed) {
			off(TEXTURE2D_DESTROYED, this._onTexture2dDestroyed);
			this._onTexture2dDestroyed = null;
		}
		super.destroy();
	}

	/**
	 * Activating the lit batcher claims the paired normal-map unit range
	 * `[maxBatchTextures, 2*maxBatchTextures)` for good: the pairing is baked
	 * into the lit shader's sampler bindings, while the renderer-wide unit
	 * allocator would otherwise happily assign those same units to color
	 * textures (an unlit sprite's, a mesh's, a pattern's) — each batcher
	 * tracks its bindings per-instance, so whichever bound second silently
	 * clobbered the other's texture. Reserving through the cache keeps the
	 * allocator away; done lazily on first bind so unlit games keep their
	 * full unit pool, and left reserved thereafter (a lit game stays lit).
	 * @ignore
	 */
	bind() {
		super.bind();
		if (this._normalRangeReserved !== true) {
			this._normalRangeReserved = true;
			const cache = this.renderer.cache;
			for (let i = 0; i < this.maxBatchTextures; i++) {
				const unit = this.maxBatchTextures + i;
				if (cache.reservedUnits.has(unit)) {
					// a ShaderEffect extra sampler claimed a unit in our fixed
					// range before lighting first activated — its texture and
					// the paired normal map for color slot `i` now collide
					console.warn(
						`LitQuadBatcher: texture unit ${unit} is already reserved (ShaderEffect.setTexture?) and overlaps the paired normal-map range — expect sampling conflicts`,
					);
				}
				cache.reserveUnit(unit);
			}
			// evict any color texture the allocator parked in the normal range
			// before lighting first activated (units are sticky once assigned)
			cache.resetUnitAssignments();
		}
	}

	/**
	 * Release the cached GL texture uploaded for the given normal-map source
	 * and clear any slot bookkeeping referencing it. Safe to call for images
	 * that were never bound.
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap} image - normal-map source
	 */
	evictNormalMap(image) {
		const cached = this.normalMapTextures.get(image);
		if (typeof cached !== "undefined") {
			this.gl.deleteTexture(cached.tex);
			this.normalMapTextures.delete(image);
			for (let i = 0; i < this.boundNormalMaps.length; i++) {
				if (this.boundNormalMaps[i] === image) {
					this.boundNormalMaps[i] = null;
					this.boundNormalVersions[i] = -1;
				}
			}
		}
	}

	/**
	 * Bind the paired normal sampler uniforms (`uNormalSampler0..N-1`)
	 * to texture units `maxBatchTextures..2*maxBatchTextures-1`. Called
	 * from `init` and `reset`.
	 * @ignore
	 */
	bindNormalSamplers() {
		for (let i = 0; i < this.maxBatchTextures; i++) {
			this.defaultShader.setUniform(
				"uNormalSampler" + i,
				this.maxBatchTextures + i,
			);
		}
	}

	/**
	 * @ignore
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
		this.bindNormalSamplers();
		this.boundNormalMaps.fill(null);
		this.boundNormalVersions.fill(-1);
		this.normalMapTextures.clear();
		this._lightCount = 0;
		this.defaultShader.setUniform("uLightCount", 0);
		this.defaultShader.setUniform("uAmbient", [0, 0, 0]);
	}

	/**
	 * Also drop the normal-map pairing when its paired unit is invalidated.
	 * Normal maps live at units `maxBatchTextures..2*maxBatchTextures-1`
	 * (indexed by the paired albedo unit), which overlap the top units that
	 * {@link WebGLRenderer#toFrameTexture} (its scratch unit) and
	 * {@link ShaderEffect#_prepareTextures} (its reserved extra samplers,
	 * counting DOWN from the top) bind directly. When one of those GL units is
	 * clobbered we must forget the pairing, or the next lit draw would assume
	 * the normal is still resident and skip re-binding it, sampling the
	 * clobbering texture as a normal map.
	 * @param {number} unit - the GL texture unit to invalidate
	 * @ignore
	 */
	invalidateUnit(unit) {
		super.invalidateUnit(unit);
		const n = unit - this.maxBatchTextures;
		if (n >= 0 && n < this.maxBatchTextures) {
			this.boundNormalMaps[n] = null;
			this.boundNormalVersions[n] = -1;
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
	 */
	_onTextureCacheReset() {
		super._onTextureCacheReset();
		this.boundNormalMaps?.fill(null);
		this.boundNormalVersions?.fill(-1);
	}

	/**
	 * Upload per-frame Light2d uniforms used by the lit fragment path.
	 * Called once per camera per frame (before the world tree walk).
	 * Lights past `MAX_LIGHTS` are silently ignored.
	 *
	 * Coordinates must be supplied in the same space as the renderer's
	 * pre-projection vertex coords (i.e. camera-local / FBO-local),
	 * matching `Stage.drawLighting`'s convention.
	 * @param {object} uniforms
	 * @param {Float32Array} uniforms.positions - flat array of `[x, y, radius, intensity]` per light, length = 4 * count
	 * @param {Float32Array} uniforms.colors - flat array of `[r, g, b]` per light, length = 3 * count
	 * @param {Float32Array} [uniforms.heights] - flat array of per-light height, length = MAX_LIGHTS
	 * @param {number} uniforms.count - number of lights to render (clamped to MAX_LIGHTS)
	 * @param {number[]} [uniforms.ambient] - `[r, g, b]` ambient floor (0..1 each)
	 */
	setLightUniforms(uniforms) {
		const shader = this.defaultShader;
		const count = Math.min(uniforms.count | 0, this._maxLights);
		this._lightCount = count;
		shader.setUniform("uLightCount", count);
		if (count > 0) {
			shader.setUniform("uLightPos", uniforms.positions);
			shader.setUniform("uLightColor", uniforms.colors);
			if (uniforms.heights) {
				shader.setUniform("uLightHeight", uniforms.heights);
			}
		}
		if (uniforms.ambient) {
			shader.setUniform("uAmbient", uniforms.ambient);
		}
	}

	/**
	 * Bind a normal-map image to the given GL texture unit. Uploads on
	 * first use (via `uploadNormalMap`) and rebinds the cached
	 * `WebGLTexture` on subsequent calls. Mirrors the
	 * `bindTexture2D` / `createTexture2D` split used by `MaterialBatcher`,
	 * but for normal-map textures which live outside the color
	 * `TextureCache` (cached per-image in `normalMapTextures`).
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap} image - normal-map source
	 * @param {number} unit - GL texture unit (already offset by `maxBatchTextures`)
	 */
	bindNormalMap(image, unit) {
		const cached = this.normalMapTextures.get(image);
		// `image.version` (the dynamic-texture revision; absent ⇒ 0/static) lets
		// an animated source force a re-upload by bumping it — only when it
		// actually changed, not every frame.
		const version = image.version ?? 0;
		if (typeof cached !== "undefined" && cached.version === version) {
			// `bindTexture2D` updates `boundTextures[unit]` and
			// `currentTextureUnit` so subsequent color-texture binds don't
			// land on the wrong unit thinking it's still free. `flush=false`
			// so we don't disturb the in-progress lit batch.
			this.bindTexture2D(cached.tex, unit, false);
			return;
		}
		this.uploadNormalMap(image, unit, version);
	}

	/**
	 * Upload a normal-map image to GL and cache the resulting `WebGLTexture`
	 * for future `bindNormalMap` calls. Not meant to be called directly —
	 * `bindNormalMap` invokes this on the first use of a given image.
	 *
	 * `premultipliedAlpha = false` — normal maps store linear-encoded
	 * surface normals; multiplying through alpha would corrupt the
	 * encoding for any non-opaque texel.
	 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|ImageBitmap} image - normal-map source
	 * @param {number} unit - GL texture unit (already offset by `maxBatchTextures`)
	 * @param {number} [version=0] - the source revision being uploaded
	 */
	uploadNormalMap(image, unit, version = 0) {
		// Reuse the existing GL texture handle when re-uploading a changed source
		// (an animated NoiseTexture2d): `createTexture2D` re-`texImage2D`s into the
		// passed handle instead of churning a new texture object every frame. The
		// source dimensions are stable, so the same handle stays valid.
		const prev = this.normalMapTextures.get(image);
		this.createTexture2D(
			unit,
			image,
			this.renderer._glTextureFilter(),
			"no-repeat",
			image.width,
			image.height,
			false,
			undefined,
			prev?.tex,
			false,
		);
		this.normalMapTextures.set(image, {
			tex: this.boundTextures[unit],
			version,
		});
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
		}

		let normalTextureId = -1;
		if (normalMap !== null && this.useMultiTexture) {
			const normalUnit = this.maxBatchTextures + unit;
			const prev = this.boundNormalMaps[unit];
			const version = normalMap.version ?? 0;
			// Re-bind when the source changed OR an animated source bumped its
			// content `version`. A reference-only check would freeze animated
			// textures, whose canvas reference is stable across re-bakes.
			if (prev !== normalMap || this.boundNormalVersions[unit] !== version) {
				// Only a DIFFERENT source needs the pending vertices flushed before
				// rebinding over its slot. A version-only bump (same reference, an
				// animated re-bake) re-uploads into the same GL handle WITHOUT a
				// flush — `version` only changes between frames (via `update()`) and
				// the batch is flushed at each frame/camera boundary, so no in-flight
				// vertices ever reference stale content.
				if (prev !== null && prev !== normalMap) {
					this.flush();
				}
				this.bindNormalMap(normalMap, normalUnit);
				this.boundNormalMaps[unit] = normalMap;
				this.boundNormalVersions[unit] = version;
			}
			normalTextureId = unit;
		}

		// Stamp per-sprite depth onto z BEFORE `m.apply` — see
		// `QuadBatcher.addQuad` for the full rationale. V_ARRAY is the
		// shared Vector3d pool from `QuadBatcher`.
		const m = this.viewMatrix;
		const z = this.renderer.currentDepth;
		const vec0 = V_ARRAY[0].set(x, y, z);
		const vec1 = V_ARRAY[1].set(x + w, y, z);
		const vec2 = V_ARRAY[2].set(x, y + h, z);
		const vec3 = V_ARRAY[3].set(x + w, y + h, z);

		if (!m.isIdentity()) {
			m.apply(vec0);
			m.apply(vec1);
			m.apply(vec2);
			m.apply(vec3);
		}

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

		// transform corners through the renderer transform — see
		// `QuadBatcher.blitTexture` for the rationale. Only caller today
		// is `WebGLRenderer.blitEffect`, which resets `currentTransform`
		// to identity, so the matrix branch is dormant in practice.
		// Explicit z = 0 because V_ARRAY is Vector3d (shared with addQuad).
		const m = this.viewMatrix;
		const vec0 = V_ARRAY[0].set(x, y, 0);
		const vec1 = V_ARRAY[1].set(x + width, y, 0);
		const vec2 = V_ARRAY[2].set(x, y + height, 0);
		const vec3 = V_ARRAY[3].set(x + width, y + height, 0);
		if (m && !m.isIdentity()) {
			m.apply(vec0);
			m.apply(vec1);
			m.apply(vec2);
			m.apply(vec3);
		}

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
