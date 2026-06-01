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
					// aColor: 4 normalized floats (R, G, B, A in [0, 1])
					// rather than packed 4×UNSIGNED_BYTE. The byte-packed
					// path is byte-identical in memory but exposes the
					// 4-byte slot to NaN-pattern bit values when the
					// alpha byte is 0xFF and the red byte has its high
					// bit set (R≥0x80) — a NaN-pattern that Apple's
					// Metal-backed WebGL driver canonicalizes on some
					// upload paths, zeroing the bytes the shader actually
					// reads. The float path uses values in [0, 1] which
					// never form NaN bit patterns; trades 12 bytes of
					// vertex memory (4 vs 16 per color) for guaranteed
					// driver-safety. Mesh vertex counts are typically
					// modest (sub-thousand per Mesh) so the bandwidth
					// hit is invisible.
					name: "aColor",
					size: 4,
					type: renderer.gl.FLOAT,
					normalized: false,
					offset: 5 * Float32Array.BYTES_PER_ELEMENT,
				},
			],
			shader: {
				vertex: meshVertex,
				fragment: meshFragment,
			},
			indexed: true,
		});
		/**
		 * Tracks whether the active framebuffer's depth attachment still
		 * needs a clear before this batcher's next draw. Flipped to
		 * `true` by the `RENDER_TARGET_CHANGED` listener installed
		 * below (frame start, post-effect FBO bind/unbind), back to
		 * `false` by the first `bind()` of the new target after the
		 * lazy clear runs. Lifts depth clearing from per-mesh (legacy)
		 * to per-target — same model Three.js uses. The GPU's `LEQUAL`
		 * depth test then resolves inter-mesh occlusion per pixel
		 * against the accumulated buffer.
		 * @ignore
		 */
		this._depthDirty = true;

		// Subscribe to the renderer's target-changed broadcast so we
		// re-arm the lazy depth clear whenever the active framebuffer's
		// attachments change identity (FBO bind/unbind for post-effects,
		// frame-start `clear()`). Same pattern as `MaterialBatcher`'s
		// `GPU_TEXTURE_CACHE_RESET` subscription — only batchers that
		// care subscribe, so non-mesh batchers pay nothing for this.
		if (!this._onTargetChanged) {
			this._onTargetChanged = () => {
				this._depthDirty = true;
			};
			on(RENDER_TARGET_CHANGED, this._onTargetChanged);
		}
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
		if (this._depthDirty) {
			gl.clearDepth(1.0);
			gl.clear(gl.DEPTH_BUFFER_BIT);
			this._depthDirty = false;
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
