import { warnOnce } from "../lang/console.js";
import { level } from "../level/level.js";
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
	imgList,
} from "./cache.js";
import { preloadAseprite } from "./parsers/aseprite.js";
import {
	hasAudioAsset,
	preloadAudio,
	unloadAllAudio,
	unloadAudio,
} from "./parsers/audio.js";
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
 * A bundle declared with {@link loader.setBundle}: a named list of assets with
 * a lifetime of its own, over the same caches as every other asset.
 *
 * `state` is what `setBundle` checks: a bundle is `"loading"` from a
 * `load(id)` / `preload([id])` until every asset of that call has settled,
 * `"loaded"` after that (even when one failed: it keeps the ones that did
 * load), and `"unloaded"` again after `unload(id)` or `unloadAll()`.
 * `epoch` changes on every unload, so a load still in flight from before
 * cannot hand its assets to a bundle that has since been released.
 * @typedef {object} Bundle
 * @property {Asset[]} assets - the bundle's asset descriptors
 * @property {"unloaded"|"loading"|"loaded"} state - see above
 * @property {number} epoch - bumped on every unload of the bundle
 * @property {number} loads - calls loading it that have not settled yet
 * @ignore
 * @internal
 */

/**
 * the declared bundles, by id
 * @type {Map<string, Bundle>}
 * @ignore
 * @internal
 */
const bundles = new Map();

/**
 * Who holds each resident asset, keyed by {@link assetKey}: the loaded bundles
 * that list it, and whether it is PINNED — loaded the old way, by `preload` or
 * `load` with a descriptor, which no bundle unload frees. An asset nobody
 * holds is freed by the bundle unload that released it last. An entry only
 * exists while somebody holds the asset.
 * @type {Map<string, {pinned: boolean, bundles: Set<string>}>}
 * @ignore
 * @internal
 */
const owners = new Map();

/**
 * Loads started on behalf of bundles and still in flight, keyed by
 * {@link assetKey}, with every bundle that asked for the asset meanwhile — so
 * two bundles sharing an asset, or one bundle loaded twice at once, fetch it
 * once, and each still becomes an owner.
 * @type {Map<string, {promise: Promise<void>, requesters: Map<string, number>}>}
 * @ignore
 * @internal
 */
const inflight = new Map();

/**
 * types that share a cache with another under the same name
 * @ignore
 * @internal
 */
const KEY_ALIASES = { tsx: "tmx", glb: "gltf" };

/**
 * The identity of an asset for ownership: its type (aliases folded onto the
 * cache they share) and its name — what the caches themselves key on.
 * @param {Asset} asset - the asset descriptor
 * @returns {string} the key
 * @ignore
 * @internal
 */
function assetKey(asset) {
	return (KEY_ALIASES[asset.type] ?? asset.type) + ":" + asset.name;
}

/**
 * Whether an asset is in memory: in its cache, or for a type the loader keeps
 * nothing for (scripts, custom types), loaded and not unloaded since.
 * @param {Asset} asset - the asset descriptor
 * @returns {boolean} true if resident
 * @ignore
 * @internal
 */
function isResident(asset) {
	switch (asset.type) {
		case "audio":
			return hasAudioAsset(asset.name);
		case "aseprite":
			return hasAsset("image", asset.name) && hasAsset("json", asset.name);
		default:
			if (CACHED_TYPES.includes(asset.type)) {
				return hasAsset(asset.type, asset.name);
			}
			return owners.has(assetKey(asset));
	}
}

/**
 * the ownership record of an asset, created when missing
 * @param {Asset} asset - the asset descriptor
 * @returns {{pinned: boolean, bundles: Set<string>}} the record
 * @ignore
 * @internal
 */
function ownerRecord(asset) {
	const key = assetKey(asset);
	let record = owners.get(key);
	if (record === undefined) {
		record = { pinned: false, bundles: new Set() };
		owners.set(key, record);
	}
	return record;
}

/**
 * mark an asset as loaded the old way: no bundle unload frees it
 * @param {Asset} asset - the asset descriptor
 * @ignore
 * @internal
 */
function pin(asset) {
	ownerRecord(asset).pinned = true;
}

