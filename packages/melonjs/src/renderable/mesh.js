import { game } from "../application/application.ts";
import Camera3d from "../camera/camera3d.ts";
import { Polygon } from "../geometries/polygon.ts";
import { getImage, getMTL, getOBJ } from "./../loader/loader.js";
import { Color } from "../math/color.ts";
import { Matrix3d } from "../math/matrix3d.ts";
import { Vector2d } from "../math/vector2d.ts";
import {
	convexHull,
	normalizeVertices,
	projectVertices,
} from "../math/vertex.ts";
import { AABB3d } from "../physics/broadphase/aabb3d.ts";
import Renderer from "./../video/renderer.js";
import { TextureAtlas } from "./../video/texture/atlas.js";
import Renderable from "./renderable.js";

/**
 * additional import for TypeScript
 * @import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../video/webgl/webgl_renderer.js";
 */

// reusable matrix for combining projection × model in draw()
const _combinedMatrix = new Matrix3d();

// Resolve any acceptable texture input (TextureAtlas, image / canvas
// object, or asset name) to a cached `TextureAtlas`. Throws if nothing
// resolves — Mesh requires a texture binding for its GL pipeline.
function resolveTextureAtlas(src) {
	if (src instanceof TextureAtlas) {
		return src;
	}
	const image = typeof src === "object" ? src : getImage(src);
	if (!image) {
		throw new Error("Mesh: '" + src + "' image/texture not found!");
	}
	return game.renderer.cache.get(image, {
		framewidth: image.width,
		frameheight: image.height,
	});
}

/**
 * Resolve an OBJ material group into a draw descriptor. Builds the
 * group's tint from the MTL's `Kd` (defaults to white if missing) and
 * its opacity from `d`. Returns a self-contained record carrying just
 * the index slice + color state — per-material textures (`map_Kd`)
 * are NOT modeled because the mesh shader uses a single `uSampler`
 * binding shared across the whole mesh; only colors are baked
 * per-vertex.
 * @param {{materialName: string|null, start: number, count: number}} group
 * @param {object} materials - MTL material table keyed by material name
 * @returns {{materialName: string|null, start: number, count: number, tint: Color, opacity: number}} draw descriptor for this group
 * @ignore
 */
function resolveGroupMaterial(group, materials) {
	const mat = group.materialName ? materials[group.materialName] : null;
	const tint = new Color(255, 255, 255, 1);
	let opacity = 1;
	if (mat) {
		if (mat.Kd) {
			tint.setColor(
				Math.round(mat.Kd[0] * 255),
				Math.round(mat.Kd[1] * 255),
				Math.round(mat.Kd[2] * 255),
			);
		}
		if (typeof mat.d === "number" && mat.d < 1) {
			opacity = mat.d;
		}
	}
	return {
		materialName: group.materialName,
		start: group.start,
		count: group.count,
		tint,
		opacity,
	};
}

/**
 * A renderable object for displaying textured triangle meshes.
 * Supports loading from Wavefront OBJ models (via `loader.preload` with type "obj")
 * or from raw geometry data (vertices, uvs, indices).
 * Includes a built-in perspective projection and supports 3D transforms
 * through the standard Renderable API (`rotate`, `scale`, `translate`).
 * Works on both WebGL (hardware depth testing) and Canvas (painter's algorithm) renderers.
 *
 * **Pivot — transforms are applied about the mesh's local origin `(0, 0, 0)`,
 * NOT a normalized anchor point.** Unlike a {@link Sprite} (whose
 * {@link Renderable#anchorPoint} recenters a `width`×`height` box), a mesh has
 * real vertex coordinates, so rotation and scale pivot around the model origin
 * the geometry is authored against — the standard convention for 3D meshes.
 * Place the origin where you want the pivot at authoring time (or nest the
 * mesh under a transformed parent to pivot elsewhere). Consequently, on the
 * `Camera3d` world-space path the mesh opts out of the anchor offset entirely
 * (see {@link Renderable#applyAnchorTransform}); the legacy 2D path still
 * honors `anchorPoint` for backward compatibility.
 * @category Game Objects
 */
