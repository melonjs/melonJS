import {
	ONCONTEXT_LOST,
	ONCONTEXT_RESTORED,
	off,
	on,
} from "../../system/event.ts";
import { extractAttributes } from "./utils/attributes.js";
import { getMaxShaderPrecision, setPrecision } from "./utils/precision.js";
import { compileProgram } from "./utils/program.js";
import { minify } from "./utils/string.js";
import { extractUniforms } from "./utils/uniforms.js";

/**
 * a base GL Shader object
 * @category Rendering
 */
export default class GLShader {
	/**
	 * @param {WebGLRenderingContext} gl - the current WebGL rendering context
	 * @param {string} vertex - a string containing the GLSL source code to set
	 * @param {string} fragment - a string containing the GLSL source code to set
	 * @param {string} [precision=auto detected] - float precision ('lowp', 'mediump' or 'highp').
	 * @see https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/GLSL_Shaders
	 * @example
	 * // create a basic shader
	 * let myShader = new me.GLShader(
	 *    // WebGL rendering context
	 *    gl,
	 *    // vertex shader
	 *    [
	 *        "void main() {",
	 *        "    gl_Position = doMathToMakeClipspaceCoordinates;",
	 *        "}"
	 *    ].join("\n"),
	 *    // fragment shader
	 *    [
	 *        "void main() {",
	 *        "    gl_FragColor = doMathToMakeAColor;",
	 *        "}"
	 *    ].join("\n")
	 *  )
	 * // use the shader
	 * myShader.bind();
	 */
	constructor(gl, vertex, fragment, precision) {
		/**
		 * the active gl rendering context
		 * @type {WebGLRenderingContext}
		 */
		this.gl = gl;

		/**
		 * `true` once {@link destroy} has been called. After this flag is
		 * `true`, every method on the shader is a silent no-op — callers
		 * holding a stale reference (e.g. a still-registered update loop)
		 * do not crash the frame.
		 * @type {boolean}
		 * @readonly
		 */
		this.destroyed = false;

		/**
		 * `true` while the WebGL context is lost (and until it's
		 * restored). The GL program/attributes/uniforms are released
		 * during the suspended window but the shader source code is
		 * preserved so {@link _onContextRestored} can rebuild the
		 * program against the new context. User code generally doesn't
		 * read this — methods short-circuit internally — but it's
		 * available for diagnostic / debug-plugin tooling.
		 * @type {boolean}
		 * @readonly
		 */
		this.suspended = false;

		// Preserve the raw (un-precisified, un-minified) source so we
		// can rebuild against the new GL context if it's lost and
		// restored mid-game (NVIDIA Optimus laptops with dual GPU
		// switching, browser tab eviction recovery, etc.).
		this._sourceVertex = vertex;
		this._sourceFragment = fragment;
		this._precision = precision;

		// Cache every uniform value the caller writes via setUniform.
		// After a context-lost/restored cycle the new program has a
		// fresh uniforms map, and we replay the cached values against
		// it so the shader's visual state is preserved transparently —
		// user code does not have to re-apply uniforms after a GPU
		// switch.
		this._uniformCache = Object.create(null);

		// If user code constructs a new shader DURING the suspended
		// window (rare but plausible — e.g. an `event.once(
		// LEVEL_LOADED)` handler fires while a context loss is in
		// flight), `gl.compileShader` / `gl.linkProgram` are no-ops
		// and the link-status check would throw. Detect the lost
		// context up front and skip the compile; the
		// ONCONTEXT_RESTORED subscription below will trigger
		// `_compile()` once the new context is alive. Any `setUniform`
		// the caller writes in the meantime is cached and replayed at
		// that point.
		if (gl.isContextLost()) {
			this.suspended = true;
			this.program = null;
			this.uniforms = null;
			this.attributes = null;
		} else {
			this._compile();
		}

		on(ONCONTEXT_LOST, this._onContextLost, this);
		on(ONCONTEXT_RESTORED, this._onContextRestored, this);
	}

	/**
	 * (Re)compile the shader program against `this.gl` from the
	 * preserved source. Called from the constructor and from
	 * {@link _onContextRestored}. Replays any cached uniform values
	 * against the freshly-extracted uniforms proxy.
	 * @private
	 */
	_compile() {
		this.vertex = setPrecision(
			minify(this._sourceVertex),
			this._precision || getMaxShaderPrecision(this.gl),
		);
		this.fragment = setPrecision(
			minify(this._sourceFragment),
			this._precision || getMaxShaderPrecision(this.gl),
		);

		/**
		 * the location attributes of the shader
		 * @type {GLint[]}
		 */
		this.attributes = extractAttributes(this.gl, this);

		/**
		 * a reference to the shader program (once compiled)
		 * @type {WebGLProgram}
		 */
		this.program = compileProgram(
			this.gl,
			this.vertex,
			this.fragment,
			this.attributes,
		);

		/**
		 * the uniforms of the shader
		 * @type {object}
		 */
		this.uniforms = extractUniforms(this.gl, this);

		this.suspended = false;

		// Replay cached uniform values against the new program. Skip
		// any name that the new uniforms proxy doesn't accept (shader
		// signature changes shouldn't happen across a context restore
		// — same source — but the guard is cheap insurance).
		for (const name of Object.keys(this._uniformCache)) {
			if (typeof this.uniforms[name] !== "undefined") {
				this.bind();
				this.uniforms[name] = this._uniformCache[name];
			}
		}
	}

