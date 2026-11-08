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
 * Get a loaded Tiled map or tileset (a `"tmx"` or `"tsx"` asset) as parsed
 * data: the map's JSON structure, whether it was loaded from XML or JSON.
 * Most code never needs it: `level.load(name)` builds the level from it.
 * @param {string} elt - the asset name
 * @returns {object} the parsed map or tileset, or `null` if none is loaded
 * under that name
 * @example
 * const map = loader.getTMX("map1");
 * console.log(map.width, map.height, map.layers.length);
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
 * Get the content of a loaded `"binary"` asset, decoded as UTF-8 text: what
 * a bitmap font's `.fnt` descriptor, for one, is loaded as.
 * @param {string} elt - the asset name
 * @returns {object} the file's content, as a string, or `null` if none is
 * loaded under that name
 * @example
 * // a bitmap font: its image, and its descriptor as "binary"
 * await loader.preload([
 *     { name: "PressStart2P", type: "image",  src: "data/fnt/PressStart2P.png" },
 *     { name: "PressStart2P", type: "binary", src: "data/fnt/PressStart2P.fnt" },
 * ]);
 * const fnt = loader.getBinary("PressStart2P");
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
 * Get a loaded image (an `"image"` asset, or the image of an `"aseprite"`
 * one). Given a path, its directory and extension are ignored, so
 * `getImage("data/img/player.png")` finds the image named `"player"`.
 * Most engine classes take the name instead, and look it up themselves:
 * `new Sprite(0, 0, { image: "player" })`.
 * @param {string} image - the asset name
 * @returns {HTMLImageElement|CompressedImage|null} the image, or `null` if
 * none is loaded under that name
 * @example
 * const player = loader.getImage("player");
 * console.log(player.width, player.height);
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
 * Get a loaded JSON file (a `"json"` asset, or the descriptor of an
 * `"aseprite"` one), parsed.
 * @param {string} elt - the asset name
 * @returns {JSON} the parsed content, or `null` if none is loaded under that
 * name
 * @example
 * // a texture atlas: its image and its JSON descriptor share a name
 * const atlas = new TextureAtlas(loader.getJSON("texture"), loader.getImage("texture"));
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
 * Get a loaded Wavefront OBJ model (an `"obj"` asset), parsed. Most code
 * never needs it: a `Mesh` takes the model's name.
 * @param {string} elt - the asset name
 * @returns {object} the parsed model: `vertices` (Float32Array of x, y, z),
 * `uvs` (Float32Array of u, v), `indices` (Uint16Array of triangle vertex
 * indices), `vertexCount`, and `groups` (the `usemtl` material groups, as
 * `{materialName, start, count}` index ranges); or `null` if none is loaded
 * under that name
 * @category Assets
 * @example
 * // 1. preload the OBJ model and its texture
 * await loader.preload([
 *     { name: "cube", type: "obj",   src: "models/cube.obj" },
 *     { name: "cube", type: "image", src: "models/cube_texture.png" },
 * ]);
 *
 * // 2. a Mesh takes the model and the texture by name
 * const mesh = new Mesh(400, 300, {
 *     model: "cube",
 *     texture: "cube",
 *     width: 200,
 *     height: 200,
 * });
 * app.world.addChild(mesh);
 *
 * // 3. or read the parsed data directly
 * const { vertices, uvs, indices, vertexCount } = loader.getOBJ("cube");
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
 * Get a loaded glTF/GLB scene (a `"gltf"` or `"glb"` asset), parsed.
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
 * Most code never needs this: a loaded glTF/GLB registers with the
 * {@link level} director, so the whole scene loads into a container in one
 * call, `level.load(name)`, exactly like a Tiled map. Reach for `getGLTF`
 * only to inspect the raw descriptor (to frame a `Camera3d` from the
 * embedded camera, say).
 * @param {string} elt - the asset name
 * @returns {GLTFData|null} the parsed scene descriptor, or `null` if none is
 * loaded under that name
 * @category Assets
 * @example
 * await loader.preload([
 *     { name: "diorama", type: "glb", src: "scenes/diorama.glb" },
 * ]);
 *
 * // load the whole scene into the world (view it under a Camera3d)
 * level.load("diorama", { scale: 32 });
 *
 * // ...or inspect the raw descriptor for custom framing
 * const { min, max } = loader.getGLTF("diorama").bounds;
 */
export function getGLTF(elt) {
	elt = "" + elt;
	if (elt in gltfList) {
		return gltfList[elt];
	}
	return null;
}