export default class Mesh extends Renderable {
	/**
	 * @param {number} x - the x screen position of the mesh object
	 * @param {number} y - the y screen position of the mesh object
	 * @param {object} settings - Configuration parameters for the Mesh object
	 * @param {string} [settings.model] - name of a preloaded OBJ model (via loader.preload with type "obj")
	 * @param {Float32Array|number[]} [settings.vertices] - vertex positions as x,y,z triplets (alternative to settings.model)
	 * @param {Float32Array|number[]} [settings.uvs] - texture coordinates as u,v pairs (alternative to settings.model)
	 * @param {Uint16Array|number[]} [settings.indices] - triangle vertex indices (alternative to settings.model)
	 * @param {HTMLImageElement|TextureAtlas|string} [settings.texture] - the texture to apply (image name, HTMLImageElement, or TextureAtlas). If omitted and settings.material is provided, the texture is resolved from the MTL material's map_Kd.
	 * @param {string} [settings.material] - name of a preloaded MTL material (via loader.preload with type "mtl"). When provided, the diffuse texture (map_Kd), tint color (Kd), and opacity (d) are automatically applied.
	 * @param {number} settings.width - display width in pixels. With normalization on (the default) the model is scaled to fit this size; with `normalize: false` this is the uniform pixels-per-unit scale applied to the raw geometry.
	 * @param {number} [settings.height] - display height in pixels (normalized models only; ignored when `normalize: false`)
	 * @param {boolean} [settings.cullBackFaces=true] - enable backface culling
	 * @param {boolean} [settings.normalize=true] - fit the source geometry into a `[-0.5, 0.5]` unit cube before scaling, so `width`/`height` behave like a Sprite. Set `false` to keep the geometry's real-world coordinates — required when several meshes share one coordinate space (e.g. nodes of an imported glTF scene) so their relative scale and layout are preserved.
	 * @param {number} [settings.scale] - world-space scale (pixels per source unit) for the Camera3d path; defaults to `width`. Set this when `width`/`height` describe the renderable's world bounds (frustum culling) rather than the geometry scale — see {@link Mesh#meshScale}.
	 * @param {boolean} [settings.rightHanded=false] - treat the source as right-handed (Y-up, e.g. glTF) under the `Camera3d` world path. The default Y-up→Y-down bridge negates Y only (a reflection, which mirrors the scene left/right); `true` negates Y **and** Z (a rotation) so chirality is preserved and the result matches the authoring tool. See {@link Mesh#rightHanded}.
	 * @example
	 * // create from OBJ + MTL (texture auto-resolved from material)
	 * let mesh = new me.Mesh(0, 0, {
	 *     model: "fox",
	 *     material: "fox",
	 *     width: 200,
	 *     height: 200,
	 * });
	 *
	 * // create from OBJ with explicit texture (no MTL needed)
	 * let mesh = new me.Mesh(0, 0, {
	 *     model: "cube",
	 *     texture: "cube_texture",
	 *     width: 200,
	 *     height: 200,
	 * });
	 *
	 * // create from raw geometry that already carries its own world scale
	 * // (e.g. a glTF scene node) — keep real coordinates, no mirror
	 * let node = new me.Mesh(0, 0, {
	 *     vertices: positions, // Float32Array of x,y,z triplets
	 *     uvs: texcoords,      // Float32Array of u,v pairs
	 *     indices: tris,       // Uint16Array of triangle indices
	 *     texture: baseColorImage,
	 *     width: 32,           // pixels per unit
	 *     normalize: false,
	 *     rightHanded: true,
	 * });
	 *
	 * // 3D rotation using the standard rotate() API
	 * mesh.rotate(Math.PI / 4, new me.Vector3d(0, 1, 0)); // rotate around Y axis
	 *
	 * // 2D rotation (Z axis, same as Sprite)
	 * mesh.rotate(Math.PI / 4);
	 */
	constructor(x, y, settings) {
		super(x, y, settings.width, settings.height);

		// load geometry from OBJ model or raw data
		let objGroups = null;
		if (typeof settings.model === "string") {
			const objData = getOBJ(settings.model);
			if (!objData) {
				throw new Error("Mesh: '" + settings.model + "' OBJ model not found!");
			}
			/**
			 * the original (untransformed) vertex positions as x,y,z triplets
			 * @type {Float32Array}
			 */
			this.originalVertices = objData.vertices;

			/**
			 * texture coordinates as u,v pairs
			 * @type {Float32Array}
			 */
			this.uvs = objData.uvs;

			/**
			 * triangle indices
			 * @type {Uint16Array}
			 */
			this.indices = objData.indices;

			/**
			 * number of vertices
			 * @type {number}
			 */
			this.vertexCount = objData.vertexCount;

			// pick up the material-group list emitted by the OBJ parser
			// (always non-null for non-empty models thanks to the
			// parser's "anonymous group" fallback)
			objGroups = objData.groups;
		} else {
			this.originalVertices =
				settings.vertices instanceof Float32Array
					? settings.vertices
					: new Float32Array(settings.vertices);
			this.uvs =
				settings.uvs instanceof Float32Array
					? settings.uvs
					: new Float32Array(settings.uvs);
			// Preserve a typed index buffer as-is — coercing a Uint32Array to
			// Uint16Array would truncate index values > 65535, silently
			// corrupting meshes with more than 65535 vertices (the glTF parser
			// emits Uint32 indices for exactly that case). Only a plain JS
			// array is materialized, as Uint16 (the small-mesh default). The
			// batcher chunks large meshes into ≤maxVertices flushes, so its own
			// index buffer never needs more than 16 bits regardless.
			this.indices =
				settings.indices instanceof Uint16Array ||
				settings.indices instanceof Uint32Array
					? settings.indices
					: new Uint16Array(settings.indices);
			this.vertexCount = this.originalVertices.length / 3;
		}

		// Capture the original winding once at construction so the
		// Camera3d world-space path can swap to a reversed copy without
		// losing the ability to restore the original (see
		// `_setupWorldSpace` for the rationale). Same reference — we
		// never mutate it in place.
		this._indicesOriginal = this.indices;

		// working array for projected vertices (updated each frame in draw)
		/**
		 * the projected vertex positions, updated each draw call
		 * @type {Float32Array}
		 */
		this.vertices = new Float32Array(this.vertexCount * 3);

		/**
		 * the source per-vertex normals (x,y,z triplets), or `undefined` if the
		 * mesh was built without them. Supplied by the glTF loader; used for
		 * lit shading under a `Camera3d` (see {@link LightingEnvironment}).
		 * @type {Float32Array|undefined}
		 */
		this.originalNormals =
			settings.normals !== undefined
				? settings.normals instanceof Float32Array
					? settings.normals
					: new Float32Array(settings.normals)
				: undefined;

		/**
		 * world-space normals for the current draw, recomputed from
		 * {@link Mesh#originalNormals} along the Camera3d path. Empty (zero) when
		 * the mesh has no source normals — the shader then ignores lighting.
		 * @type {Float32Array}
		 */
		this.normals = new Float32Array(this.vertexCount * 3);

		/**
		 * Whether this mesh is lit by the active {@link LightingEnvironment}.
		 * When `true` it renders through the lit mesh batcher (diffuse shading
		 * from the scene's lights, using {@link Mesh#originalNormals}); when
		 * `false` (the default) it uses the lean unlit path and pays no lighting
		 * cost. The glTF loader sets this on scene meshes when the scene has
		 * lights. Only meaningful under a `Camera3d` + WebGL.
		 * @type {boolean}
		 * @default false
		 */
		this.lit = settings.lit === true;

		/**
		 * whether to cull back-facing triangles
		 * @type {boolean}
		 * @default true
		 */
		this.cullBackFaces =
			settings.cullBackFaces !== undefined ? settings.cullBackFaces : true;

		/**
		 * Treat the source geometry as right-handed (Y-up, e.g. glTF) under
		 * the Camera3d world path. The default (`false`) Y-up→Y-down bridge
		 * negates Y only — a reflection, which mirrors the scene left/right.
		 * When `true`, the bridge negates Y **and** Z (a 180° rotation about
		 * X, determinant +1) so chirality is preserved and the result matches
		 * the authoring tool (no mirror); triangle winding is left untouched
		 * since a rotation doesn't invert it.
		 * @type {boolean}
		 * @default false
		 */
		this.rightHanded = settings.rightHanded === true;

		/**
		 * Uniform world-space scale (pixels per source unit) applied along the
		 * Camera3d world path. Defaults to `width`. Scene loaders (e.g. glTF)
		 * set this independently of `width` / `height` so those can describe
		 * the renderable's world-space bounds (used for frustum culling) while
		 * the geometry is still scaled by this factor — `width` alone can't
		 * serve both roles for a non-normalized scene mesh.
		 * @type {number}
		 * @default settings.width
		 */
		this.meshScale =
			typeof settings.scale === "number" ? settings.scale : this.width;

		// resolve material (MTL) — applies texture, tint, and opacity.
		// Two paths:
		// - Single-material: pick the first MTL entry, apply to the whole
		//   mesh (legacy behavior, unchanged).
		// - Multi-material: build a per-group descriptor with each
		//   group's texture, tint, and opacity resolved from its own MTL
		//   entry. `draw()` later iterates the groups and swaps state
		//   per draw.
		let textureSource = settings.texture;
		const materials =
			typeof settings.material === "string" ? getMTL(settings.material) : null;
		const isMultiMaterial =
			materials !== null &&
			objGroups !== null &&
			objGroups.length > 1 &&
			objGroups.some((g) => {
				return g.materialName !== null;
			});

		if (isMultiMaterial) {
			/**
			 * Per-material submesh groups, populated when the OBJ
			 * contains multiple `usemtl` directives AND a matching MTL
			 * is bound via the `material` setting. Each entry slices
			 * the shared `indices` buffer; field shape (`start`,
			 * `count`, `materialName`) matches the glTF "groups"
			 * convention.
			 *
			 * Under the per-vertex color baking path (tier 2), the
			 * `tint` / `opacity` fields here are informational — the
			 * actual rendered color is baked into `vertexColors` at
			 * construction time. Mutating `groups[i].tint` after
			 * construction has no visible effect; use `mesh.tint` for
			 * runtime color multiplication, or rebuild the Mesh with
			 * new material settings.
			 * @type {Array<{materialName: string|null, start: number,
			 *   count: number, tint: Color, opacity: number}>}
			 */
			this.groups = objGroups.map((g) => {
				return resolveGroupMaterial(g, materials);
			});
			// `this.tint` stays at its default (white) — every
			// material's Kd is already baked into `vertexColors` below,
			// so applying the first group's tint globally would double-
			// multiply it onto every vertex at render time. The
			// renderer-level `setTint` path on top of the baked colors
			// is still available for runtime flash / fade / team color.
			// Per-material `map_Kd` textures are not switched at draw
			// time (mesh shader has a single `uSampler`); pick up the
			// first material's `map_Kd` for the shared texture binding
			// if any group has one, else fall through to the white-
			// pixel fallback further down.
			if (!textureSource) {
				for (const g of objGroups) {
					const mat = g.materialName ? materials[g.materialName] : null;
					if (mat && mat.map_Kd) {
						textureSource = mat.map_Kd;
						break;
					}
				}
			}

			/**
			 * Per-vertex color buffer (one packed Uint32 per vertex)
			 * populated for multi-material meshes. The mesh batcher
			 * reads from this when present, pushing the per-vertex
			 * color as the `aColor` attribute — so multi-material
			 * rendering needs no extra draw calls per material vs
			 * single-material rendering (the batcher still chunks
			 * very large meshes across multiple draws to fit its
			 * vertex/index buffer limits, same as the single-material
			 * path). Multiplied at render time by the global
			 * `mesh.tint`, so runtime tint mutation still works as
			 * expected (flash, fade, team color, etc.).
			 *
			 * Vertices were split per-material at parse time (each
			 * material has its own dedup scope in the OBJ parser), so
			 * every vertex belongs to exactly one material group and
			 * carries that group's color unambiguously.
			 * @type {Uint32Array}
			 */
			this.vertexColors = new Uint32Array(this.vertexCount);
			for (const g of this.groups) {
				const c = g.tint.toUint32(g.opacity);
				const end = g.start + g.count;
				for (let i = g.start; i < end; i++) {
					this.vertexColors[this.indices[i]] = c;
				}
			}
		} else if (materials) {
			// Single-material path. Prefer the MTL entry whose name
			// matches the OBJ's `usemtl` directive — an OBJ with one
			// `usemtl jet_body` referencing a `.mtl` that defines
			// `jet_body` alongside other materials should pick
			// `jet_body`, not whichever entry happens to be first in
			// the MTL parser's output. Fall back to the first entry
			// when there's no `usemtl` at all (the parser emits a
			// `materialName: null` anonymous group in that case).
			const namedMaterial =
				objGroups !== null && objGroups[0] && objGroups[0].materialName
					? materials[objGroups[0].materialName]
					: null;
			const mat = namedMaterial ?? materials[Object.keys(materials)[0]];
			if (mat) {
				if (!textureSource && mat.map_Kd) {
					textureSource = mat.map_Kd;
				}
				if (mat.Kd) {
					this.tint.setColor(
						Math.round(mat.Kd[0] * 255),
						Math.round(mat.Kd[1] * 255),
						Math.round(mat.Kd[2] * 255),
					);
				}
				if (mat.d < 1.0) {
					this.setOpacity(mat.d);
				}
			}
		}

		// resolve texture. Fall back to the shared 1×1 white pixel when
		// no texture source was resolved — covers Kd-only multi-material
		// models (Kenney style) AND single-material meshes constructed
		// without a `texture:` or a `map_Kd`-bearing `material:` (the
		// GPU pipeline still needs something to sample; tint / per-
		// vertex color does the actual coloring).
		if (!textureSource) {
			textureSource = Renderer.getWhitePixel();
		}
		this.texture = resolveTextureAtlas(textureSource);

		/**
		 * Projection matrix applied automatically before the model transform in draw().
		 * Defaults to a perspective projection (45° FOV, camera at z=-2.5) suitable for
		 * viewing unit-cube-sized geometry. Set to identity for orthographic (flat) projection.
		 * Most users don't need to modify this — the default works for standard OBJ models.
		 * @type {Matrix3d}
		 */
		this.projectionMatrix = new Matrix3d();
		this.projectionMatrix.perspective(Math.PI / 4, 1, 0.1, 10);
		this.projectionMatrix.translate(0, 0, -2.5);

		// normalize original vertices to fit within [-0.5, 0.5] range
		// so that width/height scaling works like Sprite. Scene meshes
		// (e.g. a glTF node that already carries its own world transform
		// and shares a coordinate space with sibling meshes) opt out via
		// `normalize: false` to preserve real-world scale across the scene.
		if (settings.normalize !== false) {
			normalizeVertices(this.originalVertices);
		}

		this.anchorPoint.set(0.5, 0.5);

		// skip applying the 3D transform to the 2D renderer context in preDraw
		// the full 3D transform is applied to vertices in draw() instead
		this.autoTransform = false;

		// pre-allocate points array and polygon for toPolygon() (avoids per-call allocation)
		/** @ignore */
		this._hullPoints = Array.from({ length: this.vertexCount }, () => {
			return new Vector2d();
		});
		/** @ignore */
		this._hullPolygon = null;
	}

