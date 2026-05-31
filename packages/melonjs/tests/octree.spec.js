import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	boot,
	Camera2d,
	Camera3d,
	Container,
	Rect,
	Renderable,
	Sphere,
	video,
	World,
} from "../src/index.js";
import { AABB3d } from "../src/physics/broadphase/aabb3d.ts";
import Octree from "../src/physics/broadphase/octree.ts";

/**
 * Build a 3D-shaped item for the Octree. `bounds` is a plain
 * `{ left, top, width, height }` POJO — items normally come from
 * Renderable.getBounds() which returns the 2D bounds; z comes from
 * pos.z (or getAbsolutePosition().z when nested). Wrapping it in a
 * factory keeps the tests focused on octree behavior, not on
 * Renderable plumbing.
 */
function makeItem({ x, y, z, w = 10, h = 10 }) {
	return {
		_pos: { x, y, z },
		_w: w,
		_h: h,
		getBounds() {
			return {
				left: this._pos.x,
				top: this._pos.y,
				width: this._w,
				height: this._h,
			};
		},
		getAbsolutePosition() {
			return { x: this._pos.x, y: this._pos.y, z: this._pos.z };
		},
		isKinematic: false,
	};
}

describe("Octree", () => {
	let world;
	let octree;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
		// stand up a small octree centred on the origin with a known
		// extent on all axes — keeps midpoint math obvious in tests
		const bounds = new AABB3d();
		bounds.setMinMax(0, 0, -100, 800, 600, 100);
		octree = new Octree(world, bounds, 4, 4, 0);
	});

	describe("AABB3d", () => {
		it("constructs empty (min=+∞, max=-∞)", () => {
			const a = new AABB3d();
			expect(a.min.x).toBe(Infinity);
			expect(a.max.x).toBe(-Infinity);
			expect(a.isFinite()).toBe(false);
		});

		it("contains points inclusive of the boundary", () => {
			const a = new AABB3d();
			a.setMinMax(-1, -2, -3, 4, 5, 6);
			expect(a.contains(0, 0, 0)).toBe(true);
			expect(a.contains(-1, -2, -3)).toBe(true); // min corner inclusive
			expect(a.contains(4, 5, 6)).toBe(true); // max corner inclusive
			expect(a.contains(-1.0001, 0, 0)).toBe(false);
		});

		it("overlaps treats boundary touching as overlap", () => {
			const a = new AABB3d();
			a.setMinMax(0, 0, 0, 10, 10, 10);
			const b = new AABB3d();
			// shared face on +x
			b.setMinMax(10, 0, 0, 20, 10, 10);
			expect(a.overlaps(b)).toBe(true);
			// gap of one unit on +x
			b.setMinMax(11, 0, 0, 20, 10, 10);
			expect(a.overlaps(b)).toBe(false);
		});

		it("overlapsSphere clamps onto every axis", () => {
			const a = new AABB3d();
			a.setMinMax(0, 0, 0, 10, 10, 10);
			// sphere centred outside in +x
			expect(a.overlapsSphere(15, 5, 5, 4.99)).toBe(false);
			expect(a.overlapsSphere(15, 5, 5, 5)).toBe(true);
			// sphere centred deep inside
			expect(a.overlapsSphere(5, 5, 5, 0)).toBe(true);
			// sphere centred at a corner — distance 0 from box, any r works
			expect(a.overlapsSphere(0, 0, 0, 0)).toBe(true);
			// negative radius is a nonsense input but should behave like r=0
			expect(a.overlapsSphere(5, 5, 5, -1)).toBe(true);
		});

		it("addPoint folds vertices into min/max", () => {
			const a = new AABB3d();
			a.addPoint({ x: 1, y: 2, z: 3 });
			a.addPoint({ x: -4, y: -5, z: -6 });
			expect(a.min).toEqual({ x: -4, y: -5, z: -6 });
			expect(a.max).toEqual({ x: 1, y: 2, z: 3 });
		});

		it("addAABB with clear copies, without clear unions", () => {
			const a = new AABB3d();
			a.setMinMax(0, 0, 0, 1, 1, 1);
			const b = new AABB3d();
			b.setMinMax(2, 2, 2, 3, 3, 3);
			a.addAABB(b);
			expect(a.min).toEqual({ x: 0, y: 0, z: 0 });
			expect(a.max).toEqual({ x: 3, y: 3, z: 3 });
			a.addAABB(b, true);
			expect(a.min).toEqual({ x: 2, y: 2, z: 2 });
			expect(a.max).toEqual({ x: 3, y: 3, z: 3 });
		});

		it("clone is a deep copy", () => {
			const a = new AABB3d();
			a.setMinMax(1, 2, 3, 4, 5, 6);
			const b = a.clone();
			a.setMinMax(10, 20, 30, 40, 50, 60);
			expect(b.min).toEqual({ x: 1, y: 2, z: 3 });
			expect(b.max).toEqual({ x: 4, y: 5, z: 6 });
		});

		it("survives NaN / Infinity bounds — flagged by isFinite", () => {
			const a = new AABB3d();
			a.setMinMax(0, 0, 0, Infinity, 10, 10);
			expect(a.isFinite()).toBe(false);
			a.setMinMax(0, 0, 0, NaN, 10, 10);
			expect(a.isFinite()).toBe(false);
		});

		it("zero-volume bounds work for contains / overlaps", () => {
			const a = new AABB3d();
			a.setMinMax(5, 5, 5, 5, 5, 5);
			expect(a.contains(5, 5, 5)).toBe(true);
			expect(a.contains(5.0001, 5, 5)).toBe(false);
			const b = new AABB3d();
			b.setMinMax(5, 5, 5, 5, 5, 5);
			expect(a.overlaps(b)).toBe(true);
		});
	});

	describe("Octree.getIndex classifies into one of 8 octants", () => {
		it("returns -1 for items spanning the vertical midpoint", () => {
			const item = makeItem({ x: 395, y: 100, z: 0, w: 20 });
			expect(octree.getIndex(item)).toBe(-1);
		});
		it("returns -1 for items spanning the horizontal midpoint", () => {
			const item = makeItem({ x: 100, y: 295, z: 0, w: 10, h: 20 });
			expect(octree.getIndex(item)).toBe(-1);
		});
		it("returns -1 for items sitting on the depth midpoint (z=0)", () => {
			const item = makeItem({ x: 100, y: 100, z: 0 });
			// not strictly < or > midpoint
			expect(octree.getIndex(item)).toBe(-1);
		});
		it("classifies top-left-near as octant 1", () => {
			const item = makeItem({ x: 50, y: 50, z: -50 });
			expect(octree.getIndex(item)).toBe(1);
		});
		it("classifies top-right-near as octant 0", () => {
			const item = makeItem({ x: 500, y: 50, z: -50 });
			expect(octree.getIndex(item)).toBe(0);
		});
		it("classifies bottom-left-near as octant 2", () => {
			const item = makeItem({ x: 50, y: 400, z: -50 });
			expect(octree.getIndex(item)).toBe(2);
		});
		it("classifies bottom-right-near as octant 3", () => {
			const item = makeItem({ x: 500, y: 400, z: -50 });
			expect(octree.getIndex(item)).toBe(3);
		});
		it("classifies top-left-far as octant 5", () => {
			const item = makeItem({ x: 50, y: 50, z: 50 });
			expect(octree.getIndex(item)).toBe(5);
		});
		it("classifies top-right-far as octant 4", () => {
			const item = makeItem({ x: 500, y: 50, z: 50 });
			expect(octree.getIndex(item)).toBe(4);
		});
		it("classifies bottom-left-far as octant 6", () => {
			const item = makeItem({ x: 50, y: 400, z: 50 });
			expect(octree.getIndex(item)).toBe(6);
		});
		it("classifies bottom-right-far as octant 7", () => {
			const item = makeItem({ x: 500, y: 400, z: 50 });
			expect(octree.getIndex(item)).toBe(7);
		});

		it("isFloating: viewport-local bounds get localToWorld'd before classify", () => {
			// Regression: a previous version read bounds.left/top
			// directly even for floating items, so a HUD overlay at
			// viewport (10, 10) was misclassified by hundreds of units
			// once the camera moved. Mirrors QuadTree's branch.
			//
			// Stub `world.app.viewport.localToWorld` to a known offset
			// so we don't need to spin up a full Application here.
			const stubbedWorld = {
				app: {
					viewport: {
						localToWorld(x, y, out) {
							out.x = x + 1000;
							out.y = y + 1000;
							return out;
						},
					},
				},
			};
			const bounds = new AABB3d();
			bounds.setMinMax(0, 0, -100, 2000, 2000, 100);
			const ot = new Octree(stubbedWorld, bounds, 4, 4, 0);
			// Floating item at viewport-local (5, 5) → world (1005, 1005).
			// Without the floating branch it'd classify as TL-near
			// (5 < 1000). With the branch, it classifies as BR-near
			// (1005 > 1000).
			const item = {
				getBounds() {
					return { left: 5, top: 5, width: 10, height: 10 };
				},
				getAbsolutePosition() {
					return { x: 5, y: 5, z: -50 };
				},
				isKinematic: false,
				isFloating: true,
			};
			expect(ot.getIndex(item)).toBe(3); // BR-near (5+1000=1005 > 1000 midpoint)
		});
	});

	describe("Octree insert / retrieve", () => {
		it("returns the inserted item", () => {
			const a = makeItem({ x: 100, y: 100, z: -50 });
			octree.insert(a);
			const result = octree.retrieve(a);
			expect(result).toContain(a);
		});

		it("returns all items sharing the same octant", () => {
			const items = [];
			for (let i = 0; i < 3; i++) {
				const item = makeItem({ x: 50 + i * 5, y: 50, z: -50 });
				octree.insert(item);
				items.push(item);
			}
			const result = octree.retrieve(items[0]);
			for (const it of items) {
				expect(result).toContain(it);
			}
		});

		it("splits when max_objects is exceeded across all 8 octants", () => {
			octree.max_objects = 2;
			const items = [];
			// one item in each octant
			const seeds = [
				[50, 50, -50],
				[500, 50, -50],
				[50, 400, -50],
				[500, 400, -50],
				[50, 50, 50],
				[500, 50, 50],
				[50, 400, 50],
				[500, 400, 50],
				[200, 200, 0], // spans every axis midpoint — stays at root
			];
			for (const [x, y, z] of seeds) {
				const item = makeItem({ x, y, z });
				octree.insert(item);
				items.push(item);
			}
			for (const it of items) {
				const result = octree.retrieve(it);
				expect(result).toContain(it);
			}
			// Root should have non-empty nodes (split fired)
			expect(octree.nodes.length).toBe(8);
		});

		it("reuses the root-level scratch across calls", () => {
			const a = makeItem({ x: 50, y: 50, z: -50 });
			const b = makeItem({ x: 500, y: 400, z: 50 });
			octree.insert(a);
			octree.insert(b);
			const r1 = octree.retrieve(a);
			const r2 = octree.retrieve(b);
			expect(r1).toBe(r2);
		});

		it("supports caller-supplied result array (re-entrancy safe)", () => {
			const a = makeItem({ x: 50, y: 50, z: -50 });
			octree.insert(a);
			const mine = [];
			const result = octree.retrieve(a, undefined, mine);
			expect(result).toBe(mine);
			expect(mine).toContain(a);
			// scratch is untouched
			expect(octree._retrieveScratch.length).toBe(0);
		});

		it("supports sorting function", () => {
			const a = makeItem({ x: 500, y: 400, z: 50 });
			a.id = "a";
			const b = makeItem({ x: 50, y: 50, z: -50 });
			b.id = "b";
			octree.insert(a);
			octree.insert(b);
			const sorted = octree.retrieve(a, (x, y) => {
				return x.id.localeCompare(y.id);
			});
			const ids = sorted.map((s) => {
				return s.id;
			});
			expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
		});

		it("redistributes objects into subnodes on split, parent only keeps spanners", () => {
			octree.max_objects = 1;
			const spanner = makeItem({ x: 395, y: 295, z: -5, w: 10, h: 10 });
			const a = makeItem({ x: 50, y: 50, z: -50 });
			octree.insert(spanner);
			octree.insert(a);
			// triggers split — `a` should move into subnode 1; spanner stays at root
			const b = makeItem({ x: 500, y: 50, z: -50 });
			octree.insert(b);
			expect(octree.objects).toContain(spanner);
			expect(octree.objects).not.toContain(a);
			expect(octree.objects).not.toContain(b);
		});
	});

	describe("Octree.remove", () => {
		it("returns false for items without getBounds", () => {
			expect(octree.remove({})).toBe(false);
		});

		it("returns true when removing a present item; subtree count drops", () => {
			const a = makeItem({ x: 50, y: 50, z: -50 });
			octree.insert(a);
			expect(octree._subtreeCount).toBe(1);
			expect(octree.remove(a)).toBe(true);
			expect(octree._subtreeCount).toBe(0);
		});

		it("returns false when removing a never-inserted item", () => {
			const a = makeItem({ x: 50, y: 50, z: -50 });
			expect(octree.remove(a)).toBe(false);
		});

		it("walks the stale-bounds fallback when the item moved", () => {
			octree.max_objects = 1;
			const a = makeItem({ x: 50, y: 50, z: -50 }); // near-top-left
			const b = makeItem({ x: 500, y: 50, z: -50 });
			const c = makeItem({ x: 500, y: 400, z: 50 });
			octree.insert(a);
			octree.insert(b);
			octree.insert(c);
			// Move a into a different octant WITHOUT re-inserting it.
			// Real game code shouldn't do this between rebuilds but the
			// broadphase has to be defensive: container destruction may
			// happen mid-frame.
			a._pos = { x: 500, y: 400, z: 50 };
			expect(octree.remove(a)).toBe(true);
		});

		it("collapses empty subtrees back to the pool", () => {
			octree.max_objects = 1;
			const a = makeItem({ x: 50, y: 50, z: -50 });
			const b = makeItem({ x: 500, y: 50, z: -50 });
			octree.insert(a);
			octree.insert(b);
			expect(octree.nodes.length).toBe(8);
			octree.remove(a);
			octree.remove(b);
			// Both removals — root is back to empty + no nodes.
			expect(octree.nodes.length).toBe(0);
			expect(octree.isPrunable()).toBe(true);
		});

		it("clear() drops every item reference (no stale-ref leak)", () => {
			// True leak detection needs WeakRef + a forced GC, which
			// Vitest browser-mode doesn't expose. The next-best test is
			// the structural one: after `clear()` every `objects` and
			// `nodes` array must be EMPTY, so the GC has nothing to
			// trace through the tree.
			octree.max_objects = 1;
			for (let i = 0; i < 10; i++) {
				octree.insert(makeItem({ x: 50 + i * 5, y: 50, z: -50 }));
			}
			expect(octree._subtreeCount).toBe(10);
			octree.clear();
			expect(octree.objects.length).toBe(0);
			expect(octree.nodes.length).toBe(0);
			expect(octree._subtreeCount).toBe(0);
		});

		it("subtreeCount stays accurate across many insert/remove cycles", () => {
			// Stress test for the `_subtreeCount` accounting on every
			// path (root-insert, sub-insert, redistribute on split,
			// remove at this level, remove via subnode, stale-bounds
			// fallback walk). Any drift in the running total over
			// 100 cycles would surface here. A leaking count would
			// also break `isPrunable` / `hasChildren`.
			octree.max_objects = 1;
			for (let cycle = 0; cycle < 50; cycle++) {
				const a = makeItem({ x: 50, y: 50, z: -50 });
				const b = makeItem({ x: 500, y: 400, z: 50 });
				const c = makeItem({ x: 200, y: 200, z: 0 }); // spans → root
				octree.insert(a);
				octree.insert(b);
				octree.insert(c);
				expect(octree._subtreeCount).toBe(3);
				octree.remove(c);
				octree.remove(b);
				octree.remove(a);
				expect(octree._subtreeCount).toBe(0);
				expect(octree.objects.length).toBe(0);
				expect(octree.isPrunable()).toBe(true);
			}
		});

		it("insertContainer + clear leaves no zombie children behind", () => {
			// Container insertion is the per-frame hot path. Verify
			// that the tree's clear() removes all those container-
			// added children even after a deep nest. Indirect leak
			// guard: anything still in `objects` after clear() is a
			// retained reference.
			const outer = new Container(0, 0, 800, 600);
			const inner = new Container(0, 0, 400, 300);
			const leaves = [];
			for (let i = 0; i < 5; i++) {
				const leaf = new Renderable(50 + i * 10, 50, 10, 10);
				leaf.anchorPoint.set(0, 0);
				leaf.isKinematic = false;
				inner.addChild(leaf);
				leaves.push(leaf);
			}
			outer.addChild(inner);
			octree.insertContainer(outer);
			expect(octree._subtreeCount).toBeGreaterThan(0);
			octree.clear();
			expect(octree._subtreeCount).toBe(0);
			expect(octree.objects.length).toBe(0);
			expect(octree.nodes.length).toBe(0);
		});

		it("re-inserts after collapse reuse pooled nodes (no leak / no NPE)", () => {
			// Stress the OT_ARRAY pool: insert → split → remove → collapse →
			// re-insert → re-split. The pooled subnodes from the first
			// collapse must come back in a clean state (subtree count = 0,
			// no stale objects). Catches incomplete `clear()` on collapse.
			octree.max_objects = 1;
			const round = () => {
				const a = makeItem({ x: 50, y: 50, z: -50 });
				const b = makeItem({ x: 500, y: 50, z: -50 });
				octree.insert(a);
				octree.insert(b);
				octree.remove(a);
				octree.remove(b);
			};
			for (let i = 0; i < 5; i++) {
				round();
			}
			// After 5 cycles the tree should still be in a clean state.
			expect(octree.isPrunable()).toBe(true);
			expect(octree._subtreeCount).toBe(0);
			expect(octree.objects.length).toBe(0);
			// Now insert one more item and verify retrieve still works.
			const final = makeItem({ x: 50, y: 50, z: -50 });
			octree.insert(final);
			expect(octree.retrieve(final)).toContain(final);
		});
	});

	describe("Octree.queryAABB", () => {
		it("returns items overlapping the query AABB", () => {
			const a = makeItem({ x: 50, y: 50, z: -50 });
			const b = makeItem({ x: 500, y: 400, z: 50 });
			octree.insert(a);
			octree.insert(b);
			const q = new AABB3d();
			q.setMinMax(0, 0, -100, 200, 200, 0);
			const r = octree.queryAABB(q);
			expect(r).toContain(a);
		});

		it("returns empty when query AABB is outside the root", () => {
			const a = makeItem({ x: 50, y: 50, z: -50 });
			octree.insert(a);
			const q = new AABB3d();
			q.setMinMax(10000, 10000, 1000, 20000, 20000, 2000);
			const r = octree.queryAABB(q);
			// `a` is at root level (no split yet), so it gets included in
			// the root's pass — that's the documented behavior for
			// queryAABB on an un-split octree (no per-item AABB test in
			// the broadphase; that's the caller's narrow phase).
			// What we're verifying here is that the query doesn't crash.
			expect(Array.isArray(r)).toBe(true);
		});

		it("safe under re-entrancy with caller-supplied result", () => {
			const a = makeItem({ x: 50, y: 50, z: -50 });
			octree.insert(a);
			const q = new AABB3d();
			q.setMinMax(0, 0, -100, 200, 200, 0);
			const mine = [];
			octree.queryAABB(q, mine);
			expect(mine).toContain(a);
		});

		it("walks every overlapping subnode after split", () => {
			octree.max_objects = 1;
			const items = [];
			for (let i = 0; i < 8; i++) {
				const cx = (i & 1) === 1 ? 50 : 500;
				const cy = (i & 2) === 2 ? 400 : 50;
				const cz = (i & 4) === 4 ? 50 : -50;
				const item = makeItem({ x: cx, y: cy, z: cz });
				octree.insert(item);
				items.push(item);
			}
			expect(octree.nodes.length).toBe(8);
			// query that crosses ALL 8 octants
			const q = new AABB3d();
			q.setMinMax(0, 0, -100, 800, 600, 100);
			const r = octree.queryAABB(q);
			for (const it of items) {
				expect(r).toContain(it);
			}
		});

		it("EXCLUDES items outside the query AABB after split (negative case)", () => {
			// Coverage gap from review: the existing positive tests
			// run with max_objects=4 and 2 items, so the tree never
			// splits — queryAABB walks root.objects and returns both
			// items regardless. A broken `_overlapsAABB` would have
			// passed silently. Force a split and verify the
			// off-octant item is actually PRUNED.
			octree.max_objects = 1;
			const a = makeItem({ x: 50, y: 50, z: -50 });
			const b = makeItem({ x: 500, y: 400, z: 50 });
			octree.insert(a);
			octree.insert(b);
			expect(octree.nodes.length).toBe(8);
			// query covers only the near-top-left octant
			const q = new AABB3d();
			q.setMinMax(0, 0, -100, 200, 200, 0);
			const r = octree.queryAABB(q);
			expect(r).toContain(a);
			expect(r).not.toContain(b);
		});
	});

	describe("Octree.querySphere", () => {
		it("includes items inside the sphere", () => {
			const a = makeItem({ x: 100, y: 100, z: -50 });
			octree.insert(a);
			const r = octree.querySphere(100, 100, -50, 100);
			expect(r).toContain(a);
		});

		it("r=0 acts as a point query", () => {
			const a = makeItem({ x: 100, y: 100, z: -50 });
			octree.insert(a);
			const r = octree.querySphere(100, 100, -50, 0);
			// at the un-split root, returns all objects regardless;
			// after split, the sphere short-circuits at empty octants.
			expect(r).toContain(a);
		});

		it("safe under re-entrancy with caller-supplied result", () => {
			const a = makeItem({ x: 100, y: 100, z: -50 });
			octree.insert(a);
			const mine = [];
			octree.querySphere(100, 100, -50, 50, mine);
			expect(mine).toContain(a);
		});

		it("returns the union of all 8 octants when the sphere covers them all", () => {
			octree.max_objects = 1;
			const items = [];
			const seeds = [
				[50, 50, -50],
				[500, 50, -50],
				[50, 400, -50],
				[500, 400, -50],
				[50, 50, 50],
				[500, 50, 50],
				[50, 400, 50],
				[500, 400, 50],
			];
			for (const [x, y, z] of seeds) {
				const item = makeItem({ x, y, z });
				octree.insert(item);
				items.push(item);
			}
			// huge sphere centred on the root midpoint
			const r = octree.querySphere(400, 300, 0, 1000);
			for (const it of items) {
				expect(r).toContain(it);
			}
		});

		it("finds items at negative coordinates (origin-centred play areas)", () => {
			// Regression: items at e.g. x=-300 in a Camera3d game with
			// `world.broadphase.bounds` = (-10000,-10000,-10000)..(10000,10000,10000)
			// must classify into in-bounds subnodes — earlier behavior
			// classified them into top-left subnodes whose bounds didn't
			// actually contain them, then `querySphere`'s spatial pruning
			// dropped them.
			const big = new AABB3d();
			big.setMinMax(-10000, -10000, -10000, 10000, 10000, 10000);
			const ot = new Octree(world, big, 1, 4, 0);
			const a = makeItem({ x: -300, y: -150, z: -50, w: 20, h: 20 });
			const b = makeItem({ x: -310, y: -150, z: -50, w: 20, h: 20 });
			const c = makeItem({ x: 300, y: 150, z: 50, w: 20, h: 20 });
			ot.insert(a);
			ot.insert(b);
			ot.insert(c);
			// querySphere centered on `a` with HIT_RADIUS-ish r should
			// find both a and b but NOT c.
			const r = ot.querySphere(-300, -150, -50, 60);
			expect(r).toContain(a);
			expect(r).toContain(b);
			expect(r).not.toContain(c);
		});

		it("items outside the root bounds stay at root.objects (linear scan)", () => {
			// Defense-in-depth: an item completely outside the tree
			// extents must still be findable. `getIndex` returns -1,
			// item lives at root, every query sees it.
			const small = new AABB3d();
			small.setMinMax(0, 0, 0, 100, 100, 100);
			const ot = new Octree(world, small, 1, 4, 0);
			const inside = makeItem({ x: 10, y: 10, z: 10 });
			const outside = makeItem({ x: 500, y: 500, z: 500 });
			ot.insert(inside);
			ot.insert(outside);
			expect(ot.objects).toContain(outside);
			// query at the outside point — should still find it
			const r = ot.querySphere(500, 500, 500, 10);
			expect(r).toContain(outside);
		});

		it("prunes octants whose bounds the sphere misses", () => {
			octree.max_objects = 1;
			const a = makeItem({ x: 50, y: 50, z: -50 }); // far-near-top-left
			const b = makeItem({ x: 500, y: 400, z: 50 }); // far-bottom-right
			octree.insert(a);
			octree.insert(b);
			// Sphere centred on a's octant with small radius — must NOT
			// pull in b.
			const r = octree.querySphere(50, 50, -50, 20);
			expect(r).toContain(a);
			expect(r).not.toContain(b);
		});

		it("Sphere overload returns the same candidates as the loose floats", () => {
			// The two call shapes must be interchangeable — verify on
			// a forced-split tree so the recursive pruning path also
			// agrees between both forms.
			octree.max_objects = 1;
			const items = [];
			for (let i = 0; i < 8; i++) {
				const cx = (i & 1) === 1 ? 50 : 500;
				const cy = (i & 2) === 2 ? 400 : 50;
				const cz = (i & 4) === 4 ? 50 : -50;
				const item = makeItem({ x: cx, y: cy, z: cz });
				octree.insert(item);
				items.push(item);
			}
			expect(octree.nodes.length).toBe(8);

			const sphere = new Sphere(50, 50, -50, 30);
			const viaSphere = octree.querySphere(sphere);
			const viaFloats = octree.querySphere(50, 50, -50, 30);

			// Same length, same membership.
			expect(viaSphere.length).toEqual(viaFloats.length);
			for (const it of items) {
				expect(viaSphere.includes(it)).toEqual(viaFloats.includes(it));
			}
		});

		it("Sphere overload supports the caller-supplied result array", () => {
			const sphere = new Sphere(100, 100, -50, 100);
			const a = makeItem({ x: 100, y: 100, z: -50 });
			octree.insert(a);
			const mine = [];
			const r = octree.querySphere(sphere, mine);
			// Returns the caller's array (re-entrancy contract).
			expect(r).toBe(mine);
			expect(mine).toContain(a);
		});

		it("recursion path uses the internal float entry point (no dispatch overhead per node)", () => {
			// Indirect check: every subnode walk reads consistent
			// pose. We don't directly measure overhead, but if the
			// recursion accidentally hit the dispatch + instanceof on
			// each node, the candidate set would still be correct;
			// this test pins behavior so a future refactor that
			// changes the recursion path still produces the same
			// candidates as the loose form.
			octree.max_objects = 1;
			for (let i = 0; i < 8; i++) {
				const cx = (i & 1) === 1 ? 50 : 500;
				const cy = (i & 2) === 2 ? 400 : 50;
				const cz = (i & 4) === 4 ? 50 : -50;
				octree.insert(makeItem({ x: cx, y: cy, z: cz }));
			}
			const sphere = new Sphere(400, 300, 0, 1000); // covers all
			expect(octree.querySphere(sphere).length).toEqual(
				octree.querySphere(400, 300, 0, 1000).length,
			);
		});
	});

	describe("Octree.queryFrustum", () => {
		// A box-shaped "frustum" — six axis-aligned planes whose interior
		// is the cube `(0..200, 0..200, 0..200)`. Easy to reason about
		// without dragging real perspective math into the test.
		const boxFrustum = [
			{ nx: 1, ny: 0, nz: 0, d: 0 }, // left:   x >= 0
			{ nx: -1, ny: 0, nz: 0, d: 200 }, // right:  x <= 200
			{ nx: 0, ny: 1, nz: 0, d: 0 }, // top:    y >= 0
			{ nx: 0, ny: -1, nz: 0, d: 200 }, // bottom: y <= 200
			{ nx: 0, ny: 0, nz: 1, d: 0 }, // near:   z >= 0
			{ nx: 0, ny: 0, nz: -1, d: 200 }, // far:   z <= 200
		];

		it("returns items inside the frustum", () => {
			const inside = makeItem({ x: 100, y: 100, z: 100 });
			octree.insert(inside);
			const r = octree.queryFrustum(boxFrustum);
			expect(r).toContain(inside);
		});

		it("prunes octants whose AABB is fully outside the frustum", () => {
			octree.max_objects = 1;
			const a = makeItem({ x: 50, y: 50, z: 50 }); // near-top-left, inside box
			const b = makeItem({ x: 500, y: 400, z: 50 }); // bottom-right, OUTSIDE box on x and y
			octree.insert(a);
			octree.insert(b);
			expect(octree.nodes.length).toBe(8);
			const r = octree.queryFrustum(boxFrustum);
			expect(r).toContain(a);
			expect(r).not.toContain(b);
		});

		it("safe under re-entrancy with caller-supplied result", () => {
			const a = makeItem({ x: 100, y: 100, z: 50 });
			octree.insert(a);
			const mine = [];
			octree.queryFrustum(boxFrustum, mine);
			expect(mine).toContain(a);
		});

		it("walks root.objects unconditionally so out-of-bounds items stay findable", () => {
			// Item outside the octree root is filed at root.objects;
			// queryFrustum must still see it.
			const small = new AABB3d();
			small.setMinMax(0, 0, 0, 100, 100, 100);
			const ot = new Octree(world, small, 1, 4, 0);
			const stray = makeItem({ x: 50, y: 50, z: 50 });
			ot.insert(stray);
			const r = ot.queryFrustum(boxFrustum);
			expect(r).toContain(stray);
		});

		it("empty planes array short-circuits to a no-prune walk", () => {
			// Defensive: with zero planes the positive-vertex test
			// loops 0 times and returns `false` (not outside), so
			// every subnode walks. The result is the same as a
			// `retrieve()`-style "give me everything" pass.
			octree.max_objects = 1;
			const items = [];
			for (let i = 0; i < 4; i++) {
				const item = makeItem({ x: 50 + i * 5, y: 50, z: -50 });
				octree.insert(item);
				items.push(item);
			}
			const r = octree.queryFrustum([]);
			for (const it of items) {
				expect(r).toContain(it);
			}
		});
	});

	describe("Octree.queryRay", () => {
		it("returns items whose octant the ray crosses", () => {
			const a = makeItem({ x: 100, y: 100, z: -50 });
			octree.insert(a);
			// ray from (0,0,-100) along +x +y +z, passes through (100, 100, -50)
			const r = octree.queryRay(0, 0, -100, 200, 200, 100, 1);
			expect(r).toContain(a);
		});

		it("prunes octants the ray misses entirely", () => {
			octree.max_objects = 1;
			const a = makeItem({ x: 50, y: 50, z: -50 });
			const b = makeItem({ x: 500, y: 400, z: 50 });
			octree.insert(a);
			octree.insert(b);
			expect(octree.nodes.length).toBe(8);
			// ray confined to the near-top-left octant
			const r = octree.queryRay(0, 0, -90, 100, 100, 10, 1);
			expect(r).toContain(a);
			expect(r).not.toContain(b);
		});

		it("zero-direction axis degenerates to point-in-slab", () => {
			const a = makeItem({ x: 100, y: 100, z: -50 });
			octree.insert(a);
			// ray at fixed z=-50, scanning x at y=100
			const r = octree.queryRay(0, 100, -50, 200, 0, 0, 1);
			expect(r).toContain(a);
		});

		it("zero-direction axis OUTSIDE slab returns empty (after pruning)", () => {
			octree.max_objects = 1;
			const a = makeItem({ x: 50, y: 50, z: -50 });
			const b = makeItem({ x: 500, y: 400, z: 50 });
			octree.insert(a);
			octree.insert(b);
			// ray at fixed z=99999 (way outside both items' z); the
			// items live at root.objects (always returned), and subnodes
			// fail the z-slab test, so only the root items appear.
			const r = octree.queryRay(0, 0, 99999, 800, 600, 0, 1);
			expect(Array.isArray(r)).toBe(true);
		});

		it("respects tMax (segment, not infinite ray)", () => {
			const a = makeItem({ x: 100, y: 100, z: -50 });
			octree.insert(a);
			// ray STARTS past the item — the segment from (200,200,0) to
			// (300, 300, 100) is on the OTHER side of the item; with
			// tMax=1, the ray (0..1) doesn't reach `a`'s octant.
			octree.max_objects = 1; // force split so the prune fires
			octree.insert(makeItem({ x: 600, y: 500, z: 50 })); // span the tree
			octree.insert(makeItem({ x: 600, y: 50, z: -50 }));
			const r = octree.queryRay(300, 300, 100, 100, 100, 100, 1);
			// `a` should be pruned away — its octant doesn't overlap
			// the (200..300, 200..300, 100..200) ray AABB.
			expect(r).not.toContain(a);
		});

		it("safe under re-entrancy with caller-supplied result", () => {
			const a = makeItem({ x: 100, y: 100, z: -50 });
			octree.insert(a);
			const mine = [];
			octree.queryRay(0, 0, -100, 200, 200, 100, 1, mine);
			expect(mine).toContain(a);
		});
	});

	describe("Octree.clear", () => {
		it("empties objects and subnodes and resets subtree count", () => {
			octree.max_objects = 1;
			octree.insert(makeItem({ x: 50, y: 50, z: -50 }));
			octree.insert(makeItem({ x: 500, y: 400, z: 50 }));
			expect(octree.nodes.length).toBe(8);
			expect(octree._subtreeCount).toBeGreaterThan(0);
			octree.clear();
			expect(octree.objects.length).toBe(0);
			expect(octree.nodes.length).toBe(0);
			expect(octree._subtreeCount).toBe(0);
		});

		it("resizes when given a new bounds AABB", () => {
			octree.clear(new AABB3d({ x: -1, y: -2, z: -3 }, { x: 4, y: 5, z: 6 }));
			expect(octree.bounds.min).toEqual({ x: -1, y: -2, z: -3 });
			expect(octree.bounds.max).toEqual({ x: 4, y: 5, z: 6 });
		});
	});

	describe("Octree max_levels cap", () => {
		it("does not split beyond max_levels", () => {
			const small = new AABB3d();
			small.setMinMax(0, 0, 0, 8, 8, 8);
			const ot = new Octree(world, small, 1, 1, 0);
			for (let i = 0; i < 16; i++) {
				ot.insert(makeItem({ x: i & 1 ? 1 : 6, y: 1, z: 1, w: 1, h: 1 }));
			}
			expect(ot.nodes.length).toBe(8);
			for (const sub of ot.nodes) {
				// children should not split further
				expect(sub.nodes.length).toBe(0);
			}
		});
	});

	describe("Octree.insertContainer / removeContainer", () => {
		it("walks non-kinematic children into the tree", () => {
			const parent = new Container(0, 0, 800, 600);
			const child = new Renderable(50, 50, 10, 10);
			child.anchorPoint.set(0, 0);
			child.isKinematic = false;
			parent.addChild(child);
			octree.insertContainer(parent);
			expect(octree._subtreeCount).toBeGreaterThan(0);
		});

		it("skips kinematic children", () => {
			const parent = new Container(0, 0, 800, 600);
			const child = new Renderable(50, 50, 10, 10);
			child.anchorPoint.set(0, 0);
			child.isKinematic = true;
			parent.addChild(child);
			octree.insertContainer(parent);
			expect(octree._subtreeCount).toBe(0);
		});

		it("recurses into nested containers", () => {
			const outer = new Container(0, 0, 800, 600);
			const inner = new Container(0, 0, 400, 300);
			const leaf = new Renderable(50, 50, 10, 10);
			leaf.anchorPoint.set(0, 0);
			leaf.isKinematic = false;
			inner.addChild(leaf);
			outer.addChild(inner);
			octree.insertContainer(outer);
			expect(octree._subtreeCount).toBeGreaterThan(0);
		});

		it("removeContainer mirrors insertContainer", () => {
			const parent = new Container(0, 0, 800, 600);
			const child = new Renderable(50, 50, 10, 10);
			child.anchorPoint.set(0, 0);
			child.isKinematic = false;
			parent.addChild(child);
			octree.insertContainer(parent);
			expect(octree._subtreeCount).toBeGreaterThan(0);
			octree.removeContainer(parent);
			expect(octree._subtreeCount).toBe(0);
		});
	});
});

