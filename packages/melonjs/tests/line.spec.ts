import { beforeAll, describe, expect, it } from "vitest";
import { Bounds, Line } from "../src/index.js";

describe("Shape : Line", () => {
	describe("Line", () => {
		let line: Line;
		let bounds: Bounds;

		beforeAll(() => {
			line = new Line(0, 0, [
				{ x: 0, y: 0 },
				{ x: 28, y: 60 },
			]);
			bounds = line.getBounds();
		});

		it("requires exactly 2 points", () => {
			expect(() => {
				// @ts-expect-error
				return new Line(0, 0, [{ x: 0, y: 0 }]);
			}).toThrow();
			expect(() => {
				return new Line(0, 0, [
					{ x: 0, y: 0 },
					{ x: 0, y: 0 },
					{ x: 28, y: 60 },
				]);
			}).toThrow();
		});

		it("contains the point (0, 0)", () => {
			expect(line.contains(0, 0)).toEqual(true);
		});

		it("contains the point (14, 30)", () => {
			expect(line.contains(14, 30)).toEqual(true);
		});

		it("contains the point (60, -28) after rotating the line by -90 degrees", () => {
			line.rotate(-Math.PI / 2);
			expect(line.points[1].x).toBeCloseTo(60, 3);
			// value is 27.99999996 after rotation
			expect(line.points[1].y).toBeCloseTo(-28, 3);
		});

		it("does not contain the point (60, 28) after rotating back", () => {
			line.rotate(Math.PI / 2);
			expect(line.contains(60, 28)).toEqual(false);
		});

		it("contains the point (28, 60)", () => {
			expect(line.contains(28, 60)).toEqual(true);
		});

		it("does not contain the point (15, 30)", () => {
			expect(line.contains(15, 30)).toEqual(false);
		});

		it("does not contain the point (29, 61)", () => {
			expect(line.contains(29, 61)).toEqual(false);
		});

		it("Line Bounding Rect width is 28", () => {
			expect(bounds.width).toEqual(28);
		});

		it("Line Bounding Rect height is 60", () => {
			expect(bounds.height).toEqual(60);
		});

		it("Line bounding rect contains the point (28, 60)", () => {
			expect(bounds.contains(28, 60)).toEqual(true);
		});

		it("Line Bounding Rect pos is (0,0)", () => {
			expect(bounds.x).toEqual(0);
			expect(bounds.y).toEqual(0);
		});

		it("Line cloning", () => {
			const clone = line.clone();
			const cloneBounds = clone.getBounds();
			expect(line.pos.equals(clone.pos)).toEqual(true);
			expect(bounds.width).toEqual(cloneBounds.width);
			expect(bounds.height).toEqual(cloneBounds.height);
		});
	});
});
