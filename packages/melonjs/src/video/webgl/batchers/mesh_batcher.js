import { Vector3d } from "../../../math/vector3d.ts";
import { off, on, RENDER_TARGET_CHANGED } from "../../../system/event.ts";
import meshFragment from "./../shaders/mesh.frag";
import meshVertex from "./../shaders/mesh.vert";
import { MaterialBatcher } from "./material_batcher.js";

// reusable vector for vertex transform
// Vector3d (not Vector2d) so the mesh's per-vertex z survives the
// transform under Camera3d — for 2D-only view matrices the z column is
// identity, so output (x, y) matches the legacy Vector2d path.
const _v = new Vector3d();

// Reused scratch for addMesh's per-chunk vertex dedup and absolute index list
// (`_chunkIndices`), so a chunk allocates nothing per mesh per frame (GC
// pressure on the draw path). Safe because addMesh runs synchronously and never
// re-enters (flush() only draws). Shared by MeshBatcher and LitMeshBatcher —
// only one addMesh runs at a time.
//
// Dedup uses a "versioned" typed-array remap rather than a `Map`: a `Map` here
// churned the GC badly, because V8's `Map.clear()` drops the backing table, so
// re-filling it each chunk reallocated as it grew — and the cost scaled with
// vertex count (a dense mesh = MBs/sec of garbage). Instead, `_remapSlot[orig]`
// holds the local index assigned to original-vertex `orig` THIS chunk, valid
// only when `_remapStamp[orig] === _stamp`. Bumping `_stamp` per chunk
// invalidates every entry in O(1) — no clearing, no allocation. The arrays grow
// lazily (to a power of two ≥ the largest mesh's vertex count) and are reused.
let _remapSlot = new Int32Array(0);
let _remapStamp = new Int32Array(0);
let _stamp = 0;
const _chunkIndices = [];

/**
 * Ensure the versioned-remap scratch arrays can index every vertex of a mesh
 * with `vertexCount` vertices. Grows to the next power of two and reuses
 * thereafter (one-time cost when a larger mesh first appears).
 * @ignore
 */
function ensureRemapCapacity(vertexCount) {
	if (_remapSlot.length >= vertexCount) {
		return;
	}
	// next power of two ≥ vertexCount (Math.clz32 → leading-zero count)
	const cap = vertexCount <= 1 ? 1 : 1 << (32 - Math.clz32(vertexCount - 1));
	_remapSlot = new Int32Array(cap);
	_remapStamp = new Int32Array(cap); // zero-filled; _stamp is always ≥ 1 in use
}

// Shared lazy-depth-clear state for the mesh-mode pass. Module-level (not
// per-instance) so the unlit `MeshBatcher` and the `LitMeshBatcher` — which
// extends it and inherits `bind()` — coordinate on a SINGLE depth clear per
// target. If each kept its own flag, switching between the two mid-frame would
// re-clear the shared depth buffer and break inter-mesh occlusion. The first
// `bind()` of either clears + marks clean; `RENDER_TARGET_CHANGED` re-arms it.
let _meshDepthDirty = true;

