import { beforeAll, describe, expect, it } from "vitest";
import { Bounds, Ellipse } from "../src";

describe("Shape : Ellipse", () => {
	describe("Ellipse ", () => {
		let circle: Ellipse;

		beforeAll(() => {
			circle = new Ellipse(50, 50, 100, 100);
		});

		it("Ellipse max radius is 50", () => {
			expect(circle.radius).toEqual(50);
		});

		it("Ellipse x radius is 50", () => {
			expect(circle.radiusV.x).toEqual(50);
		});

		it("Ellipse y radius is 50", () => {
			expect(circle.radiusV.y).toEqual(50);
		});

		it("Ellipse pos is (50, 50)", () => {
			expect(circle.pos.x).toEqual(50);
			expect(circle.pos.y).toEqual(50);
		});

		it("Ellipse contains the point (75, 75)", () => {
			expect(circle.contains(75, 75)).toEqual(true);
		});

		it("Ellipse does not contains the point (75, 500)", () => {
			expect(circle.contains(75, 500)).toEqual(false);
		});

		// it("collision response is correct", function () {
		// 	expect(
		// 		testEllipseEllipse(
		// 			circleA,
		// 			circle,
		// 			circleB,
		// 			circle,
		// 			collision.response.clear(),
		// 		),
		// 	).toEqual(true);
		// 	expect(me.collision.response.overlap).toEqual(50);
		// });
	});

	describe("Ellipse Bounding Rect", () => {
		let circle: Ellipse;
		let bounds: Bounds;

		beforeAll(() => {
			circle = new Ellipse(50, 50, 100, 100);
			// get the bounding rect
			bounds = circle.getBounds();
		});

		it("Ellipse Bounding Rect width is 100", () => {
			expect(bounds.width).toEqual(100);
		});

		it("Ellipse Bounding Rect height is 100", () => {
			expect(bounds.height).toEqual(100);
		});

		it("Ellipse Bounding Rect pos is (0,0)", () => {
			expect(bounds.x).toEqual(0);
			expect(bounds.y).toEqual(0);
		});
	});
});
