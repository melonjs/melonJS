import {
	expandLinesToTriangles,
	pushPrimitiveRange,
} from "../../gpu/primitives.ts";
import primitiveFragment from "./../shaders/primitive.frag";
import primitiveVertex from "./../shaders/primitive.vert";
import { resolveTopology } from "../utils/topology.js";
import { WebGLBatcher } from "./batcher.js";

/**
 * additional import for TypeScript
 * @import {Point} from "./../../../geometries/point.ts";
 */

/**
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 * @category Rendering
 */
export default class PrimitiveBatcher extends WebGLBatcher {
	/**
	 * Initialize the compositor
	 * @ignore
	 */
	init(renderer) {
		super.init(renderer, {
			attributes: [
				{
					// vec3: (x, y, z). z carries `renderable.depth` for
					// perspective projection (Camera3d). Stride = 24 bytes.
					name: "aVertex",
					format: "float32x3",
					offset: 0 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aNormal",
					format: "float32x2",
					offset: 3 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aColor",
					format: "unorm8x4",
					offset: 5 * Float32Array.BYTES_PER_ELEMENT,
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
		// Normalize before anything compares it. Every branch below tests the
		// mode numerically (`=== gl.LINES`, `!== this.mode`, the topology
		// switch), and a string would fail all of them while coercing to 0 —
		// i.e. POINTS — at the draw call.
		if (typeof mode === "string") {
			mode = resolveTopology(this.gl, mode);
		}
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

		const vertexData = this.vertexData;
		const alpha = this.renderer.getGlobalAlpha();
		const colorUint32 = this.renderer.currentColor.toUint32(alpha);
		// z = current renderer depth (Renderable.preDraw); a no-op under ortho,
		// consumed by perspective (Camera3d). Same value for every vertex —
		// primitives don't have per-vertex depth.
		const z = this.renderer.currentDepth;

		// flush if drawing vertices with a different drawing mode
		if (mode !== this.mode) {
			this.flush(this.mode);
			this.mode = mode;
		}

		if (vertexCount < vertexData.maxVertex) {
			// fast path: the shape fits in one batch
			if (vertexData.isFull(vertexCount)) {
				// is the vertex buffer full if we add more vertices
				this.flush();
			}
			this.#pushRange(verts, 0, vertexCount, colorUint32, z);
		} else {
			// a single shape larger than the whole vertex buffer (a filled
			// ellipse already exceeds it at radius ≳ 435 px) — split it into
			// buffer-sized chunks; without this, the typed-array writes past
			// the buffer end are silently dropped while the draw call still
			// uses the full count, raising GL errors and rendering nothing
			this.#drawVerticesChunked(mode, verts, vertexCount, colorUint32, z);
		}

		// force flush for primitive using LINE_STRIP or LINE_LOOP
		if (this.mode === this.gl.LINE_STRIP || this.mode === this.gl.LINE_LOOP) {
			this.flush(this.mode);
		}
	}

	/**
	 * Push `verts[start..end)` into the vertex buffer, transformed by the
	 * current view matrix. The caller guarantees the range fits.
	 * @ignore
	 */
	#pushRange(verts, start, end, colorUint32, z) {
		// the shared neutral range push (z-column-aware transform) — one
		// copy for both backends, see `gpu/primitives.ts`
		pushPrimitiveRange(
			this.vertexData,
			this.viewMatrix,
			verts,
			start,
			end,
			colorUint32,
			z,
		);
	}

	/**
	 * Draw an over-capacity vertex list as a sequence of buffer-sized chunks,
	 * split on primitive boundaries so every triangle/line stays whole:
	 *
	 * - TRIANGLES / LINES chunk on multiples of 3 / 2, POINTS anywhere.
	 * - LINE_STRIP re-pushes the boundary vertex so the connecting segment
	 *   is preserved; LINE_LOOP additionally appends the first vertex at the
	 *   very end (drawn as open strips, the final duplicate closes the loop).
	 * - TRIANGLE_STRIP overlaps 2 boundary vertices; TRIANGLE_FAN re-anchors
	 *   every chunk on `verts[0]` and overlaps 1. (Strip chunk parity can
	 *   flip triangle winding at a boundary — irrelevant here, the primitive
	 *   pipeline never enables face culling.)
	 * @ignore
	 */
	#drawVerticesChunked(mode, verts, vertexCount, colorUint32, z) {
		const gl = this.gl;
		// stay one below maxVertex to match isFull()'s `>=` convention
		const capacity = this.vertexData.maxVertex - 1;
		let step = capacity;
		let overlap = 0;
		let anchor = false;
		let drawMode = mode;
		switch (mode) {
			case gl.TRIANGLES:
				step = capacity - (capacity % 3);
				break;
			case gl.LINES:
				step = capacity - (capacity % 2);
				break;
			case gl.LINE_STRIP:
				overlap = 1;
				break;
			case gl.LINE_LOOP:
				// chunks are open strips; the loop is closed explicitly below
				overlap = 1;
				drawMode = gl.LINE_STRIP;
				break;
			case gl.TRIANGLE_STRIP:
				overlap = 2;
				break;
			case gl.TRIANGLE_FAN:
				overlap = 1;
				anchor = true;
				break;
			default:
				// POINTS: any split works
				break;
		}
		this.mode = drawMode;

		let start = 0;
		while (start < vertexCount) {
			// each chunk starts on an empty buffer
			this.flush(drawMode);
			const anchored = anchor && start > 0;
			if (anchored) {
				this.#pushRange(verts, 0, 1, colorUint32, z);
			}
			const count = Math.min(vertexCount - start, step - (anchored ? 1 : 0));
			this.#pushRange(verts, start, start + count, colorUint32, z);
			start += count;
			if (start < vertexCount) {
				start -= overlap;
			}
		}

		if (mode === gl.LINE_LOOP) {
			// close the loop: duplicate the first vertex after the last one
			if (this.vertexData.isFull(1)) {
				this.flush(drawMode);
				this.#pushRange(verts, vertexCount - 1, vertexCount, colorUint32, z);
			}
			this.#pushRange(verts, 0, 1, colorUint32, z);
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
		// switch to TRIANGLES mode, then delegate the expansion to the
		// shared neutral helper — see `gpu/primitives.ts`
		if (this.mode !== this.gl.TRIANGLES) {
			this.flush(this.mode);
			this.mode = this.gl.TRIANGLES;
		}
		expandLinesToTriangles(
			this.vertexData,
			this.viewMatrix,
			verts,
			vertexCount,
			this.renderer.currentColor.toUint32(this.renderer.getGlobalAlpha()),
			// z = current renderer depth (Renderable.preDraw); a no-op under
			// ortho, consumed by perspective (Camera3d)
			this.renderer.currentDepth,
			() => {
				this.flush();
			},
		);
	}
}