	/**
	 * Project all vertices through projectionMatrix × currentTransform
	 * and store the results in `this.vertices`.
	 * @param {number} [offsetX=0] - x offset added to each projected vertex
	 * @param {number} [offsetY=0] - y offset added to each projected vertex
	 * @param {number} [zScale=0] - scale factor for Z output (0 = skip Z, 1000 = depth buffer range)
	 * @ignore
	 */
	_projectVertices(offsetX = 0, offsetY = 0, zScale = 0) {
		_combinedMatrix.copy(this.projectionMatrix);
		_combinedMatrix.multiply(this.currentTransform);
		projectVertices(
			this.originalVertices,
			this.vertices,
			this.vertexCount,
			_combinedMatrix.val,
			this.width,
			this.height,
			offsetX,
			offsetY,
			zScale,
		);
	}

	/**
	 * Project vertices into **world space** for the Camera3d render path.
	 * Bypasses {@link Mesh#projectionMatrix} (the self-contained
	 * perspective that's meaningful only under Camera2d) and emits
	 * vertices that the active 3D camera then projects via its own
	 * view + projection matrices, the same way it does for Sprites.
	 *
	 * Per-vertex math: `currentTransform × originalVertex`, then a uniform
	 * scale by `this.width`, the Y-up→Y-down bridge (negate Y, and also Z when
	 * {@link Mesh#rightHanded} is set so the bridge is a rotation rather than a
	 * mirror), and a translate to `(offsetX, offsetY, offsetZ)`.
	 *
	 * @param {number} offsetX - world X to place the mesh center at
	 * @param {number} offsetY - world Y to place the mesh center at
	 * @param {number} offsetZ - world Z to place the mesh center at
	 * @ignore
	 */
	_projectVerticesWorld(offsetX, offsetY, offsetZ) {
		const out = this.vertices;
		const src = this.originalVertices;
		const scale = this.meshScale;
		const m = this.currentTransform.val;
		// Include the translation column (m[12..14]) — a proper
		// matrix-vector multiplication treats the vertex as
		// `(vx, vy, vz, 1)` so the translation column gets added
		// once. Previously the loop only used the rotation/scale
		// columns, which silently dropped `mesh.translate(x, y, z)`
		// under Camera3d while the Camera2d path (via
		// `projectVertices` in vertex.ts) honored it.
		const tx = m[12];
		const ty = m[13];
		const tz = m[14];
		// right-handed source (glTF): negate Z as well as Y so the Y-up→
		// Y-down bridge is a rotation (det +1, no mirror) rather than a
		// reflection. Left-handed default keeps Z as-is (legacy reflection).
		const zSign = this.rightHanded ? -1 : 1;

		for (let i = 0; i < this.vertexCount; i++) {
			const i3 = i * 3;
			const vx = src[i3];
			const vy = src[i3 + 1];
			const vz = src[i3 + 2];

			const rx = m[0] * vx + m[4] * vy + m[8] * vz + tx;
			const ry = m[1] * vx + m[5] * vy + m[9] * vz + ty;
			const rz = m[2] * vx + m[6] * vy + m[10] * vz + tz;

			out[i3] = rx * scale + offsetX;
			out[i3 + 1] = -ry * scale + offsetY;
			out[i3 + 2] = zSign * rz * scale + offsetZ;
		}
	}

