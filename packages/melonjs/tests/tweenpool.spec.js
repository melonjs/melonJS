import { describe, expect, it } from "vitest";
import { getPool, Tween } from "../src/index.js";
import { tweenPool } from "../src/tweens/tween.ts";

/**
 * `tweenPool` is the typed `createPool` replacement for the legacy
 * `pool.pull("Tween", …)` path, and it is publicly reachable as
 * `getPool("tween")`.
 *
 * It had no direct coverage: breaking its `reset` failed only two tests, both
 * camera effects that merely happen to use it, so the one thing the pool
 * exists to guarantee was pinned by nothing it owns. `particlePool`, the other
 * renderable pool, is covered by 27.
 */
describe("tweenPool", () => {
	it("is the pool registered under the public `tween` key", () => {
		// `getPool` is exported from the barrel, so this key is API
		expect(getPool("tween")).toBe(tweenPool);
	});

	it("hands out a real Tween bound to the object it was asked for", () => {
		const target = { x: 0 };
		const tween = tweenPool.get(target);
		try {
			expect(tween).toBeInstanceOf(Tween);
			expect(tween._object).toBe(target);
		} finally {
			tweenPool.release(tween);
		}
	});

	it("REGRESSION: a recycled tween is bound to its NEW target", () => {
		// The whole job of `reset`. Without it a recycled tween keeps the
		// previous owner's object and animates something the caller never
		// mentioned, silently and from a frame later. Only observable through
		// a get / release / get cycle, which is why no existing test saw it.
		const first = { x: 0 };
		const tween = tweenPool.get(first);
		tweenPool.release(tween);

		const second = { x: 100 };
		const recycled = tweenPool.get(second);
		try {
			// the same instance came back ...
			expect(recycled).toBe(tween);
			// ... pointing at the new object, not the old one
			expect(recycled._object).toBe(second);
			expect(recycled._object).not.toBe(first);
		} finally {
			tweenPool.release(recycled);
		}
	});

	it("counts instances in use, and gives them back on release", () => {
		// `used()` never decrementing is a leak that looks like nothing until
		// the pool stops recycling entirely; `particlePool` has this test and
		// this one did not
		const before = tweenPool.used();
		const a = tweenPool.get({ x: 0 });
		const b = tweenPool.get({ x: 0 });
		expect(tweenPool.used()).toBe(before + 2);

		tweenPool.release(a);
		tweenPool.release(b);
		expect(tweenPool.used()).toBe(before);
	});

	it("ignores a foreign object handed to release", () => {
		// `release` is reachable from game code, and a tween built with `new`
		// was never the pool's to recycle. Taking it would hand a later
		// `get()` an instance with no reset registered, which would then
		// silently ignore the target it was asked for.
		const foreign = new Tween({ x: 0 });
		const before = tweenPool.used();
		expect(() => {
			tweenPool.release(foreign);
		}).not.toThrow();
		expect(tweenPool.used()).toBe(before);

		const fresh = tweenPool.get({ x: 42 });
		try {
			expect(fresh).not.toBe(foreign);
			expect(fresh._object.x).toBe(42);
		} finally {
			tweenPool.release(fresh);
		}
	});
});
