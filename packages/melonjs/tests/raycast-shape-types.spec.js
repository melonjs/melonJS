/**
 * The built-in raycast measures every shape type a body can carry.
 *
 * The bugs:
 * - `raycastQuery` sent every shape that was not an `Ellipse` down the
 *   polygon path, which reads `shape.pos` and `shape.points` with no check.
 *   A body carrying a `Point` threw "Cannot read properties of undefined
 *   (reading 'x')", a `Sphere` "(reading 'length')", and a `Box3d` was
 *   measured from its centre rather than its footprint — through
 *   `adapter.raycast`, `collision.rayCast` and line-of-sight code alike.
 * - `_raycastEllipse` solved for an axis-aligned ellipse and ignored
 *   `Ellipse#angle`, so a rotated ellipse was hit where it would have been
 *   unrotated, while `Ellipse#contains` and the narrowphase honour the
 *   rotation.
 *
 * Now a ray is turned into a rotated ellipse's own frame; `Box3d` and
 * `Sphere` are measured by their XY footprint, as the mixed SAT pairs see
 * them; and a shape with nothing to cross (`Point`) or of an unknown type is
 * skipped with a one-time warning.
 */
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	Body,
	Box3d,
	BuiltinAdapter,
	boot,
	collision,
	Ellipse,
	Line,
	Point,
	Polygon,
	Rect,
	Renderable,
	RoundRect,
	Sphere,
	Vector2d,
	video,
	World,
} from "../src/index.js";
import { resetWarnOnce } from "../src/lang/console.js";
import { raycastQuery } from "../src/physics/builtin/raycast.js";

const rebuild = (world) => {
	world.broadphase.clear();
	world.broadphase.insertContainer(world);
};

