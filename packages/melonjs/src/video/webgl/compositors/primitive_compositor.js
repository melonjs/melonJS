import primitiveFragment from "./../shaders/primitive.frag";
import primitiveVertex from "./../shaders/primitive.vert";
import Compositor from "./compositor.js";

/**
 * additional import for TypeScript
 * @import {Point} from "./../../../geometries/point.ts";
 */

/**
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 */
export default class PrimitiveCompositor extends Compositor {
	/**
	 * Initialize the compositor
	 * @ignore
	 */
	init(renderer) {
		super.init(renderer, {
			attributes: [
				{
					name: "aVertex",
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 0 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aNormal",
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 2 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aColor",
					size: 4,
					type: renderer.gl.UNSIGNED_BYTE,
					normalized: true,
					offset: 4 * Float32Array.BYTES_PER_ELEMENT,
				},
			],
			shader: {
				vertex: primitiveVertex,
				fragment: primitiveFragment,
			},
		});

		/**
		 * the current line width applied to the shader uniform
		 * @ignore
		 */
		this.currentLineWidth = 1;
	}

	/**
	 * called by the WebGL renderer when a compositor become the current one
	 */
	bind() {
		const shaderChanged =
			this.renderer.currentProgram !== this.defaultShader.program;
		super.bind();
		if (shaderChanged) {
			// set the default line width uniform after a shader change
			this.currentLineWidth = this.renderer.lineWidth;
			this.currentShader.setUniform("uLineWidth", this.currentLineWidth);
		}
	}

	/**
	 * Reset compositor internal state
	 * @ignore
	 */
	reset() {
		super.reset();
		this.currentLineWidth = 1;
	}

	/**
	 * Draw an array of vertices
	 * @param {GLenum} mode - primitive type to render (gl.POINTS, gl.LINE_STRIP, gl.LINE_LOOP, gl.LINES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN, gl.TRIANGLES)
	 * @param {Point[]} verts - an array of vertices
	 * @param {number} [vertexCount=verts.length] - amount of points defined in the points array
	 */
	drawVertices(mode, verts, vertexCount = verts.length) {
		const lineWidth = this.renderer.lineWidth;

		// update uLineWidth uniform if changed
		if (lineWidth !== this.currentLineWidth) {
			this.flush();
			this.currentLineWidth = lineWidth;
			this.currentShader.setUniform("uLineWidth", lineWidth);
		}

		// expand thick lines to triangles with normals for shader-based expansion
		if (mode === this.gl.LINES && lineWidth > 1) {
			this.#expandLinesToTriangles(verts, vertexCount);
			return;
		}

		const viewMatrix = this.viewMatrix;
		const vertexData = this.vertexData;
		const alpha = this.renderer.getGlobalAlpha();
		const colorUint32 = this.renderer.currentColor.toUint32(alpha);

		if (vertexData.isFull(vertexCount)) {
			// is the vertex buffer full if we add more vertices
			this.flush();
		}

		// flush if drawing vertices with a different drawing mode
		if (mode !== this.mode) {
			this.flush(this.mode);
			this.mode = mode;
		}

		if (!viewMatrix.isIdentity()) {
			for (let i = 0; i < vertexCount; i++) {
				const vert = verts[i];
				viewMatrix.apply(vert);
				vertexData.push(vert.x, vert.y, 0, 0, colorUint32);
			}
		} else {
			for (let i = 0; i < vertexCount; i++) {
				const vert = verts[i];
				vertexData.push(vert.x, vert.y, 0, 0, colorUint32);
			}
		}

		// force flush for primitive using LINE_STRIP or LINE_LOOP
		if (this.mode === this.gl.LINE_STRIP || this.mode === this.gl.LINE_LOOP) {
			this.flush(this.mode);
		}
	}

	/**
	 * Expand line pairs into triangles with perpendicular normals.
	 * The vertex shader offsets each vertex by aNormal * uLineWidth * 0.5,
	 * producing thick lines without manual geometry expansion in the renderer.
	 * @param {Point[]} verts - line vertices in pairs [from, to, from, to, ...]
	 * @param {number} vertexCount - number of vertices
	 * @ignore
	 */
	#expandLinesToTriangles(verts, vertexCount) {
		const viewMatrix = this.viewMatrix;
		const vertexData = this.vertexData;
		const alpha = this.renderer.getGlobalAlpha();
		const colorUint32 = this.renderer.currentColor.toUint32(alpha);
		const hasTransform = !viewMatrix.isIdentity();

		// each line pair (2 verts) expands to 2 triangles (6 verts)
		const expandedCount = (vertexCount / 2) * 6;

		if (vertexData.isFull(expandedCount)) {
			this.flush();
		}

		// switch to TRIANGLES mode
		if (this.mode !== this.gl.TRIANGLES) {
			this.flush(this.mode);
			this.mode = this.gl.TRIANGLES;
		}

		for (let i = 0; i < vertexCount; i += 2) {
			const from = verts[i];
			const to = verts[i + 1];

			// apply view matrix to base positions
			if (hasTransform) {
				viewMatrix.apply(from);
				viewMatrix.apply(to);
			}

			// compute perpendicular unit normal
			const dx = to.x - from.x;
			const dy = to.y - from.y;
			const len = Math.sqrt(dx * dx + dy * dy);

			if (len === 0) {
				continue;
			}

			const nx = -dy / len;
			const ny = dx / len;

			// two triangles forming a quad around the line segment
			// triangle 1: from+n, from-n, to-n
			vertexData.push(from.x, from.y, nx, ny, colorUint32);
			vertexData.push(from.x, from.y, -nx, -ny, colorUint32);
			vertexData.push(to.x, to.y, -nx, -ny, colorUint32);

			// triangle 2: from+n, to-n, to+n
			vertexData.push(from.x, from.y, nx, ny, colorUint32);
			vertexData.push(to.x, to.y, -nx, -ny, colorUint32);
			vertexData.push(to.x, to.y, nx, ny, colorUint32);
		}
	}
}
