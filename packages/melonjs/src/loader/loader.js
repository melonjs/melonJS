import { warnOnce } from "../lang/console.js";
import state from "./../state/state.ts";
import {
	emit,
	GAME_INIT,
	LOADER_COMPLETE,
	LOADER_ERROR,
	LOADER_PROGRESS,
	on,
} from "../system/event.ts";
import {
	assetNames,
	CACHED_TYPES,
	deleteAsset,
	getFont,
	getShader,
	hasAsset,
} from "./cache.js";
import { preloadAseprite } from "./parsers/aseprite.js";
import { preloadAudio, unloadAllAudio, unloadAudio } from "./parsers/audio.js";
import { preloadBinary } from "./parsers/binary.js";
import { preloadFontFace } from "./parsers/fontface.js";
import { preloadGLTF } from "./parsers/gltf.js";
import { preloadImage } from "./parsers/image.js";
import { preloadJSON } from "./parsers/json.js";
import { preloadMTL } from "./parsers/mtl.js";
import { preloadOBJ } from "./parsers/obj.js";
import { preloadJavascript } from "./parsers/script.js";
import { preloadShader } from "./parsers/shader.js";
import { preloadTMX } from "./parsers/tmx.js";
import { preloadVideo } from "./parsers/video.js";

// the cache read accessors live with the caches themselves; re-exported
// here so `loader.getImage(...)` and its siblings are unchanged
export {
	getBinary,
	getFont,
	getGLTF,
	getImage,
	getJSON,
	getMTL,
	getOBJ,
	getShader,
	getTMX,
	getVideo,
} from "./cache.js";

/**
 * additional import for TypeScript
 * @import {CompressedImage} from "./parsers/compressed_textures/compressed_image.js";
 * @import GLShader from "../video/webgl/glshader.js";
 * @import ShaderEffect from "../video/effects/shadereffect.js";
 */

/**
 * The parsed glTF/GLB scene descriptors, re-exported from the parser that
 * defines them so `loader.GLTFData` keeps naming a type.
 *
 * `getGLTF` is reached as `loader.getGLTF`, and the parser module is not part
 * of the public entry point, so without these the return type of a public
 * function was a type a consumer could not name.
 * @typedef {import("./parsers/gltf.js").GLTFData} GLTFData
 */
/**
 * One mesh primitive out of a parsed glTF/GLB scene.
 * @typedef {import("./parsers/gltf.js").GLTFNode} GLTFNode
 */
/**
 * a small class to manage loading of stuff and manage resources
 * @namespace loader
 */

//  to enable/disable caching
export let nocache = "";

/**
 * @type {Object.<string, string>}
 */
export const baseURL = {};

/**
 * crossOrigin attribute to configure the CORS requests made by a `<video>` or `<script>` element, and by the images
 * of a glTF model. The "anonymous" keyword means that there will be no exchange of user credentials via cookies,
 * client-side SSL certificates or HTTP authentication as described in the Terminology section of the CORS
 * specification; "use-credentials" sends them, as `withCredentials` does.<br>
 * Every other asset (images, JSON, maps, binary files, audio...) is always requested with CORS, whatever this says:
 * an asset on another origin loads when its server allows it (an `Access-Control-Allow-Origin` header), and fails
 * to load, with an error naming the asset, when it does not.<br>
 * @type {string}
 * @default undefined
 * @see {@link setOptions}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes}
 * @deprecated since 20.4.0, read-only — set it with
 * {@link setOptions}. This is a module binding, so assigning to it throws a
 * `TypeError`; the example below never worked.
 * @example
 *  // play videos from another origin, without credentials
 * me.loader.setOptions({ crossOrigin: "anonymous" });
 *
 * // set all resources to be loaded
 * me.loader.preload(game.resources, () => this.loaded());
 */
export let crossOrigin;

/**
 * indicates whether or not cross-site Access-Control requests should be made using credentials such as cookies,
 * authorization headers or TLS client certificates. Setting withCredentials has no effect on same-site requests:
 * assets on the game's own origin always carry the browser's credentials, as the page and its scripts do, so a
 * game behind a login or session cookie loads its own assets without it.
 * @public
 * @type {boolean}
 * @see {@link setOptions}
 * @default false
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/withCredentials}
 * @deprecated since 20.4.0, read-only — set it with
 * {@link setOptions}. This is a module binding, so assigning to it throws a
 * `TypeError`; the example below never worked.
 * @example
 *  // enable withCredentials, for assets behind a session cookie or login
 * me.loader.setOptions({ withCredentials: true });
 *
 * // set all resources to be loaded
 * me.loader.preload(game.resources, () => this.loaded());
 */
