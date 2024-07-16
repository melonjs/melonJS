export interface Pool<T, A extends unknown[]> {
	get(...args: A): T;
	release(object: T): void;
	purge(): void;
	size(): number;
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
	const inUse: T[] = [];
	const instanceResetMethods = new Map<T, Reset<A>>();

	return {
		release: (object: T) => {
			const index = inUse.indexOf(object);
			if (index >= 0) {
				const [instance] = inUse.splice(index, 1);
				available.push(instance);
			} else {
				throw new Error("Trying to release an instance that is not in use.");
			}
		},
		get: (...args) => {
			const object = available.pop();
			if (object) {
				inUse.push(object);
				const reset = instanceResetMethods.get(object);
				reset?.(...args);
				return object;
			} else {
				const { instance, reset } = options(...args);
				instanceResetMethods.set(instance, reset);
				inUse.push(instance);
				return instance;
			}
		},
		purge: () => {
			available.length = 0;
		},
		size: () => {
			return available.length + inUse.length;
		},
	};
};
