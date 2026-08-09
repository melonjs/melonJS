/**
 * Adversarial / differential sweep over the Octree broadphase.
 *
 * `octree.spec.js` covers the happy paths and the documented contracts.
 * This file exists to attack them: midpoint ties, boundary coordinates,
 * and — the core of it — randomized DIFFERENTIAL testing of every query
 * against a brute-force scan.
 *
 * The broadphase contract is "conservative superset": a query may return
 * extra candidates (the narrowphase rejects them), but it must NEVER omit
 * one that genuinely overlaps. A false negative is a silently missed
 * collision, which is the failure mode that does not announce itself.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { AABB3d } from "../src/physics/broadphase/aabb3d.ts";
import Octree from "../src/physics/broadphase/octree.ts";

/** Deterministic LCG — reproducible failures beat `Math.random()`. */
function lcg(seed) {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

function makeItem({ x, y, z, w = 10, h = 10 }, id = -1) {
	return {
		id,
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

/** 2D bounds overlap — exactly what `Detector.collisions` prefilters on. */
function overlaps2d(a, b) {
	const A = a.getBounds();
	const B = b.getBounds();
	return (
		A.left < B.left + B.width &&
		A.left + A.width > B.left &&
		A.top < B.top + B.height &&
		A.top + A.height > B.top
	);
}

/**
 * The Octree only ever touches `world` to reach
 * `world.app.viewport.localToWorld` on the `isFloating` branch, and nothing
 * here is floating. So this stays a pure unit test: no `boot()`, no
 * `Application`, no canvas.
 *
 * That is deliberate rather than incidental. Every spec that stands up an
 * Application leaves a live canvas/context in the shared browser session for
 * the rest of the run, and `helpers/webgl-context.js` documents the
 * consequence — some unrelated spec's `beforeAll` times out later, blaming
 * whichever file happened to run late. A test that does not need one should
 * not create one.
 */
const stubWorld = {};

describe("Octree — adversarial", () => {
	/** the ±10000 origin-centred root that `createBroadphase()` actually builds */
	let octree;

	beforeEach(() => {
		const world = stubWorld;
		const bounds = new AABB3d();
		bounds.setMinMax(-10000, -10000, -10000, 10000, 10000, 10000);
		octree = new Octree(world, bounds, 4, 4, 0);
	});

	// ─────────────────────────────────────────────────────────────────
	// A. Midpoint ties. An item EXACTLY on a midpoint is not the same
	//    as an item SPANNING one. Spanners genuinely belong to the
	//    parent; exact-ties lie wholly within one child and should
	//    descend. The root's midpoints are (0, 0, 0) — which is the
	//    default `pos` of every renderable in the engine.
	// ─────────────────────────────────────────────────────────────────
	describe("midpoint ties", () => {
		it("z exactly on the depth midpoint still classifies", () => {
			// point-z: an item cannot span the depth midpoint, so -1 is
			// never the right answer on this axis
			const item = makeItem({ x: 100, y: 100, z: 0 });
			expect(octree.getIndex(item)).not.toBe(-1);
		});

		it("x exactly on the vertical midpoint still classifies", () => {
			// left edge ON the midpoint → item lies wholly in the RIGHT half
			const item = makeItem({ x: 0, y: 100, z: 50, w: 10 });
			expect(octree.getIndex(item)).not.toBe(-1);
		});

		it("y exactly on the horizontal midpoint still classifies", () => {
			// top edge ON the midpoint → item lies wholly in the BOTTOM half
			const item = makeItem({ x: 100, y: 0, z: 50, h: 10 });
			expect(octree.getIndex(item)).not.toBe(-1);
		});

		it("an item at the default position (0,0,0) classifies", () => {
			// every renderable starts here; if this lands at the root the
			// whole gameplay layer of a 2.5D game is unpartitioned
			expect(octree.getIndex(makeItem({ x: 0, y: 0, z: 0 }))).not.toBe(-1);
		});

		it("REGRESSION GUARD: genuine x/y spanners still stay at the parent", () => {
			// these must NOT change — an item straddling a midpoint has to
			// be visible from both children
			expect(octree.getIndex(makeItem({ x: -5, y: 100, z: 50, w: 20 }))).toBe(
				-1,
			);
			expect(octree.getIndex(makeItem({ x: 100, y: -5, z: 50, h: 20 }))).toBe(
				-1,
			);
		});

		it("REGRESSION GUARD: out-of-bounds items still stay at the parent", () => {
			expect(octree.getIndex(makeItem({ x: 99999, y: 0, z: 0 }))).toBe(-1);
			expect(octree.getIndex(makeItem({ x: 0, y: 0, z: 99999 }))).toBe(-1);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// B. The downstream cost of A: a gameplay plane at z = 0 (the
	//    pattern our own 2.5D docs prescribe) must actually partition.
	// ─────────────────────────────────────────────────────────────────
	describe("gameplay plane partitioning", () => {
		const spread = (zFor) => {
			for (let i = 0; i < 200; i++) {
				octree.insert(
					makeItem({ x: (i % 20) * 400 - 4000, y: 100 + i, z: zFor(i) }, i),
				);
			}
		};

		it("200 bodies on a shared z=0 plane do not all pile up at the root", () => {
			spread(() => {
				return 0;
			});
			expect(octree.objects.length).toBeLessThan(200);
		});

		it("200 bodies on z=0 prune on retrieve()", () => {
			spread(() => {
				return 0;
			});
			const got = octree.retrieve(makeItem({ x: 0, y: 100, z: 0 }));
			expect(got.length).toBeLessThan(200);
		});

		it("CONTROL: the same 200 bodies spread in z already partition", () => {
			spread((i) => {
				return i % 2 ? 500 : -500;
			});
			expect(octree.objects.length).toBeLessThan(200);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// C. Differential vs brute force. This is the part that finds bugs
	//    nobody thought to look for.
	// ─────────────────────────────────────────────────────────────────
	describe("differential vs brute force", () => {
		/** Populate with `n` pseudo-random items and return them. */
		const populate = (n, seed, zPick) => {
			const rnd = lcg(seed);
			const items = [];
			for (let i = 0; i < n; i++) {
				const item = makeItem(
					{
						x: Math.round((rnd() - 0.5) * 4000),
						y: Math.round((rnd() - 0.5) * 4000),
						z: zPick(rnd, i),
						w: 5 + Math.round(rnd() * 60),
						h: 5 + Math.round(rnd() * 60),
					},
					i,
				);
				items.push(item);
				octree.insert(item);
			}
			return items;
		};

		it("queryAABB returns a superset of every genuinely overlapping item", () => {
			const items = populate(400, 12345, (rnd) => {
				return Math.round((rnd() - 0.5) * 4000);
			});
			const rnd = lcg(999);
			for (let q = 0; q < 100; q++) {
				const qx = (rnd() - 0.5) * 4000;
				const qy = (rnd() - 0.5) * 4000;
				const qz = (rnd() - 0.5) * 4000;
				const box = new AABB3d();
				box.setMinMax(qx, qy, qz, qx + 500, qy + 500, qz + 500);

				const expected = items.filter((it) => {
					const b = it.getBounds();
					const z = it._pos.z;
					return (
						b.left < box.max.x &&
						b.left + b.width > box.min.x &&
						b.top < box.max.y &&
						b.top + b.height > box.min.y &&
						z >= box.min.z &&
						z <= box.max.z
					);
				});
				const got = new Set(
					octree.queryAABB(box, []).map((i) => {
						return i.id;
					}),
				);
				const missing = expected.filter((e) => {
					return !got.has(e.id);
				});
				expect(
					missing.map((m) => {
						return { id: m.id, pos: m._pos };
					}),
					`query #${q} @ (${qx | 0},${qy | 0},${qz | 0})`,
				).toEqual([]);
			}
		});

		it("querySphere returns a superset of every item whose centre is inside", () => {
			const items = populate(400, 555, (rnd) => {
				return Math.round((rnd() - 0.5) * 4000);
			});
			const rnd = lcg(777);
			for (let q = 0; q < 100; q++) {
				const cx = (rnd() - 0.5) * 4000;
				const cy = (rnd() - 0.5) * 4000;
				const cz = (rnd() - 0.5) * 4000;
				const r = 200 + rnd() * 600;

				// use each item's own bounds corner + z as its representative
				// point, matching how the octree files it
				const expected = items.filter((it) => {
					const dx = it._pos.x - cx;
					const dy = it._pos.y - cy;
					const dz = it._pos.z - cz;
					return dx * dx + dy * dy + dz * dz <= r * r;
				});
				const got = new Set(
					octree.querySphere(cx, cy, cz, r, []).map((i) => {
						return i.id;
					}),
				);
				const missing = expected.filter((e) => {
					return !got.has(e.id);
				});
				expect(
					missing.map((m) => {
						return { id: m.id, pos: m._pos };
					}),
					`sphere #${q} @ (${cx | 0},${cy | 0},${cz | 0}) r=${r | 0}`,
				).toEqual([]);
			}
		});

		it("retrieve() surfaces every 2D-overlapping pair on a SHARED z plane", () => {
			// the 2.5D contract: everything on the gameplay plane, 2D SAT
			// decides. No pair that genuinely overlaps in XY may be missed.
			const items = populate(300, 4242, () => {
				return 0;
			});
			for (const probe of items) {
				const got = new Set(
					octree.retrieve(probe, undefined, []).map((i) => {
						return i.id;
					}),
				);
				const expected = items.filter((o) => {
					return o !== probe && overlaps2d(probe, o);
				});
				const missing = expected.filter((e) => {
					return !got.has(e.id);
				});
				expect(
					missing.map((m) => {
						return m.id;
					}),
					`probe #${probe.id} missed overlapping neighbours`,
				).toEqual([]);
			}
		});

		it("retrieve() surfaces every 2D-overlapping pair across DIFFERENT z", () => {
			// melonJS collision is 2D SAT: two bodies at different z that
			// overlap in XY *do* collide. If the octree's z partitioning
			// prunes them apart, that is a silent missed collision.
			const items = populate(300, 31337, (rnd) => {
				return Math.round((rnd() - 0.5) * 4000);
			});
			// aggregate across every probe so the failure reports the RATE,
			// not just whichever pair happened to be found first
			let pairsExpected = 0;
			const missedPairs = [];
			for (const probe of items) {
				const got = new Set(
					octree.retrieve(probe, undefined, []).map((i) => {
						return i.id;
					}),
				);
				const expected = items.filter((o) => {
					return o !== probe && overlaps2d(probe, o);
				});
				pairsExpected += expected.length;
				for (const e of expected) {
					if (!got.has(e.id)) {
						missedPairs.push(
							`#${probe.id}(z=${probe._pos.z})↮#${e.id}(z=${e._pos.z})`,
						);
					}
				}
			}
			console.log(
				`cross-z: ${missedPairs.length} missed of ${pairsExpected} genuinely overlapping pairs`,
			);
			expect(missedPairs).toEqual([]);
		});
	});

	// ─────────────────────────────────────────────────────────────────
	// D. Structural invariants under churn.
	// ─────────────────────────────────────────────────────────────────
	describe("structural invariants", () => {
		/** Count every item held anywhere in the subtree. */
		const countAll = (node) => {
			let n = node.objects.length;
			for (const child of node.nodes) {
				n += countAll(child);
			}
			return n;
		};

		it("_subtreeCount matches the real item count after random churn", () => {
			const rnd = lcg(2024);
			const live = [];
			for (let i = 0; i < 400; i++) {
				if (live.length > 0 && rnd() < 0.3) {
					const victim = live.splice(Math.floor(rnd() * live.length), 1)[0];
					octree.remove(victim);
				} else {
					const item = makeItem(
						{
							x: Math.round((rnd() - 0.5) * 4000),
							y: Math.round((rnd() - 0.5) * 4000),
							z: Math.round((rnd() - 0.5) * 4000),
						},
						i,
					);
					live.push(item);
					octree.insert(item);
				}
			}
			expect(countAll(octree)).toBe(live.length);
			expect(octree._subtreeCount).toBe(live.length);
		});

		it("no query ever returns the same item twice", () => {
			const rnd = lcg(8080);
			for (let i = 0; i < 300; i++) {
				octree.insert(
					makeItem(
						{
							x: Math.round((rnd() - 0.5) * 4000),
							y: Math.round((rnd() - 0.5) * 4000),
							z: Math.round((rnd() - 0.5) * 4000),
						},
						i,
					),
				);
			}
			const box = new AABB3d();
			box.setMinMax(-1000, -1000, -1000, 1000, 1000, 1000);
			const got = octree.queryAABB(box, []);
			expect(got.length).toBe(new Set(got).size);

			const sphereGot = octree.querySphere(0, 0, 0, 1500, []);
			expect(sphereGot.length).toBe(new Set(sphereGot).size);
		});
	});
});
