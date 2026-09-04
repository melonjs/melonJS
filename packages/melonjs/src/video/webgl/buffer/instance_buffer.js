/**
 * The GPU half of an {@link InstancedMesh}'s instance records — one
 * `ARRAY_BUFFER` holding the packed per-instance transforms (and the opt-in
 * colour / custom slots), uploaded with `bufferSubData` over only the range
 * the CPU side actually touched.
 *
 * This is the instancing counterpart of {@link RetainedGeometry}: the mesh's
 * geometry is uploaded once and never rewritten, and this buffer carries
 * everything that differs between the copies. Moving one tree in a forest of
 * five thousand therefore re-uploads 48 bytes, not the geometry and not the
 * other 4 999 records.
 *
 * The buffer is sized to the mesh's capacity rather than its live instance
 * count, so growing by one instance does not reallocate on the GPU until the
 * CPU-side array itself grows.
 * @ignore
 * @internal
 */
export default class WebGLInstanceBuffer {
	/**
	 * @param {WebGL2RenderingContext} gl - the WebGL context
	 */
	constructor(gl) {
		this.gl = gl;

		/**
		 * the GL buffer holding the packed instance records
		 * @type {WebGLBuffer}
		 */
		this.buffer = gl.createBuffer();

		/**
		 * byte capacity currently allocated on the GPU; a CPU-side array
		 * larger than this forces a full reallocation rather than a sub-update
		 * @type {number}
		 */
		this.capacity = 0;
	}

	/**
	 * Push the dirty span of `data` to the GPU.
	 *
	 * Three cases, cheapest last: the CPU array outgrew the allocation (full
	 * `bufferData`), nothing is dirty (no call at all), or a span changed
	 * (one `bufferSubData` covering exactly it).
	 * @param {Float32Array} data - the CPU-side instance records
	 * @param {number} firstFloat - first dirty float offset (inclusive)
	 * @param {number} floatCount - number of dirty floats, 0 when clean
	 * @param {number} usedBytes - bytes of `data` actually in use
	 */
	upload(data, firstFloat, floatCount, usedBytes) {
		const gl = this.gl;
		if (floatCount === 0 && usedBytes <= this.capacity) {
			// nothing to do — and no reason to perturb the ARRAY_BUFFER binding
			return;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

		if (usedBytes > this.capacity) {
			// (re)allocate to the CPU array's full length, so subsequent
			// growth up to that capacity is a sub-update rather than a realloc
			gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
			this.capacity = data.byteLength;
			return;
		}

		if (floatCount === 0) {
			return;
		}

		// upload through a Uint8Array view for the same reason the retained
		// geometry does: some drivers canonicalize NaN bit patterns on a
		// float upload, which would corrupt packed values
		const byteOffset = firstFloat * Float32Array.BYTES_PER_ELEMENT;
		const byteLength = floatCount * Float32Array.BYTES_PER_ELEMENT;
		gl.bufferSubData(
			gl.ARRAY_BUFFER,
			byteOffset,
			new Uint8Array(data.buffer, data.byteOffset + byteOffset, byteLength),
		);
	}

	/**
	 * Release the GL buffer. Safe to call twice, and on a lost context — the
	 * `isBuffer` probe is itself error-free, whereas deleting a handle whose
	 * context died raises INVALID_OPERATION.
	 */
	destroy() {
		const gl = this.gl;
		if (this.buffer !== null) {
			if (gl.isBuffer(this.buffer)) {
				gl.deleteBuffer(this.buffer);
			}
			this.buffer = null;
		}
		this.capacity = 0;
	}
}
