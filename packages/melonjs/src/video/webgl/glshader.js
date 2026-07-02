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
import { captureValue, extractUniforms } from "./utils/uniforms.js";

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
		 * When `true`, a renderable will NOT auto-destroy this shader when it is
		 * removed from its `postEffects` (via the `shader` setter,
		 * `removePostEffect`, `clearPostEffects`) or when the renderable itself
		 * is destroyed. Set this on a shader shared across several renderables so
		 * one of them going away doesn't free the GL program still used by the
		 * others — you then own its lifecycle and call {@link destroy} yourself.
		 * @type {boolean}
		 * @default false
		 */
		this.shared = false;

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

		// raw source kept so we can recompile against a restored context
		this._sourceVertex = vertex;
		this._sourceFragment = fragment;
		this._precision = precision;

		// uniform writes are cached + replayed across a context cycle
		this._uniformCache = Object.create(null);

		// defer compile if constructed mid-suspended-window; replay handles it
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

		// replay cached uniforms against the new program
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
		// deleteProgram against a dead ANGLE context throws — swallow it
		if (this.program !== null) {
			try {
				this.gl.deleteProgram(this.program);
			} catch {
				/* context already gone */
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
			// destroyed shaders are not resurrected
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
		// cache via captureValue (slot reuse, mutation-detached); pass
		// caller's value to GL (uniform setters copy synchronously)
		let cached;
		let glValue;
		if (typeof value === "object" && value !== null) {
			if (typeof value.toArray === "function") {
				const arr = value.toArray();
				cached = captureValue(this._uniformCache[name], arr);
				glValue = arr;
			} else if (Array.isArray(value) || ArrayBuffer.isView(value)) {
				cached = captureValue(this._uniformCache[name], value);
				glValue = value;
			} else {
				cached = value;
				glValue = value;
			}
		} else {
			cached = value;
			glValue = value;
		}
		this._uniformCache[name] = cached;

		if (this.suspended) {
			// deferred: replay handles the live write on restore
			return;
		}

		const uniforms = this.uniforms;
		if (typeof uniforms[name] !== "undefined") {
			this.bind();
			uniforms[name] = glValue;
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
	 * Create an independent copy of this shader, compiled as its own GL
	 * program from the same vertex + fragment sources (and precision), with
	 * every uniform value set so far replayed onto the copy. Use it when
	 * several renderables need the same custom shader with *different*
	 * uniform values — a single instance has a single set of uniforms.
	 *
	 * Ownership and lifecycle state do NOT carry over: the clone's
	 * {@link shared} flag is **always reset to `false`**, even when cloning
	 * a shared shader — the clone is caller-owned and will be auto-destroyed
	 * by the renderable it is assigned to, unless you explicitly set
	 * `shared = true` on it yourself. Note that `ShaderEffect` (which wraps
	 * a GLShader by composition) has its own `clone()` with the same
	 * semantics, which additionally copies its effect-level state (extra
	 * `setTexture` bindings).
	 * @returns {GLShader} a new, caller-owned shader (`shared === false`)
	 */
	clone() {
		if (this.destroyed) {
			throw new Error("GLShader.clone: shader has been destroyed");
		}
		const copy = new GLShader(
			this.gl,
			this._sourceVertex,
			this._sourceFragment,
			this._precision,
		);
		// replay this shader's cached uniform values onto the clone (the same
		// snapshot store the context-loss recovery replays from). When the
		// clone is constructed mid-context-loss its program compiles deferred
		// (`uniforms` is null) — the suspended setUniform caches values for
		// the restore replay. When live, validate against the clone's active
		// uniforms (same guard the restore replay uses) so a name cached
		// during an earlier suspended window can't make setUniform throw.
		for (const name of Object.keys(this._uniformCache)) {
			if (copy.suspended || typeof copy.uniforms[name] !== "undefined") {
				copy.setUniform(name, this._uniformCache[name]);
			}
		}
		return copy;
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

		// deleteProgram can throw on ANGLE/D3D11 — the 19.5.0 crash
		if (this.program !== null) {
			try {
				this.gl.deleteProgram(this.program);
			} catch {
				/* context already gone */
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