export let withCredentials = false;

/**
 * enable the nocache mechanism
 * @ignore
 * @internal
 */
export function setNocache(enable = false) {
	nocache = enable ? "?" + ~~(Math.random() * 10000000) : "";
}

/**
 * Sets the options for the loader.
 * @param {Object} options - The options to set.
 * @param {string} [options.crossOrigin] - The crossOrigin attribute of the `<video>` and `<script>` elements and glTF images the loader creates ("anonymous" or "use-credentials"). Every other asset is always requested with CORS.
 * @param {boolean} [options.nocache] - Enable or disable the nocache mechanism.
 * @param {boolean} [options.withCredentials] - Indicates whether or not cross-site Access-Control requests should be made using credentials. Requests to the game's own origin always carry them.
 * @example
 * // Set the crossOrigin attribute of the video and script elements to "anonymous"
 * me.loader.setOptions({ crossOrigin: "anonymous" });
 *
 * // Enable the nocache mechanism
 * me.loader.setOptions({ nocache: true });
 *
 * // Enable withCredentials
 * me.loader.setOptions({ withCredentials: true });
 * @category Assets
 */
export function setOptions(options) {
	if (options.crossOrigin !== undefined) {
		crossOrigin = options.crossOrigin;
	}
	if (options.nocache !== undefined) {
		setNocache(options.nocache);
	}
	if (options.withCredentials !== undefined) {
		withCredentials = options.withCredentials;
	}
}

/**
 * change the default baseURL for the given asset type.<br>
 * (this will prepend the asset URL and must finish with a '/')
 * @public
 * @param {string} type  - "*", "audio", "video", "binary", "image", "json", "js", "tmx", "tsx", "fontface", "aseprite", "shader", "obj", "mtl", "gltf", "glb"
 * @param {string} [url="./"] - default base URL
 * @example
 * // change the base URL relative address for audio assets
 * me.loader.setBaseURL("audio", "data/audio/");
 * // change the base URL absolute address for all object types
 * me.loader.setBaseURL("*", "http://myurl.com/")
 * @category Assets
 */
export function setBaseURL(type, url = "./") {
	if (type !== "*") {
		baseURL[type] = url;
	} else {
		// "wildcards"
		baseURL["audio"] = url;
		baseURL["video"] = url;
		baseURL["binary"] = url;
		baseURL["image"] = url;
		baseURL["json"] = url;
		baseURL["js"] = url;
		baseURL["tmx"] = url;
		baseURL["tsx"] = url;
		baseURL["fontface"] = url;
		baseURL["aseprite"] = url;
		baseURL["shader"] = url;
		// deliberately NOT part of the wildcard: 3D asset types resolve
		// their internal references (map_Kd textures, glTF buffers) relative
		// to their own file, so a global prefix would double-prefix them —
		// set them individually when needed
	}
}

/**
 * list of parser function for supported format type
 */
const parsers = new Map();

/**
 * keep track if parsers were registered
 */
let parserInitialized = false;

/**
 * The progress {@link loader.preload} reports through `LOADER_PROGRESS`: the
 * assets asked for and how many of them have loaded.
 *
 * One tally for every preload in flight, so that a second preload started
 * before the first has settled joins it and the one progress bar keeps
 * counting, rather than two calls taking turns to move it back and forth. Once
 * every asset in it has settled (loaded or failed), the next preload starts a
 * fresh tally from zero. These counters used to live for the whole session, so
 * a second preload of two assets reported `0.75, 1` instead of `0.5, 1`, and
 * after one failed asset no later preload reached `1` at all.
 * @typedef {object} PreloadTally
 * @property {number} total - assets asked for
 * @property {number} loaded - assets that loaded
 * @property {number} settled - assets that loaded or failed
 * @ignore
 * @internal
 */

/**
 * the tally of the preloads in flight, or `null` between them
 * @type {PreloadTally|null}
 * @ignore
 * @internal
 */
let tally = null;

/**
 * Assets that failed to load, keyed by their `src`, each with the preload call
 * it belonged to — so {@link loader.reload} completes THAT call, with its own
 * callback, and counts the retry towards its own progress.
 * @type {Object<string, {asset: Asset, call: {onload: Function|undefined, tally: PreloadTally, pending: number, failed: Set<string>}}>}
 * @ignore
 * @internal
 */
const failureLoadedAssets = {};

/**
 * init all supported parsers
 * @ignore
 * @internal
 */