	/**
	 * Handler for {@link ONCONTEXT_LOST}. Tears down the GL program
	 * but preserves the shader source + cached uniform values so the
	 * shader can be transparently rebuilt on context restore.
	 * @private
	 */
	_onContextLost() {
		if (this.destroyed || this.suspended) {
			return;
		}
		this.suspended = true;
		this.uniforms = null;
		this.attributes = null;
		// The context is dead — deleteProgram against it would throw
		// on ANGLE/D3D11 (Windows). Wrap it; we only care that the JS
		// state ends in a known, safe shape.
		if (this.program !== null) {
			try {
				this.gl.deleteProgram(this.program);
			} catch {
				// context was killed underneath us — nothing to do
			}
			this.program = null;
		}
	}

	/**
	 * Handler for {@link ONCONTEXT_RESTORED}. Re-compiles and
	 * re-links the shader against the new GL context, then replays
	 * any cached uniform values via {@link _compile}.
	 * @private
	 */
	_onContextRestored() {
		if (this.destroyed) {
			// Explicit destroy beats automatic recovery; don't
			// resurrect a shader that the user has released.
			return;
		}
		this._compile();
	}

	/**
	 * Installs this shader program as part of current rendering state
	 */
	bind() {
		if (this.destroyed || this.suspended) {
			return;
		}
		this.gl.useProgram(this.program);
	}

	/**
	 * returns the location of an attribute variable in this shader program
	 * @param {string} name - the name of the attribute variable whose location to get.
	 * @returns {GLint} number indicating the location of the variable name if found. Returns -1 otherwise
	 */
	getAttribLocation(name) {
		if (this.destroyed || this.suspended) {
			return -1;
		}
		const attr = this.attributes[name];
		if (typeof attr !== "undefined") {
			return attr;
		} else {
			return -1;
		}
	}

	/**
	 * Set the uniform to the given value
	 * @param {string} name - the uniform name
	 * @param {object|Float32Array} value - the value to assign to that uniform
	 * @example
	 * myShader.setUniform("uProjectionMatrix", this.projectionMatrix);
	 */
	setUniform(name, value) {
		if (this.destroyed) {
			return;
		}
		// Cache every accepted write so context-restored replay works.
		// Snapshot every non-primitive container so a later in-place
		// mutation on the caller's side (e.g. a per-frame `Vector2d`
		// reused across uniforms, or a Float32Array reassigned in
		// place) doesn't silently poison the replay value used after a
		// GPU context restore. The same snapshot is what we hand to
		// GL — uniform setters copy into program state immediately, so
		// detaching it from the caller's reference costs one allocation
		// at write time and removes a whole class of replay-vs-live
		// divergence bugs.
		let cached;
		if (typeof value === "object" && value !== null) {
			if (typeof value.toArray === "function") {
				cached = value.toArray();
			} else if (Array.isArray(value) || ArrayBuffer.isView(value)) {
				cached = value.slice();
			} else {
				cached = value;
			}
		} else {
			cached = value;
		}
		if (this.suspended) {
			// Defer the write to context-restored replay. Still cache
			// it so the latest value wins on resume.
			this._uniformCache[name] = cached;
			return;
		}
		const uniforms = this.uniforms;
		if (typeof uniforms[name] !== "undefined") {
			this.bind();
			uniforms[name] = cached;
			this._uniformCache[name] = cached;
		} else {
			throw new Error("undefined (" + name + ") uniform for shader " + this);
		}
	}

	/**
	 * activate the given vertex attribute for this shader
	 * @param {WebGLRenderingContext} gl - the current WebGL rendering context
	 * @param {object[]} attributes - an array of vertex attributes
	 * @param {number} stride - the size of a single vertex in bytes
	 */
	setVertexAttributes(gl, attributes, stride) {
		for (let index = 0; index < attributes.length; ++index) {
			const element = attributes[index];
			const location = this.getAttribLocation(element.name);

			if (location !== -1) {
				gl.enableVertexAttribArray(location);
				gl.vertexAttribPointer(
					location,
					element.size,
					element.type,
					element.normalized,
					stride,
					element.offset,
				);
			}
		}
	}

	/**
	 * destroy this shader objects resources (program, attributes, uniforms).
	 * Idempotent — calling destroy twice (or after a context-lost suspend)
	 * is safe. Unsubscribes from the renderer's context lost / restored
	 * events so a destroyed shader is never automatically resurrected.
	 */
	destroy() {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;

		off(ONCONTEXT_LOST, this._onContextLost, this);
		off(ONCONTEXT_RESTORED, this._onContextRestored, this);

		this.uniforms = null;
		this.attributes = null;

		// gl.deleteProgram can throw on ANGLE/D3D11 (Windows) when
		// called against a program from a dead/foreign context — the
		// kind of crash that produced the original 19.5.0 user report.
		// The JS-side state nulling above has already happened, so the
		// shader is "destroyed" regardless of whether the GPU teardown
		// also completed.
		if (this.program !== null) {
			try {
				this.gl.deleteProgram(this.program);
			} catch {
				// context already invalid — JS state is clean, move on
			}
			this.program = null;
		}

		this.vertex = null;
		this.fragment = null;
		this._sourceVertex = null;
		this._sourceFragment = null;
		this._uniformCache = null;
	}
}
