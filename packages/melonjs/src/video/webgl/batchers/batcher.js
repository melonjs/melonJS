import VertexArrayBuffer from "../../buffer/vertex.js";
import { resolveVertexFormat } from "../../gpu/vertexformat.ts";
import WebGLIndexBuffer from "../buffer/index.js";
import WebGLVertexState from "../buffer/vertexstate.js";
import GLShader from "../glshader.js";
import { resolveTopology, topologyFromGL } from "../utils/topology.js";
import { formatFromGL, glTypeForFormat } from "../utils/vertexformat.js";

/**
 * additional import for TypeScript
 * @import WebGLRenderer from "./../webgl_renderer.js";
 * @import {Matrix3d} from "../../../math/matrix3d.ts";
 * @import {VertexFormat} from "../../gpu/vertexformat.ts";
 * @import {Topology} from "../../gpu/topology.ts";
 */

/**
 * Default maximum number of vertices per batch.
 * At 4096 vertices (1024 quads), the vertex buffer is ~80 KB (5 floats × 4 bytes × 4096),
 * which balances draw call reduction with safe buffer upload sizes on mobile tile-based GPUs.
 * Within the Uint16 index limit (65,535) — a deliberate capacity choice
 * (smaller index uploads), not an API constraint.
 * @ignore
 */
const DEFAULT_MAX_VERTICES = 4096;

/**
 * A base WebGL Batcher object that manages shader programs, vertex attribute
 * definitions, and vertex buffer batching for efficient GPU draw calls.
 * @category Rendering
 */
export class Batcher {
	/**
	 * Canonical topology; `#mode` is derived from it so the two cannot
	 * disagree.
	 * @type {Topology}
	 * @ignore
	 */
	#topology = "triangle-list";

	/**
	 * The GL enum for `#topology`, precomputed so reads stay cheap.
	 * @type {number}
	 * @ignore
	 */
	#mode = 4;

	/**
	 * @param {WebGLRenderer} renderer - the current WebGL renderer session
	 * @param {object} settings - additional settings to initialize this batcher
	 * @param {object[]} settings.attributes - an array of attributes definition
	 * @param {string} settings.attributes.name - name of the attribute in the vertex shader
	 * @param {number} settings.attributes.size - number of components per vertex attribute. Must be 1, 2, 3, or 4.
	 * @param {GLenum} settings.attributes.type - data type of each component in the array
	 * @param {boolean} settings.attributes.normalized - whether integer data values should be normalized into a certain range when being cast to a float
	 * @param {number} settings.attributes.offset - offset in bytes of the first component in the vertex attribute array
	 * @param {object} settings.shader - shader definition
	 * @param {string} settings.shader.vertex - a string containing the GLSL source code to set
	 * @param {string} settings.shader.fragment - a string containing the GLSL source code to set
	 * @param {number} [settings.maxVertices=4096] - the maximum number of vertices this batcher can hold
	 * @param {boolean} [settings.indexed=false] - whether this batcher uses an index buffer for indexed drawing (drawElements)
	 * @param {string} [settings.projectionUniform="uProjectionMatrix"] - the name of the projection matrix uniform in the shader
	 */
	constructor(renderer, settings) {
		this.init(renderer, settings);
	}

