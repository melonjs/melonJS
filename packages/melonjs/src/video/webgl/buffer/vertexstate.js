/**
 * A WebGL Vertex State — a Vertex Array Object owning a frozen vertex
 * buffer layout: one `vertexAttribPointer` / `enableVertexAttribArray` per
 * attribute against a given vertex buffer, plus the ELEMENT_ARRAY_BUFFER
 * binding when the geometry is indexed.
 *
 * This is the engine's `GPUVertexState` analogue. The layout it is built
 * from (the `attributes` + `stride` pair — a `GPUVertexBufferLayout` and
 * its `arrayStride`) is immutable once built, exactly like a vertex layout
 * baked into a render pipeline. A future WebGPU backend replaces this
 * class wholesale without its callers changing.
 *
 * Every method that mutates GL binding state saves and restores the live
 * bindings itself, so building or rebuilding one vertex state can never
 * disturb whichever one is mid-frame. Callers never touch
 * `bindVertexArray` directly.
 * @ignore
 */
export default class WebGLVertexState {
	/**
	 * @param {WebGL2RenderingContext} gl - the WebGL context
	 * @param {object} descriptor - the vertex layout to realize
	 * @param {object[]} descriptor.attributes - attribute definitions (`name`, `size`, `type`, `normalized`, `offset`)
	 * @param {number} descriptor.stride - size of a single vertex in bytes (`arrayStride`)
	 * @param {WebGLBuffer} descriptor.buffer - the vertex buffer the attribute pointers read from
	 * @param {Function} descriptor.resolveLocation - maps an attribute name to its shader location (`-1` when absent)
	 * @param {WebGLIndexBuffer} [descriptor.indexBuffer] - index buffer to capture, for indexed geometry
	 */
	constructor(gl, descriptor) {
		this.gl = gl;
		this.descriptor = descriptor;
		/**
		 * the underlying GL vertex array object
		 * @type {WebGLVertexArrayObject}
		 */
		this.handle = null;
		this.build();
	}

	/**
	 * Snapshot the live vertex-array / array-buffer bindings. Pure GL
	 * bookkeeping — a WebGPU backend builds immutable descriptors and has
	 * no global binding points to disturb.
	 * @ignore
	 */
	#captureBindings() {
		const gl = this.gl;
		return {
			vertexArray: gl.getParameter(gl.VERTEX_ARRAY_BINDING),
			arrayBuffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING),
		};
	}

	/** @ignore */
	#restoreBindings(saved) {
		const gl = this.gl;
		gl.bindVertexArray(saved.vertexArray);
		gl.bindBuffer(gl.ARRAY_BUFFER, saved.arrayBuffer);
	}

	/**
	 * (Re)build the vertex array object from this state's descriptor,
	 * replacing any previous one. Called on construction and from every
	 * buffer-recreation path — a vertex state referencing a deleted buffer
	 * keeps it alive per the GL spec and draws stale data.
	 * @param {object} [changes] - descriptor fields to replace first (e.g. recreated `buffer` / `indexBuffer`)
	 */
	build(changes) {
		const gl = this.gl;
		if (changes !== undefined) {
			Object.assign(this.descriptor, changes);
		}
		const { attributes, stride, buffer, indexBuffer, resolveLocation } =
			this.descriptor;

		const saved = this.#captureBindings();
		this.release();

		this.handle = gl.createVertexArray();
		gl.bindVertexArray(this.handle);

		// ARRAY_BUFFER is NOT vertex-array state, but each pointer record
		// captures whichever buffer is bound at the time it is issued
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		for (const attr of attributes) {
			const location = resolveLocation(attr.name);
			if (location === -1) {
				// on a lost context every location is -1 (the shader never
				// compiled); that is expected and rebuilt on restore
				if (!gl.isContextLost()) {
					console.warn(
						`melonJS: vertex attribute "${attr.name}" not found in the shader — skipped in the vertex state`,
					);
				}
				continue;
			}
			gl.enableVertexAttribArray(location);
			gl.vertexAttribPointer(
				location,
				attr.size,
				attr.type,
				attr.normalized,
				stride,
				attr.offset,
			);
		}

		if (indexBuffer) {
			indexBuffer.bind();
		}

		this.#restoreBindings(saved);
	}

	/**
	 * Capture an ELEMENT_ARRAY_BUFFER binding into this vertex state.
	 * Used when an index buffer is (re)created after the state was built —
	 * the quad batchers' static pattern buffer — since that binding is
	 * vertex-array state and would otherwise land in whichever state
	 * happens to be bound.
	 * @param {WebGLIndexBuffer} indexBuffer - the index buffer to capture
	 * @param {Function} [fill] - optional work to run with this state bound (buffer creation/upload)
	 */
	captureIndexBuffer(indexBuffer, fill) {
		const gl = this.gl;
		const saved = this.#captureBindings();
		gl.bindVertexArray(this.handle);
		if (typeof fill === "function") {
			fill();
		}
		this.descriptor.indexBuffer = indexBuffer ?? this.descriptor.indexBuffer;
		this.descriptor.indexBuffer?.bind();
		this.#restoreBindings(saved);
	}

	/**
	 * Make this vertex state current. One call restores the entire frozen
	 * layout — the WebGL analogue of `setPipeline` + `setVertexBuffer` +
	 * `setIndexBuffer`.
	 */
	bind() {
		this.gl.bindVertexArray(this.handle);
	}

	/**
	 * Delete the underlying vertex array object, if any. Idempotent, and
	 * safe on a lost context: deleting an object belonging to a lost
	 * context would queue `INVALID_OPERATION` (deletion counts as *using*
	 * it — only the `is*` queries are exempt), so probe first.
	 */
	release() {
		if (this.handle !== null) {
			if (this.gl.isVertexArray(this.handle)) {
				this.gl.deleteVertexArray(this.handle);
			}
			this.handle = null;
		}
	}

	/**
	 * Release the vertex array object. The vertex state must not be used
	 * after calling destroy.
	 */
	destroy() {
		this.release();
		this.descriptor = null;
	}
}
