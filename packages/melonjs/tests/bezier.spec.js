import { beforeAll, describe, expect, it } from "vitest";
import Path2D from "../src/geometries/path2d.js";
import { Application } from "../src/index.js";

describe("Bezier Curves", () => {
	let app;

	beforeAll(() => {
		app = new Application(128, 128, {
			parent: "screen",
			scale: "auto",
		});
	});

	describe("quadraticCurveTo", () => {
		it("should not throw when drawing a quadratic curve", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(10, 80);
				app.renderer.quadraticCurveTo(50, 10, 90, 80);
				app.renderer.stroke();
			}).not.toThrow();
		});

		it("should work with fill", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(10, 80);
				app.renderer.quadraticCurveTo(50, 10, 90, 80);
				app.renderer.lineTo(10, 80);
				app.renderer.fill();
			}).not.toThrow();
		});

		it("should work with closePath", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(10, 60);
				app.renderer.quadraticCurveTo(64, 10, 118, 60);
				app.renderer.closePath();
				app.renderer.stroke();
			}).not.toThrow();
		});
	});

	describe("bezierCurveTo", () => {
		it("should not throw when drawing a cubic bezier curve", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(10, 80);
				app.renderer.bezierCurveTo(30, 10, 70, 10, 90, 80);
				app.renderer.stroke();
			}).not.toThrow();
		});

		it("should work with fill", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(10, 80);
				app.renderer.bezierCurveTo(30, 10, 70, 10, 90, 80);
				app.renderer.lineTo(10, 80);
				app.renderer.fill();
			}).not.toThrow();
		});

		it("should work with closePath", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(10, 60);
				app.renderer.bezierCurveTo(30, 10, 98, 10, 118, 60);
				app.renderer.closePath();
				app.renderer.stroke();
			}).not.toThrow();
		});
	});

	describe("chaining with other path methods", () => {
		it("should chain lineTo and quadraticCurveTo", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(0, 64);
				app.renderer.lineTo(30, 64);
				app.renderer.quadraticCurveTo(64, 10, 98, 64);
				app.renderer.lineTo(128, 64);
				app.renderer.stroke();
			}).not.toThrow();
		});

		it("should chain lineTo and bezierCurveTo", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(0, 64);
				app.renderer.lineTo(20, 64);
				app.renderer.bezierCurveTo(40, 10, 80, 10, 100, 64);
				app.renderer.lineTo(128, 64);
				app.renderer.stroke();
			}).not.toThrow();
		});

		it("should chain multiple bezier curves", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(0, 64);
				app.renderer.bezierCurveTo(20, 10, 40, 10, 64, 64);
				app.renderer.bezierCurveTo(84, 118, 104, 118, 128, 64);
				app.renderer.stroke();
			}).not.toThrow();
		});

		it("should chain quadratic and cubic curves", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(0, 64);
				app.renderer.quadraticCurveTo(32, 10, 64, 64);
				app.renderer.bezierCurveTo(80, 100, 112, 100, 128, 64);
				app.renderer.stroke();
			}).not.toThrow();
		});
	});

	describe("with dashed lines", () => {
		it("should render dashed bezier curve", () => {
			expect(() => {
				app.renderer.setLineDash([8, 4]);
				app.renderer.beginPath();
				app.renderer.moveTo(10, 80);
				app.renderer.bezierCurveTo(30, 10, 70, 10, 90, 80);
				app.renderer.stroke();
				app.renderer.setLineDash([]);
			}).not.toThrow();
		});

		it("should render dashed quadratic curve", () => {
			expect(() => {
				app.renderer.setLineDash([5, 5]);
				app.renderer.beginPath();
				app.renderer.moveTo(10, 80);
				app.renderer.quadraticCurveTo(50, 10, 90, 80);
				app.renderer.stroke();
				app.renderer.setLineDash([]);
			}).not.toThrow();
		});
	});

	describe("with save/restore", () => {
		it("should work across save/restore boundaries", () => {
			expect(() => {
				app.renderer.save();
				app.renderer.beginPath();
				app.renderer.moveTo(10, 80);
				app.renderer.bezierCurveTo(30, 10, 70, 10, 90, 80);
				app.renderer.stroke();
				app.renderer.restore();
			}).not.toThrow();
		});
	});

	describe("arcTo", () => {
		it("should not throw when drawing an arcTo path", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(20, 20);
				app.renderer.arcTo(100, 20, 100, 100, 30);
				app.renderer.stroke();
			}).not.toThrow();
		});

		it("should work with lineTo and closePath", () => {
			expect(() => {
				app.renderer.beginPath();
				app.renderer.moveTo(20, 20);
				app.renderer.lineTo(80, 20);
				app.renderer.arcTo(120, 20, 120, 60, 20);
				app.renderer.lineTo(120, 100);
				app.renderer.closePath();
				app.renderer.stroke();
			}).not.toThrow();
		});
	});

	describe("Path2D tessellation correctness", () => {
		it("quadraticCurveTo should start from moveTo point", () => {
			const path = new Path2D();
			path.moveTo(0, 100);
			path.quadraticCurveTo(50, 0, 100, 100);
			const pts = path.points;
			// first point should be at or near (0, 100)
			expect(pts[0].x).toBeCloseTo(0, 0);
			expect(pts[0].y).toBeCloseTo(100, 0);
			// last point should be at (100, 100)
			expect(pts[pts.length - 1].x).toBeCloseTo(100, 0);
			expect(pts[pts.length - 1].y).toBeCloseTo(100, 0);
		});

		it("bezierCurveTo should start from moveTo point", () => {
			const path = new Path2D();
			path.moveTo(0, 100);
			path.bezierCurveTo(30, 0, 70, 0, 100, 100);
			const pts = path.points;
			// first point should be at or near (0, 100)
			expect(pts[0].x).toBeCloseTo(0, 0);
			expect(pts[0].y).toBeCloseTo(100, 0);
			// last point should be at (100, 100)
			expect(pts[pts.length - 1].x).toBeCloseTo(100, 0);
			expect(pts[pts.length - 1].y).toBeCloseTo(100, 0);
		});

		it("quadraticCurveTo should not deform (startPoint reference bug)", () => {
			const path = new Path2D();
			path.moveTo(0, 50);
			path.quadraticCurveTo(50, 0, 100, 50);
			const pts = path.points;
			// midpoint of quadratic from (0,50) cp(50,0) to (100,50)
			// at t=0.5: x = 0.25*0 + 0.5*50 + 0.25*100 = 50
			//           y = 0.25*50 + 0.5*0 + 0.25*50 = 25
			// find the point closest to t=0.5 and verify it curves upward
			const midIdx = Math.floor(pts.length / 2);
			expect(pts[midIdx].y).toBeLessThan(50); // should curve above the endpoints
		});

		it("bezierCurveTo should not deform (startPoint reference bug)", () => {
			const path = new Path2D();
			path.moveTo(0, 50);
			path.bezierCurveTo(25, 0, 75, 0, 100, 50);
			const pts = path.points;
			// midpoint should curve upward (y < 50)
			const midIdx = Math.floor(pts.length / 2);
			expect(pts[midIdx].y).toBeLessThan(50);
		});

		it("should generate more than 2 segments for long curves", () => {
			const path = new Path2D();
			path.moveTo(0, 0);
			path.bezierCurveTo(100, 0, 200, 100, 300, 100);
			// points come in pairs (start, end per segment)
			// should have many more than 4 points (which would be 2 segments)
			expect(path.points.length).toBeGreaterThan(8);
		});

		it("chained bezier curves should each start from previous endpoint", () => {
			const path = new Path2D();
			path.moveTo(0, 50);
			path.bezierCurveTo(25, 0, 75, 0, 100, 50);
			path.bezierCurveTo(125, 100, 175, 100, 200, 50);
			const pts = path.points;
			// last point should be at (200, 50)
			expect(pts[pts.length - 1].x).toBeCloseTo(200, 0);
			expect(pts[pts.length - 1].y).toBeCloseTo(50, 0);
		});

		it("chained quadratic curves should each start from previous endpoint", () => {
			const path = new Path2D();
			path.moveTo(0, 50);
			path.quadraticCurveTo(50, 0, 100, 50);
			path.quadraticCurveTo(150, 100, 200, 50);
			const pts = path.points;
			expect(pts[pts.length - 1].x).toBeCloseTo(200, 0);
			expect(pts[pts.length - 1].y).toBeCloseTo(50, 0);
		});

		it("lineTo after bezierCurveTo should start from curve endpoint", () => {
			const path = new Path2D();
			path.moveTo(0, 0);
			path.bezierCurveTo(30, 0, 70, 100, 100, 100);
			path.lineTo(200, 100);
			const pts = path.points;
			expect(pts[pts.length - 1].x).toEqual(200);
			expect(pts[pts.length - 1].y).toEqual(100);
			// second-to-last should be near (100, 100) — the lineTo start
			expect(pts[pts.length - 2].x).toBeCloseTo(100, 0);
			expect(pts[pts.length - 2].y).toBeCloseTo(100, 0);
		});

		it("bezierCurveTo after lineTo should start from line endpoint", () => {
			const path = new Path2D();
			path.moveTo(0, 0);
			path.lineTo(50, 0);
			path.bezierCurveTo(70, 0, 80, 50, 100, 50);
			const pts = path.points;
			// first two points are the lineTo segment
			expect(pts[0].x).toEqual(0);
			expect(pts[1].x).toEqual(50);
			// last point is bezier endpoint
			expect(pts[pts.length - 1].x).toBeCloseTo(100, 0);
			expect(pts[pts.length - 1].y).toBeCloseTo(50, 0);
		});

		it("quadraticCurveTo should generate enough segments for smooth curves", () => {
			const path = new Path2D();
			path.moveTo(0, 0);
			path.quadraticCurveTo(150, 0, 300, 100);
			// long curve should have many segments
			expect(path.points.length).toBeGreaterThan(8);
		});

		it("moveTo should reset path start for subsequent curves", () => {
			const path = new Path2D();
			path.moveTo(0, 0);
			path.lineTo(50, 50);
			path.moveTo(200, 200);
			path.quadraticCurveTo(250, 100, 300, 200);
			const pts = path.points;
			// first segment: lineTo (0,0)→(50,50)
			expect(pts[0].x).toEqual(0);
			expect(pts[1].x).toEqual(50);
			// quadratic should start from moveTo point (200, 200)
			expect(pts[2].x).toBeCloseTo(200, 0);
			expect(pts[2].y).toBeCloseTo(200, 0);
		});
	});
});
