import { Jsonifiable } from "type-fest";
import { isStringArray } from "../utils/utils.js";
import { getLocalStorage } from "./dom.ts";
import { BOOT, once } from "./event.js";

/**
 * Where {@link save} keeps its keys: the three methods of the Web Storage API
 * it calls. The browser's `localStorage` is one, and the default; anything else
 * with these methods can take its place through
 * {@link SaveAPI.setStorage | save.setStorage()}.
 *
 * It is handed the same items `localStorage` would hold: one per key, named
 * `me.save.<key>` and holding the key's value as JSON, and `me.save`, the JSON
 * list of the keys.
 */
export type SaveStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * What {@link SaveAPI.createCloudStorage | save.createCloudStorage()} takes.
 */
export interface CloudStorageOptions {
	/**
	 * What the platform loaded: the items a previous session saved, as an
	 * object or as that object in JSON. Nothing (`undefined`, `null` or an
	 * empty string) the first time.
	 */
	data?: Record<string, unknown> | string | null;
	/**
	 * Save every item back to the platform. Called with all of them, one call
	 * at a time: the next call waits for the promise this one returns.
	 */
	write: (items: Record<string, string>) => unknown;
}

/**
 * A storage for {@link SaveAPI.setStorage | save.setStorage()} that keeps the
 * items in memory and saves them to a platform's cloud save, made by
 * {@link SaveAPI.createCloudStorage | save.createCloudStorage()}.
 */
export interface CloudStorage extends SaveStorage {
	/**
	 * Save what has changed now, rather than with the next change, and
	 * resolve once every change made so far is saved: before the game is
	 * paused or closed, for example. A write that fails is logged, and the
	 * promise still resolves.
	 */
	flush(): Promise<void>;
}

/**
 * The items a platform loaded, as strings: an object, or that object in JSON.
 * @ignore
 * @internal
 * @param loaded - what the platform loaded
 * @returns the items
 */
function cloudItems(
	loaded: CloudStorageOptions["data"],
): Record<string, string> {
	let parsed: unknown = loaded;
	if (typeof loaded === "string") {
		try {
			parsed = loaded.length > 0 ? JSON.parse(loaded) : {};
		} catch {
			console.error(
				"melonJS: save.createCloudStorage(): data is not valid JSON",
			);
			parsed = {};
		}
	}
	const items: Record<string, string> = {};
	if (typeof parsed === "object" && parsed !== null) {
		for (const [key, value] of Object.entries(parsed)) {
			// what `save` wrote is a string; a platform may hand it back parsed
			items[key] = typeof value === "string" ? value : JSON.stringify(value);
		}
	}
	return items;
}

/**
 * Make a {@link CloudStorage}.
 * @ignore
 * @internal
 * @param options - what was loaded, and how to save
 * @returns the storage
 */
function createCloudStorage(options: CloudStorageOptions): CloudStorage {
	const items = cloudItems(options.data);
	// a change not saved yet
	let changed = false;
	// the saving under way, until everything changed is saved
	let saving: Promise<void> | undefined;

	const saveChanges = async (): Promise<void> => {
		// changes made together (a key and the list of keys) are saved together
		await Promise.resolve();
		try {
			while (changed) {
				changed = false;
				try {
					await options.write({ ...items });
				} catch (error) {
					// kept, and saved again with the next change or flush()
					changed = true;
					console.error(
						"melonJS: save.createCloudStorage(): write failed",
						error,
					);
					break;
				}
			}
		} finally {
			saving = undefined;
		}
	};

	const startSaving = (): Promise<void> => {
		saving ??= saveChanges();
		return saving;
	};

	return {
		getItem: (key) => {
			return Object.hasOwn(items, key) ? items[key] : null;
		},
		setItem: (key, value) => {
			items[key] = value;
			changed = true;
			void startSaving();
		},
		removeItem: (key) => {
			if (Object.hasOwn(items, key)) {
				delete items[key];
				changed = true;
				void startSaving();
			}
		},
		flush: () => {
			return changed || saving !== undefined
				? startSaving()
				: Promise.resolve();
		},
	};
}

// Variable to hold the object data
const data: Record<string, unknown> = {};

/**
 * The keys registered with `add()`: what `setStorage()` carries over to a
 * storage that does not hold them yet.
 */
const registered = new Set<string>();

