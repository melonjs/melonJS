import { Polygon, Vector2d } from "../src/index.js";
import { beforeAll, describe, expect, it } from "vitest";

describe("Shape : Polygon", () => {
	describe("Polygon", () => {
		let stars;
		let bounds;

		beforeAll(() => {
			// define a polygon object (star from the the shape example)
			stars = new Polygon(0, 0, [
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
			]);

			// get the polygon bounding rect
			bounds = stars.getBounds();
		});

		it("shift and translate stars", () => {
			expect(stars.pos.x).toEqual(0);
			expect(stars.pos.y).toEqual(0);
			stars.shift(10, 20);
			expect(stars.pos.x).toEqual(10);
			expect(stars.pos.y).toEqual(20);
			// default bounds pos is -94, 0
			expect(stars.getBounds().x).toEqual(-84);
			expect(stars.getBounds().y).toEqual(20);
			stars.translate(10, 10);
			expect(stars.pos.x).toEqual(20);
			expect(stars.pos.y).toEqual(30);
			expect(stars.getBounds().x).toEqual(-74);
			expect(stars.getBounds().y).toEqual(30);
			stars.shift(100, 100);
			expect(stars.pos.x).toEqual(100);
			expect(stars.pos.y).toEqual(100);
			stars.translate(-50, -50);
			expect(stars.pos.x).toEqual(50);
			expect(stars.pos.y).toEqual(50);
			stars.shift(0, 0);
			expect(stars.pos.x).toEqual(0);
			expect(stars.pos.y).toEqual(0);
			expect(stars.getBounds().x).toEqual(-94);
			expect(stars.getBounds().y).toEqual(0);
		});

		it("requires at least 3 points", () => {
			expect(() => {
				return new Polygon(0, 0, [
					{ x: 0, y: 0 },
					{ x: 28, y: 60 },
				]);
			}).toThrow();
		});

		it("contains the point (75, 75)", () => {
			expect(stars.contains(75, 75)).toEqual(true);
		});

		it("does not contains the point (75, 500)", () => {
			expect(stars.contains(75, 500)).toEqual(false);
		});

		it("width is 188", () => {
			expect(bounds.width).toEqual(188);
		});

		it("height is 180", () => {
			expect(bounds.height).toEqual(180);
		});

		it("pos is (-94,0)", () => {
			expect(bounds.x).toEqual(-94);
			expect(bounds.y).toEqual(0);
		});
	});

	describe("Polygon transformation", () => {
		let rect;

		beforeAll(() => {
			// a "rectangle" polygon object
			rect = new Polygon(0, 0, [
				// draw a square
				{ x: 0, y: 0 },
				{ x: 32, y: 0 },
				{ x: 32, y: 32 },
				{ x: 0, y: 32 },
			]);
		});

		it("Bounds should be updated when scaled or rotated", () => {
			// scale the polygon and rotate it by 45deg
			rect.scale(2.0).rotate(Math.PI / 4);
			expect(Math.floor(rect.getBounds().width)).toEqual(90);
			expect(Math.floor(rect.getBounds().height)).toEqual(90);
		});
	});

	describe("Isometric transformation", () => {
		let shape;

		beforeAll(() => {
			shape = new Polygon(0, 0, [
				// draw a square
				new Vector2d(0, 0),
				new Vector2d(32, 0),
				new Vector2d(32, 32),
				new Vector2d(0, 32),
			]);
		});

		it("shape should have an isometric diamond shape", () => {
			shape.toIso();
			// test a few points
			expect(shape.points[1].y).toBeCloseTo(16, 3);
			expect(shape.points[3].x).toBeCloseTo(-32, 3);
			expect(shape.points[3].y).toBeCloseTo(16, 3);

			// convert it back
			shape.to2d();
			expect(shape.points[1].y).toBeCloseTo(0, 3);
			expect(shape.points[3].x).toBeCloseTo(0, 3);
			expect(shape.points[3].y).toBeCloseTo(32, 3);
		});
	});
});
