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
 * a complete custom shader program. Historically a WebGL-only GLSL
 * program (the class keeps its name for compatibility), since 20.0 it can
 * carry one realization per GPU backend — a `{vertex, fragment}` GLSL
 * pair for the WebGL renderer and/or a complete `wgsl` module for the
 * WebGPU renderer — mirroring how {@link ShaderEffect} carries one body
 * per shading language. The {@link GLShader#isWebGL} / {@link GLShader#isWebGPU}
 * flags report which realizations exist; a renderer hosts the one it
 * speaks and anything else degrades to the built-in shading (never fatal).
 *
 * ### The WGSL module contract (custom `Mesh` shaders)
 *
 * The `wgsl` source is a complete module hosted by the mesh batchers:
 * entry points must be named **`vertex_main`** (`@vertex`) and
 * **`fragment_main`** (`@fragment`), over the frozen mesh vertex layout —
 * `@location(0) aVertex : vec3f`, `@location(1) aRegion : vec2f`,
 * `@location(2) aColor : vec4f`, plus `@location(3) aNormal : vec3f` on
 * the 48-byte `lit` layout. Bind groups (declare only what is read):
 * group 0 `FrameUniforms {projection : mat4x4<f32>, lineWidth : f32}`,
 * group 1 the mesh texture + sampler, group 2 the `Light3dBlock` (lit
 * host only), group 3 `MeshUniforms {model, view : mat4x4<f32>,
 * tint, params, emissive : vec4f}` (`params.x` = alpha cutout). The
 * vertex stage owns the projection (`projection * view * model`) and must
 * remap the GL-convention clip z: `(clip.z + clip.w) * 0.5`. WGSL
 * validation is asynchronous and never throws — a failing module logs its
 * errors once and the mesh falls back to the built-in shading.
 * @category Rendering
 */
export default class GLShader {
	/**
	 * @param {WebGLRenderingContext} [gl] - the current WebGL rendering
	 * context (`renderer.gl` — undefined on non-WebGL renderers, which
	 * simply skips the GLSL realization)
	 * @param {string|object} vertex - a string containing the GLSL vertex
	 * source, OR a sources object `{vertex, fragment, wgsl, precision,
	 * label}` carrying one realization per backend (any omittable)
	 * @param {string} [fragment] - a string containing the GLSL fragment source
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
	 * @example
	 * // a dual-backend custom mesh shader: the same object hosts on
	 * // whichever GPU renderer is active (gl is undefined on WebGPU)
	 * myMesh.addPostEffect(new me.GLShader(app.renderer.gl, {
	 *     vertex: toonVertexGLSL,
	 *     fragment: toonFragmentGLSL,
	 *     wgsl: toonModuleWGSL,
	 * }));
	 */
	constructor(gl, vertex, fragment, precision) {
		// object sources form: {vertex, fragment, wgsl, precision, label}
		let wgsl;
		let label;
		if (typeof vertex === "object" && vertex !== null) {
			const sources = vertex;
			vertex = sources.vertex;
			fragment = sources.fragment;
			precision = sources.precision ?? precision;
			wgsl = sources.wgsl;
			label = sources.label;
		}

		/**
		 * the active gl rendering context
		 * @type {WebGLRenderingContext}
		 */
		this.gl = gl;

		/**
		 * `true` when this shader carries a WebGL realization: a
		 * `{vertex, fragment}` GLSL pair compiled against a live context.
		 * @type {boolean}
		 * @readonly
		 */
		this.isWebGL =
			gl != null && typeof vertex === "string" && typeof fragment === "string";

		/**
		 * `true` when this shader carries a WebGPU realization: a complete
		 * `wgsl` module (see the class docs for the module contract).
		 * @type {boolean}
		 * @readonly
		 */
		this.isWebGPU = typeof wgsl === "string";

		/**
		 * the complete WGSL module source, when {@link GLShader#isWebGPU}
		 * @type {string|undefined}
		 */
		this.wgsl = wgsl;

		/**
		 * optional debug label, carried onto the GPU shader module (shows
		 * up in browser GPU error messages and profilers)
		 * @type {string|undefined}
		 */
		this.label = label;

		// flipped false when asynchronous WGSL validation reports errors —
		// the mesh batchers then fall back to their built-in shading
		this.wgslValid = true;

		// per-host WGSL family registrations for the current device
		// generation: {epoch, keys: Map<host key, family key>} — compared
		// against the pipeline cache's epoch so a device loss re-registers
		/**
		 * @ignore
		 * @internal
		 */
		this._wgslRegistrations = { epoch: -1, keys: new Map() };

		if (!this.isWebGL && !this.isWebGPU) {
			// no realization at all (e.g. a GLSL-only asset loaded under a
			// non-WebGL renderer): warn and stay inert — assigning the
			// shader is harmless, hosts skip it and keep built-in shading
			console.warn(
				"GLShader: no usable realization — provide {vertex, fragment} GLSL sources with a WebGL context, and/or a complete `wgsl` module for the WebGPU renderer",
			);
		}

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
		/**
		 * @ignore
		 * @internal
		 */
		this._sourceVertex = vertex;
		/**
		 * @ignore
		 * @internal
		 */
		this._sourceFragment = fragment;
		/**
		 * @ignore
		 * @internal
		 */
		this._precision = precision;

		// uniform writes are cached + replayed across a context cycle
		/**
		 * @ignore
		 * @internal
		 */
		this._uniformCache = Object.create(null);

		if (this.isWebGL) {
			// defer compile if constructed mid-suspended-window; replay handles it
			if (gl.isContextLost()) {
				this.suspended = true;
				this.program = null;
				this.uniforms = null;
				this.attributes = null;
			} else {
				this._compile();
			}

			// context lifecycle only concerns the GL program — a WGSL-only
			// shader has nothing to tear down or rebuild
			on(ONCONTEXT_LOST, this._onContextLost, this);
			on(ONCONTEXT_RESTORED, this._onContextRestored, this);
		} else {
			this.program = null;
			this.uniforms = null;
			this.attributes = null;
		}
	}

	/**
	 * (Re)compile the shader program against `this.gl` from the
	 * preserved source. Called from the constructor and from
	 * {@link _onContextRestored}. Replays any cached uniform values
	 * against the freshly-extracted uniforms proxy.
	 * @private
	 * @ignore
	 * @internal
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
	 * @ignore
	 * @internal
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
	 * @ignore
	 * @internal
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
		// program === null also covers shaders with no WebGL realization
		if (this.destroyed || this.suspended || this.program === null) {
			return;
		}
		this.gl.useProgram(this.program);
		// Record it on the CONTEXT, which is the only object this class and
		// the renderer both hold: `GLShader` is constructed with a bare `gl`
		// (public API — `new GLShader(app.renderer.gl, …)`) and has no way to
		// reach the renderer's program cache. Without this, writing a uniform
		// binds this program behind that cache's back, and the next batcher
		// flush skips its own rebind as redundant and draws the pending batch
		// through THIS program instead.
		this.gl.__meCurrentProgram = this.program;
	}

	/**
	 * returns the location of an attribute variable in this shader program
	 * @param {string} name - the name of the attribute variable whose location to get.
	 * @returns {GLint} number indicating the location of the variable name if found. Returns -1 otherwise
	 */
	getAttribLocation(name) {
		// attributes === null also covers shaders with no WebGL realization
		// — the same silent-no-op contract as bind()/setUniform()
		if (this.destroyed || this.suspended || this.attributes === null) {
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

		if (this.suspended || this.uniforms === null) {
			// deferred: the restore replay handles the live write. A shader
			// with no WebGL realization only caches — its WGSL side has no
			// custom uniforms to receive the value (see the module contract)
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
	 * activate the given vertex attribute for this shader.
	 *
	 * Note: since 20.0 the engine no longer calls this per frame — each
	 * {@link WebGLBatcher} captures its attribute layout once into an immutable
	 * vertex-state object (VAO) at init (see `WebGLBatcher.createVertexState`).
	 * Kept public for custom callers managing their own vertex setup.
	 * Custom shaders hosted by a built-in batcher must declare that
	 * batcher's attributes first, in layout order — attribute locations
	 * are bound in declaration order and the vertex state is frozen.
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
		const copy = new GLShader(this.gl, {
			vertex: this._sourceVertex,
			fragment: this._sourceFragment,
			precision: this._precision,
			wgsl: this.wgsl,
			label: this.label,
		});
		// replay this shader's cached uniform values onto the clone (the same
		// snapshot store the context-loss recovery replays from). When the
		// clone is constructed mid-context-loss its program compiles deferred
		// (`uniforms` is null) — the suspended setUniform caches values for
		// the restore replay. When live, validate against the clone's active
		// uniforms (same guard the restore replay uses) so a name cached
		// during an earlier suspended window can't make setUniform throw.
		for (const name of Object.keys(this._uniformCache)) {
			if (
				copy.suspended ||
				copy.uniforms === null ||
				typeof copy.uniforms[name] !== "undefined"
			) {
				copy.setUniform(name, this._uniformCache[name]);
			}
		}
		return copy;
	}

	/**
	 * Register this shader's WGSL module as a pipeline family for one
	 * hosting mesh batcher, against that host's positional group-layout
	 * list and frozen vertex layout. Registered once per host per device
	 * generation; the module text is namespaced by the host key so the
	 * same shader yields distinct families (distinct pipeline layouts) on
	 * the unlit and lit hosts. Asynchronous WGSL validation errors flip
	 * {@link GLShader#wgslValid} and the host falls back to its built-in
	 * shading (warn-and-degrade, never fatal).
	 * @param {object} cache - the WebGPU renderer's pipeline cache
	 * @param {string} host - the hosting family's vertex-layout key
	 * @param {GPUBindGroupLayout[]} bindGroupLayouts - the host's group list
	 * @param {string} vertexLayoutKey - the host's registered vertex layout
	 * @returns {string|null} the family key to pass to the pipeline cache's
	 *   `get`, or null when the module failed validation on this device
	 *   generation (the host then uses its built-in family)
	 * @ignore
	 * @internal
	 */
	registerWGSL(cache, host, bindGroupLayouts, vertexLayoutKey) {
		// epoch first, invalid-gate second: a device loss replaces the cache
		// (new epoch), and the fresh device gets a fresh validation verdict
		// even for a shader that failed on the previous one
		if (this._wgslRegistrations.epoch !== cache.epoch) {
			this._wgslRegistrations = { epoch: cache.epoch, keys: new Map() };
			this.wgslValid = true;
		}
		if (this.wgslValid === false) {
			return null;
		}
		let key = this._wgslRegistrations.keys.get(host);
		if (typeof key === "undefined") {
			// namespace suffix LAST so compilation-error line numbers still
			// match the authored module text
			key = cache.registerShader(`${this.wgsl}\n// melonJS host: ${host}`, {
				bindGroupLayouts,
				vertexLayoutKey,
				label: this.label ?? "melonJS custom mesh shader",
			});
			this._wgslRegistrations.keys.set(host, key);

			const module = cache.modules?.[key];
			if (typeof module?.getCompilationInfo === "function") {
				module
					.getCompilationInfo()
					.then((info) => {
						const errors = info.messages.filter((message) => {
							return message.type === "error";
						});
						if (errors.length > 0) {
							this.wgslValid = false;
							console.warn(
								`GLShader${this.label ? ` (${this.label})` : ""}: WGSL compilation failed — falling back to the built-in mesh shading\n${errors
									.map((message) => {
										return `  line ${message.lineNum}: ${message.message}`;
									})
									.join("\n")}`,
							);
						}
					})
					.catch(() => {});
			}

			// Pipeline-level containment: a module can compile CLEAN yet
			// declare a binding absent from this host's pipeline layout —
			// that error only surfaces at pipeline creation, and an invalid
			// pipeline poisons every frame that records it (the whole
			// submit fails). Build one representative pipeline inside an
			// error scope; any validation error flips the same fallback.
			const device = cache.device;
			if (typeof device?.pushErrorScope === "function") {
				device.pushErrorScope("validation");
				try {
					cache.get(key, "triangle-list", "none", true, "none", {
						cullMode: "none",
						frontFace: "ccw",
					});
				} catch {
					/* surfaced through the scope below */
				}
				device
					.popErrorScope()
					.then((error) => {
						if (error) {
							this.wgslValid = false;
							console.warn(
								`GLShader${this.label ? ` (${this.label})` : ""}: WGSL module is incompatible with the mesh pipeline layout — falling back to the built-in mesh shading\n  ${error.message}`,
							);
						}
					})
					.catch(() => {});
			}
		}
		return key;
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

		// WGSL side: the GPU shader modules are owned by the pipeline cache
		// (shared with any other shader of the same text) — only drop the
		// registrations and the module source
		this.wgsl = undefined;
		this.isWebGPU = false;
		this._wgslRegistrations = { epoch: -1, keys: new Map() };
	}
}
