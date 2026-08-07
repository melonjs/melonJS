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
import Texture2d from "./../video/texture/texture2d.ts";
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
// `framewidth`/`frameheight` define the spritesheet cell size (defaulting
// to the whole image); a subclass like Sprite3d passes them so the atlas
// carries an animation frame grid.
function resolveTextureAtlas(src, framewidth, frameheight) {
	if (src instanceof TextureAtlas) {
		return src;
	}
	// a non-atlas Texture2d (e.g. a procedural NoiseTexture2d) is bound via its
	// baked source; an image/canvas object flows through; a {string} is a key.
	let image;
	if (src instanceof Texture2d) {
		image = src.getTexture();
	} else if (typeof src === "object") {
		image = src;
	} else {
		image = getImage(src);
	}
	if (!image) {
		throw new Error("Mesh: '" + src + "' image/texture not found!");
	}
	return game.renderer.cache.get(image, {
		framewidth: framewidth || image.width,
		frameheight: frameheight || image.height,
	});
}

/**
 * Normalize an emissive color input (`[r, g, b]` array / Float32Array, or
 * nullish) into a `Float32Array(3)`, or `undefined` when there's no emission
 * (nullish or all-zero) so the Mesh stays on the lean no-emissive path.
 * @param {number[]|Float32Array|undefined|null} src
 * @returns {Float32Array|undefined}
 * @ignore
 */
function toEmissive(src) {
	if (src === undefined || src === null) {
		return undefined;
	}
	const r = src[0] || 0;
	const g = src[1] || 0;
	const b = src[2] || 0;
	if (r === 0 && g === 0 && b === 0) {
		return undefined;
	}
	return new Float32Array([r, g, b]);
}

/**
 * Resolve an OBJ material group into a draw descriptor. Builds the
 * group's tint from the MTL's `Kd` (defaults to white if missing) and
 * its opacity from `d`. Returns a self-contained record carrying the
 * index slice + color state; the group's own diffuse texture is filled
 * in afterwards by {@link buildTextureGroups}, once the mesh-level
 * fallback texture is known.
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
		texture: undefined,
	};
}

/**
 * Resolve each material group's own diffuse texture (`map_Kd`) and reduce
 * the result to the shortest list of index ranges that have to be drawn
 * with distinct textures (#1573).
 *
 * A group whose material declares no `map_Kd` keeps the mesh-level texture,
 * so a model mixing textured and `Kd`-only materials still draws in one
 * binding wherever it can. Adjacent ranges resolving to the same
 * `TextureAtlas` are merged — the atlas cache is keyed by image, so two
 * materials pointing at one file coalesce by identity rather than by
 * comparing names — and a model that ends up with a single texture returns
 * `undefined`, which keeps the common single-material case on exactly the
 * draw-call count it had before.
 *
 * A `map_Kd` naming an image that was never preloaded warns and falls back
 * to the mesh texture rather than throwing: only the first material's
 * `map_Kd` used to be resolved at all, so a partially-preloaded model that
 * rendered before must keep rendering.
 * @param {Array<object>} groups - the material groups, mutated in place to carry their resolved `texture`
 * @param {object} materials - MTL material table keyed by material name
 * @param {TextureAtlas} shared - the mesh-level texture, used by groups with no `map_Kd` of their own
 * @param {number} [framewidth] - spritesheet cell width, as passed to the Mesh
 * @param {number} [frameheight] - spritesheet cell height, as passed to the Mesh
 * @returns {Array<{texture: TextureAtlas, start: number, count: number}>|undefined} the per-texture draw ranges, or `undefined` when one binding covers the whole mesh
 * @ignore
 */
function buildTextureGroups(
	groups,
	materials,
	shared,
	framewidth,
	frameheight,
) {
	let distinct = false;
	for (const group of groups) {
		const mat = group.materialName ? materials[group.materialName] : null;
		let texture = shared;
		if (mat?.map_Kd) {
			try {
				texture = resolveTextureAtlas(mat.map_Kd, framewidth, frameheight);
			} catch {
				console.warn(
					`melonJS: Mesh material "${group.materialName}" references the texture "${mat.map_Kd}", which is not loaded — that material falls back to the mesh texture`,
				);
			}
		}
		group.texture = texture;
		if (texture !== shared) {
			distinct = true;
		}
	}
	if (distinct === false) {
		return undefined;
	}

	const slices = [];
	for (const group of groups) {
		// an empty group (two `usemtl` directives in a row) would emit a
		// zero-index draw and, worse, break the adjacency test below
		if (group.count === 0) {
			continue;
		}
		const previous = slices[slices.length - 1];
		if (
			previous !== undefined &&
			previous.texture === group.texture &&
			previous.start + previous.count === group.start
		) {
			previous.count += group.count;
		} else {
			slices.push({
				texture: group.texture,
				start: group.start,
				count: group.count,
			});
		}
	}
	return slices.length > 1 ? slices : undefined;
}