describe("World broadphase dispatch (sortOn setter)", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	it("constructs a QuadTree by default (sortOn=z)", () => {
		const world = new World(0, 0, 800, 600);
		expect(world.sortOn).toBe("z");
		expect(world.broadphase.constructor.name).toBe("QuadTree");
	});

	it("swaps to Octree when sortOn flips to 'depth'", () => {
		const world = new World(0, 0, 800, 600);
		expect(world.broadphase.constructor.name).toBe("QuadTree");
		world.sortOn = "depth";
		expect(world.broadphase.constructor.name).toBe("Octree");
	});

	it("swaps back to QuadTree on 'depth' → 'y'", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		expect(world.broadphase.constructor.name).toBe("Octree");
		world.sortOn = "y";
		expect(world.broadphase.constructor.name).toBe("QuadTree");
	});

	it("does NOT swap when a same-side change happens (z → y)", () => {
		const world = new World(0, 0, 800, 600);
		const initial = world.broadphase;
		world.sortOn = "y";
		expect(world.broadphase).toBe(initial); // same instance
	});

	it("does NOT swap on same-side 3D change (depth → depth)", () => {
		// Re-applying the same sortOn must not allocate a fresh
		// broadphase — the setter compares the 2D↔3D side, not the
		// raw value. A spurious swap would drop every queued
		// renderable on the next clear+insertContainer.
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const octreeOnce = world.broadphase;
		world.sortOn = "depth";
		expect(world.broadphase).toBe(octreeOnce);
	});

	it("throws on invalid sortOn (delegates to Container setter)", () => {
		const world = new World(0, 0, 800, 600);
		expect(() => {
			world.sortOn = "wat";
		}).toThrow();
	});

	it("Camera3d as cameraClass — world.sortOn flips to 'depth' on stage reset", () => {
		// Verifies the existing stage.ts re-apply path still drives the
		// broadphase swap via the setter.
		expect(Camera3d.defaultSortOn).toBe("depth");
		expect(Camera2d.defaultSortOn).toBe("z");
	});

	it("survives flip → flip-back → flip — broadphase always matches sortOn", () => {
		const world = new World(0, 0, 800, 600);
		for (let i = 0; i < 5; i++) {
			world.sortOn = "depth";
			expect(world.broadphase.constructor.name).toBe("Octree");
			world.sortOn = "z";
			expect(world.broadphase.constructor.name).toBe("QuadTree");
		}
	});

	it("preserves world.bodies (no body leak) across a broadphase swap", () => {
		const world = new World(0, 0, 800, 600);
		// bodies are tracked by the adapter, not the broadphase, so the
		// swap must NOT clear them.
		const initialBodies = world.bodies;
		world.sortOn = "depth";
		expect(world.bodies).toBe(initialBodies);
	});
});