/**
 * Get the shader compiled from a loaded `"shader"` asset — compiled once,
 * at load time, ready to add to a renderable or a camera as a post effect.
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
 * Unloading the asset destroys the shared instance, under whatever still
 * draws with it: with bundles, an effect that outlives a level (a HUD's, a
 * camera's) belongs in a bundle that outlives that level, such as
 * `"common"`. A `clone()` is the caller's own and is not destroyed with it.
 *
 * Degradation is never fatal: a fragment-body asset without a body in the
 * active renderer's language (or on Canvas) is an inert `ShaderEffect`
 * stub, and a complete-program asset without a realization for the active
 * backend is an inert `GLShader` — assigning either just keeps the
 * built-in rendering. Note that shader assets require an initialized
 * Application (`await app.init()`) — an inherent precondition of the
 * preload flow, since the loading screen itself needs the renderer.
 * @param {string} elt - the asset name
 * @returns {ShaderEffect|GLShader|null} the shared, precompiled shader, or
 * `null` if none is loaded under that name
 * @category Assets
 * @example
 * await loader.preload([
 *     // from a file (or a data: URI)
 *     { name: "waterRipple", type: "shader", src: "shaders/waterRipple.frag" },
 *     // or inline GLSL, through the `data` field
 *     { name: "flash", type: "shader", data: `
 *         uniform float uIntensity;
 *         vec4 apply(vec4 color, vec2 uv) { return mix(color, vec4(1.0), uIntensity); }
 *     ` },
 *     // or a complete program: a {vertex, fragment} GLSL pair and/or a full
 *     // WGSL module, compiled into one GLShader; the active renderer hosts
 *     // the one it speaks
 *     { name: "toonMesh", type: "shader", src: {
 *         vertex: "shaders/toon.vert",
 *         fragment: "shaders/toon.frag",
 *         wgsl: "shaders/toon.wgsl",
 *     } },
 * ]);
 *
 * // one shared program: the same uniform values for every user
 * mySprite.addPostEffect(loader.getShader("waterRipple"));
 * // a private copy with its own uniforms (caller-owned, shared = false)
 * boss.addPostEffect(loader.getShader("flash").clone());
 * // a complete program hosts on a mesh, replacing the built-in shading
 * myMesh.addPostEffect(loader.getShader("toonMesh"));
 */
export function getShader(elt) {
	elt = "" + elt;
	if (elt in shaderList) {
		return shaderList[elt];
	}
	return null;
}

/**
 * Get a loaded Wavefront MTL material library (an `"mtl"` asset), parsed.
 * Most code never needs it: a `Mesh` takes the library's name as its
 * `material`.
 * @param {string} elt - the asset name
 * @returns {object} the materials by name, each with its properties (`Kd`,
 * `d`, `Ke`, `map_Kd`...), or `null` if none is loaded under that name
 * @category Assets
 * @example
 * // 1. preload the model, its materials and their texture
 * await loader.preload([
 *     { name: "fox",      type: "obj",   src: "models/fox.obj" },
 *     { name: "fox",      type: "mtl",   src: "models/fox.mtl" },
 *     { name: "colormap", type: "image", src: "models/colormap.png" },
 * ]);
 *
 * // 2. a Mesh with a material: texture, tint and opacity applied for you
 * const mesh = new Mesh(400, 300, {
 *     model: "fox",
 *     material: "fox",
 *     texture: "colormap",
 *     width: 200,
 *     height: 200,
 * });
 *
 * // 3. or read the materials directly
 * const materials = loader.getMTL("fox");
 * // materials["colormap"].Kd — [r, g, b] diffuse color (0-1 range)
 * // materials["colormap"].d — opacity (0-1)
 * // materials["colormap"].Ke — [r, g, b] emissive color (applied as Mesh.emissive)
 * // materials["colormap"].map_Kd — resolved texture URL
 */
export function getMTL(elt) {
	elt = "" + elt;
	if (elt in mtlList) {
		return mtlList[elt];
	}
	return null;
}

/**
 * Get a loaded video (a `"video"` asset): the `<video>` element the loader
 * created for it.
 * @param {string} elt - the asset name
 * @returns {HTMLVideoElement} the video element, or `null` if none is loaded
 * under that name
 * @example
 * await loader.preload([{ name: "intro", type: "video", src: "data/video/intro.mp4" }]);
 * const intro = loader.getVideo("intro");
 * intro.play();
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
 * Get a loaded web font (a `"fontface"` asset): the `FontFace` the loader
 * added to `document.fonts`. Text uses it by its name, as a CSS font family.
 * @param {string} elt - the asset name
 * @returns {FontFace} the font face, or `null` if none is loaded under that
 * name
 * @example
 * await loader.preload([
 *     { name: "kenpixel", type: "fontface", src: "data/font/kenvector_future.woff2" },
 * ]);
 * const label = new Text(10, 10, { font: "kenpixel", size: 16, text: "Score" });
 * console.log(loader.getFont("kenpixel").status); // "loaded"
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