function initParsers() {
	setParser("binary", preloadBinary);
	setParser("image", preloadImage);
	setParser("json", preloadJSON);
	setParser("js", preloadJavascript);
	setParser("tmx", preloadTMX);
	setParser("tsx", preloadTMX);
	setParser("audio", preloadAudio);
	setParser("fontface", preloadFontFace);
	setParser("video", preloadVideo);
	setParser("obj", preloadOBJ);
	setParser("mtl", preloadMTL);
	setParser("gltf", preloadGLTF);
	setParser("glb", preloadGLTF);
	setParser("aseprite", preloadAseprite);
	setParser("shader", preloadShader);
	parserInitialized = true;
}

// The running application, captured without importing the `game` global —
// the loader is a module singleton and has no instance to be handed one.
// `on` rather than `once` so a re-init (a second Application, tests) stays
// current.
let _app;
on(GAME_INIT, (app) => {
	_app = app;
});

/**
 * Compile the backend's built-in shaders before completion is announced.
 *
 * Deliberately here rather than in `Application.init()`: init runs before
 * anything is on screen, so warming there would just lengthen a blank page.
 * By this point the loading screen is up, its progress bar has been at 100%
 * for a frame, and `LOADER_COMPLETE` has not fired — so nothing has moved on
 * yet and the time is genuinely free.
 *
 * Every shader declared as an asset is already compiled and in `shaderList`
 * by now, which is what lets a level's own effects be warmed by declaring
 * them alongside that level's assets.
 * @returns {Promise<void>} settles when warm, or immediately when disabled
 * @ignore
 * @internal
 */
function runShaderPrewarm() {
	if (_app === undefined || _app.settings?.prewarm !== true) {
		return Promise.resolve();
	}
	// never let a warm-up failure fail the preload — the frame it would have
	// saved is not worth a game that cannot start. `try` as well as `catch`:
	// `Promise.resolve()` only wraps a value, so a custom renderer whose
	// `prewarm` throws SYNCHRONOUSLY would escape before there is a promise to
	// reject, and take the preload down with it
	try {
		return Promise.resolve(_app.renderer?.prewarm?.()).catch(() => {});
	} catch {
		return Promise.resolve();
	}
}

/**
 * Complete loading: invoke the callback and emit the LOADER_COMPLETE event.
 * @param {Function} [onloadcb] - the completion callback of the preload that
 * completed, if it was given one. Only ever that preload's own: an earlier
 * call's callback used to be kept and fired again by a later preload that
 * passed none, so `await loader.preload(levelAssets)` re-ran the boot
 * callback — typically a `state.change` back to the first screen.
 * @ignore
 * @internal
 */
function completeLoading(onloadcb) {
	if (typeof onloadcb === "function") {
		onloadcb();
	}
	// always signal completion — with the Promise form of preload() a callback
	// is optional (you can `await` instead), so a missing callback is no longer
	// an error; the loading screen / consumers react to LOADER_COMPLETE.
	emit(LOADER_COMPLETE);
}

/**
 * count one loaded asset towards its tally and report the progress
 * @param {Asset} res - the asset that loaded
 * @param {PreloadTally} counts - the tally it belongs to
 * @ignore
 * @internal
 */
function onResourceLoaded(res, counts) {
	delete failureLoadedAssets[res.src];
	counts.loaded++;
	emit(LOADER_PROGRESS, counts.loaded / counts.total, res);
}

/**
 * on error callback for image loading
 * @param {Asset} res - asset that loaded with failure
 * @param {object} call - the preload call it belonged to
 * @ignore
 * @internal
 */
function onLoadingError(res, call) {
	failureLoadedAssets[res.src] = { asset: res, call };
	call.failed.add(res.src);
	emit(LOADER_ERROR, res);
	throw new Error("Failed loading resource " + res.src);
}

/** a src that is already a bare path needs no unwrapping @ignore @internal */
const keepSrc = (src) => {
	return src;
};

/**
 * The one rule that holds for every asset type: a data URI carries its own
 * payload, so nothing can be relative to it. Checked by `load()` for all types
 * rather than left to `needsBaseURL`, so that a type overriding that hook
 * declares only its OWN exceptions and cannot forget this one.
 * @param {string} src - the normalized src
 * @returns {boolean} true for a data URI
 * @ignore
 * @internal
 */
const isDataURI = (src) => {
	return src.startsWith("data:");
};

/** default: a src is a path relative to its type's base URL @ignore @internal */
const alwaysRelative = () => {
	return true;
};