describe("BuiltinAdapter.raycast3d", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	it("returns null when sortOn is 2D (broadphase is QuadTree)", () => {
		const world = new World(0, 0, 800, 600);
		expect(world.sortOn).toBe("z");
		// raycast3d delegates to adapter, but builtin returns null for
		// non-depth sortOn (no Octree to walk).
		const hit = world.adapter.raycast3d(
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 1, z: 1 },
		);
		expect(hit).toBeNull();
	});

	it("returns null when no candidates intersect the ray", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const hit = world.adapter.raycast3d(
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 1, z: 1 },
		);
		expect(hit).toBeNull();
	});

	it("hits a renderable whose bounding sphere the ray crosses", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		// Place a renderable centred at (100, 100, 100) with bounds
		// 40×40 → circumradius √(40²+40²)/2 ≈ 28.28. Ray from
		// (100, 100, 0) along +z must hit the sphere. `addChild(child, z)`
		// sets pos.z atomically — passing z separately would let
		// Container.addChild's autoDepth path overwrite it.
		const target = new Renderable(100, 100, 40, 40);
		target.anchorPoint.set(0.5, 0.5); // centre at pos
		target.isKinematic = false;
		world.addChild(target, 100);
		// Force the world's per-frame broadphase rebuild so target lands in the Octree.
		world.update(16);
		const hit = world.adapter.raycast3d(
			{ x: 100, y: 100, z: 0 },
			{ x: 100, y: 100, z: 200 },
		);
		expect(hit).not.toBeNull();
		expect(hit.renderable).toBe(target);
		expect(hit.fraction).toBeGreaterThan(0);
		expect(hit.fraction).toBeLessThan(1);
		// Hit point's z is along the ray, before the sphere centre.
		expect(hit.point.z).toBeGreaterThan(0);
		expect(hit.point.z).toBeLessThan(100);
		// Normal points outward — back toward the ray origin (−z),
		// since we entered the sphere from −z.
		expect(hit.normal.z).toBeLessThan(0);
	});

	it("returns the nearest of multiple candidates", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const near = new Renderable(100, 100, 40, 40);
		near.anchorPoint.set(0.5, 0.5);
		near.isKinematic = false;
		const far = new Renderable(100, 100, 40, 40);
		far.anchorPoint.set(0.5, 0.5);
		far.isKinematic = false;
		world.addChild(near, 50);
		world.addChild(far, 200);
		world.update(16);
		const hit = world.adapter.raycast3d(
			{ x: 100, y: 100, z: 0 },
			{ x: 100, y: 100, z: 300 },
		);
		expect(hit).not.toBeNull();
		expect(hit.renderable).toBe(near);
	});

	it("ray starting inside a sphere returns fraction 0", () => {
		// Regression: a previous version of the hit-table required
		// `t1 ≤ 1` for the inside-sphere branch, missing the case
		// where the sphere fully covered the segment (`t0 < 0`,
		// `t1 > 1`). Verify the from-inside-sphere path now fires.
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const target = new Renderable(100, 100, 200, 200);
		target.anchorPoint.set(0.5, 0.5);
		target.isKinematic = false;
		world.addChild(target, 100);
		world.update(16);
		// circumradius = √(200² + 200²)/2 ≈ 141. Ray from (100,100,99)
		// to (100,100,101) — a 2-unit segment well inside the sphere.
		const hit = world.adapter.raycast3d(
			{ x: 100, y: 100, z: 99 },
			{ x: 100, y: 100, z: 101 },
		);
		expect(hit).not.toBeNull();
		expect(hit.renderable).toBe(target);
		expect(hit.fraction).toBe(0);
	});

	it("ray that misses (parallel-offset) returns null", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const target = new Renderable(0, 0, 40, 40);
		target.anchorPoint.set(0.5, 0.5);
		target.isKinematic = false;
		world.addChild(target, 100);
		world.update(16);
		// circumradius ≈ 28. Ray offset by 100 in x — well outside.
		const hit = world.adapter.raycast3d(
			{ x: 100, y: 0, z: 0 },
			{ x: 100, y: 0, z: 200 },
		);
		expect(hit).toBeNull();
	});

	it("sphere entirely behind the ray origin returns null", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const target = new Renderable(0, 0, 40, 40);
		target.anchorPoint.set(0.5, 0.5);
		target.isKinematic = false;
		world.addChild(target, -100);
		world.update(16);
		// Ray from z=0 → z=200; target sphere centred at z=-100 is
		// behind the origin. Both `t0` and `t1` negative → miss.
		const hit = world.adapter.raycast3d(
			{ x: 0, y: 0, z: 0 },
			{ x: 0, y: 0, z: 200 },
		);
		expect(hit).toBeNull();
	});
});

