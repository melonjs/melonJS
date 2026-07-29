import VertexArrayBuffer from "../../buffer/vertex.js";
import WebGLIndexBuffer from "../buffer/index.js";
import WebGLVertexState from "../buffer/vertexstate.js";
import GLShader from "../glshader.js";

/**
 * additional import for TypeScript
 * @import WebGLRenderer from "./../webgl_renderer.js";
 * @import {Matrix3d} from "../../../math/matrix3d.ts";
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

		/**
		 * primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
		 * @type {number}
		 * @default gl.TRIANGLES
		 */
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
				this.addAttribute(
					attr.name,
					attr.size,
					attr.type,
					attr.normalized,
					attr.offset,
				);
			});
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
	 * add vertex attribute property definition to the batcher
	 * @param {string} name - name of the attribute in the vertex shader
	 * @param {number} size - number of components per vertex attribute. Must be 1, 2, 3, or 4.
	 * @param {GLenum} type - data type of each component in the array
	 * @param {boolean} normalized - whether integer data values should be normalized into a certain range when being cast to a float
	 * @param {number} offset - offset in bytes of the first component in the vertex attribute array
	 */
	addAttribute(name, size, type, normalized, offset) {
		if (this.vertexState) {
			// the layout is baked into the vertex-state object at init —
			// immutable afterwards, exactly like a vertex layout in a
			// compiled render pipeline
			throw new Error(
				"Batcher.addAttribute: the vertex buffer layout is frozen once the vertex state is built (add attributes before/without calling init)",
			);
		}
		this.attributes.push({ name, size, type, normalized, offset });

		switch (type) {
			case this.gl.BYTE:
				this.stride += size * Int8Array.BYTES_PER_ELEMENT;
				break;
			case this.gl.UNSIGNED_BYTE:
				this.stride += size * Uint8Array.BYTES_PER_ELEMENT;
				break;
			case this.gl.SHORT:
				this.stride += size * Int16Array.BYTES_PER_ELEMENT;
				break;
			case this.gl.UNSIGNED_SHORT:
				this.stride += size * Uint16Array.BYTES_PER_ELEMENT;
				break;
			case this.gl.INT:
				this.stride += size * Int32Array.BYTES_PER_ELEMENT;
				break;
			case this.gl.UNSIGNED_INT:
				this.stride += size * Uint32Array.BYTES_PER_ELEMENT;
				break;
			case this.gl.FLOAT:
				this.stride += size * Float32Array.BYTES_PER_ELEMENT;
				break;
			default:
				throw new Error("Invalid GL Attribute type");
		}
		this.vertexSize = this.stride / Float32Array.BYTES_PER_ELEMENT;
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
