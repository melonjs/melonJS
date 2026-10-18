import { expect, test, vi } from "vitest";
import { createPool } from "../src/system/pool";

class GameObject {
	destroyCalled = false;
	resetCalled = false;
	tag: string | undefined;
	reset() {
		this.resetCalled = true;
	}
	release() {
		this.destroyCalled = true;
	}
}

test("can acquire objects from the pool", () => {
	const pool = createPool(() => {
		return { instance: new GameObject() };
	});
	const object1 = pool.get();
	const object2 = pool.get();

	expect(object1).toBeInstanceOf(GameObject);
	expect(object2).toBeInstanceOf(GameObject);
	expect(object1).not.toBe(object2);
	expect(pool.size()).toBe(0);
	expect(pool.used()).toBe(2);
});

test("can release objects from the pool", () => {
	const pool = createPool(() => {
		return { instance: new GameObject() };
	});
	const object1 = pool.get();
	pool.release(object1);
	expect(pool.size()).toBe(1);
	expect(pool.used()).toBe(0);
	pool.get();
	expect(pool.size()).toBe(0);
	expect(pool.used()).toBe(1);
});

test("object reset and destroy are called when getting & releasing object", () => {
	const pool = createPool(() => {
		const gameObject = new GameObject();
		return {
			instance: gameObject,
			reset: () => {
				gameObject.reset();
			},
			release: () => {
				gameObject.release();
			},
		};
	});
	const object1 = pool.get();

	expect(object1).toBeInstanceOf(GameObject);
	expect(object1.resetCalled).toEqual(false);
	expect(object1.destroyCalled).toEqual(false);
	pool.release(object1);
	expect(object1.destroyCalled).toEqual(true);

	const object2 = pool.get();
	expect(object2).toBeInstanceOf(GameObject);
	expect(object2.resetCalled).toEqual(true);
});

test("can not release instance that already exist in pool", () => {
	const pool = createPool(() => {
		return { instance: new GameObject() };
	});
	const object1 = pool.get();
	pool.release(object1);
	expect(() => {
		pool.release(object1);
	}).toThrow();
});

test("can manually purge", () => {
	const pool = createPool(() => {
		return { instance: new GameObject() };
	});
	const object1 = pool.get();
	expect(pool.used()).toBe(1);
	const object2 = pool.get();
	const object3 = pool.get();
	expect(pool.size()).toBe(0);
	expect(pool.used()).toBe(3);
	pool.release(object1);
	expect(pool.size()).toBe(1);
	expect(pool.used()).toBe(2);
	pool.release(object2);
	pool.purge();
	expect(pool.size()).toBe(0);
	expect(pool.used()).toBe(0);
	pool.release(object3);
	expect(pool.size()).toBe(1);
	expect(pool.size()).toBe(1);
	pool.purge();
});

test("can pass arguments", () => {
	class Foo {
		prop: string;
		constructor(arg: string) {
			this.prop = arg;
		}
	}

	const reset = vi.fn();

	const pool = createPool<Foo, [string]>((a) => {
		return {
			instance: new Foo(a),
			reset(a) {
				reset(a);
			},
		};
	});

	expect(reset).not.toHaveBeenCalled();
	const object1 = pool.get("");
	expect(reset).not.toHaveBeenCalled();
	pool.release(object1);
	expect(reset).not.toHaveBeenCalled();
	pool.get("");
	expect(reset).toHaveBeenCalledWith("");
});

/**
 * The registries that map an instance to its `reset` / `release` callbacks
 * are keyed BY THE INSTANCE. Held strongly they pin every object the pool
 * ever handed out for the life of the page, which is reached by the most
 * ordinary use there is: `clone()` takes from the pool, game code uses the
 * result and drops it, and nothing can collect it. Measured before the fix,
 * 600k dropped clones retained 150MB and `used()` climbed for ever.
 *
 * `gc()` is exposed through the browser launch flags in `vitest.config.ts`.
 */
test("a dropped instance is not retained by the pool", async () => {
	expect(
		typeof globalThis.gc,
		"gc must be exposed; see --js-flags in vitest.config.ts",
	).toBe("function");

	const pool = createPool(() => ({ instance: new GameObject() }));
	// Taken and dropped inside a scope that ends, WITHOUT being released,
	// which is what a `clone()` caller does. A scope going out is a cleaner
	// way to drop the last reference than reassigning a variable nothing
	// reads again.
	const ref = ((): WeakRef<GameObject> => new WeakRef(pool.get()))();

	// Collect first and read ONCE at the end, never `deref()` in the loop
	// condition: a `deref()` keeps its target alive until the end of the
	// current job, so derefing and then collecting in the same turn holds the
	// object strongly at exactly the moment it is meant to go. That reads as
	// the leak still being there.
	for (let i = 0; i < 5; i++) {
		globalThis.gc?.();
		await new Promise((resolve) => setTimeout(resolve, 0));
	}

	expect(ref.deref()).toBeUndefined();
});

test("a released instance is reused rather than rebuilt", () => {
	// The other half of the same change: the callbacks still have to be
	// findable after the registries went weak, or a recycled object comes
	// back without its `reset` having run.
	const pool = createPool((_tag?: string) => {
		const instance = new GameObject();
		return {
			instance,
			reset: (nextTag?: string) => {
				instance.resetCalled = true;
				instance.tag = nextTag;
			},
			release: () => {
				instance.destroyCalled = true;
			},
		};
	});

	const first = pool.get("a");
	pool.release(first);
	expect(first.destroyCalled).toBe(true);

	const second = pool.get("b");
	expect(second, "the same instance comes back").toBe(first);
	expect(second.resetCalled, "and its reset ran").toBe(true);
	expect(second.tag, "with the new arguments").toBe("b");
});

test("the pool stamp does not leak into equality or serialisation", () => {
	// `poolable` is stamped on every instance. Enumerable, it would join
	// `Object.keys`, `JSON.stringify` and every deep-equality comparison,
	// so two otherwise identical objects would differ by a pool each.
	const pool = createPool(() => ({ instance: new GameObject() }));
	const object = pool.get();

	expect(Object.keys(object)).not.toContain("poolable");
	expect(JSON.stringify(object)).not.toContain("poolable");
	expect(Object.prototype.propertyIsEnumerable.call(object, "poolable")).toBe(
		false,
	);
});
