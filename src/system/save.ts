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
import { BOOT, eventEmitter } from "./event.js";

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
 */
function isReserved(key: string) {
	return key === "add" || key === "remove";
}

// Initialize me.save on Boot event
eventEmitter.addListenerOnce(BOOT, () => {
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

const save: Record<string, unknown> = {
	/**
	 * Add new keys to localStorage and set them to the given default values if they do not exist
	 * @param props - key and corresponding values
	 * @example
	 * // Initialize "score" and "lives" with default values
	 * me.save.add({ score : 0, lives : 3 });
	 * // get or set the value through me.save
	 * me.save.score = 1000;
	 */
	add(props: Record<string, Jsonifiable>) {
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
