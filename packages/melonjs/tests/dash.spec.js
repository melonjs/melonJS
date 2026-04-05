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

		it("should return copy for all-zero pattern", () => {
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
	});
});