	/**
	 * Initialize the batcher
	 * @ignore
	 */
	init(renderer, settings) {
		// the associated renderer
		this.renderer = renderer;

		// WebGL context
		this.gl = renderer.gl;

		// Global transformation matrix
		this.viewMatrix = renderer.currentTransform;

		/**
		 * the default shader created by this batcher
		 * @type {GLShader}
		 */
		this.defaultShader = undefined;

		/**
		 * the shader currently used by this batcher
		 * @type {GLShader}
		 */
		this.currentShader = undefined;

		// goes through the setter below, which accepts either vocabulary
		this.mode = this.gl.TRIANGLES;

		// re-init (context restore runs init() on the existing instance):
		// drop the previous life's vertex state, which also unfreezes the
		// layout so the attribute definitions below can be rebuilt
		if (this.vertexState) {
			this.vertexState.destroy();
			this.vertexState = null;
		}

		/**
		 * an array of vertex attribute properties
		 * @see Batcher.addAttribute
		 * @type {Array.<Object>}
		 */
		this.attributes = [];

		/**
		 * the stride of a single vertex in bytes
		 * (will automatically be calculated as attributes definitions are added)
		 * @see Batcher.addAttribute
		 * @type {number}
		 */
		this.stride = 0;

		/**
		 * the size of a single vertex in floats
		 * (will automatically be calculated as attributes definitions are added)
		 * @see Batcher.addAttribute
		 * @type {number}
		 */
		this.vertexSize = 0;

		/**
		 * the vertex data buffer used by this batcher
		 * @type {VertexArrayBuffer}
		 */
		this.vertexData = null;

		// maximum number of vertices
		const maxVertices =
			(settings && settings.maxVertices) || DEFAULT_MAX_VERTICES;

		// parse given attributes
		if (typeof settings !== "undefined" && Array.isArray(settings.attributes)) {
			settings.attributes.forEach((attr) => {
				// pass the descriptor through untouched — `addAttribute` is the
				// single place either vocabulary is resolved
				this.addAttribute(attr);
			});
			// `vertexSize` is a float count, so a stride that is not a whole
			// number of floats makes it fractional — and `VertexArrayBuffer`
			// computes write offsets as `vertexCount * vertexSize`, so every
			// write would land off-grid and be silently discarded. Only
			// reachable now that sub-4-byte formats can be spelled.
			if (this.stride % Float32Array.BYTES_PER_ELEMENT !== 0) {
				throw new Error(
					`Batcher: vertex stride must be a multiple of ${Float32Array.BYTES_PER_ELEMENT} bytes, got ${this.stride}. ` +
						"Pad the layout (a 3-component byte attribute usually wants 4 components).",
				);
			}
			this.vertexData = new VertexArrayBuffer(this.vertexSize, maxVertices);
		} else {
			throw new Error("attributes definition missing");
		}

		// parse and instantiate the default shader
		if (
			typeof settings !== "undefined" &&
			typeof settings.shader !== "undefined"
		) {
			this.defaultShader = new GLShader(
				this.gl,
				settings.shader.vertex,
				settings.shader.fragment,
				this.renderer.shaderPrecision,
			);
		} else {
			throw new Error("shader definition missing");
		}

		/**
		 * the name of the projection matrix uniform in the shader
		 * @type {string}
		 */
		this.projectionUniform = settings.projectionUniform || "uProjectionMatrix";

		/**
		 * whether this batcher uses indexed drawing
		 * @type {boolean}
		 */
		this.useIndexBuffer = settings.indexed === true;

		/**
		 * the GL vertex buffer object (own buffer for indexed batchers, null for shared)
		 * @type {WebGLBuffer|null}
		 * @ignore
		 */
		this.glVertexBuffer = null;

		/**
		 * the dynamic index buffer (only for indexed batchers)
		 * @type {WebGLIndexBuffer|null}
		 * @ignore
		 */
		this.indexBuffer = null;

		if (this.useIndexBuffer) {
			const gl = this.gl;
			this.glVertexBuffer = gl.createBuffer();
			// max indices: worst case is 3 indices per vertex (all triangles, no sharing)
			this.indexBuffer = new WebGLIndexBuffer(gl, maxVertices * 3, false);
		}

		// build the frozen vertex-state object (VAO) once all buffers exist;
		// quad-family batchers create their static index buffer AFTER this
		// (in their own init) and capture it via the wrap in
		// `createIndexBuffer`
		this.createVertexState();
	}

	/**
	 * The GL buffer this batcher uploads its vertex data into: its own
	 * buffer for indexed (mesh-family) batchers, otherwise the renderer's
	 * shared one.
	 * @type {WebGLBuffer}
	 * @ignore
	 */
	get uploadBuffer() {
		return this.glVertexBuffer ?? this.renderer.vertexBuffer;
	}

	/**
	 * (Re)build this batcher's {@link WebGLVertexState} — the frozen vertex
	 * buffer layout (`attributes` + `stride`) realized as a GL vertex array
	 * object bound to this batcher's upload buffer and, for indexed
	 * batchers, its index buffer.
	 *
	 * Every shader hosted by this batcher must declare a prefix of that
	 * layout, in layout order (see {@link validateShaderLocations}) — the
	 * locations are frozen here at the default shader's mapping.
	 * @ignore
	 */
	createVertexState() {
		const descriptor = {
			attributes: this.attributes,
			stride: this.stride,
			buffer: this.uploadBuffer,
			indexBuffer: this.useIndexBuffer ? this.indexBuffer : undefined,
			resolveLocation: (name) => {
				return this.defaultShader.getAttribLocation(name);
			},
		};
		if (this.vertexState) {
			// keep the object identity across rebuilds; only the GL handle
			// and the buffers it references change
			this.vertexState.build(descriptor);
		} else {
			this.vertexState = new WebGLVertexState(this.gl, descriptor);
		}
	}

