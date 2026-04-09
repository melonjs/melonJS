import { Vector2d } from "../../../math/vector2d.ts";
import meshFragment from "./../shaders/mesh.frag";
import meshVertex from "./../shaders/mesh.vert";
import { MaterialBatcher } from "./material_batcher.js";

// reusable vector for vertex transform
const _v = new Vector2d();

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
	 * Add a textured mesh to the batch
	 * @param {object} mesh - a Mesh object with vertices, uvs, indices, and texture properties
	 * @param {number} tint - tint color in UINT32 (argb) format
	 */
	addMesh(mesh, tint) {
		const vertices = mesh.vertices;
		const uvs = mesh.uvs;
		const indices = mesh.indices;

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

					vertexData.pushMesh(x, y, z, uvs[i2], uvs[i2 + 1], tint);
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
