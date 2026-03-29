import { isPowerOfTwo } from "../../../math/math.ts";
import { Vector2d } from "../../../math/vector2d.ts";
import IndexBuffer from "../buffer/index.js";
import quadFragment from "./../shaders/quad.frag";
import quadVertex from "./../shaders/quad.vert";
import { Batcher } from "./batcher.js";

/**
 * additional import for TypeScript
 * @import {TextureAtlas} from "./../../texture/atlas.js";
 */

// a pool of resuable vectors
const V_ARRAY = [
	new Vector2d(),
	new Vector2d(),
	new Vector2d(),
	new Vector2d(),
];

/**
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 * @category Rendering
 */
export default class QuadBatcher extends Batcher {
	/**
	 * Initialize the compositor
	 * @ignore
	 */
	init(renderer) {
		super.init(renderer, {
			attributes: [
				{
					name: "aVertex",
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 0 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aRegion",
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 2 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aColor",
					size: 4,
					type: renderer.gl.UNSIGNED_BYTE,
					normalized: true,
					offset: 4 * Float32Array.BYTES_PER_ELEMENT,
				},
			],
			shader: {
				vertex: quadVertex,
				fragment: quadFragment,
			},
		});

		// list of active texture units
		this.currentTextureUnit = -1;
		this.boundTextures = [];

		// track the current sampler unit to avoid redundant gl.uniform1i calls
		this.currentSamplerUnit = -1;

		// create the index buffer for quad batching (4 verts + 6 indices per quad)
		const maxQuads = this.vertexData.maxVertex / 4;
		this.indexBuffer = new IndexBuffer(
			this.gl,
			maxQuads * 6,
			this.renderer.WebGLVersion > 1,
		);
		this.indexBuffer.fillQuadPattern(maxQuads);
	}

	/**
	 * Reset compositor internal state
	 * @ignore
	 */
	reset() {
		super.reset();

		// delete all related bound texture
		for (let i = 0; i < this.renderer.maxTextures; i++) {
			const texture2D = this.getTexture2D(i);
			if (typeof texture2D !== "undefined") {
				this.deleteTexture2D(texture2D);
			}
		}
		this.currentTextureUnit = -1;
		this.currentSamplerUnit = -1;

		// re-create index buffer after context loss
		const maxQuads = this.vertexData.maxVertex / 4;
		this.indexBuffer = new IndexBuffer(
			this.gl,
			maxQuads * 6,
			this.renderer.WebGLVersion > 1,
		);
		this.indexBuffer.fillQuadPattern(maxQuads);
	}

	/**
	 * Flush batched texture data to the GPU using indexed drawing.
	 * Overrides the base compositor flush to use drawElements with the pre-computed index buffer.
	 * @param {number} [mode=gl.TRIANGLES] - the GL drawing mode
	 */
	flush(mode = this.mode) {
		const vertex = this.vertexData;
		const vertexCount = vertex.vertexCount;

		if (vertexCount > 0) {
			const gl = this.gl;
			const vertexSize = vertex.vertexSize;

			// ensure the index buffer is bound
			this.indexBuffer.bind();

			// Copy vertex data into stream buffer
			if (this.renderer.WebGLVersion > 1) {
				gl.bufferData(
					gl.ARRAY_BUFFER,
					vertex.toFloat32(),
					gl.STREAM_DRAW,
					0,
					vertexCount * vertexSize,
				);
			} else {
				gl.bufferData(
					gl.ARRAY_BUFFER,
					vertex.toFloat32(0, vertexCount * vertexSize),
					gl.STREAM_DRAW,
				);
			}

			// 4 vertices per quad -> vertexCount/4 quads -> *6 indices per quad
			const indexCount = (vertexCount / 4) * 6;
			gl.drawElements(mode, indexCount, this.indexBuffer.type, 0);

			// clear the vertex buffer
			vertex.clear();
		}
	}

	/**
	 * Create a WebGL texture from an image
	 * @param {number} unit - Destination texture unit
	 * @param {Image|HTMLCanvasElement|ImageData|Uint8Array[]|Float32Array[]} [pixels=null] - Source image
	 * @param {number} filter - gl.LINEAR or gl.NEAREST
	 * @param {string} [repeat="no-repeat"] - Image repeat behavior (see {@link ImageLayer#repeat})
	 * @param {number} [w=pixels.width] - Source image width (Only use with UInt8Array[] or Float32Array[] source image)
	 * @param {number} [h=pixels.height] - Source image height (Only use with UInt8Array[] or Float32Array[] source image)
	 * @param {boolean} [premultipliedAlpha=true] - Multiplies the alpha channel into the other color channels
	 * @param {boolean} [mipmap=true] - Whether mipmap levels should be generated for this texture
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
			// compressed texture with mipmap levels
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
			// if pixels is undefined, or if it's Uint8Array/Float32Array TypedArray
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
			// convert to ImageBitmap first (else Safari 16.4 and higher will throw a TypeError exception)
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

		// generate the sprite mipmap (used when scaling) if a PowerOfTwo texture
		// skip for compressed textures as they include their own mip levels
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
			// TextureAtlas: resolve to the bound WebGLTexture and clean up the cache
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

	/**
	 * Add a textured quad
	 * @param {TextureAtlas} texture - Source texture atlas
	 * @param {number} x - Destination x-coordinate
	 * @param {number} y - Destination y-coordinate
	 * @param {number} w - Destination width
	 * @param {number} h - Destination height
	 * @param {number} u0 - Texture UV (u0) value.
	 * @param {number} v0 - Texture UV (v0) value.
	 * @param {number} u1 - Texture UV (u1) value.
	 * @param {number} v1 - Texture UV (v1) value.
	 * @param {number} tint - tint color to be applied to the texture in UINT32 (argb) format
	 * @param {boolean} reupload - Force the texture to be reuploaded even if already bound
	 */
	addQuad(texture, x, y, w, h, u0, v0, u1, v1, tint, reupload = false) {
		const vertexData = this.vertexData;

		if (vertexData.isFull(4)) {
			// is the vertex buffer full if we add 4 more vertices
			this.flush();
		}

		// upload and activate the texture if necessary
		const unit = this.uploadTexture(texture, w, h, reupload);

		// only update the fragment sampler uniform when the texture unit changes,
		// avoiding redundant gl.uniform1i calls when consecutive quads share the same texture
		if (unit !== this.currentSamplerUnit) {
			this.currentShader.setUniform("uSampler", unit);
			this.currentSamplerUnit = unit;
		}

		// Transform vertices
		const m = this.viewMatrix;
		const vec0 = V_ARRAY[0].set(x, y);
		const vec1 = V_ARRAY[1].set(x + w, y);
		const vec2 = V_ARRAY[2].set(x, y + h);
		const vec3 = V_ARRAY[3].set(x + w, y + h);

		if (!m.isIdentity()) {
			m.apply(vec0);
			m.apply(vec1);
			m.apply(vec2);
			m.apply(vec3);
		}

		// 4 vertices per quad; the index buffer provides the 6 indices
		vertexData.push(vec0.x, vec0.y, u0, v0, tint);
		vertexData.push(vec1.x, vec1.y, u1, v0, tint);
		vertexData.push(vec2.x, vec2.y, u0, v1, tint);
		vertexData.push(vec3.x, vec3.y, u1, v1, tint);
	}
}
