import { describe, expect, it } from "vitest";
import { boot, Container, createPool, Renderable } from "../src/index.js";

/**
 * A container returns a child to whichever pool built it.
 *
 * This is the migration path the legacy pool's deprecation notice points at,
 * so it has to work from the PUBLIC surface: `createPool` is exported for
 * exactly this reason, because `getPool` only reaches the pools the engine
 * ships and a game needs one for its own class.
 */
describe("pooled children are returned on removal", () => {
	class Bullet extends Renderable {
		constructor(x, y) {
			super(x, y, 4, 4);
		}
		onResetEvent(x, y) {
			this.pos.set(x, y, 0);
		}
	}

	const makePool = () => {
		return createPool((x, y) => {
			const instance = new Bullet(x, y);
			return {
				instance,
				reset: (x, y) => {
					return instance.onResetEvent(x, y);
				},
			};
		});
	};

	it("removeChildNow hands the child back, and the next get reuses it", () => {
		boot();
		const bulletPool = makePool();
		const container = new Container(0, 0, 100, 100);

		const first = bulletPool.get(10, 20);
		container.addChild(first);
		expect(bulletPool.used()).toEqual(1);

		container.removeChildNow(first);
		// returned, not destroyed: the container asked the object which pool
		// owns it rather than consulting a name registry
		expect(bulletPool.used()).toEqual(0);
		expect(bulletPool.size()).toEqual(1);

		const second = bulletPool.get(30, 40);
		expect(second).toBe(first);
		expect(second.pos.x).toEqual(30);
	});

	it("keepalive leaves the child alone", () => {
		boot();
		const bulletPool = makePool();
		const container = new Container(0, 0, 100, 100);

		const b = bulletPool.get(1, 2);
		container.addChild(b);
		container.removeChildNow(b, true);
		// still counted as in use: keepalive means the caller keeps it
		expect(bulletPool.used()).toEqual(1);
	});

	it("REGRESSION: releasing a child yourself, then clearing, does not throw", () => {
		// the pattern the pool docs instruct: `release` it when it is
		// finished. If it is still a container child, and it usually is, the
		// next `clearChildren()` or level change reached the pool a second
		// time and an exception escaped the teardown partway through.
		boot();
		const bulletPool = makePool();
		const container = new Container(0, 0, 100, 100);

		const b = bulletPool.get(5, 6);
		container.addChild(b);
		bulletPool.release(b);
		expect(() => {
			container.clearChildren();
		}).not.toThrow();
		// and it is in the pool exactly once
		expect(bulletPool.size()).toEqual(1);
		expect(bulletPool.used()).toEqual(0);
	});

	it("and the container does not take it back twice", () => {
		// the tolerance is the container's, not `release`'s: releasing the
		// same object twice by hand is still an error, and that is what
		// `tests/pool.test.ts` pins
		boot();
		const bulletPool = makePool();
		const container = new Container(0, 0, 100, 100);

		const b = bulletPool.get(7, 8);
		container.addChild(b);
		container.clearChildren();
		expect(bulletPool.size()).toEqual(1);
		// a second pass over a container that still listed it must not add a
		// second copy either
		expect(() => {
			container.clearChildren();
		}).not.toThrow();
		expect(bulletPool.size()).toEqual(1);
		expect(bulletPool.used()).toEqual(0);
	});

	it("an unpooled child is destroyed instead", () => {
		boot();
		const container = new Container(0, 0, 100, 100);
		const plain = new Renderable(0, 0, 4, 4);
		container.addChild(plain);
		container.removeChildNow(plain);
		// `destroy()` releases `pos` back to the vector pool
		expect(plain.pos).toBeUndefined();
	});
});
