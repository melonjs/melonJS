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
	) {
		const gl = this.gl;
		const isPOT = isPowerOfTwo(w) && isPowerOfTwo(h);
		const rs =
			repeat.search(/^repeat(-x)?$/) === 0 &&
			(isPOT || this.renderer.WebGLVersion > 1)
				? gl.REPEAT
				: gl.CLAMP_TO_EDGE;
		const rt =
			repeat.search(/^repeat(-y)?$/) === 0 &&
			(isPOT || this.renderer.WebGLVersion > 1)
				? gl.REPEAT
				: gl.CLAMP_TO_EDGE;

		let currentTexture = texture;
		if (!currentTexture) {
			currentTexture = gl.createTexture();
		}

		this.bindTexture2D(currentTexture, unit);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rs);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, rt);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);

		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultipliedAlpha);

		if (pixels !== null && pixels.compressed === true) {
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
			(pixels === null || pixels.compressed !== true)
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
	bindTexture2D(texture, unit) {
		const gl = this.gl;

		if (texture !== this.boundTextures[unit]) {
			this.flush();
			if (this.currentTextureUnit !== unit) {
				this.currentTextureUnit = unit;
				gl.activeTexture(gl.TEXTURE0 + unit);
			}
			gl.bindTexture(gl.TEXTURE_2D, texture);
			this.boundTextures[unit] = texture;
		} else if (this.currentTextureUnit !== unit) {
			this.flush();
			this.currentTextureUnit = unit;
			gl.activeTexture(gl.TEXTURE0 + unit);
		}
	}

	/**
	 * unbind the given WebGL texture, forcing it to be reuploaded
	 * @param {WebGLTexture} [texture] - a WebGL texture
	 * @param {number} [unit] - a WebGL texture
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
	 */
	uploadTexture(texture, w, h, force = false) {
		const unit = this.renderer.cache.getUnit(texture);
		const texture2D = this.boundTextures[unit];

		if (typeof texture2D === "undefined" || force) {
			this.createTexture2D(
				unit,
				texture.getTexture(),
				this.renderer.settings.antiAlias ? this.gl.LINEAR : this.gl.NEAREST,
				texture.repeat,
				w,
				h,
				texture.premultipliedAlpha,
				undefined,
				texture2D,
			);
		} else {
			this.bindTexture2D(texture2D, unit);
		}

		return this.currentTextureUnit;
	}
}
