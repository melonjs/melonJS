import { Matrix3d } from "../../../math/matrix3d.ts";
import { off, on, RENDER_TARGET_CHANGED } from "../../../system/event.ts";
import { instanceAttributes } from "../../gpu/instancerecord.ts";
import {
	assignIndex,
	beginChunk,
	ensureRemapCapacity,
	remapIndex,
} from "../../gpu/meshchunk.ts";
import { buildMeshVertexData, retainedScratch } from "../../gpu/meshvertex.ts";
import WebGLInstanceBuffer from "../buffer/instance_buffer.js";
import RetainedGeometry from "../buffer/retained_geometry.js";
import WebGLVertexState from "../buffer/vertexstate.js";
import GLShader from "../glshader.js";
import meshFragment from "./../shaders/mesh.frag";
import meshVertex from "./../shaders/mesh.vert";
import meshInstancedVertex from "./../shaders/mesh-instanced.vert";
import meshShadowInstancedVertex from "./../shaders/mesh-shadow-instanced.vert";
import { injectDefines } from "../utils/string.js";
import { MaterialBatcher } from "./material_batcher.js";

// Shared identity model matrix for draws whose vertices are already placed
// (the 2D-camera path pre-projects them on the CPU). Never mutated.
const _IDENTITY_MATRIX = new Matrix3d();

// Scratch for unpacking a packed ARGB tint into the shader's vec4. Reused —
// setPlacementUniforms runs synchronously and never re-enters.
const _TINT_RGBA = new Float32Array(4);

// The per-chunk vertex dedup (versioned typed-array remap) lives in the
// backend-neutral `gpu/meshchunk.ts`, shared with the WebGPU mesh batcher —
// see the rationale there. Safe because addMesh runs synchronously and never
// re-enters (flush() only draws); only one addMesh runs at a time.

// The lazy-depth-clear state for the mesh-mode pass lives on the RENDERER
// (`renderer._meshDepthDirty`), not per batcher instance: the unlit
// `MeshBatcher` and the `LitMeshBatcher` — which extends it and overrides
// `updatePassState()` — must coordinate on a SINGLE depth clear per target
// (per-instance
// flags would re-clear the shared depth buffer when switching between the two
// mid-frame and break inter-mesh occlusion), while two coexisting renderers
// must NOT share it (a module-level flag let one Application's `clear()`
// re-arm — or steal — the other's depth clear mid-frame). The first draw of
// either batcher clears + marks clean; `RENDER_TARGET_CHANGED` from the
// owning renderer re-arms it.

// shared zero emissive, passed to the shader when a mesh has no emission so the
// `uEmissive` add is a no-op. Never mutated.
const _ZERO_EMISSIVE = new Float32Array(3);

// scratch for the camera's world position, recomputed per draw that needs it
const _EYE_POSITION = new Float32Array(3);

// scratches for the per-camera distance fog, unpacked per draw that needs it
const _FOG_COLOR = new Float32Array(3);
const _FOG_PARAMS = new Float32Array(4);
const _FOG_HEIGHT = new Float32Array(4);

