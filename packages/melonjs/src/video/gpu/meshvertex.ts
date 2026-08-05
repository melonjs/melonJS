/**
 * Retained mesh vertex-data assembly shared by the mesh batchers of both
 * backends — pure CPU code, no GPU references (the `meshchunk.ts` /
 * `lighting/` precedent). Kept in ONE place because the two layouts exist
 * in an unlit and a lit variant on each backend, and the subtle parts —
 * the ARGB unpack order and the lit path's zero-length-normal guard —
 * must never drift between the four call sites.
 *
 * The data deliberately carries no placement, camera or tint information —
 * those are uniforms — so it stays valid for the lifetime of the geometry.
 * @ignore
 */

/** the minimal mesh surface this module reads — `@ignore` */
interface RetainedMeshSource {
	originalVertices: Float32Array;
	originalNormals?: Float32Array | null;
	uvs: Float32Array;
	vertexColors?: Uint32Array | null;
	vertexCount: number;
}

// Growable scratch for assembling a mesh's interleaved vertex data before
// it is uploaded to its retained buffers. Module-level sharing is safe:
// building is synchronous and never re-enters, whichever backend (or
// coexisting renderer) drives it, so a rebuild allocates nothing
// steady-state.
let buildScratch = new Float32Array(0);

/**
 * a reusable Float32Array of at least `floatCount` floats
 * @ignore
 */
export function retainedScratch(floatCount: number): Float32Array {
	if (buildScratch.length < floatCount) {
		buildScratch = new Float32Array(floatCount);
	}
	return buildScratch;
}

/**
 * Write one mesh's model-space geometry into `out` in the unlit mesh
 * layout — `x, y, z, u, v, r, g, b, a` — striding by `vertexSize`.
 * @param mesh - the mesh to read geometry from
 * @param out - destination scratch, at least `vertexCount × vertexSize` long
 * @param vertexSize - floats per vertex in the hosting batcher's layout
 * @returns number of floats written
 * @ignore
 */
export function buildMeshVertexData(
	mesh: RetainedMeshSource,
	out: Float32Array,
	vertexSize: number,
): number {
	const vertices = mesh.originalVertices;
	const uvs = mesh.uvs;
	const colors = mesh.vertexColors;
	const count = mesh.vertexCount;
	let o = 0;
	for (let i = 0; i < count; i++) {
		const i3 = i * 3;
		const i2 = i * 2;
		const c = colors ? colors[i] : 0xffffffff;
		out[o] = vertices[i3];
		out[o + 1] = vertices[i3 + 1];
		out[o + 2] = vertices[i3 + 2];
		out[o + 3] = uvs[i2];
		out[o + 4] = uvs[i2 + 1];
		out[o + 5] = ((c >> 16) & 0xff) / 255;
		out[o + 6] = ((c >> 8) & 0xff) / 255;
		out[o + 7] = (c & 0xff) / 255;
		out[o + 8] = ((c >>> 24) & 0xff) / 255;
		o += vertexSize;
	}
	return o;
}

/**
 * The lit variant: the unlit layout plus the model-space normal —
 * `…, nx, ny, nz` — so lighting can be evaluated after the shader rotates
 * it into world space.
 *
 * A zero-length normal must not reach the shader: it does
 * `normalize(vNormal)`, and normalizing a zero vector is NaN — every
 * fragment touching that vertex goes black or garbage. Degenerate
 * triangles in OBJ/glTF assets produce these, so substitute a unit
 * vector, matching what the CPU projection path does.
 * @param mesh - the mesh to read geometry from
 * @param out - destination scratch, at least `vertexCount × vertexSize` long
 * @param vertexSize - floats per vertex in the hosting batcher's layout
 * @returns number of floats written
 * @ignore
 */
export function buildLitMeshVertexData(
	mesh: RetainedMeshSource,
	out: Float32Array,
	vertexSize: number,
): number {
	const vertices = mesh.originalVertices;
	const normals = mesh.originalNormals;
	const uvs = mesh.uvs;
	const colors = mesh.vertexColors;
	const count = mesh.vertexCount;
	let o = 0;
	for (let i = 0; i < count; i++) {
		const i3 = i * 3;
		const i2 = i * 2;
		const c = colors ? colors[i] : 0xffffffff;
		out[o] = vertices[i3];
		out[o + 1] = vertices[i3 + 1];
		out[o + 2] = vertices[i3 + 2];
		out[o + 3] = uvs[i2];
		out[o + 4] = uvs[i2 + 1];
		out[o + 5] = ((c >> 16) & 0xff) / 255;
		out[o + 6] = ((c >> 8) & 0xff) / 255;
		out[o + 7] = (c & 0xff) / 255;
		out[o + 8] = ((c >>> 24) & 0xff) / 255;
		const nx = normals ? normals[i3] : 0;
		const ny = normals ? normals[i3 + 1] : 0;
		const nz = normals ? normals[i3 + 2] : 0;
		if (nx * nx + ny * ny + nz * nz > 1e-16) {
			out[o + 9] = nx;
			out[o + 10] = ny;
			out[o + 11] = nz;
		} else {
			out[o + 9] = 0;
			out[o + 10] = 1;
			out[o + 11] = 0;
		}
		o += vertexSize;
	}
	return o;
}
