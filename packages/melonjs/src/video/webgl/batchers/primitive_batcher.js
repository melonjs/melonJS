import primitiveFragment from "./../shaders/primitive.frag";
import primitiveVertex from "./../shaders/primitive.vert";
import { Batcher } from "./batcher.js";

/**
 * additional import for TypeScript
 * @import {Point} from "./../../../geometries/point.ts";
 */

/**
 * A WebGL Compositor object. This class handles all of the WebGL state<br>
 * Pushes texture regions or shape geometry into WebGL buffers, automatically flushes to GPU
 * @category Rendering
 */
export default class PrimitiveBatcher extends Batcher {
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
					size: 3,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 0 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aNormal",
					size: 2,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 3 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aColor",
					size: 4,
					type: renderer.gl.UNSIGNED_BYTE,
					normalized: true,
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
		const viewMatrix = this.viewMatrix;
		const vertexData = this.vertexData;
		if (!viewMatrix.isIdentity()) {
			// Full 3D transform including the z column (m[8] / m[9] /
			// m[10] / m[14]) so Camera3d's view matrix (X/Y-axis
			// rotation) actually rotates the primitive in 3D. For 2D
			// matrices those slots are identity, so output (x, y, z)
			// is bit-identical to the legacy 2D-only multiply.
			const m = viewMatrix.val;
			for (let i = start; i < end; i++) {
				const vert = verts[i];
				const x = vert.x;
				const y = vert.y;
				vertexData.push(
					x * m[0] + y * m[4] + z * m[8] + m[12],
					x * m[1] + y * m[5] + z * m[9] + m[13],
					x * m[2] + y * m[6] + z * m[10] + m[14],
					0,
					0,
					colorUint32,
				);
			}
		} else {
			for (let i = start; i < end; i++) {
				const vert = verts[i];
				vertexData.push(vert.x, vert.y, z, 0, 0, colorUint32);
			}
		}
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
		const viewMatrix = this.viewMatrix;
		const vertexData = this.vertexData;
		const alpha = this.renderer.getGlobalAlpha();
		const colorUint32 = this.renderer.currentColor.toUint32(alpha);
		const hasTransform = !viewMatrix.isIdentity();
		// z = current renderer depth (Renderable.preDraw); a no-op under ortho,
		// consumed by perspective (Camera3d).
		const z = this.renderer.currentDepth;

		// switch to TRIANGLES mode
		if (this.mode !== this.gl.TRIANGLES) {
			this.flush(this.mode);
			this.mode = this.gl.TRIANGLES;
		}

		const m = hasTransform ? viewMatrix.val : null;

		for (let i = 0; i < vertexCount; i += 2) {
			const from = verts[i];
			const to = verts[i + 1];

			// each line pair expands to 2 triangles (6 vertices) — check
			// capacity per pair, so a dashed/long thick-line path larger than
			// the whole buffer flushes mid-shape instead of silently dropping
			// the out-of-range writes (pairs are independent quads, so a
			// mid-shape flush is invisible)
			if (vertexData.isFull(6)) {
				this.flush();
			}

			// apply view matrix to base positions without mutating
			// inputs. Includes the z column for parity with the simple-
			// line path and Vector3d quad batcher — Camera3d's view
			// matrix needs depth-aware rotation. Note: the perpendicular
			// normal is still computed in pre-projection world space,
			// which appears non-perpendicular under perspective — known
			// limitation, separate from the Vector3d migration.
			let fromX, fromY, fromZ, toX, toY, toZ;
			if (hasTransform) {
				fromX = from.x * m[0] + from.y * m[4] + z * m[8] + m[12];
				fromY = from.x * m[1] + from.y * m[5] + z * m[9] + m[13];
				fromZ = from.x * m[2] + from.y * m[6] + z * m[10] + m[14];
				toX = to.x * m[0] + to.y * m[4] + z * m[8] + m[12];
				toY = to.x * m[1] + to.y * m[5] + z * m[9] + m[13];
				toZ = to.x * m[2] + to.y * m[6] + z * m[10] + m[14];
			} else {
				fromX = from.x;
				fromY = from.y;
				fromZ = z;
				toX = to.x;
				toY = to.y;
				toZ = z;
			}

			// compute perpendicular unit normal
			const dx = toX - fromX;
			const dy = toY - fromY;
			const len = Math.sqrt(dx * dx + dy * dy);

			if (len === 0) {
				continue;
			}

			const nx = -dy / len;
			const ny = dx / len;

			// two triangles forming a quad around the line segment
			// triangle 1: from+n, from-n, to-n
			vertexData.push(fromX, fromY, fromZ, nx, ny, colorUint32);
			vertexData.push(fromX, fromY, fromZ, -nx, -ny, colorUint32);
			vertexData.push(toX, toY, toZ, -nx, -ny, colorUint32);

			// triangle 2: from+n, to-n, to+n
			vertexData.push(fromX, fromY, fromZ, nx, ny, colorUint32);
			vertexData.push(toX, toY, toZ, -nx, -ny, colorUint32);
			vertexData.push(toX, toY, toZ, nx, ny, colorUint32);
		}
	}
}
