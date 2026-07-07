import { describe, expect, it } from "vitest";
import Path2D from "../src/geometries/path2d.ts";

/**
 * Per the native Path2D spec, arc()/ellipse() appended to a non-empty path
 * are CONNECTED to the current point with a straight line, and arcTo() is
 * "connected to the previous point by a straight line" by definition (it
 * says so in its own JSDoc). Our implementations instead called moveTo()
 * unconditionally, silently starting a new sub-path.
 *
 * Written failing-first: with the 19.9 multi-sub-path fill semantics (every
 * sub-path after the first is a HOLE), an appended arc didn't just miss its
 * connecting line — it punched a hole in the filled shape. The SVG `A`
 * parser even worked around this internally rather than calling arc().
 */
describe("Path2D arc/arcTo/ellipse continuity (native Path2D semantics)", () => {
	it("arc() appended to an open path connects with a line instead of starting a hole sub-path", () => {
		const p = new Path2D();
		p.beginPath();
		p.moveTo(0, 0);
		p.lineTo(100, 0);
		// arc starting at (100, 40): the spec adds the segment (100,0) → (100,40)
		p.arc(100, 50, 10, -Math.PI / 2, Math.PI / 2);
		expect(p.subPaths.length).toBe(0);
		// the connecting segment is part of the outline
		expect(p.points[2].x).toBeCloseTo(100, 6);
		expect(p.points[2].y).toBeCloseTo(0, 6);
		expect(p.points[3].x).toBeCloseTo(100, 6);
		expect(p.points[3].y).toBeCloseTo(40, 6);
	});

	it("ellipse() appended to an open path connects instead of starting a hole sub-path", () => {
		const p = new Path2D();
		p.beginPath();
		p.moveTo(0, 0);
		p.lineTo(50, 0);
		// ellipse outline starts at (50, 20)
		p.ellipse(50, 30, 20, 10, 0, -Math.PI / 2, Math.PI / 2);
		expect(p.subPaths.length).toBe(0);
	});

	it("arcTo() appended off the tangent line connects instead of starting a hole sub-path", () => {
		const p = new Path2D();
		p.beginPath();
		p.moveTo(0, 0);
		p.lineTo(0, 20);
		// pen (0,20) is NOT on the incoming tangent — the spec still connects
		p.arcTo(50, 0, 50, 50, 20);
		expect(p.subPaths.length).toBe(0);
	});

	it("arcTo() after a bare moveTo keeps the connecting line from the pen", () => {
		const p = new Path2D();
		p.beginPath();
		p.moveTo(0, 0);
		p.arcTo(50, 0, 50, 50, 20);
		// native canvas draws (0,0) → tangent (30,0); the old moveTo dropped it
		expect(p.points[0].x).toBeCloseTo(0, 6);
		expect(p.points[0].y).toBeCloseTo(0, 6);
	});

	it("arc() on a virgin path still starts cleanly at the arc start (no spurious origin line)", () => {
		const p = new Path2D();
		p.beginPath();
		p.arc(50, 50, 40, 0, Math.PI * 2);
		expect(p.subPaths.length).toBe(0);
		expect(p.points[0].x).toBeCloseTo(90, 6);
		expect(p.points[0].y).toBeCloseTo(50, 6);
	});

	it("explicit moveTo sub-paths (holes) still register", () => {
		const p = new Path2D();
		p.beginPath();
		// outer triangle
		p.moveTo(0, 0);
		p.lineTo(100, 0);
		p.lineTo(50, 80);
		// inner hole — an explicit moveTo must STILL start a sub-path
		p.moveTo(40, 20);
		p.lineTo(60, 20);
		p.lineTo(50, 40);
		expect(p.subPaths.length).toBe(1);
	});

	it("roundRect() stays a single sub-path", () => {
		const p = new Path2D();
		p.beginPath();
		p.roundRect(10, 10, 80, 50, 12);
		expect(p.subPaths.length).toBe(0);
	});
});
