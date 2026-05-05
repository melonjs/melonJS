/**
 * A fixed-size vertex array buffer for batching vertex data.
 * Renderer-agnostic — stores vertex data in typed arrays (Float32/Uint32).
 * Batchers must check isFull() and flush before the buffer overflows.
 * @ignore
 */

export default class VertexArrayBuffer {
	constructor(vertexSize, maxVertex) {
		// the size of one vertex in floats
		this.vertexSize = vertexSize;
		// the maximum number of vertices the vertex array buffer can hold
		this.maxVertex = maxVertex;
		// the current number of vertices added to the vertex array buffer
		this.vertexCount = 0;

		// the actual vertex data buffer
		this.buffer = new ArrayBuffer(
			this.maxVertex * this.vertexSize * Float32Array.BYTES_PER_ELEMENT,
		);
		// Float32 and Uint32 view of the vertex data array buffer
		this.bufferF32 = new Float32Array(this.buffer);
		this.bufferU32 = new Uint32Array(this.buffer);
	}

	/**
	 * clear the vertex array buffer
	 * @ignore
	 */
	clear() {
		this.vertexCount = 0;
	}

	/**
	 * return true if full
	 * @ignore
	 */
	isFull(vertex) {
		return this.vertexCount + vertex >= this.maxVertex;
	}

	/**
	 * push a new vertex to the buffer
	 * @param {number} x - x position
	 * @param {number} y - y position
	 * @param {number} u - texture U coordinate
	 * @param {number} v - texture V coordinate
	 * @param {number} tint - tint color in UINT32 (argb) format
	 * @param {number} [textureId] - texture unit index for multi-texture batching
	 * @param {number} [normalTextureId] - paired normal-map texture unit index, or `-1` for unlit quads
	 * @ignore
	 */
	push(x, y, u, v, tint, textureId, normalTextureId) {
		const offset = this.vertexCount * this.vertexSize;

		this.bufferF32[offset] = x;
		this.bufferF32[offset + 1] = y;
		this.bufferF32[offset + 2] = u;
		this.bufferF32[offset + 3] = v;
		this.bufferU32[offset + 4] = tint;
		if (this.vertexSize > 5) {
			this.bufferF32[offset + 5] = textureId || 0;
			if (this.vertexSize > 6) {
				// `aNormalTextureId`: -1 (sentinel for unlit) is the safe
				// default when the caller doesn't supply one. Writing 0
				// here would let the fragment shader's lit path activate
				// on unlit quads with whatever normal-map happened to be
				// bound at unit 0 — visible as garbage hemispheric
				// shading on every sprite.
				this.bufferF32[offset + 6] =
					typeof normalTextureId === "number" ? normalTextureId : -1;
			}
		}

		this.vertexCount++;

		return this;
	}

	/**
	 * push a new vertex with all-float data to the buffer
	 * @param {ArrayLike<number>} data - float values for one vertex
	 * @param {number} srcOffset - start index in the source data
	 * @param {number} count - number of floats to copy (should equal vertexSize)
	 * @ignore
	 */
	pushFloats(data, srcOffset, count) {
		const offset = this.vertexCount * this.vertexSize;

		for (let i = 0; i < count; i++) {
			this.bufferF32[offset + i] = data[srcOffset + i];
		}

		this.vertexCount++;

		return this;
	}

	/**
	 * push a new vertex to the buffer (mesh format: x, y, z, u, v, tint)
	 * @ignore
	 */
	pushMesh(x, y, z, u, v, tint) {
		const offset = this.vertexCount * this.vertexSize;

		this.bufferF32[offset] = x;
		this.bufferF32[offset + 1] = y;
		this.bufferF32[offset + 2] = z;
		this.bufferF32[offset + 3] = u;
		this.bufferF32[offset + 4] = v;
		this.bufferU32[offset + 5] = tint;

		this.vertexCount++;

		return this;
	}

	/**
	 * return a reference to the data in Float32 format
	 * @ignore
	 */
	toFloat32(begin, end) {
		if (typeof end !== "undefined") {
			return this.bufferF32.subarray(begin, end);
		} else {
			return this.bufferF32;
		}
	}

	/**
	 * return a reference to the data in Uint32 format
	 * @ignore
	 */
	toUint32(begin, end) {
		if (typeof end !== "undefined") {
			return this.bufferU32.subarray(begin, end);
		} else {
			return this.bufferU32;
		}
	}
}
