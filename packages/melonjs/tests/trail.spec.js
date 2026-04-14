import { describe, expect, it } from "vitest";
import { Color } from "../src/index.js";
import Trail from "../src/renderable/trail.js";

describe("Trail", () => {
	describe("constructor defaults", () => {
		it("creates a trail with default options", () => {
			const trail = new Trail();
			expect(trail.maxPoints).toBe(20);
			expect(trail.lifetime).toBe(500);
			expect(trail.minDistance).toBe(4);
			expect(trail.width).toBe(10);
			expect(trail.target).toBeNull();
			expect(trail.widthCurve).toEqual([1, 0]);
			trail.destroy();
		});

		it("accepts custom options", () => {
			const trail = new Trail({
				length: 50,
				lifetime: 1000,
				minDistance: 10,
				width: 30,
				widthCurve: [1, 0.5, 0],
				opacity: 0.5,
			});
			expect(trail.maxPoints).toBe(50);
			expect(trail.lifetime).toBe(1000);
			expect(trail.minDistance).toBe(10);
			expect(trail.width).toBe(30);
			expect(trail.widthCurve).toEqual([1, 0.5, 0]);
			expect(trail.getOpacity()).toBeCloseTo(0.5, 5);
			trail.destroy();
		});
	});

	describe("gradient construction", () => {
		it("builds default white-to-transparent gradient with no color options", () => {
			const trail = new Trail();
			const out = new Color();
			trail._gradient.getColorAt(0, out);
			expect(out.r).toBe(255);
			expect(out.g).toBe(255);
			expect(out.b).toBe(255);
			expect(out.alpha).toBe(1);
			trail._gradient.getColorAt(1, out);
			expect(out.alpha).toBeCloseTo(0, 1);
			trail.destroy();
		});

		it("builds gradient from a single color string", () => {
			const trail = new Trail({ color: "#ff0000" });
			const out = new Color();
			trail._gradient.getColorAt(0, out);
			expect(out.r).toBe(255);
			expect(out.alpha).toBe(1);
			trail._gradient.getColorAt(1, out);
			expect(out.r).toBe(255);
			expect(out.alpha).toBeCloseTo(0, 1);
			trail.destroy();
		});

		it("builds gradient from gradient array", () => {
			const trail = new Trail({
				gradient: ["#ff0000", "#00ff00", "#0000ff"],
			});
			const out = new Color();
			trail._gradient.getColorAt(0, out);
			expect(out.r).toBe(255);
			trail._gradient.getColorAt(0.5, out);
			expect(out.g).toBe(255);
			trail._gradient.getColorAt(1, out);
			expect(out.b).toBe(255);
			trail.destroy();
		});

		it("gradient overrides color when both provided", () => {
			const trail = new Trail({
				color: "#ff0000",
				gradient: ["#00ff00", "#0000ff"],
			});
			const out = new Color();
			trail._gradient.getColorAt(0, out);
			expect(out.g).toBe(255);
			trail.destroy();
		});

		it("supports positioned stops", () => {
			const trail = new Trail({
				gradient: [
					{ pos: 0, color: "#ff0000" },
					{ pos: 0.3, color: "#00ff00" },
					{ pos: 1, color: "#0000ff" },
				],
			});
			const out = new Color();
			trail._gradient.getColorAt(0.3, out);
			expect(out.g).toBe(255);
			trail.destroy();
		});
	});

	describe("addPoint", () => {
		it("adds a point to the trail", () => {
			const trail = new Trail();
			trail.addPoint(10, 20);
			expect(trail._points.length).toBe(1);
			expect(trail._points[0].x).toBe(10);
			expect(trail._points[0].y).toBe(20);
			expect(trail._points[0].age).toBe(0);
			trail.destroy();
		});

		it("skips points closer than minDistance", () => {
			const trail = new Trail({ minDistance: 10 });
			trail.addPoint(0, 0);
			trail.addPoint(3, 3); // distance ~4.24, less than 10
			expect(trail._points.length).toBe(1);
			trail.destroy();
		});

		it("adds points farther than minDistance", () => {
			const trail = new Trail({ minDistance: 5 });
			trail.addPoint(0, 0);
			trail.addPoint(10, 0); // distance 10 > 5
			expect(trail._points.length).toBe(2);
			trail.destroy();
		});

		it("trims oldest points when exceeding maxPoints", () => {
			const trail = new Trail({ length: 3, minDistance: 0 });
			trail.addPoint(0, 0);
			trail.addPoint(10, 0);
			trail.addPoint(20, 0);
			trail.addPoint(30, 0); // should trim first point
			expect(trail._points.length).toBe(3);
			expect(trail._points[0].x).toBe(10);
			expect(trail._points[2].x).toBe(30);
			trail.destroy();
		});
	});

	describe("update", () => {
		it("ages points by dt", () => {
			const trail = new Trail({ minDistance: 0 });
			trail.addPoint(0, 0);
			trail.addPoint(10, 0);
			trail.update(100);
			expect(trail._points[0].age).toBe(100);
			expect(trail._points[1].age).toBe(100);
			trail.destroy();
		});

		it("removes points that exceed lifetime", () => {
			const trail = new Trail({ lifetime: 200, minDistance: 0 });
			trail.addPoint(0, 0);
			trail.addPoint(10, 0);
			trail._points[0].age = 150;
			trail.update(100); // point 0 age becomes 250 >= 200
			expect(trail._points.length).toBe(1);
			expect(trail._points[0].x).toBe(10);
			trail.destroy();
		});

		it("adds point from target on update", () => {
			const target = { x: 50, y: 60 };
			const trail = new Trail({ target });
			trail.update(16);
			expect(trail._points.length).toBe(1);
			expect(trail._points[0].x).toBe(50);
			expect(trail._points[0].y).toBe(60);
			trail.destroy();
		});

		it("reads target.pos when target has a pos property", () => {
			const target = { pos: { x: 100, y: 200 } };
			const trail = new Trail({ target });
			trail.update(16);
			expect(trail._points[0].x).toBe(100);
			expect(trail._points[0].y).toBe(200);
			trail.destroy();
		});

		it("sets isDirty and inViewport when points >= 2", () => {
			const trail = new Trail({ minDistance: 0 });
			trail.addPoint(0, 0);
			trail.addPoint(10, 0);
			trail.update(16);
			expect(trail.isDirty).toBe(true);
			expect(trail.inViewport).toBe(true);
			trail.destroy();
		});

		it("clears isDirty and inViewport when points < 2", () => {
			const trail = new Trail({ minDistance: 0 });
			trail.addPoint(0, 0);
			trail.update(16);
			expect(trail.inViewport).toBe(false);
			trail.destroy();
		});
	});

	describe("clear", () => {
		it("removes all points", () => {
			const trail = new Trail({ minDistance: 0 });
			trail.addPoint(0, 0);
			trail.addPoint(10, 0);
			trail.addPoint(20, 0);
			trail.clear();
			expect(trail._points.length).toBe(0);
			trail.destroy();
		});
	});

	describe("destroy", () => {
		it("clears points and nullifies target", () => {
			const target = { x: 0, y: 0 };
			const trail = new Trail({ target });
			trail.addPoint(0, 0);
			trail.destroy();
			expect(trail._points.length).toBe(0);
			expect(trail.target).toBeNull();
		});
	});
});
