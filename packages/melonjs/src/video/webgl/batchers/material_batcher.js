import { isPowerOfTwo } from "../../../math/math.ts";
import { Batcher } from "./batcher.js";

/**
 * additional import for TypeScript
 * @import {TextureAtlas} from "./../../texture/atlas.js";
 */

/**
 * Base class for batchers that manage WebGL textures and material properties.
 * Provides texture creation, binding, uploading, and deletion.
 * @category Rendering
 */
export class MaterialBatcher extends Batcher {
	/**
	 * Initialize the textured batcher
	 * @ignore
	 */
	init(renderer, settings) {
		super.init(renderer, settings);

		/**
		 * the current active texture unit
		 * @ignore
		 */
		this.currentTextureUnit = -1;

		/**
		 * bound textures by unit
		 * @ignore
		 */
		this.boundTextures = [];

		/**
		 * track the current sampler unit to avoid redundant gl.uniform1i calls
		 * @ignore
		 */
		this.currentSamplerUnit = -1;
	}

	/**
	 * Reset batcher internal state
	 * @ignore
	 */
	reset() {
		super.reset();

		for (let i = 0; i < this.renderer.maxTextures; i++) {
			const texture2D = this.getTexture2D(i);
			if (typeof texture2D !== "undefined") {
				this.deleteTexture2D(texture2D);
			}
		}
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
		const isPOT = isPowerOfTwo(w) && isPowerOfTwo(h);
		const wantsRepeat = repeat !== "no-repeat";
		const canRepeat = isPOT || this.renderer.WebGLVersion > 1;
		const rs =
			repeat.search(/^repeat(-x)?$/) === 0 && canRepeat
				? gl.REPEAT
				: gl.CLAMP_TO_EDGE;
		const rt =
			repeat.search(/^repeat(-y)?$/) === 0 && canRepeat
				? gl.REPEAT
				: gl.CLAMP_TO_EDGE;

		// Warn (only when actually downgrading) — the caller asked for tiling
		// but we have to clamp because WebGL 1 does not allow `REPEAT` on
		// non-power-of-two textures. Their `repeat: "repeat*"` setting will
		// have no visible effect. Either resize the source to POT or run on
		// a WebGL 2 context.
		if (wantsRepeat && !canRepeat) {
			console.warn(
				"melonJS: repeat wrap (" +
					repeat +
					") requested on a non-power-of-two texture (" +
					w +
					"x" +
					h +
					") under WebGL 1 — downgrading to clamp-to-edge",
			);
		}

		let currentTexture = texture;
		if (!currentTexture) {
			currentTexture = gl.createTexture();
		}

		this.bindTexture2D(currentTexture, unit, flush);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rs);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, rt);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);

		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultipliedAlpha);

		if (pixels !== null && typeof pixels.upload === "function") {
			// `TextureResource` path: the resource owns its upload (raw
			// buffer, future synthesized sources, etc.). Keeps every
			// `gl.texImage2D` variant in one place per source type.
			pixels.upload(gl, gl.TEXTURE_2D);
		} else if (pixels !== null && pixels.compressed === true) {
			const mipmaps = pixels.mipmaps;
			for (let i = 0; i < mipmaps.length; i++) {
				gl.compressedTexImage2D(
					gl.TEXTURE_2D,
					i,
					pixels.format,
					mipmaps[i].width,
					mipmaps[i].height,
					0,
					mipmaps[i].data,
				);
			}
		} else if (pixels === null || typeof pixels.byteLength !== "undefined") {
			if (this.renderer.WebGLVersion > 1) {
				gl.texImage2D(
					gl.TEXTURE_2D,
					0,
					gl.RGBA,
					w,
					h,
					0,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					pixels,
					0,
				);
			} else {
				gl.texImage2D(
					gl.TEXTURE_2D,
					0,
					gl.RGBA,
					w,
					h,
					0,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					pixels,
				);
			}
		} else if (
			typeof globalThis.OffscreenCanvas !== "undefined" &&
			pixels instanceof globalThis.OffscreenCanvas
		) {
			const imageBitmap = pixels.transferToImageBitmap();
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				imageBitmap,
			);
			imageBitmap.close();
		} else {
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				pixels,
			);
		}

		if (
			isPOT &&
			mipmap === true &&
			pixels !== null &&
			pixels.compressed !== true &&
			typeof pixels.upload !== "function"
		) {
			gl.generateMipmap(gl.TEXTURE_2D);
		} else if (pixels === null && isPOT && mipmap === true) {
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
			const unit = this.renderer.cache.peekUnit(texture);
			if (unit !== -1) {
				const texture2D = this.boundTextures[unit];
				if (typeof texture2D !== "undefined") {
					this.gl.deleteTexture(texture2D);
					this.unbindTexture2D(texture2D);
				}
			}
			this.renderer.cache.delete(texture.getTexture());
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
	 * @ignore
	 * @param {TextureAtlas|TextureResource} texture
	 * @param {number} [w] - ignored when the source has its own `width` (the
	 *   common case); kept for the legacy signature where callers passed a
	 *   destination size. Forwarded only as a last-resort default.
	 * @param {number} [h] - same as `w`.
	 * @param {boolean} [force=false]
	 * @param {boolean} [flush=true]
	 */
	uploadTexture(texture, w, h, force = false, flush = true) {
		const unit = this.renderer.cache.getUnit(texture);
		const texture2D = this.boundTextures[unit];

		if (typeof texture2D === "undefined" || force) {
			// honor a resource-specified filter (e.g. tilemap index textures
			// need NEAREST regardless of the global antiAlias setting),
			// otherwise fall back to the renderer-wide preference
			const filter =
				typeof texture.filter !== "undefined"
					? texture.filter
					: this.renderer.settings.antiAlias
						? this.gl.LINEAR
						: this.gl.NEAREST;
			// `w`/`h` historically came from callers (e.g. `addQuad`) that
			// passed the DESTINATION quad size, not the texture size. That
			// broke the downstream POT check — a 480×1216 atlas drawn into
			// a 256×256 quad reported `isPOT=true` and tripped
			// `gl.generateMipmap` on WebGL 1. Always derive the actual
			// texture dimensions from the source, falling back to the
			// passed-in values only when the source has none.
			const source = texture.getTexture();
			// `HTMLVideoElement` exposes its real pixel dimensions through
			// `videoWidth`/`videoHeight`; `width`/`height` default to 0
			// until the element is explicitly sized. Prefer the regular
			// width/height when non-zero, otherwise fall back to the
			// video-specific properties, and finally to the caller-supplied
			// w/h for sources that have neither.
			const texW = source.width || source.videoWidth || w;
			const texH = source.height || source.videoHeight || h;
			this.createTexture2D(
				unit,
				source,
				filter,
				texture.repeat,
				texW,
				texH,
				texture.premultipliedAlpha,
				undefined,
				texture2D,
				flush,
			);
		} else {
			this.bindTexture2D(texture2D, unit, flush);
		}

		return flush ? this.currentTextureUnit : unit;
	}
}
