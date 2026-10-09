import { getBasename } from "../utils/file.ts";

/**
 * additional imports for TypeScript
 *
 * Type-only, so they add no runtime edge and this module stays importable
 * from anywhere. Without them the unions below silently degrade to `any` in
 * the generated declarations, which `tsc` does not report.
 * @import {CompressedImage} from "./parsers/compressed_textures/compressed_image.js";
 * @import {GLTFData} from "./parsers/gltf.js";
 * @import GLShader from "../video/webgl/glshader.js";
 * @import ShaderEffect from "../video/effects/shadereffect.js";
 */

/**
 * where all preloaded content is cached
 */

// contains all the images loaded
export const imgList = {};

// contains all the TMX loaded
export const tmxList = {};

// contains all the binary files loaded
export const binList = {};

// contains all the JSON files
export const jsonList = {};

// contains all the video files
export const videoList = {};

// contains all the font files
export const fontList = {};

// contains all the OBJ model files
export const objList = {};

// contains all the MTL material files
export const mtlList = {};

// contains all the parsed glTF/GLB scene descriptors
export const gltfList = {};

// contains all the preloaded shader assets, keyed by name → the shared,
// precompiled ShaderEffect (compiled at load time; video.init is an
// inherent precondition of the preload flow)
export const shaderList = {};

/**
 * Which cache holds each asset type.
 *
 * The mapping belongs here rather than in a `switch` in `loader.js`, so that
 * adding a cache is one edit in one file. Several types share a cache, which
 * is the point of the indirection: `tmx` and `tsx` are the same store, as are
 * `gltf` and `glb`.
 */
const cacheByType = {
	binary: binList,
	image: imgList,
	json: jsonList,
	tmx: tmxList,
	tsx: tmxList,
	video: videoList,
	obj: objList,
	gltf: gltfList,
	glb: gltfList,
	mtl: mtlList,
	shader: shaderList,
	fontface: fontList,
};

/**
 * Every asset type that has a cache, in sweep order.
 *
 * Derived from the registry above rather than restated, so a new cache is
 * swept by `unloadAll` the moment it is registered. The aliases are in here
 * too (`tsx` beside `tmx`, `glb` beside `gltf`), which costs one empty pass
 * each and keeps the list honest.
 * @type {readonly string[]}
 * @internal
 * @ignore
 */
export const CACHED_TYPES = Object.freeze(Object.keys(cacheByType));

/**
 * Whether an asset of this type is cached under this name.
 *
 * The `in` test the delete below uses, exposed on its own so a caller that
 * needs the answer without removing anything does not have to list every key.
 * @param {string} type - the asset type, as used in the resource descriptor
 * @param {string} name - the asset name
 * @returns {boolean} true if there is an entry
 * @internal
 * @ignore
 */
export function hasAsset(type, name) {
	const cache = cacheByType[type];
	return cache !== undefined && name in cache;
}

/**
 * Delete one asset from the cache that holds its type.
 *
 * Named for the `delete` on {@link TextureCache}, which is the engine's other
 * cache; the suffix is only there because `delete` is a reserved word and so
 * cannot name a free function.
 *
 * The plain half of unloading: no destruction, no side effects, just the
 * entry. Anything that owns a resource — a `ShaderEffect`'s GL program, a
 * registered `FontFace` — is released by the caller BEFORE calling this,
 * because that is policy and this module holds none.
 * @param {string} type - the asset type, as used in the resource descriptor
 * @param {string} name - the asset name
 * @returns {boolean} true if an entry was removed, false if there was none
 * @internal
 * @ignore
 */
export function deleteAsset(type, name) {
	const cache = cacheByType[type];
	if (cache === undefined || !(name in cache)) {
		return false;
	}
	delete cache[name];
	return true;
}

/**
 * The names of every asset cached under a type.
 *
 * Returned as a snapshot array, so a caller can unload every one of them
 * without mutating the object it is iterating.
 * @param {string} type - the asset type
 * @returns {string[]} the cached names, or an empty array for an unknown type
 * @internal
 * @ignore
 */
export function assetNames(type) {
	const cache = cacheByType[type];
	return cache === undefined ? [] : Object.keys(cache);
}

/*
 * The read accessors for the caches above.
 *
 * They live beside the data they read, and that is the whole reason: a
 * module holding only caches and their getters needs nothing from the rest
 * of the engine, so anything may import it. `loader.js` re-exports every one
 * of them, so `loader.getImage(...)` and its siblings are unchanged.
 *
 * `unload` / `unloadAll` deliberately stay in `loader.js`: they destroy
 * assets and call into the audio parser, which is a lifecycle operation
 * rather than a cache read, and importing it here would undo the above.
 */

/**
 * return the specified TMX/TSX object
 * @param {string} elt - name of the tmx/tsx element ("map1");
 * @returns {object} requested element or null if not found
 * @category Assets
 */
export function getTMX(elt) {
	// force as string
	elt = "" + elt;
	if (elt in tmxList) {
		return tmxList[elt];
	}
	return null;
}

