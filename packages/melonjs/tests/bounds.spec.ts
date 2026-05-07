import { describe, expect, it } from "vitest";
import { Bounds, Matrix2d, Matrix3d, math } from "../src/index.js";

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
		it("addFrame with Matrix3d identity equals untransformed addFrame", () => {
			const b = new Bounds();
			b.addFrame(10, 50, 110, 250, new Matrix3d());
			expect(b.x).toBeCloseTo(10, 5);
			expect(b.y).toBeCloseTo(50, 5);
			expect(b.width).toBeCloseTo(100, 5);
			expect(b.height).toBeCloseTo(200, 5);
		});
		it("addFrame with Matrix3d translation shifts the AABB", () => {
			const m = new Matrix3d();
			m.translate(40, 30);
			const b = new Bounds();
			b.addFrame(10, 50, 110, 250, m);
			expect(b.x).toBeCloseTo(50, 5);
			expect(b.y).toBeCloseTo(80, 5);
			expect(b.width).toBeCloseTo(100, 5);
			expect(b.height).toBeCloseTo(200, 5);
		});
		it("addFrame with Matrix3d non-uniform scale stretches the AABB", () => {
			const m = new Matrix3d();
			m.scale(2, 3);
			const b = new Bounds();
			b.addFrame(10, 50, 110, 250, m);
			expect(b.x).toBeCloseTo(20, 5);
			expect(b.y).toBeCloseTo(150, 5);
			expect(b.width).toBeCloseTo(200, 5);
			expect(b.height).toBeCloseTo(600, 5);
		});
		it("addFrame with Matrix3d 45° rotation produces the rotated-rect AABB", () => {
			const m = new Matrix3d();
			m.rotate(math.degToRad(45));
			const b = new Bounds();
			// 100×100 rect at origin, rotated 45° → AABB side ≈ 100·√2.
			b.addFrame(0, 0, 100, 100, m);
			expect(b.width).toBeCloseTo(Math.SQRT2 * 100, 5);
			expect(b.height).toBeCloseTo(Math.SQRT2 * 100, 5);
		});
		it("addFrame with Matrix3d composed translate + scale + rotate matches manual application", () => {
			const m = new Matrix3d();
			m.translate(50, 30);
			m.rotate(math.degToRad(45));
			m.scale(2, 1);
			const b = new Bounds();
			b.addFrame(0, 0, 100, 100, m);
			// Reproduce the expected AABB by manually applying the same
			// matrix to the four corners and taking min/max — this is the
			// exact same path `WebGLRenderer.clipRect` walks.
			const corners = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 0, y: 100 },
				{ x: 100, y: 100 },
			];
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;
			for (const c of corners) {
				m.apply(c);
				if (c.x < minX) {
					minX = c.x;
				}
				if (c.x > maxX) {
					maxX = c.x;
				}
				if (c.y < minY) {
					minY = c.y;
				}
				if (c.y > maxY) {
					maxY = c.y;
				}
			}
			expect(b.x).toBeCloseTo(minX, 5);
			expect(b.y).toBeCloseTo(minY, 5);
			expect(b.width).toBeCloseTo(maxX - minX, 5);
			expect(b.height).toBeCloseTo(maxY - minY, 5);
		});
	});
	describe("setMinMax", () => {
		it("should set bounds from explicit min/max values", () => {
			const b = new Bounds();
			b.setMinMax(10, 20, 110, 220);
			expect(b.left).toEqual(10);
			expect(b.top).toEqual(20);
			expect(b.right).toEqual(110);
			expect(b.bottom).toEqual(220);
			expect(b.width).toEqual(100);
			expect(b.height).toEqual(200);
		});

		it("should update an existing bounds", () => {
			const b = new Bounds();
			b.setMinMax(0, 0, 50, 50);
			expect(b.width).toEqual(50);
			b.setMinMax(100, 200, 400, 600);
			expect(b.left).toEqual(100);
			expect(b.top).toEqual(200);
			expect(b.width).toEqual(300);
			expect(b.height).toEqual(400);
		});

		it("should report as finite", () => {
			const b = new Bounds();
			expect(b.isFinite()).toEqual(false);
			b.setMinMax(0, 0, 100, 100);
			expect(b.isFinite()).toEqual(true);
		});

		it("should support overlaps check after setMinMax", () => {
			const a = new Bounds();
			const b = new Bounds();
			a.setMinMax(0, 0, 100, 100);
			b.setMinMax(50, 50, 150, 150);
			expect(a.overlaps(b)).toEqual(true);
			b.setMinMax(200, 200, 300, 300);
			expect(a.overlaps(b)).toEqual(false);
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
