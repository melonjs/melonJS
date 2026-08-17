/**
 * `Box3d` — the shape that lets a body collide along Z — plus the
 * AABB-vs-AABB narrowphase behind it (#1476).
 *
 * Two things are under test here and they pull in opposite directions:
 *
 *  1. the new 3D behaviour is CORRECT — checked differentially against a
 *     brute-force AABB overlap, since a narrowphase that silently misses
 *     contacts is the failure mode that doesn't announce itself; and
 *  2. the existing 2D behaviour is UNCHANGED — the whole point of doing
 *     this additively. Anything a 2D game could observe (`overlapV`,
 *     `overlapN`, the push-out, the number of position writes) has to come
 *     out bit-for-bit the same as before.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
	Body,
	Box3d,
	Ellipse,
	Polygon,
	Rect,
	Renderable,
	RoundRect,
	Vector2d,
} from "../src/index.js";
import Detector from "../src/physics/builtin/detector.js";
import { testBox3dBox3d } from "../src/physics/builtin/sat3d.js";
import ResponseObject from "../src/physics/response.js";

/** Deterministic LCG — reproducible failures beat `Math.random()`. */
function lcg(seed) {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

/**
 * A renderable positioned at (x, y, z) with a stubbed ancestor, matching the
 * shape the SAT narrowphase expects (`.pos` + `.ancestor.getAbsolutePosition()`).
 */
function makeRenderable(x = 0, y = 0, z = 0) {
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

/** world-space AABB of a Box3d owned by `renderable` */
function worldBox(renderable, box) {
	return {
		minX: renderable.pos.x + box.pos.x - box.halfExtents.x,
		minY: renderable.pos.y + box.pos.y - box.halfExtents.y,
		minZ: renderable.pos.z + box.pos.z - box.halfExtents.z,
		maxX: renderable.pos.x + box.pos.x + box.halfExtents.x,
		maxY: renderable.pos.y + box.pos.y + box.halfExtents.y,
		maxZ: renderable.pos.z + box.pos.z + box.halfExtents.z,
	};
}

/** brute-force AABB overlap, strict (touching does not count) */
function bruteOverlap(a, b) {
	return (
		a.minX < b.maxX &&
		a.maxX > b.minX &&
		a.minY < b.maxY &&
		a.maxY > b.minY &&
		a.minZ < b.maxZ &&
		a.maxZ > b.minZ
	);
}

describe("Box3d — shape", () => {
	it("treats pos as the CENTER, not the corner", () => {
		const box = new Box3d(10, 20, 30, 4, 6, 8);
		expect(box.pos.x).toEqual(10);
		expect(box.pos.y).toEqual(20);
		expect(box.pos.z).toEqual(30);
		expect(box.halfExtents.x).toEqual(2);
		expect(box.halfExtents.y).toEqual(3);
		expect(box.halfExtents.z).toEqual(4);

		const aabb = box.getBounds3d();
		expect(aabb.min.x).toEqual(8);
		expect(aabb.max.x).toEqual(12);
		expect(aabb.min.y).toEqual(17);
		expect(aabb.max.y).toEqual(23);
		expect(aabb.min.z).toEqual(26);
		expect(aabb.max.z).toEqual(34);
	});

	it("exposes a 2D XY footprint via getBounds()", () => {
		const box = new Box3d(10, 20, 30, 4, 6, 8);
		const bounds = box.getBounds();
		expect(bounds.x).toEqual(8);
		expect(bounds.y).toEqual(17);
		expect(bounds.width).toEqual(4);
		expect(bounds.height).toEqual(6);
	});

	it("keeps the footprint in sync when the size changes", () => {
		const box = new Box3d(0, 0, 0, 2, 2, 2);
		box.width = 10;
		box.height = 20;
		expect(box.getBounds().width).toEqual(10);
		expect(box.getBounds().height).toEqual(20);
		expect(box.getBounds().x).toEqual(-5);
		expect(box.getBounds().y).toEqual(-10);
	});

	it("keeps the footprint in sync when shifted", () => {
		const box = new Box3d(0, 0, 0, 4, 4, 4);
		box.shift(10, 20, 30);
		expect(box.pos.z).toEqual(30);
		expect(box.getBounds().x).toEqual(8);
		expect(box.getBounds().y).toEqual(18);
	});

	it("never produces NaN footprint normals on a degenerate box", () => {
		// `Polygon.recalc` normalizes each edge by its own length with NO
		// zero guard, so a zero-size footprint would yield 0/0 = NaN and
		// poison every SAT axis test downstream. A default-constructed
		// Box3d is exactly that case.
		for (const box of [
			new Box3d(),
			new Box3d(0, 0, 0, 0, 0, 0),
			new Box3d(0, 0, 0, 0, 10, 10),
			new Box3d(0, 0, 0, 10, 0, 10),
		]) {
			for (const normal of box._footprint.normals) {
				expect(Number.isFinite(normal.x)).toBe(true);
				expect(Number.isFinite(normal.y)).toBe(true);
			}
		}
	});

	it("keeps a zero DEPTH exact (only the XY footprint is floored)", () => {
		const box = new Box3d(0, 0, 0, 10, 10, 0);
		expect(box.halfExtents.z).toEqual(0);
		expect(box.depth).toEqual(0);
	});

	it("stores a negative extent as its magnitude", () => {
		const box = new Box3d(0, 0, 0, -10, -20, -30);
		expect(box.width).toEqual(10);
		expect(box.height).toEqual(20);
		expect(box.depth).toEqual(30);
	});

	it("clones into an independent box", () => {
		const box = new Box3d(1, 2, 3, 4, 5, 6);
		const copy = box.clone();
		copy.shift(100, 0, 0);
		expect(box.pos.x).toEqual(1);
		expect(copy.pos.x).toEqual(101);
	});

	it("contains() tests all three axes", () => {
		const box = new Box3d(0, 0, 0, 10, 10, 10);
		expect(box.contains(0, 0, 0)).toBe(true);
		expect(box.contains(4, 4, 4)).toBe(true);
		// inside in XY but outside in Z — the case a 2D shape cannot express
		expect(box.contains(0, 0, 20)).toBe(false);
	});
});

describe("Box3d — narrowphase", () => {
	let response;

	beforeEach(() => {
		response = new ResponseObject();
	});

	it("detects an overlap and reports a positive depth", () => {
		const a = makeRenderable(0, 0, 0);
		const b = makeRenderable(5, 0, 0);
		const boxA = new Box3d(0, 0, 0, 10, 10, 10);
		const boxB = new Box3d(0, 0, 0, 10, 10, 10);

		expect(testBox3dBox3d(a, boxA, b, boxB, response.clear())).toBe(true);
		expect(response.overlap).toBeCloseTo(5);
	});

	it("separates along Z alone — the contact a 2D shape cannot produce", () => {
		const a = makeRenderable(0, 0, 0);
		const b = makeRenderable(0, 0, 100);
		const boxA = new Box3d(0, 0, 0, 10, 10, 10);
		const boxB = new Box3d(0, 0, 0, 10, 10, 10);

		// identical in XY, so any 2D test would call this a collision
		expect(testBox3dBox3d(a, boxA, b, boxB, response.clear())).toBe(false);
	});

	it("resolves along Z when Z is the shallowest axis", () => {
		const a = makeRenderable(0, 0, 0);
		const b = makeRenderable(0, 0, 8);
		const boxA = new Box3d(0, 0, 0, 10, 10, 10);
		const boxB = new Box3d(0, 0, 0, 10, 10, 10);

		expect(testBox3dBox3d(a, boxA, b, boxB, response.clear())).toBe(true);
		expect(response.overlapNZ).toEqual(1);
		expect(response.overlapZ).toBeCloseTo(2);
		// the 2D half stays at zero, so a legacy 2D handler is inert, not wrong
		expect(response.overlapN.x).toEqual(0);
		expect(response.overlapN.y).toEqual(0);
		expect(response.overlapV.x).toEqual(0);
		expect(response.overlapV.y).toEqual(0);
	});

	it("leaves the Z half at zero when X or Y is the shallowest axis", () => {
		const a = makeRenderable(0, 0, 0);
		const b = makeRenderable(8, 0, 0);
		const boxA = new Box3d(0, 0, 0, 10, 10, 10);
		const boxB = new Box3d(0, 0, 0, 10, 10, 10);

		expect(testBox3dBox3d(a, boxA, b, boxB, response.clear())).toBe(true);
		expect(response.overlapN.x).toEqual(1);
		expect(response.overlapNZ).toEqual(0);
		expect(response.overlapZ).toEqual(0);
	});

	it("points the normal from a toward b on each axis", () => {
		const boxA = new Box3d(0, 0, 0, 10, 10, 10);
		const boxB = new Box3d(0, 0, 0, 10, 10, 10);

		// b to the -Z side of a
		const a = makeRenderable(0, 0, 0);
		const b = makeRenderable(0, 0, -8);
		expect(testBox3dBox3d(a, boxA, b, boxB, response.clear())).toBe(true);
		expect(response.overlapNZ).toEqual(-1);
		expect(response.overlapZ).toBeCloseTo(-2);
	});

	it("never emits a zero normal for perfectly concentric boxes", () => {
		const a = makeRenderable(0, 0, 0);
		const b = makeRenderable(0, 0, 0);
		const boxA = new Box3d(0, 0, 0, 10, 10, 10);
		const boxB = new Box3d(0, 0, 0, 10, 10, 10);

		expect(testBox3dBox3d(a, boxA, b, boxB, response.clear())).toBe(true);
		// a zero normal would make the push-out a no-op and leave the pair
		// overlapping forever
		const magnitude =
			Math.abs(response.overlapN.x) +
			Math.abs(response.overlapN.y) +
			Math.abs(response.overlapNZ);
		expect(magnitude).toEqual(1);
	});

	it("reports containment on all three axes", () => {
		const a = makeRenderable(0, 0, 0);
		const b = makeRenderable(0, 0, 0);
		const small = new Box3d(0, 0, 0, 2, 2, 2);
		const big = new Box3d(0, 0, 0, 20, 20, 20);

		expect(testBox3dBox3d(a, small, b, big, response.clear())).toBe(true);
		expect(response.aInB).toBe(true);
		expect(response.bInA).toBe(false);
	});

	it("does not report containment when only XY is enclosed", () => {
		const a = makeRenderable(0, 0, 0);
		const b = makeRenderable(0, 0, 0);
		// thin in XY but DEEPER than the other box in Z
		const tall = new Box3d(0, 0, 0, 2, 2, 100);
		const big = new Box3d(0, 0, 0, 20, 20, 20);

		expect(testBox3dBox3d(a, tall, b, big, response.clear())).toBe(true);
		expect(response.aInB).toBe(false);
	});

	it("honours the owning renderable's z position", () => {
		const boxA = new Box3d(0, 0, 0, 10, 10, 10);
		const boxB = new Box3d(0, 0, 0, 10, 10, 10);

		// same shape offsets, but the renderables are 100 apart in z
		expect(
			testBox3dBox3d(
				makeRenderable(0, 0, 0),
				boxA,
				makeRenderable(0, 0, 100),
				boxB,
				response.clear(),
			),
		).toBe(false);
	});

	it("honours the shape's own z offset", () => {
		const a = makeRenderable(0, 0, 0);
		const b = makeRenderable(0, 0, 0);
		const boxA = new Box3d(0, 0, 0, 10, 10, 10);
		const boxB = new Box3d(0, 0, 100, 10, 10, 10);

		expect(testBox3dBox3d(a, boxA, b, boxB, response.clear())).toBe(false);
	});

	describe("differential sweep vs brute force", () => {
		// The narrowphase contract here is EXACT, not conservative: unlike a
		// broadphase it may neither miss a genuine overlap nor invent one.
		// Both directions are aggregated so the report is a RATE — failing on
		// the first mismatch hides how bad it is.
		it("agrees with a brute-force AABB test over 4000 random pairs", () => {
			const rand = lcg(0x5eed1476);
			const PROBES = 4000;
			const misses = [];
			const falsePositives = [];

			for (let i = 0; i < PROBES; i++) {
				const a = makeRenderable(
					Math.round(rand() * 40 - 20),
					Math.round(rand() * 40 - 20),
					Math.round(rand() * 40 - 20),
				);
				const b = makeRenderable(
					Math.round(rand() * 40 - 20),
					Math.round(rand() * 40 - 20),
					Math.round(rand() * 40 - 20),
				);
				const boxA = new Box3d(
					Math.round(rand() * 10 - 5),
					Math.round(rand() * 10 - 5),
					Math.round(rand() * 10 - 5),
					1 + Math.round(rand() * 20),
					1 + Math.round(rand() * 20),
					1 + Math.round(rand() * 20),
				);
				const boxB = new Box3d(
					Math.round(rand() * 10 - 5),
					Math.round(rand() * 10 - 5),
					Math.round(rand() * 10 - 5),
					1 + Math.round(rand() * 20),
					1 + Math.round(rand() * 20),
					1 + Math.round(rand() * 20),
				);

				const expected = bruteOverlap(worldBox(a, boxA), worldBox(b, boxB));
				const actual = testBox3dBox3d(a, boxA, b, boxB, response.clear());

				if (expected && !actual) {
					misses.push(i);
				}
				if (!expected && actual) {
					falsePositives.push(i);
				}
			}

			expect(
				`${misses.length}/${PROBES} missed, ${falsePositives.length}/${PROBES} invented`,
			).toEqual(`0/${PROBES} missed, 0/${PROBES} invented`);
		});

		it("the reported MTV actually separates the pair, over 4000 random overlaps", () => {
			// A depth that detects the overlap but points the wrong way (or is
			// too short) still "passes" a boolean test — this is what catches it.
			const rand = lcg(0xb0bed);
			const PROBES = 4000;
			let tested = 0;
			const stillOverlapping = [];

			for (let i = 0; i < PROBES; i++) {
				const a = makeRenderable(
					Math.round(rand() * 20 - 10),
					Math.round(rand() * 20 - 10),
					Math.round(rand() * 20 - 10),
				);
				const b = makeRenderable(
					Math.round(rand() * 20 - 10),
					Math.round(rand() * 20 - 10),
					Math.round(rand() * 20 - 10),
				);
				const boxA = new Box3d(
					0,
					0,
					0,
					1 + Math.round(rand() * 20),
					1 + Math.round(rand() * 20),
					1 + Math.round(rand() * 20),
				);
				const boxB = new Box3d(
					0,
					0,
					0,
					1 + Math.round(rand() * 20),
					1 + Math.round(rand() * 20),
					1 + Math.round(rand() * 20),
				);

				if (!testBox3dBox3d(a, boxA, b, boxB, response.clear())) {
					continue;
				}
				tested++;

				// move `a` back along the reported MTV, exactly as
				// `respondToCollision` does, then re-test with a hair of
				// tolerance for float error
				const moved = makeRenderable(
					a.pos.x - response.overlapV.x,
					a.pos.y - response.overlapV.y,
					a.pos.z - response.overlapZ,
				);
				const boxAw = worldBox(moved, boxA);
				const boxBw = worldBox(b, boxB);
				const EPS = 1e-9;
				const shrunk = {
					minX: boxAw.minX + EPS,
					minY: boxAw.minY + EPS,
					minZ: boxAw.minZ + EPS,
					maxX: boxAw.maxX - EPS,
					maxY: boxAw.maxY - EPS,
					maxZ: boxAw.maxZ - EPS,
				};
				if (bruteOverlap(shrunk, boxBw)) {
					stillOverlapping.push(i);
				}
			}

			expect(tested).toBeGreaterThan(100);
			expect(
				`${stillOverlapping.length} of ${tested} still overlapping`,
			).toEqual(`0 of ${tested} still overlapping`);
		});
	});
});

describe("Box3d — mixing with 2D shapes", () => {
	/**
	 * Every shape-type pair the detector can be handed must resolve to a
	 * test function. `SAT_LOOKUP` is a string-concat lookup and a missing
	 * entry used to throw a TypeError mid-step, taking the whole world
	 * update with it — so "does this pair even dispatch" is worth pinning
	 * for all of them, not just the new ones.
	 */
	const shapeFactories = {
		Polygon: () => {
			return new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(16, 0),
				new Vector2d(16, 16),
				new Vector2d(0, 16),
			]);
		},
		Rectangle: () => {
			return new Rect(0, 0, 16, 16);
		},
		RoundRect: () => {
			return new RoundRect(0, 0, 16, 16, 4);
		},
		Ellipse: () => {
			return new Ellipse(8, 8, 16, 16);
		},
		Box3d: () => {
			return new Box3d(8, 8, 0, 16, 16, 16);
		},
	};

	it("dispatches every shape-type pair without throwing", () => {
		const detector = new Detector({
			broadphase: {
				retrieve: () => {
					return [];
				},
			},
		});
		const names = Object.keys(shapeFactories);
		const failures = [];

		for (const nameA of names) {
			for (const nameB of names) {
				const rA = makeRenderable(0, 0, 0);
				const rB = makeRenderable(4, 4, 0);
				const bodyA = new Body(rA, shapeFactories[nameA]());
				const bodyB = new Body(rB, shapeFactories[nameB]());
				try {
					detector.collides(bodyA, bodyB);
				} catch (e) {
					failures.push(`${nameA}/${nameB}: ${e.message}`);
				}
			}
		}

		expect(failures).toEqual([]);
	});

	it("treats a planar shape as unbounded along Z", () => {
		const detector = new Detector({
			broadphase: {
				retrieve: () => {
					return [];
				},
			},
		});
		// box far away in Z; the rect has no depth to miss it with
		const rA = makeRenderable(0, 0, 1000);
		const rB = makeRenderable(0, 0, 0);
		const bodyA = new Body(rA, new Box3d(8, 8, 0, 16, 16, 16));
		const bodyB = new Body(rB, new Rect(0, 0, 16, 16));

		expect(detector.collides(bodyA, bodyB)).toBe(true);
		// and it stays a 2D contact — no depth was resolved
		expect(detector.response.overlapZ).toEqual(0);
		expect(detector.response.overlapNZ).toEqual(0);
	});

	it("still separates two Box3d bodies by Z under the same detector", () => {
		const detector = new Detector({
			broadphase: {
				retrieve: () => {
					return [];
				},
			},
		});
		const rA = makeRenderable(0, 0, 1000);
		const rB = makeRenderable(0, 0, 0);
		const bodyA = new Body(rA, new Box3d(8, 8, 0, 16, 16, 16));
		const bodyB = new Body(rB, new Box3d(8, 8, 0, 16, 16, 16));

		expect(detector.collides(bodyA, bodyB)).toBe(false);
	});
});

