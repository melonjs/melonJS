import IndexBuffer from "../../buffer/index.js";

/**
 * A WebGL Index Buffer — extends {@link IndexBuffer} with GL buffer binding and upload.
 * @ignore
 */

export default class WebGLIndexBuffer extends IndexBuffer {
	/**
	 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - the WebGL context
	 * @param {number} maxIndices - maximum number of indices this buffer can hold
	 * @param {boolean} [useUint32=false] - use Uint32 indices (WebGL2) instead of Uint16 (WebGL1)
	 * @param {boolean} [dynamic=false] - if true, use STREAM_DRAW for frequent updates; if false, use STATIC_DRAW
	 */
	constructor(gl, maxIndices, useUint32 = false, dynamic = false) {
		super(maxIndices, useUint32);
		this.gl = gl;
		this.dynamic = dynamic;
		this.type = useUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
		this.buffer = gl.createBuffer();
	}

	/**
	 * Fill the buffer with a repeating quad index pattern and upload as static.
	 * @param {number} maxQuads - number of quads to generate indices for
	 */
	fillQuadPattern(maxQuads) {
		super.fillQuadPattern(maxQuads);
		this.bind();
		this.gl.bufferData(
			this.gl.ELEMENT_ARRAY_BUFFER,
			this.data,
			this.gl.STATIC_DRAW,
		);
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
	 * Bind this index buffer
	 */
	bind() {
		this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffer);
	}
}
