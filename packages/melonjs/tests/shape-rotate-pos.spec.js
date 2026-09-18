import { describe, expect, it } from "vitest";
import { Ellipse } from "../src/geometries/ellipse.ts";
import { Polygon } from "../src/geometries/polygon.ts";
import { Rect } from "../src/geometries/rectangle.ts";
import { Body, Renderable } from "../src/index.js";
import { Vector2d } from "../src/math/vector2d.ts";

/**
 * `rotate(angle, pivot)` on a shape whose offset lives in `pos`.
 *
 * A shape's world geometry is `pos + points[i]`, and only `Ellipse` was
 * rotating both halves — `Polygon` rotated its points and left `pos` where it
 * was, so an offset polygon span about its own local origin instead of the
 * pivot it was given. Two shapes at different offsets therefore drift apart
 * under the same call, which is what `Body#rotate` does to a body built from
 * several parts.
 *
 * The two forms carry identical world geometry, so they must land identically.
 */
describe("Polygon#rotate about a pivot, with a pos offset", () => {
	/**
	 * @param {Polygon} p - the shape to read
	 * @returns {string} its world-space points, rounded
	 */
	const world = (p) => {
		return p.points
			.map((v) => {
				return `${Math.round(p.pos.x + v.x)},${Math.round(p.pos.y + v.y)}`;
			})
			.join(" ");
	};

	const tri = () => {
		return [
			new Vector2d(40, -60),
			new Vector2d(60, -60),
			new Vector2d(60, -40),
		];
	};

	it("lands the same whether the offset is in pos or in points", () => {
		// identical geometry, expressed two ways
		const inPoints = new Polygon(0, 0, tri());
		const inPos = new Polygon(40, -60, [
			new Vector2d(0, 0),
			new Vector2d(20, 0),
			new Vector2d(20, 20),
		]);
		expect(world(inPos)).toBe(world(inPoints));

		const pivot = new Vector2d(0, 0);
		inPoints.rotate(Math.PI / 2, pivot);
		inPos.rotate(Math.PI / 2, pivot);
		expect(world(inPos)).toBe(world(inPoints));
	});

	it("agrees with Ellipse, which already rotated its pos", () => {
		// same signature, same meaning — a mixed shape list must not have its
		// parts disagree about what the pivot means
		const pivot = new Vector2d(10, 10);
		const e = new Ellipse(80, 40, 20, 20);
		const p = new Polygon(80, 40, [
			new Vector2d(0, 0),
			new Vector2d(1, 0),
			new Vector2d(1, 1),
		]);
		e.rotate(Math.PI / 2, pivot);
		p.rotate(Math.PI / 2, pivot);
		// the ellipse's centre and the polygon's first world point started at
		// the same place, so they must end at the same place
		expect(Math.round(p.pos.x + p.points[0].x)).toBe(Math.round(e.pos.x));
		expect(Math.round(p.pos.y + p.points[0].y)).toBe(Math.round(e.pos.y));
	});

	it("keeps two offset shapes joined", () => {
		// the reported symptom: parts of one body separating under rotation
		const a = new Polygon(0, -60, [
			new Vector2d(0, 0),
			new Vector2d(40, 0),
			new Vector2d(0, 40),
		]);
		const b = new Polygon(40, -60, [
			new Vector2d(0, 0),
			new Vector2d(0, 40),
			new Vector2d(-40, 40),
		]);
		// they share the edge (40,-60)..(0,-20) before
		const pivot = new Vector2d(0, 0);
		a.rotate(0.7, pivot);
		b.rotate(0.7, pivot);
		const aPts = a.points.map((v) => {
			return { x: a.pos.x + v.x, y: a.pos.y + v.y };
		});
		const bPts = b.points.map((v) => {
			return { x: b.pos.x + v.x, y: b.pos.y + v.y };
		});
		// the shared corner must still be shared
		const near = aPts.some((p) => {
			return bPts.some((q) => {
				return Math.hypot(p.x - q.x, p.y - q.y) < 1e-6;
			});
		});
		expect(near).toBe(true);
	});

	it("REGRESSION: a pos-less polygon rotates exactly as before", () => {
		// every existing caller passes pos = (0,0); their behaviour must not
		// shift by a single unit
		const p = new Polygon(0, 0, tri());
		p.rotate(Math.PI / 2, new Vector2d(0, 0));
		expect(world(p)).toBe("60,40 60,60 40,60");
	});

	it("Body#rotate moves an offset Rect part to the right place", () => {
		// the documented feet-plus-torso shape: `addShape` turns every Rect
		// into a Polygon whose offset lives in `pos`, so this is the case the
		// bug actually reaches
		const r = new Rect(0, 24, 32, 8);
		const poly = r.toPolygon();
		expect(poly.pos.x).toBe(0);
		expect(poly.pos.y).toBe(24);
		poly.rotate(Math.PI / 2, new Vector2d(16, 28));
		const pts = poly.points.map((v) => {
			return {
				x: Math.round(poly.pos.x + v.x),
				y: Math.round(poly.pos.y + v.y),
			};
		});
		// rotating (0,24) a quarter turn about (16,28) lands on (20,12)
		expect(pts).toContainEqual({ x: 20, y: 12 });
	});
});

/**
 * What the builtin adapter REPORTS, and why it deliberately differs from the
 * matter and planck adapters.
 *
 * The builtin's SAT never reads `body.angle` — `setAngle` only syncs the
 * visual transform — so a spinning sprite inside a stationary red hitbox is
 * the engine telling the truth about what it collides as. Making the overlay
 * follow the visual angle would turn an honest inconsistency into a confident
 * lie. `Body#rotate`, which DOES mutate the stored shapes, is the supported
 * way to collide rotated, and that is reported because the shapes really moved.
 */
describe("builtin: getBodyShapes reports what collides", () => {
	/**
	 * @returns {object} a renderable carrying a two-part body
	 */
	const bodied = () => {
		const r = new Renderable(100, 100, 64, 64);
		r.body = new Body(r, [new Rect(0, 0, 32, 8), new Rect(0, 24, 32, 8)]);
		return r;
	};

	it("setAngle does NOT move the reported shapes", () => {
		// visual-only: the SAT path never reads `body.angle`, so reporting a
		// rotated shape here would describe collision that does not happen
		const r = bodied();
		const before = r.body.shapes.map((s) => {
			return s.getBounds().left;
		});
		r.body.setAngle(Math.PI / 4);
		const after = r.body.shapes.map((s) => {
			return s.getBounds().left;
		});
		expect(after).toEqual(before);
	});

	it("rotate() DOES, because it moves the shapes themselves", () => {
		// the supported way to collide rotated on this backend
		const r = bodied();
		const before = r.body.shapes.map((s) => {
			return s.getBounds().left;
		});
		r.body.rotate(Math.PI / 2);
		const after = r.body.shapes.map((s) => {
			return s.getBounds().left;
		});
		expect(after).not.toEqual(before);
	});

	it("rotate() keeps a two-part body together", () => {
		// the offset parts are Rects, which `addShape` turns into Polygons
		// whose offset lives in `pos` — the case that used to pull apart
		const r = bodied();
		const gap = () => {
			const [a, b] = r.body.shapes.map((s) => {
				return s.getBounds();
			});
			return Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY);
		};
		const before = gap();
		r.body.rotate(Math.PI / 3);
		expect(gap()).toBeCloseTo(before, 6);
	});
});