/**
 * A renderable object for displaying textured triangle meshes.
 * Supports loading from Wavefront OBJ models (via `loader.preload` with type "obj")
 * or from raw geometry data (vertices, uvs, indices).
 * Includes a built-in perspective projection and supports 3D transforms
 * through the standard Renderable API (`rotate`, `scale`, `translate`).
 * Works on both GPU backends — WebGL 2 and WebGPU, with hardware depth
 * testing — and on the Canvas renderer via the CPU-projected 2D-camera
 * path (painter's algorithm, no depth buffer).
 *
 * **Retained rendering** — under a {@link Camera3d} on a GPU backend
 * (`renderer.supportsRetainedMesh`), the mesh's model-space geometry is
 * uploaded to GPU buffers **once** and every frame just draws it by
 * reference: placement, camera, tint, alpha and emissive all ride
 * per-draw uniforms, so moving, rotating, scaling or re-tinting a mesh
 * never re-uploads geometry (near-zero per-frame allocation). Editing
 * the geometry itself in place is still possible — signal it with
 * {@link Mesh#needsUpdate} and the GPU copy refreshes on the next draw.
 * Under a 2D camera (or on Canvas) the mesh instead re-projects its
 * vertices on the CPU each frame — same API, the camera and backend
 * decide the path.
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
 * honors `anchorPoint` for backward compatibility. Subclasses that bake the
 * anchor into their vertex data instead (e.g. {@link Sprite3d}, via the
 * internal `_anchorBaked` flag) opt out on **both** paths — for those, the
 * vertex bake is the single anchoring mechanism.
 * @category Game Objects
 */
