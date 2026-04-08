import { Vector2d } from "../../../math/vector2d.ts";
import IndexBuffer from "../buffer/index.js";
import quadFragment from "./../shaders/quad.frag";
import quadVertex from "./../shaders/quad.vert";
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

		const unit = this.uploadTexture(texture, w, h, reupload);

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
