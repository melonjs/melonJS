import { Vector2d } from "../../../math/vector2d.ts";
import meshFragment from "./../shaders/mesh.frag";
import meshVertex from "./../shaders/mesh.vert";
import { MaterialBatcher } from "./material_batcher.js";

// reusable vector for vertex transform
const _v = new Vector2d();

/**
 * Per-channel multiply two ARGB-packed Uint32 colors. Used by the
 * multi-material mesh path to combine a vertex's baked material color
 * (`mesh.vertexColors[i]`) with the runtime `mesh.tint` before
 * pushing the result as the vertex's `aColor` attribute.
 * Layout (MSB→LSB): A R G B, matching `Color.toUint32`.
 * @param {number} a - first ARGB packed Uint32
 * @param {number} b - second ARGB packed Uint32
 * @returns {number} their per-channel product (normalized in 0..255)
 * @ignore
 */
function mulPackedARGB(a, b) {
	const aa = (a >>> 24) & 0xff;
	const ar = (a >>> 16) & 0xff;
	const ag = (a >>> 8) & 0xff;
	const ab = a & 0xff;
	const ba = (b >>> 24) & 0xff;
	const br = (b >>> 16) & 0xff;
	const bg = (b >>> 8) & 0xff;
	const bb = b & 0xff;
	const cr = ((ar * br) / 255) | 0;
	const cg = ((ag * bg) / 255) | 0;
	const cb = ((ab * bb) / 255) | 0;
	const ca = ((aa * ba) / 255) | 0;
	return ((ca << 24) | (cr << 16) | (cg << 8) | cb) >>> 0;
}

/**
 * A WebGL Batcher for rendering textured triangle meshes.
 * Uses indexed drawing to efficiently render arbitrary triangle geometry.
 * @category Rendering
 */
export default class MeshBatcher extends MaterialBatcher {
	/**
	 * Initialize the mesh batcher
	 * @ignore
	 */
	init(renderer) {
		super.init(renderer, {
			attributes: [
				{
					name: "aVertex",
					size: 3,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 0 * Float32Array.BYTES_PER_ELEMENT,
				},
				{
					name: "aRegion",
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
				vertex: meshVertex,
				fragment: meshFragment,
			},
			indexed: true,
		});
	}

	/**
	 * Add a textured mesh to the batch. When the mesh has a
	 * `vertexColors` array (multi-material OBJ + bound MTL), each
	 * vertex's `aColor` attribute comes from that buffer instead of
	 * the shared `tint` argument — so the mesh batches in a single
	 * draw call with per-material colors baked into the vertex stream.
	 * The `tint` argument is then multiplied per-vertex in the shader,
	 * preserving runtime flash / fade / team-color effects.
	 * @param {object} mesh - a Mesh object with vertices, uvs, indices, and texture properties
	 * @param {number} tint - tint color in UINT32 (argb) format
	 */
	addMesh(mesh, tint) {
		const vertices = mesh.vertices;
		const uvs = mesh.uvs;
		const indices = mesh.indices;
		const vertexColors = mesh.vertexColors;

		// upload and activate the texture
		const unit = this.uploadTexture(mesh.texture);
		if (unit !== this.currentSamplerUnit) {
			this.currentShader.setUniform("uSampler", unit);
			this.currentSamplerUnit = unit;
		}

		const m = this.viewMatrix;
		const isIdentity = m.isIdentity();
		const maxVerts = this.vertexData.maxVertex;
		const maxIndices = this.indexBuffer.data.length;

		// process triangles in chunks that fit the buffer
		let triIdx = 0;
		while (triIdx < indices.length) {
			// figure out how many triangles fit in the current batch
			const vertexData = this.vertexData;
			const availVerts = maxVerts - vertexData.vertexCount;
			const availIndices = maxIndices - this.indexBuffer.length;
			// each triangle needs at most 3 new vertices and 3 indices
			const maxTris = Math.min(
				Math.floor(availVerts / 3),
				Math.floor(availIndices / 3),
			);

			if (maxTris === 0) {
				this.flush();
				continue;
			}

			const endIdx = Math.min(triIdx + maxTris * 3, indices.length);

			// build a local vertex remap for this chunk
			// capture base offset before pushing any vertices
			const baseOffset = vertexData.vertexCount;
			const remap = new Map();
			const chunkIndices = [];
			let localCount = 0;

			for (let j = triIdx; j < endIdx; j++) {
				const origIdx = indices[j];
				let localIdx = remap.get(origIdx);
				if (localIdx === undefined) {
					localIdx = localCount++;
					remap.set(origIdx, localIdx);

					const i3 = origIdx * 3;
					const i2 = origIdx * 2;
					let x = vertices[i3];
					let y = vertices[i3 + 1];
					const z = vertices[i3 + 2];

					if (!isIdentity) {
						_v.set(x, y);
						m.apply(_v);
						x = _v.x;
						y = _v.y;
					}

					// per-vertex color when the mesh provides one
					// (multi-material baked colors), modulated by the
					// runtime `tint` so flash / fade / team color via
					// `setTint` still works on top of the baked palette.
					// Single-material meshes (no `vertexColors`) fall
					// back to the shared `tint` for every vertex.
					const vertColor = vertexColors
						? mulPackedARGB(vertexColors[origIdx], tint)
						: tint;
					vertexData.pushMesh(x, y, z, uvs[i2], uvs[i2 + 1], vertColor);
				}
				// absolute index = baseOffset + localIdx
				chunkIndices.push(baseOffset + localIdx);
			}

			// add raw indices (already absolute, bypass rebasing)
			this.indexBuffer.addRaw(chunkIndices);
			triIdx = endIdx;
		}
	}
}
