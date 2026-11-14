/**
 * Scaling a rotated Ellipse keeps its rotation.
 *
 * `Ellipse.scale()` (and `scaleV()`, which calls it) rebuilt the shape with
 * `setShape()`, which defines a new, unrotated ellipse: it reset `_angle`,
 * `_cos` and `_sin`, so a rotated ellipse snapped back to its axes, its
 * bounds and `contains()` answered for the unrotated shape, and the cached
 * polygon was rebuilt unrotated.
 *
 * `scale()` now restores the angle. The factors apply along the ellipse's own
 * axes (the radii it was given), which is the only scale a rotated ellipse can
 * take and stay an ellipse at the same angle.
 */
import { describe, expect, it } from "vitest";
import { Ellipse, Vector2d } from "../src/index.js";

describe("Shape : Ellipse scale keeps the rotation", () => {
	it("a uniform scale of a rotated ellipse keeps its angle", () => {
		const e = new Ellipse(0, 0, 100, 50);
		e.rotate(Math.PI / 2);
		e.scale(2);
		expect(e.angle).toBeCloseTo(Math.PI / 2);
		expect(e.radiusV.x).toBeCloseTo(100);
		expect(e.radiusV.y).toBeCloseTo(50);
	});

	it("contains() and the bounds follow the rotated, scaled shape", () => {
		const e = new Ellipse(0, 0, 100, 50); // rx 50, ry 25
		e.rotate(Math.PI / 2); // major axis now vertical
		expect(e.contains(0, 45)).toBe(true);
		expect(e.contains(45, 0)).toBe(false);
		e.scale(2); // rx 100 along the major axis, ry 50
		expect(e.contains(0, 95)).toBe(true);
		expect(e.contains(95, 0)).toBe(false);
		expect(e.getBounds().width).toBeCloseTo(100);
		expect(e.getBounds().height).toBeCloseTo(200);
		expect(e.getBounds().left).toBeCloseTo(-50);
		expect(e.getBounds().top).toBeCloseTo(-100);
	});

	it("a non-uniform scale applies along the ellipse's own axes", () => {
		const e = new Ellipse(10, 20, 100, 50); // rx 50, ry 25
		e.rotate(Math.PI / 2);
		e.scale(2, 1); // the 50 radius (now vertical) doubles
		expect(e.angle).toBeCloseTo(Math.PI / 2);
		expect(e.radiusV.x).toBeCloseTo(100);
		expect(e.radiusV.y).toBeCloseTo(25);
		expect(e.pos.x).toBe(10);
		expect(e.pos.y).toBe(20);
		expect(e.getBounds().width).toBeCloseTo(50);
		expect(e.getBounds().height).toBeCloseTo(200);
		expect(e.contains(10, 20 + 95)).toBe(true);
		expect(e.contains(10 + 30, 20)).toBe(false);
	});

	it("scaleV keeps the rotation too", () => {
		const e = new Ellipse(0, 0, 100, 50);
		e.rotate(Math.PI / 4);
		e.scaleV(new Vector2d(0.5, 0.5));
		expect(e.angle).toBeCloseTo(Math.PI / 4);
		const halfW = e.getBounds().width / 2;
		// a 45° ellipse with radii 25 and 12.5: half-width sqrt((25² + 12.5²) / 2)
		expect(halfW).toBeCloseTo(Math.sqrt((25 * 25 + 12.5 * 12.5) / 2));
	});

	it("an arbitrary angle survives repeated scales, and the trig cache with it", () => {
		const angle = 0.7;
		const e = new Ellipse(0, 0, 80, 40);
		e.rotate(angle);
		const reference = new Ellipse(0, 0, 80 * 3, 40 * 3);
		reference.rotate(angle);
		e.scale(1.5).scale(2);
		expect(e.angle).toBeCloseTo(angle);
		expect(e.getBounds().width).toBeCloseTo(reference.getBounds().width);
		expect(e.getBounds().height).toBeCloseTo(reference.getBounds().height);
		// points on the rotated major axis, just inside and just outside
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		expect(e.contains(118 * c, 118 * s)).toBe(true);
		expect(e.contains(122 * c, 122 * s)).toBe(false);
	});

	it("the polygon approximation is rebuilt rotated", () => {
		const e = new Ellipse(0, 0, 100, 50);
		e.rotate(Math.PI / 2);
		e.toPolygon(); // cache it before the scale
		e.scale(2);
		const poly = e.toPolygon(4);
		// first point: (rx, 0) rotated a quarter turn, so straight down
		expect(poly.points[0].x).toBeCloseTo(0);
		expect(poly.points[0].y).toBeCloseTo(100);
	});

	it("an unrotated ellipse scales as before", () => {
		const e = new Ellipse(0, 0, 100, 50);
		e.scale(2, 3);
		expect(e.angle).toBe(0);
		expect(e.radiusV.x).toBe(100);
		expect(e.radiusV.y).toBe(75);
		expect(e.getBounds().width).toBe(200);
		expect(e.getBounds().height).toBe(150);
	});

	it("setShape still defines a new, unrotated ellipse", () => {
		const e = new Ellipse(0, 0, 100, 50);
		e.rotate(1);
		e.setShape(0, 0, 100, 50);
		expect(e.angle).toBe(0);
	});
});
