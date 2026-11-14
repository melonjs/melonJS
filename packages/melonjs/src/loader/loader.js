/**
 * The asset loader: it fetches the files a game needs, parses each one
 * according to its type, and keeps the result in memory under the asset's
 * name. Engine classes then take that name directly
 * (`new Sprite(0, 0, { image: "player" })`, `level.load("map1")`,
 * `audio.play("jump")`), and the getters return the parsed asset itself
 * (`loader.getImage("player")`, `loader.getJSON("atlas")`...).
 *
 * **Declaring assets.** Every asset is an {@link Asset} descriptor,
 * `{ name, type, src }`, where the type picks the parser. The loader takes
 * them in one of two shapes:
 * - a **flat array** of descriptors: the simplest form, for a single-screen
 *   game or a prototype. Everything is loaded once, at boot, and stays.
 * - a **record of bundles**, `{ common: [...], level1: [...], ... }`, for a
 *   game with several levels or screens. Each key becomes a bundle: a named
 *   list of the same descriptors, with a lifetime of its own (see below).
 *
 * **preload or load.** {@link preload} is the boot call: it switches to the
 * loading screen, loads everything it is given, warms the shaders, then calls
 * its callback, emits `LOADER_COMPLETE` and resolves. {@link load} loads a
 * single asset, or a bundle by its id, while the game keeps running.
 *
 * **Bundles.** A bundle is a lifetime, not a namespace: its assets keep their
 * own names and live in the same caches as any other, so `getImage("hills")`
 * and `level.load("map1")` read them as usual. Declare one with
 * {@link setBundle} (or as a key of a record passed to `preload`), load it
 * with {@link load} or {@link preload}, test it with {@link isLoaded}, and
 * release it with {@link unload}.
 * - Bundle ids are strings and assets are objects: `loader.unload("map1")`
 *   releases the bundle `"map1"`, while
 *   `loader.unload({ name: "map1", type: "tmx" })` frees that one asset.
 * - An asset listed by several bundles is fetched once, and freed only when
 *   the last loaded bundle listing it is unloaded: list a shared asset in
 *   every bundle that uses it.
 * - An asset loaded the old way, from a flat array or by `load(asset)`, is
 *   pinned: no bundle unload frees it, only `unload(asset)` or `unloadAll()`.
 * - Freeing a map (or a glTF scene) also unregisters its level, so
 *   `level.load` of it throws until its bundle is loaded again.
 * - A shader handed out by {@link getShader} is freed with the last bundle
 *   that lists it, whatever still draws with it: an effect that outlives a
 *   level (a HUD's, a camera's) belongs in a bundle that outlives it too.
 *
 * Freeing an asset releases what the engine made from it as well: the GPU
 * texture uploaded from an image, the program compiled from a shader, a
 * font's place in the document.
 *
 * **Settings.** {@link setBaseURL} prefixes the `src` of every asset of a
 * type, {@link setOptions} sets the CORS and cache-busting options, and
 * {@link setParser} teaches the loader an asset type of its own.
 *
 * **Events.** `preload` and `load(id)` report through the event bus:
 * {@link event.LOADER_PROGRESS} (the share of the call's assets loaded, 0 to
 * 1, and the asset), {@link event.LOADER_ERROR} (an asset that failed, which
 * {@link reload} retries) and {@link event.LOADER_COMPLETE}.
 * @module
 * @example
 * import { loader } from "melonjs";
 *
 * // a single-screen game: one flat list, loaded behind the loading screen
 * await loader.preload([
 *     { name: "player", type: "image", src: "data/img/player.png" },
 *     { name: "jump",   type: "audio", src: "data/sfx/" },
 * ]);
 * state.change(state.PLAY);
 * @example
 * // a game with several levels: an assets file exporting one bundle for
 * // what every level uses, and one per level
 *
 * // resources.js
 * export default {
 *     common: [
 *         { name: "player",  type: "image", src: "data/img/player.png" },
 *         { name: "tileset", type: "image", src: "data/img/tileset.png" },
 *         { name: "tileset", type: "tsx",   src: "data/map/tileset.tsx" },
 *         { name: "jump",    type: "audio", src: "data/sfx/" },
 *     ],
 *     level1: [
 *         { name: "level1", type: "tmx",   src: "data/map/level1.tmx" },
 *         { name: "hills",  type: "image", src: "data/img/hills.png" },
 *     ],
 *     level2: [
 *         { name: "level2", type: "tmx",   src: "data/map/level2.tmx" },
 *         { name: "hills",  type: "image", src: "data/img/hills.png" }, // shared
 *     ],
 * };
 *
 * // game.js: boot, everything behind the loading screen
 * import resources from "./resources.js";
 * await loader.preload(resources);
 *
 * // later: level 1 will not be played again, so free what only it uses
 * // ("hills" stays, level2 lists it too)
 * await level.load("level2", { async: true });
 * loader.unload("level1");
 *
 * // ...and should the player go back to it after all
 * await loader.load("level1");
 * await level.load("level1", { async: true });
 */

