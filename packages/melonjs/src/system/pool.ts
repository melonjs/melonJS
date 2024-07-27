export interface Pool<T, A extends unknown[]> {
	get(...args: A): T;
	release(object: T): void;
	purge(): void;
	size(): number;
	used(): number;
}

type Reset<A extends unknown[]> = ((...args: A) => void) | undefined;

export interface CreatePoolOptions<T, A extends unknown[]> {
	instance: T;
	reset?: Reset<A>;
}

export const createPool = <T, A extends unknown[]>(
	options: (...args: A) => CreatePoolOptions<T, A>,
): Pool<T, A> => {
	const available: T[] = [];
	const instanceResetMethods = new Map<T, Reset<A>>();
	let inUse: number = 0;

	return {
		/**
		 * release an object back to the pool
		 * @param instance The object to release.
		 */
		release: (instance: T) => {
			available.push(instance);
			inUse--;
		},
		/**
		 * get an instance from the pool
		 * @param args The arguments for creating the instance.
		 */
		get: (...args) => {
			const object = available.pop();
			if (object) {
				const reset = instanceResetMethods.get(object);
				reset?.(...args);
				inUse++;
				return object;
			} else {
				const { instance, reset } = options(...args);
				instanceResetMethods.set(instance, reset);
				inUse++;
				return instance;
			}
		},
		/**
		 * purge the pool
		 */
		purge: () => {
			available.length = 0;
			inUse = 0;
		},
		/**
		 * get the current size of the pool (how many objects are available)
		 */
		size: () => {
			return available.length;
		},
		/**
		 * get the number of objects currently in use
		 */
		used: () => {
			return inUse;
		},
	};
};