export default class Mesh extends Renderable {
	/**
	 * @param {number} x - the x screen position of the mesh object
	 * @param {number} y - the y screen position of the mesh object
	 * @param {object} settings - Configuration parameters for the Mesh object
	 * @param {string} [settings.model] - name of a preloaded OBJ model (via loader.preload with type "obj"). Vertex normals come with it — authored `vn` when the file has them, generated from face geometry when it does not — so an OBJ model can be `lit`.
	 * @param {Float32Array|number[]} [settings.vertices] - vertex positions as x,y,z triplets (alternative to settings.model)
	 * @param {Float32Array|number[]} [settings.uvs] - texture coordinates as u,v pairs (alternative to settings.model)
	 * @param {Uint16Array|number[]} [settings.indices] - triangle vertex indices (alternative to settings.model)
	 * @param {HTMLImageElement|TextureAtlas|string} [settings.texture] - the texture to apply (image name, HTMLImageElement, or TextureAtlas). If omitted and settings.material is provided, the texture is resolved from the MTL material's map_Kd. Passing this pins ONE binding over the whole model, which on a multi-material model suppresses the per-material texture split — see {@link Mesh#textureGroups}.
	 * @param {string} [settings.material] - name of a preloaded MTL material (via loader.preload with type "mtl"). When provided, the diffuse texture (map_Kd), tint color (Kd), and opacity (d) are automatically applied. On a multi-material model each material's own `map_Kd` is bound for its own slice of the geometry (#1573) and each `Kd` is baked per-vertex, so one `Mesh` renders the whole model.
	 * @param {number} settings.width - display width in pixels. With normalization on (the default) the model is scaled to fit this size; with `normalize: false` this is the uniform pixels-per-unit scale applied to the raw geometry.
	 * @param {number} [settings.height] - display height in pixels (normalized models only; ignored when `normalize: false`)
	 * @param {boolean} [settings.cullBackFaces=true] - enable backface culling
	 * @param {boolean} [settings.normalize=true] - fit the source geometry into a `[-0.5, 0.5]` unit cube before scaling, so `width`/`height` behave like a Sprite. Set `false` to keep the geometry's real-world coordinates — required when several meshes share one coordinate space (e.g. nodes of an imported glTF scene) so their relative scale and layout are preserved.
	 * @param {number} [settings.scale] - world-space scale (pixels per source unit) for the Camera3d path; defaults to `width`. Set this when `width`/`height` describe the renderable's world bounds (frustum culling) rather than the geometry scale — see {@link Mesh#meshScale}.
	 * @param {boolean} [settings.rightHanded=false] - treat the source as right-handed (Y-up, e.g. glTF) under the `Camera3d` world path. The default Y-up→Y-down bridge negates Y only (a reflection, which mirrors the scene left/right); `true` negates Y **and** Z (a rotation) so chirality is preserved and the result matches the authoring tool. See {@link Mesh#rightHanded}.
	 * @param {string} [settings.textureRepeat] - texture wrap mode (`"repeat"` / `"repeat-x"` / `"repeat-y"` / `"no-repeat"`) this mesh samples its texture with (per-mesh — it does not modify the shared texture, so other meshes/sprites using the same image are unaffected). Use `"repeat"` when the geometry's UVs fall outside the `[0, 1]` range and rely on the texture tiling (e.g. glTF assets, whose default sampler wrap is REPEAT) — otherwise the texture clamps to its edge texels and looks flat. Ignored for the white-pixel fallback. Note: REPEAT on a non-power-of-two texture requires WebGL 2.
	 * @param {string} [settings.textureFilter] - texture magnification filter (`"nearest"` for crisp pixel-art upscaling, `"linear"` for smooth) applied to the resolved texture. Omit to keep the renderer's global `antiAlias` default. On the mesh path, linear filtering also samples a generated mip chain with trilinear minification and 4× anisotropy (distant geometry stops shimmering) — `"nearest"` opts out, keeping crisp pixel-art models on hard level-0 sampling. GPU backends only (ignored by the Canvas renderer).
	 * @param {number} [settings.alphaCutoff=0] - alpha cutout threshold. Fragments whose final alpha is below this value are discarded (hard-edged cutout — foliage, fences, decals — with no blending or sorting). `0` disables the cutout. Set automatically by the glTF loader from a material's `alphaMode: "MASK"`. GPU mesh path only (WebGL and WebGPU; the Canvas renderer ignores it).
	 * @param {number[]|Float32Array} [settings.emissive] - emissive (self-illumination) color `[r, g, b]` (0..1, may exceed 1 for HDR glow) added on top of the lit/unlit color so the surface glows regardless of scene lights (neon, lava, screens). Omit / all-zero for no emission. Set automatically by the glTF loader (`emissiveFactor`) and OBJ loader (MTL `Ke`). GPU mesh path only (WebGL and WebGPU; the Canvas renderer ignores it).
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
	 * // material settings (WebGL) — usually set for you by the glTF/OBJ loader,
	 * // but available directly on a hand-built mesh too
	 * let sign = new me.Mesh(0, 0, {
	 *     vertices, uvs, indices, texture: "neon-sign",
	 *     width: 64, normalize: false,
	 *     textureFilter: "nearest",   // crisp pixel-art upscaling
	 *     alphaCutoff: 0.5,           // discard texels below 0.5 alpha (cutout)
	 *     emissive: [0.9, 0.2, 0.6],  // glow, independent of scene lights
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

			// Authored (or generated) vertex normals from the OBJ, so `lit`
			// models shade against the surface the artist modelled rather
			// than a fallback — the same data a glTF import supplies through
			// its NORMAL accessor. An explicit `settings.normals` still wins.
			if (settings.normals === undefined && objData.normals !== undefined) {
				settings.normals = objData.normals;
			}

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

		// working array for projected vertices (see the note below on when it
		// is, and is not, refreshed)
		/**
		 * the projected vertex positions.
		 *
		 * **Not refreshed on the retained `Camera3d` path.** There, geometry is
		 * uploaded once in model space and placed by the GPU, so nothing
		 * projects vertices per frame and this array holds whatever it last
		 * did. It is still maintained by the Canvas renderer and by the 2D
		 * camera path. Engine consumers that need current world positions —
		 * {@link Mesh#getBounds3d}, {@link Mesh#toPolygon} — derive them on
		 * demand instead of reading this; user code should do the same.
		 *
		 * To edit geometry, write to {@link Mesh#originalVertices} and set
		 * {@link Mesh#needsUpdate}.
		 * @type {Float32Array}
		 */
		this.vertices = new Float32Array(this.vertexCount * 3);