	/**
	 * Project {@link Mesh#originalNormals} into world space for lit shading,
	 * storing the result in {@link Mesh#normals}. Applies the rotation/scale of
	 * {@link Renderable#currentTransform} (no translation), the same Y-down /
	 * `rightHanded` Y/Z bridge as {@link Mesh#_projectVerticesWorld}, then
	 * renormalizes. No-op when the mesh has no source normals.
	 *
	 * Note: uses the transform's rotation/scale columns directly rather than
	 * the inverse-transpose, so normals are exact under rotation + uniform
	 * scale (the common case); a strongly non-uniform scale would skew them
	 * slightly — acceptable for the diffuse lighting path.
	 * @ignore
	 */
	_projectNormalsWorld() {
		const src = this.originalNormals;
		if (src === undefined) {
			return;
		}
		const out = this.normals;
		const m = this.currentTransform.val;
		const zSign = this.rightHanded ? -1 : 1;
		for (let i = 0; i < this.vertexCount; i++) {
			const i3 = i * 3;
			const nx = src[i3];
			const ny = src[i3 + 1];
			const nz = src[i3 + 2];
			const rx = m[0] * nx + m[4] * ny + m[8] * nz;
			const ry = -(m[1] * nx + m[5] * ny + m[9] * nz); // Y-down flip
			const rz = zSign * (m[2] * nx + m[6] * ny + m[10] * nz);
			const len = Math.hypot(rx, ry, rz);
			if (len > 1e-8) {
				out[i3] = rx / len;
				out[i3 + 1] = ry / len;
				out[i3 + 2] = rz / len;
			} else {
				// degenerate normal → fall back to +Y (a unit vector) rather
				// than zero: the shader does `normalize(vNormal)`, and
				// normalize((0,0,0)) is NaN (black/garbage fragment).
				out[i3] = 0;
				out[i3 + 1] = 1;
				out[i3 + 2] = 0;
			}
		}
	}

