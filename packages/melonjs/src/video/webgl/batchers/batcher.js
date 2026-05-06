import VertexArrayBuffer from "../../buffer/vertex.js";
import WebGLIndexBuffer from "../buffer/index.js";
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
 * Within the Uint16 index limit (65,535) required for WebGL1 compatibility.
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
			this.indexBuffer.clear();
		}
	}

	/**
	 * called by the WebGL renderer when a batcher becomes the current one
	 */
	bind() {
		if (this.useIndexBuffer) {
			const gl = this.gl;
			gl.bindBuffer(gl.ARRAY_BUFFER, this.glVertexBuffer);
			if (this.indexBuffer) {
				this.indexBuffer.bind();
			}
		}

		if (this.renderer.currentProgram !== this.defaultShader.program) {
			this.useShader(this.defaultShader);
		}
	}

	/**
	 * called by the WebGL renderer when this batcher is being replaced by another.
	 * Disables this batcher's vertex attribute locations so they don't leak across
	 * (otherwise stale stride/offset state can cause INVALID_OPERATION on the next draw).
	 */
	unbind() {
		if (this.currentShader === undefined) {
			return;
		}
		const gl = this.gl;
		for (let i = 0; i < this.attributes.length; ++i) {
			const location = this.currentShader.getAttribLocation(
				this.attributes[i].name,
			);
			if (location !== -1) {
				gl.disableVertexAttribArray(location);
			}
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
			// Disable the previous shader's enabled attribute locations
			// before binding the new one. The two shaders may have linked
			// the same attribute name to different locations, so the new
			// shader's `setVertexAttributes` won't necessarily re-point
			// every old location — leaving stale stride/offset state that
			// can trigger `INVALID_OPERATION` on the next draw call.
			if (this.currentShader && this.currentShader !== shader) {
				this.unbind();
			}
			shader.bind();
			shader.setUniform(this.projectionUniform, this.renderer.projectionMatrix);

			shader.setVertexAttributes(this.gl, this.attributes, this.stride);

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

			if (this.useIndexBuffer && this.indexBuffer.length > 0) {
				// indexed drawing path — bind own buffers
				gl.bindBuffer(gl.ARRAY_BUFFER, this.glVertexBuffer);

				// re-apply vertex attributes
				this.currentShader.setVertexAttributes(
					gl,
					this.attributes,
					this.stride,
				);

				// upload vertex data
				if (this.renderer.WebGLVersion > 1) {
					gl.bufferData(
						gl.ARRAY_BUFFER,
						vertex.toFloat32(),
						gl.STREAM_DRAW,
						0,
						vertexCount * vertexSize,
					);
				} else {
					gl.bufferData(
						gl.ARRAY_BUFFER,
						vertex.toFloat32(0, vertexCount * vertexSize),
						gl.STREAM_DRAW,
					);
				}

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
				if (this.renderer.WebGLVersion > 1) {
					gl.bufferData(
						gl.ARRAY_BUFFER,
						vertex.toFloat32(),
						gl.STREAM_DRAW,
						0,
						vertexCount * vertexSize,
					);
				} else {
					gl.bufferData(
						gl.ARRAY_BUFFER,
						vertex.toFloat32(0, vertexCount * vertexSize),
						gl.STREAM_DRAW,
					);
				}

				gl.drawArrays(mode, 0, vertexCount);
			}

			// clear the vertex buffer
			vertex.clear();
		}
	}
}

export default Batcher;