import { warnOnce } from "../lang/console.js";
import { level } from "../level/level.js";
import state from "./../state/state.ts";
import { hasDOM } from "../system/dom.ts";
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
 * @import {AssetParser, Bundle, PreloadTally} from "./internal-types.ts";
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
 * the cache-busting query string appended to asset URLs, set through
 * {@link setOptions} (`nocache: true`)
 * @ignore
 */
export let nocache = "";

/**
 * The base URL of each asset type, as set by {@link setBaseURL}: prepended to
 * the `src` of every asset of that type, unless the `src` is a data URI. A
 * type with no entry here is loaded from its `src` as written.
 * Read it here, change it through `setBaseURL`.
 * @type {Object.<string, string>}
 * @example
 * loader.setBaseURL("image", "data/img/");
 * loader.baseURL.image; // "data/img/"
 */
export const baseURL = {};

/**
 * The `crossOrigin` attribute the loader gives the `<video>` and `<script>`
 * elements it creates, and the images of a glTF model: `"anonymous"` sends no
 * user credentials (cookies, client-side TLS certificates or HTTP
 * authentication) to another origin, `"use-credentials"` sends them, as
 * `withCredentials` does.<br>
 * Every other asset (images, JSON, maps, binary files, buffered audio...) is
 * always requested with CORS, whatever this says: an asset on another origin
 * loads when its server allows it (an `Access-Control-Allow-Origin` header),
 * and fails to load, with an error naming the asset, when it does not.
 * @type {string}
 * @default undefined
 * @see {@link setOptions}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes}
 * @deprecated since 20.4.0 as a setting: it is read-only, set it with
 * {@link setOptions}. It is a module binding, so assigning to it
 * (`loader.crossOrigin = "anonymous"`) throws a `TypeError`, and always did.
 * @example
 * // play videos from another origin, without credentials
 * loader.setOptions({ crossOrigin: "anonymous" });
 * await loader.preload(resources);
 */
export let crossOrigin;

