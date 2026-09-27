/**
 * `Sphere` as a BODY shape, through the builtin 3D narrowphase.
 *
 * Sphere already existed as a query volume — `Octree` / `adapter.querySphere`
 * take one — but it was not in the `BodyShape` union and had no entry in the
 * narrowphase pair table, so it could not be collided with. That left
 * `Box3d` as the only 3D body shape, and a `Box3d` is world-axis-aligned: it
 * cannot be oriented, which makes it the wrong primitive for anything that
 * tumbles or is laid out over a curved surface, where every object's "up"
 * points a different way.
 *
 * Two levels here, deliberately. The first exercises the tests themselves,
 * including the two cases that have no natural answer and therefore need a
 * chosen one: concentric spheres, and a sphere whose centre is inside a box.
 * The second drives a real `world.update()` so the pair table, the 2D bounds
 * pre-gate and the push-out are proven to compose — each can be correct on
 * its own and still not carry a depth-only contact end to end.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { spherePool } from "../src/geometries/sphere.ts";
import {
	Application,
	Body,
	Box3d,
	boot,
	collision,
	Ellipse,
	Rect,
	Renderable,
	Sphere,
	video,
	World,
} from "../src/index.js";
import { Bounds } from "../src/physics/bounds.ts";
import {
	testBox3dSphere,
	testEllipseSphere,
	testPolygonSphere,
	testSphereBox3d,
	testSphereEllipse,
	testSpherePolygon,
	testSphereSphere,
} from "../src/physics/builtin/sat3d.js";
import ResponseObject from "../src/physics/response.js";

/** the running Application, shared by every describe in this file */
let app;

beforeAll(async () => {
	boot();
	app = new Application(800, 600, {
		parent: "screen",
		scale: "auto",
		renderer: video.CANVAS,
	});
	await app.init();
});

/**
 * A renderable at a position with a stubbed ancestor, matching the shape
 * the narrowphase reads: `.pos` plus `.ancestor.getAbsolutePosition()`.
 */
function at(x, y, z) {
	const r = new Renderable(x, y, 0, 0);
	r.anchorPoint.set(0, 0);
	r.pos.set(x, y, z);
	r.ancestor = {
		getAbsolutePosition() {
			return { x: 0, y: 0, z: 0 };
		},
	};
	return r;
}

/** a renderable carrying one 3D body shape, added to the world */
function addBody(world, { x, y, z, shape, isStatic = false, type }) {
	const r = new Renderable(x, y, 2, 2);
	r.anchorPoint.set(0.5, 0.5);
	// what a Mesh becomes under a Camera3d: it emits world coordinates, so
	// `preDraw` applies no anchor offset and neither does the narrowphase
	r.applyAnchorTransform = false;
	r.isKinematic = false;
	r.alwaysUpdate = true;
	r.body = new Body(r, shape);
	r.body.collisionType = type ?? collision.types.ENEMY_OBJECT;
	r.body.collisionMask = collision.types.ALL_OBJECT;
	r.body.isStatic = isStatic;
	r.body.gravityScale = 0;
	world.addChild(r, z);
	return r;
}