/**
 * Make the bundles that asked for an asset its owners — those still at the
 * epoch they asked at. One unloaded since (or by `unloadAll`) does not get it.
 * @param {Asset} asset - the asset descriptor
 * @param {Map<string, number>} requesters - bundle id → epoch when it asked
 * @ignore
 * @internal
 */
function adopt(asset, requesters) {
	for (const [id, epoch] of requesters) {
		const bundle = bundles.get(id);
		if (bundle !== undefined && bundle.epoch === epoch) {
			ownerRecord(asset).bundles.add(id);
		}
	}
}

/**
 * Free an asset nobody holds any more, as a bundle unload does: out of its
 * cache, its GPU objects released, and for a map or a glTF scene, its level
 * unregistered (the parser registers it again on the next load).
 * @param {Asset} asset - the asset descriptor
 * @ignore
 * @internal
 */
function release(asset) {
	owners.delete(assetKey(asset));
	// a custom type has nothing in the loader to free
	if (
		CACHED_TYPES.includes(asset.type) ||
		UNCACHED_TYPES.includes(asset.type)
	) {
		freeAsset(asset);
	}
	if (asset.type === "tmx" || asset.type === "gltf" || asset.type === "glb") {
		level.remove(asset.name);
	}
}

/**
 * the bundle declared under an id, or a synchronous throw
 * @param {string} id - the bundle id
 * @returns {Bundle} the bundle
 * @throws {Error} when no bundle is declared under that id
 * @ignore
 * @internal
 */
function requireBundle(id) {
	const bundle = bundles.get(id);
	if (bundle === undefined) {
		throw new Error(
			`loader: unknown bundle "${id}" (declare it with loader.setBundle first)`,
		);
	}
	return bundle;
}

/**
 * Load one asset for the bundles asking for it: at once when it is already
 * resident, by joining the load in flight when there is one, and otherwise by
 * loading it. The bundles become its owners once it is in; and should every
 * one of them have been unloaded while it was loading, the asset is freed
 * again on arrival rather than left in memory with no owner.
 * @param {Asset} asset - the asset descriptor
 * @param {Map<string, number>} requesters - bundle id → epoch when it asked
 * @returns {Promise<void>} settles with the load
 * @ignore
 * @internal
 */
function loadForBundles(asset, requesters) {
	const key = assetKey(asset);
	const pending = inflight.get(key);
	if (pending !== undefined) {
		for (const [id, epoch] of requesters) {
			pending.requesters.set(id, epoch);
		}
		return pending.promise;
	}
	if (isResident(asset)) {
		adopt(asset, requesters);
		return Promise.resolve();
	}
	const entry = { promise: loadAsset(asset), requesters: new Map(requesters) };
	inflight.set(key, entry);
	// registered before any caller's handlers, so ownership is settled by the
	// time they run
	entry.promise.then(
		() => {
			inflight.delete(key);
			adopt(asset, entry.requesters);
			if (!owners.has(key)) {
				release(asset);
			}
		},
		() => {
			inflight.delete(key);
		},
	);
	return entry.promise;
}

/**
 * Turn a preload list — asset descriptors and bundle ids, mixed — into one
 * entry per asset to load, each knowing whether it was asked for directly
 * (`pin`) and by which bundles.
 *
 * A bundle's asset that is already in the list (from another bundle, or
 * listed directly) joins that entry rather than loading twice. Descriptors
 * listed directly are kept one entry each, as they always were. Every id is
 * checked before anything starts, so an unknown one throws synchronously
 * with nothing loaded.
 * @param {Array<Asset|string>} list - the preload list
 * @returns {{entries: Array<{asset: Asset, pin: boolean, bundles: Map<string, number>}>, ids: string[]}} the entries, and the bundle ids in the list
 * @ignore
 * @internal
 */
