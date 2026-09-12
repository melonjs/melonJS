import { Jsonifiable } from "type-fest";
/**
 * allow to access and manage the device localStorage
 * @example
 * // Initialize "score" and "lives" with default values
 * // This loads the properties from localStorage if they exist, else it sets the given defaults
 * me.save.add({ score : 0, lives : 3 });
 *
 * // Print all
 * // On first load, this prints { score : 0, lives : 3 }
 * // On further reloads, it prints { score : 31337, lives : 3, complexObject : ... }
 * // Because the following changes will be saved to localStorage
 * console.log(JSON.stringify(me.save));
 *
 * // Save score
 * me.save.score = 31337;
 *
 * // Also supports complex objects thanks to the JSON backend
 * me.save.add({ complexObject : {} })
 * me.save.complexObject = { a : "b", c : [ 1, 2, 3, "d" ], e : { f : [{}] } };
 *
 * // WARNING: Do not set any child properties of complex objects directly!
 * // Changes made that way will not save. Always set the entire object value at once.
 * // If you cannot live with this limitation, there's a workaround:
 * me.save.complexObject.c.push("foo"); // Modify a child property
 * me.save.complexObject = me.save.complexObject; // Save the entire object!
 *
 * // Remove "lives" from localStorage
 * me.save.remove("lives");
 * @namespace save
 */

import { isStringArray } from "../utils/utils.js";
import { BOOT, once } from "./event.js";

// Variable to hold the object data
const data: Record<string, unknown> = {};

let hasLocalStorage = false;

try {
	// true if localStorage is supported
	hasLocalStorage =
		typeof globalThis !== "undefined" &&
		typeof globalThis.localStorage !== "undefined";
} catch {
	// the above generates an exception when cookies are blocked
	hasLocalStorage = false;
}

/**
 * a function to check if the given key is a reserved word
 * @ignore
 * @internal
 */
function isReserved(key: string) {
	return key === "add" || key === "remove";
}

// Initialize me.save on Boot event
once(BOOT, () => {
	// Load previous data if local Storage is supported
	if (hasLocalStorage) {
		const me_save_content = localStorage.getItem("me.save");

		if (me_save_content !== null && me_save_content.length > 0) {
			try {
				const stored: unknown = JSON.parse(me_save_content);
				const keys = isStringArray(stored) ? stored : [];
				for (const key of keys) {
					try {
						const storageKey = `me.save.${key}`;
						const stored = localStorage.getItem(storageKey);
						data[key] = stored === null ? null : JSON.parse(stored);
					} catch {
						// do nothing is invalid json
					}
				}
			} catch {
				// do nothing is invalid json
			}
		}
	}
});

/**
 * The shape of the {@link save} namespace.
 *
 * Declared rather than left as a bare index signature: typed as
 * `Record<string, unknown>` every member was swallowed by the index, so
 * `save.add` came out as `unknown` and could not be CALLED at all under
 * `strict` — the namespace's own documented example did not typecheck — while
 * every registered key read back as `unknown` and needed a cast to compare or
 * assign.
 *
 * The index signature stays, so anything registered elsewhere is still
 * reachable; declared members simply take precedence over it.
 */
export interface SaveAPI {
	/**
	 * Add new keys to localStorage and set them to the given default values if
	 * they do not exist.
	 * @param props - key and corresponding values
	 * @returns this namespace, typed with the keys just registered, so they can
	 * be read back without a cast
	 * @example
	 * // Initialize "score" and "lives" with default values
	 * me.save.add({ score : 0, lives : 3 });
	 * // get or set the value through me.save
	 * me.save.score = 1000;
	 * @example
	 * // or keep the returned view, and read the keys with their real types
	 * const store = me.save.add({ score : 0, lives : 3 });
	 * store.lives -= 1;
	 */
	add<T extends Record<string, Jsonifiable>>(props: T): this & T;

	/**
	 * Remove a key from localStorage
	 * @param key - key to be removed
	 * @example
	 * // Remove the "score" key from localStorage
	 * me.save.remove("score");
	 */
	remove(key: string): void;

	/** keys registered through {@link SaveAPI.add} */
	[key: string]: unknown;
}

const save: SaveAPI = {
	/**
	 * Add new keys to localStorage and set them to the given default values if they do not exist
	 * @param props - key and corresponding values
	 * @example
	 * // Initialize "score" and "lives" with default values
	 * me.save.add({ score : 0, lives : 3 });
	 * // get or set the value through me.save
	 * me.save.score = 1000;
	 */
	add<T extends Record<string, Jsonifiable>>(props: T) {
		const obj = save;

		for (const key of Object.keys(props)) {
			if (isReserved(key)) {
				continue;
			}

			Object.defineProperty(obj, key, {
				configurable: true,
				enumerable: true,
				get() {
					return data[key];
				},
				set(value) {
					data[key] = value;
					if (hasLocalStorage) {
						localStorage.setItem(`me.save.${key}`, JSON.stringify(value));
					}
				},
			});

			if (!(key in data)) {
				save[key] = props[key];
			}
		}

		// Save keys
		if (hasLocalStorage) {
			localStorage.setItem("me.save", JSON.stringify(Object.keys(data)));
		}

		// Handed back so the caller can read what it just registered with the
		// types it registered them at. `add` returned nothing before, so this
		// cannot break a caller — there was nothing to depend on.
		return save as SaveAPI & T;
	},

	/**
	 * Remove a key from localStorage
	 * @param key - key to be removed
	 * @example
	 * // Remove the "score" key from localStorage
	 * me.save.remove("score");
	 */
	remove(key: string) {
		if (!isReserved(key)) {
			if (typeof data[key] !== "undefined") {
				delete data[key];
				if (hasLocalStorage) {
					globalThis.localStorage.removeItem(`me.save.${key}`);
					globalThis.localStorage.setItem(
						"me.save",
						JSON.stringify(Object.keys(data)),
					);
				}
			}
		}
	},
};

export default save;
