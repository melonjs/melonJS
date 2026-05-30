import { describe, expect, it } from "vitest";
import { spherePool } from "../src/geometries/sphere.ts";
import { Sphere, Vector3d } from "../src/index.js";
import { AABB3d } from "../src/physics/broadphase/aabb3d.ts";

describe("Sphere", () => {
	describe("constructor", () => {
		it("sets pos and radius from constructor args", () => {
			const s = new Sphere(1, 2, 3, 10);
			expect(s.pos.x).toEqual(1);
			expect(s.pos.y).toEqual(2);
			expect(s.pos.z).toEqual(3);
			expect(s.radius).toEqual(10);
		});

		it("does NOT allocate the bounds AABB lazily until first getBounds()", () => {
			// A sphere used only for inline `overlaps` shouldn't pay
			// for the AABB allocation.
			const s = new Sphere(0, 0, 0, 10);
			expect(s._bounds).toBeUndefined();
			s.getBounds();
			expect(s._bounds).toBeInstanceOf(AABB3d);
		});
	});

	describe("setShape", () => {
		it("updates pos and radius in place", () => {
			const s = new Sphere(0, 0, 0, 1);
			s.setShape(5, 6, 7, 20);
			expect(s.pos.x).toEqual(5);
			expect(s.pos.y).toEqual(6);
			expect(s.pos.z).toEqual(7);
			expect(s.radius).toEqual(20);
		});

		it("refreshes the cached bounds when setShape is called", () => {
			const s = new Sphere(0, 0, 0, 1);
			const b = s.getBounds(); // forces cache
			expect(b.min.x).toEqual(-1);
			s.setShape(100, 0, 0, 2);
			// SAME instance (cached) — but values must reflect the new shape.
			expect(s.getBounds()).toBe(b);
			expect(b.min.x).toEqual(98);
			expect(b.max.x).toEqual(102);
		});

		it("returns this for chaining", () => {
			const s = new Sphere(0, 0, 0, 1);
			expect(s.setShape(1, 2, 3, 4)).toBe(s);
		});
	});

	describe("contains", () => {
		it("origin inside a 0-centered sphere of any positive radius", () => {
			const s = new Sphere(0, 0, 0, 5);
			expect(s.contains(0, 0, 0)).toEqual(true);
		});

		it("point exactly on the surface counts as inside (boundary-inclusive)", () => {
			const s = new Sphere(0, 0, 0, 5);
			expect(s.contains(5, 0, 0)).toEqual(true);
			expect(s.contains(0, 5, 0)).toEqual(true);
			expect(s.contains(0, 0, 5)).toEqual(true);
			// 3-4-5 right triangle puts (3, 4, 0) exactly on the surface.
			expect(s.contains(3, 4, 0)).toEqual(true);
		});

		it("point one unit past the surface is OUT", () => {
			const s = new Sphere(0, 0, 0, 5);
			expect(s.contains(6, 0, 0)).toEqual(false);
			expect(s.contains(0, 0, 6)).toEqual(false);
		});

		it("Vector3d overload matches the numeric form", () => {
			const s = new Sphere(10, 20, 30, 5);
			const p = new Vector3d(12, 21, 32);
			expect(s.contains(p)).toEqual(s.contains(12, 21, 32));
		});

		it("zero-radius sphere contains ONLY its centre", () => {
			const s = new Sphere(7, 7, 7, 0);
			expect(s.contains(7, 7, 7)).toEqual(true);
			expect(s.contains(7.000001, 7, 7)).toEqual(false);
		});

		it("negative radius behaves like its absolute value (`r * r` cancels sign)", () => {
			// Defensive: callers shouldn't pass negative radii, but we
			// shouldn't silently mis-test if they do.
			const s = new Sphere(0, 0, 0, -5);
			expect(s.contains(3, 4, 0)).toEqual(true);
			expect(s.contains(6, 0, 0)).toEqual(false);
		});

		it("NaN coordinates propagate to false (NaN comparisons are always false)", () => {
			const s = new Sphere(0, 0, 0, 5);
			expect(s.contains(Number.NaN, 0, 0)).toEqual(false);
		});
	});

	describe("overlaps (sphere–sphere)", () => {
		it("two coincident spheres always overlap", () => {
			const a = new Sphere(5, 5, 5, 1);
			const b = new Sphere(5, 5, 5, 1);
			expect(a.overlaps(b)).toEqual(true);
		});

		it("self-overlap returns true", () => {
			const a = new Sphere(5, 5, 5, 1);
			expect(a.overlaps(a)).toEqual(true);
		});

		it("touching surfaces count as overlap (boundary-inclusive)", () => {
			// Centres at distance r1 + r2 — surfaces just kiss.
			const a = new Sphere(0, 0, 0, 5);
			const b = new Sphere(10, 0, 0, 5);
			expect(a.overlaps(b)).toEqual(true);
		});

		it("gap of one unit between surfaces — NO overlap", () => {
			const a = new Sphere(0, 0, 0, 5);
			const b = new Sphere(11, 0, 0, 5);
			expect(a.overlaps(b)).toEqual(false);
		});

		it("one sphere fully contained inside the other still overlaps", () => {
			const outer = new Sphere(0, 0, 0, 100);
			const inner = new Sphere(10, 0, 0, 5);
			expect(outer.overlaps(inner)).toEqual(true);
			expect(inner.overlaps(outer)).toEqual(true);
		});

		it("symmetric — a.overlaps(b) === b.overlaps(a)", () => {
			const a = new Sphere(1, 2, 3, 4);
			const b = new Sphere(-2, 3, -1, 6);
			expect(a.overlaps(b)).toEqual(b.overlaps(a));
		});

		it("Pythagorean 3-4-5 in 3D — touching at corner-of-corner distance", () => {
			// Centres at distance √(3² + 4² + 0²) = 5; radii 2 + 3 = 5.
			const a = new Sphere(0, 0, 0, 2);
			const b = new Sphere(3, 4, 0, 3);
			expect(a.overlaps(b)).toEqual(true);
			// Push them apart by one micro-unit on a single axis.
			b.pos.x = 3.001;
			expect(a.overlaps(b)).toEqual(false);
		});

		it("works across all three axes (axis symmetry)", () => {
			const a = new Sphere(0, 0, 0, 1);
			const along = (dx: number, dy: number, dz: number) =>
				a.overlaps(new Sphere(dx, dy, dz, 1));
			expect(along(2, 0, 0)).toEqual(true); // touching on +x
			expect(along(0, 2, 0)).toEqual(true); // touching on +y
			expect(along(0, 0, 2)).toEqual(true); // touching on +z
			expect(along(0, 0, -2)).toEqual(true); // touching on -z
			expect(along(2.001, 0, 0)).toEqual(false);
		});

		it("zero-radius spheres collide only when their centres coincide", () => {
			const a = new Sphere(5, 5, 5, 0);
			const b = new Sphere(5, 5, 5, 0);
			const c = new Sphere(5.0001, 5, 5, 0);
			expect(a.overlaps(b)).toEqual(true);
			expect(a.overlaps(c)).toEqual(false);
		});
	});

	describe("overlapsAABB", () => {
		// Cross-check against AABB3d.overlapsSphere — they MUST agree.

		it("sphere inside AABB overlaps", () => {
			const s = new Sphere(5, 5, 5, 1);
			const aabb = new AABB3d();
			aabb.setMinMax(0, 0, 0, 10, 10, 10);
			expect(s.overlapsAABB(aabb)).toEqual(true);
			expect(aabb.overlapsSphere(s.pos.x, s.pos.y, s.pos.z, s.radius)).toEqual(
				true,
			);
		});

		it("sphere far outside AABB does NOT overlap", () => {
			const s = new Sphere(100, 100, 100, 1);
			const aabb = new AABB3d();
			aabb.setMinMax(0, 0, 0, 10, 10, 10);
			expect(s.overlapsAABB(aabb)).toEqual(false);
			expect(aabb.overlapsSphere(s.pos.x, s.pos.y, s.pos.z, s.radius)).toEqual(
				false,
			);
		});

		it("sphere centred at corner of AABB overlaps (distance 0)", () => {
			const s = new Sphere(0, 0, 0, 0.001);
			const aabb = new AABB3d();
			aabb.setMinMax(0, 0, 0, 10, 10, 10);
			expect(s.overlapsAABB(aabb)).toEqual(true);
		});

		it("sphere centre outside, but radius reaches box face — overlaps", () => {
			// Sphere at (15, 5, 5) with r=6 reaches into a box ending at x=10.
			const s = new Sphere(15, 5, 5, 6);
			const aabb = new AABB3d();
			aabb.setMinMax(0, 0, 0, 10, 10, 10);
			expect(s.overlapsAABB(aabb)).toEqual(true);
		});

		it("sphere centre outside, radius JUST short — no overlap", () => {
			const s = new Sphere(15, 5, 5, 4.999);
			const aabb = new AABB3d();
			aabb.setMinMax(0, 0, 0, 10, 10, 10);
			expect(s.overlapsAABB(aabb)).toEqual(false);
		});
	});

	describe("getBounds", () => {
		it("returns an AABB exactly enclosing the sphere", () => {
			const s = new Sphere(10, 20, 30, 5);
			const b = s.getBounds();
			expect(b.min.x).toEqual(5);
			expect(b.min.y).toEqual(15);
			expect(b.min.z).toEqual(25);
			expect(b.max.x).toEqual(15);
			expect(b.max.y).toEqual(25);
			expect(b.max.z).toEqual(35);
		});

		it("negative radius produces a positively-sized AABB (uses |r|)", () => {
			const s = new Sphere(0, 0, 0, -5);
			const b = s.getBounds();
			expect(b.min.x).toEqual(-5);
			expect(b.max.x).toEqual(5);
		});

		it("repeat calls without setShape return the SAME instance", () => {
			const s = new Sphere(0, 0, 0, 1);
			expect(s.getBounds()).toBe(s.getBounds());
		});

		it("zero-radius sphere — AABB is a degenerate point at centre", () => {
			const s = new Sphere(7, 8, 9, 0);
			const b = s.getBounds();
			expect(b.min).toEqual({ x: 7, y: 8, z: 9 });
			expect(b.max).toEqual({ x: 7, y: 8, z: 9 });
		});
	});

	describe("clear", () => {
		it("zeros pos and radius", () => {
			const s = new Sphere(5, 6, 7, 8);
			s.clear();
			expect(s.pos.x).toEqual(0);
			expect(s.pos.y).toEqual(0);
			expect(s.pos.z).toEqual(0);
			expect(s.radius).toEqual(0);
		});

		it("refreshes the cached AABB to a zero-volume point at origin", () => {
			const s = new Sphere(10, 10, 10, 5);
			s.getBounds(); // populate cache
			s.clear();
			const b = s.getBounds();
			expect(b.min).toEqual({ x: 0, y: 0, z: 0 });
			expect(b.max).toEqual({ x: 0, y: 0, z: 0 });
		});
	});

	describe("clone (via spherePool)", () => {
		it("produces an independent instance — mutating the clone doesn't affect the original", () => {
			const a = new Sphere(1, 2, 3, 4);
			const b = a.clone();
			expect(b.pos.x).toEqual(1);
			expect(b.radius).toEqual(4);
			expect(b.pos).not.toBe(a.pos);
			b.setShape(99, 99, 99, 99);
			expect(a.pos.x).toEqual(1);
			expect(a.radius).toEqual(4);
		});

		it("repeated clones reuse pooled instances", () => {
			// `createPool` recycles. Pull, release, pull again — we
			// should see the same instance come back.
			const seen = new Set<Sphere>();
			for (let i = 0; i < 10; i++) {
				const s = spherePool.get(i, 0, 0, 1);
				seen.add(s);
				spherePool.release(s);
			}
			// All 10 acquires released back; pool should have at least
			// one instance to recycle, so the set size should be < 10.
			expect(seen.size).toBeLessThan(10);
		});
	});
});