function expandPreloadList(list) {
	if (!Array.isArray(list)) {
		throw new TypeError("loader.preload: expected an array of assets");
	}
	const ids = [];
	for (const item of list) {
		if (typeof item === "string") {
			requireBundle(item);
			if (!ids.includes(item)) {
				ids.push(item);
			}
		}
	}
	if (ids.length > 0) {
		if (parserInitialized === false) {
			initParsers();
		}
		// with bundles in the list, a bad type anywhere in it throws before
		// any of their loads start, rather than leaving them half started
		for (const item of list) {
			if (typeof item !== "string" && !parsers.has(item?.type)) {
				throw new Error(
					"load : unknown or invalid resource type : " + item?.type,
				);
			}
		}
	}

	const entries = [];
	const byKey = new Map();
	for (const item of list) {
		if (typeof item === "string") {
			const bundle = bundles.get(item);
			for (const asset of bundle.assets) {
				// a typo in a bundle fails before anything is loaded, rather
				// than part-way through with half the bundle in flight
				if (!parsers.has(asset.type)) {
					throw new Error(
						`load : unknown or invalid resource type : ${asset.type} (in bundle "${item}")`,
					);
				}
				const key = assetKey(asset);
				let entry = byKey.get(key);
				if (entry === undefined) {
					entry = { asset, pin: false, bundles: new Map() };
					byKey.set(key, entry);
					entries.push(entry);
				}
				entry.bundles.set(item, bundle.epoch);
			}
		} else {
			const key = assetKey(item);
			const entry = byKey.get(key);
			if (entry !== undefined && entry.pin === false) {
				// a bundle's asset, also listed directly: one load, and pinned
				entry.asset = item;
				entry.pin = true;
			} else {
				const fresh = { asset: item, pin: true, bundles: new Map() };
				if (entry === undefined) {
					byKey.set(key, fresh);
				}
				entries.push(fresh);
			}
		}
	}
	return { entries, ids };
}

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
 * @param {{pin: boolean, bundles: Map<string, number>}} [owner] - who asked
 * for it, so a successful {@link loader.reload} hands it to them
 * @ignore
 * @internal
 */
