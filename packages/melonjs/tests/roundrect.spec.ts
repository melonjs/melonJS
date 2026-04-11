import { beforeEach, describe, expect, it } from "vitest";
import { pool, Rect, RoundRect, Vector2d } from "../src/index.js";

describe("Shape : RoundRect", () => {
	let rrect: RoundRect;
	beforeEach(() => {
		pool.register("Vector2d", Vector2d, true);
		rrect = new RoundRect(50, 50, 100, 100, 40);
	});

	it("rrect has finite coordinates", () => {
		expect(rrect.pos.x).toEqual(50);
		expect(rrect.pos.y).toEqual(50);
		expect(rrect.centerX).toEqual(100);
		expect(rrect.centerY).toEqual(100);
		expect(rrect.width).toEqual(100);
		expect(rrect.height).toEqual(100);
		expect(rrect.radius).toEqual(40);
	});

	describe("contains", () => {
		let rect: Rect;
		beforeEach(() => {
			pool.register("Vector2d", Vector2d, true);
			rect = new Rect(50, 50, 100, 100);
		});

		it("a rect of the same dimension does contain 51, 51", () => {
			expect(rect.contains(51, 51)).toEqual(true);
		});
		it("a rect of the same dimension does contain 51, 149", () => {
			expect(rect.contains(51, 149)).toEqual(true);
		});
		it("a rect of the same dimension does contain 149, 51", () => {
			expect(rect.contains(149, 51)).toEqual(true);
		});
		it("a rect of the same dimension does contain 149, 149", () => {
			expect(rect.contains(149, 149)).toEqual(true);
		});

		it("rrect does not contain 51, 51", () => {
			expect(rrect.contains(51, 51)).toEqual(false);
		});
		it("rrect does not contain 51, 149", () => {
			expect(rrect.contains(51, 149)).toEqual(false);
		});
		it("rrect does not contain 149, 51", () => {
			expect(rrect.contains(149, 51)).toEqual(false);
		});
		it("rrect does not contain 149, 149", () => {
			expect(rrect.contains(149, 149)).toEqual(false);
		});

		it("should contain another Rect fully within", () => {
			const innerRRect = new RoundRect(100, 100, 10, 10, 10);
			expect(rrect.containsRectangle(innerRRect)).toEqual(true);
		});

		it("should not contain another Rect partially outside", () => {
			const innerRRect = new RoundRect(75, 75, 175, 25, 10);
			expect(rrect.containsRectangle(innerRRect)).toEqual(false);
		});
	});

	describe("copy, clone & equality", () => {
		let _rect: RoundRect;
		beforeEach(() => {
			pool.register("Vector2d", Vector2d, true);
			_rect = new RoundRect(1, 1, 1, 1);
			_rect.copy(rrect);
		});

		it("copy rrect size, position radius", () => {
			expect(_rect.equals(rrect)).toEqual(true);
		});
		it("clone rect and test radius", () => {
			const cloneRect = _rect.clone();
			expect(cloneRect.radius).toEqual(40);
		});
	});

	describe("properties and getters", () => {
		it("should have type 'RoundRect'", () => {
			expect(rrect.type).toEqual("RoundRect");
		});

		it("should return correct left/right/top/bottom", () => {
			expect(rrect.left).toEqual(50);
			expect(rrect.right).toEqual(150);
			expect(rrect.top).toEqual(50);
			expect(rrect.bottom).toEqual(150);
		});

		it("should return correct centerX/centerY", () => {
			expect(rrect.centerX).toEqual(100);
			expect(rrect.centerY).toEqual(100);
		});

		it("should update width via setter", () => {
			rrect.width = 200;
			expect(rrect.width).toEqual(200);
			expect(rrect.right).toEqual(250);
		});

		it("should update height via setter", () => {
			rrect.height = 200;
			expect(rrect.height).toEqual(200);
			expect(rrect.bottom).toEqual(250);
		});

		it("should update via setSize", () => {
			rrect.setSize(80, 60);
			expect(rrect.width).toEqual(80);
			expect(rrect.height).toEqual(60);
		});

		it("should update via resize", () => {
			rrect.resize(80, 60);
			expect(rrect.width).toEqual(80);
			expect(rrect.height).toEqual(60);
		});

		it("should reclamp radius when size shrinks", () => {
			rrect.setSize(20, 20);
			expect(rrect.radius).toEqual(10); // clamped to 20/2
		});

		it("radius should not exceed half the shorter side", () => {
			const rr = new RoundRect(0, 0, 30, 50, 100);
			expect(rr.radius).toEqual(15); // 30/2
		});

		it("should clamp radius when width shrinks via setter", () => {
			const rr = new RoundRect(0, 0, 100, 100, 40);
			rr.width = 20;
			expect(rr.radius).toEqual(10); // clamped to 20/2
		});

		it("should clamp radius when height shrinks via setter", () => {
			const rr = new RoundRect(0, 0, 100, 100, 40);
			rr.height = 30;
			expect(rr.radius).toEqual(15); // clamped to 30/2
		});

		it("should clamp negative radius to 0", () => {
			const rr = new RoundRect(0, 0, 100, 100, -10);
			expect(rr.radius).toEqual(0);
		});

		it("should clamp negative radius to 0 via setter", () => {
			const rr = new RoundRect(0, 0, 100, 100, 20);
			rr.radius = -5;
			expect(rr.radius).toEqual(0);
			expect(rr.points.length).toEqual(4); // plain rectangle
		});
	});

	describe("contains — corner edge cases", () => {
		// rrect is at (50, 50) size 100x100 radius 40
		// corners are at: TL(50,50), TR(150,50), BL(50,150), BR(150,150)
		// inner safe zone starts at radius offset from corners

		it("should contain center point", () => {
			expect(rrect.contains(100, 100)).toEqual(true);
		});

		it("should contain point on the top edge center", () => {
			expect(rrect.contains(100, 51)).toEqual(true);
		});

		it("should contain point on the left edge center", () => {
			expect(rrect.contains(51, 100)).toEqual(true);
		});

		it("should contain point on the right edge center", () => {
			expect(rrect.contains(149, 100)).toEqual(true);
		});

		it("should contain point on the bottom edge center", () => {
			expect(rrect.contains(100, 149)).toEqual(true);
		});

		it("should not contain point outside bounding box", () => {
			expect(rrect.contains(49, 100)).toEqual(false);
			expect(rrect.contains(151, 100)).toEqual(false);
			expect(rrect.contains(100, 49)).toEqual(false);
			expect(rrect.contains(100, 151)).toEqual(false);
		});

		it("should not contain corner points (in rounded area)", () => {
			// all four corners should be outside the rounded area
			expect(rrect.contains(51, 51)).toEqual(false);
			expect(rrect.contains(149, 51)).toEqual(false);
			expect(rrect.contains(51, 149)).toEqual(false);
			expect(rrect.contains(149, 149)).toEqual(false);
		});

		it("should contain point just inside the rounded corner", () => {
			// radius 40, corner center at (90, 90)
			// point at (90, 90) is the corner arc center — inside
			expect(rrect.contains(90, 90)).toEqual(true);
		});

		it("should contain point using Vector2d overload", () => {
			expect(rrect.contains(new Vector2d(100, 100))).toEqual(true);
		});

		it("should not contain point using Vector2d overload (corner)", () => {
			expect(rrect.contains(new Vector2d(51, 51))).toEqual(false);
		});

		it("should handle radius=0 like a plain rectangle (corners included)", () => {
			const rr = new RoundRect(0, 0, 100, 100, 0);
			expect(rr.contains(0, 0)).toEqual(true);
			expect(rr.contains(99, 99)).toEqual(true);
			expect(rr.contains(1, 1)).toEqual(true);
		});

		it("should handle maximum radius (fully rounded = circle-like)", () => {
			const rr = new RoundRect(0, 0, 100, 100, 50);
			// center
			expect(rr.contains(50, 50)).toEqual(true);
			// edge midpoints
			expect(rr.contains(50, 1)).toEqual(true);
			expect(rr.contains(99, 50)).toEqual(true);
			// corners should be outside (circle inscribed in square)
			expect(rr.contains(1, 1)).toEqual(false);
			expect(rr.contains(99, 1)).toEqual(false);
			expect(rr.contains(1, 99)).toEqual(false);
			expect(rr.contains(99, 99)).toEqual(false);
		});
	});

	describe("containsRectangle — additional cases", () => {
		it("should contain a small rect at the center", () => {
			const inner = new RoundRect(90, 90, 20, 20, 5);
			expect(rrect.containsRectangle(inner)).toEqual(true);
		});

		it("should not contain a rect that extends beyond right edge", () => {
			const outer = new RoundRect(100, 100, 60, 10, 5);
			expect(rrect.containsRectangle(outer)).toEqual(false);
		});

		it("should not contain a rect that extends beyond bottom edge", () => {
			const outer = new RoundRect(100, 100, 10, 60, 5);
			expect(rrect.containsRectangle(outer)).toEqual(false);
		});

		it("should contain itself", () => {
			expect(rrect.containsRectangle(rrect)).toEqual(true);
		});

		it("should accept a Rect (not just RoundRect)", () => {
			const inner = new Rect(90, 90, 20, 20);
			expect(rrect.containsRectangle(inner)).toEqual(true);
		});

		it("should accept any object with left/right/top/bottom", () => {
			expect(
				rrect.containsRectangle({ left: 90, right: 110, top: 90, bottom: 110 }),
			).toEqual(true);
		});
	});

	describe("copy, clone & equality — additional cases", () => {
		it("clone should produce an independent copy", () => {
			const clone = rrect.clone();
			clone.radius = 10;
			expect(rrect.radius).toEqual(40); // original unchanged
			expect(clone.radius).toEqual(10);
		});

		it("equals should return false for different radius", () => {
			const other = new RoundRect(50, 50, 100, 100, 20);
			expect(rrect.equals(other)).toEqual(false);
		});

		it("equals should return false for different position", () => {
			const other = new RoundRect(0, 0, 100, 100, 40);
			expect(rrect.equals(other)).toEqual(false);
		});

		it("equals should return false for different size", () => {
			const other = new RoundRect(50, 50, 80, 100, 40);
			expect(rrect.equals(other)).toEqual(false);
		});

		it("equals should return true for identical rrect", () => {
			const other = new RoundRect(50, 50, 100, 100, 40);
			expect(rrect.equals(other)).toEqual(true);
		});

		it("copy should update all properties", () => {
			const src = new RoundRect(10, 20, 200, 300, 15);
			const dest = new RoundRect(0, 0, 1, 1, 0);
			dest.copy(src);
			expect(dest.pos.x).toEqual(10);
			expect(dest.pos.y).toEqual(20);
			expect(dest.width).toEqual(200);
			expect(dest.height).toEqual(300);
			expect(dest.radius).toEqual(15);
		});
	});

	describe("polygon approximation", () => {
		it("should have more than 4 vertices when radius > 0", () => {
			const rr = new RoundRect(0, 0, 100, 100, 20);
			expect(rr.points.length).toBeGreaterThan(4);
		});

		it("should have exactly 4 vertices when radius is 0 (plain rectangle)", () => {
			const rr = new RoundRect(0, 0, 100, 100, 0);
			expect(rr.points.length).toEqual(4);
		});

		it("should form a closed convex polygon", () => {
			const rr = new RoundRect(0, 0, 100, 100, 20);
			expect(rr.isConvex()).toEqual(true);
		});

		it("should update vertices when radius changes", () => {
			const rr = new RoundRect(0, 0, 100, 100, 0);
			const countBefore = rr.points.length;
			rr.radius = 20;
			expect(rr.points.length).toBeGreaterThan(countBefore);
		});

		it("should update vertices when size changes", () => {
			const rr = new RoundRect(0, 0, 100, 100, 20);
			rr.setSize(200, 200);
			// should still have rounded vertices
			expect(rr.points.length).toBeGreaterThan(4);
		});

		it("should clamp radius to half the shorter side", () => {
			const rr = new RoundRect(0, 0, 60, 40, 100);
			// radius should be clamped to 20 (40/2)
			expect(rr.radius).toEqual(20);
		});

		it("capsule shape: radius = min(w,h)/2 should produce a valid convex polygon", () => {
			// horizontal capsule
			const hCapsule = new RoundRect(0, 0, 100, 40, 20);
			expect(hCapsule.isConvex()).toEqual(true);
			expect(hCapsule.points.length).toBeGreaterThan(4);

			// vertical capsule
			const vCapsule = new RoundRect(0, 0, 40, 100, 20);
			expect(vCapsule.isConvex()).toEqual(true);
			expect(vCapsule.points.length).toBeGreaterThan(4);

			// square capsule (circle-ish)
			const sCapsule = new RoundRect(0, 0, 50, 50, 25);
			expect(sCapsule.isConvex()).toEqual(true);
			expect(sCapsule.points.length).toBeGreaterThan(4);
		});

		it("all vertices should be within the bounding box", () => {
			const rr = new RoundRect(0, 0, 100, 60, 15);
			for (const pt of rr.points) {
				expect(pt.x).toBeGreaterThanOrEqual(0);
				expect(pt.x).toBeLessThanOrEqual(100);
				expect(pt.y).toBeGreaterThanOrEqual(0);
				expect(pt.y).toBeLessThanOrEqual(60);
			}
		});
	});

	describe("bounds updates", () => {
		it("should update bounds after setSize", () => {
			const rr = new RoundRect(100, 200, 50, 30, 10);
			rr.setSize(80, 60);
			const bounds = rr.getBounds();
			expect(bounds.x).toEqual(100);
			expect(bounds.y).toEqual(200);
			expect(bounds.width).toEqual(80);
			expect(bounds.height).toEqual(60);
		});

		it("should update bounds after pos.set + setSize", () => {
			const rr = new RoundRect(0, 0, 1, 1, 0);
			rr.pos.set(300, 400);
			rr.setSize(50, 30);
			const bounds = rr.getBounds();
			expect(bounds.x).toEqual(300);
			expect(bounds.y).toEqual(400);
			expect(bounds.width).toEqual(50);
			expect(bounds.height).toEqual(30);
		});

		it("should update bounds after copy", () => {
			const src = new RoundRect(100, 200, 80, 60, 15);
			const dst = new RoundRect(0, 0, 1, 1, 0);
			dst.copy(src);
			const bounds = dst.getBounds();
			expect(bounds.x).toEqual(100);
			expect(bounds.y).toEqual(200);
			expect(bounds.width).toEqual(80);
			expect(bounds.height).toEqual(60);
		});
	});

	describe("vertex reuse optimization", () => {
		it("should reuse vertex objects when radius stays > 0 and size changes", () => {
			const rr = new RoundRect(0, 0, 100, 100, 20);
			const originalPoints = rr.points;
			const firstPoint = rr.points[0];
			rr.setSize(200, 150);
			// same array reference (vertices reused, not reallocated)
			expect(rr.points).toBe(originalPoints);
			// same Vector2d instance, just updated values
			expect(rr.points[0]).toBe(firstPoint);
		});

		it("should reuse vertex objects when radius changes but stays > 0", () => {
			const rr = new RoundRect(0, 0, 100, 100, 10);
			const originalPoints = rr.points;
			const vertexCount = rr.points.length;
			rr.radius = 30;
			// same vertex count, same array
			expect(rr.points.length).toEqual(vertexCount);
			expect(rr.points).toBe(originalPoints);
		});

		it("should reallocate when switching from radius=0 to radius>0", () => {
			const rr = new RoundRect(0, 0, 100, 100, 0);
			expect(rr.points.length).toEqual(4);
			rr.radius = 20;
			// vertex count changes, must reallocate
			expect(rr.points.length).toBeGreaterThan(4);
		});

		it("should reallocate when switching from radius>0 to radius=0", () => {
			const rr = new RoundRect(0, 0, 100, 100, 20);
			expect(rr.points.length).toBeGreaterThan(4);
			rr.radius = 0;
			expect(rr.points.length).toEqual(4);
		});

		it("should maintain valid convex polygon after multiple size changes", () => {
			const rr = new RoundRect(0, 0, 100, 100, 20);
			rr.setSize(50, 200);
			expect(rr.isConvex()).toEqual(true);
			rr.setSize(300, 30);
			expect(rr.isConvex()).toEqual(true);
			rr.setSize(60, 60);
			expect(rr.isConvex()).toEqual(true);
		});

		it("should maintain valid polygon after multiple radius changes", () => {
			const rr = new RoundRect(0, 0, 100, 100, 10);
			rr.radius = 50; // max radius for 100x100
			expect(rr.isConvex()).toEqual(true);
			rr.radius = 1; // very small
			expect(rr.isConvex()).toEqual(true);
			rr.radius = 25; // mid
			expect(rr.isConvex()).toEqual(true);
		});

		it("vertices should be correct after reuse (not stale values)", () => {
			const rr = new RoundRect(0, 0, 100, 100, 20);
			rr.setSize(50, 50);
			// all vertices should be within the new bounds
			for (const pt of rr.points) {
				expect(pt.x).toBeGreaterThanOrEqual(-0.001);
				expect(pt.x).toBeLessThanOrEqual(50.001);
				expect(pt.y).toBeGreaterThanOrEqual(-0.001);
				expect(pt.y).toBeLessThanOrEqual(50.001);
			}
		});

		it("should handle very small dimensions", () => {
			const rr = new RoundRect(0, 0, 2, 2, 1);
			expect(rr.isConvex()).toEqual(true);
			expect(rr.width).toEqual(2);
			expect(rr.height).toEqual(2);
			expect(rr.radius).toEqual(1);
		});

		it("should handle very large dimensions", () => {
			const rr = new RoundRect(0, 0, 10000, 5000, 500);
			expect(rr.isConvex()).toEqual(true);
			for (const pt of rr.points) {
				expect(pt.x).toBeGreaterThanOrEqual(0);
				expect(pt.x).toBeLessThanOrEqual(10000);
				expect(pt.y).toBeGreaterThanOrEqual(0);
				expect(pt.y).toBeLessThanOrEqual(5000);
			}
		});

		it("should clamp radius when size shrinks below 2*radius", () => {
			const rr = new RoundRect(0, 0, 100, 100, 40);
			expect(rr.radius).toEqual(40);
			rr.setSize(30, 30);
			// radius should be clamped to 15
			expect(rr.radius).toEqual(15);
			expect(rr.isConvex()).toEqual(true);
		});

		it("width/height should be correct after radius=0 to radius>0 transition", () => {
			const rr = new RoundRect(0, 0, 80, 60, 0);
			expect(rr.width).toEqual(80);
			expect(rr.height).toEqual(60);
			rr.radius = 10;
			expect(rr.width).toEqual(80);
			expect(rr.height).toEqual(60);
			expect(rr.left).toEqual(0);
			expect(rr.right).toEqual(80);
			expect(rr.top).toEqual(0);
			expect(rr.bottom).toEqual(60);
		});

		it("contains should work correctly after vertex reuse", () => {
			const rr = new RoundRect(0, 0, 100, 100, 30);
			rr.setSize(200, 200);
			rr.radius = 50;
			// center should be inside
			expect(rr.contains(100, 100)).toEqual(true);
			// corners should be outside (radius=50 on 200x200)
			expect(rr.contains(1, 1)).toEqual(false);
			// edge center should be inside
			expect(rr.contains(100, 1)).toEqual(true);
		});
	});
});
