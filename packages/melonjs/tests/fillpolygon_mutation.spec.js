import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Ellipse,
	Polygon,
	Rect,
	RoundRect,
	video,
} from "../src/index.js";

/**
 * Regression test: drawing methods must not mutate input shape geometry.
 *
 * The WebGL primitive compositor transforms vertices before pushing to the
 * GPU buffer. A previous bug used viewMatrix.apply(vert) which mutated
 * vert.x/vert.y in place, permanently corrupting polygon geometry.
 * The fix inlines the transform math using local variables.
 *
 * These tests verify that every drawing method preserves its input shapes.
 */
describe("Drawing methods should not mutate input shapes", () => {
	let renderer;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		renderer = video.renderer;
	});

	afterAll(() => {
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	// ---- Polygon ----

	it("fill(polygon) should preserve polygon points", () => {
		const poly = new Polygon(100, 50, [
			{ x: 0, y: 0 },
			{ x: 40, y: 0 },
			{ x: 40, y: 40 },
			{ x: 0, y: 40 },
		]);

		const before = poly.points.map((p) => {
			return { x: p.x, y: p.y };
		});

		renderer.setColor("#ff0000");
		renderer.fill(poly);
		renderer.fill(poly);

		for (let i = 0; i < poly.points.length; i++) {
			expect(poly.points[i].x).toBeCloseTo(before[i].x, 5);
			expect(poly.points[i].y).toBeCloseTo(before[i].y, 5);
		}
	});

	it("stroke(polygon) should preserve polygon points", () => {
		const poly = new Polygon(200, 100, [
			{ x: 0, y: 0 },
			{ x: 60, y: 0 },
			{ x: 30, y: 50 },
		]);

		const before = poly.points.map((p) => {
			return { x: p.x, y: p.y };
		});

		renderer.setColor("#00ff00");
		renderer.stroke(poly);
		renderer.stroke(poly);

		for (let i = 0; i < poly.points.length; i++) {
			expect(poly.points[i].x).toBeCloseTo(before[i].x, 5);
			expect(poly.points[i].y).toBeCloseTo(before[i].y, 5);
		}
	});

	it("fill(polygon) should preserve pos", () => {
		const poly = new Polygon(150, 75, [
			{ x: 0, y: 0 },
			{ x: 30, y: 0 },
			{ x: 30, y: 30 },
			{ x: 0, y: 30 },
		]);

		const posBefore = { x: poly.pos.x, y: poly.pos.y };

		renderer.setColor("#0000ff");
		renderer.fill(poly);
		renderer.fill(poly);

		expect(poly.pos.x).toBeCloseTo(posBefore.x, 5);
		expect(poly.pos.y).toBeCloseTo(posBefore.y, 5);
	});

	// ---- Rect ----

	it("fill(rect) should preserve rect geometry", () => {
		const rect = new Rect(50, 60, 120, 80);

		const before = {
			x: rect.pos.x,
			y: rect.pos.y,
			width: rect.width,
			height: rect.height,
		};

		renderer.setColor("#ff0000");
		renderer.fill(rect);
		renderer.fill(rect);

		expect(rect.pos.x).toBeCloseTo(before.x, 5);
		expect(rect.pos.y).toBeCloseTo(before.y, 5);
		expect(rect.width).toBeCloseTo(before.width, 5);
		expect(rect.height).toBeCloseTo(before.height, 5);
	});

	it("stroke(rect) should preserve rect geometry", () => {
		const rect = new Rect(70, 80, 100, 60);

		const before = {
			x: rect.pos.x,
			y: rect.pos.y,
			width: rect.width,
			height: rect.height,
		};

		renderer.setColor("#00ff00");
		renderer.stroke(rect);
		renderer.stroke(rect);

		expect(rect.pos.x).toBeCloseTo(before.x, 5);
		expect(rect.pos.y).toBeCloseTo(before.y, 5);
		expect(rect.width).toBeCloseTo(before.width, 5);
		expect(rect.height).toBeCloseTo(before.height, 5);
	});

	// ---- RoundRect ----

	it("fill(roundRect) should preserve roundRect geometry", () => {
		const rrect = new RoundRect(100, 200, 150, 100, 10);

		const before = {
			x: rrect.pos.x,
			y: rrect.pos.y,
			width: rrect.width,
			height: rrect.height,
			radius: rrect.radius,
		};

		renderer.setColor("#ff00ff");
		renderer.fill(rrect);
		renderer.fill(rrect);

		expect(rrect.pos.x).toBeCloseTo(before.x, 5);
		expect(rrect.pos.y).toBeCloseTo(before.y, 5);
		expect(rrect.width).toBeCloseTo(before.width, 5);
		expect(rrect.height).toBeCloseTo(before.height, 5);
		expect(rrect.radius).toBeCloseTo(before.radius, 5);
	});

	it("stroke(roundRect) should preserve roundRect geometry", () => {
		const rrect = new RoundRect(110, 210, 140, 90, 8);

		const before = {
			x: rrect.pos.x,
			y: rrect.pos.y,
			width: rrect.width,
			height: rrect.height,
			radius: rrect.radius,
		};

		renderer.setColor("#ff8800");
		renderer.stroke(rrect);
		renderer.stroke(rrect);

		expect(rrect.pos.x).toBeCloseTo(before.x, 5);
		expect(rrect.pos.y).toBeCloseTo(before.y, 5);
		expect(rrect.width).toBeCloseTo(before.width, 5);
		expect(rrect.height).toBeCloseTo(before.height, 5);
		expect(rrect.radius).toBeCloseTo(before.radius, 5);
	});

	// ---- Ellipse ----

	it("fill(ellipse) should preserve ellipse geometry", () => {
		const ellipse = new Ellipse(300, 200, 80, 60);

		const before = {
			x: ellipse.pos.x,
			y: ellipse.pos.y,
			rx: ellipse.radiusV.x,
			ry: ellipse.radiusV.y,
		};

		renderer.setColor("#00ffff");
		renderer.fill(ellipse);
		renderer.fill(ellipse);

		expect(ellipse.pos.x).toBeCloseTo(before.x, 5);
		expect(ellipse.pos.y).toBeCloseTo(before.y, 5);
		expect(ellipse.radiusV.x).toBeCloseTo(before.rx, 5);
		expect(ellipse.radiusV.y).toBeCloseTo(before.ry, 5);
	});

	it("stroke(ellipse) should preserve ellipse geometry", () => {
		const ellipse = new Ellipse(350, 250, 70, 50);

		const before = {
			x: ellipse.pos.x,
			y: ellipse.pos.y,
			rx: ellipse.radiusV.x,
			ry: ellipse.radiusV.y,
		};

		renderer.setColor("#ffff00");
		renderer.stroke(ellipse);
		renderer.stroke(ellipse);

		expect(ellipse.pos.x).toBeCloseTo(before.x, 5);
		expect(ellipse.pos.y).toBeCloseTo(before.y, 5);
		expect(ellipse.radiusV.x).toBeCloseTo(before.rx, 5);
		expect(ellipse.radiusV.y).toBeCloseTo(before.ry, 5);
	});

	// ---- Path-based drawing (moveTo/lineTo/stroke) ----

	it("path stroke should not corrupt subsequent polygon fill", () => {
		// draw a path first, then a polygon — the polygon should be unaffected
		renderer.beginPath();
		renderer.setColor("blue");
		renderer.moveTo(100, 100);
		renderer.lineTo(200, 200);
		renderer.lineTo(100, 300);
		renderer.stroke();

		const poly = new Polygon(50, 50, [
			{ x: 0, y: 0 },
			{ x: 80, y: 0 },
			{ x: 80, y: 80 },
			{ x: 0, y: 80 },
		]);

		const before = poly.points.map((p) => {
			return { x: p.x, y: p.y };
		});

		renderer.setColor("#ff0000");
		renderer.fill(poly);

		for (let i = 0; i < poly.points.length; i++) {
			expect(poly.points[i].x).toBeCloseTo(before[i].x, 5);
			expect(poly.points[i].y).toBeCloseTo(before[i].y, 5);
		}
	});

	// ---- Thick lines (lineWidth > 1 triggers #expandLinesToTriangles) ----

	it("stroke(polygon) with thick lineWidth should preserve polygon points", () => {
		const poly = new Polygon(200, 150, [
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 50, y: 50 },
			{ x: 0, y: 50 },
		]);

		const before = poly.points.map((p) => {
			return { x: p.x, y: p.y };
		});

		renderer.lineWidth = 5;
		renderer.setColor("#ff0000");
		renderer.stroke(poly);
		renderer.stroke(poly);
		renderer.lineWidth = 1;

		for (let i = 0; i < poly.points.length; i++) {
			expect(poly.points[i].x).toBeCloseTo(before[i].x, 5);
			expect(poly.points[i].y).toBeCloseTo(before[i].y, 5);
		}
	});

	it("stroke(rect) with thick lineWidth should preserve rect geometry", () => {
		const rect = new Rect(80, 90, 100, 70);

		const before = {
			x: rect.pos.x,
			y: rect.pos.y,
			width: rect.width,
			height: rect.height,
		};

		renderer.lineWidth = 4;
		renderer.setColor("#00ff00");
		renderer.stroke(rect);
		renderer.stroke(rect);
		renderer.lineWidth = 1;

		expect(rect.pos.x).toBeCloseTo(before.x, 5);
		expect(rect.pos.y).toBeCloseTo(before.y, 5);
		expect(rect.width).toBeCloseTo(before.width, 5);
		expect(rect.height).toBeCloseTo(before.height, 5);
	});

	// ---- Multiple draws (simulates multi-frame rendering) ----

	it("polygon should survive 10 consecutive fill() calls", () => {
		const poly = new Polygon(300, 200, [
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 100 },
			{ x: 50, y: 120 },
			{ x: 0, y: 100 },
		]);

		const before = poly.points.map((p) => {
			return { x: p.x, y: p.y };
		});

		renderer.setColor("#ff0000");
		for (let frame = 0; frame < 10; frame++) {
			renderer.fill(poly);
		}

		for (let i = 0; i < poly.points.length; i++) {
			expect(poly.points[i].x).toBeCloseTo(before[i].x, 5);
			expect(poly.points[i].y).toBeCloseTo(before[i].y, 5);
		}
	});
});