describe("Sphere — the 3D narrowphase", () => {
	it("separates two spheres along the line between their centres", () => {
		const res = new ResponseObject();
		// 10 apart on x, radii 8 and 6: overlapping by 4
		const hit = testSphereSphere(
			at(0, 0, 0),
			new Sphere(0, 0, 0, 8),
			at(10, 0, 0),
			new Sphere(0, 0, 0, 6),
			res,
		);
		expect(hit).toBe(true);
		expect(res.overlap).toBeCloseTo(4, 5);
		expect(res.overlapN.x).toBeCloseTo(1, 5);
		expect(res.overlapN.y).toBeCloseTo(0, 5);
		expect(res.overlapNZ).toBeCloseTo(0, 5);
	});

	it("carries a contact that is purely along z", () => {
		const res = new ResponseObject();
		const hit = testSphereSphere(
			at(0, 0, 0),
			new Sphere(0, 0, 0, 5),
			at(0, 0, 7),
			new Sphere(0, 0, 0, 5),
			res,
		);
		expect(hit).toBe(true);
		expect(res.overlap).toBeCloseTo(3, 5);
		// the whole normal is in the z half of the split, and none of it in
		// the 2D half: a depth-only contact that leaked into `overlapN`
		// would push the body sideways
		expect(res.overlapNZ).toBeCloseTo(1, 5);
		expect(res.overlapN.x).toBeCloseTo(0, 5);
		expect(res.overlapN.y).toBeCloseTo(0, 5);
		expect(res.overlapZ).toBeCloseTo(3, 5);
	});

	it("reports no contact when the gap exceeds the radii", () => {
		const res = new ResponseObject();
		expect(
			testSphereSphere(
				at(0, 0, 0),
				new Sphere(0, 0, 0, 4),
				at(0, 0, 9),
				new Sphere(0, 0, 0, 4),
				res,
			),
		).toBe(false);
	});

	it("touching surfaces count as a contact", () => {
		// boundary inclusive, matching Sphere.overlaps and AABB3d.overlaps
		expect(
			testSphereSphere(
				at(0, 0, 0),
				new Sphere(0, 0, 0, 4),
				at(8, 0, 0),
				new Sphere(0, 0, 0, 4),
			),
		).toBe(true);
	});

	it("picks a direction for concentric spheres rather than a zero normal", () => {
		const res = new ResponseObject();
		const hit = testSphereSphere(
			at(5, 5, 5),
			new Sphere(0, 0, 0, 3),
			at(5, 5, 5),
			new Sphere(0, 0, 0, 2),
			res,
		);
		expect(hit).toBe(true);
		// a zero normal makes the push-out a no-op and the pair stays
		// overlapping forever, so there has to be SOME direction
		const len = Math.hypot(res.overlapN.x, res.overlapN.y, res.overlapNZ);
		expect(len).toBeCloseTo(1, 5);
		expect(res.overlap).toBeCloseTo(5, 5);
	});

	it("reports the shape each side is inside of", () => {
		const res = new ResponseObject();
		testSphereSphere(
			at(0, 0, 0),
			new Sphere(0, 0, 0, 2),
			at(1, 0, 0),
			new Sphere(0, 0, 0, 9),
			res,
		);
		expect(res.aInB).toBe(true);
		expect(res.bInA).toBe(false);
	});

	it("separates a sphere from the face of a box it is outside", () => {
		const res = new ResponseObject();
		// box half-extents 10; sphere centre 14 along x with radius 6, so it
		// is 4 past the face
		const hit = testSphereBox3d(
			at(14, 0, 0),
			new Sphere(0, 0, 0, 6),
			at(0, 0, 0),
			new Box3d(0, 0, 0, 20, 20, 20),
			res,
		);
		expect(hit).toBe(true);
		expect(res.overlap).toBeCloseTo(2, 5);
		// pointing from the sphere toward the box
		expect(res.overlapN.x).toBeCloseTo(-1, 5);
	});

	it("pushes a sphere whose centre is inside a box out through the nearest face", () => {
		const res = new ResponseObject();
		// centre 8 along z inside a box of half-depth 10 and half-width 10:
		// z is the shallowest, so that is the way out
		const hit = testSphereBox3d(
			at(0, 0, 8),
			new Sphere(0, 0, 0, 3),
			at(0, 0, 0),
			new Box3d(0, 0, 0, 20, 20, 20),
			res,
		);
		expect(hit).toBe(true);
		// NEGATIVE: like every other pair here the normal runs from A toward
		// B, which is the direction the sphere gets pushed AGAINST. It sits
		// at +z inside the box, so the way out is +z and the normal is -z.
		expect(res.overlapNZ).toBeCloseTo(-1, 5);
		expect(res.overlapN.x).toBeCloseTo(0, 5);
		// the remaining 2 of the face, plus its own radius
		expect(res.overlap).toBeCloseTo(5, 5);
	});

	it("misses a box it is genuinely clear of", () => {
		expect(
			testSphereBox3d(
				at(0, 0, 30),
				new Sphere(0, 0, 0, 5),
				at(0, 0, 0),
				new Box3d(0, 0, 0, 20, 20, 20),
			),
		).toBe(false);
	});

	it("flips the normal for the box-first pair", () => {
		const sphereFirst = new ResponseObject();
		testSphereBox3d(
			at(14, 0, 0),
			new Sphere(0, 0, 0, 6),
			at(0, 0, 0),
			new Box3d(0, 0, 0, 20, 20, 20),
			sphereFirst,
		);
		const boxFirst = new ResponseObject();
		testBox3dSphere(
			at(0, 0, 0),
			new Box3d(0, 0, 0, 20, 20, 20),
			at(14, 0, 0),
			new Sphere(0, 0, 0, 6),
			boxFirst,
		);
		// same contact, opposite point of view: the depth is shared and the
		// direction is reversed. A mirrored entry that forgot to flip would
		// push the pair further into each other.
		expect(boxFirst.overlap).toBeCloseTo(sphereFirst.overlap, 5);
		expect(boxFirst.overlapN.x).toBeCloseTo(-sphereFirst.overlapN.x, 5);
	});
});

