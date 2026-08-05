/**
 * The versioned-remap vertex dedup shared by the mesh batchers of both
 * backends — pure CPU code, no GPU references (the `lighting/` modules set
 * the precedent for cross-backend sharing).
 *
 * The accumulated mesh path re-indexes each chunk's triangles against a
 * chunk-local vertex range. Dedup uses a "versioned" typed-array remap
 * rather than a `Map`: a `Map` here churned the GC badly, because V8's
 * `Map.clear()` drops the backing table, so re-filling it each chunk
 * reallocated as it grew — and the cost scaled with vertex count (a dense
 * mesh = MBs/sec of garbage). Instead, `remapSlot[orig]` holds the local
 * index assigned to original-vertex `orig` THIS chunk, valid only when
 * `remapStamp[orig] === stamp`. Bumping `stamp` per chunk invalidates every
 * entry in O(1) — no clearing, no allocation. The arrays grow lazily (to a
 * power of two ≥ the largest mesh's vertex count) and are reused.
 *
 * Module-level sharing is safe because a chunk is built synchronously and
 * never re-enters — only one `addMesh` runs at a time, whichever backend
 * (or coexisting renderer) drives it, and no remap state persists across
 * chunks.
 * @ignore
 */

let remapSlot = new Int32Array(0);
let remapStamp = new Int32Array(0);
let stamp = 0;
const chunkIndices: number[] = [];

/**
 * Ensure the versioned-remap scratch arrays can index every vertex of a
 * mesh with `vertexCount` vertices. Grows to the next power of two and
 * reuses thereafter (one-time cost when a larger mesh first appears).
 * @ignore
 */
export function ensureRemapCapacity(vertexCount: number): void {
	if (remapSlot.length >= vertexCount) {
		return;
	}
	// next power of two ≥ vertexCount (Math.clz32 → leading-zero count)
	const cap = vertexCount <= 1 ? 1 : 1 << (32 - Math.clz32(vertexCount - 1));
	remapSlot = new Int32Array(cap);
	remapStamp = new Int32Array(cap); // zero-filled; stamp is always ≥ 1 in use
}

/**
 * Start a new chunk: invalidate the whole remap in O(1) and hand back the
 * shared (emptied) chunk-index list. The stamp resets before int32 overflow
 * (~weeks of continuous rendering away), keeping stored stamps valid.
 * @returns the shared chunk-index array, emptied
 * @ignore
 */
export function beginChunk(): number[] {
	if (stamp >= 0x7fffffff) {
		remapStamp.fill(0);
		stamp = 0;
	}
	stamp++;
	chunkIndices.length = 0;
	return chunkIndices;
}

/**
 * The local index assigned to `origIdx` this chunk, or -1 when the vertex
 * has not been emitted yet.
 * @ignore
 */
export function remapIndex(origIdx: number): number {
	return remapStamp[origIdx] === stamp ? remapSlot[origIdx] : -1;
}

/**
 * Record the local index assigned to `origIdx` for the rest of this chunk.
 * @ignore
 */
export function assignIndex(origIdx: number, localIdx: number): void {
	remapStamp[origIdx] = stamp;
	remapSlot[origIdx] = localIdx;
}