/**
 * Where the keys are kept; undefined keeps them in memory only, for this
 * session.
 */
let storage: SaveStorage | undefined = getLocalStorage();

/**
 * a function to check if the given key is a reserved word
 * @ignore
 * @internal
 */
function isReserved(key: string) {
	return (
		key === "add" ||
		key === "remove" ||
		key === "setStorage" ||
		key === "createCloudStorage"
	);
}

/**
 * write the list of saved keys, the one boot reads back, to the storage
 * @ignore
 * @internal
 */
function saveIndex() {
	storage?.setItem("me.save", JSON.stringify(Object.keys(data)));
}

/**
 * write one key's value to the storage
 * @ignore
 * @internal
 * @param key - the key
 */
function saveKey(key: string) {
	storage?.setItem(`me.save.${key}`, JSON.stringify(data[key]));
}

/**
 * Read the keys a storage holds, those listed in its "me.save" item, into the
 * values `save` hands out.
 * @ignore
 * @internal
 * @param from - the storage to read
 * @returns the keys read
 */
function readFrom(from: SaveStorage): string[] {
	const read: string[] = [];
	const index = from.getItem("me.save");
	if (index === null || index.length === 0) {
		return read;
	}
	try {
		const listed: unknown = JSON.parse(index);
		for (const key of isStringArray(listed) ? listed : []) {
			try {
				const value = from.getItem(`me.save.${key}`);
				data[key] = value === null ? null : JSON.parse(value);
				read.push(key);
			} catch {
				// a value that is not valid JSON is left out
			}
		}
	} catch {
		// a list that is not valid JSON: nothing to read
	}
	return read;
}

