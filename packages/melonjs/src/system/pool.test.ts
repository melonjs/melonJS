import { expect, test } from "vitest";
import { createPool, Poolable } from "./pool";

class MyObject implements Poolable {
	onReset() {}
}

test("can acquire objects from the pool", () => {
	const pool = createPool({ type: MyObject });
	const object1 = pool.get();
	const object2 = pool.get();

	expect(object1).toBeInstanceOf(MyObject);
	expect(object2).toBeInstanceOf(MyObject);
	expect(object1).not.toBe(object2);
	expect(pool.size()).toBe(2);
});

test("can release objects from the pool", () => {
	const pool = createPool({ type: MyObject });
	const object1 = pool.get();
	pool.release(object1);
	pool.get();
	expect(pool.size()).toBe(1);
});

test("can manually purge", () => {
	const pool = createPool({ type: MyObject });
	const object1 = pool.get();
	const object2 = pool.get();
	const object3 = pool.get();
	expect(pool.size()).toBe(3);
	pool.release(object1);
	pool.purge();
	expect(pool.size()).toBe(2);
	pool.release(object2);
	pool.purge();
	expect(pool.size()).toBe(1);
	pool.release(object3);
	pool.purge();
	expect(pool.size()).toBe(0);
});