	/**
	 * Build the winding-reversed indices buffer used by the Camera3d
	 * world-space path. Called once, lazily, the first time the mesh
	 * draws under Camera3d. Why: the world-space path Y-flips vertices
	 * on output (a reflection, det = -1), which inverts triangle
	 * winding in screen space. Without the swap, `cullBackFaces: true`
	 * would end up culling the front faces and the model would look
	 * hollow.
	 *
	 * Both buffers are kept alive — `_indicesOriginal` is the original
	 * OBJ-shared (or user-supplied) winding, `_indicesReversed` is the
	 * Camera3d-flipped copy. `draw()` swaps `this.indices` between them
	 * each frame based on the active camera, so a Mesh that was first
	 * drawn under Camera3d and later re-parented to a Camera2d stage
	 * (e.g. a level transition into a 2D minigame) gets its original
	 * winding back and stays correctly oriented under
	 * `cullBackFaces: true`.
	 * @ignore
	 */
	_setupWorldSpace() {
		// Only the reflection bridge (left-handed, Y-only negate) inverts
		// winding and needs the reversed copy. `rightHanded` meshes (all glTF
		// scenes) use a rotation bridge that preserves winding, so they keep
		// `_indicesOriginal` and never read the reversed buffer — skip the
		// allocation entirely for them.
		if (this.rightHanded !== true) {
			const src = this._indicesOriginal;
			// match the source index type (Uint16Array OR Uint32Array): a copy
			// into a hard-coded Uint16Array would truncate indices for meshes
			// with > 65535 vertices.
			const Ctor = src.constructor;
			const dst = new Ctor(src.length);
			for (let i = 0; i < src.length; i += 3) {
				dst[i] = src[i];
				dst[i + 1] = src[i + 2];
				dst[i + 2] = src[i + 1];
			}
			this._indicesReversed = dst;
		}
		this._worldSpace = true;
	}

