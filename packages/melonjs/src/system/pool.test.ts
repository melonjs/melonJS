import { expect, test, vi } from "vitest";
import { createPool } from "./pool";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class GameObject {}

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
