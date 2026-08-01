/**
 * A uniform buffer bound to a named block in one or more shader programs.
 *
 * Uniform arrays are charged against `MAX_FRAGMENT_UNIFORM_VECTORS`, a
 * driver-reported budget that is small on weak devices. A uniform buffer is
 * charged against `MAX_UNIFORM_BLOCK_SIZE` instead — guaranteed at least
 * 16 KB, typically 64 KB — so bulk per-frame data stops competing with
 * everything else the shader declares.
 *
 * Data is staged in a `Float32Array` and uploaded with `bufferSubData`, so
 * only the live prefix crosses the bus. Uploads are skipped entirely when the
 * staged bytes have not changed, which preserves the property the uniform
 * cache gives today: a scene whose lights are static costs nothing per frame.
 *
 * ## Context loss
 *
 * A block binding is program state, not buffer state, and every program is
 * recompiled on restore — so the binding has to be re-established afterwards
 * or the shader reads an unbound block and renders black. Callers re-bind
 * lazily, whenever the program they last bound is no longer the current one;
 * that covers a context restore without anyone subscribing to an event. The
 * buffer itself needs no recovery hook — the renderer re-runs each batcher's
 * `init()` on restore, which releases this block and builds a new one.
 * @ignore
 */
export default class UniformBlock {
	/**
	 * @param {WebGL2RenderingContext} gl - the rendering context
	 * @param {number} floats - capacity in floats
	 * @param {number} bindingPoint - the indexed binding point to occupy
	 */
	constructor(gl, floats, bindingPoint) {
		this.gl = gl;

		/**
		 * staging buffer; callers write into this then call `upload`
		 * @type {Float32Array}
		 */
		this.data = new Float32Array(floats);

		/**
		 * mirror of what was last uploaded, so an unchanged frame can skip the
		 * `bufferSubData` entirely
		 * @type {Float32Array}
		 */
		this._uploaded = new Float32Array(floats);

		/** nothing has been uploaded yet, so the mirror is not yet valid */
		this._everUploaded = false;

		/** live length of the last upload; -1 until there has been one */
		this._uploadedLength = -1;

		/** @type {number} */
		this.bindingPoint = bindingPoint;

		/** @type {WebGLBuffer|null} */
		this.buffer = gl.createBuffer();

		gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
		gl.bufferData(gl.UNIFORM_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
		gl.bindBufferBase(gl.UNIFORM_BUFFER, bindingPoint, this.buffer);
		gl.bindBuffer(gl.UNIFORM_BUFFER, null);
	}

	/**
	 * Point a program's named block at this buffer's binding point.
	 *
	 * Safe to call repeatedly — after a context restore the program is a new
	 * object and must be re-bound, and there is no way to ask whether it
	 * already was.
	 * @param {WebGLProgram} program - the linked program
	 * @param {string} blockName - the block's name in GLSL
	 * @returns {boolean} `false` when the program does not declare the block
	 */
	bindTo(program, blockName) {
		const gl = this.gl;
		const index = gl.getUniformBlockIndex(program, blockName);
		if (index === gl.INVALID_INDEX) {
			// the shader compiled without the block — either it does not use
			// lighting, or the declaration was optimised out because nothing
			// read it. Not an error; the caller simply has nothing to feed.
			return false;
		}
		gl.uniformBlockBinding(program, index, this.bindingPoint);
		return true;
	}

	/**
	 * Upload the first `floats` entries of {@link UniformBlock#data}.
	 *
	 * Compares against the previous upload first and does nothing when the
	 * bytes are identical. Uniform writes are already skipped when unchanged
	 * (`utils/uniforms.js`), so uploading unconditionally here would make a
	 * static scene more expensive than it was before the buffer existed.
	 * @param {number} floats - how many floats of the staging buffer are live
	 * @returns {boolean} whether anything was actually sent to the GPU
	 */
	upload(floats) {
		if (this.buffer === null) {
			return false;
		}
		if (this._everUploaded === true && this.#matches(floats)) {
			return false;
		}

		const gl = this.gl;
		gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
		gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.data, 0, floats);
		gl.bindBuffer(gl.UNIFORM_BUFFER, null);

		this._uploaded.set(this.data.subarray(0, floats), 0);
		this._uploadedLength = floats;
		this._everUploaded = true;
		return true;
	}

	/**
	 * Whether the live prefix is byte-identical to what was last uploaded.
	 * @param {number} floats - length of the live prefix
	 * @returns {boolean} true when an upload would be a no-op
	 * @ignore
	 */
	#matches(floats) {
		if (this._uploadedLength !== floats) {
			return false;
		}
		for (let i = 0; i < floats; i++) {
			if (this._uploaded[i] !== this.data[i]) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Release the GL buffer. Safe to call twice, and on a lost context.
	 */
	destroy() {
		const gl = this.gl;
		if (this.buffer !== null) {
			// `isBuffer` is false for a handle from a context that has since
			// been lost, and deleting such a handle raises INVALID_OPERATION
			if (gl.isBuffer(this.buffer)) {
				gl.deleteBuffer(this.buffer);
			}
			this.buffer = null;
		}
		this._everUploaded = false;
		this._uploadedLength = -1;
	}
}