	/**
	 * Resolve the projection mode once when the mesh enters the world.
	 * The active stage's camera class determines which path `draw()` takes
	 * for the rest of the mesh's lifetime — no per-frame branch is needed,
	 * and we don't depend on the `me.game` singleton during the draw loop.
	 *
	 * Detection walks the ancestor chain to the root container, which is
	 * the active stage's world (Stage.world). The world's `_currentCamera`
	 * is set by the stage at draw time, but we can instead read off the
	 * mesh's already-set ancestors against the active viewport — at this
	 * point in the engine lifecycle, `game.viewport` is the right camera
	 * to use as the source of truth, captured here ONCE rather than per
	 * frame.
	 * @ignore
	 */
	onActivateEvent(...args) {
		super.onActivateEvent(...args);
		this._useWorldSpace = game.viewport instanceof Camera3d;
	}

	/**
	 * The mesh's world-space 3D axis-aligned bounding box, as projected by the
	 * most recent draw. This is the 3D analog of {@link Renderable#getBounds}
	 * (which returns a flat 2D box from `width`/`height` and so cannot describe
	 * a mesh's real extent).
	 *
	 * Under a `Camera3d` the mesh projects its vertices into world space every
	 * frame (see {@link Mesh#_projectVerticesWorld}), so the returned box tracks
	 * the live transform / animation. Under the 2D path the projected vertices
	 * are screen-space, so the box is only meaningful after a Camera3d draw —
	 * use {@link Renderable#getBounds} for the 2D case.
	 *
	 * The same {@link AABB3d} instance is returned each call (recomputed in
	 * place), so copy it (`.clone()`) if you need to keep it.
	 * @returns {AABB3d} the world-space bounding box (reused instance)
	 */
	getBounds3d() {
		if (this._bounds3d === undefined) {
			/** @ignore */
			this._bounds3d = new AABB3d();
		}
		// `this.vertices` holds the last draw's world-space positions under
		// Camera3d — bound them directly (identity matrix). Delegates the
		// min/max sweep to AABB3d.fromVertices → transformedBounds.
		return this._bounds3d.fromVertices(this.vertices, this.vertexCount);
	}

	/**
	 * Prepare the renderer for drawing the mesh. On the `Camera3d` world-space
	 * path the mesh emits final world coordinates, so it opts out of the base
	 * anchor-point offset ({@link Renderable#applyAnchorTransform} = `false`) —
	 * otherwise the offset would leak into the shared mesh view matrix. The 2D
	 * path keeps the anchor. See the class description for the pivot rationale.
	 * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
	 */
	preDraw(renderer) {
		// world-space meshes pivot about their own origin, not a bounds-box
		// anchor (see Mesh class doc + Renderable#applyAnchorTransform)
		this.applyAnchorTransform = this._useWorldSpace !== true;
		super.preDraw(renderer);
	}

