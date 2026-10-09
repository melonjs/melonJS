const takeFromSet = <T>(set: Set<T>) => {
	for (const value of set) {
		set.delete(value);
		return value;
	}
};

export interface Pool<T, A extends unknown[]> {
	get(...args: A): T;
	release(object: T): void;
	purge(): void;
	size(): number;
	used(): number;
}

type Reset<A extends unknown[]> = ((...args: A) => void) | undefined;
type Release = (() => void) | undefined;

export interface CreatePoolOptions<T, A extends unknown[]> {
	instance: T;
	// spelled out rather than naming the two aliases above: those are
	// internal, and a public interface must not reference a type a consumer
	// cannot see
	reset?: ((...args: A) => void) | undefined;
	release?: (() => void) | undefined;
}

// Pool registry for centralized access via getPool/getTotalPoolSize
const pools: Record<string, Pool<any, any[]>> = {};

/**
 * Register a pool instance to the pool registry.
 *
 * Public because `pool.js` re-exports it. Marked internal it was stripped
 * from the declarations while that re-export kept naming it, which left the
 * public `pool` module exporting something no longer declared.
 * @param key - the name this pool is reachable by
 * @param pool - the pool instance to register under it
 */
export const registerPool = (key: string, pool: Pool<any, any[]>) => {
	pools[key] = pool;
};

/**
 * @ignore
 * @internal
 */
export const getRegisteredPools = () => pools;

/**
 * Instances currently sitting in the pool that built them.
 *
 * `Pool#release` throws on an instance it already holds, which is the right
 * answer for a caller releasing the same object twice by hand. It is the wrong
 * answer for `releaseToOwningPool`, which is called for EVERY child a
 * container drops: a game that released a pooled label itself, with the label
 * still a container child, then had the next `clearChildren()` or level change
 * throw out of the teardown. This lets that path recognise the object is
 * already home and say so without going near `release`.
 * @ignore
 * @internal
 */
const parked = new WeakSet();

/**
 * The back-pointer `createPool` stamps on everything it builds.
 *
 * It answers "which pool owns this object", which is the question a GENERIC
 * caller has to ask: `Container#removeChildNow` holds a child and has no idea
 * what it is. A per-class check cannot answer it, because two pools can exist
 * for one class and releasing to the wrong one silently corrupts both.
 *
 * The legacy pool answered the same question with a `className` string; this
 * is that, typed and without the registry.
 * @internal
 * @ignore
 */
export interface Poolable {
	/**
	 * the pool that created this object, if any
	 *
	 * Typed the same way the pool registry above is: a pool's parameters vary
	 * per class, and this field holds whichever one built the object.
	 * @internal
	 * @ignore
	 */
	poolable?: Pool<any, any[]>;
}

/**
 * Hand an object back to whichever pool created it.
 *
 * Returns false for anything a pool did not build, which is the signal a
 * caller needs to fall back to destroying it instead.
 * @param instance - the object to release
 * @returns true if a pool took it back
 * @internal
 * @ignore
 */
export const releaseToOwningPool = (instance: object): boolean => {
	const owner = (instance as Poolable).poolable;
	if (owner === undefined) {
		return false;
	}
	// already back in its pool, so the caller must not destroy it either
	if (parked.has(instance)) {
		return true;
	}
	owner.release(instance);
	return true;
};

export const createPool = <T, A extends unknown[]>(
	options: (...args: A) => CreatePoolOptions<T, A>,
): Pool<T, A> => {
	const available = new Set<T>();
	const instanceResetMethods = new Map<T, Reset<A>>();
	const instanceReleaseMethods = new Map<T, Release>();
	let inUse: number = 0;

	const pool: Pool<T, A> = {
		/**
		 * release an object back to the pool
		 * @param instance The object to release.
		 */
		release: (instance: T) => {
			if (available.has(instance)) {
				throw new Error("Instance is already in pool.");
			}
			// Only an instance this pool CREATED can be recycled. `reset` is
			// registered per instance at creation, closing over that instance,
			// so a foreign object has none — and `get` applies whatever reset
			// it finds, which for a foreign object was nothing at all: it came
			// back out carrying its previous owner's geometry and silently
			// ignoring the arguments the caller asked for.
			//
			// `Body#destroy` releases the shapes its body was built from, and
			// those are hand-constructed (`new Body(r, new Rect(...))`) in the
			// documented idiom, so this was reached by ordinary game code
			// tearing a body down. Dropping the instance loses nothing: it was
			// never recyclable, and the garbage collector takes it from here.
			if (!instanceResetMethods.has(instance)) {
				return;
			}
			const release = instanceReleaseMethods.get(instance);
			release?.();
			available.add(instance);
			if (instance !== null && typeof instance === "object") {
				parked.add(instance);
			}
			inUse--;
		},
		/**
		 * get an instance from the pool
		 * @param args The arguments for creating the instance.
		 */
		get: (...args) => {
			const object = takeFromSet(available);
			if (object) {
				if (object !== null && typeof object === "object") {
					parked.delete(object);
				}
				const reset = instanceResetMethods.get(object);
				reset?.(...args);
				inUse++;
				return object;
			} else {
				const { instance, reset, release } = options(...args);
				instanceResetMethods.set(instance, reset);
				instanceReleaseMethods.set(instance, release);
				// Stamped once, at construction: a recycled instance already
				// carries it, and this is what lets a generic caller return
				// the object without knowing its type.
				//
				// NON-ENUMERABLE, which is not a detail: as a plain property
				// it joins `Object.keys`, `JSON.stringify`, console output and
				// every deep-equality comparison. `tests/vector2d.spec.ts`
				// caught it immediately, comparing two vectors that were now
				// carrying a pool each.
				if (instance !== null && typeof instance === "object") {
					Object.defineProperty(instance, "poolable", {
						value: pool,
						enumerable: false,
						writable: true,
						configurable: true,
					});
				}
				inUse++;
				return instance;
			}
		},
		/**
		 * purge the pool
		 */
		purge: () => {
			available.clear();
			inUse = 0;
		},
		/**
		 * get the current size of the pool (how many objects are available)
		 */
		size: () => {
			return available.size;
		},
		/**
		 * get the number of objects currently in use
		 */
		used: () => {
			return inUse;
		},
	};

	return pool;
};
