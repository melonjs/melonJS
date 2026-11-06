/**
 * `purge()` drops the idle instances of a pool, and only those.
 *
 * `createPool().purge()` cleared the idle set and ALSO reset the in-use
 * count to 0, though the instances still out were never the pool's to
 * forget. `used()` then stopped counting them, and releasing them afterwards
 * drove it negative (and a later `get()` read a count off by as many).
 *
 * `purge()` now leaves the in-use count alone. The idle instances it drops
 * are forgotten entirely, so releasing one of them again is ignored, as for
 * any object the pool does not own, rather than counted.
 */
import { describe, expect, it } from "vitest";
import { createPool } from "../src/index.js";

describe("createPool : purge() and the in-use count", () => {
	const make = () => {
		let created = 0;
		const pool = createPool(() => {
			created++;
			return { instance: { v: 0 }, reset() {} };
		});
		return {
			pool,
			created: () => {
				return created;
			},
		};
	};

	it("used() still counts the instances out after purge()", () => {
		const { pool } = make();
		const a = pool.get();
		const b = pool.get();
		pool.release(b);
		expect(pool.used()).toBe(1);
		pool.purge();
		expect(pool.size()).toBe(0);
		expect(pool.used()).toBe(1);
		pool.release(a);
		expect(pool.used()).toBe(0);
		expect(pool.size()).toBe(1);
	});

	it("never goes negative, however purge and release interleave", () => {
		const { pool } = make();
		const out = [pool.get(), pool.get(), pool.get(), pool.get()];
		pool.release(out[0]);
		pool.purge();
		pool.release(out[1]);
		pool.purge();
		pool.purge();
		expect(pool.used()).toBe(2);
		pool.release(out[2]);
		pool.release(out[3]);
		expect(pool.used()).toBe(0);
		expect(pool.size()).toBe(2);
	});

	it("an instance still out when the pool was purged is recycled when released", () => {
		const { pool, created } = make();
		const a = pool.get();
		pool.purge();
		pool.release(a);
		expect(pool.get()).toBe(a);
		expect(created()).toBe(1);
		expect(pool.used()).toBe(1);
	});

	it("a purged idle instance is gone: get() builds a new one", () => {
		const { pool, created } = make();
		const a = pool.get();
		pool.release(a);
		pool.purge();
		const b = pool.get();
		expect(b).not.toBe(a);
		expect(created()).toBe(2);
		expect(pool.used()).toBe(1);
	});

	it("releasing a purged idle instance again does not touch the counts", () => {
		const { pool } = make();
		const a = pool.get();
		const b = pool.get();
		pool.release(a);
		pool.purge();
		expect(() => {
			pool.release(a);
		}).not.toThrow();
		expect(pool.used()).toBe(1);
		expect(pool.size()).toBe(0);
		pool.release(b);
		expect(pool.used()).toBe(0);
	});

	it("purge() on a pool with nothing out leaves it empty and at zero", () => {
		const { pool } = make();
		pool.release(pool.get());
		pool.purge();
		expect(pool.size()).toBe(0);
		expect(pool.used()).toBe(0);
	});
});