describe("Sphere — resolution through a full world step", () => {
	/** @type {World} */
	let world;

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
		// Octree broadphase, which is also what a 2.5D game sets
		world.sortOn = "depth";
	});

	it("pushes a sphere body out of a static sphere along z", () => {
		addBody(world, {
			x: 100,
			y: 100,
			z: 200,
			shape: new Sphere(0, 0, 0, 20),
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		const mover = addBody(world, {
			x: 100,
			y: 100,
			z: 185,
			shape: new Sphere(0, 0, 0, 20),
			type: collision.types.PLAYER_OBJECT,
		});

		const before = mover.pos.z;
		world.update(16);
		// overlapping by 25 along z with nothing else separating them, so the
		// only way out is back along z
		expect(mover.pos.z).toBeLessThan(before);
		expect(Math.abs(mover.pos.x - 100)).toBeLessThan(0.001);
	});

	it("resolves a sphere against a Box3d through the same step", () => {
		addBody(world, {
			x: 300,
			y: 100,
			z: 200,
			shape: new Box3d(0, 0, 0, 60, 60, 60),
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		const mover = addBody(world, {
			x: 300,
			y: 100,
			z: 245,
			shape: new Sphere(0, 0, 0, 20),
			type: collision.types.PLAYER_OBJECT,
		});

		const before = mover.pos.z;
		world.update(16);
		// 30 of box plus 20 of sphere is 50, and it sits at 45: pushed out
		// along +z, the axis it is shallowest on
		expect(mover.pos.z).toBeGreaterThan(before);
	});

	it("leaves a sphere alone when it is clear of the box", () => {
		addBody(world, {
			x: 500,
			y: 100,
			z: 200,
			shape: new Box3d(0, 0, 0, 60, 60, 60),
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		const mover = addBody(world, {
			x: 500,
			y: 100,
			z: 300,
			shape: new Sphere(0, 0, 0, 20),
			type: collision.types.PLAYER_OBJECT,
		});

		const before = mover.pos.z;
		world.update(16);
		expect(mover.pos.z).toBeCloseTo(before, 5);
	});

	it("marks a body carrying a Sphere as having depth", () => {
		const r = addBody(world, {
			x: 700,
			y: 100,
			z: 100,
			shape: new Sphere(0, 0, 0, 10),
		});
		// what tells the rest of the pipeline this body can be resolved
		// along z at all; false here and every contact above stays 2D
		expect(r.body.hasDepth).toBe(true);
	});
});

describe("Sphere — the shape of the contact normal", () => {
	it("separates along the line between centres, diagonally", () => {
		const res = new ResponseObject();
		// offset on all three axes at once, which a Box3d pair can never
		// produce: it always resolves along ONE world axis
		const hit = testSphereSphere(
			at(0, 0, 0),
			new Sphere(0, 0, 0, 10),
			at(6, 6, 6),
			new Sphere(0, 0, 0, 10),
			res,
		);
		expect(hit).toBe(true);

		const gap = Math.sqrt(6 * 6 * 3);
		expect(res.overlap).toBeCloseTo(20 - gap, 5);
		// every component non-zero, and the three together a unit vector
		expect(res.overlapN.x).toBeCloseTo(6 / gap, 5);
		expect(res.overlapN.y).toBeCloseTo(6 / gap, 5);
		expect(res.overlapNZ).toBeCloseTo(6 / gap, 5);
		expect(
			Math.hypot(res.overlapN.x, res.overlapN.y, res.overlapNZ),
		).toBeCloseTo(1, 5);
		// and the documented invariant holds on BOTH halves, which is what a
		// handler subtracting overlapV plus overlapZ depends on
		expect(res.overlapV.x).toBeCloseTo(res.overlapN.x * res.overlap, 5);
		expect(res.overlapV.y).toBeCloseTo(res.overlapN.y * res.overlap, 5);
		expect(res.overlapZ).toBeCloseTo(res.overlapNZ * res.overlap, 5);
	});

	it("treats a negative radius as its absolute value", () => {
		const res = new ResponseObject();
		// 10 apart, |−8| + 6 = 14: overlapping by 4, exactly as +8 would
		const hit = testSphereSphere(
			at(0, 0, 0),
			new Sphere(0, 0, 0, -8),
			at(10, 0, 0),
			new Sphere(0, 0, 0, 6),
			res,
		);
		expect(hit).toBe(true);
		expect(res.overlap).toBeCloseTo(4, 5);
		// and the containment flags read the same absolute radii
		expect(res.aInB).toBe(false);
		expect(res.bInA).toBe(false);
	});

	it("handles a zero-radius sphere as a point", () => {
		const res = new ResponseObject();
		const hit = testSphereSphere(
			at(0, 0, 0),
			new Sphere(0, 0, 0, 0),
			at(3, 0, 0),
			new Sphere(0, 0, 0, 5),
			res,
		);
		expect(hit).toBe(true);
		expect(res.overlap).toBeCloseTo(2, 5);
		// a point inside a sphere is entirely inside it
		expect(res.aInB).toBe(true);
	});

	it("measures from the shape offset, not the renderable alone", () => {
		// both renderables at the same place: any contact has to come from
		// the shapes' own offsets
		const res = new ResponseObject();
		expect(
			testSphereSphere(
				at(0, 0, 0),
				new Sphere(-30, 0, 0, 5),
				at(0, 0, 0),
				new Sphere(30, 0, 0, 5),
				res,
			),
		).toBe(false);
		expect(
			testSphereSphere(
				at(0, 0, 0),
				new Sphere(-4, 0, 0, 5),
				at(0, 0, 0),
				new Sphere(4, 0, 0, 5),
				res,
			),
		).toBe(true);
		expect(res.overlap).toBeCloseTo(2, 5);
	});

	it("resolves a corner contact with a box on more than one axis", () => {
		const res = new ResponseObject();
		// diagonally off the box's +x+y corner, so the closest point on the
		// box IS that corner and the normal runs through it
		const hit = testSphereBox3d(
			at(14, 14, 0),
			new Sphere(0, 0, 0, 8),
			at(0, 0, 0),
			new Box3d(0, 0, 0, 20, 20, 20),
			res,
		);
		expect(hit).toBe(true);
		expect(res.overlapN.x).toBeCloseTo(-Math.SQRT1_2, 5);
		expect(res.overlapN.y).toBeCloseTo(-Math.SQRT1_2, 5);
		expect(res.overlapNZ).toBeCloseTo(0, 5);
		// |(14,14) − (10,10)| = 5.657 from the corner, radius 8
		expect(res.overlap).toBeCloseTo(8 - Math.hypot(4, 4), 5);
	});

	it("picks a direction for a sphere centred exactly in a box", () => {
		const res = new ResponseObject();
		const hit = testSphereBox3d(
			at(0, 0, 0),
			new Sphere(0, 0, 0, 3),
			at(0, 0, 0),
			new Box3d(0, 0, 0, 20, 20, 20),
			res,
		);
		expect(hit).toBe(true);
		// a zero normal would make the push-out a no-op forever
		expect(
			Math.hypot(res.overlapN.x, res.overlapN.y, res.overlapNZ),
		).toBeCloseTo(1, 5);
	});

	it("reports containment both ways round for a sphere and a box", () => {
		// sphere swallowed by the box
		const inBox = new ResponseObject();
		testSphereBox3d(
			at(0, 0, 0),
			new Sphere(0, 0, 0, 3),
			at(0, 0, 0),
			new Box3d(0, 0, 0, 40, 40, 40),
			inBox,
		);
		expect(inBox.aInB).toBe(true);
		expect(inBox.bInA).toBe(false);

		// and the same pair seen from the box, where the flags have to swap
		const boxFirst = new ResponseObject();
		testBox3dSphere(
			at(0, 0, 0),
			new Box3d(0, 0, 0, 40, 40, 40),
			at(0, 0, 0),
			new Sphere(0, 0, 0, 3),
			boxFirst,
		);
		expect(boxFirst.aInB).toBe(false);
		expect(boxFirst.bInA).toBe(true);
	});

	it("keeps every field consistent after the box-first flip", () => {
		const sphereFirst = new ResponseObject();
		testSphereBox3d(
			at(6, 9, 4),
			new Sphere(0, 0, 0, 12),
			at(0, 0, 0),
			new Box3d(0, 0, 0, 20, 20, 20),
			sphereFirst,
		);
		const boxFirst = new ResponseObject();
		testBox3dSphere(
			at(0, 0, 0),
			new Box3d(0, 0, 0, 20, 20, 20),
			at(6, 9, 4),
			new Sphere(0, 0, 0, 12),
			boxFirst,
		);
		expect(boxFirst.overlap).toBeCloseTo(sphereFirst.overlap, 5);
		// EVERY component reversed, not just x
		expect(boxFirst.overlapN.x).toBeCloseTo(-sphereFirst.overlapN.x, 5);
		expect(boxFirst.overlapN.y).toBeCloseTo(-sphereFirst.overlapN.y, 5);
		expect(boxFirst.overlapNZ).toBeCloseTo(-sphereFirst.overlapNZ, 5);
		// and the derived vectors rebuilt from the flipped normal rather than
		// left pointing the old way
		expect(boxFirst.overlapV.x).toBeCloseTo(
			boxFirst.overlapN.x * boxFirst.overlap,
			5,
		);
		expect(boxFirst.overlapZ).toBeCloseTo(
			boxFirst.overlapNZ * boxFirst.overlap,
			5,
		);
	});
});

describe("Sphere — against the planar shapes", () => {
	/**
	 * A sphere's XY silhouette is a circle of its own radius, so these pairs
	 * degrade to the 2D test with the planar shape read as unbounded along Z.
	 * That is what lets a sphere body collide with a Tiled collision layer,
	 * which is `Polygon` and `Rectangle` shapes and nothing else.
	 */
	it("collides with a rectangle, with no depth in the result", () => {
		const res = new ResponseObject();
		// circle of radius 10 at (35,20), rect spanning x 0..30, y 0..40
		const hit = testSpherePolygon(
			at(35, 20, 0),
			new Sphere(0, 0, 0, 10),
			at(0, 0, 0),
			new Rect(0, 0, 30, 40).toPolygon(),
			res,
		);
		expect(hit).toBe(true);
		expect(res.overlap).toBeCloseTo(5, 5);
		// A toward B, like every other pair here: the sphere sits to the
		// right of the rectangle and the normal points back at it
		expect(res.overlapN.x).toBeCloseTo(-1, 5);
		// the planar shape has no depth to resolve against
		expect(res.overlapZ).toBe(0);
		expect(res.overlapNZ).toBe(0);
	});

	it("is unbounded along Z, so the sphere's own depth cannot make it miss", () => {
		// 500 units away in z and still colliding: the polygon is read as an
		// infinitely extruded prism, exactly as it is for a Box3d
		expect(
			testSpherePolygon(
				at(35, 20, 500),
				new Sphere(0, 0, 0, 10),
				at(0, 0, 0),
				new Rect(0, 0, 30, 40).toPolygon(),
			),
		).toBe(true);
	});

	it("collides with the polygon first as well, with the normal reversed", () => {
		const sphereFirst = new ResponseObject();
		testSpherePolygon(
			at(35, 20, 0),
			new Sphere(0, 0, 0, 10),
			at(0, 0, 0),
			new Rect(0, 0, 30, 40).toPolygon(),
			sphereFirst,
		);
		const polyFirst = new ResponseObject();
		testPolygonSphere(
			at(0, 0, 0),
			new Rect(0, 0, 30, 40).toPolygon(),
			at(35, 20, 0),
			new Sphere(0, 0, 0, 10),
			polyFirst,
		);
		expect(polyFirst.overlap).toBeCloseTo(sphereFirst.overlap, 5);
		expect(polyFirst.overlapN.x).toBeCloseTo(-sphereFirst.overlapN.x, 5);
	});

	it("collides with an ellipse, both ways round", () => {
		const res = new ResponseObject();
		// radius 10 and radius 8, centres 15 apart: overlapping by 3
		expect(
			testSphereEllipse(
				at(0, 0, 0),
				new Sphere(0, 0, 0, 10),
				at(15, 0, 0),
				new Ellipse(0, 0, 16, 16),
				res,
			),
		).toBe(true);
		expect(res.overlap).toBeCloseTo(3, 5);

		const flipped = new ResponseObject();
		expect(
			testEllipseSphere(
				at(15, 0, 0),
				new Ellipse(0, 0, 16, 16),
				at(0, 0, 0),
				new Sphere(0, 0, 0, 10),
				flipped,
			),
		).toBe(true);
		expect(flipped.overlap).toBeCloseTo(3, 5);
		expect(flipped.overlapN.x).toBeCloseTo(-res.overlapN.x, 5);
	});

	it("misses a rectangle it is clear of", () => {
		expect(
			testSpherePolygon(
				at(100, 20, 0),
				new Sphere(0, 0, 0, 10),
				at(0, 0, 0),
				new Rect(0, 0, 30, 40).toPolygon(),
			),
		).toBe(false);
	});

	it("does not poison the SAT axes with a zero-radius sphere", () => {
		// `Ellipse.setShape` normalizes a zero-size shape into NaN ratios,
		// which would make every later axis test compare against NaN and
		// report a miss for the rest of the frame
		const res = new ResponseObject();
		const hit = testSpherePolygon(
			at(15, 20, 0),
			new Sphere(0, 0, 0, 0),
			at(0, 0, 0),
			new Rect(0, 0, 30, 40).toPolygon(),
			res,
		);
		expect(hit).toBe(true);
		expect(Number.isNaN(res.overlap)).toBe(false);
	});
});

describe("Sphere — what a diagonal normal must NOT do", () => {
	/**
	 * Every 3D contact before `Sphere` resolved along one world axis, so the
	 * planar half of the normal was either zero or the whole of it. A sphere
	 * contact that is almost entirely depth still carries a sliver of x and
	 * y, and two pieces of 2D bookkeeping used to read that sliver as a real
	 * planar contact.
	 */
	let world;

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
	});

	it("does not record a planar block from a depth contact", () => {
		addBody(world, {
			x: 100,
			y: 100,
			z: 200,
			shape: new Sphere(0, 0, 0, 20),
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		// a hundredth of a unit off in y, fifteen along z: 99.9% a depth
		// contact, and the y sliver is what used to pin the body upward
		const mover = addBody(world, {
			x: 100,
			y: 100.01,
			z: 185,
			shape: new Sphere(0, 0, 0, 20),
			type: collision.types.PLAYER_OBJECT,
		});

		world.update(16);
		// pinned "up" here means a genuine vertical contact later in the same
		// step gets ratio 0 and the other body absorbs the whole correction
		expect(mover.body.immovableBlock).toBe(0);
	});

	it("does not flip the ground state from a depth contact", () => {
		addBody(world, {
			x: 300,
			y: 100,
			z: 200,
			shape: new Sphere(0, 0, 0, 20),
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		const mover = addBody(world, {
			x: 300,
			y: 100.01,
			z: 185,
			shape: new Sphere(0, 0, 0, 20),
			type: collision.types.PLAYER_OBJECT,
		});
		// The flags are only maintained for gravity-affected bodies, so the
		// body has to be one — but with the world pulling nothing, so that
		// what this measures is the CONTACT's opinion of the flags and not
		// `Body#update`'s, which sets `falling` from velocity every step.
		mover.body.gravityScale = 1;
		world.adapter.gravity.set(0, 0);

		world.update(16);
		// `isGrounded()` is `!falling && !jumping`, so a depth contact read as
		// a floor or a ceiling makes a standing body report airborne
		expect(mover.body.falling).toBe(false);
		expect(mover.body.jumping).toBe(false);
		expect(world.adapter.isGrounded(mover)).toBe(true);
	});

	it("still records a planar block when the contact IS planar", () => {
		// the other side of the same gate: a contact that is mostly x must go
		// on recording, or the fix would have disabled the bookkeeping
		addBody(world, {
			x: 500,
			y: 100,
			z: 200,
			shape: new Sphere(0, 0, 0, 20),
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		const mover = addBody(world, {
			x: 525,
			y: 100,
			z: 200.01,
			shape: new Sphere(0, 0, 0, 20),
			type: collision.types.PLAYER_OBJECT,
		});

		world.update(16);
		expect(mover.body.immovableBlock).not.toBe(0);
	});
});

describe("Sphere — body bookkeeping", () => {
	it("recycles a pooled sphere on destroy", () => {
		// drained so the assertions below are about THIS instance
		while (spherePool.size() > 0) {
			spherePool.get(0, 0, 0, 1);
		}
		const pooled = spherePool.get(1, 2, 3, 4);
		const r = at(0, 0, 0);
		r.body = new Body(r, pooled);

		r.body.destroy();
		expect(spherePool.size()).toBe(1);
		// and it comes back carrying the geometry the caller asked for, not
		// the body's
		const reused = spherePool.get(7, 8, 9, 10);
		expect(reused).toBe(pooled);
		expect(reused.pos.z).toBe(9);
		expect(reused.radius).toBe(10);
	});

	it("drops a hand-constructed sphere instead of pooling it unreset", () => {
		// `new Body(r, new Sphere(...))` is the documented idiom, so the shape
		// a body destroys is usually one the pool never created. It has no
		// reset registered, so pooling it would hand the NEXT caller a sphere
		// wearing this body's geometry and ignoring the arguments it passed.
		while (spherePool.size() > 0) {
			spherePool.get(0, 0, 0, 1);
		}
		const r = at(0, 0, 0);
		r.body = new Body(r, new Sphere(1, 2, 3, 4));
		r.body.destroy();
		expect(spherePool.size()).toBe(0);

		const fresh = spherePool.get(5, 6, 7, 8);
		expect(fresh.pos.z).toBe(7);
		expect(fresh.radius).toBe(8);
	});

	it("keeps hasDepth right through a mixed body", () => {
		const r = at(0, 0, 0);
		const box = new Box3d(0, 0, 0, 10, 10, 10);
		const sphere = new Sphere(0, 0, 0, 5);
		r.body = new Body(r, [box, sphere]);
		expect(r.body.hasDepth).toBe(true);

		// still 3D with only the sphere left
		r.body.removeShape(box);
		expect(r.body.hasDepth).toBe(true);
		// and flat once that goes too
		r.body.removeShape(sphere);
		expect(r.body.hasDepth).toBe(false);
	});

	it("unions the XY footprint of every shape into the body bounds", () => {
		const r = at(0, 0, 0);
		// a 10-wide box at the origin and a radius-5 sphere 40 along x, so
		// the footprint spans x −5..45
		r.body = new Body(r, [
			new Box3d(0, 0, 0, 10, 10, 10),
			new Sphere(40, 0, 0, 5),
		]);
		expect(r.body.bounds.left).toBeCloseTo(-5, 5);
		expect(r.body.bounds.right).toBeCloseTo(45, 5);
	});

	it("survives a rotate() it cannot apply", () => {
		const r = at(0, 0, 0);
		r.body = new Body(r, new Sphere(0, 0, 0, 5));
		// a sphere has no orientation, so there is nothing to turn — but the
		// body must not throw on the way past it either
		expect(() => {
			return r.body.rotate(Math.PI / 4);
		}).not.toThrow();
		expect(r.body.bounds.width).toBeCloseTo(10, 5);
	});

	it("reports bounds from where the sphere is NOW", () => {
		// the AABB is reused, not cached against a stale centre: as a body
		// shape a sphere gets moved through `pos` by whoever owns it
		const sphere = new Sphere(0, 0, 0, 5);
		expect(sphere.getBounds().min.x).toBeCloseTo(-5, 5);
		sphere.pos.set(100, 0, 0);
		expect(sphere.getBounds().min.x).toBeCloseTo(95, 5);
	});
});

describe("Sphere — the adapter surface", () => {
	let world;

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
	});

	it("keeps the depth offset when reporting an anchored body's shapes", () => {
		// a centred renderable, which is the DEFAULT for anything but a Mesh:
		// its shapes come back as anchor-shifted copies
		const r = new Renderable(200, 200, 40, 40);
		r.anchorPoint.set(0.5, 0.5);
		r.isKinematic = false;
		r.body = new Body(r, new Sphere(0, 0, 25, 5));
		r.body.collisionType = collision.types.ENEMY_OBJECT;
		world.addChild(r, 100);

		const [shape] = world.adapter.getBodyShapes(r);
		// shifted by half the frame in x and y
		expect(shape.pos.x).toBeCloseTo(-20, 5);
		expect(shape.pos.y).toBeCloseTo(-20, 5);
		// and NOT flattened onto the renderable's own depth, which is what a
		// two-argument `Vector3d.set` would have done
		expect(shape.pos.z).toBeCloseTo(25, 5);
	});

	it("reports the sphere's own square as the body AABB", () => {
		const r = addBody(world, {
			x: 400,
			y: 300,
			z: 100,
			shape: new Sphere(0, 0, 0, 25),
		});
		const aabb = world.adapter.getBodyAABB(r, new Bounds());
		expect(aabb.width).toBeCloseTo(50, 5);
		expect(aabb.height).toBeCloseTo(50, 5);
	});

	it("strokes a sphere shape rather than throwing", () => {
		// what the debug panel's hitbox overlay does under a 2D camera, every
		// frame, for every body it draws
		const sphere = new Sphere(10, 20, 30, 8);
		expect(() => {
			return app.renderer.stroke(sphere);
		}).not.toThrow();
		expect(() => {
			return app.renderer.fill(sphere);
		}).not.toThrow();
	});
});

describe("Sphere — raycast3d", () => {
	let world;

	/** a sphere body in a world whose broadphase has been rebuilt */
	function worldWithSphere(shape, { x = 400, y = 300, z = 100 } = {}) {
		world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const target = addBody(world, { x, y, z, shape });
		world.update(16);
		return target;
	}

	it("reports the sphere's own surface", () => {
		// radius 30 at z 100, so a ray down the z axis enters at z 70. The
		// bounding-sphere fallback derives its radius from the renderable's
		// 2D bounds — 1.41 for a 2x2 renderable — and reports z ≈ 98.6.
		worldWithSphere(new Sphere(0, 0, 0, 30));
		const hit = world.adapter.raycast3d(
			{ x: 400, y: 300, z: 0 },
			{ x: 400, y: 300, z: 400 },
		);
		expect(hit).not.toBeNull();
		expect(hit.point.z).toBeCloseTo(70, 4);
		// entered head on, so the surface normal points back down the ray
		expect(hit.normal.z).toBeCloseTo(-1, 4);
	});

	it("is hit by a ray that misses its centre", () => {
		// 20 off-axis through a radius-30 sphere: a chord, and the entry
		// point is √(30² − 20²) = 22.36 short of the centre
		worldWithSphere(new Sphere(0, 0, 0, 30));
		const hit = world.adapter.raycast3d(
			{ x: 420, y: 300, z: 0 },
			{ x: 420, y: 300, z: 400 },
		);
		expect(hit).not.toBeNull();
		expect(hit.point.z).toBeCloseTo(100 - Math.sqrt(30 * 30 - 20 * 20), 4);
	});

	it("misses a ray that passes outside it", () => {
		worldWithSphere(new Sphere(0, 0, 0, 30));
		const hit = world.adapter.raycast3d(
			{ x: 440, y: 300, z: 0 },
			{ x: 440, y: 300, z: 400 },
		);
		expect(hit).toBeNull();
	});

	it("measures from the shape's own offset", () => {
		// the sphere sits 50 along z from its renderable, so the surface the
		// ray meets is at z = 100 + 50 − 30
		worldWithSphere(new Sphere(0, 0, 50, 30));
		const hit = world.adapter.raycast3d(
			{ x: 400, y: 300, z: 0 },
			{ x: 400, y: 300, z: 400 },
		);
		expect(hit).not.toBeNull();
		expect(hit.point.z).toBeCloseTo(120, 4);
	});

	it("measures an anchored body from the frame it draws in", () => {
		// a centred 40x40 renderable at (400, 300) draws from (380, 280), so
		// its sphere is centred there and a ray down x = 400 misses it by 20
		world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const r = new Renderable(400, 300, 40, 40);
		r.anchorPoint.set(0.5, 0.5);
		r.isKinematic = false;
		r.alwaysUpdate = true;
		r.body = new Body(r, new Sphere(0, 0, 0, 30));
		r.body.collisionType = collision.types.ENEMY_OBJECT;
		r.body.gravityScale = 0;
		world.addChild(r, 100);
		world.update(16);

		// straight down the SHIFTED centre, so the ray crosses the full
		// diameter and enters at 100 - 30
		const hit = world.adapter.raycast3d(
			{ x: 380, y: 280, z: 0 },
			{ x: 380, y: 280, z: 400 },
		);
		expect(hit).not.toBeNull();
		// Measured from `pos` instead, the centre would be 28.3 away from
		// this ray and the entry would be 90, not 70.
		expect(hit.point.z).toBeCloseTo(70, 4);
	});

	it("sees a body that mixes a sphere with a box", () => {
		// two shapes cannot be one sphere, so this degrades to the unioned
		// AABB — the point being that it is visible at all, where a
		// sphere-blind union reported only the box
		world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		addBody(world, {
			x: 400,
			y: 300,
			z: 100,
			shape: [new Box3d(0, 0, 0, 10, 10, 10), new Sphere(0, 0, 0, 60)],
		});
		world.update(16);
		const hit = world.adapter.raycast3d(
			{ x: 400, y: 300, z: 0 },
			{ x: 400, y: 300, z: 400 },
		);
		expect(hit).not.toBeNull();
		// the sphere reaches to z = 40; the box alone would have said 95
		expect(hit.point.z).toBeCloseTo(40, 4);
	});
});

describe("Sphere — through a world step", () => {
	let world;

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
	});

	it("is pushed out of a static rectangle, as a map's geometry is", () => {
		// the case that makes a sphere body usable in an existing level: a
		// Tiled collision layer is Rectangle and Polygon shapes
		const wall = new Renderable(100, 100, 60, 60);
		wall.anchorPoint.set(0, 0);
		wall.applyAnchorTransform = false;
		wall.isKinematic = false;
		wall.body = new Body(wall, new Rect(0, 0, 60, 60));
		wall.body.collisionType = collision.types.WORLD_SHAPE;
		wall.body.collisionMask = collision.types.ALL_OBJECT;
		wall.body.isStatic = true;
		world.addChild(wall, 100);

		// overlapping the wall's left edge by 10
		const mover = addBody(world, {
			x: 90,
			y: 130,
			z: 100,
			shape: new Sphere(0, 0, 0, 20),
			type: collision.types.PLAYER_OBJECT,
		});

		const before = mover.pos.x;
		world.update(16);
		expect(mover.pos.x).toBeLessThan(before);
		// and no depth correction, since the rectangle has no depth
		expect(mover.pos.z).toBeCloseTo(100, 5);
	});

	it("is pushed out of a static ellipse too", () => {
		// the other planar pair the lookup table has to carry, in the order
		// the detector happens to hand it over
		const post = new Renderable(300, 300, 40, 40);
		post.anchorPoint.set(0, 0);
		post.applyAnchorTransform = false;
		post.isKinematic = false;
		post.body = new Body(post, new Ellipse(0, 0, 40, 40));
		post.body.collisionType = collision.types.WORLD_SHAPE;
		post.body.collisionMask = collision.types.ALL_OBJECT;
		post.body.isStatic = true;
		world.addChild(post, 100);

		const mover = addBody(world, {
			x: 275,
			y: 300,
			z: 100,
			shape: new Sphere(0, 0, 0, 20),
			type: collision.types.PLAYER_OBJECT,
		});

		const before = mover.pos.x;
		world.update(16);
		expect(mover.pos.x).toBeLessThan(before);
	});

	it("reports a sensor contact without pushing anything out", () => {
		const trigger = addBody(world, {
			x: 400,
			y: 100,
			z: 200,
			shape: new Sphere(0, 0, 0, 30),
			type: collision.types.ACTION_OBJECT,
		});
		trigger.body.isSensor = true;

		let seen = 0;
		const mover = addBody(world, {
			x: 400,
			y: 100,
			z: 190,
			shape: new Sphere(0, 0, 0, 20),
			type: collision.types.PLAYER_OBJECT,
		});
		mover.onCollisionStart = () => {
			seen++;
		};

		const before = mover.pos.z;
		world.update(16);
		expect(seen).toBe(1);
		// a sensor reports and does not resolve
		expect(mover.pos.z).toBeCloseTo(before, 5);
	});

	it("resolves from the frame an anchored renderable draws in", () => {
		// `applyAnchorTransform` left at its default, so the body is measured
		// from `pos - size * anchorPoint`, not from `pos`. A 40x40 renderable
		// centred at (200, 200) draws from (180, 180), which is where its
		// sphere sits.
		const anchored = new Renderable(200, 200, 40, 40);
		anchored.anchorPoint.set(0.5, 0.5);
		anchored.isKinematic = false;
		anchored.alwaysUpdate = true;
		anchored.body = new Body(anchored, new Sphere(0, 0, 0, 20));
		anchored.body.collisionType = collision.types.PLAYER_OBJECT;
		anchored.body.collisionMask = collision.types.ALL_OBJECT;
		anchored.body.gravityScale = 0;
		world.addChild(anchored, 100);

		// a static sphere 25 to the right of where the anchored one actually
		// is: overlapping by 15, so it gets pushed left
		addBody(world, {
			x: 205,
			y: 180,
			z: 100,
			shape: new Sphere(0, 0, 0, 20),
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});

		world.update(16);
		expect(anchored.pos.x).toBeLessThan(200);
		expect(anchored.pos.y).toBeCloseTo(200, 5);
	});

	it("resolves a shape that sits off its body's origin", () => {
		// the sphere is 40 along z from the renderable, which is where the
		// contact has to be measured
		addBody(world, {
			x: 600,
			y: 100,
			z: 100,
			shape: new Sphere(0, 0, 40, 20),
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		const mover = addBody(world, {
			x: 600,
			y: 100,
			z: 115,
			shape: new Sphere(0, 0, 0, 20),
			type: collision.types.PLAYER_OBJECT,
		});

		const before = mover.pos.z;
		world.update(16);
		// the static sphere's centre is at z 140, the mover's at 115: pushed
		// further away, not toward the renderable's own 100
		expect(mover.pos.z).toBeLessThan(before);
	});

	it("separates a compound body carrying a sphere and a box", () => {
		addBody(world, {
			x: 700,
			y: 300,
			z: 200,
			shape: new Sphere(0, 0, 0, 20),
			isStatic: true,
			type: collision.types.WORLD_SHAPE,
		});
		const mover = addBody(world, {
			x: 700,
			y: 300,
			z: 185,
			shape: [new Box3d(0, 0, 0, 10, 10, 10), new Sphere(0, 0, 0, 20)],
			type: collision.types.PLAYER_OBJECT,
		});

		world.update(16);
		// clear of the static sphere afterwards: 20 + 20 of radii apart
		expect(Math.abs(mover.pos.z - 200)).toBeGreaterThanOrEqual(39.9);
	});
});