		/**
		 * the source per-vertex normals (x,y,z triplets), or `undefined` if the
		 * mesh was built without them. Supplied by the glTF loader; used for
		 * lit shading under a `Camera3d` (see {@link Light3d}).
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
		 *
		 * Carries the same caveat as {@link Mesh#vertices}: the WebGL
		 * `Camera3d` path rotates normals on the GPU and leaves this array
		 * untouched.
		 * @type {Float32Array}
		 */
		this.normals = new Float32Array(this.vertexCount * 3);

		/**
		 * Whether this mesh is lit by the active stage's {@link Light3d} lights.
		 * When `true` it renders through the lit mesh batcher (diffuse shading
		 * from the scene's lights, using {@link Mesh#originalNormals}); when
		 * `false` (the default) it uses the lean unlit path and pays no lighting
		 * cost. The glTF loader sets this on scene meshes when the scene has
		 * lights. Only meaningful under a `Camera3d` on a GPU backend.
		 * @type {boolean}
		 * @default false
		 */
		this.lit = settings.lit === true;

		/**
		 * Alpha cutout threshold. A fragment whose final alpha is below this
		 * value is discarded — a hard-edged cutout (foliage, fences, chain-link,
		 * decals) that needs no blending or back-to-front sorting. `0` (the
		 * default) disables the cutout and the mesh renders fully opaque. Set by
		 * the glTF loader from a material's `alphaMode: "MASK"` / `alphaCutoff`.
		 * GPU mesh path only (the Canvas renderer ignores it).
		 * @type {number}
		 * @default 0
		 */
		this.alphaCutoff =
			typeof settings.alphaCutoff === "number" ? settings.alphaCutoff : 0;

