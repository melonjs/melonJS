/**
 * `raycast3d` against a `Box3d` body — exact ray-vs-AABB instead of the
 * bounding-sphere approximation (#1476).
 *
 * This is what makes floor-height probing usable: the sphere path derives
 * its radius from `getBounds()` width/height only — a 2D bounds with NO z
 * extent — so a wide flat floor slab reads as a huge sphere and reports a
 * hit well above its actual surface. The box path reports the surface.
 *
 * Renderables WITHOUT a Box3d body keep the sphere path untouched, so no
 * existing raycast3d result changes.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	Body,
	Box3d,
	boot,
	Renderable,
	video,
	World,
} from "../src/index.js";

/**
 * A corner-anchored renderable carrying a `Box3d` body, added to `world` at
 * depth `z`, so its collision frame origin IS its `pos` and every expectation
 * below can be read straight off the numbers passed in.
 *
 * Corner-anchored on purpose: since 20.7 a body is measured from the frame its
 * renderable DRAWS in, which `anchorPoint` shifts by `-size * anchorPoint`, so
 * a centred renderable would put the box half its own size from `pos`. That
 * shift is the subject of its own test at the end of this file rather than a
 * term buried in every other one.
 *
 * Body attached BEFORE `addChild`, which is what registers it with the
 * physics adapter (it reads `child.body` at insertion time). `raycast3d`
 * itself walks the Octree rather than the adapter's body set, so it would
 * work either way here — the order is kept correct so the helper isn't a
 * pattern worth copying into something that does need the registration.
 *
 * `addChild(child, z)` also sets pos.z atomically — assigning depth
 * afterwards would be overwritten by `Container.autoDepth`.
 */
function addBoxBody(world, { x, y, z, w, h, d }) {
	const r = new Renderable(x, y, w, h);
	r.anchorPoint.set(0, 0);
	r.isKinematic = false;
	r.body = new Body(r, new Box3d(0, 0, 0, w, h, d));
	world.addChild(r, z);
	return r;
}