/**
 * Whether requests to another origin carry credentials: cookies,
 * authorization headers or TLS client certificates. It has no effect on
 * requests to the game's own origin, which always carry the browser's
 * credentials, as the page and its scripts do, so a game behind a login or a
 * session cookie loads its own assets without it.
 * @type {boolean}
 * @default false
 * @see {@link setOptions}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/withCredentials}
 * @deprecated since 20.4.0 as a setting: it is read-only, set it with
 * {@link setOptions}. It is a module binding, so assigning to it
 * (`loader.withCredentials = true`) throws a `TypeError`, and always did.
 * @example
 * // assets on a CDN behind a session cookie or a login
 * loader.setOptions({ withCredentials: true });
 * await loader.preload(resources);
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
 * Set the loader's global options, for every asset loaded from then on.
 * Each option left out keeps its current value.
 * @param {Object} options - the options to set
 * @param {string} [options.crossOrigin] - the `crossOrigin` attribute of the
 * `<video>` and `<script>` elements and glTF images the loader creates
 * (`"anonymous"` or `"use-credentials"`). Every other asset is always
 * requested with CORS. See {@link crossOrigin}.
 * @param {boolean} [options.nocache] - when true, append a random query
 * string to every asset URL, so the browser fetches a fresh copy rather than
 * a cached one (development only: it also defeats the HTTP cache in
 * production)
 * @param {boolean} [options.withCredentials] - whether requests to another
 * origin carry credentials (cookies, HTTP authentication). Requests to the
 * game's own origin always carry them. See {@link withCredentials}.
 * @example
 * // play videos from another origin, without credentials
 * loader.setOptions({ crossOrigin: "anonymous" });
 *
 * // bypass the browser cache while developing
 * loader.setOptions({ nocache: true });
 *
 * // send cookies to a CDN that serves assets behind a login
 * loader.setOptions({ withCredentials: true });
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
 * Set the base URL prepended to the `src` of every asset of a type, so the
 * descriptors need not repeat it. Applies to assets loaded from then on; a
 * data URI `src` is never prefixed.
 *
 * `"*"` sets it for every built-in type except `obj`, `mtl`, `gltf` and
 * `glb`, which resolve their own references (a `map_Kd` texture, a glTF
 * buffer) relative to their file and would be prefixed twice: set those one
 * by one. Custom types registered with {@link setParser} are not covered by
 * `"*"` either.
 * @param {string} type - the asset type ("audio", "video", "binary", "image",
 * "json", "js", "tmx", "tsx", "fontface", "aseprite", "shader", "obj", "mtl",
 * "gltf", "glb", or a custom type), or `"*"`
 * @param {string} [url="./"] - the base URL, ending with a `/`
 * @example
 * // a relative path for the images
 * loader.setBaseURL("image", "data/img/");
 * // so that a descriptor names the file alone: loads data/img/player.png
 * await loader.preload([{ name: "player", type: "image", src: "player.png" }]);
 *
 * // or an absolute URL for every 2D asset type at once
 * loader.setBaseURL("*", "https://cdn.example.com/");
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
 * @param {*} [cause] - the parser's own error, kept as the thrown error's
 * `cause`: the message only names the asset, the cause says what went wrong
 * @ignore
 * @internal
 */
