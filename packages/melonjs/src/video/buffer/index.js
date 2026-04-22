/**
 * A renderer-agnostic index buffer.
 * Manages a typed array of vertex indices for indexed drawing.
 * {@link WebGLIndexBuffer} extends this with GL-specific bind/upload operations.
 * @ignore
 */

export default class IndexBuffer {
	/**
	 * @param {number} maxIndices - maximum number of indices this buffer can hold
	 * @param {boolean} [useUint32=false] - use Uint32 indices instead of Uint16
	 */
	constructor(maxIndices, useUint32 = false) {
		this.data = useUint32
			? new Uint32Array(maxIndices)
			: new Uint16Array(maxIndices);

		/**
		 * the current number of indices in the buffer
		 * @type {number}
		 */
		this.length = 0;
	}

	/**
	 * Fill the buffer with a repeating quad index pattern [0,1,2, 2,1,3, 4,5,6, ...]
	 * @param {number} maxQuads - number of quads to generate indices for
	 */
	fillQuadPattern(maxQuads) {
		for (let i = 0, vertex = 0; i < maxQuads * 6; i += 6, vertex += 4) {
			this.data[i] = vertex;
			this.data[i + 1] = vertex + 1;
			this.data[i + 2] = vertex + 2;
			this.data[i + 3] = vertex + 2;
			this.data[i + 4] = vertex + 1;
			this.data[i + 5] = vertex + 3;
		}
		this.length = maxQuads * 6;
	}

	/**
	 * Reset the index count
	 */
	clear() {
		this.length = 0;
	}

	/**
	 * Add indices to the buffer, rebased by the given vertex offset
	 * @param {number[]} indices - source indices to add
	 * @param {number} vertexOffset - value to add to each index
	 */
	add(indices, vertexOffset) {
		for (let i = 0; i < indices.length; i++) {
			this.data[this.length + i] = indices[i] + vertexOffset;
		}
		this.length += indices.length;
	}

	/**
	 * Add pre-computed absolute indices to the buffer (no rebasing)
	 * @param {number[]} indices - absolute index values to add
	 */
	addRaw(indices) {
		for (let i = 0; i < indices.length; i++) {
			this.data[this.length + i] = indices[i];
		}
		this.length += indices.length;
	}
}
