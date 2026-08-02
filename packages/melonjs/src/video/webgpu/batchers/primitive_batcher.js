import WebGPUBatcher from "./webgpu_batcher.js";

/**
 * additional import for TypeScript
 * @import {Point} from "./../../../geometries/point.ts";
 */

/**
 * The WebGPU primitive batcher — shape geometry accumulation with the same
 * frozen 24-byte vertex layout and CPU tessellation as the WebGL
 * `PrimitiveBatcher`, addressed purely in the portable topology vocabulary.
 *
 * `uLineWidth` lives in the shared frame-globals uniform block: a width
 * change flushes pending vertices and pushes a fresh dynamic-offset slot,
 * replacing the per-program uniform of the GL backend.
 *
 * The two non-portable engine topologies are emulated in this front end,
 * as `PORTABLE_TOPOLOGIES` documents: `"line-loop"` draws as a strip with
 * an explicit closing vertex, `"triangle-fan"` re-expands on the CPU into
 * a triangle list. No engine path emits either — they only serve direct
 * user calls.
 * @augments WebGPUBatcher
 * @category Rendering
 */
export default class WebGPUPrimitiveBatcher extends WebGPUBatcher {
	/**
	 * @param {import("../webgpu_renderer.js").default} renderer - the owning renderer
	 * @override
	 */
	init(renderer, settings) {
		super.init(
			renderer,
			settings ?? {
				shaderKey: "primitive",
				topology: "triangle-list",
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
			},
		);
	}

	/**
	 * Draw an array of vertices with the given topology.
	 * @param {string} topology - portable topology name ("point-list", "line-list", "line-strip", "triangle-list", "triangle-strip"; "line-loop" and "triangle-fan" are emulated)
	 * @param {Point[]} verts - an array of vertices
	 * @param {number} [vertexCount=verts.length] - amount of points defined in the points array
	 */
	drawVertices(topology, verts, vertexCount = verts.length) {
		const renderer = this.renderer;
		const lineWidth = renderer.lineWidth;

		// the line width rides in the frame-globals block — a change means
		// pending vertices drain under the old slot, then a new slot is
		// pushed for everything after. Compared against the value the
		// CURRENT slot was written with (not a batcher-local cache):
		// clear() rewrites the slot with lineWidth = 1 every frame, so a
		// local cache goes stale across frames
		if (lineWidth !== renderer.currentFrameLineWidth) {
			this.flush(this.topology);
			renderer.pushFrameGlobals();
		}

		// expand thick lines to triangles with normals for shader-based
		// expansion
		if (topology === "line-list" && lineWidth > 1) {
			this.#expandLinesToTriangles(verts, vertexCount);
			return;
		}

		// emulate the non-portable topologies before anything batches
		if (topology === "triangle-fan") {
			this.#drawTriangleFan(verts, vertexCount);
			return;
		}
		const closeLoop = topology === "line-loop";
		if (closeLoop) {
			topology = "line-strip";
		}

		const vertexData = this.vertexData;
		const alpha = renderer.getGlobalAlpha();
		const colorUint32 = renderer.currentColor.toUint32(alpha);
		// z = current renderer depth (Renderable.preDraw); a no-op under
		// ortho, consumed by perspective (Camera3d)
		const z = renderer.currentDepth;

		// flush if drawing vertices with a different topology
		if (topology !== this.topology) {
			this.flush(this.topology);
			this.topology = topology;
		}

		if (vertexCount < vertexData.maxVertex) {
			// fast path: the shape fits in one batch
			if (vertexData.isFull(vertexCount + (closeLoop ? 1 : 0))) {
				this.flush();
			}
			this.#pushRange(verts, 0, vertexCount, colorUint32, z);
			if (closeLoop) {
				// close the loop: duplicate the first vertex after the last
				this.#pushRange(verts, 0, 1, colorUint32, z);
			}
		} else {
			// a single shape larger than the whole vertex buffer — split it
			// into buffer-sized chunks on primitive boundaries
			this.#drawVerticesChunked(
				closeLoop ? "line-loop" : topology,
				verts,
				vertexCount,
				colorUint32,
				z,
			);
		}

