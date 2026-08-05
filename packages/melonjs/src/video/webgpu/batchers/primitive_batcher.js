import {
	expandLinesToTriangles,
	pushPrimitiveRange,
} from "../../gpu/primitives.ts";
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
		// the shared neutral range push (z-column-aware transform) — one
		// copy for both backends, see `gpu/primitives.ts`
		pushPrimitiveRange(
			this.vertexData,
			this.renderer.currentTransform,
			verts,
			start,
			end,
			colorUint32,
			z,
		);
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
		// switch to triangle-list topology, then delegate the expansion to
		// the shared neutral helper — see `gpu/primitives.ts`
		if (this.topology !== "triangle-list") {
			this.flush(this.topology);
			this.topology = "triangle-list";
		}
		const renderer = this.renderer;
		expandLinesToTriangles(
			this.vertexData,
			renderer.currentTransform,
			verts,
			vertexCount,
			renderer.currentColor.toUint32(renderer.getGlobalAlpha()),
			renderer.currentDepth,
			() => {
				this.flush();
			},
		);
	}
}
