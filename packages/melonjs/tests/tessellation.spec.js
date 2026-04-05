import { describe, expect, it } from "vitest";
import {
	generateJoinCircles,
	generateTriangleFan,
} from "../src/video/utils/tessellation.js";

describe("tessellation utilities", () => {
	describe("generateTriangleFan", () => {
		it("should generate correct number of vertices for a full circle", () => {
			const verts = generateTriangleFan(0, 0, 10, 10, 0, Math.PI * 2, 8);
			// 8 segments * 3 vertices per triangle = 24
			expect(verts.length).toEqual(24);
		});

		it("should generate correct number of vertices for a half circle", () => {
			const verts = generateTriangleFan(0, 0, 10, 10, 0, Math.PI, 4);
			expect(verts.length).toEqual(12);
		});

		it("every triangle should have center as first vertex", () => {
			const verts = generateTriangleFan(50, 50, 10, 10, 0, Math.PI * 2, 6);
			for (let i = 0; i < verts.length; i += 3) {
				expect(verts[i].x).toEqual(50);
				expect(verts[i].y).toEqual(50);
			}
		});

		it("should handle elliptical radii", () => {
			const verts = generateTriangleFan(0, 0, 20, 10, 0, Math.PI * 2, 4);
			// first outer vertex at angle 0: (20, 0)
			expect(verts[1].x).toBeCloseTo(20, 5);
			expect(verts[1].y).toBeCloseTo(0, 5);
		});

		it("should return empty array for 0 segments", () => {
			const verts = generateTriangleFan(0, 0, 10, 10, 0, Math.PI, 0);
			expect(verts.length).toEqual(0);
		});
	});

	describe("generateJoinCircles", () => {
		it("should generate vertices for each center point", () => {
			const centers = [
				{ x: 0, y: 0 },
				{ x: 10, y: 10 },
			];
			const verts = generateJoinCircles(centers, 5);
			// 2 centers * 8 segments * 3 vertices = 48
			expect(verts.length).toEqual(48);
		});

		it("should return empty array for no centers", () => {
			const verts = generateJoinCircles([], 5);
			expect(verts.length).toEqual(0);
		});

		it("every triangle should have its center as first vertex", () => {
			const centers = [{ x: 30, y: 40 }];
			const verts = generateJoinCircles(centers, 10);
			for (let i = 0; i < verts.length; i += 3) {
				expect(verts[i].x).toEqual(30);
				expect(verts[i].y).toEqual(40);
			}
		});
	});
});