/**
 * A registered parser, normalized by {@link loader.setParser}.
 *
 * Every type gets the same shape whether or not it needs the src hooks, so
 * `load()` can treat all of them alike. The alternative — a bare function that
 * some types decorate with extra properties — puts the knowledge of which
 * types are special back into the caller, which is what moving it out was for.
 * @typedef {object} AssetParser
 * @property {Function} parse - preloads the asset and returns how many
 * resources it will load (0 when already cached)
 * @property {function(string): string} normalizeSrc - turns a type-specific
 * descriptor into a bare path, before any base URL is applied. Identity unless
 * the type overrides it
 * @property {function(string): boolean} needsBaseURL - whether the normalized
 * src is relative to this type's base URL. Declares only this type's own
 * exceptions, such as a `local()` font naming an installed family — data URIs
 * are excluded for every type before this is consulted
 * @ignore
 * @internal
 */

/**
 * an asset definition to be used with the loader
 * @typedef {object} Asset
 * @property {string} name - name of the asset
 * @property {string} type  - the type of the asset ("audio"|"binary"|"image"|"json"|"js"|"tmx"|"tsx"|"fontface"|"video"|"aseprite"|"shader"|"obj"|"mtl"|"gltf"|"glb"). JSON-serialised Tiled maps and tilesets (`.tmj` / `.tsj`) load under `"tmx"` / `"tsx"` — those are file extensions, not asset types. Any other type is one registered with {@link loader.setParser}.
 * @property {string|string[]} [src]  - path and/or file name of the resource (for audio assets only the path is required).
 * For image assets, an array of sources can be provided as a fallback chain (e.g. compressed texture formats by priority, with a PNG fallback).
 * The loader will try each source in order and use the first one that loads successfully.
 * @property {string|{glsl?: string, wgsl?: string}} [data]  - inline content if not provided through a src url: TMX data for "tmx" assets, GLSL source (the ShaderEffect fragment-body convention) for "shader" assets. A shader may instead carry a `{glsl, wgsl}` pair, so one asset serves both backends; either half may be omitted
 * @property {boolean} [stream=false] - Set to true to not to wait for large audio or video file to be downloaded before playing.
 * @property {boolean} [autoplay=false] - Set to true to automatically start playing audio or video when loaded or added to a scene (using autoplay might require user iteraction to enable it)
 * @property {boolean} [loop=false] - Set to true to automatically loop the audio or video when playing
 * @see {@link preload}
 * @see {@link load}
 * @example
 *   // PNG tileset
 *   {name: "tileset-platformer", type: "image",  src: "data/map/tileset.png"}
 *   // PNG packed texture
 *   {name: "texture", type:"image", src: "data/gfx/texture.png"}
 *   // PNG base64 encoded image
 *   {name: "texture", type:"image", src: "data:image/png;base64,iVBORw0KAAAQAAAAEACA..."}
 *   // compressed texture with fallback chain (tries each source in order until one succeeds)
 *   {name: "terrain", type:"image", src: ["data/gfx/terrain.astc.ktx", "data/gfx/terrain.dds", "data/gfx/terrain.png"]}
 *   // TSX file
 *   {name: "meta_tiles", type: "tsx", src: "data/map/meta_tiles.tsx"}
 *   // TMX level (XML & JSON)
 *   {name: "map1", type: "tmx", src: "data/map/map1.json"}
 *   {name: "map2", type: "tmx", src: "data/map/map2.tmx"}
 *   {name: "map3", type: "tmx", format: "json", data: {"height":15,"layers":[...],"tilewidth":32,"version":1,"width":20}}
 *   {name: "map4", type: "tmx", format: "xml", data: {xml representation of tmx}}
 *   // audio resources
 *   {name: "bgmusic", type: "audio",  src: "data/audio/"}
 *   {name: "cling",   type: "audio",  src: "data/audio/"}
 *   // base64 encoded audio resources
 *   {name: "band",   type: "audio",  src: "data:audio/wav;base64,..."}
 *   // binary file
 *   {name: "ymTrack", type: "binary", src: "data/audio/main.ym"}
 *   // JSON file (used for texturePacker)
 *   {name: "texture", type: "json", src: "data/gfx/texture.json"}
 *   // JSON file holding collision shapes drawn in a physics-shape editor,
 *   // named by a body definition as `{ shapes: "shapes", id: <body name> }`
 *   {name: "shapes", type: "json", src: "data/physics/shapes.json"}
 *   // JavaScript file
 *   {name: "plugin", type: "js", src: "data/js/plugin.js"}
 *   // Font Face
 *   { name: "'kenpixel'", type: "fontface",  src: "data/font/kenvector_future.woff2" }
 *   // video resources
 *   {name: "intro", type: "video",  src: "data/video/"}
 *   // 3D assets: Wavefront OBJ model + MTL material library
 *   {name: "ship",  type: "obj", src: "data/models/ship.obj"}
 *   {name: "ship",  type: "mtl", src: "data/models/ship.mtl"}
 *   // glTF / GLB scene (auto-registers with the level director)
 *   {name: "diorama", type: "glb", src: "data/scenes/diorama.glb"}
 *   // shader assets: an effect body, or a complete dual-backend program
 *   {name: "flash", type: "shader", src: "shaders/flash.frag"}
 *   {name: "toon",  type: "shader", src: {vertex: "shaders/toon.vert", fragment: "shaders/toon.frag", wgsl: "shaders/toon.wgsl"}}
 */

