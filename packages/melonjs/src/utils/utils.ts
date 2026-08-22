import { compare } from "./semver.js";
import { toHex } from "./string.js";

export * as agent from "./agent.js";
export * as array from "./array.js";
export * as file from "./file.js";
export * as function from "./function.js";
export * as string from "./string.js";

/**
 * a collection of utility functions
 * @namespace utils
 */

// guid default value
let GUID_base = "";
let GUID_index = 0;

/**
 * Compare two version strings
 * @param v1 - First version string to compare
 * @param v2 - second version string to compare
 * @returns Return 0 if v1 == v2, or 1 if v1 is greater, or -1 if v2 is greater
 * @example
 * if (me.utils.checkVersion("7.0.0") > 0) {
 *     console.error(
 *         "melonJS is too old. Expected: 7.0.0, Got: 6.3.0"
 *     );
 * }
 */
export function checkVersion(v1: string, v2: string) {
	// Convert to proper "x.y.z" format if necessary
	if (/^\d+$/.test(v1)) {
		v1 += ".0.0";
	} else if (/^\d+\.\d+$/.test(v1)) {
		v1 += ".0";
	}
	if (/^\d+$/.test(v2)) {
		v2 += ".0.0";
	} else if (/^\d+\.\d+$/.test(v2)) {
		v2 += ".0";
	}
	return compare(v1, v2);
}

/**
 * parse the fragment (hash) from a URL and returns them into
 * @param [url] - an optional params string or URL containing fragment (hash) params to be parsed
 * @returns an object representing the deserialized params string.
 * [hitbox=false] draw the hitbox in the debug panel (if enabled)
 * [velocity=false] draw the entities velocity in the debug panel (if enabled)
 * [quadtree=false] draw the quadtree in the debug panel (if enabled)
 * [webgl=false] force the renderer to WebGL
 * [canvas=false] force the renderer to Canvas
 * [webgpu=false] force the renderer to WebGPU (opt-in only; never selected by `video.AUTO`)
 * [debug=false] display the debug panel (if preloaded)
 * [debugToggleKey="s"] show/hide the debug panel (if preloaded)
 * @example
 * // http://www.example.com/index.html#debug&hitbox=true&mytag=value
 * let UriFragment = me.utils.getUriFragment();
 * console.log(UriFragment["mytag"]); //> "value"
 */
export function getUriFragment(url?: string) {
	const hash: Record<string, string | boolean> = {};

	if (typeof url === "undefined") {
		if (typeof globalThis.document !== "undefined") {
			const location = globalThis.document.location;

			if (location && location.hash) {
				url = location.hash;
			} else {
				// No "document.location" exist for Wechat mini game platform.
				return hash;
			}
		} else {
			// "document" undefined on node.js
			return hash;
		}
	} else {
		// never cache if a url is passed as parameter
		const index = url.indexOf("#");
		if (index !== -1) {
			url = url.slice(index, url.length);
		} else {
			return hash;
		}
	}

	// parse the url — split on both "&" and "?" so engine flags coexist
	// with SPA hash routers (e.g. `#/some-route?webgpu` in the examples)
	url
		.slice(1)
		.split(/[&?]/)
		.filter((value) => {
			return value !== "";
		})
		.forEach((value) => {
			const kv = value.split("=");
			const k = kv.shift()!;
			const v = kv.join("=");
			hash[k] = v || true;
		});

	return hash;
}

/**
 * reset the GUID Base Name
 * the idea here being to have a unique ID
 * per level / object
 * @ignore
 */
export function resetGUID(base: string, index = 0) {
	// also ensure it's only 8bit ASCII characters
	GUID_base = toHex(base.toUpperCase());
	GUID_index = index;
}

/**
 * create and return a very simple GUID
 * Game Unique ID
 * @ignore
 */
export function createGUID(index = 1) {
	// `index` is a STRIDE for the counter, not the value to emit.
	//
	// This used to return `index || GUID_index`, which meant it returned
	// `index` whenever that was truthy — and since `index` defaults to 1,
	// `createGUID()` produced the string "-1" on every call. Every renderable
	// added to a container therefore shared one GUID, and the only consumer of
	// GUID is collision pair identity, so `Detector._pairKey` collapsed every
	// pair in the world onto a single key: with two pairs colliding at once,
	// the second was treated as already-seen and its `onCollisionStart` /
	// `onCollisionActive` / `onCollisionEnd` never fired.
	//
	// Advance by at least 1 whatever arrives: `Container.addChild` passes
	// `child.id`, which is `null` by default and 0 for a legitimately
	// zero-id object, and neither must leave the counter standing still.
	GUID_index += Number.isFinite(index) && index > 0 ? index : 1;
	return `${GUID_base}-${GUID_index}`;
}

export const isStringArray = (value: unknown): value is string[] => {
	return (
		Array.isArray(value) &&
		value.every((element) => {
			return typeof element === "string";
		})
	);
};
