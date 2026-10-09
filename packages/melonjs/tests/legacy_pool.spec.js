import { describe, expect, it } from "vitest";
import { pool, Vector2d } from "../src/index.js";

describe("pool", () => {
	describe("poolable object", () => {
		pool.register("Vector2d", Vector2d, true);
		let vec2 = pool.pull("Vector2d");

		it("pulled object is of the correct instance", () => {
			expect(vec2).toBeInstanceOf(Vector2d);
		});

		it("object is properly recycled when pushed back", () => {
			// modify vec2
			vec2.set(1, 2);
			// add a hidden property
			vec2._recycled = true;
			// push it back to the object pool
			pool.push(vec2);
			// pull it again
			vec2 = pool.pull("Vector2d");

			// should be the same object
			expect(vec2._recycled).toEqual(true);

			// object should have been reinitialazed
			expect(vec2.toString()).toEqual("x:0,y:0");
		});
	});

	describe("non poolable object", () => {
		class dummyClass {
			constructor() {
				this.alive = true;
			}
			destroy() {
				this.alive = false;
			}
		}
		pool.register("dummyClass", dummyClass, false);

		const obj = pool.pull("dummyClass");

		it("pulled object is of the correct instance", () => {
			expect(obj).toBeInstanceOf(dummyClass);
			expect(obj.alive).toEqual(true);
		});

		it("REGRESSION: refusing to recycle REPORTS, it does not throw", () => {
			// It used to throw by default, and nothing at the call site made
			// that visible, so a class registered without recycling aborted
			// whatever was running. Both internal uses removed in 20.7.0
			// failed that way, from inside a `destroy()` that had already
			// recycled other state.
			let returned;
			expect(() => {
				returned = pool.push(obj);
			}).not.toThrow();
			expect(returned).toBe(false);
			// and it really did not take it: the next pull is a fresh one
			expect(pool.pull("dummyClass")).not.toBe(obj);
		});

		it("still throws when the caller asks for it", () => {
			// the opt-in, for a caller that wants a missed registration to be
			// loud rather than silent
			expect(() => {
				pool.push(obj, true);
			}).toThrow("cannot be recycled");
		});
	});
});