/**
 * Teach the loader an asset type of your own, or replace the parser of an
 * existing one.
 *
 * Once registered, an entry of that `type` goes in a preload list like any
 * other: {@link loader.preload} counts it as one step of the progress bar and
 * waits for it before `LOADER_COMPLETE`. That makes it the place for work
 * that is not a download at all, such as a texture generated in code: done
 * here it happens behind the loading screen, rather than on the first frame
 * of the stage that needs it.
 *
 * The parser is called as `parserFn(asset, onload, onerror, settings)`:
 * - `asset` is the preload entry, `{ name, type, src, ... }`. `src` is
 *   optional, so `{ name, type }` is a complete entry for something generated.
 * - Call `onload()` once the asset is ready, or `onerror(error)` if it
 *   failed. Exactly one of them, now or later.
 * - Return `1` if it will call one of them, or `0` when there is nothing to
 *   load, in which case the loader moves on without waiting.
 * - `onload` takes no value, and the loader keeps nothing for a type it does
 *   not know: keep the result yourself (a `Map` keyed by `asset.name`, say)
 *   and read it from there.
 *
 * Register before preloading. Registering the same type twice logs a
 * warning, so do it once rather than in code that runs on every scene.
 * A `src` is prefixed by {@link loader.setBaseURL} only when one is set for
 * this type by name: the `"*"` wildcard does not cover custom types.
 * @param {string} type - asset type
 * @param {Function} parserFn - parser function, as described above
 * @see {@link Asset.type}
 * @example
 * // a texture generated in code rather than loaded, baked behind the
 * // loading screen and read back by name
 * const skies = new Map();
 * loader.setParser("sky", (asset, onload, onerror) => {
 *     bakeSky(asset.name) // the game's own generator, returning a Promise
 *         .then((canvas) => {
 *             skies.set(asset.name, canvas);
 *             onload();
 *         }, onerror);
 *     return 1;
 * });
 * await loader.preload([{ name: "nebula", type: "sky" }]);
 * const backdrop = new Sprite(0, 0, { image: skies.get("nebula") });
 * @example
 * // a file format of your own, fetched from `src`
 * const levels = new Map();
 * loader.setParser("csv", (asset, onload, onerror) => {
 *     fetch(asset.src)
 *         .then((response) => {
 *             // a 404 still resolves: without this the error page is parsed
 *             if (!response.ok) {
 *                 throw new Error(`${asset.src}: HTTP ${response.status}`);
 *             }
 *             return response.text();
 *         })
 *         .then((text) => {
 *             levels.set(asset.name, text.split("\n").map((row) => row.split(",")));
 *             onload();
 *         })
 *         .catch(onerror);
 *     return 1;
 * });
 * loader.setBaseURL("csv", "data/levels/");
 * await loader.preload([{ name: "level1", type: "csv", src: "level1.csv" }]);
 * @category Assets
 */
export function setParser(type, parserFn) {
	if (typeof parserFn !== "function") {
		throw new Error("invalid parser function for " + type);
	}

	if (typeof parsers.get(type) !== "undefined") {
		warnOnce("melonJS: overriding parser for " + type + " format");
	}

	parsers.set(type, {
		parse: parserFn,
		normalizeSrc: parserFn.normalizeSrc ?? keepSrc,
		needsBaseURL: parserFn.needsBaseURL ?? alwaysRelative,
	});
}

