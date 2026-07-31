import { Matrix3d } from "../../../math/matrix3d.ts";
import { off, on, RENDER_TARGET_CHANGED } from "../../../system/event.ts";
import RetainedGeometry from "../buffer/retained_geometry.js";
import meshFragment from "./../shaders/mesh.frag";
import meshVertex from "./../shaders/mesh.vert";
import { MaterialBatcher } from "./material_batcher.js";

// Shared identity model matrix for draws whose vertices are already placed
// (the 2D-camera path pre-projects them on the CPU). Never mutated.
const _IDENTITY_MATRIX = new Matrix3d();

// Scratch for unpacking a packed ARGB tint into the shader's vec4. Reused —
// setPlacementUniforms runs synchronously and never re-enters.
const _TINT_RGBA = new Float32Array(4);

// Growable scratch for assembling a mesh's interleaved vertex data before it
// is uploaded to its retained buffer. Reused across meshes (building is
// synchronous and never re-enters) so a rebuild allocates nothing steady-state.
let _buildScratch = new Float32Array(0);
function retainedScratch(floatCount) {
	if (_buildScratch.length < floatCount) {
		_buildScratch = new Float32Array(floatCount);
	}
	return _buildScratch;
}

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

// The lazy-depth-clear state for the mesh-mode pass lives on the RENDERER
// (`renderer._meshDepthDirty`), not per batcher instance: the unlit
// `MeshBatcher` and the `LitMeshBatcher` — which extends it and inherits
// `bind()` — must coordinate on a SINGLE depth clear per target (per-instance
// flags would re-clear the shared depth buffer when switching between the two
// mid-frame and break inter-mesh occlusion), while two coexisting renderers
// must NOT share it (a module-level flag let one Application's `clear()`
// re-arm — or steal — the other's depth clear mid-frame). The first `bind()`
// of either batcher clears + marks clean; `RENDER_TARGET_CHANGED` from the
// owning renderer re-arms it.

