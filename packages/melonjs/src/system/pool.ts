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
type Destroy = (() => void) | undefined;

export interface CreatePoolOptions<T, A extends unknown[]> {
	instance: T;
	reset?: Reset<A>;
	destroy?: Destroy;
}

export const createPool = <T, A extends unknown[]>(
	options: (...args: A) => CreatePoolOptions<T, A>,
): Pool<T, A> => {
	const available = new Set<T>();
	const instanceResetMethods = new Map<T, Reset<A>>();
	const instanceDestroyMethods = new Map<T, Destroy>();
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
			const destroy = instanceDestroyMethods.get(instance);
			destroy?.();
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
				const { instance, reset, destroy } = options(...args);
				instanceResetMethods.set(instance, reset);
				instanceDestroyMethods.set(instance, destroy);
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