function onLoadingError(res, call, owner) {
	failureLoadedAssets[res.src] = { asset: res, call, owner };
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
 * Declare every bundle of a record handed to {@link loader.preload}, and
 * return their ids. All of them are checked before any is declared, so a bad
 * one, or one that may not be redefined, throws with nothing changed.
 * @param {Object<string, Asset[]>} record - bundle id → its asset descriptors
 * @returns {string[]} the bundle ids
 * @throws {TypeError} when it is not a record of asset arrays
 * @ignore
 * @internal
 */
function declareBundleRecord(record) {
	if (typeof record !== "object" || record === null) {
		throw new TypeError(
			"loader.preload: expected an array of assets, or a record of bundles",
		);
	}
	if (typeof record.type === "string" && typeof record.name === "string") {
		throw new TypeError(
			`loader.preload: "${record.name}" is a single asset; pass a list of assets ([asset]) or a record of bundles`,
		);
	}
	const ids = Object.keys(record);
	for (const id of ids) {
		if (!Array.isArray(record[id])) {
			throw new TypeError(
				`loader.preload: "${id}" is not a list of assets; a record maps each bundle id to an array of asset descriptors`,
			);
		}
		validateBundle(id, record[id]);
		const existing = bundles.get(id);
		if (
			existing !== undefined &&
			existing.state !== "unloaded" &&
			!sameAssets(existing.assets, record[id])
		) {
			throw new Error(
				`loader.setBundle("${id}"): the bundle is ${existing.state}; unload it before redefining it`,
			);
		}
	}
	for (const id of ids) {
		const existing = bundles.get(id);
		if (existing === undefined || !sameAssets(existing.assets, record[id])) {
			setBundle(id, record[id]);
		}
	}
	return ids;
}

/**
 * Declare every bundle of a record — `{ id: assets, ... }`, as an assets file
 * exports it — and load them all, behind the loading screen.
 *
 * Each key becomes a bundle, exactly as {@link loader.setBundle} would make
 * it (the same checks; a bundle already declared with the same assets is left
 * as it is, and one declared with others is redefined, which throws while it
 * is loaded or loading), and every one of them is then loaded as one preload:
 * one progress bar over all their assets, the shader warm-up, then the
 * callback and `LOADER_COMPLETE`. An asset several bundles list is loaded
 * once. Each bundle is then loaded as if by `load(id)`, so the usual calls
 * apply from there: `unload(id)` to free a level's own assets,
 * `load(id)` to bring them back.
 *
 * Calling it again fetches nothing already in memory. A single asset
 * descriptor passed here by mistake throws a `TypeError`: wrap it in an array.
 * @overload
 * @param {Object<string, Asset[]>} bundles - bundle id → its asset descriptors
 * @param {Function} [onloadcb] - called once every asset has loaded
 * @param {boolean} [switchToLoadState=true] - automatically switch to the loading screen
 * @returns {Promise<void>} resolves once every asset has loaded
 * @example
 * // resources.js
 * export default {
 *     common: [
 *         { name: "player", type: "image", src: "img/player.png" },
 *         { name: "jump",   type: "audio", src: "sfx/" },
 *     ],
 *     map1: [
 *         { name: "map1",  type: "tmx",   src: "map/map1.tmx" },
 *         { name: "hills", type: "image", src: "img/hills.png" },
 *     ],
 *     map2: [
 *         { name: "map2",  type: "tmx",   src: "map/map2.tmx" },
 *         { name: "hills", type: "image", src: "img/hills.png" },
 *     ],
 * };
 *
 * // game.js: the same call as with a flat list
 * import resources from "./resources.js";
 * await loader.preload(resources);
 * // ...later, per level
 * loader.unload("map1");
 * await loader.load("map1");
 * @category Assets
 */
/**
 * set all the specified game assets to be preloaded.
 * @overload
 *
 * The list may also name bundles declared with {@link loader.setBundle},
 * mixed freely with asset descriptors: each id stands for the assets of that
 * bundle, and an asset that appears more than once (in two bundles, or in a
 * bundle and directly) is loaded once. Those bundles are loaded by this call,
 * exactly as {@link loader.load} with their id would, and their assets
 * already in memory are not fetched again. An unknown id throws
 * synchronously, before anything is loaded.
 * @param {Array<Asset|string>} assets - list of assets to load, and/or ids of
 * bundles declared with {@link loader.setBundle}
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
 * @example
 * // bundles and descriptors in one list, behind the loading screen
 * loader.setBundle("common", commonAssets);
 * loader.setBundle("level1", level1Assets);
 * await loader.preload(["common", "level1", { name: "logo", type: "image", src: "img/logo.png" }]);
 * @category Assets
 */
/**
 * @param {Array<Asset|string>|Object<string, Asset[]>} assets - see the overloads
 * @param {Function} [onloadcb] - called once every asset has loaded
 * @param {boolean} [switchToLoadState=true] - automatically switch to the loading screen
 * @returns {Promise<void>} see the overloads
 * @ignore
 */
export function preload(assets, onloadcb, switchToLoadState = true) {
	// a record of bundles: declare them all, then load them all, by id
	if (!Array.isArray(assets)) {
		assets = declareBundleRecord(assets);
	}

	// bundle ids expand to their assets; an unknown one throws here, before
	// the tally, the loading screen or any request
	const { entries, ids } = expandPreloadList(assets);

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
	//
	// An asset listed directly goes through `load()` as it always has (which
	// pins it); one only a bundle asked for goes through `loadForBundles`,
	// which skips it when resident and shares a load already in flight.
	const promises = entries.map((entry) => {
		const asset = entry.asset;
		const loading = entry.pin
			? load(asset)
			: loadForBundles(asset, entry.bundles);
		counts.total++;
		call.pending++;
		return loading
			.then(() => {
				// a bundle asset also listed directly: the bundles own it too
				if (entry.pin && entry.bundles.size > 0) {
					adopt(asset, entry.bundles);
				}
				settle();
				onResourceLoaded(asset, counts);
			})
			.catch((err) => {
				settle();
				// onLoadingError emits LOADER_ERROR and throws by design, so this
				// re-rejects → Promise.all (and the returned promise) reject and
				// `await loader.preload(...)` surfaces the failure. The trailing
				// throw keeps the rejection meaningful should it ever stop throwing.
				onLoadingError(asset, call, entry);
				throw err;
			});
	});

	// the bundles of this call are loading until all of its assets settle;
	// marked only now, so a synchronous throw above leaves them as they were
	const loadingBundles = ids.map((id) => {
		const bundle = bundles.get(id);
		bundle.state = "loading";
		bundle.loads++;
		return { bundle, epoch: bundle.epoch };
	});
	if (loadingBundles.length > 0) {
		Promise.allSettled(promises).then(() => {
			for (const { bundle, epoch } of loadingBundles) {
				// one unloaded meanwhile has already been reset
				if (bundle.epoch === epoch && --bundle.loads === 0) {
					bundle.state = "loaded";
				}
			}
		});
	}

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
	const { asset: assetToReload, call, owner } = failureLoadedAssets[src];
	// drop whatever the failed attempt left behind. A type registered with
	// `setParser` has nothing in the loader's caches, and `unload` throws for
	// a type it does not know, which made such an asset impossible to retry.
	// Freed without touching who owns it: the retry is still on their behalf
	if (
		CACHED_TYPES.includes(assetToReload.type) ||
		UNCACHED_TYPES.includes(assetToReload.type)
	) {
		freeAsset(assetToReload);
	}

	// once in, the asset belongs to whoever asked for it in the failed
	// preload: pinned if it was listed directly, owned by its bundles if a
	// bundle asked — and freed again at once if every one of those bundles
	// has been unloaded since
	const settleOwnership = () => {
		if (owner === undefined || owner.pin) {
			pin(assetToReload);
		}
		if (owner !== undefined && owner.bundles.size > 0) {
			adopt(assetToReload, owner.bundles);
			if (!owners.has(assetKey(assetToReload))) {
				release(assetToReload);
			}
		}
	};

	new Promise((resolve, reject) => {
		const count = loadAsset(
			assetToReload,
			() => {
				settleOwnership();
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
			settleOwnership();
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
 * Declare a bundle and load it, in one call: exactly
 * {@link loader.setBundle} with these assets followed by `load(id)`, so the
 * same checks, the same progress and shader warm-up, and the same promise.
 *
 * Called again with the same assets (same type, name and src, in any order),
 * it simply loads the bundle, fetching nothing already in memory. With
 * different assets it redefines the bundle, which is allowed only while that
 * bundle is not loaded or loading, and throws synchronously otherwise, as
 * `setBundle` does. Release it with {@link loader.unload} and its id.
 * @overload
 * @param {string} id - the bundle id
 * @param {Asset[]|Asset} assets - the bundle's asset descriptors (one
 * descriptor on its own is accepted too)
 * @returns {Promise<void>} resolves once the bundle is loaded
 * @example
 * // a level's assets, declared where they are loaded
 * await loader.load("level2", [
 *     { name: "map2",  type: "tmx",   src: "data/map/map2.tmx" },
 *     { name: "tiles", type: "image", src: "data/img/tiles.png" },
 * ]);
 * // ...and later, by id as usual
 * loader.unload("level2");
 * @category Assets
 */
/**
 * Load a bundle declared with {@link loader.setBundle}: every asset it lists
 * that is not already in memory, then the shader warm-up, the same way
 * {@link loader.preload} does — so `LOADER_PROGRESS` reports this call's
 * assets, and `LOADER_COMPLETE` fires once they are in — but WITHOUT switching
 * to the loading screen: the game keeps running while it loads. Each asset
 * of the bundle is one step of that progress; one already in memory is not
 * fetched again, and counts as a step done at once.
 *
 * The bundle then holds its assets: they stay in memory until
 * {@link loader.unload} with the same id releases them, and are freed then
 * unless another loaded bundle lists them too, or they were loaded the old
 * way (by `preload` / `load` with a descriptor), which pins them. Assets keep
 * their own names: `getImage("tiles")` reads a bundle's image as before.
 *
 * An unknown id throws synchronously. The promise rejects if any asset fails
 * to load, as `preload` does; the assets that did load stay, held by the
 * bundle, and {@link loader.reload} retries the one that failed.
 * @overload
 * @param {string} id - the id of a bundle declared with {@link loader.setBundle}
 * @param {Function} [onload] - called once every asset of the bundle has loaded
 * @param {Function} [onerror] - called with the error if one fails to load
 * @returns {Promise<void>} resolves once the bundle is loaded, in every form
 * @example
 * // the next level's assets, loaded while the current one keeps playing
 * await loader.load("level2");
 * await level.load("level2", { async: true });
 * loader.unload("level1");
 * @category Assets
 */
/**
 * Load a single asset (to be used if you need to load additional asset(s) during the game)
 *
 * An asset loaded this way is pinned: unloading a bundle that also lists it
 * does not free it. {@link loader.unload} with the descriptor does.
 * @overload
 * @param {Asset} asset - the asset to load
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
/**
 * @param {string|Asset} asset - a bundle id, or an asset descriptor
 * @param {Function|Asset[]|Asset} [onload] - called once loaded, or with a
 * bundle id, the assets to declare it with
 * @param {Function} [onerror] - called in case of error
 * @returns {number|Promise<void>} see the overloads
 * @ignore
 */
export function load(asset, onload, onerror) {
	if (typeof asset === "string") {
		if (typeof onload === "object" && onload !== null) {
			// `load(id, assets)`: declare, then load as below. The same
			// assets as already declared just load; others redefine the
			// bundle, which `setBundle` refuses while it is loaded or loading
			const assets = Array.isArray(onload) ? onload : [onload];
			validateBundle(asset, assets);
			const existing = bundles.get(asset);
			if (existing === undefined || !sameAssets(existing.assets, assets)) {
				setBundle(asset, assets);
			}
			return preload([asset], undefined, false);
		}
		// the bundle path is preload's, minus the loading screen: progress,
		// the shader warm-up and LOADER_COMPLETE all come with it
		const loading = preload([asset], onload, false);
		if (typeof onerror === "function") {
			// handled here, so a caller using the callback need not also catch
			// the promise to avoid an unhandled rejection
			loading.catch(onerror);
		}
		return loading;
	}
	return loadAsset(asset, onload, onerror, () => {
		pin(asset);
	});
}

/**
 * Load a single asset through its parser: the body of {@link loader.load}
 * for a descriptor, without the ownership the public call adds.
 * @param {Asset} asset - the asset to load
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Function} [onLoaded] - called once the asset is in, before `onload`
 * or the promise resolves
 * @returns {number|Promise<void>} as {@link loader.load}
 * @ignore
 * @internal
 */
function loadAsset(asset, onload, onerror, onLoaded) {
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

	const loaded = typeof onLoaded === "function" ? onLoaded : () => {};

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
					loaded();
					resolve();
				},
				reject,
				settings,
			);
			if (count === 0) {
				loaded();
				resolve();
			}
		});
	}

	// the callback is wrapped only when there is one: several parsers test
	// `typeof onload === "function"` to decide what to wait for
	const onloadcb =
		typeof onload === "function"
			? () => {
					loaded();
					onload();
				}
			: onload;

	// parser returns the amount of asset to be loaded (usually 1 unless an asset is splitted into several ones)
	const count = parser.parse.call(this, resource, onloadcb, onerror, settings);
	// already cached (no callback will come), or no callback to hear it by
	if (count === 0 || typeof onload !== "function") {
		loaded();
	}
	return count;
}

