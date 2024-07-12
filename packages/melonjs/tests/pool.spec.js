import { describe, expect, it } from "vitest";
import { Vector2d, pool } from "../src/index.js";

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

		it("object is not recycled when pushed and pulled back again", () => {
			// pushing it into the object pool should throw an exception
			expect(() => {
				pool.push(obj);
			}).toThrow();
		});
	});
});