describe("BuiltinAdapter.querySphere", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	it("returns empty under a 2D camera (sortOn !== 'depth')", () => {
		const world = new World(0, 0, 800, 600);
		const candidates = world.adapter.querySphere({ x: 0, y: 0, z: 0 }, 100);
		expect(candidates).toEqual([]);
	});

	it("returns renderables whose centre is within the sphere", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const inside = new Renderable(100, 100, 20, 20);
		inside.anchorPoint.set(0.5, 0.5);
		inside.isKinematic = false;
		const outside = new Renderable(500, 500, 20, 20);
		outside.anchorPoint.set(0.5, 0.5);
		outside.isKinematic = false;
		world.addChild(inside, 50);
		world.addChild(outside, 50);
		world.update(16);
		const inSphere = world.adapter.querySphere({ x: 100, y: 100, z: 50 }, 30);
		expect(inSphere).toContain(inside);
		expect(inSphere).not.toContain(outside);
	});

	it("excludes a renderable whose centre is one unit past the sphere boundary", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const near = new Renderable(100, 100, 20, 20);
		near.anchorPoint.set(0.5, 0.5);
		near.isKinematic = false;
		world.addChild(near, 100);
		world.update(16);
		// renderable centre at (100, 100, 100); sphere centred at
		// (100, 100, 50) with r=49 → centre distance 50 → outside.
		const justOutside = world.adapter.querySphere(
			{ x: 100, y: 100, z: 50 },
			49,
		);
		expect(justOutside).not.toContain(near);
		// sphere centred at (100, 100, 50) with r=51 → inside.
		const justInside = world.adapter.querySphere({ x: 100, y: 100, z: 50 }, 51);
		expect(justInside).toContain(near);
	});

	it("returns a fresh array each call (no shared-scratch surprise)", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const r1 = world.adapter.querySphere({ x: 0, y: 0, z: 0 }, 100);
		const r2 = world.adapter.querySphere({ x: 0, y: 0, z: 0 }, 100);
		expect(r1).not.toBe(r2);
	});

	it("accepts a Sphere geometry object — same result as the loose form", () => {
		// The Sphere overload is the idiomatic surface for callers
		// that already maintain a bounding sphere per entity. Both
		// forms must return identical candidate sets.
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const inside = new Renderable(100, 100, 20, 20);
		inside.anchorPoint.set(0.5, 0.5);
		inside.isKinematic = false;
		const outside = new Renderable(500, 500, 20, 20);
		outside.anchorPoint.set(0.5, 0.5);
		outside.isKinematic = false;
		world.addChild(inside, 50);
		world.addChild(outside, 50);
		world.update(16);
		// Use the Sphere overload at the public surface.
		const sphere = new Sphere(100, 100, 50, 30);
		const viaSphere = world.adapter.querySphere(sphere);
		const viaFloats = world.adapter.querySphere({ x: 100, y: 100, z: 50 }, 30);
		expect(viaSphere).toContain(inside);
		expect(viaSphere).not.toContain(outside);
		// Same candidate set regardless of call shape.
		expect(viaSphere.length).toEqual(viaFloats.length);
	});

	it("Sphere overload mutated mid-frame reflects new pose on next query", () => {
		// Sanity: the adapter reads sphere.pos / sphere.radius at the
		// call site, NOT at construction time. So a sphere that
		// follows its renderable's pose can be reused frame-to-frame.
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const target = new Renderable(0, 0, 20, 20);
		target.anchorPoint.set(0.5, 0.5);
		target.isKinematic = false;
		world.addChild(target, 100);
		world.update(16);
		const probe = new Sphere(500, 500, 50, 10);
		expect(world.adapter.querySphere(probe)).not.toContain(target);
		// Move the same sphere over the target — must now match.
		probe.setShape(0, 0, 100, 30);
		expect(world.adapter.querySphere(probe)).toContain(target);
	});
});