/**
 * A WebGL Batcher for rendering textured triangle meshes.
 * Uses indexed drawing to efficiently render arbitrary triangle geometry.
 *
 * Owns mesh-mode GL state ownership (since 19.7 / #1468):
 *
 * - {@link MeshBatcher#bind} enters mesh mode — enables `DEPTH_TEST` +
 *   `LEQUAL` + `depthMask`, disables `BLEND`.
 * - {@link MeshBatcher#updatePassState} runs the one-shot
 *   `clearDepth(1.0) + clear(DEPTH_BUFFER_BIT)` when the active target's
 *   depth attachment is still dirty, immediately before a draw rather than
 *   on entry — `bind()` fires on a batcher *transition*, not once a frame,
 *   so a scene made only of meshes would otherwise never clear again after
 *   its first frame. Subsequent draws against the same target rely on the
 *   accumulated depth buffer.
 * - {@link MeshBatcher#unbind} exits mesh mode — restores non-mesh
 *   defaults (`BLEND` on, `DEPTH_TEST` off, `depthMask` false) that the
 *   2D rendering paths assume.
 * - Subscribes to {@link event.RENDER_TARGET_CHANGED} (emitted by the
 *   renderer at frame-start `clear()`, non-camera FBO bind, post-effect
 *   FBO unbind) to re-arm the lazy depth clear whenever the active
 *   framebuffer's attachments change identity.
 *
 * The WebGLRenderer doesn't know any of this — `setBatcher("mesh")` calls
 * `bind()` and the batcher sets up its own pass, refreshing whatever is
 * per-draw as it goes. Same lifecycle ports
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

		// last `uShininess` / `uSpecular` pushed — -1 is impossible (valid
		// range 0..inf), forcing the first set of a pass
		this.currentShininess = -1;
		this.currentSpecularR = -1;
		this.currentSpecularG = -1;
		this.currentSpecularB = -1;

		// last `uAlphaMap` unit and `uHasAlphaMap` flag pushed; -1 is not a
		// valid unit or flag, so the first mesh of a pass always sets both
		this.currentAlphaMapUnit = -1;
		this.currentHasAlphaMap = -1;

		// last `uEyePosition` pushed. NaN never equals itself, so the first
		// camera position of a pass always sets it whatever it is
		this.currentEyeX = Number.NaN;
		this.currentEyeY = Number.NaN;
		this.currentEyeZ = Number.NaN;

		// last fog pushed, same NaN-sentinel trick. Fog changes once per
		// camera at most, while this runs once per mesh.
		this.currentFogMode = Number.NaN;
		this.currentFogNear = Number.NaN;
		this.currentFogInvRange = Number.NaN;
		this.currentFogDensity = Number.NaN;
		this.currentFogR = Number.NaN;
		this.currentFogG = Number.NaN;
		this.currentFogB = Number.NaN;
		this.currentFogFalloff = Number.NaN;
		this.currentFogHeight = Number.NaN;
		this.currentFogCamY = Number.NaN;

		// Retained geometry per mesh (model-space buffers uploaded once). A
		// re-init means a new GL context or a fresh batcher life, so anything
		// held is stale — release it rather than leak it.
		if (this.retained !== undefined) {
			this.releaseAllRetained();
		}
		this.retained = new Map();

		// Per-mesh instance buffers, and the vertex states pairing a mesh's
		// retained geometry with its instance records. Same lifetime rule as
		// `retained`: a re-init means a new context, so drop what is held.
		if (this.instanced !== undefined) {
			this.releaseAllInstanced();
		}
		this.instanced = new Map();

		// Instanced shader variants, keyed on the opt-in slots a mesh
		// declares. Compiled on first use rather than up front: most scenes
		// use one combination, and a scene with no instanced mesh at all
		// compiles none. Dropped on re-init with everything else GL-owned.
		this.shaderVariants?.forEach((shader) => {
			shader.destroy();
		});
		this.shaderVariants = new Map();

		// last `uTint` value pushed, same redundant-set guard — but the
		// sentinel is `undefined`, NOT a number: a packed ARGB tint spans the
		// whole 32-bit range, and white at full alpha (0xffffffff) reads back
		// as -1 when signed, so any numeric sentinel can collide with a real
		// tint and silently suppress the very first set.
		this.currentTintValue = undefined;

		// GL textures already upgraded to trilinear minification (mesh
		// textures sample their mip chain — see applyMeshMaterial). WeakSet:
		// entries die with their GL texture objects.
		this.trilinearTextures = new WeakSet();

		// 4× anisotropic filtering rides the same upgrade (oblique surfaces
		// keep detail plain trilinear blurs away). Resolved per init — a
		// context restore re-runs this against the fresh context.
		const gl = this.gl;
		this.anisotropicExt = gl.getExtension("EXT_texture_filter_anisotropic");
		this.maxAnisotropy = this.anisotropicExt
			? Math.min(
					4,
					gl.getParameter(this.anisotropicExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT),
				)
			: 0;

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
			this.currentFogMode = Number.NaN;
			this.currentFogNear = Number.NaN;
			this.currentFogInvRange = Number.NaN;
			this.currentFogDensity = Number.NaN;
			this.currentFogR = Number.NaN;
			this.currentFogG = Number.NaN;
			this.currentFogB = Number.NaN;
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
		// variants hold GL programs AND stay subscribed to the context-loss
		// events until destroyed — an orphan would try to recompile against a
		// dead context on the next restore
		this.shaderVariants?.forEach((shader) => {
			shader.destroy();
		});
		this.shaderVariants?.clear();
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
	 * depth write on, blend off.
	 *
	 * The renderer doesn't need to know any of this; it just calls
	 * `bind()` during a `setBatcher` transition and the mesh batcher
	 * sets up its own pass. The same pattern ports cleanly to WebGPU:
	 * `bind()` becomes "begin a depth-enabled render pass" there.
	 *
	 * State that has to be current for each *draw* rather than for each
	 * batcher transition lives in {@link MeshBatcher#updatePassState}, not
	 * here — see the note there.
	 */
	bind() {
		super.bind();
		const gl = this.gl;
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.depthMask(true);
		gl.disable(gl.BLEND);
	}

	/**
	 * Refresh pass-scoped state, immediately before a draw.
	 *
	 * This exists because `bind()` is *not* a per-frame hook. `setBatcher`
	 * returns early when the requested batcher is already current, so a scene
	 * that draws nothing but meshes — no sprites, no UI, no unlit geometry to
	 * force a switch — binds once and never again. Anything set up in `bind()`
	 * then freezes at its first-frame value.
	 *
	 * The depth clear is one such thing. `renderer._meshDepthDirty` is re-armed
	 * every time the render target changes (frame-start `clear()`, FBO
	 * bind/unbind), but a flag nobody reads is a flag that does nothing: left in
	 * `bind()` it would stay armed forever and the depth attachment would carry
	 * the first frame's values for the life of the scene, occluding geometry as
	 * the camera moved. Consuming it here runs the clear once per target, which
	 * is what the flag always meant. {@link LitMeshBatcher} extends this with
	 * its light data, which had the same problem.
	 *
	 * Cheap by construction: one boolean test per draw in the common case.
	 * `depthMask` is guaranteed true here — `bind()` sets it and only `unbind()`
	 * clears it, so this batcher being current implies a writable depth buffer,
	 * without which `gl.clear(DEPTH_BUFFER_BIT)` would silently do nothing.
	 * @ignore
	 */
	updatePassState() {
		if (this.renderer._meshDepthDirty) {
			const gl = this.gl;
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
		// the shared neutral builder — one copy for both backends
		return buildMeshVertexData(mesh, out, this.vertexSize);
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
	 * whole mesh is one draw call regardless of size, except for a
	 * multi-material model whose materials carry different diffuse textures:
	 * that draws one indexed range per entry in {@link Mesh#textureGroups}
	 * (#1573), over the same buffers, with only the sampler moving between
	 * them.
	 * @param {object} mesh - the mesh to draw
	 * @param {Matrix3d} modelMatrix - where the mesh sits in the world
	 * @param {number} tint - tint colour in UINT32 (argb) format
	 * @ignore
	 */
	drawRetainedMesh(mesh, modelMatrix, tint) {
		const gl = this.gl;

		// A ground shadow is deferred to the end of the mesh pass rather than
		// drawn here (#1515). It writes no depth, so it has nothing to defend
		// itself with: every opaque mesh still to come would paint straight
		// over it — the ground plane above all, which routinely sorts after the
		// props standing on it. The renderer replays the queue once the opaque
		// meshes are down, and calls back in with `_shadowFlushing` set.
		if (
			mesh._blendedDraw === true &&
			this.renderer._shadowFlushing !== true &&
			this.renderer.queueGroundShadow !== undefined
		) {
			this.renderer.queueGroundShadow(mesh, modelMatrix, tint);
			return;
		}

		// anything the caller had queued must land first, or this draw would
		// reorder ahead of it
		this.flush();
		// Fog is a compiled variant, so the program depends on the camera's fog
		// state and not only on the batcher.
		//
		// Only ever swap the batcher's OWN program. `WebGLRenderer.drawMesh`
		// binds a renderable's custom shader immediately before calling in
		// here, and re-binding unconditionally threw that away silently: the
		// mesh drew with built-in shading, no error, in every scene — fog
		// enabled or not. A custom mesh shader is the author's, and it has no
		// fog variant to switch to.
		if (this._ownsCurrentShader()) {
			this.useShader(this.meshShader());
		}

		// Strictly BEFORE the blended-draw toggle below: `updatePassState`
		// runs the one-shot depth clear, and `gl.clear(DEPTH_BUFFER_BIT)`
		// silently does nothing with `depthMask` off. A blended mesh drawn
		// first in a frame would otherwise swallow the clear and leave the
		// whole frame rendering against stale depth.
		this.updatePassState();

		const blended = mesh._blendedDraw === true;
		if (blended === true) {
			this.beginBlendedDraw();
		}

		const slices = mesh.textureGroups;
		if (slices === undefined) {
			this.applyMeshMaterial(mesh);
		}
		this.setPlacementUniforms(modelMatrix, tint, mesh);

		const geometry = this.retainedGeometryFor(mesh);
		geometry.bind();
		if (slices === undefined) {
			gl.drawElements(this.mode, geometry.indexCount, geometry.indexType, 0);
		} else {
			const indexBytes = geometry.indexType === gl.UNSIGNED_INT ? 4 : 2;
			for (let i = 0; i < slices.length; i++) {
				// Bound one range at a time, immediately before its own draw.
				// Resolving every range's texture up front would be faster
				// but is wrong: exhausting the unit budget makes the texture
				// cache recycle units from unit 0, which silently invalidates
				// the units already handed out. Binding per range means a
				// later range recycling an earlier one's unit is harmless —
				// that range has already drawn.
				//
				// Safe between `geometry.bind()` and these draws because
				// nothing is accumulated on this path: the flush a texture
				// upload may trigger returns immediately at zero vertices,
				// touching neither the vertex array nor ARRAY_BUFFER.
				this.applyMeshMaterial(mesh, slices[i].texture);
				gl.drawElements(
					this.mode,
					slices[i].count,
					geometry.indexType,
					slices[i].start * indexBytes,
				);
			}
		}

		if (blended === true) {
			this.endBlendedDraw();
		}

		// hand the batcher's own vertex state back, so a subsequent
		// accumulated draw uploads and draws through its buffers, not these
		this.vertexState.bind();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.uploadBuffer);
	}

	/**
	 * Enter the blended mesh draw state: alpha blending on, depth test still
	 * on, depth WRITES off (#1515).
	 *
	 * The blend function is set explicitly rather than through
	 * `renderer.setBlendMode`. That method short-circuits when the mode is
	 * unchanged, and `MeshBatcher.bind()` has already disabled `GL_BLEND`
	 * behind that cache's back — so asking for the mode the cache already
	 * claims would leave blending off and the draw opaque. Merely calling
	 * `setBlendEnabled(true)` is no better: it inherits whatever function the
	 * last 2D draw left, and under `"additive"` a dark shadow would *brighten*
	 * the ground.
	 * @ignore
	 */
	beginBlendedDraw() {
		const gl = this.gl;
		gl.enable(gl.BLEND);
		gl.blendEquation(gl.FUNC_ADD);
		gl.blendFunc(
			this.renderer.premultipliedAlpha ? gl.ONE : gl.SRC_ALPHA,
			gl.ONE_MINUS_SRC_ALPHA,
		);
		// depth TEST stays on — the shadow must still be occluded by geometry
		// in front of it — but writes are off, so overlapping shadows at one
		// ground height blend instead of fighting under LEQUAL
		gl.depthMask(false);
	}

	/**
	 * Leave the blended draw state, restoring mesh mode exactly as
	 * {@link MeshBatcher#bind} left it.
	 *
	 * The blend FUNCTION is put back too, not just the enable bit. This draw
	 * overwrote it without touching `renderer.currentBlendMode`, so a later 2D
	 * draw asking for the mode the cache already claims would short-circuit
	 * and silently inherit this one's function. Re-issuing through
	 * `setBlendMode` with the cache invalidated restores both, and leaves the
	 * cache reading exactly what it read before.
	 * @ignore
	 */
	endBlendedDraw() {
		const gl = this.gl;
		gl.depthMask(true);
		const renderer = this.renderer;
		const mode = renderer.currentBlendMode;
		if (typeof mode === "string") {
			renderer.currentBlendMode = null;
			renderer.setBlendMode(mode, renderer.currentPremultipliedAlpha);
		}
		// back to mesh mode, which is opaque
		gl.disable(gl.BLEND);
	}

	/**
	 * Get (building or refreshing as needed) the GPU state one instanced mesh
	 * draws from: its retained prototype geometry, its instance buffer, and
	 * the vertex state binding the two together.
	 *
	 * The vertex state is rebuilt only when a buffer object it references is
	 * replaced — a growing instance set reallocates, a merely-edited one does
	 * not — because a vertex array holding a deleted buffer keeps it alive per
	 * the GL spec and silently draws stale data.
	 * @param {InstancedMesh} mesh - the mesh to draw
	 * @returns {object} `{geometry, instances, vertexState}`
	 * @ignore
	 */
	instancedStateFor(mesh) {
		const gl = this.gl;
		const geometry = this.retainedGeometryFor(mesh);
		let state = this.instanced.get(mesh);
		if (state === undefined) {
			state = {
				instances: new WebGLInstanceBuffer(gl),
				vertexState: null,
				builtVersion: -1,
				builtGeometry: null,
				builtShader: null,
				uploadedRevision: -1,
			};
			this.instanced.set(mesh, state);
		}

		// push whatever the CPU side changed before the layout is described,
		// so a first upload has allocated the buffer by the time the vertex
		// state points attribute records at it
		// what THIS buffer must upload to catch up — a shared "clear the dirty
		// flag" step would let the unlit batcher drain the span before the lit
		// one had seen it
		const plan = mesh.instanceUpload(state.uploadedRevision);
		const usedBytes = mesh.instanceCount * mesh.instanceLayout.stride;
		if (plan.full) {
			state.instances.upload(mesh.instanceBuffer, 0, 0, Infinity);
		} else {
			state.instances.upload(
				mesh.instanceBuffer,
				plan.first,
				plan.count,
				usedBytes,
			);
		}
		state.uploadedRevision = plan.revision;
		mesh.clearInstanceDirty();

		const stale =
			state.vertexState === null ||
			state.builtVersion !== mesh._instanceVersion ||
			state.builtGeometry !== geometry.vertexBuffer ||
			// the layout is frozen against the CURRENT program's attribute
			// locations, so a different program needs a different vertex state
			// — otherwise the rows stay wired to the old locations and the
			// mesh silently reads zeros (a singular matrix collapses it)
			state.builtShader !== this.currentShader;
		if (stale) {
			// geometry group (per vertex) + instance group (per instance) —
			// one vertex array describing both buffers
			const descriptor = {
				buffers: [
					{
						buffer: geometry.vertexBuffer,
						stride: this.stride,
						attributes: this.attributes,
					},
					{
						buffer: state.instances.buffer,
						stride: mesh.instanceLayout.stride,
						stepMode: "instance",
						attributes: this._instanceAttributeRecords(mesh.instanceLayout),
					},
				],
				indexBuffer: {
					bind: () => {
						gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.glIndexBuffer);
					},
				},
				resolveLocation: (name) => {
					return this.currentShader.getAttribLocation(name);
				},
			};
			if (state.vertexState === null) {
				state.vertexState = new WebGLVertexState(gl, descriptor);
			} else {
				state.vertexState.build(descriptor);
			}
			state.builtVersion = mesh._instanceVersion;
			state.builtGeometry = geometry.vertexBuffer;
			state.builtShader = this.currentShader;
		}
		return { geometry, state };
	}

	/**
	 * The instanced shader for a given record layout, compiled on first use.
	 *
	 * Variants are source permutations rather than runtime branches: the
	 * optional slots are `#ifdef`-guarded, so a mesh that declares neither
	 * costs no unused attributes and no dead code. `minify` deliberately
	 * preserves newlines so the directives survive it.
	 * @param {object} layout - the instance record layout
	 * @returns {GLShader} the shader for that combination
	 * @ignore
	 */
	instancedShaderFor(layout) {
		const fogDefine = this._fogDefine();
		// fog joins the key: the fogged and unfogged forms are different
		// programs, and one must not be served for the other
		const key =
			(layout.hasColor ? 1 : 0) |
			(layout.hasData ? 2 : 0) |
			(fogDefine !== "" ? 4 : 0);
		const defines =
			(layout.hasColor ? "#define INSTANCE_COLORS\n" : "") +
			(layout.hasData ? "#define INSTANCE_DATA\n" : "") +
			fogDefine;
		// only INSTANCE_DATA reaches the fragment stage (as the per-instance
		// emissive term); injecting the colour flag there too would compile
		// four distinct fragment texts where two suffice
		const fragmentDefines =
			(layout.hasData ? "#define INSTANCE_DATA\n" : "") + fogDefine;
		return this.shaderVariant(
			`instanced|${key}`,
			this._instancedShaderSources(),
			defines,
			fragmentDefines,
		);
	}

	/**
	 * `"#define FOG\n"` while the camera drawing has fog, `""` otherwise.
	 *
	 * Fog is a compiled variant rather than a runtime `if`, and the reason is
	 * measured rather than theoretical: a software rasterizer predicates both
	 * sides of a branch, so an `exp()` behind a runtime test still costs every
	 * fragment of every scene — the mesh benchmark blew its budget outright.
	 * Compiling it out means a scene that never enables fog runs the shader it
	 * ran before fog existed, instruction for instruction.
	 * @ignore
	 */
	_fogDefine() {
		return this.renderer._fog3d !== null && this.renderer._fog3d !== undefined
			? "#define FOG\n"
			: "";
	}

	/**
	 * One compiled shader per set of defines, built on first use.
	 *
	 * Every optional feature this batcher compiles in or out — instance
	 * colours, instance data, fog — is a key in here rather than a field of
	 * its own. That matters for LIFETIME more than for tidiness: each program
	 * has to be released both on re-init (context loss) and on destroy, and a
	 * missed one leaks a program that later tries to recompile against a dead
	 * context. One map is one release site, however many axes are added.
	 * @param {string} key - identifies the combination
	 * @param {object} sources - `{vertex, fragment}` shader text
	 * @param {string} vertexDefines - injected into the vertex stage
	 * @param {string} fragmentDefines - injected into the fragment stage; not
	 * always the same set, since some flags never reach the fragment stage
	 * @returns {GLShader} the program for that combination
	 * @ignore
	 */
	shaderVariant(key, sources, vertexDefines, fragmentDefines) {
		let shader = this.shaderVariants.get(key);
		if (shader === undefined) {
			shader = new GLShader(this.gl, {
				vertex: injectDefines(sources.vertex, vertexDefines),
				fragment: injectDefines(sources.fragment, fragmentDefines),
				label: `melonJS mesh ${key}`,
			});
			this.shaderVariants.set(key, shader);
		}
		return shader;
	}

	/**
	 * Whether the bound program is one this batcher would pick for a plain
	 * mesh — its own, or the fog variant of its own.
	 *
	 * `drawRetainedMesh` swaps programs per draw because fog is compiled in,
	 * and it must only ever replace one of these. `WebGLRenderer.drawMesh`
	 * binds a renderable's custom shader immediately before calling in, and
	 * swapping unconditionally threw that away silently.
	 * @returns {boolean} true when the swap is safe
	 * @ignore
	 */
	_ownsCurrentShader() {
		return (
			this.currentShader === this.defaultShader ||
			this.currentShader === this.shaderVariants.get("mesh|fog")
		);
	}

	/**
	 * The non-instanced mesh shader for the current fog state: the batcher's
	 * own program while fog is off, a fog variant while it is on.
	 * @ignore
	 */
	meshShader() {
		const fogDefine = this._fogDefine();
		if (fogDefine === "") {
			return this.defaultShader;
		}
		return this.shaderVariant(
			"mesh|fog",
			this._shaderSources(),
			fogDefine,
			fogDefine,
		);
	}

	/**
	 * The instanced shader sources for this batcher (unlit by default).
	 * Subclasses override to supply the lit pair.
	 * @ignore
	 */
	_instancedShaderSources() {
		return { vertex: meshInstancedVertex, fragment: meshFragment };
	}

	/**
	 * Resolve an instance record layout into GL attribute records, in the
	 * `{name, size, type, normalized, offset}` shape the vertex state wants.
	 * Every slot is a `float32x4`.
	 * @param {object} layout - the instance record layout
	 * @returns {object[]} attribute records
	 * @ignore
	 */
	_instanceAttributeRecords(layout) {
		const gl = this.gl;
		return instanceAttributes(layout).map((attr) => {
			return {
				name: attr.name,
				size: 4,
				type: gl.FLOAT,
				normalized: false,
				offset: attr.offset,
			};
		});
	}

	/**
	 * Draw every visible instance of a mesh in one call.
	 *
	 * The geometry is bound once and the GPU walks the instance buffer,
	 * advancing the per-instance attributes one record per copy. Placement of
	 * the *group* still rides the ordinary uniforms, so moving the whole set
	 * costs one matrix and re-uploads nothing.
	 * @param {InstancedMesh} mesh - the mesh to draw
	 * @param {Matrix3d} modelMatrix - where the group sits in the world
	 * @param {number} tint - tint colour in UINT32 (argb) format
	 * @ignore
	 */
	drawInstancedMesh(mesh, modelMatrix, tint) {
		const gl = this.gl;
		const count = mesh.visibleInstanceCount;
		if (count === 0) {
			return;
		}

		// anything queued must land first, or this draw reorders ahead of it
		this.flush();

		// the instanced variant must be current BEFORE the vertex state is
		// built: its attribute locations are what the layout is frozen against
		// A custom mesh shader is NOT hosted on the instanced path: its
		// attribute declarations decide the vertex-state layout, so a shader
		// that omits (or reorders) the instance slots wires them to the wrong
		// locations — or leaves them disabled, which makes the instance matrix
		// singular and collapses the mesh to a point. The WebGPU backend has
		// the same limitation, so both warn and fall back identically.
		if (
			this.renderer.customShader != null &&
			this._instancedShaderWarned !== true
		) {
			this._instancedShaderWarned = true;
			console.warn(
				"melonJS: a custom shader cannot be hosted on an InstancedMesh — the mesh draws with the built-in instanced shading",
			);
		}
		this.useShader(this.instancedShaderFor(mesh.instanceLayout));

		this.updatePassState();
		const slices = mesh.textureGroups;
		if (slices === undefined) {
			this.applyMeshMaterial(mesh);
		}
		this.setPlacementUniforms(modelMatrix, tint, mesh);

		const { geometry, state } = this.instancedStateFor(mesh);
		state.vertexState.bind();
		if (slices === undefined) {
			gl.drawElementsInstanced(
				this.mode,
				geometry.indexCount,
				geometry.indexType,
				0,
				count,
			);
		} else {
			// a multi-material prototype: every instance draws the same split
			// (#1573), so each range is one instanced draw over the whole set
			// — bound per range for the reason spelled out in drawRetainedMesh
			const indexBytes = geometry.indexType === gl.UNSIGNED_INT ? 4 : 2;
			for (let i = 0; i < slices.length; i++) {
				this.applyMeshMaterial(mesh, slices[i].texture);
				gl.drawElementsInstanced(
					this.mode,
					slices[i].count,
					geometry.indexType,
					slices[i].start * indexBytes,
					count,
				);
			}
		}

		// Hand the default shader and this batcher's own vertex state back.
		// Both matter: `bind()` only restores the default program when the
		// batcher is re-entered, and `setBatcher` returns early when it is
		// already current — so a following non-instanced mesh would otherwise
		// draw through the instanced program, reading per-instance attributes
		// that no longer have a buffer behind them.
		this.useShader(this.meshShader());
		this.vertexState.bind();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.uploadBuffer);
	}

	/**
	 * The instanced ground-shadow program (#1515), compiled on first use.
	 *
	 * ONE shader, not a variant per record layout: it reads only the three
	 * transform rows, so `hasColor` / `hasData` make no difference to it —
	 * which is also what stops a forest with per-instance colour and emissive
	 * from getting coloured, glowing shadows.
	 * @returns {GLShader} the shadow program
	 * @ignore
	 */
	instancedShadowShader() {
		const fogDefine = this._fogDefine();
		// The UNLIT fragment stage, on both tiers, not
		// `_instancedShaderSources().fragment`. A blob needs nothing from
		// lighting — it samples the falloff and multiplies by the tint — and
		// borrowing the lit tier's pairs a GLSL ES 3.00 fragment shader with
		// this ES 1.00 vertex shader, which does not link ("Fragment shader
		// version does not match other shader versions") and takes the whole
		// lit instanced tier down with it. It would also read `vNormal` /
		// `vWorldPos`, which a flat blob never writes.
		return this.shaderVariant(
			fogDefine === "" ? "shadow" : "shadow|fog",
			{ vertex: meshShadowInstancedVertex, fragment: meshFragment },
			fogDefine,
			fogDefine,
		);
	}

	/**
	 * The vertex state pairing the SHARED shadow quad's geometry with this
	 * mesh's own instance records.
	 *
	 * Kept in its own slot with its own staleness fields rather than reusing
	 * the main pass's: that one keys on `builtGeometry` and `builtShader`, and
	 * the shadow pass differs in both, so sharing a slot would make the two
	 * passes rebuild each other's vertex array on every single draw.
	 *
	 * The instance buffer itself IS shared — the main pass already uploaded
	 * it this frame, so this adds no upload.
	 * @param {InstancedMesh} mesh - the mesh casting the shadows
	 * @param {object} quadGeometry - the shared shadow quad's retained geometry
	 * @returns {object} the per-mesh instanced state, with `shadowVertexState` built
	 * @ignore
	 */
	instancedShadowStateFor(mesh, quadGeometry) {
		// Deliberately NOT `instancedStateFor`. That one keys its staleness on
		// the CURRENTLY BOUND shader, and by here we are bound to the standalone
		// shadow program — so it would judge the MAIN vertex state stale, tear
		// it down and rebuild it against a program that has none of the mesh's
		// attributes (warning about each), and the next frame's main draw would
		// rebuild it straight back: two VAO teardowns per instanced mesh per
		// frame, forever.
		//
		// The main pass has already run — the shadow queue drains after every
		// opaque mesh — so the state and its uploaded instance buffer exist.
		// The fallback covers a caller that somehow arrives first.
		const state =
			this.instanced.get(mesh) ?? this.instancedStateFor(mesh).state;
		const stale =
			state.shadowVertexState === undefined ||
			state.shadowBuiltVersion !== mesh._instanceVersion ||
			state.shadowBuiltGeometry !== quadGeometry.vertexBuffer ||
			state.shadowBuiltShader !== this.currentShader;
		if (stale === true) {
			const gl = this.gl;
			const descriptor = {
				buffers: [
					{
						buffer: quadGeometry.vertexBuffer,
						stride: this.stride,
						// TRIMMED to position / region / colour at the original
						// stride, so the offsets still land. The lit tier carries
						// `aNormal`, which the standalone shadow program does not
						// declare — leaving it in warns on every build. A flat
						// blob has no use for a normal.
						attributes: this.attributes.slice(0, 3),
					},
					{
						// only the three rows: the shadow reads no colour and no
						// custom data, so declaring them would make the vertex
						// state warn about attributes its program does not have
						buffer: state.instances.buffer,
						stride: mesh.instanceLayout.stride,
						stepMode: "instance",
						attributes: this._instanceAttributeRecords(
							mesh.instanceLayout,
						).slice(0, 3),
					},
				],
				indexBuffer: {
					bind: () => {
						gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadGeometry.glIndexBuffer);
					},
				},
				resolveLocation: (name) => {
					return this.currentShader.getAttribLocation(name);
				},
			};
			if (state.shadowVertexState === undefined) {
				state.shadowVertexState = new WebGLVertexState(gl, descriptor);
			} else {
				state.shadowVertexState.build(descriptor);
			}
			state.shadowBuiltVersion = mesh._instanceVersion;
			state.shadowBuiltGeometry = quadGeometry.vertexBuffer;
			state.shadowBuiltShader = this.currentShader;
		}
		return state;
	}

	/**
	 * Draw one flat blob per instance, in a single call, from the same
	 * instance buffer the mesh itself drew from (#1515).
	 * @param {InstancedMesh} mesh - the mesh casting the shadows
	 * @param {Matrix3d} shadowMatrix - the group matrix, flattened onto the ground
	 * @param {number} tint - tint colour in UINT32 (argb) format
	 * @param {object} quad - the shared shadow quad mesh
	 * @ignore
	 */
	drawInstancedShadow(mesh, shadowMatrix, tint, quad) {
		const gl = this.gl;
		const count = mesh.visibleInstanceCount;
		if (count === 0) {
			return;
		}
		this.flush();
		this.useShader(this.instancedShadowShader());
		this.updatePassState();
		this.applyMeshMaterial(quad);
		this.setPlacementUniforms(shadowMatrix, tint, quad);

		const quadGeometry = this.retainedGeometryFor(quad);
		const state = this.instancedShadowStateFor(mesh, quadGeometry);
		this.beginBlendedDraw();
		state.shadowVertexState.bind();
		gl.drawElementsInstanced(
			this.mode,
			quadGeometry.indexCount,
			quadGeometry.indexType,
			0,
			count,
		);
		this.endBlendedDraw();

		this.useShader(this.meshShader());
		this.vertexState.bind();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.uploadBuffer);
	}

	/**
	 * Release the instance buffer and vertex state held for one mesh, if any.
	 * @param {object} mesh - the mesh whose instance state should be freed
	 * @ignore
	 */
	releaseInstanced(mesh) {
		const state = this.instanced?.get(mesh);
		if (state !== undefined) {
			state.shadowVertexState?.destroy();
			state.vertexState?.destroy();
			state.instances.destroy();
			this.instanced.delete(mesh);
		}
	}

	/**
	 * Release every instance buffer this batcher holds.
	 * @ignore
	 */
	releaseAllInstanced() {
		this.instanced?.forEach((state) => {
			state.shadowVertexState?.destroy();
			state.vertexState?.destroy();
			state.instances.destroy();
		});
		this.instanced?.clear();
	}

	/**
	 * Release the retained geometry held for one mesh, if any.
	 * @param {object} mesh - the mesh whose geometry should be freed
	 * @ignore
	 */
	releaseRetained(mesh) {
		this.releaseInstanced(mesh);
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
		this.releaseAllInstanced();
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

	setPlacementUniforms(modelMatrix, tint, mesh) {
		const shader = this.currentShader;
		const uniforms = shader.uniforms;

		if (uniforms.uViewMatrix !== undefined) {
			shader.setUniform("uViewMatrix", this.viewMatrix);
		}
		if (uniforms.uEyePosition !== undefined) {
			// The camera's world position, which the specular half-vector
			// needs and nothing else in this shader does. Derived from the
			// view matrix rather than plumbed from the camera so it stays
			// correct for any caller that sets a view directly: a view is
			// rigid, so its inverse translation is -Rᵀ·t — twelve
			// multiply-adds against a full 4×4 inversion.
			const v = this.viewMatrix.val;
			const ex = -(v[0] * v[12] + v[1] * v[13] + v[2] * v[14]);
			const ey = -(v[4] * v[12] + v[5] * v[13] + v[6] * v[14]);
			const ez = -(v[8] * v[12] + v[9] * v[13] + v[10] * v[14]);
			// the camera moves once a frame at most, while this runs once per
			// lit mesh — compare before paying for the GL call
			if (
				ex !== this.currentEyeX ||
				ey !== this.currentEyeY ||
				ez !== this.currentEyeZ
			) {
				_EYE_POSITION[0] = ex;
				_EYE_POSITION[1] = ey;
				_EYE_POSITION[2] = ez;
				shader.setUniform("uEyePosition", _EYE_POSITION);
				this.currentEyeX = ex;
				this.currentEyeY = ey;
				this.currentEyeZ = ez;
			}
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
		// `!= null`, not `!== undefined`: `extractUniforms` scans the raw shader
		// text without running the preprocessor, so the names inside the
		// `#ifdef FOG` block are registered even in the program compiled
		// WITHOUT fog — with a null GL location. Testing for undefined let the
		// whole block run, and issue two writes to a null location, on every
		// unfogged mesh draw.
		if (uniforms.uFogParams != null) {
			// `mesh.fog === false` exempts this object; anything else follows
			// the camera.
			const fog = mesh?.fog === false ? null : this.renderer._fog3d;
			const mode = fog !== null && fog !== undefined ? fog.mode : 0;
			const near = mode !== 0 ? fog.near : 0;
			const invRange = mode !== 0 ? fog.invRange : 0;
			const density = mode !== 0 ? fog.density : 0;
			const r = mode !== 0 ? fog.color[0] : 0;
			const g = mode !== 0 ? fog.color[1] : 0;
			const b = mode !== 0 ? fog.color[2] : 0;
			if (
				mode !== this.currentFogMode ||
				near !== this.currentFogNear ||
				invRange !== this.currentFogInvRange ||
				density !== this.currentFogDensity
			) {
				_FOG_PARAMS[0] = mode;
				_FOG_PARAMS[1] = near;
				_FOG_PARAMS[2] = invRange;
				_FOG_PARAMS[3] = density;
				shader.setUniform("uFogParams", _FOG_PARAMS);
				this.currentFogMode = mode;
				this.currentFogNear = near;
				this.currentFogInvRange = invRange;
				this.currentFogDensity = density;
			}
			if (uniforms.uFogHeight != null) {
				const falloff = mode !== 0 ? fog.heightFalloff : 0;
				const height = mode !== 0 ? fog.fogHeight : 0;
				const camY = mode !== 0 ? fog.cameraY : 0;
				if (
					falloff !== this.currentFogFalloff ||
					height !== this.currentFogHeight ||
					camY !== this.currentFogCamY
				) {
					_FOG_HEIGHT[0] = falloff;
					_FOG_HEIGHT[1] = height;
					_FOG_HEIGHT[2] = camY;
					_FOG_HEIGHT[3] = 0;
					shader.setUniform("uFogHeight", _FOG_HEIGHT);
					this.currentFogFalloff = falloff;
					this.currentFogHeight = height;
					this.currentFogCamY = camY;
				}
			}
			if (
				uniforms.uFogColor != null &&
				(r !== this.currentFogR ||
					g !== this.currentFogG ||
					b !== this.currentFogB)
			) {
				_FOG_COLOR[0] = r;
				_FOG_COLOR[1] = g;
				_FOG_COLOR[2] = b;
				shader.setUniform("uFogColor", _FOG_COLOR);
				this.currentFogR = r;
				this.currentFogG = g;
				this.currentFogB = b;
			}
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
	 * @param {TextureAtlas} [texture] - bind this texture instead of the mesh's
	 * own — how a multi-material model's per-material `map_Kd` reaches the
	 * sampler, one draw range at a time (#1573). Everything else here is a
	 * property of the mesh, not of the material group.
	 * @returns {number} the texture unit the material landed on
	 * @ignore
	 */
	applyMeshMaterial(mesh, texture = mesh.texture) {
		// upload and activate the texture. The mesh's own `textureRepeat`
		// (when set) is threaded through as a per-use wrap override — sampler
		// state per mesh, never a mutation of the shared per-image atlas
		// (#1503). The unit cache keys by `(source, repeat)`, so meshes with
		// different wraps over one image coexist on distinct GL textures.
		const unit = this.uploadTexture(
			texture,
			undefined,
			undefined,
			false,
			true,
			mesh.textureRepeat,
		);
		this.bindSamplerUnit(unit);

		// Mesh textures sample their mip chain: `createTexture2D` already
		// runs `generateMipmap` for every plain image upload, but the min
		// filter stays LINEAR so the chain went unused — upgrade to
		// trilinear once per GL texture. `textureFilter: "nearest"` opts
		// out (crisp pixel-art models keep hard minification), and a sprite
		// sharing the exact (source, wrap) unit sees the same
		// last-writer-wins caveat as the `textureFilter` setting.
		const gl = this.gl;
		const glFilter =
			typeof texture.filter !== "undefined"
				? texture.filter
				: this.renderer._glTextureFilter();
		// the filter can be a GL enum (this backend's Mesh) or the string
		// form (an atlas first configured under a non-GL renderer)
		if (glFilter === gl.LINEAR || glFilter === "linear") {
			const glTexture = this.boundTextures[unit];
			const source =
				typeof texture.getTexture === "function" ? texture.getTexture() : null;
			// TextureResource-backed sources own their upload and carry no
			// generated chain — a mipmap min filter over their single level
			// is mipmap-incomplete under ES3 (samples opaque black), so they
			// stay on plain LINEAR. Videos re-upload every frame, which
			// resets MIN_FILTER back to LINEAR — re-apply the upgrade per
			// draw for them instead of trusting the once-per-texture set.
			const resourceOwned =
				source !== null && typeof source.upload === "function";
			const isVideo =
				source !== null && typeof source.videoWidth !== "undefined";
			if (
				typeof glTexture !== "undefined" &&
				!resourceOwned &&
				(isVideo || !this.trilinearTextures.has(glTexture))
			) {
				// uploads/bind tracking can skip real GL calls — force the
				// binding so the parameter lands on the right texture
				gl.activeTexture(gl.TEXTURE0 + unit);
				gl.bindTexture(gl.TEXTURE_2D, glTexture);
				gl.texParameteri(
					gl.TEXTURE_2D,
					gl.TEXTURE_MIN_FILTER,
					gl.LINEAR_MIPMAP_LINEAR,
				);
				if (this.maxAnisotropy > 1) {
					gl.texParameterf(
						gl.TEXTURE_2D,
						this.anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT,
						this.maxAnisotropy,
					);
				}
				this.trilinearTextures.add(glTexture);
			}
		}

		// Per-texel opacity map (MTL `map_d`), on its own texture unit. Bound
		// before the cutout uniform below because it feeds it: the map scales
		// alpha, the cutout thresholds the result.
		if (this.currentShader.uniforms.uHasAlphaMap !== undefined) {
			const alphaMap = mesh.alphaMap;
			// with no map the sampler points at the diffuse unit as filler and
			// the weight is 0, so nothing samples an unbound texture unit
			const alphaUnit =
				alphaMap !== undefined
					? this.uploadTexture(
							alphaMap,
							undefined,
							undefined,
							false,
							true,
							mesh.textureRepeat,
						)
					: unit;
			// change-guarded like every other per-mesh uniform here: an
			// unguarded pair costs two GL uniform calls on EVERY mesh draw,
			// and the overwhelmingly common case is "no alpha map, again"
			const hasAlphaMap = alphaMap !== undefined ? 1 : 0;
			if (
				alphaUnit !== this.currentAlphaMapUnit ||
				hasAlphaMap !== this.currentHasAlphaMap
			) {
				this.currentShader.setUniform("uAlphaMap", alphaUnit);
				this.currentShader.setUniform("uHasAlphaMap", hasAlphaMap);
				this.currentAlphaMapUnit = alphaUnit;
				this.currentHasAlphaMap = hasAlphaMap;
			}
			if (alphaMap !== undefined) {
				// uploading the alpha map moved the active sampler — put the
				// diffuse binding back before the draw reads it. Skipped when
				// there is no map: nothing moved, and re-setting `uSampler`
				// would double the sampler traffic of every ordinary mesh.
				this.bindSamplerUnit(unit);
			}
		}

		// Specular (MTL Ks + Ns). Guarded by the exponent, not the colour:
		// `Ns` of 0 is the format's "no highlight" however bright `Ks` is.
		if (this.currentShader.uniforms.uShininess !== undefined) {
			const shininess = mesh.shininess || 0;
			if (shininess !== this.currentShininess) {
				this.currentShader.setUniform("uShininess", shininess);
				this.currentShininess = shininess;
			}
			if (shininess > 0) {
				const ks = mesh.specular ?? _ZERO_EMISSIVE;
				if (
					ks[0] !== this.currentSpecularR ||
					ks[1] !== this.currentSpecularG ||
					ks[2] !== this.currentSpecularB
				) {
					this.currentShader.setUniform("uSpecular", ks);
					this.currentSpecularR = ks[0];
					this.currentSpecularG = ks[1];
					this.currentSpecularB = ks[2];
				}
			}
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
		return unit;
	}

	/**
	 * Point `uSampler` at a texture unit, if it moved and if the current
	 * shader has a sampler at all — a custom mesh shader that never samples
	 * (vertex colours only) declares none, and `setUniform` throws on an
	 * unknown name.
	 * @param {number} unit - the texture unit to sample from
	 * @ignore
	 */
	bindSamplerUnit(unit) {
		if (
			unit !== this.currentSamplerUnit &&
			this.currentShader.uniforms?.uSampler !== undefined
		) {
			this.currentShader.setUniform("uSampler", unit);
			this.currentSamplerUnit = unit;
		}
	}

	addMesh(mesh, tint) {
		this.updatePassState();

		const slices = mesh.textureGroups;
		if (slices === undefined) {
			this.applyMeshMaterial(mesh);
			// Placement uniforms. The view transform and the tint used to be
			// baked into every vertex on the CPU; they are uniforms now, so the
			// vertex data depends only on the geometry itself. This path (2D
			// camera / pre-projected vertices) supplies an identity model
			// matrix — the vertices already sit where they belong. A 2D camera
			// clears fog, so this resolves to the plain program.
			this.setPlacementUniforms(_IDENTITY_MATRIX, tint, mesh);
			this.accumulateRange(mesh, 0, mesh.indices.length);
			return;
		}
		// Multi-material with per-material textures (#1573): one accumulation
		// pass per range. `applyMeshMaterial` flushes on a texture change, so
		// the previous range's vertices land under the texture they were
		// accumulated for — and the uniforms are re-armed after that flush,
		// never before it.
		for (let i = 0; i < slices.length; i++) {
			this.applyMeshMaterial(mesh, slices[i].texture);
			this.setPlacementUniforms(_IDENTITY_MATRIX, tint, mesh);
			this.accumulateRange(mesh, slices[i].start, slices[i].count);
		}
	}

	/**
	 * Accumulate one index range of a mesh into the batch, chunking triangles
	 * across flushes as the vertex / index buffers fill.
	 * @param {object} mesh - a Mesh with vertices, uvs, indices, texture
	 * @param {number} from - first index to accumulate
	 * @param {number} length - how many indices to accumulate
	 * @ignore
	 */
	accumulateRange(mesh, from, length) {
		const vertices = mesh.vertices;
		const uvs = mesh.uvs;
		const indices = mesh.indices;
		const vertexColors = mesh.vertexColors;
		const until = from + length;

		const maxVerts = this.vertexData.maxVertex;
		const maxIndices = this.indexBuffer.data.length;

		// size the versioned-remap scratch for this mesh's vertex range (one-time
		// growth; reused across frames thereafter)
		ensureRemapCapacity(mesh.vertexCount);

		// process triangles in chunks that fit the buffer
		let triIdx = from;
		while (triIdx < until) {
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

			const endIdx = Math.min(triIdx + maxTris * 3, until);

			// build a local vertex remap for this chunk (shared reused
			// scratch — see gpu/meshchunk.ts). Capture the base offset
			// before pushing any vertices.
			const baseOffset = vertexData.vertexCount;
			const chunkIndices = beginChunk();
			let localCount = 0;

			for (let j = triIdx; j < endIdx; j++) {
				const origIdx = indices[j];
				let localIdx = remapIndex(origIdx);
				if (localIdx === -1) {
					localIdx = localCount++;
					assignIndex(origIdx, localIdx);

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
				chunkIndices.push(baseOffset + localIdx);
			}

			// add raw indices (already absolute, bypass rebasing) — addRaw
			// copies the values, so reusing the shared chunk list is safe
			this.indexBuffer.addRaw(chunkIndices);
			triIdx = endIdx;
		}
	}
}