// shared zero emissive, passed to the shader when a mesh has no emission so the
// `uEmissive` add is a no-op. Never mutated.
const _ZERO_EMISSIVE = new Float32Array(3);

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

		// Retained geometry per mesh (model-space buffers uploaded once). A
		// re-init means a new GL context or a fresh batcher life, so anything
		// held is stale — release it rather than leak it.
		if (this.retained !== undefined) {
			this.releaseAllRetained();
		}
		this.retained = new Map();

		// last `uTint` value pushed, same redundant-set guard — but the
		// sentinel is `undefined`, NOT a number: a packed ARGB tint spans the
		// whole 32-bit range, and white at full alpha (0xffffffff) reads back
		// as -1 when signed, so any numeric sentinel can collide with a real
		// tint and silently suppress the very first set.
		this.currentTintValue = undefined;

		// arm the (renderer-owned) lazy depth clear for the first mesh pass
		renderer._meshDepthDirty = true;

		// Subscribe to the renderer's target-changed broadcast so we re-arm the
		// lazy depth clear (`renderer._meshDepthDirty`) whenever the active
		// framebuffer's attachments change identity (FBO bind/unbind for
		// post-effects, frame-start `clear()`). Same pattern as
		// `MaterialBatcher`'s `GPU_TEXTURE_CACHE_RESET` subscription — only
		// batchers that care subscribe.
		if (!this._onTargetChanged) {
			this._onTargetChanged = (emitter) => {
				// the event is global — ignore broadcasts from OTHER renderer
				// instances (several Applications can coexist on one page);
				// a missing emitter (legacy/manual emit) is treated as ours
				if (emitter === undefined || emitter === this.renderer) {
					this.renderer._meshDepthDirty = true;
				}
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
	_attributeLayout(_renderer) {
		return [
			{
				name: "aVertex",
				format: "float32x3",
				offset: 0 * Float32Array.BYTES_PER_ELEMENT,
			},
			{
				name: "aRegion",
				format: "float32x2",
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
				format: "float32x4",
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
			// the placement uniforms live on the program too — a swapped
			// shader starts at its own defaults, so re-issue them
			this.currentTintValue = undefined;
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
		this.releaseAllRetained();
		super.destroy();
	}

	/**
	 * Drop every retained geometry alongside the batcher's own buffers: a
	 * reset means the GL buffers are being recreated, so anything still
	 * referencing the old ones would draw from freed memory. Meshes rebuild
	 * lazily on their next draw.
	 * @ignore
	 */
	reset() {
		this.releaseAllRetained();
		super.reset();
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
		if (this.renderer._meshDepthDirty) {
			gl.clearDepth(1.0);
			gl.clear(gl.DEPTH_BUFFER_BIT);
			this.renderer._meshDepthDirty = false;
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
	 * The runtime `tint` is applied by the shader through the `uTint`
	 * uniform rather than being multiplied into each vertex color, so
	 * flash / fade / team-color effects never touch vertex data.
	 * @param {object} mesh - a Mesh object with vertices, uvs, indices, and texture properties
	 * @param {number} tint - tint color in UINT32 (argb) format
	 */
	/**
	 * Issue the per-draw placement uniforms: where the geometry sits
	 * (`uModelMatrix`), where the camera is (`uViewMatrix`), and the colour
	 * it is tinted with (`uTint`).
	 *
	 * Keeping these as uniforms rather than baking them into vertex data is
	 * what lets geometry be uploaded once and reused: moving, rotating,
	 * scaling or re-tinting a mesh changes only these values.
	 *
	 * Each set is guarded on the uniform actually being declared, because
	 * `GLShader.setUniform` throws on an unknown name and a custom mesh
	 * shader need not declare all of them.
	 * @param {Matrix3d} modelMatrix - the mesh's own placement, or identity when its vertices are already positioned
	 * @param {number} tint - tint colour in UINT32 (argb) format
	 * @ignore
	 */
	/**
	 * Write one mesh's model-space geometry into `out` in this batcher's
	 * vertex layout, returning how many floats were written.
	 *
	 * The data deliberately carries no placement, camera or tint information
	 * — those are uniforms — so it stays valid for the lifetime of the
	 * geometry. Subclasses override to append their own per-vertex data.
	 * @param {object} mesh - the mesh to read geometry from
	 * @param {Float32Array} out - destination scratch, at least `vertexCount × vertexSize` long
	 * @returns {number} number of floats written
	 * @ignore
	 */
	buildRetainedVertexData(mesh, out) {
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
			o += this.vertexSize;
		}
		return o;
	}

	/**
	 * Get this mesh's retained geometry, building or refreshing it when the
	 * mesh's geometry version has moved on.
	 * @param {object} mesh - the mesh whose geometry is wanted
	 * @returns {RetainedGeometry} up-to-date geometry for the mesh
	 * @ignore
	 */
	retainedGeometryFor(mesh) {
		let geometry = this.retained.get(mesh);
		if (geometry === undefined) {
			geometry = new RetainedGeometry(
				this.gl,
				this.attributes,
				this.stride,
				(name) => {
					return this.defaultShader.getAttribLocation(name);
				},
			);
			this.retained.set(mesh, geometry);
		}
		const version = mesh._geometryVersion ?? 0;
		if (geometry.uploadedVersion !== version) {
			const scratch = retainedScratch(mesh.vertexCount * this.vertexSize);
			const floats = this.buildRetainedVertexData(mesh, scratch);
			geometry.upload(scratch, floats, mesh._indicesOriginal, version);
		}
		return geometry;
	}

	/**
	 * Draw a mesh from its retained geometry: bind the persistent buffers and
	 * issue one indexed draw, with placement supplied entirely by uniforms.
	 *
	 * Unlike {@link addMesh} this accumulates nothing and never chunks — the
	 * whole mesh is one draw call regardless of size.
	 * @param {object} mesh - the mesh to draw
	 * @param {Matrix3d} modelMatrix - where the mesh sits in the world
	 * @param {number} tint - tint colour in UINT32 (argb) format
	 * @ignore
	 */
	drawRetainedMesh(mesh, modelMatrix, tint) {
		const gl = this.gl;

		// anything the caller had queued must land first, or this draw would
		// reorder ahead of it
		this.flush();

		this.applyMeshMaterial(mesh);
		this.setPlacementUniforms(modelMatrix, tint);

		const geometry = this.retainedGeometryFor(mesh);
		geometry.bind();
		gl.drawElements(this.mode, geometry.indexCount, geometry.indexType, 0);

		// hand the batcher's own vertex state back, so a subsequent
		// accumulated draw uploads and draws through its buffers, not these
		this.vertexState.bind();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.uploadBuffer);
	}

	/**
	 * Release the retained geometry held for one mesh, if any.
	 * @param {object} mesh - the mesh whose geometry should be freed
	 * @ignore
	 */
	releaseRetained(mesh) {
		const geometry = this.retained.get(mesh);
		if (geometry !== undefined) {
			geometry.destroy();
			this.retained.delete(mesh);
		}
	}

	/**
	 * Release every retained geometry this batcher holds.
	 * @ignore
	 */
	releaseAllRetained() {
		this.retained.forEach((geometry) => {
			geometry.destroy();
		});
		this.retained.clear();
	}

	/**
	 * In addition to the attribute-layout check, warn once when a shader
	 * hosted on this batcher declares none of the placement uniforms.
	 *
	 * Mesh geometry is now uploaded in model space, so a shader that only
	 * declares `uProjectionMatrix` — which is what every mesh shader needed
	 * before, and what {@link ShaderEffect} still generates — will draw the
	 * mesh at its untransformed origin with no camera applied. That renders
	 * as "the model vanished" rather than as an error, so say so explicitly.
	 * @param {GLShader} shader - the shader about to be hosted
	 * @ignore
	 */
	validateShaderLocations(shader) {
		const firstTime =
			this.validatedShaders === undefined || !this.validatedShaders.has(shader);
		super.validateShaderLocations(shader);
		if (firstTime === true && shader !== this.defaultShader) {
			const uniforms = shader.uniforms;
			if (
				uniforms.uModelMatrix === undefined &&
				uniforms.uViewMatrix === undefined
			) {
				console.warn(
					"melonJS: this mesh shader declares neither `uModelMatrix` nor `uViewMatrix` — " +
						"mesh geometry is supplied in model space, so the mesh will be drawn " +
						"unplaced and without the camera. Multiply the vertex position by " +
						"`uProjectionMatrix * uViewMatrix * uModelMatrix`, and tint with `uTint`.",
				);
			}
		}
	}

	setPlacementUniforms(modelMatrix, tint) {
		const shader = this.currentShader;
		const uniforms = shader.uniforms;

		if (uniforms.uViewMatrix !== undefined) {
			shader.setUniform("uViewMatrix", this.viewMatrix);
		}
		if (uniforms.uModelMatrix !== undefined) {
			shader.setUniform("uModelMatrix", modelMatrix);
		}
		if (tint !== this.currentTintValue && uniforms.uTint !== undefined) {
			_TINT_RGBA[0] = ((tint >>> 16) & 0xff) / 255;
			_TINT_RGBA[1] = ((tint >>> 8) & 0xff) / 255;
			_TINT_RGBA[2] = (tint & 0xff) / 255;
			_TINT_RGBA[3] = ((tint >>> 24) & 0xff) / 255;
			shader.setUniform("uTint", _TINT_RGBA);
			this.currentTintValue = tint;
		}
	}

	/**
	 * Bind a mesh's material state: its texture (honouring the mesh's own
	 * `textureRepeat` wrap override) and the guarded `uAlphaCutoff` /
	 * `uEmissive` uniforms.
	 *
	 * Shared by the accumulated and retained draw paths so material changes
	 * take effect immediately either way, without touching geometry.
	 * @param {object} mesh - the mesh whose material should be applied
	 * @ignore
	 */
	applyMeshMaterial(mesh) {
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
	}

	addMesh(mesh, tint) {
		const vertices = mesh.vertices;
		const uvs = mesh.uvs;
		const indices = mesh.indices;
		const vertexColors = mesh.vertexColors;

		this.applyMeshMaterial(mesh);

		// Placement uniforms. The view transform and the tint used to be baked
		// into every vertex on the CPU; they are uniforms now, so the vertex
		// data depends only on the geometry itself. This path (2D camera /
		// pre-projected vertices) supplies an identity model matrix — the
		// vertices already sit where they belong.
		this.setPlacementUniforms(_IDENTITY_MATRIX, tint);

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
					const x = vertices[i3];
					const y = vertices[i3 + 1];
					const z = vertices[i3 + 2];

					// per-vertex color when the mesh provides one
					// (multi-material baked colors). The runtime tint is a
					// uniform now, so it is NOT folded in here — the shader
					// multiplies it, which keeps vertex data tint-independent.
					const vertColor = vertexColors ? vertexColors[origIdx] : 0xffffffff;
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
