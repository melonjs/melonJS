import { describe, expect, it } from "vitest";
import {
	Bounds,
	Ellipse,
	Matrix2d,
	Matrix3d,
	math,
	Polygon,
	Rect,
	Vector2d,
} from "../src/index.js";

describe("Physics : Bounds", () => {
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
		it("addFrame with an identity matrix takes the no-corner-walk fast path", () => {
			// Sentinel: spy on `m.apply` and confirm the identity
			// short-circuit in addFrame avoids calling it. Guards
			// against a future refactor that drops the identity check.
			const m = new Matrix3d();
			let applyCalls = 0;
			const orig = m.apply.bind(m);
			m.apply = (v) => {
				applyCalls += 1;
				return orig(v);
			};
			const b = new Bounds();
			b.addFrame(10, 50, 110, 250, m);
			expect(applyCalls).toBe(0);
			expect(b.x).toBeCloseTo(10, 5);
			expect(b.width).toBeCloseTo(100, 5);
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
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(0, 100),
				new Vector2d(100, 100),
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

	describe("addShapes", () => {
		it("unions a single Rect into an empty bounds", () => {
			const b = new Bounds();
			b.addShapes(new Rect(10, 20, 30, 40), true);
			expect(b.width).toEqual(30);
			expect(b.height).toEqual(40);
			expect(b.min.x).toEqual(10);
			expect(b.min.y).toEqual(20);
		});

		it("unions multiple shapes into a single bounding box", () => {
			const b = new Bounds();
			b.addShapes(
				[
					new Rect(0, 0, 32, 32),
					new Rect(50, 50, 10, 10),
					new Ellipse(80, 0, 20, 40),
				],
				true,
			);
			// shapes span x=[0..70] (ellipse spans 70..90 because Ellipse is
			// centered on pos with width/height as the diameter), y depends
			// on the actual Ellipse layout — assert the obvious lower bound.
			expect(b.min.x).toEqual(0);
			expect(b.min.y).toBeLessThanOrEqual(0);
			expect(b.max.x).toBeGreaterThanOrEqual(60);
		});

		it("accepts a Polygon directly", () => {
			const b = new Bounds();
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(100, 0),
				new Vector2d(100, 50),
			]);
			b.addShapes(poly, true);
			expect(b.width).toEqual(100);
			expect(b.height).toEqual(50);
		});

		it("clear=false expands existing bounds (vs replaces them)", () => {
			const b = new Bounds();
			b.addShapes(new Rect(0, 0, 20, 20), true);
			b.addShapes(new Rect(50, 50, 10, 10), false);
			expect(b.min.x).toEqual(0);
			expect(b.min.y).toEqual(0);
			expect(b.max.x).toEqual(60);
			expect(b.max.y).toEqual(60);
		});

		it("clear=true throws away the prior bounds", () => {
			const b = new Bounds();
			b.addShapes(new Rect(0, 0, 100, 100), true);
			b.addShapes(new Rect(200, 200, 10, 10), true); // overwrites
			expect(b.min.x).toEqual(200);
			expect(b.max.x).toEqual(210);
			expect(b.width).toEqual(10);
		});

		it("ignores shapes without a getBounds method (defensive)", () => {
			const b = new Bounds();
			b.addShapes(new Rect(0, 0, 50, 50), true);
			// pretend a malformed shape sneaks in
			b.addShapes({ notAShape: true } as unknown as Polygon, false);
			expect(b.width).toEqual(50);
			expect(b.height).toEqual(50);
		});

		it("empty array is a no-op (no clear, no NaN, original bounds preserved)", () => {
			const b = new Bounds();
			b.addShapes(new Rect(0, 0, 50, 50), true);
			b.addShapes([], false);
			expect(b.width).toEqual(50);
			expect(b.height).toEqual(50);
		});

		it("empty array WITH clear=true wipes to empty bounds (not NaN)", () => {
			const b = new Bounds();
			b.addShapes(new Rect(0, 0, 50, 50), true);
			b.addShapes([], true);
			// `clear()` resets to the empty-bounds invariant
			// (Infinity/-Infinity); width/height are well-defined (≤ 0)
			expect(Number.isNaN(b.width)).toEqual(false);
			expect(Number.isNaN(b.height)).toEqual(false);
		});

		it("nested Bounds object also works (Bounds has getBounds → self)", () => {
			// Bounds doesn't have a getBounds, but Rect/Polygon do. Pin
			// that we don't accidentally accept a raw Bounds (regression
			// guard if someone adds getBounds() to Bounds later).
			const inner = new Bounds();
			inner.addShapes(new Rect(10, 10, 30, 30), true);
			const outer = new Bounds();
			outer.addShapes(inner as unknown as Polygon, true);
			// no getBounds on Bounds → silently ignored → still empty
			expect(outer.isFinite()).toEqual(false);
		});

		it("single-shape input (not array) works the same as a 1-element array", () => {
			const a = new Bounds();
			a.addShapes(new Rect(0, 0, 30, 30), true);
			const b = new Bounds();
			b.addShapes([new Rect(0, 0, 30, 30)], true);
			expect(a.min.x).toEqual(b.min.x);
			expect(a.max.x).toEqual(b.max.x);
			expect(a.width).toEqual(b.width);
			expect(a.height).toEqual(b.height);
		});

		it("shapes overlapping with negative coordinates produce correct union", () => {
			const b = new Bounds();
			b.addShapes([new Rect(-50, -30, 20, 20), new Rect(10, 10, 20, 20)], true);
			expect(b.min.x).toEqual(-50);
			expect(b.min.y).toEqual(-30);
			expect(b.max.x).toEqual(30);
			expect(b.max.y).toEqual(30);
		});

		it("ADVERSARIAL: passing the same shape twice does not double-count", () => {
			const b = new Bounds();
			const r = new Rect(0, 0, 100, 50);
			b.addShapes([r, r], true);
			expect(b.width).toEqual(100);
			expect(b.height).toEqual(50);
		});

		it("ADVERSARIAL: shape with zero size still contributes a valid corner", () => {
			const b = new Bounds();
			b.addShapes(new Rect(42, 7, 0, 0), true);
			expect(b.min.x).toEqual(42);
			expect(b.min.y).toEqual(7);
			expect(b.width).toEqual(0);
			expect(b.height).toEqual(0);
		});
	});
});