describe("Box3d — Body integration", () => {
	it("raises hasDepth when a Box3d is added", () => {
		const r = makeRenderable(0, 0, 0);
		const body = new Body(r, new Rect(0, 0, 16, 16));
		expect(body.hasDepth).toBe(false);

		const box = new Box3d(0, 0, 0, 16, 16, 16);
		body.addShape(box);
		expect(body.hasDepth).toBe(true);
	});

	it("clears hasDepth when the last Box3d is removed", () => {
		const r = makeRenderable(0, 0, 0);
		const box = new Box3d(0, 0, 0, 16, 16, 16);
		const body = new Body(r, box);
		expect(body.hasDepth).toBe(true);

		body.removeShape(box);
		expect(body.hasDepth).toBe(false);
	});

	it("keeps hasDepth while another Box3d remains", () => {
		const r = makeRenderable(0, 0, 0);
		const boxA = new Box3d(0, 0, 0, 16, 16, 16);
		const boxB = new Box3d(32, 0, 0, 16, 16, 16);
		const body = new Body(r, [boxA, boxB]);

		body.removeShape(boxA);
		expect(body.hasDepth).toBe(true);
	});

	it("destroy() recycles a Box3d instead of throwing", () => {
		// `Body.destroy` releases each shape to its own pool and falls back to
		// the legacy `pool.push`, which THROWS for any class never registered
		// with it. A Box3d hitting that fallback aborts destroy() partway —
		// after `boundsPool.release(this.bounds)` has already run — leaving the
		// body holding a recycled Bounds that blows up in the broadphase on a
		// later frame, nowhere near the real cause.
		const r = makeRenderable(0, 0, 0);
		const body = new Body(r, new Box3d(0, 0, 0, 16, 16, 16));
		expect(() => {
			body.destroy();
		}).not.toThrow();
		// destroy ran to completion rather than aborting mid-way
		expect(body.bounds).toBeUndefined();
		expect(body.shapes.length).toEqual(0);
	});

	it("destroy() still recycles a mixed shape list", () => {
		const r = makeRenderable(0, 0, 0);
		const body = new Body(r, [
			new Box3d(0, 0, 0, 16, 16, 16),
			new Rect(0, 0, 16, 16),
		]);
		expect(() => {
			body.destroy();
		}).not.toThrow();
		expect(body.bounds).toBeUndefined();
	});

	it("folds a Box3d's XY footprint into the body bounds", () => {
		const r = makeRenderable(0, 0, 0);
		const body = new Body(r, new Box3d(0, 0, 0, 20, 10, 40));
		expect(body.getBounds().width).toEqual(20);
		expect(body.getBounds().height).toEqual(10);
	});

	it("integrates velZ into the ancestor position", () => {
		const r = makeRenderable(0, 0, 0);
		const body = new Body(r, new Box3d(0, 0, 0, 16, 16, 16));
		body.velZ = 3;
		body.update();
		expect(r.pos.z).toBeGreaterThan(0);
	});

	it("applies forceZ to velZ", () => {
		const r = makeRenderable(0, 0, 0);
		const body = new Body(r, new Box3d(0, 0, 0, 16, 16, 16));
		body.forceZ = 2;
		body.update();
		expect(body.velZ).toBeGreaterThan(0);
	});

	it("caps velZ at maxVelZ", () => {
		const r = makeRenderable(0, 0, 0);
		const body = new Body(r, new Box3d(0, 0, 0, 16, 16, 16));
		body.maxVelZ = 5;
		body.velZ = 1000;
		body.update();
		expect(body.velZ).toEqual(5);
	});

	it("pushes back along Z in respondToCollision", () => {
		const r = makeRenderable(0, 0, 0);
		const body = new Body(r, new Box3d(0, 0, 0, 16, 16, 16));
		body.isStatic = false;

		const response = new ResponseObject();
		response.a = r;
		response.b = makeRenderable(0, 0, 10);
		response.overlap = 4;
		response.overlapNZ = 1;
		response.overlapZ = 4;
		body.velZ = 10;

		body.respondToCollision(response);
		expect(r.pos.z).toEqual(-4);
		// velocity into the surface is cancelled
		expect(body.velZ).toEqual(0);
	});

	it("setMaxVelocity / setFriction leave the Z axis alone when omitted", () => {
		const r = makeRenderable(0, 0, 0);
		const body = new Body(r, new Box3d(0, 0, 0, 16, 16, 16));
		body.maxVelZ = 42;
		body.frictionZ = 7;

		// the two-argument form every existing game uses
		body.setMaxVelocity(1, 2);
		body.setFriction(3, 4);

		expect(body.maxVelZ).toEqual(42);
		expect(body.frictionZ).toEqual(7);
		expect(body.maxVel.x).toEqual(1);
		expect(body.friction.x).toEqual(3);
	});

	it("setMaxVelocity / setFriction write Z when given it", () => {
		const r = makeRenderable(0, 0, 0);
		const body = new Body(r, new Box3d(0, 0, 0, 16, 16, 16));
		body.setMaxVelocity(1, 2, 3);
		body.setFriction(4, 5, 6);
		expect(body.maxVelZ).toEqual(3);
		expect(body.frictionZ).toEqual(6);
	});
});