/**
 * the types {@link loader.unload} handles without a cache entry of their own
 * @ignore
 * @internal
 */
const UNCACHED_TYPES = ["js", "audio", "fontface", "shader", "aseprite"];

/**
 * Unload an asset, or release a bundle, to free memory.
 *
 * **With a bundle id** (see {@link loader.setBundle}), the bundle lets go of
 * each of its assets, and every one that nothing else still holds is freed:
 * an asset another loaded bundle lists stays, and so does one loaded the old
 * way (by `preload` / `load` with a descriptor), which pins it. Freeing a map
 * or a glTF scene also unregisters its level, so `level.load` of it throws
 * "not found" until the bundle is loaded again — and unloading the bundle of
 * the level being played leaves what is in the world as it is, with no current
 * level to reload. Returns `false` when the bundle was not loaded. An unknown
 * id throws synchronously.
 *
 * **With an asset descriptor**, the asset is freed at once, whoever holds it:
 * a bundle listing it reports {@link loader.isLoaded} `false` afterwards, and
 * loading that bundle again fetches it again.
 *
 * Either way, freeing an image also frees the texture the renderer uploaded
 * from it, and freeing a shader its GPU program. A shader handed out by
 * {@link loader.getShader} is not tracked once handed out, so an effect that
 * outlives a level (a HUD's, a camera's) belongs in a bundle that outlives it
 * too, or it is freed under whatever still uses it.
 * @param {string|Asset} asset - a bundle id, or the asset to unload
 * @returns {boolean} true if unloaded
 * @example
 * me.loader.unload({name: "avatar",  type:"image"});
 * @example
 * // after switching levels: free what only the previous level used
 * loader.unload("level1");
 * @category Assets
 */