	/**
	 * Draw the mesh (automatically called by melonJS). Picks between two
	 * projection paths based on the camera that was active when this mesh
	 * was added to the world (captured in {@link Mesh#onActivateEvent}):
	 *
	 * - **Camera3d** → world-space output via {@link Mesh#_projectVerticesWorld}.
	 *   Vertices land in world coordinates at `(pos.x, pos.y, depth)`; the
	 *   camera's perspective handles the final projection per-frame on the
	 *   GPU. Triangle winding is reversed once at first draw so back-face
	 *   culling stays correct under the Y-flip.
	 * - **Camera2d** (or no camera) → legacy self-projection via
	 *   {@link Mesh#projectionMatrix} × {@link Renderable#currentTransform},
	 *   emitting vertices in pixel-ish space directly. Backwards-compatible
	 *   with single-mesh-in-a-2D-scene usage.
	 *
	 * Multi-material meshes need no extra `drawMesh` calls per material vs
	 * single-material — each material's diffuse color is baked into
	 * `vertexColors` at construction time and pushed through the renderer's
	 * per-vertex `aColor` (WebGL) or per-triangle solid-fill (Canvas) path.
	 * The WebGL batcher may still chunk very large meshes across multiple
	 * `drawElements` calls to fit its vertex/index buffer limits.
	 *
	 * The active path is picked from the `viewport` passed in by
	 * `Container.draw`, NOT from the activation-time `_useWorldSpace`
	 * flag. The flag is kept as a fallback only for callers that
	 * invoke `draw(renderer)` without a viewport (tests, batched
	 * builds). Without the per-draw read, a stage with multiple
	 * cameras (Camera3d main + Camera2d minimap, say) would run the
	 * wrong projection on whichever camera didn't match activation.
	 * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
	 * @param {Camera2d} [viewport] - the camera rendering this frame
	 */
	draw(renderer, viewport) {
		// Prefer the live viewport (per-draw) over the flag captured
		// at activation. Falling back to the flag when no viewport is
		// passed preserves test callers that call `draw(renderer)`
		// directly.
		const useWorldSpace =
			viewport !== undefined
				? viewport instanceof Camera3d
				: this._useWorldSpace === true;
		if (useWorldSpace) {
			if (this._worldSpace !== true) {
				this._setupWorldSpace();
			}
			// Camera3d path. The reflection bridge (Y-only negate) inverts
			// winding, so it needs the reversed indices to keep
			// `cullBackFaces: true` correct. The rotation bridge
			// (`rightHanded`: Y+Z negate) preserves winding, so the
			// original indices are already correct.
			this.indices = this.rightHanded
				? this._indicesOriginal
				: this._indicesReversed;
			// Emit FINAL world coordinates: the node origin is baked into
			// pos/depth and the geometry carries its own extent. The anchor
			// offset is suppressed for this path via `applyAnchorTransform`
			// (set in `preDraw`), so it does not leak into the view matrix.
			this._projectVerticesWorld(this.pos.x, this.pos.y, this.depth);
			// world-space normals — only when this mesh is lit (the unlit batcher
			// never reads `normals`, so projecting them otherwise is wasted
			// per-frame work; glTF meshes carry normals even when the scene has
			// no lights). No-op without source normals.
			if (this.lit === true) {
				this._projectNormalsWorld();
			}
		} else {
			// Camera2d / no-camera path: restore the original winding.
			// Important when the same Mesh instance was previously drawn
			// under Camera3d (`_setupWorldSpace` ran) and is now being
			// re-rendered under a 2D camera — without this restore the
			// reversed indices stay in place and front-facing triangles
			// get culled, leaving the model looking inside-out.
			this.indices = this._indicesOriginal;
			this._projectVertices(this.pos.x, this.pos.y, 1000);
		}
		renderer.drawMesh(this);
	}

	/**
	 * Compute a 2D convex hull polygon from the current projected vertices.
	 * Useful for creating collision shapes.
	 * @returns {Polygon} a convex hull polygon in local coordinates
	 */
	toPolygon() {
		// update cached points from projected vertices
		for (let i = 0; i < this.vertexCount; i++) {
			this._hullPoints[i].set(this.vertices[i * 3], this.vertices[i * 3 + 1]);
		}

		// Graham scan convex hull (sorts in place, returns a subset)
		const hull = convexHull(this._hullPoints);

		if (this._hullPolygon === null) {
			this._hullPolygon = new Polygon(0, 0, hull);
		} else {
			this._hullPolygon.setVertices(hull);
		}

		return this._hullPolygon;
	}

