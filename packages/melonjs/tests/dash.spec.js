import { describe, expect, it } from "vitest";
import { dashPath, dashSegments } from "../src/video/utils/dash.js";

describe("dash utilities", () => {
	describe("dashSegments", () => {
		it("should return the full line for empty pattern", () => {
			const result = dashSegments(0, 0, 100, 0, []);
			expect(result.length).toEqual(2);
			expect(result[0].x).toEqual(0);
			expect(result[1].x).toEqual(100);
		});

		it("should split a horizontal line into dash segments", () => {
			const result = dashSegments(0, 0, 100, 0, [20, 10]);
			// 0-20 on, 20-30 off, 30-50 on, 50-60 off, 60-80 on, 80-90 off, 90-100 on
			// = 4 visible segments * 2 points = 8 points
			expect(result.length).toEqual(8);
		});

		it("should handle zero-length line", () => {
			const result = dashSegments(50, 50, 50, 50, [10, 5]);
			expect(result.length).toEqual(2);
		});

		it("should return full line for all-zero pattern", () => {
			const result = dashSegments(0, 0, 100, 0, [0, 0]);
			expect(result.length).toEqual(2);
		});

		it("should handle diagonal line", () => {
			const result = dashSegments(0, 0, 100, 100, [20, 10]);
			expect(result.length).toBeGreaterThan(0);
			// all points should have matching x and y (45 degree line)
			for (const pt of result) {
				expect(pt.x).toBeCloseTo(pt.y, 5);
			}
		});

		it("should handle single dash longer than line", () => {
			const result = dashSegments(0, 0, 50, 0, [100, 10]);
			// dash is longer than line, so entire line is visible
			expect(result.length).toEqual(2);
			expect(result[0].x).toEqual(0);
			expect(result[1].x).toEqual(50);
		});

		it("should handle gap longer than remaining line", () => {
			const result = dashSegments(0, 0, 30, 0, [10, 100]);
			// 0-10 on, then gap covers rest
			expect(result.length).toEqual(2);
			expect(result[0].x).toEqual(0);
			expect(result[1].x).toEqual(10);
		});
	});

	describe("dashPath", () => {
		it("should carry dash state across connected segments", () => {
			// two segments: (0,0)-(50,0) and (50,0)-(100,0) = one continuous 100px line
			const pts = [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 50, y: 0 },
				{ x: 100, y: 0 },
			];
			const result = dashPath(pts, [30, 20]);
			// 0-30 on, 30-50 off, 50-60 still off (10 remaining), 60-90 on, 90-100 off partial
			// = 2 visible segments * 2 points = 4 points
			expect(result.length).toEqual(4);
		});

		it("should produce same result as single segment for continuous line", () => {
			const singleSeg = dashSegments(0, 0, 100, 0, [30, 20]);
			// split into two halves
			const pts = [
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 50, y: 0 },
				{ x: 100, y: 0 },
			];
			const multiSeg = dashPath(pts, [30, 20]);
			expect(multiSeg.length).toEqual(singleSeg.length);
		});

		it("should return original points for all-zero pattern", () => {
			const pts = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
			];
			const result = dashPath(pts, [0, 0]);
			expect(result.length).toEqual(2);
		});

		it("should handle empty points array", () => {
			const result = dashPath([], [10, 5]);
			expect(result.length).toEqual(0);
		});

		it("should not emit zero-length segments with zero dash values", () => {
			const pts = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
			];
			const result = dashPath(pts, [0, 10, 5, 10]);
			// verify no zero-length segments (start === end)
			for (let i = 0; i < result.length - 1; i += 2) {
				const dx = result[i + 1].x - result[i].x;
				const dy = result[i + 1].y - result[i].y;
				const len = Math.sqrt(dx * dx + dy * dy);
				expect(len).toBeGreaterThan(0);
			}
		});
		it("should handle negative values in pattern defensively", () => {
			const pts = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
			];
			// negative values should not cause backward movement
			const result = dashPath(pts, [-5, 10, 5, 10]);
			for (let i = 0; i < result.length - 1; i += 2) {
				// all x coordinates should be within [0, 100]
				expect(result[i].x).toBeGreaterThanOrEqual(0);
				expect(result[i + 1].x).toBeLessThanOrEqual(100);
				// end should be >= start (no backward segments)
				expect(result[i + 1].x).toBeGreaterThanOrEqual(result[i].x);
			}
		});

		it("should not infinite loop when skipping consecutive zero entries", () => {
			const pts = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
			];
			// pattern with multiple consecutive zeros followed by a visible dash
			expect(() => {
				dashPath(pts, [10, 0, 0, 5]);
			}).not.toThrow();
			const result = dashPath(pts, [10, 0, 0, 5]);
			// should produce segments without hanging
			expect(result.length).toBeGreaterThan(0);
		});
	});
});