function onLoadingError(res, call, owner, cause) {
	failureLoadedAssets[res.src] = { asset: res, call, owner };
	call.failed.add(res.src);
	emit(LOADER_ERROR, res);
	throw new Error(
		"Failed loading resource " + res.src,
		cause !== undefined ? { cause } : undefined,
	);
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
 * An asset descriptor: what to load, and the name to keep it under. The same
 * descriptors go in a {@link preload} list, in a bundle ({@link setBundle}),
 * or to {@link load} on their own.
 *
 * The type and the name together identify an asset, so two assets of
 * different types may share a name: a texture atlas is usually an `"image"`
 * and a `"json"` both called `"texture"`.
 * @typedef {object} Asset
 * @property {string} name - the name the asset is kept and read back under
 * (`loader.getImage(name)`, `new Sprite(x, y, { image: name })`,
 * `level.load(name)`, `audio.play(name)`)
 * @property {string} type - the type of the asset, which picks its parser:
 * "audio", "binary", "image", "json", "js", "tmx", "tsx", "fontface", "video",
 * "aseprite", "shader", "obj", "mtl", "gltf" or "glb". JSON-serialised Tiled
 * maps and tilesets (`.tmj` / `.tsj`) load under `"tmx"` / `"tsx"`: those are
 * file extensions, not asset types. Any other type is one registered with
 * {@link loader.setParser}.
 * @property {string|string[]} [src] - the URL of the file, relative to the
 * page or to the type's base URL ({@link setBaseURL}), or a data URI.
 * For `"audio"` it is the **directory** holding the clip: the loader appends
 * the asset name and each extension given to `audio.init()`, and keeps the
 * first that decodes.
 * For `"image"` it may be an array of sources, tried in order until one loads:
 * a fallback chain, such as compressed texture formats by priority with a PNG
 * last.
 * For `"shader"` it may be an object of URLs instead (see the example).
 * @property {string|{glsl?: string, wgsl?: string}} [data] - inline content
 * in place of a `src`: the parsed Tiled JSON map or tileset (an object) for
 * `"tmx"` / `"tsx"`, the GLSL source of an effect body for `"shader"`, or a
 * `{glsl, wgsl}` pair of them so that one asset serves both backends (either
 * half may be omitted)
 * @property {boolean} [stream=false] - audio and video: start playing before
 * the whole file is downloaded, rather than waiting for it
 * @property {boolean} [autoplay=false] - audio and video: start playing once
 * loaded, or once added to a scene (a browser may require a user interaction
 * first)
 * @property {boolean} [loop=false] - audio and video: loop when playing
 * @see {@link preload}
 * @see {@link load}
 * @see {@link setBundle}
 * @example
 * // images: a file, a data URI, or a fallback chain (first that loads wins)
 * { name: "tileset", type: "image", src: "data/img/tileset.png" }
 * { name: "logo",    type: "image", src: "data:image/png;base64,iVBORw0KGgo..." }
 * { name: "terrain", type: "image", src: ["data/gfx/terrain.astc.ktx", "data/gfx/terrain.dds", "data/gfx/terrain.png"] }
 * // a texture atlas: its image and its JSON descriptor, under the same name
 * { name: "texture", type: "image", src: "data/gfx/texture.png" }
 * { name: "texture", type: "json",  src: "data/gfx/texture.json" }
 * // Tiled: a map (XML or JSON), an external tileset, or a map given inline
 * { name: "map1",    type: "tmx", src: "data/map/map1.tmx" }
 * { name: "map2",    type: "tmx", src: "data/map/map2.tmj" }
 * { name: "tileset", type: "tsx", src: "data/map/tileset.tsx" }
 * { name: "map3",    type: "tmx", data: { width: 20, height: 15, tilewidth: 32, tileheight: 32, layers: [], tilesets: [] } }
 * // audio: src is the directory, the extension comes from audio.init()
 * { name: "cling",   type: "audio", src: "data/sfx/" }
 * { name: "bgmusic", type: "audio", src: "data/bgm/", stream: true }
 * // video: src is the file
 * { name: "intro", type: "video", src: "data/video/intro.mp4" }
 * // other data: raw bytes, JSON (collision shapes from a shape editor), a script
 * { name: "ymTrack", type: "binary", src: "data/audio/main.ym" }
 * { name: "shapes",  type: "json",   src: "data/physics/shapes.json" }
 * { name: "plugin",  type: "js",     src: "data/js/plugin.js" }
 * // a web font, used by its name as a CSS font family
 * { name: "kenpixel", type: "fontface", src: "data/font/kenvector_future.woff2" }
 * // 3D: a Wavefront OBJ model and its MTL materials, or a glTF/GLB scene
 * // (which registers with the level director, like a Tiled map)
 * { name: "ship",    type: "obj", src: "data/models/ship.obj" }
 * { name: "ship",    type: "mtl", src: "data/models/ship.mtl" }
 * { name: "diorama", type: "glb", src: "data/scenes/diorama.glb" }
 * // shaders: an effect body, or a complete program for both backends
 * { name: "flash", type: "shader", src: "shaders/flash.frag" }
 * { name: "toon",  type: "shader", src: { vertex: "shaders/toon.vert", fragment: "shaders/toon.frag", wgsl: "shaders/toon.wgsl" } }
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
 * @throws {Error} when `parserFn` is not a function
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
 * Declare every bundle of a record and load them all, behind the loading
 * screen: the boot call of a game with several levels, given the record its
 * assets file exports (`{ common: [...], level1: [...], ... }`).
 *
 * Each key becomes a bundle, exactly as {@link loader.setBundle} would make
 * it, with the same checks. A bundle already declared with the same assets
 * is left as it is; one declared with other assets is redefined, which throws
 * while it is loaded or loading. Every key is checked before any is declared,
 * so a bad one throws with nothing changed.
 *
 * Every bundle is then loaded as one preload, as with a flat list: one
 * progress bar over all their assets (an asset several bundles list is loaded
 * once, and counted once), the shader warm-up, then the callback,
 * `LOADER_COMPLETE`, and the promise resolves. From there each bundle is
 * loaded as if by `load(id)`: `loader.unload(id)` frees the assets only that
 * bundle holds, and `loader.load(id)` brings them back. Calling it again
 * fetches nothing already in memory.
 * @overload
 * @param {Object<string, Asset[]>} bundles - bundle id → its asset descriptors
 * @param {Function} [onloadcb] - called once every asset has loaded, before
 * `LOADER_COMPLETE`
 * @param {boolean} [switchToLoadState=true] - switch to the loading screen
 * (`state.LOADING`) while loading
 * @returns {Promise<void>} resolves once every asset has loaded; rejects if
 * one fails to load
 * @throws {TypeError} synchronously, when `bundles` is not a record of asset
 * arrays — a single asset descriptor passed by mistake included (wrap it in
 * an array)
 * @throws {Error} synchronously, when a key names a bundle that is loaded or
 * loading with other assets, or an asset has an unknown type
 * @example
 * // resources.js: what every level uses, then each level's own assets
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
 *         { name: "hills", type: "image", src: "img/hills.png" }, // shared
 *     ],
 * };
 *
 * // game.js: the same call as with a flat list
 * import resources from "./resources.js";
 * await loader.preload(resources);
 * state.change(state.PLAY);
 * @category Assets
 */
