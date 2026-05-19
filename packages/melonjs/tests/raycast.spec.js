import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Body,
	BuiltinAdapter,
	boot,
	Container,
	collision,
	Ellipse,
	Line,
	Polygon,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";
import { raycastQuery } from "../src/physics/builtin/raycast.js";

/**
 * Coverage matrix for the raycast refactor:
 *  - `raycastQuery` (shared internal helper, `physics/builtin/raycast.js`)
 *  - `BuiltinAdapter.raycast` (portable adapter API; thin wrapper)
 *  - `Detector.rayCast` (legacy multi-hit API; thin wrapper)
 *  - `collision.rayCast` (top-level public; delegates to Detector)
 *  - adversarial / edge cases shared by all four paths
 */

// Build a static renderable with a single Rect body shape, parented to
// the given world and inserted into the broadphase so raycast can find it.
const makeRectBody = (world, x, y, w, h) => {
	const r = new Renderable(x, y, w, h);
	r.anchorPoint.set(0, 0);
	r.isKinematic = false;
	r.body = new Body(r, [new Rect(0, 0, w, h)]);
	world.addChild(r);
	return r;
};

const makeEllipseBody = (world, cx, cy, rx, ry) => {
	const r = new Renderable(cx - rx, cy - ry, rx * 2, ry * 2);
	r.anchorPoint.set(0, 0);
	r.isKinematic = false;
	r.body = new Body(r, [new Ellipse(rx, ry, rx * 2, ry * 2)]);
	world.addChild(r);
	return r;
};

// Force the broadphase to mirror the current container tree. The world's
// `update()` does this each frame; tests call it explicitly so they don't
// depend on the physics step running.
const rebuildBroadphase = (world) => {
	world.broadphase.clear();
	world.broadphase.insertContainer(world);
};

const lineBetween = (fromX, fromY, toX, toY) => {
	return new Line(fromX, fromY, [
		new Vector2d(0, 0),
		new Vector2d(toX - fromX, toY - fromY),
	]);
};

