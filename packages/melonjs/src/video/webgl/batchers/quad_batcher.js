import { Vector2d } from "../../../math/vector2d.ts";
import IndexBuffer from "../buffer/index.js";
import { buildMultiTextureFragment } from "./../shaders/multitexture.js";
import quadMultiVertex from "./../shaders/quad-multi.vert";
import { MaterialBatcher } from "./material_batcher.js";

/**
 * additional import for TypeScript
 * @import {TextureAtlas} from "./../../texture/atlas.js";
 */

// a pool of reusable vectors
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
export default class QuadBatcher extends MaterialBatcher {
	/**
	 * Initialize the compositor
	 * @ignore
	 */
	init(renderer) {
		/**
		 * the maximum number of texture units used for multi-texture batching
		 * @type {number}
		 * @ignore
		 */
		this.maxBatchTextures = Math.min(renderer.maxTextures, 16);

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
				{
					name: "aTextureId",
					size: 1,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 5 * Float32Array.BYTES_PER_ELEMENT,
				},
			],
			shader: {
				vertex: quadMultiVertex,
				fragment: buildMultiTextureFragment(this.maxBatchTextures),
			},
		});

		// bind all sampler uniforms to their respective texture units
		for (let i = 0; i < this.maxBatchTextures; i++) {
			this.defaultShader.setUniform("uSampler" + i, i);
		}

		/**
		 * whether multi-texture batching is currently active
		 * (disabled when a custom ShaderEffect is applied)
		 * @type {boolean}
		 * @ignore
		 */
		this.useMultiTexture = true;

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
	 * Select the shader to use for compositing.
	 * Multi-texture batching is automatically enabled when the default
	 * shader is active, and disabled for custom ShaderEffect shaders.
	 * @see GLShader
	 * @see ShaderEffect
	 * @param {GLShader|ShaderEffect} shader - a reference to a GLShader or ShaderEffect instance
	 */
	useShader(shader) {
		super.useShader(shader);
		this.useMultiTexture = shader === this.defaultShader;
	}

	/**
	 * Reset compositor internal state
	 * @ignore
	 */
	reset() {
		super.reset();

		// re-create index buffer after context loss
		const maxQuads = this.vertexData.maxVertex / 4;
		this.indexBuffer = new IndexBuffer(
			this.gl,
			maxQuads * 6,
			this.renderer.WebGLVersion > 1,
		);
		this.indexBuffer.fillQuadPattern(maxQuads);

		// re-bind sampler uniforms after context restore
		for (let i = 0; i < this.maxBatchTextures; i++) {
			this.defaultShader.setUniform("uSampler" + i, i);
		}
		this.useMultiTexture = true;
	}

	/**
	 * Flush batched texture data to the GPU using indexed drawing.
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

			vertex.clear();
		}
	}

	/**
	 * Draw a screen-aligned quad with the given raw WebGL texture through the given shader.
	 * Binds the texture to unit 0, pushes 4 vertices (Y-flipped UVs), flushes,
	 * then unbinds the texture.
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

		// bind the source texture to unit 0
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, source);
		shader.setUniform("uSampler", 0);

		// push a screen-aligned quad with Y-flipped UVs
		const tint = 0xffffffff;
		this.vertexData.push(x, y, 0, 1, tint, 0);
		this.vertexData.push(x + width, y, 1, 1, tint, 0);
		this.vertexData.push(x, y + height, 0, 0, tint, 0);
		this.vertexData.push(x + width, y + height, 1, 0, tint, 0);

		this.flush();

		// unbind the texture to prevent feedback loop on next frame
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, null);
		delete this.boundTextures[0];

		// restore the default shader (also re-enables multi-texture batching)
		this.useShader(this.defaultShader);
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
			this.flush();
		}

		let unit;

		if (this.useMultiTexture) {
			// multi-texture path: embed the texture unit in the vertex data
			// and avoid flushing on texture changes
			unit = this.uploadTexture(texture, w, h, reupload, false);
			// shader only supports maxBatchTextures samplers — flush and
			// reset if the cache assigned a unit beyond the shader's range
			if (unit >= this.maxBatchTextures) {
				this.flush();
				this.renderer.cache.resetUnitAssignments();
				unit = this.uploadTexture(texture, w, h, reupload, false);
			}
		} else {
			// single-texture fallback (custom ShaderEffect active):
			// use regular upload which flushes on texture change, and set uSampler
			unit = this.uploadTexture(texture, w, h, reupload);
			if (unit !== this.currentSamplerUnit) {
				this.currentShader.setUniform("uSampler", unit);
				this.currentSamplerUnit = unit;
			}
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
		// textureId is the unit index for multi-texture, or 0 for single-texture fallback
		const textureId = this.useMultiTexture ? unit : 0;
		vertexData.push(vec0.x, vec0.y, u0, v0, tint, textureId);
		vertexData.push(vec1.x, vec1.y, u1, v0, tint, textureId);
		vertexData.push(vec2.x, vec2.y, u0, v1, tint, textureId);
		vertexData.push(vec3.x, vec3.y, u1, v1, tint, textureId);
	}
}