// read the stored keys back on boot
once(BOOT, () => {
	if (storage !== undefined) {
		readFrom(storage);
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
	 * Add new keys to the storage (`localStorage` by default) and set them to
	 * the given default values if they do not exist.
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
	 * Remove a key from the storage. The key stays registered: setting it
	 * again saves it again, and it is restored on the next load like any other.
	 * @param key - key to be removed
	 * @example
	 * // Remove the "score" key from localStorage
	 * me.save.remove("score");
	 */
	remove(key: string): void;

	/**
	 * Keep the saved keys somewhere other than the browser's `localStorage`,
	 * the default: a game portal's cloud save, for example, or the storage of
	 * a native wrapper. `storage` is anything with the `getItem`, `setItem`
	 * and `removeItem` methods of the Web Storage API (see
	 * {@link SaveStorage}), which `save` calls as it calls `localStorage`'s,
	 * so `save.setStorage(localStorage)` goes back to the default.
	 *
	 * - The keys the new storage holds are read at once, and replace the
	 *   values read from the previous one. A key registered with
	 *   {@link SaveAPI.add | add()} that it does not hold keeps its value, and
	 *   is written to it. So it can be called before or after `add()`.
	 * - The calls are synchronous, as `localStorage`'s are. For a cloud save,
	 *   which loads and saves asynchronously, use
	 *   {@link SaveAPI.createCloudStorage | createCloudStorage()}: it holds
	 *   the items in memory once they are loaded, and saves in the background.
	 * - Nothing is copied to the previous storage, nor removed from it.
	 * @param storage - where the keys are kept from now on
	 * @example
	 * // a platform's cloud save: load it first, then hand it to save
	 * const data = await portal.loadData();
	 * me.save.setStorage(me.save.createCloudStorage({
	 *     data,
	 *     write: (items) => portal.saveData(JSON.stringify(items)),
	 * }));
	 * // the value in the cloud save, or 0 the first time
	 * me.save.add({ hiscore : 0 });
	 * @example
	 * // a storage of your own, such as a native wrapper's: three synchronous calls
	 * me.save.setStorage({
	 *     getItem: (key) => native.read(key) ?? null,
	 *     setItem: (key, value) => native.write(key, value),
	 *     removeItem: (key) => native.erase(key),
	 * });
	 * @example
	 * // back to the browser's localStorage
	 * me.save.setStorage(localStorage);
	 */
	setStorage(storage: SaveStorage): void;

	/**
	 * Make a storage for {@link SaveAPI.setStorage | setStorage()} out of a
	 * platform's cloud save, such as YouTube Playables' or Facebook Instant
	 * Games': the save is loaded once, before the game starts, and everything
	 * is saved back in one piece.
	 *
	 * - `data` is what the platform loaded: an object, or that object in JSON,
	 *   or nothing the first time. The storage starts from it and keeps every
	 *   item in memory, so `save` reads and writes without waiting.
	 * - `write(items)` saves every item back to the platform. Changes made
	 *   together are saved in one call, and calls are made one at a time:
	 *   changes made while one is in progress go in the next one, with the
	 *   latest values. A platform that refuses a save while another is
	 *   pending, as Facebook's does, never sees two.
	 * - A write that fails (its promise rejects) is logged, and the items are
	 *   saved again with the next change, or by `flush()`.
	 * - `flush()` saves at once and resolves when everything is saved: call it
	 *   when the platform pauses or closes the game.
	 * @param options - what the platform loaded, and how to save
	 * @returns the storage, to hand to `setStorage()`
	 * @example
	 * // YouTube Playables
	 * const cloud = me.save.createCloudStorage({
	 *     data: await ytgame.game.loadData(),
	 *     write: (items) => ytgame.game.saveData(JSON.stringify(items)),
	 * });
	 * me.save.setStorage(cloud);
	 * ytgame.system.onPause(() => cloud.flush());
	 * @example
	 * // Facebook Instant Games
	 * const { save: data } = await FBInstant.player.getDataAsync(["save"]);
	 * me.save.setStorage(me.save.createCloudStorage({
	 *     data,
	 *     write: (items) => FBInstant.player.setDataAsync({ save: items }),
	 * }));
	 */
	createCloudStorage(options: CloudStorageOptions): CloudStorage;

	/** keys registered through {@link SaveAPI.add} */
	[key: string]: unknown;
}

/**
 * Keep game data, such as a high score or how far the player got, from one
 * session to the next. The keys are kept in the browser's `localStorage` by
 * default; {@link SaveAPI.setStorage | save.setStorage()} keeps them somewhere
 * else, and {@link SaveAPI.createCloudStorage | save.createCloudStorage()}
 * makes that somewhere a platform's cloud save, such as YouTube Playables' or
 * Facebook Instant Games'.
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
 */
const save: SaveAPI = {
	/**
	 * Add new keys to the storage and set them to the given default values if they do not exist
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
			registered.add(key);

			Object.defineProperty(obj, key, {
				configurable: true,
				enumerable: true,
				get() {
					return data[key];
				},
				set(value) {
					// a key written again after `remove()` keeps its accessor but
					// had left the index, so the value reached the storage and
					// was never read back: boot restores only the keys listed
					// in "me.save"
					const listed = key in data;
					data[key] = value;
					saveKey(key);
					if (!listed) {
						saveIndex();
					}
				},
			});

			if (!(key in data)) {
				save[key] = props[key];
			}
		}

		// Save keys
		saveIndex();

		// Handed back so the caller can read what it just registered with the
		// types it registered them at. `add` returned nothing before, so this
		// cannot break a caller — there was nothing to depend on.
		return save as SaveAPI & T;
	},

	/**
	 * Remove a key from the storage
	 * @param key - key to be removed
	 * @example
	 * // Remove the "score" key from localStorage
	 * me.save.remove("score");
	 */
	remove(key: string) {
		if (!isReserved(key)) {
			if (key in data) {
				delete data[key];
				storage?.removeItem(`me.save.${key}`);
				saveIndex();
			}
		}
	},

	/**
	 * Keep the saved keys somewhere other than the browser's `localStorage`
	 * @param newStorage - where the keys are kept from now on
	 */
	setStorage(newStorage: SaveStorage) {
		storage = newStorage;
		// what the new storage holds replaces what came from the previous one;
		// a key read from it but never registered goes with it
		for (const key of Object.keys(data)) {
			if (!registered.has(key)) {
				delete data[key];
			}
		}
		const read = new Set(readFrom(newStorage));
		// a registered key it does not hold keeps its value, written to it
		for (const key of registered) {
			if (key in data && !read.has(key)) {
				saveKey(key);
			}
		}
		saveIndex();
	},

	/**
	 * Make a storage out of a platform's cloud save
	 * @param options - what the platform loaded, and how to save
	 * @returns the storage
	 */
	createCloudStorage(options: CloudStorageOptions) {
		return createCloudStorage(options);
	},
};

export default save;
