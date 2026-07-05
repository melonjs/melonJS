import { beforeEach, describe, expect, it, vi } from "vitest";
import Path2D from "../src/geometries/path2d.ts";

// barycentric point-in-triangle test against a flat triangle-vertex list, used
// to assert that holes are actually carved out of the triangulated fill
const pointInTriangulation = (vertices, px, py) => {
	const inTriangle = (a, b, c) => {
		const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
		if (d === 0) {
			return false;
		}
		const wa = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / d;
		const wb = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / d;
		const wc = 1 - wa - wb;
		return wa >= 0 && wb >= 0 && wc >= 0;
	};
	for (let i = 0; i < vertices.length; i += 3) {
		if (inTriangle(vertices[i], vertices[i + 1], vertices[i + 2])) {
			return true;
		}
	}
	return false;
};

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

	describe("moveTo", () => {
		it("should set startPoint without adding points", () => {
			path.moveTo(50, 75);
			expect(path.startPoint.x).toEqual(50);
			expect(path.startPoint.y).toEqual(75);
			expect(path.points.length).toEqual(0);
		});
	});

	describe("lineTo", () => {
		it("should add a pair of points from startPoint", () => {
			path.moveTo(0, 0);
			path.lineTo(100, 100);
			expect(path.points.length).toEqual(2);
			expect(path.points[0].x).toEqual(0);
			expect(path.points[1].x).toEqual(100);
		});

		it("should chain from previous endpoint", () => {
			path.moveTo(0, 0);
			path.lineTo(50, 50);
			path.lineTo(100, 0);
			expect(path.points.length).toEqual(4);
			expect(path.points[2].x).toEqual(50);
			expect(path.points[3].x).toEqual(100);
		});

		it("should update startPoint", () => {
			path.moveTo(0, 0);
			path.lineTo(100, 200);
			expect(path.startPoint.x).toEqual(100);
			expect(path.startPoint.y).toEqual(200);
		});
	});

	describe("quadraticCurveTo", () => {
		it("should start from moveTo point", () => {
			path.moveTo(0, 100);
			path.quadraticCurveTo(50, 0, 100, 100);
			expect(path.points[0].x).toBeCloseTo(0, 0);
			expect(path.points[0].y).toBeCloseTo(100, 0);
			expect(path.points[path.points.length - 1].x).toBeCloseTo(100, 0);
		});

		it("should not deform (startPoint reference bug)", () => {
			path.moveTo(0, 50);
			path.quadraticCurveTo(50, 0, 100, 50);
			const midIdx = Math.floor(path.points.length / 2);
			expect(path.points[midIdx].y).toBeLessThan(50);
		});

		it("should generate enough segments for long curves", () => {
			path.moveTo(0, 0);
			path.quadraticCurveTo(150, 0, 300, 100);
			expect(path.points.length).toBeGreaterThan(8);
		});
	});

	describe("bezierCurveTo", () => {
		it("should start from moveTo point", () => {
			path.moveTo(0, 100);
			path.bezierCurveTo(30, 0, 70, 0, 100, 100);
			expect(path.points[0].x).toBeCloseTo(0, 0);
			expect(path.points[path.points.length - 1].x).toBeCloseTo(100, 0);
		});

		it("should not deform (startPoint reference bug)", () => {
			path.moveTo(0, 50);
			path.bezierCurveTo(25, 0, 75, 0, 100, 50);
			const midIdx = Math.floor(path.points.length / 2);
			expect(path.points[midIdx].y).toBeLessThan(50);
		});

		it("should generate enough segments for long curves", () => {
			path.moveTo(0, 0);
			path.bezierCurveTo(100, 0, 200, 100, 300, 100);
			expect(path.points.length).toBeGreaterThan(8);
		});
	});

	describe("method chaining", () => {
		it("lineTo after bezierCurveTo should start from curve endpoint", () => {
			path.moveTo(0, 0);
			path.bezierCurveTo(30, 0, 70, 100, 100, 100);
			path.lineTo(200, 100);
			const pts = path.points;
			expect(pts[pts.length - 2].x).toBeCloseTo(100, 0);
			expect(pts[pts.length - 1].x).toEqual(200);
		});

		it("bezierCurveTo after lineTo should start from line endpoint", () => {
			path.moveTo(0, 0);
			path.lineTo(50, 0);
			path.bezierCurveTo(70, 0, 80, 50, 100, 50);
			expect(path.points[0].x).toEqual(0);
			expect(path.points[1].x).toEqual(50);
			expect(path.points[path.points.length - 1].x).toBeCloseTo(100, 0);
		});

		it("moveTo should reset start for subsequent curves", () => {
			path.moveTo(0, 0);
			path.lineTo(50, 50);
			path.moveTo(200, 200);
			path.quadraticCurveTo(250, 100, 300, 200);
			expect(path.points[0].x).toEqual(0);
			expect(path.points[1].x).toEqual(50);
			expect(path.points[2].x).toBeCloseTo(200, 0);
		});
	});

	describe("edge cases", () => {
		it("lineTo without prior moveTo should start from (0, 0)", () => {
			path.lineTo(100, 100);
			expect(path.points[0].x).toEqual(0);
			expect(path.points[0].y).toEqual(0);
		});

		it("lineTo with zero length should still add points", () => {
			path.moveTo(50, 50);
			path.lineTo(50, 50);
			expect(path.points.length).toEqual(2);
		});

		it("multiple moveTo calls should use the last one", () => {
			path.moveTo(10, 10);
			path.moveTo(20, 20);
			path.moveTo(30, 30);
			path.lineTo(100, 100);
			expect(path.points[0].x).toEqual(30);
			expect(path.points[0].y).toEqual(30);
		});

		it("closePath on empty path should not throw", () => {
			expect(() => {
				path.closePath();
			}).not.toThrow();
			expect(path.points.length).toEqual(0);
		});

		it("closePath with only moveTo should not add points", () => {
			path.moveTo(50, 50);
			path.closePath();
			expect(path.points.length).toEqual(0);
		});

		it("rect with zero dimensions should still create path", () => {
			path.rect(10, 20, 0, 0);
			// degenerate rect still creates 4 line segments (4 lineTo * 2 points each = 8)
			expect(path.points.length).toEqual(8);
		});

		it("bezierCurveTo without moveTo should start from (0, 0)", () => {
			path.bezierCurveTo(30, 0, 70, 0, 100, 50);
			expect(path.points[0].x).toBeCloseTo(0, 0);
			expect(path.points[0].y).toBeCloseTo(0, 0);
		});

		it("quadraticCurveTo without moveTo should start from (0, 0)", () => {
			path.quadraticCurveTo(50, 0, 100, 50);
			expect(path.points[0].x).toBeCloseTo(0, 0);
			expect(path.points[0].y).toBeCloseTo(0, 0);
		});
	});

	describe("beginPath", () => {
		it("should clear all points", () => {
			path.parseSVGPath("M 0 0 L 10 10 L 20 20");
			expect(path.points.length).toBeGreaterThan(0);
			path.beginPath();
			expect(path.points.length).toBe(0);
		});

		it("should reset startPoint to (0, 0)", () => {
			path.moveTo(50, 75);
			path.beginPath();
			expect(path.startPoint.x).toEqual(0);
			expect(path.startPoint.y).toEqual(0);
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

	describe("sub-paths and holes (ticket #1253)", () => {
		it("a single sub-path records no boundaries", () => {
			path.parseSVGPath("M 0 0 L 100 0 L 100 100 L 0 100 Z");
			expect(path.subPaths.length).toBe(0);
		});

		it("a second M records exactly one sub-path boundary", () => {
			path.parseSVGPath(
				"M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 75 25 L 75 75 L 25 75 Z",
			);
			expect(path.subPaths.length).toBe(1);
		});

		it("two extra M commands record two boundaries", () => {
			path.parseSVGPath(
				"M 0 0 L 10 0 L 10 10 Z M 20 20 L 30 20 L 30 30 Z M 40 40 L 50 40 L 50 50 Z",
			);
			expect(path.subPaths.length).toBe(2);
		});

		it("the boundary index points at the start of the new sub-path", () => {
			path.parseSVGPath("M 0 0 L 100 0 Z M 50 50 L 80 50");
			// outer sub-path: M 0 0 L 100 0 Z -> points [(0,0),(100,0),(100,0),(0,0)]
			expect(path.subPaths.length).toBe(1);
			const boundary = path.subPaths[0];
			// the point at the boundary index is the new sub-path's start (50,50)
			expect(path.points[boundary].x).toBe(50);
			expect(path.points[boundary].y).toBe(50);
		});

		it("triangulates a square-with-square-hole into a ring (8 triangles)", () => {
			// outer + inner square (the inner one is a hole). For a polygon with
			// holes earcut yields (n + 2h - 2) triangles; here n=8, h=1 -> 8.
			path.parseSVGPath(
				"M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 25 75 L 75 75 L 75 25 Z",
			);
			const triangles = path.triangulatePath();
			expect(triangles.length).toBe(24); // 8 triangles * 3 vertices
		});

		it("the hole leaves the interior uncovered", () => {
			path.parseSVGPath(
				"M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 25 75 L 75 75 L 75 25 Z",
			);
			const v = path.triangulatePath();
			// centre (50,50) is inside the hole -> not covered
			expect(pointInTriangulation(v, 50, 50)).toBe(false);
			// a point in the ring (10,50) -> covered
			expect(pointInTriangulation(v, 10, 50)).toBe(true);
		});

		it("beginPath clears recorded sub-paths", () => {
			path.parseSVGPath("M 0 0 L 10 0 Z M 5 5 L 8 5");
			expect(path.subPaths.length).toBeGreaterThan(0);
			path.beginPath();
			expect(path.subPaths.length).toBe(0);
		});

		it("rect stays a single sub-path", () => {
			path.rect(0, 0, 100, 100);
			expect(path.subPaths.length).toBe(0);
		});

		it("roundRect arc joins do not create spurious sub-paths", () => {
			// arcTo introduces float-precision joins; the distance threshold must
			// keep roundRect as a single continuous sub-path.
			path.roundRect(0, 0, 100, 100, 10);
			expect(path.subPaths.length).toBe(0);
		});

		it("closePath closes the current sub-path, not the first", () => {
			path.parseSVGPath("M 0 0 L 100 0 L 100 100 Z M 25 25 L 75 25 L 75 75 Z");
			// the last point must be the second sub-path's start (25,25), proving
			// closePath returned to the current sub-path rather than the origin
			const last = path.points[path.points.length - 1];
			expect(last.x).toBe(25);
			expect(last.y).toBe(25);
		});
	});

	describe("sub-paths and holes — adversarial (ticket #1253)", () => {
		// ---- structural invariants -------------------------------------------

		it("never records a boundary at index 0 (first sub-path is the outer)", () => {
			path.parseSVGPath(
				"M 0 0 L 10 0 L 10 10 Z M 2 2 L 4 2 L 4 4 Z M 6 6 L 8 6 L 8 8 Z",
			);
			for (const idx of path.subPaths) {
				expect(idx).toBeGreaterThan(0);
			}
		});

		it("every boundary index is even (keeps GL_LINES pairing aligned)", () => {
			// points are pushed in pairs (segStart, segEnd); a boundary must land on
			// a segStart or the line list / canvas moveTo would desync
			path.parseSVGPath(
				"M 0 0 L 100 0 L 100 100 L 0 100 Z " +
					"M 10 10 L 20 10 L 20 20 Z " +
					"M 40 40 Q 50 30 60 40 Q 50 60 40 40 Z",
			);
			expect(path.subPaths.length).toBe(2);
			for (const idx of path.subPaths) {
				expect(idx % 2).toBe(0);
			}
		});

		it("every boundary index is strictly inside the points array", () => {
			path.parseSVGPath("M 0 0 L 100 0 Z M 25 25 L 75 25 Z M 40 40 L 60 40");
			for (const idx of path.subPaths) {
				expect(idx).toBeGreaterThan(0);
				expect(idx).toBeLessThan(path.points.length);
			}
		});

		it("keeps the points array even-length with several sub-paths", () => {
			path.parseSVGPath(
				"M 0 0 L 10 0 Z M 1 1 L 2 1 Z M 3 3 L 4 3 Z M 5 5 L 6 5 Z",
			);
			expect(path.points.length % 2).toBe(0);
		});

		it("boundaries are strictly increasing", () => {
			path.parseSVGPath(
				"M 0 0 L 10 0 Z M 1 1 L 2 1 Z M 3 3 L 4 3 Z M 5 5 L 6 5 Z",
			);
			for (let i = 1; i < path.subPaths.length; i++) {
				expect(path.subPaths[i]).toBeGreaterThan(path.subPaths[i - 1]);
			}
		});

		// ---- the significant-gap heuristic -----------------------------------

		it("a sub-pixel pen-up gap does NOT split the sub-path", () => {
			// a move smaller than the threshold is treated as float noise, not a
			// new sub-path (this is what keeps arc/roundRect joins continuous)
			path.moveTo(0, 0);
			path.lineTo(100, 0);
			path.moveTo(100.0005, 0); // ~5e-4 px away -> below threshold
			path.lineTo(200, 0);
			expect(path.subPaths.length).toBe(0);
		});

		it("a clearly separated pen-up gap DOES split the sub-path", () => {
			path.moveTo(0, 0);
			path.lineTo(100, 0);
			path.moveTo(105, 0); // 5 px away -> above threshold
			path.lineTo(200, 0);
			expect(path.subPaths.length).toBe(1);
		});

		it("an exactly coincident M is not a new sub-path", () => {
			// pen is already at (100,0); moving there again is a no-op gap
			path.moveTo(0, 0);
			path.lineTo(100, 0);
			path.moveTo(100, 0);
			path.lineTo(200, 0);
			expect(path.subPaths.length).toBe(0);
		});

		// ---- only-moveTo / empty / malformed input ---------------------------

		it("a leading M before any draw never records a boundary", () => {
			path.parseSVGPath("M 50 50 L 100 50 L 100 100 Z");
			expect(path.subPaths.length).toBe(0);
		});

		it("consecutive M with no draw collapse to the last M", () => {
			path.parseSVGPath("M 0 0 M 50 50 L 100 50");
			expect(path.subPaths.length).toBe(0);
			expect(path.points[0].x).toBe(50);
			expect(path.points[0].y).toBe(50);
		});

		it("a trailing M with no following draw records no boundary", () => {
			path.parseSVGPath("M 0 0 L 10 0 M 99 99");
			expect(path.subPaths.length).toBe(0);
			expect(path.points.length).toBe(2);
		});

		it("only-M paths produce no points and no sub-paths", () => {
			path.parseSVGPath("M 0 0 M 10 10 M 20 20");
			expect(path.points.length).toBe(0);
			expect(path.subPaths.length).toBe(0);
		});

		it("an empty path string does not throw and leaves nothing", () => {
			expect(() => {
				path.parseSVGPath("");
			}).not.toThrow();
			expect(path.points.length).toBe(0);
			expect(path.subPaths.length).toBe(0);
		});

		it("a whitespace-only path string does not throw", () => {
			expect(() => {
				path.parseSVGPath("   \n\t ");
			}).not.toThrow();
			expect(path.points.length).toBe(0);
		});

		it("an unsupported command warns but does not throw", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(() => {
				path.parseSVGPath("M 0 0 S 10 10 20 20");
			}).not.toThrow();
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
		});

		it("the no-arg constructor produces an empty path", () => {
			const p = new Path2D();
			expect(p.points.length).toBe(0);
			expect(p.subPaths.length).toBe(0);
		});

		// ---- triangulation with holes ----------------------------------------

		it("standalone ellipse() records no sub-path boundary", () => {
			path.beginPath();
			path.ellipse(50, 50, 40, 30, 0, 0, Math.PI * 2);
			expect(path.subPaths.length).toBe(0);
		});

		it("standalone arc() records no sub-path boundary", () => {
			path.beginPath();
			path.arc(50, 50, 40, 0, Math.PI * 2);
			expect(path.subPaths.length).toBe(0);
		});

		it("carves a hole regardless of hole winding (earcut path)", () => {
			// outer CW, inner ALSO CW (same winding) — earcut still treats the
			// second ring as a hole, so the centre stays uncovered
			path.parseSVGPath(
				"M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 75 25 L 75 75 L 25 75 Z",
			);
			const v = path.triangulatePath();
			expect(pointInTriangulation(v, 50, 50)).toBe(false);
			expect(pointInTriangulation(v, 10, 50)).toBe(true);
		});

		it("carves a hole even when the hole ring is not closed with Z", () => {
			path.parseSVGPath(
				"M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 25 75 L 75 75 L 75 25",
			);
			expect(path.subPaths.length).toBe(1);
			const v = path.triangulatePath();
			expect(pointInTriangulation(v, 50, 50)).toBe(false);
			expect(pointInTriangulation(v, 10, 50)).toBe(true);
		});

		it("supports several holes in one shape (a face: 2 eyes + mouth)", () => {
			path.parseSVGPath(
				"M 0 0 L 100 0 L 100 100 L 0 100 Z " + // face
					"M 20 20 L 35 20 L 35 35 L 20 35 Z " + // left eye
					"M 65 20 L 80 20 L 80 35 L 65 35 Z " + // right eye
					"M 30 65 L 70 65 L 70 80 L 30 80 Z", // mouth
			);
			expect(path.subPaths.length).toBe(3);
			const v = path.triangulatePath();
			expect(v.length % 3).toBe(0);
			expect(v.length).toBeGreaterThan(0);
			// each hole centre is uncovered
			expect(pointInTriangulation(v, 27, 27)).toBe(false); // left eye
			expect(pointInTriangulation(v, 72, 27)).toBe(false); // right eye
			expect(pointInTriangulation(v, 50, 72)).toBe(false); // mouth
			// solid forehead area is covered
			expect(pointInTriangulation(v, 50, 10)).toBe(true);
		});

		it("a hole entirely outside the outer contour covers nothing extra", () => {
			// degenerate authoring: the 'hole' sits outside the outer square
			path.parseSVGPath(
				"M 0 0 L 50 0 L 50 50 L 0 50 Z M 200 200 L 250 200 L 250 250 L 200 250 Z",
			);
			expect(() => {
				return path.triangulatePath();
			}).not.toThrow();
			const v = path.triangulatePath();
			expect(v.length % 3).toBe(0);
		});

		it("a self-intersecting outline triangulates without throwing", () => {
			path.parseSVGPath("M 0 0 L 100 100 L 100 0 L 0 100 Z");
			expect(() => {
				return path.triangulatePath();
			}).not.toThrow();
			const v = path.triangulatePath();
			expect(v.length % 3).toBe(0);
		});

		it("a zero-area (collinear) hole does not throw", () => {
			path.parseSVGPath("M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 50 L 75 50");
			expect(() => {
				return path.triangulatePath();
			}).not.toThrow();
		});

		// ---- caching / reuse / dirtiness -------------------------------------

		it("returns the cached triangulation on a second call", () => {
			path.parseSVGPath("M 0 0 L 100 0 L 100 100 L 0 100 Z");
			const first = path.triangulatePath();
			const second = path.triangulatePath();
			expect(second).toBe(first); // same array reference, not recomputed
			expect(second.length).toBe(first.length);
		});

		it("recomputes after the path changes from holed to solid", () => {
			path.parseSVGPath(
				"M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 25 75 L 75 75 L 75 25 Z",
			);
			expect(pointInTriangulation(path.triangulatePath(), 50, 50)).toBe(false);
			// rebuild as a plain solid square on the SAME instance
			path.parseSVGPath("M 0 0 L 100 0 L 100 100 L 0 100 Z");
			expect(path.subPaths.length).toBe(0);
			// the hole must be gone — centre now covered
			expect(pointInTriangulation(path.triangulatePath(), 50, 50)).toBe(true);
		});

		it("reusing the instance does not leak sub-paths across parses", () => {
			path.parseSVGPath("M 0 0 L 10 0 Z M 5 5 L 8 5 Z");
			expect(path.subPaths.length).toBe(1);
			path.parseSVGPath("M 0 0 L 10 0 L 10 10 Z"); // single sub-path now
			expect(path.subPaths.length).toBe(0);
		});

		// ---- mid-path pen-up via curve helpers -------------------------------

		it("rect() called mid-path starts a new sub-path", () => {
			path.moveTo(0, 0);
			path.lineTo(50, 0);
			path.rect(200, 200, 50, 50);
			expect(path.subPaths.length).toBe(1);
			expect(path.points[path.subPaths[0]].x).toBe(200);
			expect(path.points[path.subPaths[0]].y).toBe(200);
		});

		it("a far arc() mid-path CONNECTS from the current point (native Path2D semantics)", () => {
			// unlike rect() above, native arc() never starts a sub-path on its
			// own — it always joins from the current point with a straight
			// line. (This originally asserted the pre-fix auto-detach, which
			// was the accident of an unconditional moveTo inside arc().)
			path.moveTo(0, 0);
			path.lineTo(50, 0);
			path.arc(300, 300, 20, 0, Math.PI);
			expect(path.subPaths.length).toBe(0);
		});

		it("the canonical circle-hole idiom — explicit moveTo before arc() — records the boundary", () => {
			// outer square
			path.moveTo(0, 0);
			path.lineTo(100, 0);
			path.lineTo(100, 100);
			path.lineTo(0, 100);
			// pen-up to the arc start, then the hole circle
			path.moveTo(70, 50);
			path.arc(50, 50, 20, 0, Math.PI * 2);
			expect(path.subPaths.length).toBe(1);
		});

		// ---- pen tracking across sub-paths (H/V/A regression) ----------------

		it("an arc opening a hole forms a true circle, not a spiral", () => {
			// regression: the A handler must start from the current pen position
			// (startPoint, set by the preceding M), not the previous sub-path's last
			// point — otherwise the hole's arc is computed from the wrong origin and
			// degenerates into a spiral with a radial slit.
			path.parseSVGPath(
				"M 0 50 A 50 50 0 0 1 100 50 A 50 50 0 0 1 0 50 Z " + // outer disc
					"M 25 50 A 25 25 0 0 0 75 50 A 25 25 0 0 0 25 50 Z", // hole r=25 @ (50,50)
			);
			expect(path.subPaths.length).toBe(1);
			// every point of the hole sub-path must lie on the r=25 circle @ (50,50)
			for (let i = path.subPaths[0]; i < path.points.length; i++) {
				const dx = path.points[i].x - 50;
				const dy = path.points[i].y - 50;
				expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(25, 1);
			}
			// and the carved hole is centred and round
			const v = path.triangulatePath();
			expect(pointInTriangulation(v, 50, 50)).toBe(false); // hole centre
			expect(pointInTriangulation(v, 8, 50)).toBe(true); // ring (left)
			expect(pointInTriangulation(v, 92, 50)).toBe(true); // ring (right)
			expect(pointInTriangulation(v, 50, 8)).toBe(true); // ring (top)
			expect(pointInTriangulation(v, 50, 92)).toBe(true); // ring (bottom)
		});

		it("H/V opening a hole start from the current pen position", () => {
			// same pen-tracking fix as the A command, exercised through H and V
			path.parseSVGPath(
				"M 0 0 L 100 0 L 100 100 L 0 100 Z " + // outer
					"M 25 25 H 50 V 50 H -50 V -50 Z", // hole via relative H/V
			);
			expect(path.subPaths.length).toBe(1);
			const boundary = path.subPaths[0];
			// the hole starts exactly at the M target (25,25)
			expect(path.points[boundary].x).toBe(25);
			expect(path.points[boundary].y).toBe(25);
			// first H is relative to the pen (25,25) -> (75,25), NOT to the outer
			// contour's last point
			expect(path.points[boundary + 1].x).toBe(75);
			expect(path.points[boundary + 1].y).toBe(25);
		});

		it("H after Z resolves against the closed sub-path's start point", () => {
			// after Z the pen returns to the sub-path start (0,0); a following H is
			// relative to that, not to the last drawn point
			path.parseSVGPath("M 0 0 L 50 0 L 50 50 Z H 30");
			const last = path.points[path.points.length - 1];
			expect(last.x).toBe(30); // 0 + 30
			expect(last.y).toBe(0);
		});

		// ---- closePath on an empty / just-moved sub-path -----------------------

		it("closePath after a bare trailing M (unclosed prior sub-path) is a no-op", () => {
			// prior sub-path left open (no Z), then a bare `M` and `Z`: the current
			// sub-path is empty, so closePath must not draw a stray segment back to
			// the first contour nor record a phantom hole
			path.parseSVGPath("M 0 0 L 10 0 M 99 99 Z");
			expect(path.subPaths.length).toBe(0);
			expect(path.points.length).toBe(2);
			expect(path.points[1].x).toBe(10);
			expect(path.points[1].y).toBe(0);
		});

		it("closePath right after a mid-path moveTo (no draw) is a no-op", () => {
			path.moveTo(0, 0);
			path.lineTo(50, 0);
			path.moveTo(200, 200); // open an empty sub-path
			const before = path.points.length;
			path.closePath();
			expect(path.points.length).toBe(before); // nothing added
			expect(path.subPaths.length).toBe(0);
		});

		it("closePath still closes a non-empty current sub-path after a hole", () => {
			// guard against the no-op check over-firing: the second sub-path IS
			// drawn, so its Z must close it back to its own start (25,25)
			path.parseSVGPath("M 0 0 L 100 0 L 100 100 Z M 25 25 L 75 25 L 75 75 Z");
			const last = path.points[path.points.length - 1];
			expect(last.x).toBe(25);
			expect(last.y).toBe(25);
		});
	});
});