/**
 * set all the specified game assets to be preloaded.
 * @param {Asset[]} assets - list of assets to load
 * @param {Function} [onloadcb] - function to be called when all resources are
 * loaded. Each call has only its own: a preload given none calls nothing,
 * whatever an earlier preload was given
 * @param {boolean} [switchToLoadState=true] - automatically switch to the loading screen
 * @returns {Promise<void>} resolves once every asset has loaded (rejects on a
 * load failure). The `onloadcb` callback is still invoked on success, so both
 * the callback and `await` forms work — use whichever you prefer.
 *
 * Progress is reported through {@link event.LOADER_PROGRESS} as the share of
 * this call's assets loaded so far, reaching 1 with the last of them. A
 * preload started while another is still loading joins it, and the progress
 * then covers the assets of both; once they have all settled, the next preload
 * counts from zero again.
 * @example
 * game.assets = [
 *   // PNG tileset
 *   {name: "tileset-platformer", type: "image",  src: "data/map/tileset.png"},
 *   // PNG packed texture
 *   {name: "texture", type:"image", src: "data/gfx/texture.png"}
 *   // PNG base64 encoded image
 *   {name: "texture", type:"image", src: "data:image/png;base64,iVBORw0KAAAQAAAAEACA..."},
 *   // compressed texture with fallback chain (tries each source in order until one succeeds)
 *   {name: "terrain", type:"image", src: ["data/gfx/terrain.astc.ktx", "data/gfx/terrain.dds", "data/gfx/terrain.png"]},
 *   // TSX file
 *   {name: "meta_tiles", type: "tsx", src: "data/map/meta_tiles.tsx"},
 *   // TMX level (XML & JSON)
 *   {name: "map1", type: "tmx", src: "data/map/map1.json"},
 *   {name: "map2", type: "tmx", src: "data/map/map2.tmx"},
 *   {name: "map3", type: "tmx", format: "json", data: {"height":15,"layers":[...],"tilewidth":32,"version":1,"width":20}},
 *   {name: "map4", type: "tmx", format: "xml", data: {xml representation of tmx}},
 *   // audio resources
 *   {name: "bgmusic", type: "audio",  src: "data/audio/"},
 *   {name: "cling",   type: "audio",  src: "data/audio/"},
 *   // base64 encoded audio resources
 *   {name: "band",   type: "audio",  src: "data:audio/wav;base64,..."},
 *   // binary file
 *   {name: "ymTrack", type: "binary", src: "data/audio/main.ym"},
 *   // JSON file (used for texturePacker)
 *   {name: "texture", type: "json", src: "data/gfx/texture.json"},
 *   // JSON file holding collision shapes drawn in a physics-shape editor,
 *   // named by a body definition as `{ shapes: "shapes", id: <body name> }`
 *   {name: "shapes", type: "json", src: "data/physics/shapes.json"},
 *   // JavaScript file
 *   {name: "plugin", type: "js", src: "data/js/plugin.js"},
 *   // Font Face
 *   {name: "'kenpixel'", type: "fontface",  src: "data/font/kenvector_future.woff2"},
 *   // video resources
 *   {name: "intro", type: "video",  src: "data/video/"},
 *   // base64 encoded video asset
 *   me.loader.load({name: "avatar", type:"video", src: "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZ..."};
 * ];
 * ...
 * // set all resources to be loaded (callback form)
 * me.loader.preload(game.assets, () => this.loaded());
 * // ...or await it (the callback still fires too)
 * await me.loader.preload(game.assets);
 * @category Assets
 */
export function preload(assets, onloadcb, switchToLoadState = true) {
	// join the preloads still in flight, or start counting afresh
	if (tally === null || tally.settled === tally.total) {
		tally = { total: 0, loaded: 0, settled: 0 };
	}
	const counts = tally;

	// this call, with its own callback: kept per call rather than in module
	// state, so neither a later preload nor a `reload()` of one of its assets
	// can fire a callback that belongs to another
	const call = {
		onload: onloadcb,
		tally: counts,
		pending: 0,
		failed: new Set(),
	};

	const settle = () => {
		counts.settled++;
		call.pending--;
		if (tally === counts && counts.settled === counts.total) {
			tally = null;
		}
	};

	// parse the resources and collect a promise for each asset. `load()` now
	// returns a Promise in its no-callback form, so there's no need to wrap a
	// callback in `new Promise` here — just layer the progress / error reporting
	// on top of it. Each asset counts as one toward the progress total (parsers
	// load 0 or 1 resource; a cached asset resolves immediately and still
	// reports progress). Counted as each one starts, so an asset `load()`
	// throws for (an unknown type) does not leave a tally that never settles.
	const promises = assets.map((asset) => {
		const loading = load(asset);
		counts.total++;
		call.pending++;
		return loading
			.then(() => {
				settle();
				onResourceLoaded(asset, counts);
			})
			.catch((err) => {
				settle();
				// onLoadingError emits LOADER_ERROR and throws by design, so this
				// re-rejects → Promise.all (and the returned promise) reject and
				// `await loader.preload(...)` surfaces the failure. The trailing
				// throw keeps the rejection meaningful should it ever stop throwing.
				onLoadingError(asset, call);
				throw err;
			});
	});

	if (switchToLoadState === true) {
		// switch to the loading screen
		state.change(state.LOADING);
	}

	// Resolve once every asset has loaded; call the completion callback on
	// success (back-compat). Returned so callers can `await loader.preload(...)`
	// instead of (or as well as) passing a callback.
	return Promise.all(promises)
		.then(runShaderPrewarm)
		.then(() => {
			completeLoading(call.onload);
		});
}