/**
 * Load a list of assets behind the loading screen: the boot call.
 *
 * It switches to the loading screen (`state.LOADING`, unless told not to),
 * loads every asset of the list, warms the shaders (see the `prewarm`
 * application setting), then calls `onloadcb`, emits `LOADER_COMPLETE`, and
 * resolves. Each call has
 * only its own callback: a preload given none calls nothing on completion,
 * whatever an earlier preload was given.
 *
 * Progress is reported through {@link event.LOADER_PROGRESS} as the share of
 * this call's assets loaded so far, reaching 1 with the last of them. A
 * preload started while another is still loading joins it, and the progress
 * then covers the assets of both; once they have all settled, the next
 * preload counts from zero again.
 *
 * If an asset fails to load, {@link event.LOADER_ERROR} is emitted with it,
 * the promise rejects, and neither the callback nor `LOADER_COMPLETE` comes;
 * {@link loader.reload} retries the asset and then completes this preload.
 *
 * The list may also name bundles declared with {@link loader.setBundle},
 * mixed freely with asset descriptors: each id stands for the assets of that
 * bundle, and those bundles are loaded by this call exactly as `load(id)`
 * would load them. An asset that appears more than once (in two bundles, or
 * in a bundle and directly) is loaded once. An asset listed directly is
 * pinned: no bundle unload frees it, only {@link loader.unload} with the
 * descriptor, or {@link loader.unloadAll}.
 * @overload
 * @param {Array<Asset|string>} assets - the asset descriptors to load,
 * and/or ids of bundles declared with {@link loader.setBundle}
 * @param {Function} [onloadcb] - called once every asset has loaded, before
 * `LOADER_COMPLETE`
 * @param {boolean} [switchToLoadState=true] - switch to the loading screen
 * (`state.LOADING`) while loading
 * @returns {Promise<void>} resolves once every asset has loaded (after the
 * callback, which is still called: use either form); rejects if one fails to
 * load
 * @throws {Error} synchronously, on an unknown bundle id (before anything is
 * loaded) or an unknown asset type
 * @example
 * import { loader, state } from "melonjs";
 *
 * const resources = [
 *     // an image, and a texture atlas (its image and JSON descriptor)
 *     { name: "background", type: "image", src: "data/img/background.png" },
 *     { name: "texture",    type: "image", src: "data/img/texture.png" },
 *     { name: "texture",    type: "json",  src: "data/img/texture.json" },
 *     // a Tiled map, its external tileset and the tileset's image
 *     { name: "map1",    type: "tmx",   src: "data/map/map1.tmx" },
 *     { name: "tileset", type: "tsx",   src: "data/map/tileset.tsx" },
 *     { name: "tileset", type: "image", src: "data/map/tileset.png" },
 *     // sounds: src is the directory (see audio.init)
 *     { name: "jump", type: "audio", src: "data/sfx/" },
 *     // a web font
 *     { name: "PressStart2P", type: "fontface", src: "data/fnt/PressStart2P.ttf" },
 * ];
 *
 * // await it...
 * await loader.preload(resources);
 * state.change(state.PLAY);
 *
 * // ...or pass a callback
 * loader.preload(resources, () => {
 *     state.change(state.PLAY);
 * });
 * @example
 * // bundles and descriptors in one list
 * loader.setBundle("common", commonAssets);
 * loader.setBundle("level1", level1Assets);
 * await loader.preload([
 *     "common",
 *     "level1",
 *     { name: "logo", type: "image", src: "img/logo.png" },
 * ]);
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
				onLoadingError(asset, call, entry, err);
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
 * Retry an asset that failed to load in a {@link loader.preload} (or a
 * `load(id)`), given its `src` as reported by {@link event.LOADER_ERROR}.
 *
 * The retried asset counts towards the progress of the call it failed in,
 * and once every asset of that call has loaded, that call completes: its own
 * callback is called, if it was given one, and `LOADER_COMPLETE` is emitted.
 * The promise that call returned has already rejected, and stays rejected.
 * The asset then belongs to whoever asked for it: pinned if it was listed
 * directly, held by its bundles if a bundle asked for it. Should it fail
 * again, `LOADER_ERROR` is emitted again.
 * @param {string} src - the `src` of the asset to retry, exactly as in its
 * descriptor (`asset.src` of the asset `LOADER_ERROR` passed)
 * @throws {TypeError} when no failed asset has that `src`
 * @example
 * import { event, loader } from "melonjs";
 *
 * event.on(event.LOADER_ERROR, (asset) => {
 *     // the game's own dialog, with a "retry" button
 *     showErrorDialog(`Could not load ${asset.name}`, () => {
 *         loader.reload(asset.src);
 *     });
 * });
 * @category Assets
 */
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
					onLoadingError(assetToReload, call, undefined, err);
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
 * same checks, the same progress and shader warm-up, `LOADER_COMPLETE`, and
 * the same promise. Handy where a level's assets are declared next to the
 * code that enters it.
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
 * @returns {Promise<void>} resolves once every asset of the bundle has
 * loaded; rejects if one fails to load
 * @throws {TypeError} synchronously, on an invalid id or asset list
 * @throws {Error} synchronously, when the bundle is loaded or loading with
 * other assets, or an asset has an unknown type
 * @example
 * // a level's assets, declared where they are loaded
 * await loader.load("level2", [
 *     { name: "level2", type: "tmx",   src: "data/map/level2.tmx" },
 *     { name: "tiles",  type: "image", src: "data/img/tiles.png" },
 * ]);
 * await level.load("level2", { async: true });
 * // ...and later, by id as usual
 * loader.unload("level2");
 * @category Assets
 */
