/**
 * Interface representing a poolable object with a reset method.
 * @template {any[]} T - The arguments for the onReset method.
 */
export interface Poolable<T extends any[] = any[]> {
	/**
	 * Method to reset the object.
	 * @param args - Arguments for resetting the object.
	 */
	onReset(...args: T): void;
}

/**
 * Options for creating a pool.
 * @template {Poolable} T - The type of poolable objects.
 */
export interface CreatePoolOptions<T extends Poolable> {
	/**
	 * The constructor for creating new instances of the poolable object.
	 */
	type: new () => T;
}

/**
 * Creates a pool for managing poolable objects.
 * @template {Poolable} T - The type of poolable objects.
 * @param options - Options for creating the pool.
 * @returns The pool with methods to get, release, purge, and check size.
 */
export const createPool = <T extends Poolable>(
	options: CreatePoolOptions<T>,
) => {
	const available: T[] = [];
	const inUse: T[] = [];

	/**
	 * Get an object from the pool, or create a new one if none are available.
	 * @param args - Arguments to reset the object.
	 * @returns The poolable object.
	 */
	const get = (...args: Parameters<T["onReset"]>) => {
		const object = available.pop();
		if (object) {
			object.onReset(...args);
			inUse.push(object);
			return object;
		}
		const instance = new options.type();
		inUse.push(instance);
		instance.onReset(...args);
		return instance;
	};

	/**
	 * Release an object back to the pool.
	 * @param object - The poolable object to release.
	 */
	const release = (object: T) => {
		const index = inUse.indexOf(object);
		if (index >= 0) {
			const [instance] = inUse.splice(index, 1);
			available.push(instance);
		}
	};

	/**
	 * Purge all available objects from the pool.
	 */
	const purge = () => {
		available.length = 0;
	};

	/**
	 * Get the size of the pool.
	 * @returns The number of objects in the pool, both available and in use.
	 */
	const size = () => {
		return available.length + inUse.length;
	};

	return {
		release,
		get,
		purge,
		size,
	};
};
