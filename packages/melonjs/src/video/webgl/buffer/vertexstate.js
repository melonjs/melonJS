/**
 * Normalize a descriptor into the list-of-buffer-layouts form.
 *
 * The single-buffer shape (`attributes` + `stride` + `buffer`) is the
 * original one and remains the common case, so it is accepted verbatim and
 * widened here into a one-entry list rather than pushed onto every caller.
 * A descriptor that declares `buffers` is used as-is.
 * @param {object} descriptor - the descriptor to read
 * @returns {object[]} buffer layout groups
 * @ignore
 * @internal
 */
function bufferGroups(descriptor) {
	if (Array.isArray(descriptor.buffers)) {
		return descriptor.buffers;
	}
	return [
		{
			buffer: descriptor.buffer,
			stride: descriptor.stride,
			stepMode: "vertex",
			attributes: descriptor.attributes,
		},
	];
}

/**
 * A WebGL Vertex State — a Vertex Array Object owning a frozen vertex
 * buffer layout: one `vertexAttribPointer` / `enableVertexAttribArray` per
 * attribute against a given vertex buffer, plus the ELEMENT_ARRAY_BUFFER
 * binding when the geometry is indexed.
 *
 * This is the engine's `GPUVertexState` analogue, and the layout it is built
 * from is a `GPUVertexBufferLayout[]`: a list of buffer groups, each with its
 * own buffer, `arrayStride` and `stepMode`. Attributes in a `"vertex"` group
 * advance once per vertex (the ordinary case); attributes in an
 * `"instance"` group advance once per *instance*, which is what
 * `drawElementsInstanced` reads to stamp out N copies of one geometry.
 * The layout is immutable once built, exactly like a vertex layout baked
 * into a render pipeline.
 *
 * Attribute divisors are vertex-array state, so a fresh VAO starts with every
 * divisor at 0 and `build()` creates one each time — an instanced layout can
 * therefore never leak its divisors into an unrelated vertex state, and the
 * single-buffer path issues no `vertexAttribDivisor` calls at all.
 *
 * Every method that mutates GL binding state saves and restores the live
 * bindings itself, so building or rebuilding one vertex state can never
 * disturb whichever one is mid-frame. Callers never touch
 * `bindVertexArray` directly.
 * @ignore
 * @internal
 */
export default class WebGLVertexState {
	/**
	 * Accepts either shape — the single-buffer one (`attributes` + `stride` +
	 * `buffer`) or a list of buffer groups (`buffers`). They are equivalent;
	 * the former is the latter with one `"vertex"` group.
	 * @param {WebGL2RenderingContext} gl - the WebGL context
	 * @param {object} descriptor - the vertex layout to realize
	 * @param {object[]} [descriptor.attributes] - attribute definitions (`name`, `size`, `type`, `normalized`, `offset`)
	 * @param {number} [descriptor.stride] - size of a single vertex in bytes (`arrayStride`)
	 * @param {WebGLBuffer} [descriptor.buffer] - the vertex buffer the attribute pointers read from
	 * @param {object[]} [descriptor.buffers] - buffer groups, each `{buffer, stride, attributes, stepMode}` where `stepMode` is `"vertex"` (default) or `"instance"`
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
	 * @internal
	 */
	#captureBindings() {
		const gl = this.gl;
		return {
			vertexArray: gl.getParameter(gl.VERTEX_ARRAY_BINDING),
			arrayBuffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING),
		};
	}

	/**
	 * @ignore
	 * @internal
	 */
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
	 * @param {object} [changes] - descriptor fields to replace first (e.g. recreated `buffer` / `buffers` / `indexBuffer`)
	 */
	build(changes) {
		const gl = this.gl;
		if (changes !== undefined) {
			// the two descriptor shapes are alternatives, not a union: leaving
			// a stale `buffers` in place while `buffer` is replaced would keep
			// drawing from the old buffer, silently
			if (changes.buffers !== undefined) {
				this.descriptor.buffer = undefined;
				this.descriptor.attributes = undefined;
				this.descriptor.stride = undefined;
			} else if (changes.buffer !== undefined) {
				this.descriptor.buffers = undefined;
			}
			Object.assign(this.descriptor, changes);
		}
		const { indexBuffer, resolveLocation } = this.descriptor;

		const saved = this.#captureBindings();
		const replaced = this.handle;
		this.release();

		this.handle = gl.createVertexArray();
		gl.bindVertexArray(this.handle);

		for (const group of bufferGroups(this.descriptor)) {
			// ARRAY_BUFFER is NOT vertex-array state, but each pointer record
			// captures whichever buffer is bound at the time it is issued —
			// which is exactly how one vertex array reads several buffers
			gl.bindBuffer(gl.ARRAY_BUFFER, group.buffer);
			const perInstance = group.stepMode === "instance";
			for (const attr of group.attributes) {
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
					group.stride,
					attr.offset,
				);
				if (perInstance) {
					// advance once per instance rather than per vertex. Only
					// issued for instance groups: a fresh vertex array already
					// has every divisor at 0, so the ordinary path stays free
					// of these calls entirely.
					gl.vertexAttribDivisor(location, 1);
				}
			}
		}

		if (indexBuffer) {
			indexBuffer.bind();
		}

		if (saved.vertexArray === replaced && replaced !== null) {
			// this state was the bound one when it was asked to rebuild, and
			// `release()` has since deleted that name. Re-binding a deleted
			// vertex array raises INVALID_OPERATION and leaves nothing bound,
			// so hand back the replacement instead — the caller asked for a
			// rebuild, not for its vertex array to go away.
			saved.vertexArray = this.handle;
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
