/**
 * a static Index Buffer object for quad rendering.
 * Pre-computes the repeating [0,1,2, 2,1,3] pattern once
 * and uploads it to the GPU as a STATIC_DRAW buffer.
 * @ignore
 */

export default class IndexBuffer {
	/**
	 * @param {WebGL2RenderingContext} gl - the WebGL context
	 * @param {number} maxQuads - maximum number of quads this buffer can index
	 * @param {boolean} [useUint32=false] - use Uint32 indices (WebGL2) instead of Uint16 (WebGL1)
	 */
	constructor(gl, maxQuads, useUint32 = false) {
		this.gl = gl;

		if (useUint32) {
			this.type = gl.UNSIGNED_INT;
			this.data = new Uint32Array(maxQuads * 6);
		} else {
			this.type = gl.UNSIGNED_SHORT;
			this.data = new Uint16Array(maxQuads * 6);
		}

		// fill the index pattern: [0,1,2, 2,1,3, 4,5,6, 6,5,7, ...]
		for (let i = 0, vertex = 0; i < this.data.length; i += 6, vertex += 4) {
			this.data[i] = vertex;
			this.data[i + 1] = vertex + 1;
			this.data[i + 2] = vertex + 2;
			this.data[i + 3] = vertex + 2;
			this.data[i + 4] = vertex + 1;
			this.data[i + 5] = vertex + 3;
		}

		this.buffer = gl.createBuffer();
		this.bind();
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.data, gl.STATIC_DRAW);
	}

	/**
	 * bind this index buffer
	 * @ignore
	 */
	bind() {
		this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffer);
	}
}