	/**
	 * Render the mesh at its current state (transforms, projection, tint) to an offscreen canvas.
	 * The returned canvas can be used with `renderer.drawImage()`, as a `Sprite` image source,
	 * or converted to an ImageBitmap via `createImageBitmap()`.
	 * @returns {HTMLCanvasElement} an offscreen canvas containing the rendered mesh
	 * @example
	 * // snapshot the mesh and create a Sprite from it
	 * const canvas = mesh.toCanvas();
	 * const sprite = new me.Sprite(100, 100, { image: canvas });
	 *
	 * // or draw directly
	 * renderer.drawImage(mesh.toCanvas(), 100, 100);
	 */
	toCanvas() {
		const w = this.width;
		const h = this.height;

		// project vertices into local space (no pos offset, no Z)
		this._projectVertices(0, 0, false);

		// render to offscreen canvas using affine texture mapping
		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");

		const image = this.texture.getTexture();
		const imgW = image.width;
		const imgH = image.height;
		const uvs = this.uvs;
		const indices = this.indices;
		const vertices = this.vertices;
		const cullBack = this.cullBackFaces === true;

		// build visible triangles sorted back-to-front
		const tris = [];
		for (let j = 0; j < indices.length; j += 3) {
			const i0 = indices[j];
			const i1 = indices[j + 1];
			const i2 = indices[j + 2];
			const x0 = vertices[i0 * 3];
			const y0 = vertices[i0 * 3 + 1];
			const x1 = vertices[i1 * 3];
			const y1 = vertices[i1 * 3 + 1];
			const x2 = vertices[i2 * 3];
			const y2 = vertices[i2 * 3 + 1];

			if (cullBack) {
				const cross = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
				if (cross > 0) {
					continue;
				}
			}

			tris.push(i0, i1, i2);
		}

		// draw each triangle
		for (let t = 0; t < tris.length; t += 3) {
			const i0 = tris[t];
			const i1 = tris[t + 1];
			const i2 = tris[t + 2];
			const x0 = vertices[i0 * 3];
			const y0 = vertices[i0 * 3 + 1];
			const x1 = vertices[i1 * 3];
			const y1 = vertices[i1 * 3 + 1];
			const x2 = vertices[i2 * 3];
			const y2 = vertices[i2 * 3 + 1];

			const u0 = uvs[i0 * 2] * imgW;
			const v0 = uvs[i0 * 2 + 1] * imgH;
			const u1 = uvs[i1 * 2] * imgW;
			const v1 = uvs[i1 * 2 + 1] * imgH;
			const u2 = uvs[i2 * 2] * imgW;
			const v2 = uvs[i2 * 2 + 1] * imgH;

			const du1 = u1 - u0;
			const dv1 = v1 - v0;
			const du2 = u2 - u0;
			const dv2 = v2 - v0;
			const rawDet = du1 * dv2 - du2 * dv1;

			ctx.save();
			ctx.beginPath();
			ctx.moveTo(x0, y0);
			ctx.lineTo(x1, y1);
			ctx.lineTo(x2, y2);

			if (rawDet === 0) {
				// degenerate UV — fill with sampled solid color
				ctx.closePath();
				const tmpCanvas = document.createElement("canvas");
				tmpCanvas.width = 1;
				tmpCanvas.height = 1;
				const tmpCtx = tmpCanvas.getContext("2d");
				const sx = Math.min(Math.max(Math.round(u0), 0), imgW - 1);
				const sy = Math.min(Math.max(Math.round(v0), 0), imgH - 1);
				tmpCtx.drawImage(image, sx, sy, 1, 1, 0, 0, 1, 1);
				const pixel = tmpCtx.getImageData(0, 0, 1, 1).data;
				ctx.fillStyle = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
				ctx.fill();
			} else {
				const dx1 = x1 - x0;
				const dy1 = y1 - y0;
				const dx2 = x2 - x0;
				const dy2 = y2 - y0;
				const det = 1 / rawDet;
				const a = (dv2 * dx1 - dv1 * dx2) * det;
				const b = (dv2 * dy1 - dv1 * dy2) * det;
				const c = (du1 * dx2 - du2 * dx1) * det;
				const d = (du1 * dy2 - du2 * dy1) * det;

				ctx.clip();
				ctx.transform(a, b, c, d, x0 - a * u0 - c * v0, y0 - b * u0 - d * v0);
				ctx.drawImage(image, 0, 0);
			}
			ctx.restore();
		}

		return canvas;
	}

	/**
	 * Render the mesh at its current state to an ImageBitmap.
	 * Useful for creating textures or sprites from the rendered mesh.
	 * @returns {Promise<ImageBitmap>} a promise that resolves to an ImageBitmap of the rendered mesh
	 * @example
	 * const bitmap = await mesh.toImageBitmap();
	 * const sprite = new me.Sprite(100, 100, { image: bitmap });
	 */
	toImageBitmap() {
		return createImageBitmap(this.toCanvas());
	}
}
