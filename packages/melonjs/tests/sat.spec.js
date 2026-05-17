import { beforeEach, describe, expect, it } from "vitest";
import { Ellipse, Polygon, Rect, Renderable, Vector2d } from "../src/index.js";
import {
	testEllipseEllipse,
	testEllipsePolygon,
	testPolygonEllipse,
	testPolygonPolygon,
} from "../src/physics/builtin/sat.js";
import ResponseObject from "../src/physics/response.js";

/**
 * Helper to create a mock renderable with position and ancestor
 * (SAT functions expect objects with .pos and .ancestor.getAbsolutePosition())
 */
function createMockRenderable(x, y, ancestorOffset) {
	const renderable = new Renderable(x, y, 0, 0);
	renderable.anchorPoint.set(0, 0);
	const offset =
		ancestorOffset instanceof Vector2d ? ancestorOffset : new Vector2d(0, 0);
	// ensure ancestor chain returns the requested offset
	if (typeof renderable.ancestor === "undefined") {
		renderable.ancestor = {
			getAbsolutePosition() {
				return offset;
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

	describe("testEllipseEllipse (true ellipses)", () => {
		let response;

		beforeEach(() => {
			response = new ResponseObject();
		});

		it("should detect collision between two overlapping ellipses", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(60, 0);
			// wide ellipse: rx=50, ry=20
			const ellipseA = new Ellipse(0, 0, 100, 40);
			const ellipseB = new Ellipse(0, 0, 100, 40);

			const result = testEllipseEllipse(a, ellipseA, b, ellipseB, response);
			expect(result).toBe(true);
			expect(response.overlap).toBeGreaterThan(0);
		});

		it("should not detect collision along the minor axis when separated", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(0, 30);
			// wide ellipse: rx=50, ry=10
			const ellipseA = new Ellipse(0, 0, 100, 20);
			const ellipseB = new Ellipse(0, 0, 100, 20);

			// old circle-based test would say collision (radius=50, distance=30)
			// but actual ellipse minor axis is only 10, so gap of 10
			const result = testEllipseEllipse(a, ellipseA, b, ellipseB, response);
			expect(result).toBe(false);
		});

		it("should detect collision between rotated ellipses", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(0, 60);
			// wide ellipse: rx=50, ry=10
			const ellipseA = new Ellipse(0, 0, 100, 20);
			const ellipseB = new Ellipse(0, 0, 100, 20);
			// rotate A 90° so its major axis is now vertical
			ellipseA.rotate(Math.PI / 2);

			// A's major axis (50) is now vertical, B is at y=60 with ry=10
			// should collide: A extends to y=50, B starts at y=50
			const result = testEllipseEllipse(a, ellipseA, b, ellipseB, response);
			expect(result).toBe(true);
		});

		it("should detect collision between ellipse and circle", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(55, 0);
			const ellipseA = new Ellipse(0, 0, 100, 40); // rx=50, ry=20
			const circleB = new Ellipse(0, 0, 20, 20); // radius 10

			const result = testEllipseEllipse(a, ellipseA, b, circleB, response);
			expect(result).toBe(true);
			expect(response.overlap).toBeGreaterThan(0);
		});

		it("should not collide when ellipse minor axis faces the other shape", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(0, 25);
			const ellipseA = new Ellipse(0, 0, 100, 20); // rx=50, ry=10
			const circleB = new Ellipse(0, 0, 20, 20); // radius 10

			// circle at y=25, radius 10 → reaches y=15
			// ellipse minor axis ry=10 → reaches y=10
			// gap of 5
			const result = testEllipseEllipse(a, ellipseA, b, circleB, response);
			expect(result).toBe(false);
		});
	});

	describe("testPolygonEllipse (true ellipses)", () => {
		let response;

		beforeEach(() => {
			response = new ResponseObject();
		});

		it("should detect collision between rectangle and ellipse along major axis", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(40, 0);
			const polyA = new Rect(0, 0, 32, 32);
			const ellipseB = new Ellipse(0, 0, 100, 20); // rx=50, ry=10

			// rect right edge at x=32, ellipse left edge at x=40-50=-10
			const result = testPolygonEllipse(a, polyA, b, ellipseB, response);
			expect(result).toBe(true);
			expect(response.overlap).toBeGreaterThan(0);
		});

		it("should not detect collision along ellipse minor axis", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(16, 50);
			const polyA = new Rect(0, 0, 32, 32);
			const ellipseB = new Ellipse(0, 0, 100, 20); // rx=50, ry=10

			// rect bottom edge at y=32, ellipse top at y=50-10=40
			// gap of 8
			const result = testPolygonEllipse(a, polyA, b, ellipseB, response);
			expect(result).toBe(false);
		});

		it("should detect collision with rotated ellipse", () => {
			const a = createMockRenderable(0, 0);
			const b = createMockRenderable(16, 50);
			const polyA = new Rect(0, 0, 32, 32);
			const ellipseB = new Ellipse(0, 0, 100, 20); // rx=50, ry=10
			// rotate 90° so major axis is now vertical
			ellipseB.rotate(Math.PI / 2);

			// now ellipse extends 50 vertically from center at y=50
			// so it reaches y=0 to y=100, rect is y=0 to y=32
			const result = testPolygonEllipse(a, polyA, b, ellipseB, response);
			expect(result).toBe(true);
		});
	});

	describe("testEllipsePolygon (true ellipses)", () => {
		let response;

		beforeEach(() => {
			response = new ResponseObject();
		});

		it("should detect collision (reverse of testPolygonEllipse)", () => {
			const a = createMockRenderable(40, 0);
			const b = createMockRenderable(0, 0);
			const ellipseA = new Ellipse(0, 0, 100, 20); // rx=50, ry=10
			const polyB = new Rect(0, 0, 32, 32);

			const result = testEllipsePolygon(a, ellipseA, b, polyB, response);
			expect(result).toBe(true);
			expect(response.a).toBe(a);
			expect(response.b).toBe(b);
		});

		it("should not detect collision along minor axis", () => {
			const a = createMockRenderable(16, 50);
			const b = createMockRenderable(0, 0);
			const ellipseA = new Ellipse(0, 0, 100, 20); // rx=50, ry=10
			const polyB = new Rect(0, 0, 32, 32);

			const result = testEllipsePolygon(a, ellipseA, b, polyB, response);
			expect(result).toBe(false);
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

	// Regression: SAT must respect a non-zero ancestor.getAbsolutePosition()
	// the same way for both colliders. Both operands resolve their world
	// position via ancestor.getAbsolutePosition(), so the relative-position
	// vector must subtract A's ancestor offset (the polygon/polygon path
	// builds two absolute positions and subtracts inside isSeparatingAxis,
	// which is correct; the ellipse paths build the difference directly
	// and used to ADD A's ancestor offset by mistake). This was invisible
	// whenever ancestor.abs was (0, 0), so a TMX level the same size as
	// the viewport hid the bug; it broke every circle collision the moment
	// the level container was shifted (`level.load` auto-centering on a
	// wider viewport, or any manually translated container).
	describe("non-zero ancestor offset", () => {
		let response;
		beforeEach(() => {
			response = new ResponseObject();
		});

		// Each entry exercises one shape-type combination and asserts that
		// (a) overlap detection still fires when both bodies share a
		// non-zero ancestor offset, (b) the response overlap matches the
		// zero-offset baseline (shift-invariance), and (c) the concrete
		// near-miss geometry the platformer hits is detected.
		const offset = new Vector2d(255, 0);
		const makeCases = () => {
			return [
				{
					name: "Polygon vs Polygon (Rect/Rect via testPolygonPolygon)",
					fn: testPolygonPolygon,
					shapeA: () => {
						return new Rect(0, 0, 40, 40).toPolygon();
					},
					shapeB: () => {
						return new Rect(0, 0, 40, 40).toPolygon();
					},
					// Polygon/polygon was already correct (isSeparatingAxis
					// subtracts internally), so this entry guards against a
					// future regression rather than reproducing today's bug.
					preFixWouldMiss: false,
				},
				{
					name: "Polygon vs Polygon (custom Polygon/Rect via testPolygonPolygon)",
					fn: testPolygonPolygon,
					shapeA: () => {
						return new Polygon(0, 0, [
							new Vector2d(0, 0),
							new Vector2d(30, 0),
							new Vector2d(15, 40),
						]);
					},
					shapeB: () => {
						return new Rect(0, 0, 40, 40).toPolygon();
					},
					preFixWouldMiss: false,
				},
				{
					name: "Polygon vs Circle (Rect/Circle via testPolygonEllipse)",
					fn: testPolygonEllipse,
					shapeA: () => {
						return new Rect(0, 0, 40, 40).toPolygon();
					},
					shapeB: () => {
						return new Ellipse(0, 0, 40, 40);
					},
					preFixWouldMiss: true,
				},
				{
					name: "Polygon vs true Ellipse (Rect/Ellipse via testPolygonEllipse)",
					fn: testPolygonEllipse,
					shapeA: () => {
						return new Rect(0, 0, 40, 40).toPolygon();
					},
					// non-square radii → falls through to testPolygonPolygon
					// internally, so this exercises the conversion path too.
					shapeB: () => {
						return new Ellipse(0, 0, 40, 24);
					},
					preFixWouldMiss: false,
				},
				{
					name: "Circle vs Polygon (Circle/Rect via testEllipsePolygon)",
					fn: testEllipsePolygon,
					shapeA: () => {
						return new Ellipse(0, 0, 40, 40);
					},
					shapeB: () => {
						return new Rect(0, 0, 40, 40).toPolygon();
					},
					preFixWouldMiss: true,
				},
				{
					name: "true Ellipse vs Polygon (Ellipse/Rect via testEllipsePolygon)",
					fn: testEllipsePolygon,
					shapeA: () => {
						return new Ellipse(0, 0, 40, 24);
					},
					shapeB: () => {
						return new Rect(0, 0, 40, 40).toPolygon();
					},
					preFixWouldMiss: false,
				},
				{
					name: "Circle vs Circle (testEllipseEllipse fast path)",
					fn: testEllipseEllipse,
					shapeA: () => {
						return new Ellipse(0, 0, 40, 40);
					}, // radius 20
					shapeB: () => {
						return new Ellipse(0, 0, 40, 40);
					},
					preFixWouldMiss: true,
				},
				{
					name: "Circle vs true Ellipse (testEllipseEllipse mixed)",
					fn: testEllipseEllipse,
					shapeA: () => {
						return new Ellipse(0, 0, 40, 40);
					},
					shapeB: () => {
						return new Ellipse(0, 0, 40, 24);
					},
					preFixWouldMiss: true,
				},
				{
					name: "true Ellipse vs true Ellipse (testEllipseEllipse polygonized)",
					fn: testEllipseEllipse,
					shapeA: () => {
						return new Ellipse(0, 0, 40, 24);
					},
					shapeB: () => {
						return new Ellipse(0, 0, 40, 24);
					},
					preFixWouldMiss: false,
				},
			];
		};

		for (const c of makeCases()) {
			it(`${c.name}: shift-invariant under a common ancestor offset`, () => {
				const aRef = createMockRenderable(0, 0);
				const bRef = createMockRenderable(15, 0);
				const refResp = new ResponseObject();
				const refHit = c.fn(aRef, c.shapeA(), bRef, c.shapeB(), refResp);
				expect(refHit).toBe(true);

				const aShifted = createMockRenderable(0, 0, offset);
				const bShifted = createMockRenderable(15, 0, offset);
				const shiftedHit = c.fn(
					aShifted,
					c.shapeA(),
					bShifted,
					c.shapeB(),
					response,
				);
				expect(shiftedHit).toBe(true);
				expect(response.overlap).toBeCloseTo(refResp.overlap);
			});

			if (c.preFixWouldMiss) {
				it(`${c.name}: pre-fix sign error mis-placed the circle by 2 * ancestor.abs`, () => {
					// Geometry chosen so that the bodies overlap normally,
					// but the buggy +offset would push them ~510 px apart
					// (far beyond any reasonable shape extent).
					const a = createMockRenderable(0, 0, offset);
					const b = createMockRenderable(10, 0, offset);
					expect(c.fn(a, c.shapeA(), b, c.shapeB(), response)).toBe(true);
				});
			}
		}

		// Concrete repro of the platformer's player-polygon vs coin-circle
		// collision at world.pos (255, 0). Without the SAT fix the circle's
		// computed position is +510 px from where it should be, missing
		// the polygon entirely.
		it("platformer regression: player Rect vs coin Circle inside a shifted level container", () => {
			const offset = new Vector2d(255, 0);
			const player = createMockRenderable(785, 790, offset);
			const coin = createMockRenderable(840, 805, offset);
			const playerPoly = new Rect(20, 8, 35, 88).toPolygon();
			const coinCircle = new Ellipse(17.5, 17.5, 35, 35); // radius 17.5
			expect(
				testPolygonEllipse(player, playerPoly, coin, coinCircle, response),
			).toBe(true);
		});
	});
});