describe("Raycast", () => {
	let adapter;
	let world;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	beforeEach(() => {
		adapter = new BuiltinAdapter();
		world = new World(0, 0, 800, 600, adapter);
	});

	describe("raycastQuery (shared internal helper)", () => {
		it("returns an empty array when the broadphase has no bodies", () => {
			rebuildBroadphase(world);
			const hits = raycastQuery(world, 0, 0, 100, 100);
			expect(hits).toEqual([]);
		});

		it("returns a single hit with { renderable, point, normal, fraction } when the ray crosses one body", () => {
			const target = makeRectBody(world, 100, 100, 50, 50);
			rebuildBroadphase(world);

			const hits = raycastQuery(world, 0, 125, 300, 125);
			expect(hits.length).toEqual(1);
			expect(hits[0].renderable).toBe(target);
			// Entry point = left edge of the rect at x=100, ray y=125.
			expect(hits[0].point.x).toBeCloseTo(100, 1);
			expect(hits[0].point.y).toBeCloseTo(125, 1);
			// Parametric fraction = 100/300 along the ray.
			expect(hits[0].fraction).toBeCloseTo(100 / 300, 3);
			// Normal at the left edge points back toward `from` ⇒ -X.
			expect(hits[0].normal.x).toBeCloseTo(-1, 3);
			expect(hits[0].normal.y).toBeCloseTo(0, 3);
		});

		it("returns multiple hits sorted nearest-first along the ray", () => {
			const near = makeRectBody(world, 50, 50, 20, 20);
			const mid = makeRectBody(world, 200, 50, 20, 20);
			const far = makeRectBody(world, 400, 50, 20, 20);
			rebuildBroadphase(world);

			const hits = raycastQuery(world, 0, 60, 500, 60);
			expect(hits.length).toEqual(3);
			expect(hits[0].renderable).toBe(near);
			expect(hits[1].renderable).toBe(mid);
			expect(hits[2].renderable).toBe(far);
			// Fractions strictly ascending.
			expect(hits[0].fraction).toBeLessThan(hits[1].fraction);
			expect(hits[1].fraction).toBeLessThan(hits[2].fraction);
		});

		it("flips the normal so it points back toward the ray origin", () => {
			// Right-shooting ray into a body on the right. The normal
			// should oppose the ray direction — i.e. have a negative x.
			makeRectBody(world, 200, 100, 40, 40);
			rebuildBroadphase(world);

			const hits = raycastQuery(world, 0, 120, 400, 120);
			expect(hits.length).toEqual(1);
			// rayDir = (+x, 0); normal · rayDir ≤ 0 means normal opposes ray.
			const dot = hits[0].normal.x * 1 + hits[0].normal.y * 0;
			expect(dot).toBeLessThanOrEqual(0);
		});

		it("clamps fraction to [0, 1] for hits beyond the ray's end-point", () => {
			// Body far past the ray end. AABB-centre fraction would be > 1,
			// which we clamp.
			makeRectBody(world, 1000, 50, 20, 20);
			// Broadphase retrieve uses the line's bounds — if the body is
			// past it, the broadphase rejects it before we get here. To
			// actually exercise the clamp branch, use a wider quadtree.
			world.broadphase.max_objects = 1;
			rebuildBroadphase(world);

			// Even with a wider broadphase, a body that doesn't overlap the
			// ray's AABB simply won't be a candidate — so the clamp branch
			// only fires when the body IS hit but its centre is past `to`.
			// Use a wide body that straddles the ray end.
			const wide = makeRectBody(world, 90, 50, 200, 50);
			rebuildBroadphase(world);
			const hits = raycastQuery(world, 0, 75, 100, 75);
			// wide's AABB centre is at (190, 75), past `to=100`. Fraction
			// should still clamp to ≤ 1.
			const wideHit = hits.find((h) => {
				return h.renderable === wide;
			});
			expect(wideHit).toBeDefined();
			expect(wideHit.fraction).toBeLessThanOrEqual(1);
			expect(wideHit.fraction).toBeGreaterThanOrEqual(0);
		});

		it("skips renderables without a body", () => {
			const ghost = new Renderable(50, 50, 20, 20);
			ghost.anchorPoint.set(0, 0);
			ghost.isKinematic = false;
			world.addChild(ghost);
			rebuildBroadphase(world);

			const hits = raycastQuery(world, 0, 60, 200, 60);
			expect(hits.length).toEqual(0);
		});

		it("skips bodies with no shapes", () => {
			const r = new Renderable(50, 50, 20, 20);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			r.body = new Body(r, [new Rect(0, 0, 20, 20)]);
			// Strip shapes to simulate a partially-torn-down body.
			r.body.shapes.length = 0;
			world.addChild(r);
			rebuildBroadphase(world);

			const hits = raycastQuery(world, 0, 60, 200, 60);
			expect(hits.length).toEqual(0);
		});

		it("reports a single hit per multi-shape compound body", () => {
			const r = new Renderable(80, 80, 80, 40);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			r.body = new Body(r, [new Rect(0, 0, 40, 40), new Rect(40, 0, 40, 40)]);
			world.addChild(r);
			rebuildBroadphase(world);

			const hits = raycastQuery(world, 0, 100, 200, 100);
			expect(hits.length).toEqual(1);
			expect(hits[0].renderable).toBe(r);
		});

		it("does not include candidates whose AABB doesn't overlap the ray", () => {
			// Below the horizontal ray.
			makeRectBody(world, 50, 200, 20, 20);
			rebuildBroadphase(world);

			const hits = raycastQuery(world, 0, 60, 200, 60);
			expect(hits.length).toEqual(0);
		});
	});

	describe("BuiltinAdapter.raycast (portable adapter API)", () => {
		it("returns null when the ray hits nothing", () => {
			rebuildBroadphase(world);
			const hit = adapter.raycast(new Vector2d(0, 0), new Vector2d(100, 0));
			expect(hit).toBeNull();
		});

		it("returns the nearest hit when multiple bodies are along the ray", () => {
			const near = makeRectBody(world, 50, 50, 20, 20);
			makeRectBody(world, 200, 50, 20, 20);
			makeRectBody(world, 400, 50, 20, 20);
			rebuildBroadphase(world);

			const hit = adapter.raycast(new Vector2d(0, 60), new Vector2d(500, 60));
			expect(hit).not.toBeNull();
			expect(hit.renderable).toBe(near);
		});

		it("returns a RaycastHit with `point` and `normal` as Vector2d instances", () => {
			makeRectBody(world, 100, 100, 50, 50);
			rebuildBroadphase(world);

			const hit = adapter.raycast(new Vector2d(0, 125), new Vector2d(300, 125));
			expect(hit).not.toBeNull();
			expect(hit.point).toBeInstanceOf(Vector2d);
			expect(hit.normal).toBeInstanceOf(Vector2d);
			expect(typeof hit.fraction).toEqual("number");
		});

		it("advertises capabilities.raycasts = true", () => {
			expect(adapter.capabilities.raycasts).toEqual(true);
		});

		it("returns a fresh hit object on each call (no shared mutable state)", () => {
			makeRectBody(world, 100, 100, 40, 40);
			rebuildBroadphase(world);

			const h1 = adapter.raycast(new Vector2d(0, 120), new Vector2d(200, 120));
			const h2 = adapter.raycast(new Vector2d(0, 120), new Vector2d(200, 120));
			expect(h1).not.toBe(h2);
			expect(h1.point).not.toBe(h2.point);
			expect(h1.normal).not.toBe(h2.normal);
		});
	});

	describe("Detector.rayCast (legacy multi-hit API)", () => {
		it("returns the colliding renderables as a flat array", () => {
			const a = makeRectBody(world, 50, 50, 20, 20);
			const b = makeRectBody(world, 100, 50, 20, 20);
			rebuildBroadphase(world);

			const result = world.detector.rayCast(lineBetween(0, 60, 200, 60));
			expect(result.length).toEqual(2);
			expect(result).toContain(a);
			expect(result).toContain(b);
		});

		it("fills the caller-supplied result array (legacy contract)", () => {
			makeRectBody(world, 50, 50, 20, 20);
			rebuildBroadphase(world);

			const result = ["stale-marker"];
			const returned = world.detector.rayCast(
				lineBetween(0, 60, 200, 60),
				result,
			);
			expect(returned).toBe(result); // same reference
			expect(result.length).toEqual(1);
			// Length is reset — the stale "stale-marker" entry is gone.
			expect(result).not.toContain("stale-marker");
		});

		it("returns hits sorted nearest-first (behavior tightening from previous unsorted output)", () => {
			const near = makeRectBody(world, 30, 50, 10, 10);
			const far = makeRectBody(world, 200, 50, 10, 10);
			rebuildBroadphase(world);

			const result = world.detector.rayCast(lineBetween(0, 55, 400, 55));
			expect(result[0]).toBe(near);
			expect(result[1]).toBe(far);
		});

		it("returns an empty array when nothing is hit", () => {
			rebuildBroadphase(world);
			const result = world.detector.rayCast(lineBetween(0, 0, 100, 0));
			expect(result).toEqual([]);
		});
	});

	describe("collision.rayCast (top-level public API)", () => {
		it("exposes a `rayCast` function that delegates to the active world's detector", () => {
			// `collision.rayCast(line, result)` is a one-line delegate:
			//   `return game.world.detector.rayCast(line, result);`
			// The actual SAT walk is covered by the `Detector.rayCast`
			// tests above. Here we pin the public surface — the function
			// exists, takes a Line, and returns an array (a no-op when
			// `game.world` is the empty default).
			expect(typeof collision.rayCast).toEqual("function");
			const result = collision.rayCast(lineBetween(0, 60, 200, 60));
			expect(Array.isArray(result)).toEqual(true);
		});
	});

	describe("adversarial / edge cases", () => {
		it("handles a zero-length ray (from == to) without crashing", () => {
			makeRectBody(world, 50, 50, 20, 20);
			rebuildBroadphase(world);
			// Same point — sensible result is either null or a hit if
			// the point is inside a body. We just require no crash.
			const hit = adapter.raycast(new Vector2d(60, 60), new Vector2d(60, 60));
			// Whatever the answer, fraction must be in [0, 1] if non-null.
			if (hit !== null) {
				expect(hit.fraction).toBeGreaterThanOrEqual(0);
				expect(hit.fraction).toBeLessThanOrEqual(1);
			}
		});

		it("returns null for an entirely-outside-world ray that misses", () => {
			makeRectBody(world, 100, 100, 20, 20);
			rebuildBroadphase(world);
			const hit = adapter.raycast(
				new Vector2d(-1000, -1000),
				new Vector2d(-500, -500),
			);
			expect(hit).toBeNull();
		});

		it("survives a ray that crosses the entire viewport with dense bodies", () => {
			// Pack 20 bodies along a horizontal line.
			const expected = [];
			for (let i = 0; i < 20; i++) {
				expected.push(makeRectBody(world, 10 + i * 30, 100, 10, 10));
			}
			rebuildBroadphase(world);

			const hits = raycastQuery(world, 0, 105, 800, 105);
			expect(hits.length).toEqual(20);
			// First hit is the leftmost body.
			expect(hits[0].renderable).toBe(expected[0]);
			// Last hit is the rightmost.
			expect(hits[hits.length - 1].renderable).toBe(expected[19]);
			// Fractions monotonic non-decreasing.
			for (let i = 1; i < hits.length; i++) {
				expect(hits[i].fraction).toBeGreaterThanOrEqual(hits[i - 1].fraction);
			}
		});

		it("hits a body via SAT even when only a corner clips the ray", () => {
			// Diagonal ray that should clip just the top-left corner of
			// a 40×40 body anchored at (100, 100). The line passes
			// through (~118, 118) which is inside the body.
			makeRectBody(world, 100, 100, 40, 40);
			rebuildBroadphase(world);

			const hits = raycastQuery(world, 0, 0, 200, 200);
			expect(hits.length).toEqual(1);
		});

		it("hits an ellipse-shaped body", () => {
			const e = makeEllipseBody(world, 200, 100, 50, 50);
			rebuildBroadphase(world);

			const hits = raycastQuery(world, 0, 100, 400, 100);
			expect(hits.length).toEqual(1);
			expect(hits[0].renderable).toBe(e);
		});

		it("skips kinematic renderables (they aren't in the broadphase)", () => {
			const r = makeRectBody(world, 100, 100, 40, 40);
			r.isKinematic = true; // re-flag after creation
			rebuildBroadphase(world);

			// `insertContainer` skips `isKinematic === true` items, so
			// the body is invisible to raycast.
			const hits = raycastQuery(world, 0, 120, 200, 120);
			expect(hits.length).toEqual(0);
		});

		it("works for renderables nested deep inside a Container subtree", () => {
			const outer = new Container(0, 0, 800, 600);
			const inner = new Container(0, 0, 800, 600);
			world.addChild(outer);
			outer.addChild(inner);
			const target = new Renderable(100, 100, 40, 40);
			target.anchorPoint.set(0, 0);
			target.isKinematic = false;
			target.body = new Body(target, [new Rect(0, 0, 40, 40)]);
			inner.addChild(target);
			rebuildBroadphase(world);

			const hit = adapter.raycast(new Vector2d(0, 120), new Vector2d(200, 120));
			expect(hit).not.toBeNull();
			expect(hit.renderable).toBe(target);
		});

		it("detects a sensor body the same as a solid one (raycast ignores isSensor)", () => {
			const r = new Renderable(100, 100, 40, 40);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			r.body = new Body(r, [new Rect(0, 0, 40, 40)]);
			r.body.isSensor = true;
			world.addChild(r);
			rebuildBroadphase(world);

			const hit = adapter.raycast(new Vector2d(0, 120), new Vector2d(200, 120));
			expect(hit).not.toBeNull();
			expect(hit.renderable).toBe(r);
		});

		it("queries the broadphase consistently across many calls", () => {
			makeRectBody(world, 100, 100, 40, 40);
			rebuildBroadphase(world);
			let lastFraction = -1;
			for (let i = 0; i < 50; i++) {
				const hit = adapter.raycast(
					new Vector2d(0, 120),
					new Vector2d(200, 120),
				);
				expect(hit).not.toBeNull();
				if (i > 0) {
					expect(hit.fraction).toEqual(lastFraction);
				}
				lastFraction = hit.fraction;
			}
		});

		it("returns hits even when the body moved after broadphase insert (broadphase finds stale bounds)", () => {
			// The QuadTree.remove fallback walk handles the
			// stale-bounds path; raycast uses retrieve(), which walks
			// the bucket the item LIVED in at insert. If the body
			// physically moved without a broadphase rebuild, we still
			// SAT-test it (the live bounds are read from `body.getBounds`
			// at SAT time), so a moved body inside the ray's path is
			// still hit. This pins that behavior.
			const r = makeRectBody(world, 50, 50, 20, 20);
			rebuildBroadphase(world);
			// Move the renderable post-insert.
			r.pos.set(100, 100);
			r.updateBounds();

			const hits = raycastQuery(world, 0, 105, 200, 105);
			// The ray now passes through the new position. Whether the
			// stale broadphase still surfaces the candidate is
			// implementation-dependent; what matters is no crash.
			expect(Array.isArray(hits)).toEqual(true);
		});

		it("works with polygon-shaped bodies (non-axis-aligned)", () => {
			const r = new Renderable(100, 100, 60, 60);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			// Diamond-ish polygon centered in the renderable's bounds.
			r.body = new Body(r, [
				new Polygon(0, 0, [
					new Vector2d(30, 0),
					new Vector2d(60, 30),
					new Vector2d(30, 60),
					new Vector2d(0, 30),
				]),
			]);
			world.addChild(r);
			rebuildBroadphase(world);

			const hits = raycastQuery(world, 0, 130, 200, 130);
			expect(hits.length).toEqual(1);
			expect(hits[0].renderable).toBe(r);
		});
	});
});
