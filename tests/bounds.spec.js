import { describe, expect, it } from "vitest";
import { Bounds, Matrix2d, math } from "../src/index.js";

describe("Physics : Bounds", () => {
	it("works", () => {});
	const bound1 = new Bounds([
		{ x: 0, y: 0 },
		{ x: 50, y: 0 },
		{ x: 50, y: 100 },
		{ x: 0, y: 100 },
	]);
	const bound2 = bound1.clone();
	const bound3 = bound2.clone();
	describe("bound coordinates", () => {
		it("bound1 has finite coordinates", () => {
			expect(bound1.isFinite()).toEqual(true);
			expect(bound1.width).toEqual(50);
			expect(bound1.height).toEqual(100);
		});
		it("bound1 position", () => {
			expect(bound1.left).toEqual(0);
			expect(bound1.top).toEqual(0);
		});
		it("shift and translate bound1", () => {
			expect(bound1.left).toEqual(0);
			expect(bound1.top).toEqual(0);
			bound1.shift(10, 20);
			expect(bound1.left).toEqual(10);
			expect(bound1.top).toEqual(20);
			bound1.translate(10, -10);
			expect(bound1.left).toEqual(20);
			expect(bound1.top).toEqual(10);
			bound1.shift(100, 100);
			expect(bound1.left).toEqual(100);
			expect(bound1.top).toEqual(100);
			bound1.translate(-50, -50);
			expect(bound1.left).toEqual(50);
			expect(bound1.top).toEqual(50);
			bound1.shift(0, 0);
			expect(bound1.left).toEqual(0);
			expect(bound1.top).toEqual(0);
		});
		it("centerOn bound1", () => {
			bound1.centerOn(100, 100);
			expect(bound1.left).toEqual(100 - 50 / 2);
			expect(bound1.top).toEqual(100 - 100 / 2);
			expect(bound1.width).toEqual(50);
			expect(bound1.height).toEqual(100);
			// restore previous position for next test
			bound1.centerOn(25, 50);
		});
		it("translate bound1", () => {
			bound1.translate(100, 100);
			expect(bound1.left).toEqual(100);
			expect(bound1.top).toEqual(100);
			expect(bound1.right).toEqual(150);
			expect(bound1.bottom).toEqual(200);
		});
		it("bound1 size", () => {
			expect(bound1.width).toEqual(50);
			expect(bound1.height).toEqual(100);
		});
		it("center of bound1", () => {
			expect(bound1.center.x).toEqual(125);
			expect(bound1.center.y).toEqual(150);
			expect(bound1.centerX).toEqual(125);
			expect(bound1.centerY).toEqual(150);
		});
		it("bounds1 contains a point", () => {
			expect(bound1.contains(0, 0)).toEqual(false);
			expect(bound1.contains(125, 150)).toEqual(true);
		});
		it("union with another bound", () => {
			const bound2 = new Bounds([
				{ x: 0, y: 0 },
				{ x: 200, y: 0 },
				{ x: 200, y: 150 },
				{ x: 0, y: 150 },
			]);
			bound1.addBounds(bound2);
			expect(bound1.left).toEqual(0);
			expect(bound1.top).toEqual(0);
			expect(bound1.right).toEqual(200);
			expect(bound1.bottom).toEqual(200);
			expect(bound1.centerX).toEqual(100);
			expect(bound1.centerY).toEqual(100);
			expect(bound1.contains(0, 0)).toEqual(true);
			expect(bound1.contains(125, 150)).toEqual(true);
		});
	});
	describe("bound translate and shifting", () => {
		it("bound2 pos is (0,0)", () => {
			expect(bound2.x).toEqual(0);
			expect(bound2.y).toEqual(0);
		});
		it("translate bound2 by (20, 20)", () => {
			bound2.translate(20, 20);
			expect(bound2.x).toEqual(20);
			expect(bound2.y).toEqual(20);
			expect(bound2.width).toEqual(50);
			expect(bound2.height).toEqual(100);
		});
		it("shift bound2 to (10, 10)", () => {
			expect(bound2.x).toEqual(20);
			expect(bound2.y).toEqual(20);
			bound2.shift(10, 10);
			expect(bound2.x).toEqual(10);
			expect(bound2.y).toEqual(10);
			expect(bound2.width).toEqual(50);
			expect(bound2.height).toEqual(100);
		});
		it("bound2 is contained in bound1", () => {
			expect(bound1.contains(bound2)).toEqual(true);
			expect(bound2.overlaps(bound1)).toEqual(true);
			expect(bound2.contains(bound1)).toEqual(false);
		});
		it("bound2 is defined using addFrame", () => {
			bound2.clear();
			// addFrame expect the left, top, right and bottom coordinates
			bound2.addFrame(10, 50, 110, 250);
			expect(bound2.x).toEqual(10);
			expect(bound2.y).toEqual(50);
			expect(bound2.width).toEqual(100);
			expect(bound2.height).toEqual(200);
		});
		it("bound2 is defined using addFrame with transformation", () => {
			const m = new Matrix2d();
			// rotate 90 degrees clockwise
			m.rotate(math.degToRad(90));
			bound2.clear();
			// addFrame expect the left, top, right and bottom coordinates
			bound2.addFrame(10, 50, 110, 250, m);
			expect(bound2.x).toBeCloseTo(-250, 5);
			expect(bound2.y).toBeCloseTo(10, 5);
			expect(bound2.width).toBeCloseTo(200, 5);
			expect(bound2.height).toBeCloseTo(100, 5);
		});
	});
	describe("bound with complex vertices", () => {
		// define a polygon object (star from the the shape example)
		const star = [
			// draw a star
			{ x: 0, y: 0 },
			{ x: 28, y: 60 },
			{ x: 94, y: 70 },
			{ x: 46, y: 114 },
			{ x: 88, y: 180 },
			{ x: 0, y: 125 },
			{ x: -88, y: 180 },
			{ x: -46, y: 114 },
			{ x: -94, y: 70 },
			{ x: -28, y: 60 },
		];
		it("update bound3 from Polygon", () => {
			bound3.update(star);
			expect(bound3.isFinite()).toEqual(true);
		});
		it("bound3 width is 188", () => {
			expect(bound3.width).toEqual(188);
		});
		it("bound3 height is 180", () => {
			expect(bound3.height).toEqual(180);
		});
		it("bound3 pos is (-94,0)", () => {
			expect(bound3.x).toEqual(-94);
			expect(bound3.y).toEqual(0);
		});
	});
});