describe("raycast3d — exact ray vs Box3d", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	/**
	 * Build a world with one Box3d-bodied renderable in it.
	 * Returns { world, target }.
	 */
	function worldWithBox(spec) {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const target = addBoxBody(world, spec);
		// force the world's per-frame broadphase rebuild so the target
		// actually lands in the Octree before the ray is cast
		world.update(16);
		return { world, target };
	}

	it("reports the surface of the box, not a circumscribed sphere", () => {
		// A wide, flat slab: 200 wide, 20 tall, 200 deep, centred at y=100.
		// Its top face is at y = 90. The bounding-sphere radius derived from
		// getBounds() would be √(200² + 20²)/2 ≈ 100.5, which would report a
		// hit around y ≈ 0 — 90 units above the actual surface.
		const { world } = worldWithBox({
			x: 100,
			y: 100,
			z: 100,
			w: 200,
			h: 20,
			d: 200,
		});

		const hit = world.adapter.raycast3d(
			{ x: 100, y: 0, z: 100 },
			{ x: 100, y: 200, z: 100 },
		);

		expect(hit).not.toBeNull();
		expect(hit.point.y).toBeCloseTo(90, 5);
	});

	it("reports the face normal of the entered slab", () => {
		const { world } = worldWithBox({
			x: 100,
			y: 100,
			z: 100,
			w: 200,
			h: 20,
			d: 200,
		});

		// straight down onto the top face → normal points up (-Y, Y-down space)
		const hit = world.adapter.raycast3d(
			{ x: 100, y: 0, z: 100 },
			{ x: 100, y: 200, z: 100 },
		);
		expect(hit.normal.x).toEqual(0);
		expect(hit.normal.y).toEqual(-1);
		expect(hit.normal.z).toEqual(0);
	});

	it("reports the face normal when entering along Z", () => {
		const { world } = worldWithBox({
			x: 100,
			y: 100,
			z: 100,
			w: 40,
			h: 40,
			d: 40,
		});

		const hit = world.adapter.raycast3d(
			{ x: 100, y: 100, z: 0 },
			{ x: 100, y: 100, z: 200 },
		);
		expect(hit.normal.z).toEqual(-1);
		expect(hit.point.z).toBeCloseTo(80, 5);
	});

	it("misses a box the ray passes beside", () => {
		const { world } = worldWithBox({
			x: 100,
			y: 100,
			z: 100,
			w: 20,
			h: 20,
			d: 20,
		});

		// offset well outside the 20-wide box, but inside the radius a
		// bounding sphere would have used
		const hit = world.adapter.raycast3d(
			{ x: 130, y: 0, z: 100 },
			{ x: 130, y: 200, z: 100 },
		);
		expect(hit).toBeNull();
	});

	it("misses a box that is behind the ray origin", () => {
		const { world } = worldWithBox({
			x: 100,
			y: 100,
			z: 100,
			w: 40,
			h: 40,
			d: 40,
		});

		const hit = world.adapter.raycast3d(
			{ x: 100, y: 200, z: 100 },
			{ x: 100, y: 400, z: 100 },
		);
		expect(hit).toBeNull();
	});

	it("misses a box past the segment end", () => {
		const { world } = worldWithBox({
			x: 100,
			y: 100,
			z: 100,
			w: 40,
			h: 40,
			d: 40,
		});

		// segment stops at y = 50, box top face is at y = 80
		const hit = world.adapter.raycast3d(
			{ x: 100, y: 0, z: 100 },
			{ x: 100, y: 50, z: 100 },
		);
		expect(hit).toBeNull();
	});

	it("reports fraction 0 when the origin is inside the box", () => {
		const { world } = worldWithBox({
			x: 100,
			y: 100,
			z: 100,
			w: 40,
			h: 40,
			d: 40,
		});

		const hit = world.adapter.raycast3d(
			{ x: 100, y: 100, z: 100 },
			{ x: 100, y: 300, z: 100 },
		);
		expect(hit).not.toBeNull();
		expect(hit.fraction).toEqual(0);
	});

	it("returns the nearest of several boxes", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";

		const near = addBoxBody(world, {
			x: 100,
			y: 100,
			z: 100,
			w: 40,
			h: 40,
			d: 40,
		});
		addBoxBody(world, { x: 100, y: 300, z: 100, w: 40, h: 40, d: 40 });

		world.update(16);

		const hit = world.adapter.raycast3d(
			{ x: 100, y: 0, z: 100 },
			{ x: 100, y: 400, z: 100 },
		);
		expect(hit).not.toBeNull();
		expect(hit.renderable).toBe(near);
	});

	it("still uses the bounding sphere for a body with no Box3d", () => {
		// unchanged legacy behaviour: a plain renderable is approximated by
		// its circumradius, so a ray that misses the 40x40 box but stays
		// inside the ~28.3 radius still reports a hit
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const target = new Renderable(100, 100, 40, 40);
		target.anchorPoint.set(0.5, 0.5);
		target.isKinematic = false;
		world.addChild(target, 100);
		world.update(16);

		const hit = world.adapter.raycast3d(
			{ x: 100, y: 100, z: 0 },
			{ x: 100, y: 100, z: 200 },
		);
		expect(hit).not.toBeNull();
		expect(hit.renderable).toBe(target);
	});
	// Regression for the frame `raycast3d` measures in.
	//
	// 20.7 moved the narrowphase onto the renderable's DRAWN frame, so a body
	// collides where its artwork is whatever the anchor. `raycast3d` builds
	// its own world AABB and was left measuring from raw `pos`, which put a
	// ray hit half a renderable away from the surface the same body collides
	// on. Nothing failed: every existing case here was one body, and both
	// halves of a query agreed with each other because neither was compared
	// to the narrowphase.
	//
	// A floor probe is the whole reason this path exists, and it is exactly
	// where the two disagreeing is worst: the character is placed on a surface
	// the solver does not have there.
	it("hits the box where the narrowphase collides with it", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";

		// A centred renderable: 200 wide and 20 tall at (300, 200), so it
		// DRAWS from (200, 190) and its box top face is 10 below that.
		const slab = new Renderable(300, 200, 200, 20);
		slab.anchorPoint.set(0.5, 0.5);
		slab.isKinematic = false;
		slab.body = new Body(slab, new Box3d(100, 10, 0, 200, 20, 200));
		world.addChild(slab, 100);
		world.update(16);

		// straight down the middle of the drawn frame
		const hit = world.adapter.raycast3d(
			{ x: 300, y: 0, z: 100 },
			{ x: 300, y: 400, z: 100 },
		);
		expect(hit).not.toBeNull();

		// the top of the box, in the frame the renderable draws in
		const drawnTop = slab.pos.y - slab.height * slab.anchorPoint.y;
		expect(hit.point.y).toBeCloseTo(drawnTop, 5);

		// and the bounds the engine culls and draws with agree with it
		expect(slab.getBounds().top).toBeCloseTo(drawnTop, 5);
	});
});
