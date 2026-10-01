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
	reset?: Reset<A>;
	release?: Release;
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

export const createPool = <T, A extends unknown[]>(
	options: (...args: A) => CreatePoolOptions<T, A>,
): Pool<T, A> => {
	const available = new Set<T>();
	const instanceResetMethods = new Map<T, Reset<A>>();
	const instanceReleaseMethods = new Map<T, Release>();
	let inUse: number = 0;

	return {
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
			inUse--;
		},
		/**
		 * get an instance from the pool
		 * @param args The arguments for creating the instance.
		 */
		get: (...args) => {
			const object = takeFromSet(available);
			if (object) {
				const reset = instanceResetMethods.get(object);
				reset?.(...args);
				inUse++;
				return object;
			} else {
				const { instance, reset, release } = options(...args);
				instanceResetMethods.set(instance, reset);
				instanceReleaseMethods.set(instance, release);
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
};