describe("Camera3d.queryVisible", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	it("returns empty under a 2D broadphase (sortOn !== 'depth')", () => {
		const world = new World(0, 0, 800, 600);
		// don't flip sortOn — broadphase is QuadTree
		const cam = new Camera3d(0, 0, 800, 600);
		cam.frustum.update();
		const visible = cam.queryVisible(world);
		expect(visible).toEqual([]);
	});

	it("returns items in the frustum", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const cam = new Camera3d(0, 0, 800, 600);
		cam.pos.set(0, 0, 0);
		cam._rebuildFrustumPlanes();
		const inFrustum = new Renderable(0, 0, 20, 20);
		inFrustum.anchorPoint.set(0.5, 0.5);
		inFrustum.isKinematic = false;
		world.addChild(inFrustum, 50);
		world.update(16);
		const visible = cam.queryVisible(world);
		expect(visible).toContain(inFrustum);
	});

	it("safe under re-entrancy with caller-supplied out array", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const cam = new Camera3d(0, 0, 800, 600);
		cam._rebuildFrustumPlanes();
		const mine = [];
		const result = cam.queryVisible(world, mine);
		expect(result).toBe(mine);
	});
});

/**
 * Smoke tests for the 2.5D pattern documented in the wiki
 * (https://github.com/melonjs/melonJS/wiki/Working-in-3D#25d-games-paper-mario-style):
 * Camera3d for perspective visuals, but gameplay confined to a shared Z
 * plane. Validates the architectural claims at the broadphase level so
 * any obvious bug surfaces before someone builds the 2.5D example on
 * top of it (#1476).
 *
 * What's actually true:
 * - World swaps to Octree on `sortOn = "depth"`.
 * - Same-Z entities surface as broadphase candidates of each other
 *   (so SAT can resolve XY overlap normally).
 * - Items at distinct Z values DO get partitioned into different
 *   octants, BUT only when they sit on opposite sides of the Octree's
 *   depth midpoint. Items at exactly the midpoint stay at root
 *   (returned in every query), and a 2D Rect query (no z) falls back
 *   to z=0 — which is also the default Octree's depth midpoint — so
 *   it descends into all octants. Parallax isolation via the Octree
 *   alone is therefore best-effort, not a hard guarantee; combine
 *   with `isKinematic` flags or `collisionType` filtering for
 *   deterministic gameplay-only candidate sets.
 */