// shared zero emissive, passed to the shader when a mesh has no emission so the
// `uEmissive` add is a no-op. Never mutated.
const _ZERO_EMISSIVE = new Float32Array(3);

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
 *
 * Owns mesh-mode GL state ownership (since 19.7 / #1468):
 *
 * - {@link MeshBatcher#bind} enters mesh mode — enables `DEPTH_TEST` +
 *   `LEQUAL` + `depthMask`, disables `BLEND`, and runs a one-shot
 *   `clearDepth(1.0) + clear(DEPTH_BUFFER_BIT)` if the active target's
 *   depth attachment is still dirty. Subsequent mesh draws against the
 *   same target rely on the accumulated depth buffer.
 * - {@link MeshBatcher#unbind} exits mesh mode — restores non-mesh
 *   defaults (`BLEND` on, `DEPTH_TEST` off, `depthMask` false) that the
 *   2D rendering paths assume.
 * - Subscribes to {@link event.RENDER_TARGET_CHANGED} (emitted by the
 *   renderer at frame-start `clear()`, non-camera FBO bind, post-effect
 *   FBO unbind) to re-arm the lazy depth clear whenever the active
 *   framebuffer's attachments change identity.
 *
 * The WebGLRenderer doesn't know any of this — `setBatcher("mesh")` calls
 * `bind()` and the batcher sets up its own pass. Same lifecycle ports
 * cleanly to a future WebGPU renderer: `bind()` becomes "begin a
 * depth-enabled `RenderPassEncoder`", `unbind()` ends it.
 * @category Rendering
 */
export default class MeshBatcher extends MaterialBatcher {
	/**
	 * Initialize the mesh batcher
	 * @ignore
	 */
	init(renderer) {
		super.init(renderer, {
			attributes: this._attributeLayout(renderer),
			shader: this._shaderSources(),
			indexed: true,
		});

		// last `uAlphaCutoff` value pushed to the current shader, so consecutive
		// meshes sharing a cutoff don't re-issue the uniform. -1 is an impossible
		// cutoff (valid range 0..1), forcing the first mesh of a pass to set it.
		this.currentAlphaCutoff = -1;

		// last `uEmissive` value pushed (per channel), same redundant-set guard.
		// -1 is an impossible emissive (valid range 0..∞), forcing the first set.
		this.currentEmissiveR = -1;
		this.currentEmissiveG = -1;
		this.currentEmissiveB = -1;

		// Subscribe to the renderer's target-changed broadcast so we re-arm the
		// shared lazy depth clear (`_meshDepthDirty`) whenever the active
		// framebuffer's attachments change identity (FBO bind/unbind for
		// post-effects, frame-start `clear()`). Same pattern as
		// `MaterialBatcher`'s `GPU_TEXTURE_CACHE_RESET` subscription — only
		// batchers that care subscribe.
		if (!this._onTargetChanged) {
			this._onTargetChanged = () => {
				_meshDepthDirty = true;
			};
			on(RENDER_TARGET_CHANGED, this._onTargetChanged);
		}
	}

	/**
	 * The vertex attribute layout. The base (unlit) mesh batcher is
	 * `aVertex` (3) + `aRegion` (2) + `aColor` (4) = 9 floats. Subclasses
	 * (e.g. {@link LitMeshBatcher}) append their own attributes.
	 * @ignore
	 */
	_attributeLayout(renderer) {
		return [
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
				// aColor: 4 normalized floats (R, G, B, A in [0, 1]) rather
				// than packed 4×UNSIGNED_BYTE. The byte-packed path is
				// byte-identical in memory but exposes the 4-byte slot to
				// NaN-pattern bit values when the alpha byte is 0xFF and the
				// red byte has its high bit set (R≥0x80) — a NaN-pattern that
				// Apple's Metal-backed WebGL driver canonicalizes on some
				// upload paths, zeroing the bytes the shader reads. The float
				// path uses values in [0, 1] which never form NaN bit patterns.
				name: "aColor",
				size: 4,
				type: renderer.gl.FLOAT,
				normalized: false,
				offset: 5 * Float32Array.BYTES_PER_ELEMENT,
			},
		];
	}

	/**
	 * The shader sources for this batcher (unlit by default). Subclasses
	 * override to supply a lit shader.
	 * @ignore
	 */
	_shaderSources() {
		return { vertex: meshVertex, fragment: meshFragment };
	}

	/**
	 * Invalidate the per-mesh `uAlphaCutoff` / `uEmissive` caches when the bound
	 * shader (GL program) changes — the new program's uniforms are at their own
	 * defaults, so the next mesh must re-issue them rather than trust the cache.
	 * Mirrors the base batcher's `currentSamplerUnit` reset (same condition), and
	 * matters when a custom mesh shader declaring those uniforms is interleaved
	 * with the built-in one on this batcher (e.g. `drawMesh` swapping a custom
	 * shader in and back out).
	 * @ignore
	 */
	useShader(shader) {
		if (
			this.currentShader !== shader ||
			this.renderer.currentProgram !== shader.program
		) {
			this.currentAlphaCutoff = -1;
			this.currentEmissiveR = -1;
			this.currentEmissiveG = -1;
			this.currentEmissiveB = -1;
		}
		super.useShader(shader);
	}

	/**
	 * Unsubscribe the `RENDER_TARGET_CHANGED` listener so a discarded
	 * batcher doesn't keep getting notified (relevant on context loss /
	 * renderer teardown). Delegates to `MaterialBatcher.destroy()` for
	 * the texture-cache-reset listener.
	 * @ignore
	 */
	destroy() {
		if (this._onTargetChanged) {
			off(RENDER_TARGET_CHANGED, this._onTargetChanged);
			this._onTargetChanged = null;
		}
		super.destroy();
	}

	/**
	 * Enter mesh-mode GL state: depth test on (LEQUAL — `LEQUAL` not
	 * `LESS` so coplanar triangles obey the OBJ's draw order; Kenney
	 * low-poly assets layer feature primitives like eye sockets / pupils
	 * coincident with the underlying face, and `LESS` would lose them),
	 * depth write on, blend off. The depth attachment is cleared lazily
	 * here so frames with no mesh content pay nothing for a clear they
	 * wouldn't have used.
	 *
	 * The renderer doesn't need to know any of this; it just calls
	 * `bind()` during a `setBatcher` transition and the mesh batcher
	 * sets up its own pass. The same pattern ports cleanly to WebGPU:
	 * `bind()` becomes "begin a depth-enabled render pass" there.
	 */
	bind() {
		super.bind();
		const gl = this.gl;
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.depthMask(true);
		gl.disable(gl.BLEND);
		if (_meshDepthDirty) {
			gl.clearDepth(1.0);
			gl.clear(gl.DEPTH_BUFFER_BIT);
			_meshDepthDirty = false;
		}
	}

	/**
	 * Exit mesh-mode GL state: restore the non-mesh defaults (blend on,
	 * depth test off, depth write off) that 2D rendering paths assume.
	 */
	unbind() {
		super.unbind();
		const gl = this.gl;
		gl.enable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
	}

	/**
	 * Write one vertex into the buffer. The base (unlit) layout is
	 * `x, y, z, u, v, color`. Subclasses override to append per-vertex data
	 * matching their {@link MeshBatcher#_attributeLayout} (e.g.
	 * {@link LitMeshBatcher} pushes the world-space normal too).
	 * @param {object} vertexData - the batcher's vertex buffer
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 * @param {number} u
	 * @param {number} v
	 * @param {number} color - packed ARGB Uint32
	 * @param {object} _mesh - the source mesh (unused here; for subclasses)
	 * @param {number} _i3 - the source vertex's `index * 3` (for subclasses)
	 * @ignore
	 */
	_pushVertex(vertexData, x, y, z, u, v, color, _mesh, _i3) {
		vertexData.pushMesh(x, y, z, u, v, color);
	}

	/**
	 * Add a textured mesh to the batch. When the mesh has a
	 * `vertexColors` array (multi-material OBJ + bound MTL), each
	 * vertex's `aColor` attribute comes from that buffer instead of
	 * the shared `tint` argument — so multi-material rendering needs
	 * no extra draw calls per material vs single-material (large
	 * meshes still get chunked across multiple flushes to fit the
	 * vertex/index buffer limits — same behavior as single-material).
	 * The shared `tint` is then multiplied into each vertex color
	 * CPU-side (via `mulPackedARGB`, before `pushMesh`), preserving
	 * runtime flash / fade / team-color effects — the mesh shader
	 * itself just does `texture * aColor`, no extra uniform.
	 * @param {object} mesh - a Mesh object with vertices, uvs, indices, and texture properties
	 * @param {number} tint - tint color in UINT32 (argb) format
	 */
	addMesh(mesh, tint) {
		const vertices = mesh.vertices;
		const uvs = mesh.uvs;
		const indices = mesh.indices;
		const vertexColors = mesh.vertexColors;

		// upload and activate the texture. The mesh's own `textureRepeat`
		// (when set) is threaded through as a per-use wrap override — sampler
		// state per mesh, never a mutation of the shared per-image atlas
		// (#1503). The unit cache keys by `(source, repeat)`, so meshes with
		// different wraps over one image coexist on distinct GL textures.
		const unit = this.uploadTexture(
			mesh.texture,
			undefined,
			undefined,
			false,
			true,
			mesh.textureRepeat,
		);
		if (unit !== this.currentSamplerUnit) {
			this.currentShader.setUniform("uSampler", unit);
			this.currentSamplerUnit = unit;
		}

		// alpha cutout (glTF alphaMode MASK): discard fragments whose final alpha
		// is below the mesh's threshold (0 = disabled). The built-in mesh shaders
		// declare `uAlphaCutoff`; a custom shader without it is left untouched.
		// Each mesh is flushed on its own (see WebGLRenderer.drawMesh), so setting
		// the uniform before the vertices are pushed is enough — no extra flush.
		const cutoff = mesh.alphaCutoff || 0;
		if (
			cutoff !== this.currentAlphaCutoff &&
			this.currentShader.uniforms.uAlphaCutoff !== undefined
		) {
			this.currentShader.setUniform("uAlphaCutoff", cutoff);
			this.currentAlphaCutoff = cutoff;
		}

		// emissive (glTF emissiveFactor / MTL Ke): a self-illumination color
		// added to the final fragment, unaffected by lighting. Same per-mesh,
		// flush-free, guarded-by-uniform-presence pattern as the cutoff above.
		// `undefined` (no emission) → the shared zero vector, a no-op add.
		const em = mesh.emissive;
		const er = em ? em[0] : 0;
		const eg = em ? em[1] : 0;
		const eb = em ? em[2] : 0;
		if (
			(er !== this.currentEmissiveR ||
				eg !== this.currentEmissiveG ||
				eb !== this.currentEmissiveB) &&
			this.currentShader.uniforms.uEmissive !== undefined
		) {
			this.currentShader.setUniform("uEmissive", em ?? _ZERO_EMISSIVE);
			this.currentEmissiveR = er;
			this.currentEmissiveG = eg;
			this.currentEmissiveB = eb;
		}

		const m = this.viewMatrix;
		const isIdentity = m.isIdentity();
		const maxVerts = this.vertexData.maxVertex;
		const maxIndices = this.indexBuffer.data.length;

		// size the versioned-remap scratch for this mesh's vertex range (one-time
		// growth; reused across frames thereafter)
		ensureRemapCapacity(mesh.vertexCount);

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

			// build a local vertex remap for this chunk (reused scratch).
			// capture base offset before pushing any vertices. Bump the stamp to
			// invalidate the whole remap in O(1) (resetting before int32 overflow,
			// ~weeks of continuous rendering away, keeps the stored stamps valid).
			const baseOffset = vertexData.vertexCount;
			if (_stamp >= 0x7fffffff) {
				_remapStamp.fill(0);
				_stamp = 0;
			}
			_stamp++;
			_chunkIndices.length = 0;
			let localCount = 0;

			for (let j = triIdx; j < endIdx; j++) {
				const origIdx = indices[j];
				let localIdx;
				if (_remapStamp[origIdx] === _stamp) {
					// already emitted this chunk — reuse its local index
					localIdx = _remapSlot[origIdx];
				} else {
					localIdx = localCount++;
					_remapStamp[origIdx] = _stamp;
					_remapSlot[origIdx] = localIdx;

					const i3 = origIdx * 3;
					const i2 = origIdx * 2;
					let x = vertices[i3];
					let y = vertices[i3 + 1];
					let z = vertices[i3 + 2];

					if (!isIdentity) {
						_v.set(x, y, z);
						m.apply(_v);
						x = _v.x;
						y = _v.y;
						z = _v.z;
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
					// delegate the actual write so subclasses can add per-vertex
					// data (e.g. LitMeshBatcher appends the world-space normal).
					this._pushVertex(
						vertexData,
						x,
						y,
						z,
						uvs[i2],
						uvs[i2 + 1],
						vertColor,
						mesh,
						i3,
					);
				}
				// absolute index = baseOffset + localIdx
				_chunkIndices.push(baseOffset + localIdx);
			}

			// add raw indices (already absolute, bypass rebasing) — addRaw
			// copies the values, so reusing `_chunkIndices` next chunk is safe
			this.indexBuffer.addRaw(_chunkIndices);
			triIdx = endIdx;
		}
	}
}
