import { beforeEach, describe, expect, it } from "vitest";
import {
	Container,
	Ellipse,
	Polygon,
	Rect,
	Renderable,
	Vector2d,
} from "../src/index.js";
import ResponseObject from "../src/physics/response.js";
import {
	testEllipseEllipse,
	testEllipsePolygon,
	testPolygonEllipse,
	testPolygonPolygon,
} from "../src/physics/sat.js";

/**
 * Helper to create a mock renderable with position and ancestor
 * (SAT functions expect objects with .pos and .ancestor.getAbsolutePosition())
 */
function createMockRenderable(x, y) {
	const renderable = new Renderable(x, y, 0, 0);
	renderable.anchorPoint.set(0, 0);
	// ensure ancestor chain returns zero offset
	if (typeof renderable.ancestor === "undefined") {
		renderable.ancestor = {
			getAbsolutePosition() {
				return new Vector2d(0, 0);
			},
		};
	}
	return renderable;
}

describe("Physics : SAT (Separating Axis Theorem)", () => {
	describe("testPolygonPolygon", () => {
		let response;

		beforeEach(() => {
			response = new ResponseObject();
		});

		it("should detect collision between two overlapping rectangles", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(16, 0);
			const polyA = new Rect(0, 0, 32, 32);
			const polyB = new Rect(0, 0, 32, 32);

			const result = testPolygonPolygon(a, polyA, b, polyB, response);
			expect(result).toBe(true);
			expect(response.overlap).toBeGreaterThan(0);
		});

		it("should not detect collision between two separated rectangles", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(100, 0);
			const polyA = new Rect(0, 0, 32, 32);
			const polyB = new Rect(0, 0, 32, 32);

			const result = testPolygonPolygon(a, polyA, b, polyB, response);
			expect(result).toBe(false);
		});

		it("should report correct overlap for partially overlapping rectangles", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(20, 0);
			const polyA = new Rect(0, 0, 32, 32);
			const polyB = new Rect(0, 0, 32, 32);

			const result = testPolygonPolygon(a, polyA, b, polyB, response);
			expect(result).toBe(true);
			// overlap should be 12 (32 - 20)
			expect(response.overlap).toBeCloseTo(12);
		});

		it("should detect collision between two triangles", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(10, 0);
			const triA = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 32, y: 0 },
				{ x: 16, y: 32 },
			]);
			const triB = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 32, y: 0 },
				{ x: 16, y: 32 },
			]);

			const result = testPolygonPolygon(a, triA, b, triB, response);
			expect(result).toBe(true);
		});

		it("should not detect collision between two separated triangles", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(100, 0);
			const triA = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 32, y: 0 },
				{ x: 16, y: 32 },
			]);
			const triB = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 32, y: 0 },
				{ x: 16, y: 32 },
			]);

			const result = testPolygonPolygon(a, triA, b, triB, response);
			expect(result).toBe(false);
		});

		it("should detect full containment (A inside B)", () => {
			const a = createMockRenderable(10, 10);
			const b = createMockRenderable(0, 0);
			const polyA = new Rect(0, 0, 10, 10);
			const polyB = new Rect(0, 0, 100, 100);

			const result = testPolygonPolygon(a, polyA, b, polyB, response);
			expect(result).toBe(true);
			expect(response.aInB).toBe(true);
		});

		it("should detect full containment (B inside A)", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(10, 10);
			const polyA = new Rect(0, 0, 100, 100);
			const polyB = new Rect(0, 0, 10, 10);

			const result = testPolygonPolygon(a, polyA, b, polyB, response);
			expect(result).toBe(true);
			expect(response.bInA).toBe(true);
		});

		it("should work without a response object", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(16, 0);
			const polyA = new Rect(0, 0, 32, 32);
			const polyB = new Rect(0, 0, 32, 32);

			const result = testPolygonPolygon(a, polyA, b, polyB);
			expect(result).toBe(true);
		});

		it("should set response.a and response.b on collision", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(16, 0);
			const polyA = new Rect(0, 0, 32, 32);
			const polyB = new Rect(0, 0, 32, 32);

			testPolygonPolygon(a, polyA, b, polyB, response);
			expect(response.a).toBe(a);
			expect(response.b).toBe(b);
		});

		it("should provide a valid overlap vector on collision", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(20, 0);
			const polyA = new Rect(0, 0, 32, 32);
			const polyB = new Rect(0, 0, 32, 32);

			testPolygonPolygon(a, polyA, b, polyB, response);
			// overlapV should have non-zero length matching the overlap
			const overlapLen = Math.sqrt(
				response.overlapV.x ** 2 + response.overlapV.y ** 2,
			);
			expect(overlapLen).toBeCloseTo(response.overlap);
		});

		it("should detect edge-touching rectangles as colliding (zero overlap)", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(32, 0);
			const polyA = new Rect(0, 0, 32, 32);
			const polyB = new Rect(0, 0, 32, 32);

			// SAT treats touching edges as colliding (overlap = 0)
			const result = testPolygonPolygon(a, polyA, b, polyB, response);
			expect(result).toBe(true);
			expect(response.overlap).toBeCloseTo(0);
		});

		it("should handle polygons with different vertex counts", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(5, 5);
			// Triangle
			const triA = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 40, y: 0 },
				{ x: 20, y: 40 },
			]);
			// Pentagon
			const pentB = new Polygon(0, 0, [
				{ x: 10, y: 0 },
				{ x: 30, y: 0 },
				{ x: 40, y: 20 },
				{ x: 20, y: 35 },
				{ x: 0, y: 20 },
			]);

			const result = testPolygonPolygon(a, triA, b, pentB, response);
			expect(result).toBe(true);
			expect(response.overlap).toBeGreaterThan(0);
		});

		it("should be consistent across multiple consecutive calls", () => {
			// Ensures the vector pool is properly managed across calls
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(16, 0);
			const polyA = new Rect(0, 0, 32, 32);
			const polyB = new Rect(0, 0, 32, 32);

			for (let i = 0; i < 20; i++) {
				response.clear();
				const result = testPolygonPolygon(a, polyA, b, polyB, response);
				expect(result).toBe(true);
				expect(response.overlap).toBeCloseTo(16);
			}
		});
	});

	describe("testEllipseEllipse", () => {
		let response;

		beforeEach(() => {
			response = new ResponseObject();
		});

		it("should detect collision between two overlapping circles", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(30, 0);
			const ellipseA = new Ellipse(0, 0, 40, 40); // radius 20
			const ellipseB = new Ellipse(0, 0, 40, 40); // radius 20

			const result = testEllipseEllipse(a, ellipseA, b, ellipseB, response);
			expect(result).toBe(true);
			// distance = 30, combined radius = 40, overlap = 10
			expect(response.overlap).toBeCloseTo(10);
		});

		it("should not detect collision between two separated circles", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(100, 0);
			const ellipseA = new Ellipse(0, 0, 20, 20); // radius 10
			const ellipseB = new Ellipse(0, 0, 20, 20); // radius 10

			const result = testEllipseEllipse(a, ellipseA, b, ellipseB, response);
			expect(result).toBe(false);
		});

		it("should detect full containment of small circle inside large circle", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(5, 0);
			const ellipseA = new Ellipse(0, 0, 100, 100); // radius 50
			const ellipseB = new Ellipse(0, 0, 10, 10); // radius 5

			const result = testEllipseEllipse(a, ellipseA, b, ellipseB, response);
			expect(result).toBe(true);
			expect(response.bInA).toBe(true);
		});

		it("should work without a response object", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(5, 0);
			const ellipseA = new Ellipse(0, 0, 20, 20);
			const ellipseB = new Ellipse(0, 0, 20, 20);

			const result = testEllipseEllipse(a, ellipseA, b, ellipseB);
			expect(result).toBe(true);
		});

		it("should set response.a and response.b on collision", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(5, 0);
			const ellipseA = new Ellipse(0, 0, 20, 20);
			const ellipseB = new Ellipse(0, 0, 20, 20);

			testEllipseEllipse(a, ellipseA, b, ellipseB, response);
			expect(response.a).toBe(a);
			expect(response.b).toBe(b);
		});

		it("should provide normalized overlap normal", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(10, 0);
			const ellipseA = new Ellipse(0, 0, 20, 20);
			const ellipseB = new Ellipse(0, 0, 20, 20);

			testEllipseEllipse(a, ellipseA, b, ellipseB, response);
			const normalLen = Math.sqrt(
				response.overlapN.x ** 2 + response.overlapN.y ** 2,
			);
			expect(normalLen).toBeCloseTo(1);
		});

		it("should detect diagonal circle collision", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(7, 7);
			const ellipseA = new Ellipse(0, 0, 20, 20); // radius 10
			const ellipseB = new Ellipse(0, 0, 20, 20); // radius 10

			// distance = sqrt(49+49) ≈ 9.9, combined radius = 20
			const result = testEllipseEllipse(a, ellipseA, b, ellipseB, response);
			expect(result).toBe(true);
			expect(response.overlap).toBeGreaterThan(0);
		});

		it("should be consistent across multiple consecutive calls", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(10, 0);
			const ellipseA = new Ellipse(0, 0, 20, 20);
			const ellipseB = new Ellipse(0, 0, 20, 20);

			for (let i = 0; i < 20; i++) {
				response.clear();
				const result = testEllipseEllipse(a, ellipseA, b, ellipseB, response);
				expect(result).toBe(true);
				expect(response.overlap).toBeCloseTo(10);
			}
		});
	});

	describe("testPolygonEllipse", () => {
		let response;

		beforeEach(() => {
			response = new ResponseObject();
		});

		it("should detect collision between a rectangle and a circle", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(25, 16);
			const polyA = new Rect(0, 0, 32, 32);
			const ellipseB = new Ellipse(0, 0, 20, 20); // radius 10

			const result = testPolygonEllipse(a, polyA, b, ellipseB, response);
			expect(result).toBe(true);
			expect(response.overlap).toBeGreaterThan(0);
		});

		it("should not detect collision when circle is far from rectangle", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(100, 100);
			const polyA = new Rect(0, 0, 32, 32);
			const ellipseB = new Ellipse(0, 0, 10, 10);

			const result = testPolygonEllipse(a, polyA, b, ellipseB, response);
			expect(result).toBe(false);
		});

		it("should detect circle inside polygon", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(16, 16);
			const polyA = new Rect(0, 0, 100, 100);
			const ellipseB = new Ellipse(0, 0, 10, 10); // radius 5

			const result = testPolygonEllipse(a, polyA, b, ellipseB, response);
			expect(result).toBe(true);
			expect(response.bInA).toBe(true);
		});

		it("should work without a response object", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(16, 16);
			const polyA = new Rect(0, 0, 32, 32);
			const ellipseB = new Ellipse(0, 0, 20, 20);

			const result = testPolygonEllipse(a, polyA, b, ellipseB);
			expect(result).toBe(true);
		});

		it("should set response.a and response.b correctly", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(16, 16);
			const polyA = new Rect(0, 0, 32, 32);
			const ellipseB = new Ellipse(0, 0, 20, 20);

			testPolygonEllipse(a, polyA, b, ellipseB, response);
			expect(response.a).toBe(a);
			expect(response.b).toBe(b);
		});

		it("should detect circle touching polygon edge", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(16, 35);
			const polyA = new Rect(0, 0, 32, 32);
			const ellipseB = new Ellipse(0, 0, 10, 10); // radius 5

			// circle center at (16, 35), edge at y=32, radius 5 → overlaps by 2
			const result = testPolygonEllipse(a, polyA, b, ellipseB, response);
			expect(result).toBe(true);
		});

		it("should detect circle near polygon corner", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(34, 34);
			const polyA = new Rect(0, 0, 32, 32);
			const ellipseB = new Ellipse(0, 0, 10, 10); // radius 5

			// distance from (34,34) to corner (32,32) = sqrt(8) ≈ 2.83, radius = 5
			const result = testPolygonEllipse(a, polyA, b, ellipseB, response);
			expect(result).toBe(true);
		});

		it("should not detect circle just past polygon corner", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(40, 40);
			const polyA = new Rect(0, 0, 32, 32);
			const ellipseB = new Ellipse(0, 0, 10, 10); // radius 5

			// distance from (40,40) to corner (32,32) = sqrt(128) ≈ 11.3, radius = 5
			const result = testPolygonEllipse(a, polyA, b, ellipseB, response);
			expect(result).toBe(false);
		});

		it("should be consistent across multiple consecutive calls", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(25, 16);
			const polyA = new Rect(0, 0, 32, 32);
			const ellipseB = new Ellipse(0, 0, 20, 20);

			for (let i = 0; i < 20; i++) {
				response.clear();
				const result = testPolygonEllipse(a, polyA, b, ellipseB, response);
				expect(result).toBe(true);
				expect(response.overlap).toBeGreaterThan(0);
			}
		});
	});

	describe("testEllipsePolygon", () => {
		let response;

		beforeEach(() => {
			response = new ResponseObject();
		});

		it("should detect collision (reverse of testPolygonEllipse)", () => {
			const a = createMockRenderable(25, 16);
			const b = createMockRenderable(0, 0);
			const ellipseA = new Ellipse(0, 0, 20, 20);
			const polyB = new Rect(0, 0, 32, 32);

			const result = testEllipsePolygon(a, ellipseA, b, polyB, response);
			expect(result).toBe(true);
			expect(response.overlap).toBeGreaterThan(0);
		});

		it("should swap a and b correctly in response", () => {
			const a = createMockRenderable(25, 16);
			const b = createMockRenderable(0, 0);
			const ellipseA = new Ellipse(0, 0, 20, 20);
			const polyB = new Rect(0, 0, 32, 32);

			testEllipsePolygon(a, ellipseA, b, polyB, response);
			// response.a should be the ellipse owner, response.b the polygon owner
			expect(response.a).toBe(a);
			expect(response.b).toBe(b);
		});

		it("should not detect collision when separated", () => {
			const a = createMockRenderable(100, 100);
			const b = createMockRenderable(0, 0);
			const ellipseA = new Ellipse(0, 0, 10, 10);
			const polyB = new Rect(0, 0, 32, 32);

			const result = testEllipsePolygon(a, ellipseA, b, polyB, response);
			expect(result).toBe(false);
		});

		it("should produce opposite overlap vector compared to testPolygonEllipse", () => {
			const responseForward = new ResponseObject();
			const responseReverse = new ResponseObject();

			const rA = createMockRenderable(0, 0);
			const rB = createMockRenderable(25, 16);
			const poly = new Rect(0, 0, 32, 32);
			const ellipse = new Ellipse(0, 0, 20, 20);

			testPolygonEllipse(rA, poly, rB, ellipse, responseForward);
			testEllipsePolygon(rB, ellipse, rA, poly, responseReverse);

			// overlap magnitude should be the same
			expect(responseReverse.overlap).toBeCloseTo(responseForward.overlap);
			// overlap vectors should be negated
			expect(responseReverse.overlapV.x).toBeCloseTo(
				-responseForward.overlapV.x,
			);
			expect(responseReverse.overlapV.y).toBeCloseTo(
				-responseForward.overlapV.y,
			);
		});

		it("should be consistent across multiple consecutive calls", () => {
			const a = createMockRenderable(16, 16);
			const b = createMockRenderable(0, 0);
			const ellipseA = new Ellipse(0, 0, 20, 20);
			const polyB = new Rect(0, 0, 32, 32);

			for (let i = 0; i < 20; i++) {
				response.clear();
				const result = testEllipsePolygon(a, ellipseA, b, polyB, response);
				expect(result).toBe(true);
				expect(response.overlap).toBeGreaterThan(0);
			}
		});
	});

	describe("Vector pool integrity", () => {
		it("should handle rapid alternating collision types without corruption", () => {
			const response = new ResponseObject();

			const rA = createMockRenderable(0, 0);
			const rB = createMockRenderable(10, 10);
			const rect = new Rect(0, 0, 32, 32);
			const circle = new Ellipse(0, 0, 20, 20);
			const tri = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 32, y: 0 },
				{ x: 16, y: 32 },
			]);

			// Rapidly alternate between different SAT function types
			for (let i = 0; i < 50; i++) {
				response.clear();
				testPolygonPolygon(rA, rect, rB, rect, response);

				response.clear();
				testEllipseEllipse(rA, circle, rB, circle, response);

				response.clear();
				testPolygonEllipse(rA, rect, rB, circle, response);

				response.clear();
				testEllipsePolygon(rA, circle, rB, rect, response);

				response.clear();
				testPolygonPolygon(rA, tri, rB, tri, response);

				response.clear();
				testPolygonEllipse(rA, tri, rB, circle, response);
			}

			// If we got here without errors, the pool is healthy
			// Verify one final collision still works correctly
			response.clear();
			const result = testPolygonPolygon(rA, rect, rB, rect, response);
			expect(result).toBe(true);
			expect(response.overlap).toBeGreaterThan(0);
		});

		it("should handle collision checks with no overlap interleaved with overlaps", () => {
			const response = new ResponseObject();

			const rA = createMockRenderable(0, 0);
			const rFar = createMockRenderable(500, 500);
			const rNear = createMockRenderable(10, 0);
			const rect = new Rect(0, 0, 32, 32);

			for (let i = 0; i < 30; i++) {
				response.clear();
				// no collision
				const noHit = testPolygonPolygon(rA, rect, rFar, rect, response);
				expect(noHit).toBe(false);

				response.clear();
				// collision
				const hit = testPolygonPolygon(rA, rect, rNear, rect, response);
				expect(hit).toBe(true);
				expect(response.overlap).toBeCloseTo(22);
			}
		});
	});
});
