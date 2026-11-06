/**
 * Polygon vs circle collision does not depend on the polygon's winding.
 *
 * The bug: `Polygon#recalc` computed each edge normal as `(ey, -ex)`, which
 * points OUT of a polygon wound clockwise on screen and INTO one wound
 * counter-clockwise. The circle fast path of `testPolygonEllipse` decides
 * "the circle is outside this edge" from the sign of the distance along that
 * normal, so against a counter-clockwise polygon a circle sitting in an edge's
 * middle Voronoi region — anywhere along the edge, however far out — was
 * taken for being inside and reported as colliding. Counter-clockwise
 * polygons are common: a Tiled polygon is passed through in the order it was
 * drawn, and `scale(-1, 1)` (mirroring) reverses any polygon's winding.
 *
 * The fix orients the normals outward from the polygon's signed area, and
 * leaves the points in the order they were given.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	Body,
	boot,
	collision,
	Ellipse,
	Polygon,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";
import TMXObject from "../src/level/tiled/TMXObject.js";
import { testPolygonEllipse } from "../src/physics/builtin/sat.js";
import ResponseObject from "../src/physics/response.js";

// a bare top-left-anchored renderable at (x, y) in a container at the origin
const at = (x, y) => {
	const r = new Renderable(x, y, 0, 0);
	r.anchorPoint.set(0, 0);
	const origin = new Vector2d(0, 0);
	r.ancestor = {
		getAbsolutePosition: () => {
			return origin;
		},
	};
	return r;
};

// twice the signed area, screen space (y down): > 0 is clockwise on screen
const area2 = (points) => {
	let a = 0;
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const q = points[(i + 1) % points.length];
		a += p.x * q.y - q.x * p.y;
	}
	return a;
};

const tmxMap = () => {
	return {
		orientation: "orthogonal",
		isEditor: true,
		tilesets: {
			getTilesetByGid: () => {
				return null;
			},
		},
	};
};

const tmxPolygon = (points) => {
	return new TMXObject(tmxMap(), { name: "", x: 0, y: 0, polygon: points }, 0);
};

// does a circle of radius r centred on (x, y) collide with `poly` at the origin?
const hits = (poly, x, y, r = 8) => {
	return testPolygonEllipse(
		at(0, 0),
		poly,
		at(x, y),
		new Ellipse(0, 0, r * 2, r * 2),
		new ResponseObject(),
	);
};

const reversed = (points) => {
	return points
		.slice()
		.reverse()
		.map((p) => {
			return { x: p.x, y: p.y };
		});
};

const SQUARE = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 100, y: 100 },
	{ x: 0, y: 100 },
];
const TRIANGLE = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 50, y: 100 },
];
// an L shape, concave: Tiled hands it over for decomposition
const ELL = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 100, y: 50 },
	{ x: 50, y: 50 },
	{ x: 50, y: 100 },
	{ x: 0, y: 100 },
];

describe("Polygon : collision with a circle ignores the winding", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(128, 128, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});
	afterAll(() => {
		app?.destroy();
	});

	describe("edge normals point outward", () => {
		for (const [name, pts] of [
			["square", SQUARE],
			["triangle", TRIANGLE],
		]) {
			for (const wind of ["clockwise", "counter-clockwise"]) {
				it(`${name}, ${wind}`, () => {
					const points = wind === "clockwise" ? pts : reversed(pts);
					const poly = new Polygon(0, 0, points);
					// centroid of the vertices: inside these convex shapes
					let cx = 0;
					let cy = 0;
					for (const p of poly.points) {
						cx += p.x / poly.points.length;
						cy += p.y / poly.points.length;
					}
					for (let i = 0; i < poly.points.length; i++) {
						const p = poly.points[i];
						const n = poly.edgeNormals[i];
						// from the inside to the edge, along the normal: positive
						expect((p.x - cx) * n.x + (p.y - cy) * n.y).toBeGreaterThan(0);
						expect(Math.hypot(n.x, n.y)).toBeCloseTo(1, 6);
					}
				});
			}
		}

		it("keeps the points in the order they were given", () => {
			const points = reversed(SQUARE);
			const poly = new Polygon(0, 0, points);
			expect(area2(poly.points)).toBeLessThan(0);
			for (let i = 0; i < points.length; i++) {
				expect(poly.points[i].x).toBe(points[i].x);
				expect(poly.points[i].y).toBe(points[i].y);
			}
		});

		it("a pooled polygon re-shaped from CCW to CW re-orients its normals", () => {
			const poly = new Polygon(0, 0, reversed(SQUARE));
			poly.setShape(0, 0, SQUARE);
			// top edge of the clockwise square: outward is up
			expect(poly.edgeNormals[0].y).toBeCloseTo(-1, 6);
		});
	});

	describe("a circle far from the polygon does not collide", () => {
		it("box drawn clockwise (control)", () => {
			const poly = new Polygon(0, 0, SQUARE);
			expect(hits(poly, 50, -100)).toBe(false);
		});

		it("box drawn counter-clockwise", () => {
			const poly = new Polygon(0, 0, reversed(SQUARE));
			expect(hits(poly, 50, -100)).toBe(false);
			expect(hits(poly, -100, 50)).toBe(false);
			expect(hits(poly, 200, 50)).toBe(false);
			expect(hits(poly, 50, 300)).toBe(false);
		});

		it("box mirrored with scale(-1, 1)", () => {
			const poly = new Polygon(0, 0, SQUARE).scale(-1, 1);
			expect(hits(poly, -50, -100)).toBe(false);
		});

		it("triangle mirrored with scale(-1, 1)", () => {
			const tri = new Polygon(0, 0, TRIANGLE);
			expect(hits(tri, 50, -50)).toBe(false);
			tri.scale(-1, 1);
			expect(hits(tri, -50, -50)).toBe(false);
		});

		it("triangle mirrored, then rotated", () => {
			const tri = new Polygon(0, 0, TRIANGLE).scale(-1, 1).rotate(0.7);
			// well clear of a shape that fits in a 120px circle round the origin
			for (const [x, y] of [
				[0, -300],
				[300, 0],
				[0, 300],
				[-300, 0],
			]) {
				expect(hits(tri, x, y)).toBe(false);
			}
		});

		it("a Rect with a negative width (its points turn the other way)", () => {
			const rect = new Rect(0, 0, -100, 100);
			expect(area2(rect.points)).toBeLessThan(0);
			expect(hits(rect, -50, -100)).toBe(false);
			expect(hits(rect, -50, 50)).toBe(true);
		});

		it("counter-clockwise Tiled triangle", () => {
			const obj = tmxPolygon([
				{ x: 0, y: 0 },
				{ x: 50, y: 100 },
				{ x: 100, y: 0 },
			]);
			expect(obj.shapes.length).toBe(1);
			expect(hits(obj.shapes[0], 50, -50)).toBe(false);
		});

		for (const wind of ["clockwise", "counter-clockwise"]) {
			it(`concave Tiled polygon drawn ${wind}, decomposed into triangles`, () => {
				const obj = tmxPolygon(wind === "clockwise" ? ELL : reversed(ELL));
				expect(obj.shapes.length).toBeGreaterThan(1);
				const far = [
					[50, -300],
					[-300, 50],
					[400, 50],
					[50, 400],
					[300, 300],
					[-300, -300],
					// the notch of the L: inside its bounds, outside the shape
					[85, 85],
				];
				for (const [x, y] of far) {
					for (const s of obj.shapes) {
						expect(hits(s, x, y)).toBe(false);
					}
				}
				// and a circle on the L itself does collide with some piece
				expect(
					obj.shapes.some((s) => {
						return hits(s, 25, 75);
					}),
				).toBe(true);
			});
		}
	});

	describe("both windings give the same answer, contact included", () => {
		for (const [name, pts] of [
			["square", SQUARE],
			["triangle", TRIANGLE],
		]) {
			it(name, () => {
				const cw = new Polygon(0, 0, pts);
				const ccw = new Polygon(0, 0, reversed(pts));
				let contacts = 0;
				// the y grid is offset by half a pixel so that no sample sits
				// at the same depth behind two edges: there either edge is a
				// valid answer and the two windings may legitimately differ
				for (let x = -40; x <= 140; x += 7) {
					for (let y = -38.5; y <= 140; y += 7) {
						const rA = new ResponseObject();
						const rB = new ResponseObject();
						const circle = new Ellipse(0, 0, 20, 20);
						const a = testPolygonEllipse(at(0, 0), cw, at(x, y), circle, rA);
						const b = testPolygonEllipse(at(0, 0), ccw, at(x, y), circle, rB);
						expect(b).toBe(a);
						if (a) {
							contacts++;
							expect(rB.overlap).toBeCloseTo(rA.overlap, 6);
							expect(rB.overlapV.x).toBeCloseTo(rA.overlapV.x, 6);
							expect(rB.overlapV.y).toBeCloseTo(rA.overlapV.y, 6);
						}
					}
				}
				expect(contacts).toBeGreaterThan(20);
			});
		}

		it("a circle resting on top of a CCW box is pushed up, not through", () => {
			const r = new ResponseObject();
			// circle radius 10 centred 6 above the top edge: 4 deep
			const hit = testPolygonEllipse(
				at(0, 0),
				new Polygon(0, 0, reversed(SQUARE)),
				at(50, -6),
				new Ellipse(0, 0, 20, 20),
				r,
			);
			expect(hit).toBe(true);
			expect(r.overlap).toBeCloseTo(4, 6);
			// b (the circle) escapes along +overlapV: up the screen
			expect(r.overlapV.y).toBeCloseTo(-4, 6);
		});
	});

	describe("in a world", () => {
		// a hill, apex up, drawn counter-clockwise as Tiled passes it on
		const HILL_CCW = [
			{ x: 100, y: 100 },
			{ x: 50, y: 0 },
			{ x: 0, y: 100 },
		];
		const run = (points) => {
			const world = new World(0, 0, 800, 600);
			world.adapter.gravity.set(0, 0);
			const hill = new Renderable(100, 100, 100, 100);
			hill.anchorPoint.set(0, 0);
			hill.isKinematic = false;
			hill.alwaysUpdate = true;
			hill.body = new Body(hill, new Polygon(0, 0, points));
			hill.body.collisionType = collision.types.WORLD_SHAPE;
			hill.body.isStatic = true;
			world.addChild(hill);

			// a ball of radius 8 centred on (93, 120): its box overlaps the
			// hill's by a pixel, so the pair reaches the narrowphase, but the
			// hill's nearest edge is some 50px away
			const ball = new Renderable(85, 112, 16, 16);
			ball.anchorPoint.set(0, 0);
			ball.isKinematic = false;
			ball.alwaysUpdate = true;
			ball.body = new Body(ball, new Ellipse(8, 8, 16, 16));
			ball.body.collisionType = collision.types.PLAYER_OBJECT;
			world.addChild(ball);

			let collided = 0;
			ball.onCollision = () => {
				collided++;
				return true;
			};
			for (let i = 0; i < 5; i++) {
				world.update(16);
			}
			return { collided, x: ball.pos.x, y: ball.pos.y };
		};

		it("a ball beside a counter-clockwise hill is left alone", () => {
			expect(area2(HILL_CCW)).toBeLessThan(0);
			expect(run(HILL_CCW)).toEqual({ collided: 0, x: 85, y: 112 });
		});

		it("same with the hill drawn clockwise (control)", () => {
			expect(run(reversed(HILL_CCW))).toEqual({ collided: 0, x: 85, y: 112 });
		});
	});
});