/**
 * Load a bundle declared with {@link loader.setBundle} (or by a record
 * passed to {@link loader.preload}), while the game keeps running.
 *
 * Every asset of the bundle that is not already in memory is loaded, then the
 * shaders are warmed, as {@link loader.preload} does: `LOADER_PROGRESS`
 * reports this call's assets (each asset is one step, and one already in
 * memory counts as a step done at once), then `onload` is called,
 * `LOADER_COMPLETE` is emitted and the promise resolves. Unlike `preload` it
 * does NOT switch to the loading screen; to show it for a level, use
 * `loader.preload([id])`.
 *
 * The bundle then holds its assets: they stay in memory until
 * {@link loader.unload} with the same id releases them, and are freed then
 * unless another loaded bundle lists them too, or they were loaded the old
 * way (by `preload` / `load` with a descriptor), which pins them. Assets keep
 * their own names: `getImage("tiles")` reads a bundle's image as any other.
 *
 * If an asset fails to load, `LOADER_ERROR` is emitted with it, `onerror` is
 * called and the promise rejects; the assets that did load stay, held by the
 * bundle, and {@link loader.reload} retries the one that failed.
 * @overload
 * @param {string} id - the id of a declared bundle
 * @param {Function} [onload] - called once every asset of the bundle has
 * loaded, before `LOADER_COMPLETE`
 * @param {Function} [onerror] - called with the error if an asset fails to
 * load (the returned promise then needs no `catch` of its own)
 * @returns {Promise<void>} resolves once the bundle is loaded, with or
 * without the callbacks; rejects if an asset fails to load
 * @throws {Error} synchronously, when no bundle is declared under that id
 * @example
 * // before entering a level that may have been unloaded: fetches only what
 * // is missing, and nothing at all when the bundle is still in memory
 * await loader.load("level1");
 * await level.load("level1", { async: true });
 * @example
 * // the next level's assets, loaded while the current one keeps playing
 * loader.load("level3", () => {
 *     nextLevelReady = true;
 * });
 * @category Assets
 */
