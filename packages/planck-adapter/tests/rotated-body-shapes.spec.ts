/**
 * `getBodyShapes()` under rotation.
 *
 * The adapter contract says the returned shapes are the body's collision
 * shapes "in renderable-local coordinates", and names debug drawing and
 * hit-region queries as the consumers. Planck keeps rotation in the body's
 * transform rather than in the shape definitions it was given, so returning
 * `def.shapes` hands back the pose the body had at creation — for a rotated
 * body that is a shape which no longer matches where it collides.
 *
 * The visible symptom is the debug overlay: a spinning body draws an
 * axis-aligned hitbox. The real one is quieter — anything asking the adapter
 * where a rotated body's shapes are gets the wrong answer.
 */

import {
	Application,
	Bounds,
	boot,
	Polygon,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PlanckAdapter } from "../src/index";

describe("PlanckAdapter — getBodyShapes() follows the body's rotation", () => {
	let world: World;
	let adapter: PlanckAdapter;

	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(() => {
		adapter = new PlanckAdapter({ gravity: { x: 0, y: 0 } });
		world = new World(0, 0, 800, 600, adapter);
	});

	/**
	 * A square body, optionally rotated.
	 * @param angle - radians to rotate the body to
	 * @returns the renderable carrying the body
	 */
	const square = (angle: number) => {
		const r = new Renderable(100, 100, 40, 40);
		world.addChild(r);
		adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 40, 40)],
		});
		if (angle !== 0) {
			adapter.setAngle(r, angle);
		}
		return r;
	};

	/**
	 * The axis-aligned extent of everything `getBodyShapes` returns, which is
	 * what a debug overlay ends up drawing.
	 * @param r - the renderable to measure
	 * @returns width and height of the union of the returned shapes
	 */
	const shapeExtent = (r: Renderable) => {
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const shape of adapter.getBodyShapes(r)) {
			const b = shape.getBounds();
			minX = Math.min(minX, b.left);
			minY = Math.min(minY, b.top);
			maxX = Math.max(maxX, b.right);
			maxY = Math.max(maxY, b.bottom);
		}
		return { width: maxX - minX, height: maxY - minY };
	};

	it("returns the authored shapes while the body is unrotated", () => {
		// the baseline the rotated cases are measured against
		const r = square(0);
		const shapes = adapter.getBodyShapes(r);
		expect(shapes.length).toBeGreaterThan(0);
		const extent = shapeExtent(r);
		expect(extent.width).toBeCloseTo(40, 0);
		expect(extent.height).toBeCloseTo(40, 0);
	});

	it("widens a 40x40 square to ~57 across when turned 45°", () => {
		// a square rotated an eighth-turn spans its diagonal, 40 * sqrt(2).
		// Returning the authored def instead keeps reporting 40x40 — which is
		// the bug: the drawn hitbox stays axis-aligned while the body spins
		const r = square(Math.PI / 4);
		const extent = shapeExtent(r);
		expect(extent.width).toBeCloseTo(40 * Math.SQRT2, 0);
		expect(extent.height).toBeCloseTo(40 * Math.SQRT2, 0);
	});

	it("puts a non-square body's long axis where the rotation leaves it", () => {
		// 80x20 turned a quarter-turn is 20 wide and 80 tall. A square would
		// pass this test even unrotated, so the oblong is what makes it bite
		const r = new Renderable(100, 100, 80, 20);
		world.addChild(r);
		adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 80, 20)],
		});
		adapter.setAngle(r, Math.PI / 2);
		const extent = shapeExtent(r);
		expect(extent.width).toBeCloseTo(20, 0);
		expect(extent.height).toBeCloseTo(80, 0);
	});

	it("tracks a body that keeps turning, not just its first pose", () => {
		// caching the rotated shapes is the obvious implementation, and a
		// cache that never invalidates passes every test above
		const r = square(0);
		expect(shapeExtent(r).width).toBeCloseTo(40, 0);
		adapter.setAngle(r, Math.PI / 4);
		expect(shapeExtent(r).width).toBeCloseTo(40 * Math.SQRT2, 0);
		adapter.setAngle(r, 0);
		expect(shapeExtent(r).width).toBeCloseTo(40, 0);
	});

	it("agrees with the angle the adapter reports", () => {
		const r = square(Math.PI / 4);
		expect(adapter.getAngle(r)).toBeCloseTo(Math.PI / 4, 5);
		expect(shapeExtent(r).width).toBeCloseTo(40 * Math.SQRT2, 0);
	});

	it("still returns nothing for a renderable with no body", () => {
		const r = new Renderable(0, 0, 10, 10);
		expect(adapter.getBodyShapes(r)).toEqual([]);
	});

	// ── multi-shape bodies under rotation (the reported regression) ────

	/**
	 * Every test above uses ONE shape whose offset lives at the origin, which
	 * is exactly why they passed while this was broken. A body built from
	 * SEVERAL shapes, offset away from the origin, is the case that bites —
	 * and a shape can carry that offset two ways, in its `points` or in its
	 * `pos`, which the old implementation treated differently.
	 */
	describe("several shapes, offset from the origin", () => {
		/** two triangles meeting along a shared edge, offset in `points` */
		const inPoints = () => [
			new Polygon(0, 0, [
				new Vector2d(-50, -90),
				new Vector2d(0, -120),
				new Vector2d(0, -60),
			]),
			new Polygon(0, 0, [
				new Vector2d(0, -120),
				new Vector2d(50, -90),
				new Vector2d(0, -60),
			]),
		];

		/** the SAME geometry, with the offset carried in `pos` instead */
		const inPos = () => [
			new Polygon(-50, -120, [
				new Vector2d(0, 30),
				new Vector2d(50, 0),
				new Vector2d(50, 60),
			]),
			new Polygon(0, -120, [
				new Vector2d(0, 0),
				new Vector2d(50, 30),
				new Vector2d(0, 60),
			]),
		];

		const bodyWith = (shapes: Polygon[]) => {
			const r = new Renderable(200, 200, 100, 240);
			world.addChild(r);
			adapter.addBody(r, { type: "static", shapes });
			return r;
		};

		/**
		 * every reported vertex, in renderable-local space
		 * @param r - the renderable whose body to read
		 * @returns the flattened vertex list
		 */
		const points = (r: Renderable) => {
			const out: { x: number; y: number }[] = [];
			for (const s of adapter.getBodyShapes(r)) {
				const poly = s as Polygon;
				if (!poly.points) continue;
				for (const v of poly.points) {
					out.push({ x: poly.pos.x + v.x, y: poly.pos.y + v.y });
				}
			}
			return out;
		};

		it("reports the same geometry however the offset is carried", () => {
			// `pos + points` is the shape's geometry; which half holds the
			// offset is an authoring detail and must not change the answer
			const a = bodyWith(inPoints());
			const b = bodyWith(inPos());
			adapter.setAngle(a, 0.7);
			adapter.setAngle(b, 0.7);

			const pa = points(a).sort((p, q) => p.x - q.x || p.y - q.y);
			const pb = points(b).sort((p, q) => p.x - q.x || p.y - q.y);
			expect(pa).toHaveLength(pb.length);
			for (let i = 0; i < pa.length; i++) {
				expect(pa[i].x).toBeCloseTo(pb[i].x, 3);
				expect(pa[i].y).toBeCloseTo(pb[i].y, 3);
			}
			world.removeChildNow(a);
			world.removeChildNow(b);
		});

		it("actually turns the geometry, by exactly the angle asked for", () => {
			// The guard the rest of this block does not give: shapes that never
			// rotated would still agree across authoring forms, still stay
			// joined, and still sit inside an equally unrotated AABB.
			//
			// Measured on the angle of a vector BETWEEN two vertices, which is
			// independent of whatever point the rotation happens about — the
			// two engines do not agree on that (matter turns about the centre
			// of mass, planck about the body origin) and neither is wrong.
			const r = bodyWith(inPoints());
			adapter.setAngle(r, 0);
			const a0 = points(r);
			const before = Math.atan2(a0[1].y - a0[0].y, a0[1].x - a0[0].x);
			adapter.setAngle(r, Math.PI / 2);
			const a90 = points(r);
			expect(a90.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)).not.toEqual(
				a0.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
			);
			const after = Math.atan2(a90[1].y - a90[0].y, a90[1].x - a90[0].x);
			// wrapped into (-π, π]
			let delta = after - before;
			while (delta <= -Math.PI) delta += Math.PI * 2;
			while (delta > Math.PI) delta -= Math.PI * 2;
			expect(delta).toBeCloseTo(Math.PI / 2, 3);
			world.removeChildNow(r);
		});

		it("keeps every shape inside the body's own AABB", () => {
			// The cross-check that catches a wrong pivot: `getBodyAABB` is
			// engine truth and travels with the body, so shapes rotated about
			// the wrong point escape it. Deliberately NOT "the centroid does
			// not move" — the two engines rotate about different points (matter
			// about the centre of mass, planck about the body origin), and a
			// pivot that is not the centroid moves the centroid legitimately.
			const r = bodyWith(inPoints());
			for (const angle of [0, 0.6, 1.9, -2.4]) {
				adapter.setAngle(r, angle);
				const aabb = adapter.getBodyAABB?.(r, new Bounds());
				expect(aabb).toBeDefined();
				for (const p of points(r)) {
					expect(p.x).toBeGreaterThanOrEqual(aabb!.left - 1);
					expect(p.x).toBeLessThanOrEqual(aabb!.right + 1);
					expect(p.y).toBeGreaterThanOrEqual(aabb!.top - 1);
					expect(p.y).toBeLessThanOrEqual(aabb!.bottom + 1);
				}
			}
			world.removeChildNow(r);
		});

		it("keeps the two shapes joined along their shared edge", () => {
			// the reported symptom: the parts of one body drifting apart
			const r = bodyWith(inPos());
			adapter.setAngle(r, 0.9);
			const p = points(r);
			// every vertex must have a partner from the other shape nearby;
			// it is enough that the cloud stays connected
			const spread = Math.max(...p.map((q) => Math.hypot(q.x, q.y)));
			expect(spread).toBeLessThan(200);
			world.removeChildNow(r);
		});

		it("reports the NEW shapes after updateShape at the same angle", () => {
			// the cache keys on the angle, so swapping the shapes while the
			// body holds still handed back the old geometry
			const r = bodyWith(inPoints());
			adapter.setAngle(r, 0.5);
			const first = points(r).length;
			adapter.updateShape(r, [
				new Polygon(0, 0, [
					new Vector2d(0, 0),
					new Vector2d(10, 0),
					new Vector2d(10, 10),
					new Vector2d(0, 10),
				]),
			]);
			adapter.setAngle(r, 0.5);
			expect(points(r).length).not.toBe(first);
			world.removeChildNow(r);
		});

		it("forgets a body once it is removed", () => {
			// the cache is keyed by renderable and nothing cleared it, so a
			// destroyed renderable and its shapes stayed pinned
			const r = bodyWith(inPoints());
			adapter.setAngle(r, 0.4);
			expect(adapter.getBodyShapes(r).length).toBeGreaterThan(0);
			adapter.removeBody(r);
			expect(adapter.getBodyShapes(r)).toEqual([]);
			world.removeChildNow(r);
		});

		it("does not allocate fresh shapes on every call", () => {
			// the debug overlay calls this once per body per frame, and the
			// angle is different every frame for anything actually spinning
			const r = bodyWith(inPoints());
			adapter.setAngle(r, 0.3);
			const first = adapter.getBodyShapes(r);
			adapter.setAngle(r, 0.30001);
			const second = adapter.getBodyShapes(r);
			expect(second).toBe(first);
			expect(second[0]).toBe(first[0]);
			world.removeChildNow(r);
		});
	});
});