		// strips must not concatenate across shapes
		if (this.topology === "line-strip" || this.topology === "triangle-strip") {
			this.flush(this.topology);
		}
	}

	/**
	 * CPU re-expansion of a triangle fan into a triangle list
	 * @ignore
	 */
	#drawTriangleFan(verts, vertexCount) {
		const renderer = this.renderer;
		const vertexData = this.vertexData;
		const colorUint32 = renderer.currentColor.toUint32(
			renderer.getGlobalAlpha(),
		);
		const z = renderer.currentDepth;

		if (this.topology !== "triangle-list") {
			this.flush(this.topology);
			this.topology = "triangle-list";
		}
		for (let i = 1; i < vertexCount - 1; i++) {
			if (vertexData.isFull(3)) {
				this.flush();
			}
			this.#pushRange(verts, 0, 1, colorUint32, z);
			this.#pushRange(verts, i, i + 2, colorUint32, z);
		}
	}

	/**
	 * Push `verts[start..end)` into the vertex buffer, transformed by the
	 * current view matrix. The caller guarantees the range fits.
	 * @ignore
	 */
	#pushRange(verts, start, end, colorUint32, z) {
		const viewMatrix = this.renderer.currentTransform;
		const vertexData = this.vertexData;
		if (!viewMatrix.isIdentity()) {
			// full 3D transform including the z column so Camera3d's view
			// matrix (X/Y-axis rotation) actually rotates the primitive
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
	 * Draw an over-capacity vertex list as a sequence of buffer-sized
	 * chunks, split on primitive boundaries so every triangle/line stays
	 * whole (same boundary rules as the WebGL batcher).
	 * @ignore
	 */
	#drawVerticesChunked(topology, verts, vertexCount, colorUint32, z) {
		// stay one below maxVertex to match isFull()'s `>=` convention
		const capacity = this.vertexData.maxVertex - 1;
		let step = capacity;
		let overlap = 0;
		let drawTopology = topology;
		switch (topology) {
			case "triangle-list":
				step = capacity - (capacity % 3);
				break;
			case "line-list":
				step = capacity - (capacity % 2);
				break;
			case "line-strip":
				overlap = 1;
				break;
			case "line-loop":
				// chunks are open strips; the loop is closed explicitly below
				overlap = 1;
				drawTopology = "line-strip";
				break;
			case "triangle-strip":
				overlap = 2;
				break;
			default:
				// point-list: any split works. "triangle-fan" never reaches
				// here — #drawTriangleFan re-expands with per-triangle
				// capacity checks, so fans self-chunk
				break;
		}
		this.topology = drawTopology;

		let start = 0;
		while (start < vertexCount) {
			// each chunk starts on an empty buffer
			this.flush(drawTopology);
			const count = Math.min(vertexCount - start, step);
			this.#pushRange(verts, start, start + count, colorUint32, z);
			start += count;
			if (start < vertexCount) {
				start -= overlap;
			}
		}

		if (topology === "line-loop") {
			// close the loop: duplicate the first vertex after the last one
			if (this.vertexData.isFull(1)) {
				this.flush(drawTopology);
				this.#pushRange(verts, vertexCount - 1, vertexCount, colorUint32, z);
			}
			this.#pushRange(verts, 0, 1, colorUint32, z);
		}
	}

	/**
	 * Expand line pairs into triangles with perpendicular normals.
	 * The vertex shader offsets each vertex by aNormal * uLineWidth * 0.5,
	 * producing thick lines without geometry expansion in the renderer.
	 * @param {Point[]} verts - line vertices in pairs [from, to, from, to, ...]
	 * @param {number} vertexCount - number of vertices
	 * @ignore
	 */
	#expandLinesToTriangles(verts, vertexCount) {
		const renderer = this.renderer;
		const viewMatrix = renderer.currentTransform;
		const vertexData = this.vertexData;
		const colorUint32 = renderer.currentColor.toUint32(
			renderer.getGlobalAlpha(),
		);
		const hasTransform = !viewMatrix.isIdentity();
		const z = renderer.currentDepth;

		// switch to triangle-list topology
		if (this.topology !== "triangle-list") {
			this.flush(this.topology);
			this.topology = "triangle-list";
		}

		const m = hasTransform ? viewMatrix.val : null;

		for (let i = 0; i < vertexCount; i += 2) {
			const from = verts[i];
			const to = verts[i + 1];

			// each line pair expands to 2 triangles (6 vertices) — check
			// capacity per pair so an over-capacity path flushes mid-shape
			// instead of silently dropping writes
			if (vertexData.isFull(6)) {
				this.flush();
			}

			// apply the view matrix (z column included) without mutating
			// the inputs. The perpendicular normal stays in pre-projection
			// space — same known limitation as the GL backend.
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
			vertexData.push(fromX, fromY, fromZ, nx, ny, colorUint32);
			vertexData.push(fromX, fromY, fromZ, -nx, -ny, colorUint32);
			vertexData.push(toX, toY, toZ, -nx, -ny, colorUint32);

			vertexData.push(fromX, fromY, fromZ, nx, ny, colorUint32);
			vertexData.push(toX, toY, toZ, -nx, -ny, colorUint32);
			vertexData.push(toX, toY, toZ, nx, ny, colorUint32);
		}
	}
}
