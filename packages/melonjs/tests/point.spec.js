import { beforeAll, describe, expect, it } from "vitest";
import { Point } from "../src/index.js";

describe("Shape : Point", () => {
	describe("Point", () => {
		let point;

		beforeAll(() => {
			point = new Point(1, 2);
		});

		it("point is initialized to is (1,2)", () => {
			expect(point.x).toEqual(1);
			expect(point.y).toEqual(2);
		});

		it("point is equal or not to another one", () => {
			const point2 = new Point(1, 2);
			expect(point.equals(point2)).toEqual(true);
			expect(point.equals(point2.x, point2.y)).toEqual(true);
			point2.set(3, 4);
			expect(point.equals(point2)).toEqual(false);
			expect(point.equals(point2.x, point2.y)).toEqual(false);
		});
	});
});