	/**
	 * Release every GL object this batcher owns (vertex state, own vertex
	 * and index buffers, default shader). Called by
	 * {@link WebGLRenderer#destroy}; subclasses that override must chain to
	 * `super.destroy()`.
	 * @ignore
	 */
	destroy() {
		const gl = this.gl;
		if (this.vertexState) {
			this.vertexState.destroy();
			this.vertexState = null;
		}
		if (this.glVertexBuffer) {
			gl.deleteBuffer(this.glVertexBuffer);
			this.glVertexBuffer = null;
		}
		if (this.indexBuffer) {
			this.indexBuffer.destroy();
			this.indexBuffer = null;
		}
		if (this.defaultShader) {
			this.defaultShader.destroy();
			this.defaultShader = undefined;
		}
		this.currentShader = undefined;
	}

	/**
	 * Reset batcher internal state
	 * @ignore
	 */
	reset() {
		// WebGL context
		this.gl = this.renderer.gl;

		// clear the vertex data buffer
		this.vertexData.clear();

		if (this.useIndexBuffer) {
			// re-create the GL buffers rather than just clearing counters: on
			// context restore the old buffer objects belong to the LOST
			// context, and every upload through them would silently fail
			// (mesh draws vanish). `deleteBuffer` on a lost-context object is
			// a harmless no-op, so plain resets stay leak-free too. The
			// quad-family batchers (non-indexed, static pattern) re-create
			// their own index buffer in their reset() override.
			const gl = this.gl;
			gl.deleteBuffer(this.glVertexBuffer);
			this.glVertexBuffer = gl.createBuffer();
			this.indexBuffer.recreate();
			// the vertex state still references the DELETED buffers — a VAO
			// keeps deleted attachments alive per the GL spec and draws from
			// them (stale/dead data). Rebuild against the new buffers.
			this.createVertexState();
		}
	}

	/**
	 * called by the WebGL renderer when a batcher becomes the current one
	 */
	bind() {
		const gl = this.gl;
		// one bind restores the whole frozen vertex state (attribute
		// pointers + element buffer) — the WebGL analogue of setPipeline +
		// setVertexBuffer + setIndexBuffer
		this.vertexState.bind();
		// ARRAY_BUFFER binding is NOT VAO state; uploads in flush() need the
		// batcher's upload target bound (this also preserves the invariant
		// custom batchers with hand-rolled flush() relied on)
		gl.bindBuffer(gl.ARRAY_BUFFER, this.uploadBuffer);

		if (this.renderer.currentProgram !== this.defaultShader.program) {
			this.useShader(this.defaultShader);
		}
	}

	/**
	 * called by the WebGL renderer when this batcher is being replaced by
	 * another. Attribute state no longer needs disabling — it lives in this
	 * batcher's vertex-state object and the incoming batcher's `bind()`
	 * replaces the binding wholesale. Kept as a lifecycle hook: subclasses
	 * override it to restore mode-specific GL state (see MeshBatcher's
	 * blend/depth restore).
	 */
	unbind() {}

	/**
	 * Validate (once per shader) that a hosted shader's attribute locations
	 * match this batcher's frozen vertex state. The engine's analogue of
	 * WebGPU's pipeline-creation validation: locations are bound in vertex
	 * source declaration order, so every shader hosted by this batcher must
	 * declare a prefix of the batcher's attribute layout, in layout order.
	 * A mismatched shader silently reads wrong vertex data — warn loudly.
	 * @ignore
	 */
	validateShaderLocations(shader) {
		if (this.validatedShaders === undefined) {
			this.validatedShaders = new WeakSet();
		}
		if (shader === this.defaultShader || this.validatedShaders.has(shader)) {
			return;
		}
		this.validatedShaders.add(shader);
		const mismatches = [];
		for (const attr of this.attributes) {
			const expected = this.defaultShader.getAttribLocation(attr.name);
			const actual = shader.getAttribLocation(attr.name);
			// -1 = the shader doesn't declare this attribute — allowed (the
			// enabled array is simply unconsumed); a DIFFERENT location is
			// the contract violation
			if (actual !== -1 && actual !== expected) {
				mismatches.push(`"${attr.name}" at ${actual} (expected ${expected})`);
			}
		}
		if (mismatches.length > 0) {
			// one consolidated warning per (batcher, shader) pair
			console.warn(
				`melonJS: shader attribute location mismatch: ${mismatches.join(", ")} — ` +
					"custom shaders must declare the batcher's attributes first, in layout order (vertex data will be read incorrectly)",
			);
		}
	}