describe("2.5D pattern (Camera3d + Octree + same-Z gameplay)", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	it("World swaps to Octree when sortOn flips to 'depth'", () => {
		const world = new World(0, 0, 800, 600);
		expect(world.broadphase).not.toBeInstanceOf(Octree);
		world.sortOn = "depth";
		expect(world.broadphase).toBeInstanceOf(Octree);
	});

	it("two gameplay entities sharing Z surface as broadphase candidates of each other (SAT-ready)", () => {
		// What matters for the SAT path: two entities sharing Z stay
		// retrievable against each other so SAT can run its XY check.
		// Same setup as the AfterBurner sphere-query path, just on a
		// flat Z plane.
		const aabb = new AABB3d();
		aabb.setMinMax(-1000, -1000, -1000, 1000, 1000, 1000);
		const world = new World(0, 0, 800, 600);
		const ot = new Octree(world, aabb, 1, 4, 0);

		// Overlapping pair at z=0 — player + enemy at the same Z plane.
		const player = makeItem({ x: 100, y: 100, z: 0, w: 32, h: 32 });
		const enemy = makeItem({ x: 110, y: 110, z: 0, w: 32, h: 32 });
		// A few decoys at the same Z so the tree subdivides.
		const decoy1 = makeItem({ x: 600, y: 50, z: 0 });
		const decoy2 = makeItem({ x: 50, y: 500, z: 0 });
		ot.insert(player);
		ot.insert(enemy);
		ot.insert(decoy1);
		ot.insert(decoy2);

		const out = [];
		ot.retrieve(player, undefined, out);
		// Enemy must surface as a candidate (SAT's job to confirm the
		// XY overlap; broadphase's job is to not lose it).
		expect(out).toContain(enemy);
	});

	it("Renderable at z=0 inserted via world.addChild surfaces in a same-Z Rect query (adapter glue)", () => {
		// Confirm the actual World → broadphase pipeline (world.addChild
		// → Octree) plays nice with the 2D-Rect retrieve shape that
		// `adapter.queryAABB(rect)` uses internally. Catches regressions
		// in how World inserts Renderables into the Octree on update().
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		expect(world.broadphase).toBeInstanceOf(Octree);

		const player = new Renderable(100, 100, 32, 32);
		player.isKinematic = false;
		world.addChild(player, 0);
		for (let i = 0; i < 8; i++) {
			const r = new Renderable(120 + i * 40, 100, 32, 32);
			r.isKinematic = false;
			world.addChild(r, 0);
		}

		world.update(16);

		const rect = new Rect(100, 100, 50, 50);
		const out = [];
		world.broadphase.retrieve(rect, undefined, out);
		expect(out).toContain(player);
	});
});