/**
 * retry loading assets after a loading failure.
 *
 * The retried asset counts towards the progress of the preload it failed in,
 * and once every asset of that preload has loaded, that preload completes:
 * its own callback is called, if it was given one, and `LOADER_COMPLETE` is
 * emitted. The promise that preload returned has already rejected and stays so.
 * @param {string} src - src of asset to reload
 * @example
 *  event.on(
 *      event.LOADER_ERROR,
 *      (res) => {
 *          // custom function
 *          showErrorNotification({
 *              text: `Error during loading content: ${res.name}`,
 *              done: loader.reload(res.src);
 *          })
 *      }
 *  );
 **/
export function reload(src) {
	const { asset: assetToReload, call } = failureLoadedAssets[src];
	// drop whatever the failed attempt left behind. A type registered with
	// `setParser` has nothing in the loader's caches, and `unload` throws for
	// a type it does not know, which made such an asset impossible to retry
	if (
		CACHED_TYPES.includes(assetToReload.type) ||
		UNCACHED_TYPES.includes(assetToReload.type)
	) {
		unload(assetToReload);
	}

	new Promise((resolve, reject) => {
		const count = load(
			assetToReload,
			() => {
				call.failed.delete(src);
				onResourceLoaded(assetToReload, call.tally);
				resolve();
			},
			(err) => {
				// still failing: recorded again against the same call
				try {
					onLoadingError(assetToReload, call);
				} catch {
					// the error is reported through LOADER_ERROR
				}
				reject(err);
			},
		);
		if (count === 0) {
			call.failed.delete(src);
			delete failureLoadedAssets[src];
			resolve();
		}
	}).then(
		() => {
			// complete the preload this asset belonged to, once nothing of it
			// is still loading or failed
			if (call.pending === 0 && call.failed.size === 0) {
				completeLoading(call.onload);
			}
		},
		() => {},
	);
}

/**
 * Load a single asset (to be used if you need to load additional asset(s) during the game)
 * @param {Asset} asset
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number|Promise<void>} with `onload`/`onerror` provided, the amount
 * of corresponding resource to be preloaded (the legacy callback form). With
 * **both omitted**, a Promise that resolves once the asset has loaded, so you
 * can `await loader.load(asset)` for a one-off dynamic load.
 * @example
 * // load an image asset (callback form)
 * me.loader.load({name: "avatar",  type:"image",  src: "data/avatar.png"}, () => this.onload(), () => this.onerror());
 * // ...or await a single dynamic asset (no callbacks)
 * await me.loader.load({name: "avatar", type: "image", src: "data/avatar.png"});
 * // load a compressed texture with fallback chain
 * me.loader.load({name: "terrain", type:"image", src: ["data/gfx/terrain.astc.ktx", "data/gfx/terrain.dds", "data/gfx/terrain.png"]}, () => this.onload());
 * // load a base64 image asset
 *  me.loader.load({name: "avatar", type:"image", src: "data:image/png;base64,iVBORw0KAAAQAAAAEACA..."};
 *  // load a base64 video asset
 *  me.loader.load({
 *     name: "avatar",
 *     type:"video",
 *     src: "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZ.."
 *  };
 * // start loading music
 * me.loader.load({
 *     name   : "bgmusic",
 *     type   : "audio",
 *     src    : "data/audio/"
 * }, function () {
 *     me.audio.play("bgmusic");
 * });
 * @category Assets
 */