export function unload(asset) {
	if (typeof asset === "string") {
		return unloadBundle(asset);
	}
	const unloaded = freeAsset(asset);
	// whoever held it, it is gone now: the bundles listing it see it missing
	owners.delete(assetKey(asset));
	return unloaded;
}

/**
 * Release a bundle: drop it from the owners of each of its assets, and free
 * the ones nobody holds any more. Allowed while it is still loading — its
 * assets still in flight are then freed as they arrive, unless another owner
 * has taken them meanwhile.
 * @param {string} id - the bundle id
 * @returns {boolean} false if the bundle was not loaded
 * @ignore
 * @internal
 */
function unloadBundle(id) {
	const bundle = requireBundle(id);
	if (bundle.state === "unloaded") {
		return false;
	}
	bundle.state = "unloaded";
	bundle.loads = 0;
	bundle.epoch++;
	for (const asset of bundle.assets) {
		const record = owners.get(assetKey(asset));
		if (record === undefined || !record.bundles.delete(id)) {
			continue;
		}
		if (record.bundles.size === 0 && !record.pinned) {
			release(asset);
		}
	}
	return true;
}

/**
 * Free an asset from the loader: its cache entry, and what it owns elsewhere
 * — an image's GPU texture, a shader's program, a font's place in the
 * document. The body of {@link loader.unload} for a descriptor, without the
 * ownership bookkeeping.
 * @param {Asset} asset - the asset to free
 * @returns {boolean} true if unloaded
 * @ignore
 * @internal
 */
