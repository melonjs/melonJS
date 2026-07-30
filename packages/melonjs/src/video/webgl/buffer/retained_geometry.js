import WebGLVertexState from "./vertexstate.js";

/**
 * Persistent GPU geometry for one mesh — a vertex buffer, an index buffer
 * and the {@link WebGLVertexState} that binds them together, all uploaded
 * once and re-drawn from VRAM on subsequent frames.
 *
 * This is what makes the mesh path retained rather than immediate: the
 * geometry it holds is in model space and carries no camera, placement or
 * tint information, so moving, rotating, scaling or re-tinting a mesh
 * changes only uniforms and never touches these buffers. They are rewritten
 * only when the geometry itself changes, which the owning mesh signals by
 * bumping its geometry version.
 *
 * Uploads go through a `Uint8Array` view of the float data rather than the
 * `Float32Array` itself: some drivers canonicalize NaN bit patterns on a
 * float upload, which would corrupt packed values. See `VertexArrayBuffer`.
 * @ignore
 */
export default class RetainedGeometry {
	/**
	 * @param {WebGL2RenderingContext} gl - the WebGL context
	 * @param {object[]} attributes - the owning batcher's attribute definitions
	 * @param {number} stride - the owning batcher's vertex stride in bytes
	 * @param {Function} resolveLocation - maps an attribute name to its shader location
	 */
	constructor(gl, attributes, stride, resolveLocation) {
		this.gl = gl;
		this.attributes = attributes;
		this.stride = stride;
		this.resolveLocation = resolveLocation;

		/**
		 * the GL buffer holding the interleaved model-space vertex data
		 * @type {WebGLBuffer}
		 */
		this.vertexBuffer = gl.createBuffer();

		/**
		 * the GL buffer holding the index data, as authored
		 * @type {WebGLBuffer}
		 */
		this.glIndexBuffer = gl.createBuffer();

		/**
		 * `gl.UNSIGNED_SHORT` or `gl.UNSIGNED_INT`, matching the index array
		 * the mesh supplied — WebGL 2 draws 32-bit indices natively, so a
		 * mesh past 65 535 vertices is still a single draw call.
		 * @type {number}
		 */
		this.indexType = gl.UNSIGNED_SHORT;

		/**
		 * number of indices to draw
		 * @type {number}
		 */
		this.indexCount = 0;

		/**
		 * the mesh geometry version this upload reflects; a mismatch against
		 * the mesh means the buffers are stale and must be rewritten
		 * @type {number}
		 */
		this.uploadedVersion = -1;

		// `WebGLIndexBuffer`-shaped shim: the vertex state captures whatever
		// its descriptor's `indexBuffer.bind()` binds, and this geometry owns
		// a raw GL buffer rather than a full index-buffer wrapper (there is no
		// CPU-side accumulation to do — the data is uploaded once).
		const indexBinding = {
			bind: () => {
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.glIndexBuffer);
			},
		};

		/**
		 * the frozen vertex state binding this geometry's buffers
		 * @type {WebGLVertexState}
		 */
		this.vertexState = new WebGLVertexState(gl, {
			attributes,
			stride,
			buffer: this.vertexBuffer,
			indexBuffer: indexBinding,
			resolveLocation,
		});
	}

	/**
	 * Upload interleaved vertex data and indices, replacing whatever this
	 * geometry held before.
	 * @param {Float32Array} vertexData - interleaved vertex data in the batcher's layout
	 * @param {number} floatCount - how many floats of `vertexData` are in use
	 * @param {Uint16Array|Uint32Array|number[]} indices - the index data, as authored
	 * @param {number} version - the mesh geometry version this data reflects
	 */
	upload(vertexData, floatCount, indices, version) {
		const gl = this.gl;

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Uint8Array(
				vertexData.buffer,
				vertexData.byteOffset,
				floatCount * Float32Array.BYTES_PER_ELEMENT,
			),
			gl.STATIC_DRAW,
		);

		// keep 32-bit indices 32-bit: narrowing them would silently corrupt
		// any mesh with more than 65 535 vertices
		const wide =
			indices instanceof Uint32Array ||
			(!(indices instanceof Uint16Array) && vertexDataExceedsUint16(indices));
		const indexArray = wide
			? indices instanceof Uint32Array
				? indices
				: new Uint32Array(indices)
			: indices instanceof Uint16Array
				? indices
				: new Uint16Array(indices);
		this.indexType = wide ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
		this.indexCount = indexArray.length;

		// bind through the vertex state so the ELEMENT_ARRAY_BUFFER binding
		// is captured by it rather than leaking into whatever is current
		this.vertexState.captureIndexBuffer(undefined, () => {
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
		});

		this.uploadedVersion = version;
	}

	/**
	 * Make this geometry current for drawing.
	 */
	bind() {
		this.vertexState.bind();
	}

	/**
	 * Release every GL object this geometry owns. Safe to call twice, and on
	 * a lost context.
	 */
	destroy() {
		const gl = this.gl;
		if (this.vertexState !== null) {
			this.vertexState.destroy();
			this.vertexState = null;
		}
		if (this.vertexBuffer !== null) {
			gl.deleteBuffer(this.vertexBuffer);
			this.vertexBuffer = null;
		}
		if (this.glIndexBuffer !== null) {
			gl.deleteBuffer(this.glIndexBuffer);
			this.glIndexBuffer = null;
		}
		this.indexCount = 0;
		this.uploadedVersion = -1;
	}
}

/**
 * Whether a plain index array needs 32-bit indices.
 * @ignore
 */
function vertexDataExceedsUint16(indices) {
	for (let i = 0; i < indices.length; i++) {
		if (indices[i] > 0xffff) {
			return true;
		}
	}
	return false;
}