export function load(asset, onload, onerror) {
	// make sure all parsers have been initialized
	if (parserInitialized === false) {
		initParsers();
	}

	const parser = parsers.get(asset.type);

	if (typeof parser === "undefined") {
		throw new Error("load : unknown or invalid resource type : " + asset.type);
	}

	// Resolve the effective src WITHOUT mutating the caller's asset
	// descriptor: load() used to write the transformed url back into
	// asset.src, so retrying the same object — loader.reload() after a
	// failure, or simply load()ing the same manifest entry twice —
	// prepended baseURL onto an already-transformed src and fetched a
	// mangled URL. Caches, events and failure tracking all key on the
	// caller's original src; only the parser sees the resolved one.
	let src = asset.src;

	// Normalize, then prefix — both through the parser, so this function never
	// names an asset type. `src` may legitimately be an array (an image
	// fallback chain) or absent, and neither hook applies to those.
	if (typeof src === "string") {
		src = parser.normalizeSrc(src);
		if (
			typeof baseURL[asset.type] !== "undefined" &&
			!isDataURI(src) &&
			parser.needsBaseURL(src)
		) {
			src = baseURL[asset.type] + src;
		}
	}

	const resource =
		src === asset.src ? asset : Object.assign({}, asset, { src });

	const settings = {
		nocache: nocache,
		crossOrigin: crossOrigin,
		withCredentials: withCredentials,
	};

	// Promise form: with no callbacks, resolve once the asset (and any
	// sub-resources) have loaded — for a one-off `await loader.load(asset)`.
	// The legacy callback form below still returns the resource count.
	if (onload === undefined && onerror === undefined) {
		return new Promise((resolve, reject) => {
			// parser returns the amount of asset to be loaded (usually 1, more
			// if it splits into several); 0 means already cached → resolve now.
			const count = parser.parse.call(
				this,
				resource,
				() => {
					resolve();
				},
				reject,
				settings,
			);
			if (count === 0) {
				resolve();
			}
		});
	}

	// parser returns the amount of asset to be loaded (usually 1 unless an asset is splitted into several ones)
	return parser.parse.call(this, resource, onload, onerror, settings);
}

/**
 * the types {@link loader.unload} handles without a cache entry of their own
 * @ignore
 * @internal
 */
const UNCACHED_TYPES = ["js", "audio", "fontface", "shader", "aseprite"];

/**
 * unload the specified asset to free memory
 * @param {Asset} asset
 * @returns {boolean} true if unloaded
 * @example me.loader.unload({name: "avatar",  type:"image"});
 * @category Assets
 */
export function unload(asset) {
	switch (asset.type) {
		case "js":
			// nothing is cached for a script: it ran at load time
			return true;

		case "audio":
			return unloadAudio(asset.name);

		case "fontface": {
			// the FontFace has to leave the document's own set as well, and
			// the membership guard comes first because `FontFaceSet.delete`
			// is silent about a face it does not have
			if (!hasAsset("fontface", asset.name)) {
				return false;
			}
			if (
				typeof globalThis.document !== "undefined" &&
				typeof globalThis.document.fonts !== "undefined"
			) {
				globalThis.document.fonts.delete(getFont(asset.name));
				return deleteAsset("fontface", asset.name);
			}
			return false;
		}

		case "shader": {
			// the `false` for a shader that was never loaded comes from
			// `deleteAsset` below; `getShader` returns null for a missing key,
			// so there is nothing to guard against here
			const effect = getShader(asset.name);
			// the loader owns the shared ShaderEffect/GLShader — actually free
			// the GL program, don't just drop the cache entry. A `null` entry
			// is a {vertex, fragment} pair loaded under the Canvas renderer
			// (no GL program to free).
			effect?.destroy();
			return deleteAsset("shader", asset.name);
		}

		case "aseprite": {
			// an aseprite asset populates both the image and the json cache
			// under the same key, and either one alone counts as present
			const hadImage = deleteAsset("image", asset.name);
			const hadJson = deleteAsset("json", asset.name);
			return hadImage || hadJson;
		}

		default:
			// every other type is one entry in one cache. An unrecognised type
			// throws, as it always has: `load` throws for one too, and a typo
			// that is loud going in should not be silent coming out
			if (!CACHED_TYPES.includes(asset.type)) {
				throw new Error(
					"unload : unknown or invalid resource type : " + asset.type,
				);
			}
			return deleteAsset(asset.type, asset.name);
	}
}

/**
 * unload all resources to free memory
 * @example me.loader.unloadAll();
 * @category Assets
 */
export function unloadAll() {
	// Driven off the cache registry itself, so a new asset type is swept by
	// registering its cache and nothing else. `tsx` and `glb` alias caches
	// their siblings already cleared, which costs one empty pass each.
	for (const type of CACHED_TYPES) {
		for (const name of assetNames(type)) {
			unload({ name, type });
		}
	}

	// and the audio, which keeps its own store
	unloadAllAudio();
}
