import { beforeEach, describe, expect, it } from "vitest";
import Path2D from "../src/geometries/path2d.js";

describe("Path2D", () => {
	let path;

	beforeEach(() => {
		path = new Path2D();
	});

	describe("parseSVGPath", () => {
		it("should parse M and L commands into points", () => {
			path.parseSVGPath("M 10 20 L 30 40 L 50 60");
			// each lineTo pushes a "from" and "to" point: 2 calls = 4 points
			expect(path.points.length).toBe(4);
			// first lineTo: from (10,20) to (30,40)
			expect(path.points[0].x).toBe(10);
			expect(path.points[0].y).toBe(20);
			expect(path.points[1].x).toBe(30);
			expect(path.points[1].y).toBe(40);
			// second lineTo: from (30,40) to (50,60)
			expect(path.points[2].x).toBe(30);
			expect(path.points[2].y).toBe(40);
			expect(path.points[3].x).toBe(50);
			expect(path.points[3].y).toBe(60);
		});

		it("should parse Z command and close the path", () => {
			path.parseSVGPath("M 0 0 L 100 0 L 100 100 Z");
			const last = path.points[path.points.length - 1];
			// Z should add a point back to the start
			expect(last.x).toBe(0);
			expect(last.y).toBe(0);
		});

		it("should parse H command as horizontal line", () => {
			path.parseSVGPath("M 10 20 H 50");
			// H 50 means move x by 50 from current position
			expect(path.points.length).toBeGreaterThanOrEqual(2);
			expect(path.points[1].x).toBe(60);
			expect(path.points[1].y).toBe(20);
		});

		it("should parse V command as vertical line", () => {
			path.parseSVGPath("M 10 20 V 30");
			expect(path.points.length).toBeGreaterThanOrEqual(2);
			expect(path.points[1].x).toBe(10);
			expect(path.points[1].y).toBe(50);
		});

		it("should parse Q command and generate interpolated points", () => {
			path.parseSVGPath("M 0 0 Q 50 50 100 0");
			// quadratic curve should generate multiple interpolated points
			expect(path.points.length).toBeGreaterThan(2);
			// last point should be near the endpoint
			const last = path.points[path.points.length - 1];
			expect(last.x).toBeCloseTo(100, 0);
			expect(last.y).toBeCloseTo(0, 0);
		});

		it("should parse C command and generate interpolated points", () => {
			path.parseSVGPath("M 0 0 C 25 50 75 50 100 0");
			expect(path.points.length).toBeGreaterThan(2);
			const last = path.points[path.points.length - 1];
			expect(last.x).toBeCloseTo(100, 0);
			expect(last.y).toBeCloseTo(0, 0);
		});

		it("should clear previous points on each call", () => {
			path.parseSVGPath("M 0 0 L 10 10");
			const count1 = path.points.length;
			path.parseSVGPath("M 0 0 L 10 10 L 20 20 L 30 30");
			// should not accumulate — parseSVGPath calls beginPath internally
			expect(path.points.length).toBeGreaterThan(count1);
		});
	});

	describe("parseSVGPath A command (ticket #1198)", () => {
		it("should parse a simple arc and generate points", () => {
			path.parseSVGPath("M 0 50 A 50 50 0 0 1 100 50");
			// arc should generate interpolated points between start and endpoint
			expect(path.points.length).toBeGreaterThan(2);
		});

		it("should end at the SVG endpoint coordinates", () => {
			path.parseSVGPath("M 0 50 A 50 50 0 0 1 100 50");
			const last = path.points[path.points.length - 1];
			expect(last.x).toBeCloseTo(100, 0);
			expect(last.y).toBeCloseTo(50, 0);
		});

		it("should maintain path continuity (no gap between M and A)", () => {
			path.parseSVGPath("M 10 30 A 20 20 0 0 1 50 30");
			// first point should be the M point
			expect(path.points[0].x).toBe(10);
			expect(path.points[0].y).toBe(30);
			// subsequent arc points should flow continuously (no jump)
			for (let i = 1; i < path.points.length; i++) {
				const dx = path.points[i].x - path.points[i - 1].x;
				const dy = path.points[i].y - path.points[i - 1].y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				// no point should be wildly far from its predecessor
				expect(dist).toBeLessThan(20);
			}
		});

		it("should handle the heart path from ticket #1198", () => {
			path.parseSVGPath(
				"M 10 30 A 20 20 0 0 1 50 30 A 20 20 0 0 1 90 30 Q 90 60 50 90 Q 10 60 10 30 Z",
			);
			expect(path.points.length).toBeGreaterThan(10);
			// path should close back to start
			const last = path.points[path.points.length - 1];
			expect(last.x).toBeCloseTo(10, 0);
			expect(last.y).toBeCloseTo(30, 0);
		});

		it("should handle consecutive arcs without breaking path", () => {
			path.parseSVGPath("M 10 30 A 20 20 0 0 1 50 30 A 20 20 0 0 1 90 30");
			// should have points from M through first arc through second arc
			expect(path.points.length).toBeGreaterThan(5);
			const last = path.points[path.points.length - 1];
			expect(last.x).toBeCloseTo(90, 0);
			expect(last.y).toBeCloseTo(30, 0);
		});

		it("should handle large arc flag", () => {
			// large arc: sweeps > 180 degrees
			path.parseSVGPath("M 50 25 L 90 50 L 50 75 A 35 35 0 1 1 50 25 Z");
			expect(path.points.length).toBeGreaterThan(10);
		});

		it("should handle elliptical arcs (rx != ry)", () => {
			path.parseSVGPath("M 0 30 A 60 30 0 0 1 120 30");
			const last = path.points[path.points.length - 1];
			expect(last.x).toBeCloseTo(120, 0);
			expect(last.y).toBeCloseTo(30, 0);
		});

		it("should handle arcs mixed with other commands", () => {
			// pill/capsule: lines + arcs
			path.parseSVGPath(
				"M 25 0 L 75 0 A 25 25 0 0 1 75 50 L 25 50 A 25 25 0 0 1 25 0 Z",
			);
			expect(path.points.length).toBeGreaterThan(5);
			const last = path.points[path.points.length - 1];
			expect(last.x).toBeCloseTo(25, 0);
			expect(last.y).toBeCloseTo(0, 0);
		});
	});

	describe("beginPath", () => {
		it("should clear all points", () => {
			path.parseSVGPath("M 0 0 L 10 10 L 20 20");
			expect(path.points.length).toBeGreaterThan(0);
			path.beginPath();
			expect(path.points.length).toBe(0);
		});
	});

	describe("closePath", () => {
		it("should add a point back to the first point", () => {
			path.moveTo(10, 20);
			path.lineTo(50, 60);
			path.closePath();
			const last = path.points[path.points.length - 1];
			expect(last.x).toBe(10);
			expect(last.y).toBe(20);
		});

		it("should not add duplicate if already at start", () => {
			path.moveTo(10, 20);
			path.lineTo(50, 60);
			path.lineTo(10, 20);
			const countBefore = path.points.length;
			path.closePath();
			expect(path.points.length).toBe(countBefore);
		});
	});

	describe("triangulatePath", () => {
		it("should triangulate a simple triangle", () => {
			path.parseSVGPath("M 0 0 L 100 0 L 50 100 Z");
			const triangles = path.triangulatePath();
			// triangle = 3 vertices
			expect(triangles.length).toBe(3);
		});

		it("should triangulate a square into 2 triangles", () => {
			path.parseSVGPath("M 0 0 L 100 0 L 100 100 L 0 100 Z");
			const triangles = path.triangulatePath();
			// square = 2 triangles = 6 vertices
			// (earcut produces 4 unique points with 6 index entries -> 6 triangle verts)
			expect(triangles.length).toBe(6);
		});
	});
});