	/**
	 * Select the shader to use for compositing
	 * @see GLShader
	 * @param {GLShader} shader - a reference to a GLShader instance
	 */
	useShader(shader) {
		if (
			this.currentShader !== shader ||
			this.renderer.currentProgram !== shader.program
		) {
			this.flush();
			shader.bind();
			shader.setUniform(this.projectionUniform, this.renderer.projectionMatrix);

			// attribute pointers live in the frozen vertex state — hosted
			// shaders must conform to it (checked once per shader)
			this.validateShaderLocations(shader);

			this.currentShader = shader;
			this.renderer.currentProgram = shader.program;

			// force sampler uniform to be re-set on next addQuad
			if (typeof this.currentSamplerUnit !== "undefined") {
				this.currentSamplerUnit = -1;
			}
		}
	}

	/**
	 * How this batcher assembles vertices into primitives, in the
	 * backend-neutral vocabulary.
	 *
	 * `"line-loop"` and `"triangle-fan"` are engine extensions with no
	 * equivalent in modern GPU APIs — prefer the others for anything that must
	 * survive a backend change.
	 * @type {Topology}
	 * @default "triangle-list"
	 */
	get topology() {
		return this.#topology;
	}

	/**
	 * @param {Topology|number} value - a topology name or a GL primitive mode
	 */
	set topology(value) {
		this.mode = value;
	}

	/**
	 * Primitive type to render, as a GL enum (`gl.TRIANGLES`, `gl.LINES`, …).
	 *
	 * Assignable from either vocabulary — `batcher.mode = "line-list"` and
	 * `batcher.mode = gl.LINES` are equivalent — but always reads back as the
	 * GL enum, so existing comparisons keep working. Read
	 * {@link Batcher#topology} for the portable name.
	 * @type {number}
	 * @default gl.TRIANGLES
	 */
	get mode() {
		return this.#mode;
	}

	/**
	 * @param {Topology|number} value - a topology name or a GL primitive mode
	 */
	set mode(value) {
		// Resolve on assignment rather than at draw time. A topology string
		// that reached a GL draw call would be coerced to 0, which *is*
		// POINTS — so the batch would silently render as points with no error
		// anywhere. Normalizing here is what makes that unreachable.
		this.#mode = resolveTopology(this.gl, value);
		this.#topology = topologyFromGL(this.gl, this.#mode);
	}

	/**
	 * Add a vertex attribute to this batcher's layout.
	 *
	 * Accepts either vocabulary. The backend-neutral form names the component
	 * type and count in one token, which is what a non-WebGL backend can
	 * consume directly and what lets a layout be written without a live
	 * rendering context:
	 *
	 * ```js
	 * batcher.addAttribute({ name: "aColor", format: "unorm8x4", offset: 20 });
	 * batcher.addAttribute("aColor", "unorm8x4", 20);
	 * ```
	 *
	 * The GL form is supported indefinitely and behaves exactly as before:
	 *
	 * ```js
	 * batcher.addAttribute("aColor", 4, gl.UNSIGNED_BYTE, true, 20);
	 * ```
	 *
	 * Records keep both spellings, so existing readers of `size` / `type` /
	 * `normalized` are unaffected. A GL combination with no portable name —
	 * three-component 8- and 16-bit types, which the neutral vocabulary does
	 * not define — is stored with `format: undefined` rather than an invented
	 * name that a backend could not honour.
	 *
	 * The layout is frozen once `init()` has built the vertex state, and each
	 * record is frozen on insertion: a batcher rebuilds its vertex state from
	 * these records after a context loss, so a later mutation would take
	 * effect at restore time rather than where it was written.
	 * @param {string|object} name - attribute name, or a descriptor object
	 * @param {number|VertexFormat} [size] - component count (GL form), or the format (neutral form)
	 * @param {GLenum|number} [type] - component type (GL form), or the byte offset (neutral form)
	 * @param {boolean} [normalized] - whether integers are scaled into `[0, 1]` / `[-1, 1]` (GL form only)
	 * @param {number} [offset] - byte offset of the attribute within a vertex (GL form)
	 * @throws {Error} when the layout is frozen, the format or GL type is unknown, or a descriptor contradicts itself
	 */
	addAttribute(name, size, type, normalized, offset) {
		// Frozen check first, before any argument resolution: a frozen batcher
		// must report that regardless of what else is wrong with the call.
		if (this.vertexState) {
			// the layout is baked into the vertex-state object at init —
			// immutable afterwards, exactly like a vertex layout in a
			// compiled render pipeline
			throw new Error(
				"Batcher.addAttribute: the vertex buffer layout is frozen once the vertex state is built (add attributes before/without calling init)",
			);
		}

		const descriptor = this.#toAttributeDescriptor(
			name,
			size,
			type,
			normalized,
			offset,
			arguments.length,
		);
		const resolved = this.#resolveAttribute(descriptor);