		/**
		 * Emissive (self-illumination) color as an `[r, g, b]` `Float32Array`
		 * (0..1, may exceed 1 for HDR glow), added on top of the lit/unlit color
		 * so the surface glows independently of the scene lights (neon, lava,
		 * screens, glowing eyes). `undefined` (the default) means no emission and
		 * keeps the mesh on the lean path. Set by the glTF loader from a material's
		 * `emissiveFactor` (× `KHR_materials_emissive_strength`) and by the OBJ
		 * loader from an MTL's `Ke`. GPU mesh path only (WebGL and WebGPU; the Canvas renderer ignores it).
		 * @type {Float32Array|undefined}
		 */
		this.emissive = toEmissive(settings.emissive);

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
			 *   count: number, tint: Color, opacity: number,
			 *   texture: TextureAtlas|undefined}>}
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
			// The first `map_Kd` in the model becomes the mesh-level
			// texture — what groups whose material declares none draw
			// with, and the single binding a consumer that ignores
			// `textureGroups` (the Canvas renderer) sees. Groups with
			// their own `map_Kd` get it bound per draw range further
			// down (#1573). With no `map_Kd` anywhere this falls
			// through to the white-pixel fallback.
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
				// MTL emissive (Ke) — self-illumination, kept separate from the
				// diffuse tint so it glows regardless of scene lighting
				const ke = toEmissive(mat.Ke);
				if (ke !== undefined) {
					this.emissive = ke;
				}
			}
		}

		// resolve texture. Fall back to the shared 1×1 white pixel when
		// no texture source was resolved — covers Kd-only multi-material
		// models (Kenney style) AND single-material meshes constructed
		// without a `texture:` or a `map_Kd`-bearing `material:` (the
		// GPU pipeline still needs something to sample; tint / per-
		// vertex color does the actual coloring).
		const hasRealTexture = !!textureSource;
		if (!textureSource) {
			textureSource = Renderer.getWhitePixel();
		}
		this.texture = resolveTextureAtlas(
			textureSource,
			settings.framewidth,
			settings.frameheight,
		);

		/**
		 * Index ranges that each need their own diffuse texture bound, for a
		 * multi-material model whose materials carry different `map_Kd` maps
		 * (#1573) — `undefined` whenever one binding covers the whole mesh,
		 * which is every single-material model and every `Kd`-only one.
		 *
		 * The GPU backends draw one indexed range per entry instead of one
		 * range for the whole mesh; adjacent materials sharing a texture are
		 * already merged here, so the list is the minimum number of draws the
		 * model needs. An explicit `settings.texture` suppresses the split
		 * entirely — asking for one texture is asking for one texture.
		 *
		 * The Canvas renderer ignores this: a multi-material mesh takes its
		 * per-triangle solid-fill path there and never samples a texture at
		 * all.
		 * @type {Array<{texture: TextureAtlas, start: number, count: number}>|undefined}
		 */
		this.textureGroups =
			isMultiMaterial === true && !settings.texture
				? buildTextureGroups(
						this.groups,
						materials,
						this.texture,
						settings.framewidth,
						settings.frameheight,
					)
				: undefined;

		/**
		 * Per-mesh texture wrap mode (`"repeat"` / `"repeat-x"` / `"repeat-y"`
		 * / `"no-repeat"`), or `undefined` to sample with the texture's own
		 * wrap. Some assets author UVs outside the `[0, 1]` range and rely on
		 * the sampler repeating the texture (this is the glTF default sampler
		 * behavior); the mesh would otherwise clamp to the edge texels and
		 * look flat / untextured.
		 *
		 * Kept on the mesh and threaded to the batcher at draw time — sampler
		 * state per use, like a GL sampler object — so it never mutates the
		 * per-image `TextureAtlas` shared with every other consumer of the
		 * same image (#1503). Two meshes (or a mesh and a sprite) can point
		 * at one image with different wrap modes; the texture cache keys GL
		 * units by `(source, repeat)` so each wrap gets its own GL texture.
		 * Applied only to a real texture — never the shared white-pixel
		 * fallback, which is global and must stay `"no-repeat"`.
		 * @type {string|undefined}
		 */
		this.textureRepeat =
			hasRealTexture && typeof settings.textureRepeat === "string"
				? settings.textureRepeat
				: undefined;

		// Optional texture magnification filter (`"nearest"` for crisp pixel-art
		// upscaling, `"linear"` for smooth). When omitted the texture keeps the
		// renderer's global `antiAlias` default. GPU backends only — the Canvas
		// renderer ignores it. WebGL stores its GL enum; other backends (the
		// WebGPU texture store) consume the string form directly.
		//
		// NOTE: unlike `textureRepeat` above, this still mutates the shared
		// per-image atlas — the texture-unit cache doesn't discriminate by
		// filter, so a true per-mesh filter needs the unit-key change planned
		// with the #1410 TextureCache refactor. Two consumers of one image
		// wanting different filters is last-writer-wins until then.
		if (hasRealTexture && typeof settings.textureFilter === "string") {
			const gl = game.renderer?.gl;
			if (gl) {
				this.texture.filter =
					settings.textureFilter === "nearest" ? gl.NEAREST : gl.LINEAR;
			} else {
				this.texture.filter = settings.textureFilter;
			}
		}

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

		// Subclasses that bake the anchor offset directly into their vertex
		// data (e.g. Sprite3d) set this true, so preDraw suppresses the base
		// anchor translate on BOTH camera paths — the vertex bake is then the
		// single anchoring mechanism (the Camera2d fallback loses its exact
		// pixel-shift anchor for such subclasses; that path is documented as
		// degraded for them anyway). Plain meshes keep the legacy 2D anchor.
		/** @ignore */
		this._anchorBaked = false;

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

		// Bumped whenever the geometry itself changes, so a renderer holding
		// GPU-resident copies knows when to refresh them. Placement changes
		// (transform, position, tint) deliberately do NOT bump it.
		/** @ignore */
		this._geometryVersion = 0;
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
	 * Signal that this mesh's geometry itself has changed — its vertices, UVs,
	 * indices, normals or per-vertex colours were edited in place.
	 *
	 * Placement is *not* geometry: moving, rotating, scaling or re-tinting a
	 * mesh needs no signal, because those are applied when drawing rather than
	 * stored in the geometry. Only reach for this after writing into
	 * {@link Mesh#originalVertices} and friends directly.
	 * @type {boolean}
	 * @example
	 * // deform the mesh, then tell it the shape moved
	 * mesh.originalVertices[1] += 10;
	 * mesh.needsUpdate = true;
	 */
	// Deliberately write-only: this is a signal, not a state. Whether the GPU
	// copy is actually behind is known to the renderer that uploaded it, not
	// to the mesh, so any getter here would have to guess.
	// eslint-disable-next-line accessor-pairs
	set needsUpdate(value) {
		if (value !== false) {
			this._geometryVersion++;
		}
	}

	/**
	 * A custom shader hosted on this mesh's draw, replacing the built-in
	 * mesh shading: a {@link GLShader} carrying a `{vertex, fragment}`
	 * GLSL program (hosted by the WebGL renderer) and/or a complete
	 * `wgsl` module (hosted by the WebGPU renderer — see the GLShader
	 * class docs for the module contract). One object serves both
	 * backends; a shader without a realization for the active backend
	 * (or `null`) degrades to the built-in shading. The tint, texture,
	 * placement and (for `lit` meshes) light data keep flowing through
	 * their usual uniforms — the custom shader decides what to do with
	 * them.
	 * @type {GLShader|undefined}
	 * @example
	 * me.loader.preload([{ name: "toon", type: "shader", src: {
	 *     vertex: "shaders/toon.vert",     // GLSL pair for WebGL
	 *     fragment: "shaders/toon.frag",
	 *     wgsl: "shaders/toon.wgsl",       // complete module for WebGPU
	 * }}], () => {
	 *     myMesh.shader = me.loader.getShader("toon");
	 * });
	 */
	get shader() {
		return super.shader;
	}

	set shader(value) {
		super.shader = value;
	}

	/**
	 * Compose this mesh's placement into a single matrix: where its model-space
	 * geometry sits in the world.
	 *
	 * This is the matrix form of {@link Mesh#_projectVerticesWorld} — the same
	 * transform, scale and axis bridge, expressed once instead of applied to
	 * every vertex:
	 *
	 *   `translate(pos, depth) · scale(s, -s, ±s) · currentTransform`
	 *
	 * The Y negation bridges Y-up geometry to the engine's Y-down world; Z is
	 * negated too for right-handed (glTF) sources, which makes the bridge a
	 * rotation rather than a reflection and so preserves triangle winding.
	 * @returns {Matrix3d} the mesh's model matrix (reused instance)
	 * @ignore
	 */
	_composeModelMatrix() {
		if (this._modelMatrix === undefined) {
			/** @ignore */
			this._modelMatrix = new Matrix3d();
		}
		const out = this._modelMatrix.val;
		const c = this.currentTransform.val;
		const s = this.meshScale;
		const sy = -s;
		const sz = this.rightHanded ? -s : s;

		for (let col = 0; col < 4; col++) {
			const o = col * 4;
			out[o] = c[o] * s;
			out[o + 1] = c[o + 1] * sy;
			out[o + 2] = c[o + 2] * sz;
			out[o + 3] = c[o + 3];
		}
		// the node origin rides in pos/depth, applied after the scale + bridge
		out[12] += this.pos.x;
		out[13] += this.pos.y;
		out[14] += this.depth;

		return this._modelMatrix;
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
	 * @param {boolean} [needsReversedIndices=true] - build the winding-reversed index copy. `false` on the retained path, which corrects winding with `frontFace` and would otherwise duplicate the index array for nothing.
	 * @ignore
	 */
	_setupWorldSpace(needsReversedIndices = true) {
		// Only the reflection bridge (left-handed, Y-only negate) inverts
		// winding and needs the reversed copy. `rightHanded` meshes (all glTF
		// scenes) use a rotation bridge that preserves winding, so they keep
		// `_indicesOriginal` and never read the reversed buffer — skip the
		// allocation entirely for them.
		//
		// The retained path also never reads it: it uploads the authored order
		// and flips `frontFace` instead, so building the copy there would
		// duplicate the whole index array for nothing (megabytes on a dense
		// mesh).
		if (needsReversedIndices === true && this.rightHanded !== true) {
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
	 * Release any GPU geometry when this mesh leaves the world.
	 *
	 * `destroy()` is not enough on its own: a child removed with
	 * `keepalive: true`, or one recycled through {@link pool}, never gets
	 * destroyed, so its persistent vertex/index buffers would outlive every
	 * reference to it and only be reclaimed on a renderer reset. Releasing
	 * here also means a recycled instance starts from a clean slate — it
	 * rebuilds on its next draw rather than inheriting the previous
	 * occupant's geometry.
	 * @ignore
	 */
	onDeactivateEvent(...args) {
		const renderer = this.parentApp?.renderer ?? game.renderer;
		renderer?.deleteMeshGeometry?.(this);
		super.onDeactivateEvent(...args);
	}

	/**
	 * The mesh's world-space 3D axis-aligned bounding box. This is the 3D analog
	 * of {@link Renderable#getBounds} (which returns a flat 2D box from
	 * `width`/`height` and so cannot describe a mesh's real extent).
	 *
	 * Computed on demand by bounding the model-space geometry through the
	 * mesh's current placement, so it reflects the live transform and is valid
	 * before the mesh has ever been drawn. Meaningful for the `Camera3d` path;
	 * for the 2D path use {@link Renderable#getBounds}.
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
		// Bound the model-space geometry through this mesh's placement, rather
		// than reading whatever the last draw happened to leave in `vertices`.
		// The result is therefore correct before the first draw, and stays
		// correct when the mesh is drawn from retained GPU geometry.
		return this._bounds3d.fromVertices(
			this.originalVertices,
			this.vertexCount,
			this._composeModelMatrix().val,
		);
	}

	/**
	 * Prepare the renderer for drawing the mesh. On the `Camera3d` world-space
	 * path the mesh emits final world coordinates, so it opts out of the base
	 * anchor-point offset ({@link Renderable#applyAnchorTransform} = `false`) —
	 * otherwise the offset would leak into the shared mesh view matrix. The 2D
	 * path keeps the anchor — except for subclasses with a vertex-baked anchor
	 * (`_anchorBaked`, e.g. {@link Sprite3d}), which suppress it on both paths.
	 * See the class description for the pivot rationale.
	 * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
	 */
	preDraw(renderer) {
		// world-space meshes pivot about their own origin, not a bounds-box
		// anchor (see Mesh class doc + Renderable#applyAnchorTransform); a
		// subclass with a vertex-baked anchor (`_anchorBaked`) opts out on
		// both paths — recomputed here every frame, so a one-shot constructor
		// assignment could never stick
		this.applyAnchorTransform =
			this._useWorldSpace !== true && this._anchorBaked !== true;
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
	 * per-vertex `aColor` (GPU backends) or per-triangle solid-fill (Canvas)
	 * path. The GPU batchers may still chunk very large meshes across multiple
	 * `drawElements` calls to fit its vertex/index buffer limits, and split the
	 * draw once per entry in {@link Mesh#textureGroups} when the materials
	 * carry different diffuse textures (#1573).
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
				this._setupWorldSpace(renderer.supportsRetainedMesh !== true);
			}
			if (renderer.supportsRetainedMesh === true) {
				// Retained path: the geometry already lives on the GPU in model
				// space, so nothing is transformed here. Where the mesh sits is
				// described by a matrix and applied by the shader, which is what
				// makes moving/rotating/scaling it free.
				//
				// The reflection bridge still inverts winding, but the fix is
				// `frontFace` at draw time rather than a reversed index copy, so
				// the authored order is what reaches the GPU — keep `indices`
				// agreeing with that, including when this instance was
				// previously drawn through the reversing path below.
				this.indices = this._indicesOriginal;
				renderer.drawMesh(this, this._composeModelMatrix());
				return;
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
		// Draws no longer refresh `vertices` on the retained path, so project on
		// demand — this is a query, not a per-frame cost. Keyed off
		// `_worldSpace` (set once `_setupWorldSpace` has run) rather than the
		// activation-time `_useWorldSpace`: with several cameras on a stage the
		// two disagree, and reading a never-written `vertices` returns a hull
		// collapsed onto the origin.
		if (this._worldSpace === true) {
			this._projectVerticesWorld(this.pos.x, this.pos.y, this.depth);
		}
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

	/**
	 * Release this mesh's GPU-resident geometry, if a renderer is holding any,
	 * then destroy the renderable.
	 * @ignore
	 */
	destroy() {
		// the fallback is load-bearing: a mesh that was never parented has no
		// `parentApp`, and skipping the release would leak its GPU geometry
		const renderer = this.parentApp?.renderer ?? game.renderer;
		renderer?.deleteMeshGeometry?.(this);
		super.destroy();
	}
}