function freeAsset(asset) {
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
			releaseImageTexture(asset.name);
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
			if (asset.type === "image") {
				releaseImageTexture(asset.name);
			}
			return deleteAsset(asset.type, asset.name);
	}
}

/**
 * Free the texture the renderer made from a cached image, before the image
 * leaves the cache: the GPU copy (WebGL, WebGPU) and the tinted copies
 * (Canvas). An image unloaded used to keep its GPU texture until the next
 * level reset on WebGL, and for good on WebGPU. Nothing to do before the
 * renderer exists, nor for an image never drawn.
 * @param {string} name - the image asset name
 * @ignore
 * @internal
 */
function releaseImageTexture(name) {
	const image = imgList[name];
	if (image === undefined || image === null) {
		return;
	}
	const renderer = _app?.renderer;
	if (typeof renderer?.releaseImage === "function") {
		renderer.releaseImage(image);
	}
}

/**
 * unload all resources to free memory
 *
 * Every asset goes, whoever holds it. Bundles declared with
 * {@link loader.setBundle} stay declared, all of them back to not loaded, so
 * they can be loaded again.
 * @example me.loader.unloadAll();
 * @category Assets
 */
export function unloadAll() {
	// Driven off the cache registry itself, so a new asset type is swept by
	// registering its cache and nothing else. `tsx` and `glb` alias caches
	// their siblings already cleared, which costs one empty pass each.
	for (const type of CACHED_TYPES) {
		for (const name of assetNames(type)) {
			freeAsset({ name, type });
		}
	}

	// and the audio, which keeps its own store
	unloadAllAudio();

	// nobody holds anything now; the bundles stay declared, ready to load
	// again, and a load of one still in flight no longer hands it its assets
	owners.clear();
	for (const bundle of bundles.values()) {
		bundle.state = "unloaded";
		bundle.loads = 0;
		bundle.epoch++;
	}
}

/**
 * Declare a bundle: a named list of the asset descriptors you would otherwise
 * pass to {@link loader.preload}, to load and free together — typically the
 * assets of one level, plus a `"common"` bundle for what every level uses.
 *
 * A bundle is a lifetime, not a namespace: its assets keep their own names
 * and live in the same caches as every other asset, so `getImage("tiles")`
 * and `level.load("map1")` read them as before. Load it with
 * {@link loader.load} (or name it in a {@link loader.preload} list), check it
 * with {@link loader.isLoaded}, and release it with {@link loader.unload}. An
 * asset listed in several bundles is loaded once and freed with the last
 * loaded bundle that lists it.
 *
 * Declaring does not load anything, and a bundle can be declared before the
 * parsers of custom types it uses are registered. Redefining an id replaces
 * its list, but only while that bundle is not loaded or loading: unload it
 * first. The list is copied, so changing the array afterwards changes nothing.
 * An asset listed twice is one asset (type and name identify it), and an
 * empty list is allowed: such a bundle loads at once and is always loaded.
 * @param {string} id - the bundle id
 * @param {Asset[]} assets - its asset descriptors (bundle ids cannot be nested)
 * @throws {TypeError} on an empty or non-string id, or a list that is not an
 * array of asset descriptors
 * @throws {Error} when that bundle is loaded or loading
 * @example
 * loader.setBundle("common", [
 *     { name: "player", type: "image", src: "img/player.png" },
 *     { name: "font",   type: "fontface", src: "font/PressStart2P.ttf" },
 * ]);
 * loader.setBundle("level1", [
 *     { name: "level1", type: "tmx",   src: "map/level1.tmx" },
 *     { name: "hills",  type: "image", src: "img/hills.png" },
 * ]);
 * loader.setBundle("level2", [
 *     { name: "level2", type: "tmx",   src: "map/level2.tmx" },
 *     { name: "hills",  type: "image", src: "img/hills.png" }, // shared
 * ]);
 *
 * // boot: behind the loading screen
 * await loader.preload(["common", "level1"]);
 * @category Assets
 */