		this.attributes.push(Object.freeze(resolved));
		this.stride += resolved.bytes;
		this.vertexSize = this.stride / Float32Array.BYTES_PER_ELEMENT;
	}

	/**
	 * Normalize the three accepted call shapes into one descriptor.
	 *
	 * Disambiguated on the second argument: a number is a component count (GL
	 * form), a string is a format (neutral form). The two can never collide.
	 * @param {string|object} name - first argument as received
	 * @param {number|string} size - second argument as received
	 * @param {number} type - third argument as received
	 * @param {boolean} normalized - fourth argument as received
	 * @param {number} offset - fifth argument as received
	 * @param {number} argCount - how many arguments the caller actually passed
	 * @returns {object} a `{name, format?, size?, type?, normalized?, offset?}` descriptor
	 * @ignore
	 */
	#toAttributeDescriptor(name, size, type, normalized, offset, argCount) {
		if (typeof name === "object" && name !== null) {
			return name;
		}
		if (typeof size === "string") {
			// neutral positional form: (name, format, offset). Guard the arity
			// rather than let a copied-over `normalized` argument land in
			// `offset` and silently place the attribute at byte 0.
			if (argCount > 3) {
				throw new Error(
					`Batcher.addAttribute("${name}", "${size}", …): the format form takes ` +
						`(name, format, offset) — got ${argCount} arguments. ` +
						"Drop the size/normalized arguments; the format implies them.",
				);
			}
			if (type !== undefined && typeof type !== "number") {
				throw new Error(
					`Batcher.addAttribute("${name}", "${size}", …): offset must be a number, got ${typeof type}`,
				);
			}
			return { name, format: size, offset: type };
		}
		return { name, size, type, normalized, offset };
	}

	/**
	 * Resolve a descriptor written in either vocabulary into the record shape
	 * every consumer reads, plus the byte size to advance the stride by.
	 * @param {object} descriptor - the normalized descriptor
	 * @returns {object} `{name, format, size, type, normalized, offset, bytes}`
	 * @ignore
	 */
	#resolveAttribute(descriptor) {
		const { name } = descriptor;
		// tightly packed by default in the neutral form: an omitted offset is
		// almost always meant to follow the previous attribute, and silently
		// defaulting to 0 would overlap them
		const offset = descriptor.offset ?? this.stride;

		if (typeof descriptor.format === "string") {
			const info = resolveVertexFormat(descriptor.format);
			// A redundant size/normalized is allowed only if it agrees. Silently
			// preferring one would produce a wrong stride, which does not throw
			// — it makes every vertex read from the wrong offset.
			if (
				descriptor.size !== undefined &&
				descriptor.size !== info.components
			) {
				throw new Error(
					`Batcher.addAttribute("${name}"): format "${descriptor.format}" has ` +
						`${info.components} components but size ${descriptor.size} was given`,
				);
			}
			if (
				descriptor.normalized !== undefined &&
				descriptor.normalized !== info.normalized
			) {
				throw new Error(
					`Batcher.addAttribute("${name}"): format "${descriptor.format}" is ` +
						`${info.normalized ? "" : "not "}normalized but normalized=${descriptor.normalized} was given`,
				);
			}
			return {
				name,
				format: descriptor.format,
				size: info.components,
				type: glTypeForFormat(this.gl, descriptor.format),
				normalized: info.normalized,
				offset,
				bytes: info.bytes,
			};
		}

		// GL form. `type` may also carry a format string as a migration alias;
		// resolve it here so no string ever survives into the record — one that
		// reached `vertexAttribPointer` would coerce to 0 and raise
		// INVALID_ENUM far from its cause.
		if (typeof descriptor.type === "string") {
			return this.#resolveAttribute({
				name,
				format: descriptor.type,
				size: descriptor.size,
				normalized: descriptor.normalized,
				offset: descriptor.offset,
			});
		}

		const { size, type, normalized } = descriptor;
		const bytes = this.#byteSizeOf(size, type);
		return {
			name,
			// undefined when the combination has no portable name
			format: formatFromGL(this.gl, size, type, normalized),
			size,
			type,
			normalized,
			offset,
			bytes,
		};
	}

	/**
	 * Byte size of a GL-form attribute.
	 * @param {number} size - component count
	 * @param {GLenum} type - component type
	 * @returns {number} bytes occupied
	 * @ignore
	 */
	#byteSizeOf(size, type) {
		switch (type) {
			case this.gl.BYTE:
				return size * Int8Array.BYTES_PER_ELEMENT;
			case this.gl.UNSIGNED_BYTE:
				return size * Uint8Array.BYTES_PER_ELEMENT;
			case this.gl.SHORT:
				return size * Int16Array.BYTES_PER_ELEMENT;
			case this.gl.UNSIGNED_SHORT:
				return size * Uint16Array.BYTES_PER_ELEMENT;
			case this.gl.INT:
				return size * Int32Array.BYTES_PER_ELEMENT;
			case this.gl.UNSIGNED_INT:
				return size * Uint32Array.BYTES_PER_ELEMENT;
			case this.gl.FLOAT:
				return size * Float32Array.BYTES_PER_ELEMENT;
			default:
				throw new Error("Invalid GL Attribute type");
		}
	}

	/**
	 * set/change the current projection matrix
	 * @param {Matrix3d} matrix - the new projection matrix
	 */
	setProjection(matrix) {
		this.currentShader.setUniform(this.projectionUniform, matrix);
	}

	/**
	 * Add index values to the index buffer (only for indexed batchers).
	 * Indices are rebased relative to the current vertex count.
	 * @param {number[]} indices - array of index values to add
	 */
	addIndices(indices) {
		if (!this.useIndexBuffer) {
			return;
		}
		this.indexBuffer.add(indices, this.vertexData.vertexCount);
	}

	/**
	 * Flush batched vertex data to the GPU
	 * @param {number} [mode=gl.TRIANGLES] - the GL drawing mode
	 */
	flush(mode = this.mode) {
		// Accepts either vocabulary. Only strings need resolving: `this.mode`
		// is already normalized by its setter, and this runs on every flush, so
		// a table lookup per draw would be pure overhead on the hottest path.
		if (typeof mode === "string") {
			mode = resolveTopology(this.gl, mode);
		}
		const vertex = this.vertexData;
		const vertexCount = vertex.vertexCount;

		if (vertexCount > 0) {
			const gl = this.gl;
			const vertexSize = vertex.vertexSize;

			// Upload byte length covers exactly the vertices we've pushed.
			// Use the Uint8 view (NOT Float32) to keep packed-color bytes
			// intact — see `VertexArrayBuffer.bufferU8` for why this matters
			// on Metal-backed drivers.
			const byteLength =
				vertexCount * vertexSize * Float32Array.BYTES_PER_ELEMENT;

			if (this.useIndexBuffer && this.indexBuffer.length > 0) {
				// indexed drawing path — attribute pointers live in the
				// vertex state; only the upload target needs (re)binding
				// (belt-and-braces: bind() already did this, but a custom
				// flush caller may not have gone through bind())
				gl.bindBuffer(gl.ARRAY_BUFFER, this.glVertexBuffer);

				// upload vertex data (WebGL 2 srcOffset/length overload — no
				// subview copy needed)
				gl.bufferData(
					gl.ARRAY_BUFFER,
					vertex.toUint8(),
					gl.STREAM_DRAW,
					0,
					byteLength,
				);

				// upload and draw with index buffer
				this.indexBuffer.upload();
				gl.drawElements(
					mode,
					this.indexBuffer.length,
					this.indexBuffer.type,
					0,
				);

				// clear index buffer
				this.indexBuffer.clear();
			} else {
				// non-indexed drawing path (original behavior)
				gl.bufferData(
					gl.ARRAY_BUFFER,
					vertex.toUint8(),
					gl.STREAM_DRAW,
					0,
					byteLength,
				);

				gl.drawArrays(mode, 0, vertexCount);
			}

			// clear the vertex buffer
			vertex.clear();
		}
	}
}

export default Batcher;
