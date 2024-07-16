import { beforeAll, describe, expect, it } from "vitest";
import { Bounds, math, pool, Rect } from "../src/index.js";

describe("Shape : Rect", () => {
	let rect1: Rect;
	let rect2: Rect;
	let rect3: Rect;
	let rect4: Rect;
	let rect5: Rect;
	let rect6: Rect;

	beforeAll(() => {
		// test fail without this
		pool.register("Bounds", Bounds, true);

		rect1 = new Rect(0, 0, 25, 50);
		// rect 2 overlap rect 1
		rect2 = new Rect(50, 50, 100, 100);
		// rect 3 contains rect 1 and rect 2
		rect3 = new Rect(0, 0, 150, 150);
		// rect 4 does not overlap any rectangle
		rect4 = new Rect(500, 500, 50, 50);
		// rect 5 is the merge of rect 2 and rect 4
		rect5 = rect2.clone().union(rect4);
		// rect 6 is an infinite plane
		rect6 = new Rect(-Infinity, -Infinity, Infinity, Infinity);
	});

	describe("rect1", () => {
		it("rect 1 has finite coordinates", () => {
			expect(rect1.isFinite()).toEqual(true);
		});

		it("shift and translate rect1", () => {
			expect(rect1.pos.x).toEqual(0);
			expect(rect1.pos.y).toEqual(0);
			rect1.shift(10, 20);
			expect(rect1.pos.x).toEqual(10);
			expect(rect1.pos.y).toEqual(20);
			expect(rect1.getBounds().x).toEqual(10);
			expect(rect1.getBounds().y).toEqual(20);
			rect1.translate(10, 10);
			expect(rect1.pos.x).toEqual(20);
			expect(rect1.pos.y).toEqual(30);
			expect(rect1.getBounds().x).toEqual(20);
			expect(rect1.getBounds().y).toEqual(30);
			rect1.shift(100, 100);
			expect(rect1.pos.x).toEqual(100);
			expect(rect1.pos.y).toEqual(100);
			rect1.translate(-50, -50);
			expect(rect1.pos.x).toEqual(50);
			expect(rect1.pos.y).toEqual(50);
			rect1.shift(0, 0);
			expect(rect1.pos.x).toEqual(0);
			expect(rect1.pos.y).toEqual(0);
		});

		it("scale rect1", () => {
			rect1.scale(4, 2);
			expect(rect1.width).toEqual(100);
			expect(rect1.height).toEqual(100);
			expect(rect1.getBounds().width).toEqual(100);
			expect(rect1.getBounds().height).toEqual(100);
		});

		it("center scaled rect1", () => {
			expect(rect1.centerX).toEqual(50);
			expect(rect1.centerY).toEqual(50);
		});

		it("move rect1 center", () => {
			// default position
			expect(rect1.pos.x).toEqual(0);
			expect(rect1.pos.y).toEqual(0);
			// move the rect
			rect1.centerX = 200;
			rect1.centerY = 400;
			expect(rect1.pos.x).toEqual(150);
			expect(rect1.pos.y).toEqual(350);
			expect(rect1.centerX).toEqual(200);
			expect(rect1.centerY).toEqual(400);
			expect(rect1.getBounds().x).toEqual(150);
			expect(rect1.getBounds().y).toEqual(350);
			expect(rect1.getBounds().width).toEqual(100);
			expect(rect1.getBounds().height).toEqual(100);
			// move it back
			rect1.centerOn(50, 50);
			expect(rect1.pos.x).toEqual(0);
			expect(rect1.pos.y).toEqual(0);
			expect(rect1.centerX).toEqual(50);
			expect(rect1.centerY).toEqual(50);
			expect(rect1.getBounds().x).toEqual(0);
			expect(rect1.getBounds().y).toEqual(0);
			expect(rect1.getBounds().width).toEqual(100);
			expect(rect1.getBounds().height).toEqual(100);
		});

		it("rect 1 overlaps rect2", () => {
			expect(rect1.overlaps(rect2)).toEqual(true);
		});

		it("rect 1 overlaps rect3", () => {
			expect(rect1.overlaps(rect3)).toEqual(true);
		});

		it("rect 1 does not overlaps rect4", () => {
			expect(rect1.overlaps(rect4)).toEqual(false);
		});

		it("rect 1 can be resized", () => {
			rect1.resize(500, 500);
			expect(rect1.centerX).toEqual(250);
			expect(rect1.centerY).toEqual(250);
		});

		it("rect 1 can be rotated around its origin point", () => {
			rect1.resize(200, 500);

			expect(rect1.pos.x).toEqual(0);
			expect(rect1.pos.y).toEqual(0);
			expect(rect1.width).toBeCloseTo(200);
			expect(rect1.height).toBeCloseTo(500);

			rect1.rotate(-math.degToRad(90));

			expect(rect1.pos.x).toEqual(0);
			expect(rect1.pos.y).toEqual(0);
			expect(rect1.width).toBeCloseTo(500);
			expect(rect1.height).toBeCloseTo(-200);

			// rotate back for following tests
			rect1.rotate(math.degToRad(90));
			expect(rect1.pos.x).toEqual(0);
			expect(rect1.pos.y).toEqual(0);
			expect(rect1.width).toBeCloseTo(200);
			expect(rect1.height).toBeCloseTo(500);
		});

		it("rect 1 can be rotated arount its center", () => {
			rect1.resize(200, 500);
			expect(rect1.getBounds().x).toEqual(0);
			expect(rect1.getBounds().y).toEqual(0);
			expect(rect1.getBounds().width).toEqual(200);
			expect(rect1.getBounds().height).toEqual(500);

			// rotate by 90 degrees
			rect1.rotate(-math.degToRad(90), {
				x: rect1.getBounds().centerX,
				y: rect1.getBounds().centerY,
			});
			expect(rect1.getBounds().x).toEqual(-150);
			expect(rect1.getBounds().y).toEqual(150);
			expect(rect1.getBounds().width).toBeCloseTo(500);
			expect(rect1.getBounds().height).toBeCloseTo(200);

			// rotate back
			rect1.rotate(math.degToRad(90), {
				x: rect1.getBounds().centerX,
				y: rect1.getBounds().centerY,
			});
			expect(rect1.getBounds().x).toBeCloseTo(0, 5);
			expect(rect1.getBounds().y).toBeCloseTo(0, 5);
			expect(rect1.getBounds().width).toBeCloseTo(200, 5);
			expect(rect1.getBounds().height).toBeCloseTo(500, 5);
		});
	});

	describe("rect2", () => {
		it("rect 2 center is set", () => {
			expect(rect2.centerX).toEqual(100);
			expect(rect2.centerY).toEqual(100);
		});

		it("rect 2 overlaps rect3", () => {
			expect(rect1.overlaps(rect3)).toEqual(true);
		});

		it("rect 2 does not overlaps rect4", () => {
			expect(rect1.overlaps(rect4)).toEqual(false);
		});
	});

	describe("rect3", () => {
		it("rect 3 does no contains rect1", () => {
			expect(rect3.containsRectangle(rect1)).toEqual(false);
		});

		it("rect 3 contains rect2", () => {
			expect(rect3.containsRectangle(rect2)).toEqual(true);
		});

		it("rect 3 contains the point (70, 150)", () => {
			expect(rect3.contains(70, 150)).toEqual(true);
		});

		it("rect 3 does not overlaps rect4", () => {
			expect(rect3.overlaps(rect4)).toEqual(false);
		});
	});

	describe("rect5", () => {
		it("rect 5 width is 500", () => {
			expect(rect5.width).toEqual(500);
		});

		it("rect 5 height is 500", () => {
			expect(rect5.width).toEqual(500);
		});

		it("rect 5 pos is (50,50)", () => {
			expect(rect5.pos.equals({ x: 50, y: 50 })).toEqual(true);
		});

		it("rect 5 overlaps rect1", () => {
			expect(rect5.overlaps(rect1)).toEqual(true);
		});

		it("rect 5 contains rect2", () => {
			expect(rect5.containsRectangle(rect2)).toEqual(true);
		});

		it("rect 5 overlaps rect3", () => {
			expect(rect5.overlaps(rect3)).toEqual(true);
		});

		it("rect 5 contains rect4", () => {
			expect(rect5.containsRectangle(rect4)).toEqual(true);
		});

		it("rect 5 does not equal rect4", () => {
			expect(rect5.equals(rect4)).toEqual(false);
		});

		it("a cloned rect 5 equal rect5", () => {
			expect(rect5.clone().equals(rect5)).toEqual(true);
		});
	});

	describe("rect6", () => {
		it("rect 6 is an infinite plane", () => {
			expect(rect6.isFinite()).toEqual(false);
		});
	});
});