describe("Raycast : every shape type", () => {
	let app;
	let world;
	let warn;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	beforeEach(() => {
		world = new World(0, 0, 800, 600, new BuiltinAdapter());
		resetWarnOnce();
		warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		warn.mockRestore();
	});

	// a top-left-anchored 100x100 renderable at (100, 100) carrying `shapes`
	const body = (shapes) => {
		const r = new Renderable(100, 100, 100, 100);
		r.anchorPoint.set(0, 0);
		r.isKinematic = false;
		r.body = new Body(r, shapes);
		world.addChild(r);
		rebuild(world);
		return r;
	};

	// first hit of a horizontal ray along y, from the left
	const fromLeft = (y) => {
		return raycastQuery(world, 0, y, 400, y)[0];
	};

	describe("planar shapes", () => {
		it("Rect", () => {
			body([new Rect(20, 20, 60, 60)]);
			const hit = fromLeft(150);
			expect(hit.point.x).toBeCloseTo(120, 6);
			expect(hit.normal.x).toBeCloseTo(-1, 6);
		});

		it("Polygon", () => {
			body([
				new Polygon(0, 0, [
					{ x: 50, y: 0 },
					{ x: 100, y: 50 },
					{ x: 50, y: 100 },
					{ x: 0, y: 50 },
				]),
			]);
			// the diamond's left corner is at x = 100
			expect(fromLeft(150).point.x).toBeCloseTo(100, 6);
			// 25px below it, the left edges are at x = 125
			expect(fromLeft(175).point.x).toBeCloseTo(125, 6);
		});

		it("RoundRect", () => {
			body([new RoundRect(10, 10, 80, 80, 10)]);
			expect(fromLeft(150).point.x).toBeCloseTo(110, 6);
		});

		it("Line (one segment, one normal)", () => {
			body([
				new Line(0, 0, [
					{ x: 50, y: 0 },
					{ x: 50, y: 100 },
				]),
			]);
			let hit;
			expect(() => {
				hit = fromLeft(150);
			}).not.toThrow();
			expect(hit.point.x).toBeCloseTo(150, 6);
			expect(hit.normal.x).toBeCloseTo(-1, 6);
			// and from the other side, the normal still faces the ray
			const back = raycastQuery(world, 400, 150, 0, 150)[0];
			expect(back.point.x).toBeCloseTo(150, 6);
			expect(back.normal.x).toBeCloseTo(1, 6);
		});

		it("Ellipse, unrotated", () => {
			body([new Ellipse(50, 50, 100, 40)]);
			expect(fromLeft(150).point.x).toBeCloseTo(100, 6);
			// 20 is the vertical radius: a ray at y = 171 misses
			expect(fromLeft(171)).toBeUndefined();
		});
	});

	describe("a rotated Ellipse is hit where it is", () => {
		it("the repro: 100x20, turned a quarter, is 20 wide and 100 tall", () => {
			// centred on (200, 200)
			const r = new Renderable(150, 150, 100, 100);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			const e = new Ellipse(50, 50, 100, 20);
			e.rotate(Math.PI / 2);
			r.body = new Body(r, [e]);
			world.addChild(r);
			rebuild(world);

			// 30 right of the centre: outside the turned ellipse (half-width 10)
			expect(raycastQuery(world, 230, 0, 230, 400).length).toBe(0);
			// 40 below the centre: inside it (half-height 50)
			const hit = raycastQuery(world, 0, 240, 400, 240);
			expect(hit.length).toBe(1);
		});

		for (const angle of [Math.PI / 2, Math.PI / 6, -0.9, 2.5]) {
			it(`agrees with Ellipse#contains at ${angle.toFixed(3)} rad`, () => {
				const e = new Ellipse(50, 50, 90, 24);
				e.rotate(angle);
				body([e]);
				// the shape's centre in the world
				const cx = 150;
				const cy = 150;
				const rx = 45;
				const ry = 12;
				let hits = 0;
				for (let y = 100; y <= 200; y += 3) {
					// does the row cross the ellipse? sample it with contains
					let crosses = false;
					for (let x = 90; x <= 210; x += 0.25) {
						if (e.contains(x - 100, y - 100)) {
							crosses = true;
							break;
						}
					}
					const hit = fromLeft(y);
					if (!crosses) {
						expect(hit).toBeUndefined();
						continue;
					}
					expect(hit).toBeDefined();
					hits++;
					// the hit point is ON the turned ellipse
					const px = hit.point.x - cx;
					const py = hit.point.y - cy;
					const lx = px * Math.cos(angle) + py * Math.sin(angle);
					const ly = -px * Math.sin(angle) + py * Math.cos(angle);
					expect((lx * lx) / (rx * rx) + (ly * ly) / (ry * ry)).toBeCloseTo(
						1,
						4,
					);
					// and its normal is the turned gradient, facing the ray
					let gx = lx / (rx * rx);
					let gy = ly / (ry * ry);
					const gl = Math.hypot(gx, gy);
					gx /= gl;
					gy /= gl;
					const wx = gx * Math.cos(angle) - gy * Math.sin(angle);
					const wy = gx * Math.sin(angle) + gy * Math.cos(angle);
					expect(hit.normal.x).toBeCloseTo(wx, 4);
					expect(hit.normal.y).toBeCloseTo(wy, 4);
					expect(hit.normal.x).toBeLessThanOrEqual(0);
				}
				expect(hits).toBeGreaterThan(3);
			});
		}

		it("through adapter.raycast too", () => {
			const e = new Ellipse(50, 50, 100, 20);
			e.rotate(Math.PI / 2);
			body([e]);
			const adapter = world.adapter;
			// 30 right of the centre (150, 150): a miss
			expect(
				adapter.raycast(new Vector2d(180, 0), new Vector2d(180, 400)),
			).toBeNull();
			const hit = adapter.raycast(new Vector2d(150, 0), new Vector2d(150, 400));
			expect(hit.point.y).toBeCloseTo(100, 4);
		});
	});

	describe("3D shapes, by their XY footprint", () => {
		it("Sphere: a circle of its radius about its centre", () => {
			body([new Sphere(50, 50, 0, 25)]);
			let hit;
			expect(() => {
				hit = fromLeft(150);
			}).not.toThrow();
			expect(hit.point.x).toBeCloseTo(125, 6);
			expect(hit.normal.x).toBeCloseTo(-1, 6);
			// above the silhouette: a miss
			expect(fromLeft(124)).toBeUndefined();
		});

		it("Sphere with a negative radius, as Sphere#contains reads it", () => {
			body([new Sphere(50, 50, 0, -25)]);
			expect(fromLeft(150).point.x).toBeCloseTo(125, 6);
		});

		it("Box3d: its footprint rectangle, not its centre", () => {
			// centred on (50, 50), 40 wide and 60 tall: x 30..70, y 20..80
			body([new Box3d(50, 50, 0, 40, 60, 10)]);
			let hit;
			expect(() => {
				hit = fromLeft(150);
			}).not.toThrow();
			expect(hit.point.x).toBeCloseTo(130, 6);
			expect(hit.normal.x).toBeCloseTo(-1, 6);
			// rows just inside and just outside its height
			expect(fromLeft(121)).toBeDefined();
			expect(fromLeft(119)).toBeUndefined();
			expect(fromLeft(179)).toBeDefined();
			expect(fromLeft(181)).toBeUndefined();
		});

		it("a body mixing a Box3d and a Rect reports the nearer", () => {
			body([new Box3d(50, 50, 0, 40, 60, 10), new Rect(0, 40, 10, 20)]);
			expect(fromLeft(150).point.x).toBeCloseTo(100, 6);
			expect(fromLeft(125).point.x).toBeCloseTo(130, 6);
		});
	});

	describe("shapes with nothing to cross are skipped, not fatal", () => {
		it("a Point next to a Rect: no throw, the Rect is still hit", () => {
			body([new Rect(0, 0, 50, 50), new Point(25, 25)]);
			let hits;
			expect(() => {
				hits = raycastQuery(world, 0, 125, 300, 125);
			}).not.toThrow();
			expect(hits.length).toBe(1);
			expect(hits[0].point.x).toBeCloseTo(100, 6);
			// told once, however many rays cross it
			raycastQuery(world, 0, 126, 300, 126);
			const pointWarnings = warn.mock.calls.filter((c) => {
				return String(c[0]).includes("Point");
			});
			expect(pointWarnings.length).toBe(1);
		});

		it("a body whose only shape is a Point is not hit", () => {
			body([new Point(25, 25)]);
			expect(raycastQuery(world, 0, 125, 300, 125)).toEqual([]);
		});

		it("an unknown shape type is skipped with a warning", () => {
			const r = body([new Rect(0, 0, 50, 50)]);
			r.body.shapes.push({ type: "Custom", pos: new Vector2d(0, 0) });
			let hits;
			expect(() => {
				hits = raycastQuery(world, 0, 125, 300, 125);
			}).not.toThrow();
			expect(hits.length).toBe(1);
			expect(
				warn.mock.calls.some((c) => {
					return String(c[0]).includes("Custom");
				}),
			).toBe(true);
		});

		it("the portable and the legacy APIs survive it too", () => {
			body([new Sphere(50, 50, 0, 25), new Point(10, 10)]);
			expect(() => {
				world.adapter.raycast(new Vector2d(0, 150), new Vector2d(400, 150));
			}).not.toThrow();
			const line = new Line(0, 150, [
				{ x: 0, y: 0 },
				{ x: 400, y: 0 },
			]);
			let result;
			expect(() => {
				result = world.detector.rayCast(line);
			}).not.toThrow();
			expect(result.length).toBe(1);
			expect(typeof collision.rayCast).toBe("function");
		});
	});
});