/**
 * return the specified Binary object
 * @param {string} elt - name of the binary object ("ymTrack");
 * @returns {object} requested element or null if not found
 * @category Assets
 */
export function getBinary(elt) {
	// force as string
	elt = "" + elt;
	if (elt in binList) {
		return binList[elt];
	}
	return null;
}

/**
 * return the specified Image Object
 * @param {string} image - name of the Image element ("tileset-platformer");
 * @returns {HTMLImageElement|CompressedImage|null} requested element or null if not found
 * @category Assets
 */
export function getImage(image) {
	// force as string and extract the base name
	image = getBasename("" + image);
	if (image in imgList) {
		// return the corresponding Image object
		return imgList[image];
	}
	return null;
}

/**
 * return the specified JSON Object
 * @param {string} elt - name of the json file
 * @returns {JSON}
 * @category Assets
 */
export function getJSON(elt) {
	// force as string
	elt = "" + elt;
	if (elt in jsonList) {
		return jsonList[elt];
	}
	return null;
}

/**
 * return the specified OBJ model data
 * @param {string} elt - name of the OBJ file (as specified in the preload list)
 * @returns {object} parsed OBJ data with `vertices` (Float32Array), `uvs` (Float32Array), `indices` (Uint16Array), and `vertexCount` (number), or null if not found
 * @category Assets
 * @example
 * // 1. preload the OBJ model and its texture
 * me.loader.preload([
 *     { name: "cube", type: "obj", src: "models/cube.obj" },
 *     { name: "cube", type: "image", src: "models/cube_texture.png" },
 * ], () => {
 *     // 2. create a Mesh using the preloaded model name
 *     const mesh = new me.Mesh(400, 300, {
 *         model: "cube",        // references the preloaded OBJ
 *         texture: "cube",      // references the preloaded image
 *         width: 200,
 *         height: 200,
 *     });
 *     me.game.world.addChild(mesh);
 *
 *     // 3. or access the raw parsed data directly
 *     const data = me.loader.getOBJ("cube");
 *     // data.vertices — Float32Array of x,y,z positions
 *     // data.uvs — Float32Array of u,v texture coordinates
 *     // data.indices — Uint16Array of triangle vertex indices
 *     // data.vertexCount — number of unique vertices
 *     // data.groups — usemtl material groups ({materialName, start, count} index ranges)
 * });
 */
export function getOBJ(elt) {
	// force as string
	elt = "" + elt;
	if (elt in objList) {
		return objList[elt];
	}
	return null;
}

/**
 * return the parsed glTF/GLB scene descriptor for the given asset name.
 *
 * The descriptor is `{ nodes, cameras, lights, bounds, graph, animations }`:
 * - `nodes` — one entry per mesh primitive, each carrying its accumulated
 *   `world` transform (16 floats, column-major), `vertices`, `normals`,
 *   `uvs`, `indices`, `vertexCount`, a decoded baseColor `image` (or `null`),
 *   and a `doubleSided` flag.
 * - `cameras` — glTF cameras, each with its `world` transform + perspective
 *   parameters.
 * - `lights` — parsed `KHR_lights_punctual` lights (`type`, `color`,
 *   `intensity`, `range`, spot cone angles, world-space
 *   `direction`/`position`, `name`); empty without the extension. The
 *   level director instantiates directional, point and spot lights
 *   automatically (see {@link level.load} options).
 * - `bounds` — world-space `{ min, max }` (glTF units), handy for framing.
 *
 * Most code never needs this: a preloaded glTF/GLB auto-registers with the
 * {@link level} director, so the whole scene loads into a container in one
 * call via `me.level.load(name)` — exactly like a Tiled map. Reach for
 * `getGLTF` only when you want to inspect the raw descriptor (e.g. to frame
 * a `Camera3d` from the embedded camera).
 * @param {string} elt - name of the glTF/GLB file (as specified in the preload list)
 * @returns {GLTFData|null} the parsed scene descriptor, or `null` if not found
 * @category Assets
 * @example
 * me.loader.preload(
 *     [{ name: "diorama", type: "glb", src: "scenes/diorama.glb" }],
 *     () => {
 *         // load the whole scene into the world (view under a Camera3d)
 *         me.level.load("diorama", { scale: 32 });
 *
 *         // ...or inspect the raw descriptor for custom framing
 *         const scene = me.loader.getGLTF("diorama");
 *         const { min, max } = scene.bounds;
 *     },
 * );
 */
export function getGLTF(elt) {
	elt = "" + elt;
	if (elt in gltfList) {
		return gltfList[elt];
	}
	return null;
}

