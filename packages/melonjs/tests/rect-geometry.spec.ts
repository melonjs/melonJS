import { describe, expect, it } from "vitest";
import { Rect } from "../src/index.js";

describe("Rect geometry (audit fixes)", () => {
	it("right/bottom are exact when the edge sits at coordinate 0", () => {
		// pre-fix: `this.left + w || w` — a right/bottom edge landing exactly
		// on 0 is falsy, so the getter returned the width/height instead
		const r = new Rect(-100, -50, 100, 50);
		expect(r.right).toBe(0);
		expect(r.bottom).toBe(0);
	});

	it("toPolygon() returns an independent polygon (no shared live vertices)", () => {
		const r = new Rect(10, 20, 30, 40);
		const p = r.toPolygon();
		// pre-fix: setVertices stored the rect's own Vector2d array by
		// reference — mutating the polygon corrupted the rectangle
		p.points[0].set(999, 999);
		expect(r.points[0].x).toBe(0);
		expect(r.points[0].y).toBe(0);
		expect(r.width).toBe(30);
		expect(r.height).toBe(40);
	});
});
