import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Ellipse, Matrix2d, Vector2d } from "../src";

describe("Shape : Ellipse", () => {
	describe("Circle (equal radii)", () => {
		let circle: Ellipse;

		beforeAll(() => {
			circle = new Ellipse(50, 50, 100, 100);
		});

		it("max radius is 50", () => {
			expect(circle.radius).toEqual(50);
		});

		it("x radius is 50", () => {
			expect(circle.radiusV.x).toEqual(50);
		});

		it("y radius is 50", () => {
			expect(circle.radiusV.y).toEqual(50);
		});

		it("pos is (50, 50)", () => {
			expect(circle.pos.x).toEqual(50);
			expect(circle.pos.y).toEqual(50);
		});

		it("angle is 0", () => {
			expect(circle.angle).toEqual(0);
		});

		it("contains center point", () => {
			expect(circle.contains(50, 50)).toEqual(true);
		});

		it("contains (75, 75)", () => {
			expect(circle.contains(75, 75)).toEqual(true);
		});

		it("does not contain (75, 500)", () => {
			expect(circle.contains(75, 500)).toEqual(false);
		});

		it("contains point on the edge", () => {
			expect(circle.contains(100, 50)).toEqual(true);
			expect(circle.contains(50, 0)).toEqual(true);
		});

		it("does not contain point just outside", () => {
			expect(circle.contains(101, 50)).toEqual(false);
		});

		it("contains with Vector2d argument", () => {
			expect(circle.contains(new Vector2d(50, 50))).toEqual(true);
			expect(circle.contains(new Vector2d(200, 200))).toEqual(false);
		});
	});

	describe("Ellipse (unequal radii)", () => {
		let ellipse: Ellipse;

		beforeEach(() => {
			ellipse = new Ellipse(0, 0, 200, 100);
		});

		it("max radius is 100 (half of width)", () => {
			expect(ellipse.radius).toEqual(100);
		});

		it("x radius is 100, y radius is 50", () => {
			expect(ellipse.radiusV.x).toEqual(100);
			expect(ellipse.radiusV.y).toEqual(50);
		});

		it("contains point along the semi-major axis", () => {
			expect(ellipse.contains(90, 0)).toEqual(true);
		});

		it("does not contain point beyond semi-minor axis", () => {
			expect(ellipse.contains(0, 51)).toEqual(false);
		});

		it("contains point inside the ellipse", () => {
			expect(ellipse.contains(50, 30)).toEqual(true);
		});

		it("does not contain point at corner of bounding box", () => {
			expect(ellipse.contains(100, 50)).toEqual(false);
		});
	});

	describe("Bounding Rect", () => {
		it("circle bounds are correct", () => {
			const circle = new Ellipse(50, 50, 100, 100);
			const bounds = circle.getBounds();
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(100);
			expect(bounds.x).toEqual(0);
			expect(bounds.y).toEqual(0);
		});

		it("ellipse bounds are correct", () => {
			const ellipse = new Ellipse(100, 50, 200, 100);
			const bounds = ellipse.getBounds();
			expect(bounds.width).toEqual(200);
			expect(bounds.height).toEqual(100);
			expect(bounds.x).toEqual(0);
			expect(bounds.y).toEqual(0);
		});

		it("origin ellipse bounds are centered", () => {
			const ellipse = new Ellipse(0, 0, 60, 40);
			const bounds = ellipse.getBounds();
			expect(bounds.x).toEqual(-30);
			expect(bounds.y).toEqual(-20);
			expect(bounds.width).toEqual(60);
			expect(bounds.height).toEqual(40);
		});
	});

	describe("setShape", () => {
		it("resets angle to 0", () => {
			const ellipse = new Ellipse(0, 0, 100, 50);
			ellipse.rotate(Math.PI / 4);
			expect(ellipse.angle).not.toEqual(0);
			ellipse.setShape(0, 0, 100, 50);
			expect(ellipse.angle).toEqual(0);
		});

		it("updates all properties", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			ellipse.setShape(10, 20, 60, 40);
			expect(ellipse.pos.x).toEqual(10);
			expect(ellipse.pos.y).toEqual(20);
			expect(ellipse.radiusV.x).toEqual(30);
			expect(ellipse.radiusV.y).toEqual(20);
		});
	});

	describe("translate", () => {
		it("translates by x, y", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			ellipse.translate(10, 20);
			expect(ellipse.pos.x).toEqual(10);
			expect(ellipse.pos.y).toEqual(20);
		});

		it("translates by Vector2d", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			ellipse.translate(new Vector2d(5, 15));
			expect(ellipse.pos.x).toEqual(5);
			expect(ellipse.pos.y).toEqual(15);
		});

		it("updates bounds after translate", () => {
			const ellipse = new Ellipse(0, 0, 60, 40);
			ellipse.translate(100, 200);
			const bounds = ellipse.getBounds();
			expect(bounds.x).toEqual(70);
			expect(bounds.y).toEqual(180);
		});
	});

	describe("scale", () => {
		it("scales uniformly", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			ellipse.scale(2);
			expect(ellipse.radiusV.x).toEqual(100);
			expect(ellipse.radiusV.y).toEqual(100);
		});

		it("scales non-uniformly", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			ellipse.scale(2, 0.5);
			expect(ellipse.radiusV.x).toEqual(100);
			expect(ellipse.radiusV.y).toEqual(25);
		});

		it("scaleV with vector", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			ellipse.scaleV(new Vector2d(3, 2));
			expect(ellipse.radiusV.x).toEqual(150);
			expect(ellipse.radiusV.y).toEqual(100);
		});

		it("updates bounds after scale", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			ellipse.scale(2);
			const bounds = ellipse.getBounds();
			expect(bounds.width).toEqual(200);
			expect(bounds.height).toEqual(200);
		});
	});

	describe("rotate", () => {
		it("accumulates rotation angle", () => {
			const ellipse = new Ellipse(0, 0, 100, 50);
			ellipse.rotate(Math.PI / 4);
			expect(ellipse.angle).toBeCloseTo(Math.PI / 4);
			ellipse.rotate(Math.PI / 4);
			expect(ellipse.angle).toBeCloseTo(Math.PI / 2);
		});

		it("circle rotation does not change bounds size", () => {
			const circle = new Ellipse(50, 50, 100, 100);
			circle.rotate(Math.PI / 3);
			const bounds = circle.getBounds();
			expect(bounds.width).toBeCloseTo(100);
			expect(bounds.height).toBeCloseTo(100);
		});

		it("90° rotation swaps ellipse bounds dimensions", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			ellipse.rotate(Math.PI / 2);
			const bounds = ellipse.getBounds();
			expect(bounds.width).toBeCloseTo(100);
			expect(bounds.height).toBeCloseTo(200);
		});

		it("45° rotation produces correct bounds for ellipse", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			ellipse.rotate(Math.PI / 4);
			const bounds = ellipse.getBounds();
			// at 45°, both axes contribute equally, so bounds should be square-ish
			const rx = 100;
			const ry = 50;
			const cos = Math.cos(Math.PI / 4);
			const sin = Math.sin(Math.PI / 4);
			const expectedW =
				2 * Math.sqrt(rx * rx * cos * cos + ry * ry * sin * sin);
			const expectedH =
				2 * Math.sqrt(rx * rx * sin * sin + ry * ry * cos * cos);
			expect(bounds.width).toBeCloseTo(expectedW);
			expect(bounds.height).toBeCloseTo(expectedH);
		});

		it("rotates position around an external point", () => {
			const ellipse = new Ellipse(100, 0, 50, 50);
			const pivot = new Vector2d(0, 0);
			ellipse.rotate(Math.PI / 2, pivot);
			expect(ellipse.pos.x).toBeCloseTo(0);
			expect(ellipse.pos.y).toBeCloseTo(100);
		});

		it("does not move position when no pivot is given", () => {
			const ellipse = new Ellipse(100, 200, 50, 50);
			ellipse.rotate(Math.PI / 3);
			expect(ellipse.pos.x).toEqual(100);
			expect(ellipse.pos.y).toEqual(200);
		});

		it("returns this for chaining", () => {
			const ellipse = new Ellipse(0, 0, 100, 50);
			expect(ellipse.rotate(0.1)).toBe(ellipse);
		});
	});

	describe("contains with rotation", () => {
		it("point along original major axis is outside after 90° rotation", () => {
			// ellipse with rx=100, ry=50 centered at origin
			const ellipse = new Ellipse(0, 0, 200, 100);
			// before rotation, (90, 0) is inside
			expect(ellipse.contains(90, 0)).toEqual(true);
			// after 90° rotation, major axis is now vertical
			ellipse.rotate(Math.PI / 2);
			// (90, 0) is now along the minor axis (ry=50), so it's outside
			expect(ellipse.contains(90, 0)).toEqual(false);
		});

		it("point along new major axis is inside after 90° rotation", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			ellipse.rotate(Math.PI / 2);
			// after 90° rotation, major axis is vertical
			expect(ellipse.contains(0, 90)).toEqual(true);
		});

		it("contains center regardless of rotation", () => {
			const ellipse = new Ellipse(50, 50, 200, 100);
			ellipse.rotate(1.23);
			expect(ellipse.contains(50, 50)).toEqual(true);
		});

		it("point on rotated ellipse boundary", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			ellipse.rotate(Math.PI / 4);
			// point at 45° along the original major axis, rotated by 45°
			const rx = 100;
			const angle = Math.PI / 4;
			const px = rx * Math.cos(angle);
			const py = rx * Math.sin(angle);
			// this point should be on the ellipse edge (just inside due to floating point)
			expect(ellipse.contains(px * 0.99, py * 0.99)).toEqual(true);
			// just outside
			expect(ellipse.contains(px * 1.01, py * 1.01)).toEqual(false);
		});
	});

	describe("contains after transform", () => {
		it("contains center after scale transform", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			const m = new Matrix2d();
			m.scale(2, 3);
			ellipse.transform(m);
			expect(ellipse.contains(0, 0)).toEqual(true);
		});

		it("contains point along scaled axis", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			const m = new Matrix2d();
			m.scale(2, 1);
			ellipse.transform(m);
			// rx is now 100, ry is still 50
			expect(ellipse.contains(95, 0)).toEqual(true);
			expect(ellipse.contains(0, 45)).toEqual(true);
			expect(ellipse.contains(0, 55)).toEqual(false);
		});

		it("contains works after rotation transform", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			const m = new Matrix2d();
			m.rotate(Math.PI / 2);
			ellipse.transform(m);
			// after 90° rotation, major axis is vertical
			expect(ellipse.contains(0, 90)).toEqual(true);
			expect(ellipse.contains(90, 0)).toEqual(false);
		});

		it("contains works after translation transform", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			const m = new Matrix2d();
			m.translate(50, 50);
			ellipse.transform(m);
			// center moved to (50, 50)
			expect(ellipse.contains(50, 50)).toEqual(true);
			expect(ellipse.contains(0, 0)).toEqual(false);
		});

		it("contains works after combined scale + rotation transform", () => {
			// start with a circle of radius 50
			const ellipse = new Ellipse(0, 0, 100, 100);
			const m = new Matrix2d();
			m.scale(2, 1);
			m.rotate(Math.PI / 2);
			ellipse.transform(m);
			// matrix decomposition: sx=1, sy=2, rotation=π/2
			// radii become rx=50, ry=100, rotated 90°
			// un-rotating by -90°: horizontal→vertical, vertical→horizontal
			// so effective: 50 along vertical, 100 along horizontal
			expect(ellipse.contains(0, 0)).toEqual(true);
			expect(ellipse.contains(95, 0)).toEqual(true);
			expect(ellipse.contains(105, 0)).toEqual(false);
			expect(ellipse.contains(0, 45)).toEqual(true);
			expect(ellipse.contains(0, 55)).toEqual(false);
		});

		it("contains after multiple successive transforms", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			// first rotate 45°
			ellipse.rotate(Math.PI / 4);
			// then apply a scale transform
			const m = new Matrix2d();
			m.scale(1.5, 1.5);
			ellipse.transform(m);
			// center should still be contained
			expect(ellipse.contains(0, 0)).toEqual(true);
			// rx was 100, now 150; ry was 50, now 75; angle is 45°
			// point along the 45° direction (rotated major axis)
			const dist = 140;
			const px = dist * Math.cos(Math.PI / 4);
			const py = dist * Math.sin(Math.PI / 4);
			expect(ellipse.contains(px, py)).toEqual(true);
			// beyond the major axis
			const dist2 = 160;
			const px2 = dist2 * Math.cos(Math.PI / 4);
			const py2 = dist2 * Math.sin(Math.PI / 4);
			expect(ellipse.contains(px2, py2)).toEqual(false);
		});
	});

	describe("contains after translate", () => {
		it("contains shifted center after translate", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			ellipse.translate(50, 50);
			expect(ellipse.contains(50, 50)).toEqual(true);
			expect(ellipse.contains(0, 0)).toEqual(false);
		});

		it("contains point near edge after translate", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			ellipse.translate(100, 100);
			// rx=100, ry=50, center at (100,100)
			expect(ellipse.contains(195, 100)).toEqual(true);
			expect(ellipse.contains(205, 100)).toEqual(false);
			expect(ellipse.contains(100, 145)).toEqual(true);
			expect(ellipse.contains(100, 155)).toEqual(false);
		});
	});

	describe("contains after scale", () => {
		it("contains point within scaled ellipse", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			ellipse.scale(2);
			// radius is now 100
			expect(ellipse.contains(95, 0)).toEqual(true);
			expect(ellipse.contains(105, 0)).toEqual(false);
		});

		it("contains works after non-uniform scale", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			ellipse.scale(2, 0.5);
			// rx=100, ry=25
			expect(ellipse.contains(95, 0)).toEqual(true);
			expect(ellipse.contains(0, 20)).toEqual(true);
			expect(ellipse.contains(0, 30)).toEqual(false);
		});
	});

	describe("contains edge cases", () => {
		it("full 360° rotation returns to original behavior", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			// before rotation
			expect(ellipse.contains(90, 0)).toEqual(true);
			expect(ellipse.contains(0, 45)).toEqual(true);
			// rotate full circle
			ellipse.rotate(Math.PI * 2);
			// should behave the same
			expect(ellipse.contains(90, 0)).toEqual(true);
			expect(ellipse.contains(0, 45)).toEqual(true);
			expect(ellipse.contains(0, 55)).toEqual(false);
		});

		it("translate + rotate combined", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			ellipse.translate(100, 100);
			ellipse.rotate(Math.PI / 2);
			// center at (100,100), rx=100 now vertical, ry=50 now horizontal
			expect(ellipse.contains(100, 100)).toEqual(true);
			expect(ellipse.contains(100, 195)).toEqual(true);
			expect(ellipse.contains(100, 205)).toEqual(false);
			expect(ellipse.contains(145, 100)).toEqual(true);
			expect(ellipse.contains(155, 100)).toEqual(false);
		});

		it("contains on cloned rotated ellipse", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			ellipse.rotate(Math.PI / 2);
			const cloned = ellipse.clone();
			// cloned should have same contains behavior
			expect(cloned.contains(0, 90)).toEqual(true);
			expect(cloned.contains(90, 0)).toEqual(false);
		});
	});

	describe("transform", () => {
		it("applies translation from matrix", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			const m = new Matrix2d();
			m.translate(50, 30);
			ellipse.transform(m);
			expect(ellipse.pos.x).toBeCloseTo(50);
			expect(ellipse.pos.y).toBeCloseTo(30);
		});

		it("applies scale from matrix", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			const m = new Matrix2d();
			m.scale(2, 3);
			ellipse.transform(m);
			expect(ellipse.radiusV.x).toBeCloseTo(100);
			expect(ellipse.radiusV.y).toBeCloseTo(150);
		});

		it("applies rotation from matrix", () => {
			const ellipse = new Ellipse(0, 0, 100, 50);
			const m = new Matrix2d();
			m.rotate(Math.PI / 2);
			ellipse.transform(m);
			expect(ellipse.angle).toBeCloseTo(Math.PI / 2);
		});

		it("applies combined scale + rotation + translation", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			const m = new Matrix2d();
			m.scale(2, 2);
			m.rotate(Math.PI / 4);
			m.translate(10, 20);
			ellipse.transform(m);
			expect(ellipse.radiusV.x).toBeCloseTo(100);
			expect(ellipse.radiusV.y).toBeCloseTo(100);
			expect(ellipse.angle).toBeCloseTo(Math.PI / 4);
		});

		it("updates bounds after transform", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			const m = new Matrix2d();
			m.scale(2, 2);
			ellipse.transform(m);
			const bounds = ellipse.getBounds();
			expect(bounds.width).toBeCloseTo(200);
			expect(bounds.height).toBeCloseTo(200);
		});

		it("returns this for chaining", () => {
			const ellipse = new Ellipse(0, 0, 100, 50);
			const m = new Matrix2d();
			expect(ellipse.transform(m)).toBe(ellipse);
		});
	});

	describe("clone", () => {
		it("creates an independent copy", () => {
			const ellipse = new Ellipse(10, 20, 60, 40);
			const cloned = ellipse.clone();
			expect(cloned.pos.x).toEqual(10);
			expect(cloned.pos.y).toEqual(20);
			expect(cloned.radiusV.x).toEqual(30);
			expect(cloned.radiusV.y).toEqual(20);
			// modifying original does not affect clone
			ellipse.translate(100, 100);
			expect(cloned.pos.x).toEqual(10);
		});

		it("preserves rotation angle", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			ellipse.rotate(Math.PI / 3);
			const cloned = ellipse.clone();
			expect(cloned.angle).toBeCloseTo(Math.PI / 3);
		});

		it("cloned ellipse has correct bounds with rotation", () => {
			const ellipse = new Ellipse(0, 0, 200, 100);
			ellipse.rotate(Math.PI / 2);
			const cloned = ellipse.clone();
			const bounds = cloned.getBounds();
			expect(bounds.width).toBeCloseTo(100);
			expect(bounds.height).toBeCloseTo(200);
		});
	});

	describe("type", () => {
		it("type is 'Ellipse'", () => {
			const ellipse = new Ellipse(0, 0, 100, 100);
			expect(ellipse.type).toEqual("Ellipse");
		});
	});
});