/**
 * Return the precompiled `ShaderEffect` for the given "shader" asset —
 * compiled once during preloading, ready to assign to a renderable or
 * camera `shader` property.
 *
 * **This returns a SHARED instance**: the *same* `ShaderEffect` object on
 * every call, owned by the loader (its `shared` flag is `true`). That means:
 * - it is safe to assign to any number of renderables — none of their
 *   cleanup paths will auto-destroy it, only {@link loader.unload} /
 *   {@link loader.unloadAll} free it (and its GL program);
 * - all of them share ONE set of uniform values — `setUniform` on it
 *   affects every renderable using the shader.
 *
 * When a renderable needs its **own** uniform values, make a private,
 * caller-owned copy with `ShaderEffect.clone()` — the clone's `shared` flag
 * is reset to `false`, so it is auto-destroyed with the renderable it is
 * assigned to, like any hand-constructed effect.
 *
 * A shader asset declared as a **complete program** — a
 * `{vertex, fragment}` GLSL pair and/or a full `wgsl` module (see the
 * example) — compiles into a raw {@link GLShader} instead, carrying one
 * realization per GPU backend (`isWebGL` / `isWebGPU`): the type the
 * hosted paths take directly (a `Mesh` custom shader,
 * `renderer.customShader`, a custom batcher). Same shared-instance
 * semantics, and `GLShader.clone()` likewise yields a caller-owned copy.
 *
 * Degradation is never fatal: a fragment-body asset without a body in the
 * active renderer's language (or on Canvas) is an inert `ShaderEffect`
 * stub, and a complete-program asset without a realization for the active
 * backend is an inert `GLShader` — assigning either just keeps the
 * built-in rendering. Note that shader assets require an initialized
 * Application (`await app.init()`) — an inherent precondition of the
 * preload flow, since the loading screen itself needs the renderer.
 * @param {string} elt - name of the shader asset (as specified in the preload list)
 * @returns {ShaderEffect|GLShader|null} the shared, precompiled shader, or `null` if not found
 * @category Assets
 * @example
 * me.loader.preload([
 *     // from a file (or data: URI)
 *     { name: "waterRipple", type: "shader", src: "shaders/waterRipple.frag" },
 *     // or inline GLSL via the `data` field
 *     { name: "flash", type: "shader", data: `
 *         uniform float uIntensity;
 *         vec4 apply(vec4 color, vec2 uv) { return mix(color, vec4(1.0), uIntensity); }
 *     ` },
 *     // or a complete program — a {vertex, fragment} GLSL pair and/or a
 *     // full WGSL module → one GLShader carrying both realizations; the
 *     // active renderer hosts the one it speaks
 *     { name: "toonMesh", type: "shader", src: {
 *         vertex: "shaders/toon.vert",
 *         fragment: "shaders/toon.frag",
 *         wgsl: "shaders/toon.wgsl",
 *     } },
 * ], () => {
 *     // one shared program — same uniform state for every user
 *     mySprite.addPostEffect(me.loader.getShader("waterRipple"));
 *     // private copy with its own uniforms (caller-owned, shared = false)
 *     boss.addPostEffect(me.loader.getShader("flash").clone());
 *     // a complete program hosts on a mesh, replacing the built-in shading
 *     myMesh.addPostEffect(me.loader.getShader("toonMesh"));
 * });
 */
export function getShader(elt) {
	elt = "" + elt;
	if (elt in shaderList) {
		return shaderList[elt];
	}
	return null;
}

/**
 * return the specified MTL material data
 * @param {string} elt - name of the MTL file (as specified in the preload list)
 * @returns {object} map of material names to properties (`Kd`, `d`, `map_Kd`), or null if not found
 * @category Assets
 * @example
 * // 1. preload OBJ + MTL + texture
 * me.loader.preload([
 *     { name: "fox", type: "obj", src: "models/fox.obj" },
 *     { name: "fox", type: "mtl", src: "models/fox.mtl" },
 *     { name: "colormap", type: "image", src: "models/colormap.png" },
 * ], () => {
 *     // 2. create a Mesh with material — texture, tint, opacity auto-applied
 *     const mesh = new me.Mesh(400, 300, {
 *         model: "fox",
 *         material: "fox",
 *         texture: "colormap",
 *         width: 200,
 *         height: 200,
 *     });
 *
 *     // 3. or access the raw material data directly
 *     const materials = me.loader.getMTL("fox");
 *     // materials["colormap"].Kd — [r, g, b] diffuse color (0-1 range)
 *     // materials["colormap"].d — opacity (0-1)
 *     // materials["colormap"].Ke — [r, g, b] emissive color (glow, applied as Mesh.emissive)
 *     // materials["colormap"].map_Kd — resolved texture URL
 * });
 */
export function getMTL(elt) {
	elt = "" + elt;
	if (elt in mtlList) {
		return mtlList[elt];
	}
	return null;
}

/**
 * return the specified Video Object
 * @param {string} elt - name of the video file
 * @returns {HTMLVideoElement}
 * @category Assets
 */
export function getVideo(elt) {
	// force as string
	elt = "" + elt;
	if (elt in videoList) {
		return videoList[elt];
	}
	return null;
}

/**
 * return the specified FontFace Object
 * @param {string} elt - name of the font file
 * @returns {FontFace}
 * @category Assets
 */
export function getFont(elt) {
	// force as string
	elt = "" + elt;
	if (elt in fontList) {
		return fontList[elt];
	}
	return null;
}
