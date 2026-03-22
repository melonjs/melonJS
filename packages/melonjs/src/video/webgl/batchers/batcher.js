import VertexArrayBuffer from "../buffer/vertex.js";
import GLShader from "../glshader.js";

/**
 * additional import for TypeScript
 * @import WebGLRenderer from "./../webgl_renderer.js";
 * @import {Matrix3d} from "../../../math/matrix3d.ts";
 */

/**
 * Maximum number of vertices per batch.
 * At 4096 vertices (1024 quads), the vertex buffer is ~80 KB (5 floats × 4 bytes × 4096),
 * which balances draw call reduction with safe buffer upload sizes on mobile tile-based GPUs.
 * Within the Uint16 index limit (65,535) required for WebGL1 compatibility.
 * @ignore
 */
const MAX_VERTICES = 4096;

/**
 * A base WebGL Batcher object that manages shader programs, vertex attribute
 * definitions, and vertex buffer batching for efficient GPU draw calls.
 * @category Rendering
 */
export class Batcher {
	/**
	 * @param {WebGLRenderer} renderer - the current WebGL renderer session
	 * @param {object} settings - additional settings to initialize this batcher
	 * @param {object[]} settings.attribute - an array of attributes definition
	 * @param {string} settings.attribute.name - name of the attribute in the vertex shader
	 * @param {number} settings.attribute.size - number of components per vertex attribute. Must be 1, 2, 3, or 4.
	 * @param {GLenum} settings.attribute.type - data type of each component in the array
	 * @param {boolean} settings.attribute.normalized - whether integer data values should be normalized into a certain range when being cast to a float
	 * @param {number} settings.attribute.offset - offset in bytes of the first component in the vertex attribute array
	 * @param {object} settings.shader - an array of attributes definition
	 * @param {string} settings.shader.vertex - a string containing the GLSL source code to set
	 * @param {string} settings.shader.fragment - a string containing the GLSL source code to set
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

		// parse given attibrutes
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
			this.vertexData = new VertexArrayBuffer(this.vertexSize, MAX_VERTICES);
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
			);
		} else {
			throw new Error("shader definition missing");
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
	}

	/**
	 * called by the WebGL renderer when a batcher becomes the current one
	 */
	bind() {
		if (this.renderer.currentProgram !== this.defaultShader.program) {
			this.useShader(this.defaultShader);
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
			shader.setUniform("uProjectionMatrix", this.renderer.projectionMatrix);
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
		this.currentShader.setUniform("uProjectionMatrix", matrix);
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

			// Copy data into stream buffer
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

			// clear the vertex buffer
			vertex.clear();
		}
	}
}

export default Batcher;
