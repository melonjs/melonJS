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
 * Interface representing a pool.
 * @template {Poolable} T - The type of poolable objects.
 */
export interface Pool<T extends Poolable> {
	/**
	 * Get an object from the pool, or create a new one if none are available.
	 * @param args - Arguments to reset the object.
	 * @returns The poolable object.
	 */
	get(...args: Parameters<T["onReset"]>): T;

	/**
	 * Release an object back to the pool.
	 * @param object - The poolable object to release.
	 */
	release(object: T): void;

	/**
	 * Purge all available objects from the pool.
	 */
	purge(): void;

	/**
	 * Get the size of the pool.
	 * @returns The number of objects in the pool, both available and in use.
	 */
	size(): number;
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
 * @returns The pool object
 */
export const createPool = <T extends Poolable>(
	options: CreatePoolOptions<T>,
): Pool<T> => {
	const available: T[] = [];
	const inUse: T[] = [];

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

	const release = (object: T) => {
		const index = inUse.indexOf(object);
		if (index >= 0) {
			const [instance] = inUse.splice(index, 1);
			available.push(instance);
		}
	};

	const purge = () => {
		available.length = 0;
	};

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