/**
 * Load a single asset, and wait for it: for an asset needed during the game
 * that was not preloaded.
 *
 * No loading screen, progress or loader event: the promise is the only
 * signal. An asset already in memory resolves at once, without a request
 * (for every type but `"binary"`, `"fontface"`, `"aseprite"` and `"js"`,
 * which are fetched again). The asset is pinned: unloading a bundle that also lists it does not free it,
 * {@link loader.unload} with the descriptor does.
 * @overload
 * @param {Asset} asset - the asset to load
 * @returns {Promise<void>} resolves once the asset has loaded; rejects with
 * the error if it fails to load
 * @throws {Error} synchronously, when the asset type is unknown
 * @example
 * await loader.load({ name: "avatar", type: "image", src: "data/img/avatar.png" });
 * const avatar = new Sprite(0, 0, { image: "avatar" });
 * @category Assets
 */
/**
 * Load a single asset, with callbacks: the original form of
 * `load(asset)`, for an asset needed during the game that was not preloaded.
 *
 * No loading screen, progress or loader event: the callbacks are the only
 * signal. The asset is pinned: unloading a bundle that also lists it does not
 * free it, {@link loader.unload} with the descriptor does.
 * @overload
 * @param {Asset} asset - the asset to load
 * @param {Function} [onload] - called once the asset has loaded. Not called
 * for an asset already in memory: the function then returns `0` (for every
 * type but `"binary"`, `"fontface"`, `"aseprite"` and `"js"`, which are
 * fetched again)
 * @param {Function} [onerror] - called with the error if it fails to load
 * @returns {number|Promise<void>} the number of resources it started loading
 * (usually `1`), or `0` when the asset was already in memory. With `onload`
 * and `onerror` both undefined it is the promise form above, and returns a
 * promise
 * @throws {Error} synchronously, when the asset type is unknown
 * @example
 * loader.load(
 *     { name: "bgmusic", type: "audio", src: "data/bgm/" },
 *     () => audio.play("bgmusic"),
 *     (error) => console.warn("no music", error),
 * );
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
 * Release a bundle, or free a single asset: a string is a bundle id, an
 * object is an asset descriptor. So `loader.unload("map1")` releases the
 * bundle `"map1"`, and `loader.unload({ name: "map1", type: "tmx" })` frees
 * that one map, whichever bundles list it.
 *
 * **With a bundle id** (see {@link loader.setBundle}), the bundle lets go of
 * each of its assets, and every one that nothing else still holds is freed:
 * an asset another loaded bundle lists stays, and so does one loaded the old
 * way (by `preload` / `load` with a descriptor), which pins it. Freeing a map
 * or a glTF scene this way also unregisters its level, so `level.load` of it
 * throws "not found" until the bundle is loaded again. Unload the bundle of
 * the level being left once the next level is in: unloading the bundle of the
 * level being played leaves the world as it is, but with no current level,
 * so `level.reload()` has nothing to reload. Allowed while the bundle is
 * still loading: its assets are then freed as they arrive.
 *
 * **With an asset descriptor** (only `name` and `type` are read), the asset is
 * freed at once, whoever holds it: a bundle listing it reports
 * {@link loader.isLoaded} `false` afterwards, and loading that bundle again
 * fetches it again.
 *
 * Either way, freeing an image also frees the texture the renderer uploaded
 * from it, a shader its GPU program, a font its place in `document.fonts`.
 * A shader handed out by {@link loader.getShader} is not tracked once handed
 * out, so an effect that outlives a level (a HUD's, a camera's) belongs in a
 * bundle that outlives it too, or it is freed under whatever still uses it.
 * @param {string|Asset} asset - a bundle id, or the descriptor of the asset
 * to free
 * @returns {boolean} with a bundle id, `false` when the bundle was not
 * loaded; with a descriptor, `false` when the asset was not in memory
 * @throws {Error} synchronously, on an unknown bundle id, or a descriptor
 * whose type the loader keeps nothing for (a type registered with
 * {@link loader.setParser}: the game keeps those assets itself)
 * @example
 * // level 1 is behind the player for good: free what only it uses
 * await level.load("level2", { async: true });
 * loader.unload("level1");
 * @example
 * // free one asset, whatever loaded it
 * loader.unload({ name: "avatar", type: "image" });
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
			if (hasDOM() && typeof globalThis.document.fonts !== "undefined") {
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
 * Free every asset the loader holds, whoever holds it: the caches, the audio
 * clips, and what the engine made from them (GPU textures, shader programs,
 * fonts in `document.fonts`).
 *
 * Bundles declared with {@link loader.setBundle} stay declared, all of them
 * back to not loaded, so they can be loaded again by id. Base URLs, options
 * and parsers are kept too. Levels stay registered with the level director:
 * load the bundles (or preload the assets) again before loading one.
 * @example
 * // back to the title screen: drop everything, then load what it needs
 * loader.unloadAll();
 * await loader.load("common");
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
 * Passing a record of bundles to `preload` (`{ common: [...], level1: [...] }`,
 * as an assets file exports it) declares each of its keys this way.
 *
 * A bundle is a lifetime, not a namespace: its assets keep their own names
 * and live in the same caches as every other asset, so `getImage("tiles")`
 * and `level.load("map1")` read them as before. Bundle ids and asset names
 * are separate, so a level's bundle may share its map's name. Load it with
 * {@link loader.load} (or name it in a {@link loader.preload} list), check it
 * with {@link loader.isLoaded}, and release it with {@link loader.unload}. An
 * asset listed in several bundles is loaded once and freed with the last
 * loaded bundle that lists it, so list a shared asset in every bundle that
 * uses it.
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
 *
 * // moving on: load the next level, switch, then free the previous one
 * // ("hills" stays in memory: level2 lists it too)
 * await loader.load("level2");
 * await level.load("level2", { async: true });
 * loader.unload("level1");
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
 * The asset list of a declared bundle, or `undefined` when there is none:
 * the way to test whether an id is declared, since the other bundle calls
 * throw on an unknown one.
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
 * Whether every asset of a bundle is in memory, however it got there (by
 * this bundle, another one, or the old way) — so a game can skip a loading
 * screen it does not need. `false` again as soon as one of them is unloaded,
 * by a bundle or on its own. An empty bundle is always loaded.
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
