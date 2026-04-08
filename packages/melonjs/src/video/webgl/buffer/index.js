/**
 * A WebGL Index Buffer object.
 * Can be used for static patterns (e.g. quad indices) or dynamic indexed drawing.
 * @ignore
 */

export default class IndexBuffer {
	/**
	 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - the WebGL context
	 * @param {number} maxIndices - maximum number of indices this buffer can hold
	 * @param {boolean} [useUint32=false] - use Uint32 indices (WebGL2) instead of Uint16 (WebGL1)
	 * @param {boolean} [dynamic=false] - if true, use STREAM_DRAW for frequent updates; if false, use STATIC_DRAW
	 */
	constructor(gl, maxIndices, useUint32 = false, dynamic = false) {
		this.gl = gl;
		this.dynamic = dynamic;

		if (useUint32) {
			this.type = gl.UNSIGNED_INT;
			this.data = new Uint32Array(maxIndices);
		} else {
			this.type = gl.UNSIGNED_SHORT;
			this.data = new Uint16Array(maxIndices);
		}

		/**
		 * the current number of indices in the buffer
		 * @type {number}
		 */
		this.length = 0;

		this.buffer = gl.createBuffer();
	}

	/**
	 * Fill the buffer with a repeating quad index pattern [0,1,2, 2,1,3, 4,5,6, ...]
	 * and upload as a static buffer.
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
		this.bind();
		this.gl.bufferData(
			this.gl.ELEMENT_ARRAY_BUFFER,
			this.data,
			this.gl.STATIC_DRAW,
		);
	}

	/**
	 * Reset the index count (for dynamic buffers)
	 */
	clear() {
		this.length = 0;
	}

	/**
	 * Add indices to the buffer, rebased by the given vertex offset
	 * @param {number[]} indices - source indices to add
	 * @param {number} vertexOffset - value to add to each index (vertex count at time of insertion)
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

	/**
	 * Upload the current index data to the GPU (for dynamic buffers)
	 */
	upload() {
		this.bind();
		this.gl.bufferData(
			this.gl.ELEMENT_ARRAY_BUFFER,
			this.data.subarray(0, this.length),
			this.gl.STREAM_DRAW,
		);
	}

	/**
	 * bind this index buffer
	 */
	bind() {
		this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffer);
	}
}
