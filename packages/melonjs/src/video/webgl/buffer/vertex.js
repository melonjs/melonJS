/**
 * a fixed-size Vertex Buffer object.
 * Compositors must check isFull() and flush before the buffer overflows.
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
	 * @ignore
	 */
	push(x, y, u, v, tint) {
		let offset = this.vertexCount * this.vertexSize;

		this.bufferF32[offset] = x;
		this.bufferF32[++offset] = y;
		this.bufferF32[++offset] = u;
		this.bufferF32[++offset] = v;
		this.bufferU32[++offset] = tint;

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