describe("Box3d — 2D backward compatibility", () => {
	// The headline guarantee of #1476: a game that never mentions Box3d
	// cannot tell that any of this landed.

	it("leaves the Z half of the response at zero for every planar pair", () => {
		const detector = new Detector({
			broadphase: {
				retrieve: () => {
					return [];
				},
			},
		});
		const pairs = [
			[new Rect(0, 0, 16, 16), new Rect(0, 0, 16, 16)],
			[new Ellipse(8, 8, 16, 16), new Ellipse(8, 8, 16, 16)],
			[new Rect(0, 0, 16, 16), new Ellipse(8, 8, 16, 16)],
			[new RoundRect(0, 0, 16, 16, 4), new Rect(0, 0, 16, 16)],
		];

		for (const [shapeA, shapeB] of pairs) {
			const bodyA = new Body(makeRenderable(0, 0, 0), shapeA);
			const bodyB = new Body(makeRenderable(4, 4, 0), shapeB);
			expect(detector.collides(bodyA, bodyB)).toBe(true);
			expect(detector.response.overlapZ).toEqual(0);
			expect(detector.response.overlapNZ).toEqual(0);
		}
	});

	it("a body with no Box3d never moves in Z under respondToCollision", () => {
		const r = makeRenderable(0, 0, 7);
		const body = new Body(r, new Rect(0, 0, 16, 16));
		body.isStatic = false;

		const response = new ResponseObject();
		response.a = r;
		response.b = makeRenderable(8, 0, 7);
		response.overlap = 4;
		response.overlapN.set(1, 0);
		response.overlapV.set(4, 0);

		body.respondToCollision(response);
		expect(r.pos.x).toEqual(-4);
		// z untouched — the field defaults keep the new arithmetic inert
		expect(r.pos.z).toEqual(7);
	});

	it("respondToCollision survives a response literal with no Z fields", () => {
		// `respondToCollision` is public and DUCK-TYPED — callers hand it a
		// plain object carrying only overlapV/overlapN. Reading the new Z
		// fields off one of those gives `undefined`, and a single
		// `vel * undefined` poisons projVel to NaN, which fails the
		// `projVel > 0` gate and silently stops cancelling velocity into the
		// surface. This is how it reaches real user code, so this is the
		// shape the regression test uses.
		const r = makeRenderable(0, 0, 5);
		const body = new Body(r, new Rect(0, 0, 32, 32));
		body.isStatic = false;
		body.vel.set(8, 0);

		body.respondToCollision({
			a: r,
			b: makeRenderable(16, 0, 5),
			overlapV: { x: 2, y: 0 },
			overlapN: { x: 1, y: 0 },
		});

		expect(Number.isNaN(body.vel.x)).toBe(false);
		expect(Number.isNaN(r.pos.z)).toBe(false);
		expect(r.pos.z).toEqual(5);
		// velocity into the surface was actually cancelled
		expect(body.vel.x).toBeCloseTo(0);
	});

	it("a 2D body's update() leaves z untouched", () => {
		const r = makeRenderable(0, 0, 12);
		const body = new Body(r, new Rect(0, 0, 16, 16));
		body.vel.set(3, 4);
		body.update();
		expect(r.pos.z).toEqual(12);
	});

	it("clear() resets the Z half so it cannot leak between tests", () => {
		const response = new ResponseObject();
		response.overlapZ = 99;
		response.overlapNZ = -1;
		response.clear();
		expect(response.overlapZ).toEqual(0);
		expect(response.overlapNZ).toEqual(0);
	});

	it("a planar contact after a Z contact reports no Z push", () => {
		// the leak the clear() above exists to prevent, end to end
		const detector = new Detector({
			broadphase: {
				retrieve: () => {
					return [];
				},
			},
		});

		const box3dA = new Body(
			makeRenderable(0, 0, 0),
			new Box3d(0, 0, 0, 16, 16, 16),
		);
		const box3dB = new Body(
			makeRenderable(0, 0, 8),
			new Box3d(0, 0, 0, 16, 16, 16),
		);
		expect(detector.collides(box3dA, box3dB)).toBe(true);
		expect(detector.response.overlapZ).not.toEqual(0);

		const flatA = new Body(makeRenderable(0, 0, 0), new Rect(0, 0, 16, 16));
		const flatB = new Body(makeRenderable(4, 0, 0), new Rect(0, 0, 16, 16));
		expect(detector.collides(flatA, flatB)).toBe(true);
		expect(detector.response.overlapZ).toEqual(0);
	});
});