export function setBundle(id, assets) {
	validateBundle(id, assets);
	const existing = bundles.get(id);
	if (existing !== undefined && existing.state !== "unloaded") {
		throw new Error(
			`loader.setBundle("${id}"): the bundle is ${existing.state}; unload it before redefining it`,
		);
	}
	bundles.set(id, {
		assets: assets.slice(),
		state: "unloaded",
		loads: 0,
		// carried over, so a load from before a redefinition cannot match
		epoch: existing !== undefined ? existing.epoch + 1 : 0,
	});
}

/**
 * check a bundle declaration, throwing a `TypeError` naming what is wrong
 * @param {string} id - the bundle id
 * @param {Asset[]} assets - its asset descriptors
 * @ignore
 * @internal
 */
function validateBundle(id, assets) {
	if (typeof id !== "string" || id.length === 0) {
		throw new TypeError("loader.setBundle: the id must be a non-empty string");
	}
	if (!Array.isArray(assets)) {
		throw new TypeError(
			`loader.setBundle("${id}"): expected an array of asset descriptors`,
		);
	}
	for (const asset of assets) {
		if (typeof asset === "string") {
			throw new TypeError(
				`loader.setBundle("${id}"): "${asset}" is a string; a bundle lists asset descriptors, not other bundles`,
			);
		}
		if (
			typeof asset !== "object" ||
			asset === null ||
			typeof asset.name !== "string" ||
			typeof asset.type !== "string"
		) {
			throw new TypeError(
				`loader.setBundle("${id}"): every asset needs a string \`name\` and \`type\``,
			);
		}
	}
}

/**
 * Whether two asset lists declare the same assets — the same type, name and
 * src, in any order — so `load(id, assets)` called again with what is already
 * declared loads the bundle rather than redefining it.
 * @param {Asset[]} a - one list
 * @param {Asset[]} b - the other
 * @returns {boolean} true if they list the same assets
 * @ignore
 * @internal
 */
function sameAssets(a, b) {
	const signature = (list) => {
		return list
			.map((asset) => {
				return JSON.stringify([asset.type, asset.name, asset.src ?? null]);
			})
			.sort()
			.join("\n");
	};
	return a.length === b.length && signature(a) === signature(b);
}

/**
 * The asset list of a declared bundle.
 * @param {string} id - the bundle id
 * @returns {Asset[]|undefined} a copy of its asset descriptors, or
 * `undefined` when no bundle is declared under that id
 * @example
 * if (loader.getBundle("level3") === undefined) {
 *     loader.setBundle("level3", level3Assets);
 * }
 * @category Assets
 */
export function getBundle(id) {
	const bundle = bundles.get(id);
	return bundle !== undefined ? bundle.assets.slice() : undefined;
}

/**
 * Whether every asset of a bundle is in memory, however it got there — so a
 * game can skip a loading screen it does not need. `false` again as soon as
 * one of them is unloaded, by the bundle or on its own.
 * @param {string} id - the bundle id
 * @returns {boolean} true if every asset of the bundle is loaded
 * @throws {Error} when no bundle is declared under that id
 * @example
 * if (!loader.isLoaded("level2")) {
 *     await loader.preload(["level2"]); // with the loading screen
 * }
 * level.load("level2");
 * @category Assets
 */
export function isLoaded(id) {
	return requireBundle(id).assets.every(isResident);
}
