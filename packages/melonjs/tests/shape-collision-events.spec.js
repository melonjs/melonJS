/**
 * Shape-level collision lifecycle events (#1596).
 *
 * #1590 gave each shape its own filter and flags, but the lifecycle stayed per
 * renderable pair: `collides()` returns the FIRST solid pair and stops, so a
 * body overlapping through several shapes only ever surfaced one contact, and
 * a solid contact hid a simultaneous trigger one.
 *
 * These events enumerate every overlapping pair without changing which pair
 * resolves. The load-bearing property is that the enumeration is OPT-IN: an
 * application declaring none of these handlers must run exactly the narrowphase
 * it ran before, which is asserted directly rather than assumed.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	collision,
	Rect,
	Renderable,
	video,
	World,
} from "../src/index.js";

const T = collision.types;

describe("Physics : shape-level collision events", () => {
	/** @type {World} */
	let world;
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

	afterAll(() => {
		app?.destroy();
	});

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
	});

	const add = (x, shapes, def = {}) => {
		const r = new Renderable(x, 100, 32, 32);
		r.alwaysUpdate = true;
		r.bodyDef = {
			type: "dynamic",
			shapes,
			collisionType: T.PLAYER_OBJECT,
			collisionMask: T.ALL_OBJECT,
			gravityScale: 0,
			...def,
		};
		world.addChild(r);
		return r;
	};

	// ── the backward-compatibility guarantee ────────────────────────────

	describe("opt-in: an unsubscribed application is untouched", () => {
		it("never engages the enumeration machinery when nobody subscribes", () => {
			// The only behavioural difference inside `collides()` is gated on the
			// `onContact` callback, and that callback is the sole writer of
			// `_frameShapeSeen`. An empty map after a step with a real collision
			// therefore proves the loop took the pre-feature path and early
			// returned on the first solid pair, rather than proving it merely
			// produced the same answer.
			const a = add(100, [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)]);
			add(108, [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)], {
				collisionType: T.ENEMY_OBJECT,
			});
			let resolved = 0;
			a.onCollision = () => {
				resolved++;
				return false;
			};
			world.update(16);

			// the collision genuinely happened...
			expect(resolved).toBeGreaterThan(0);
			// ...and cost nothing on the new path
			expect(world.detector._frameShapeSeen.size).toBe(0);
			expect(world.detector._activeShapePairs.size).toBe(0);
		});

		it("engages it as soon as one object subscribes", () => {
			// the mirror of the above, so the assertion cannot pass simply
			// because the maps are never populated under any circumstances
			const a = add(100, [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)]);
			add(108, [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)], {
				collisionType: T.ENEMY_OBJECT,
			});
			a.onShapeCollisionActive = () => {};
			world.update(16);
			expect(world.detector._activeShapePairs.size).toBeGreaterThan(0);
		});

		it("still delivers the same resolved contact to onCollision", () => {
			const seen = [];
			const a = add(100, [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)]);
			a.onCollision = (response) => {
				seen.push({
					idxA: response.indexShapeA,
					idxB: response.indexShapeB,
					ov: Number(response.overlapV.x.toFixed(4)),
				});
				return false;
			};
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			world.update(16);
			const withoutSub = JSON.parse(JSON.stringify(seen));

			// identical scene, now with a shape subscriber attached
			world = new World(0, 0, 800, 600);
			const seen2 = [];
			const a2 = add(100, [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)]);
			a2.onShapeCollisionActive = () => {};
			a2.onCollision = (response) => {
				seen2.push({
					idxA: response.indexShapeA,
					idxB: response.indexShapeB,
					ov: Number(response.overlapV.x.toFixed(4)),
				});
				return false;
			};
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			world.update(16);

			// enumeration must not change WHICH contact resolves, nor its data
			expect(seen2[0]).toEqual(withoutSub[0]);
		});
	});

	// ── enumeration ─────────────────────────────────────────────────────

	describe("every overlapping shape pair is reported", () => {
		it("reports more than one contact between the same two bodies", () => {
			const contacts = [];
			const a = add(100, [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)]);
			a.onShapeCollisionActive = (contact) => {
				contacts.push([contact.indexShapeA, contact.indexShapeB]);
			};
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			world.update(16);

			// both of A's shapes overlap the single wide shape of B
			expect(contacts.length).toBeGreaterThan(1);
			const own = contacts
				.map((c) => {
					return c[0];
				})
				.sort();
			expect(own).toEqual([0, 1]);
		});

		it("a solid contact no longer hides a simultaneous trigger contact", () => {
			// the exact regression #1596 was filed for
			const solid = new Rect(0, 0, 16, 32);
			const trigger = new Rect(16, 0, 16, 32);
			trigger.isTrigger = true;
			const a = add(100, [solid, trigger]);
			const seen = [];
			a.onShapeCollisionActive = (contact) => {
				seen.push({ idx: contact.indexShapeA, trigger: contact.isTrigger });
			};
			let resolved = null;
			a.onCollision = (response) => {
				resolved = response.indexShapeA;
				return false;
			};
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			world.update(16);

			// BOTH contacts surface
			expect(
				seen.find((s) => {
					return s.trigger === true;
				}),
			).toBeDefined();
			expect(
				seen.find((s) => {
					return s.trigger === false;
				}),
			).toBeDefined();
			// and the SOLID one is still what resolves
			expect(resolved).toBe(0);
		});

		it("skips filtered and inactive shapes, as the narrowphase does", () => {
			const filtered = new Rect(0, 0, 16, 32);
			filtered.collisionMask = T.WORLD_SHAPE; // excludes the enemy
			const inactive = new Rect(0, 0, 16, 32);
			inactive.isActive = false;
			const plain = new Rect(16, 0, 16, 32);
			const a = add(100, [filtered, inactive, plain]);
			const seen = [];
			a.onShapeCollisionActive = (contact) => {
				seen.push(contact.indexShapeA);
			};
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			world.update(16);

			expect(seen).not.toContain(0); // filtered out
			expect(seen).not.toContain(1); // inactive
			expect(seen).toContain(2);
		});
	});

	// ── receiver symmetry ───────────────────────────────────────────────

	it("shapeA is always the receiver's own shape", () => {
		const a = add(100, [new Rect(0, 0, 32, 32)]);
		const b = add(108, [new Rect(0, 0, 32, 32)], {
			collisionType: T.ENEMY_OBJECT,
		});
		let fromA = null;
		let fromB = null;
		a.onShapeCollisionActive = (contact, other) => {
			fromA = { own: contact.shapeA, other: contact.shapeB, partner: other };
		};
		b.onShapeCollisionActive = (contact, other) => {
			fromB = { own: contact.shapeA, other: contact.shapeB, partner: other };
		};
		world.update(16);

		expect(fromA.own).toBe(a.body.shapes[0]);
		expect(fromA.other).toBe(b.body.shapes[0]);
		expect(fromA.partner).toBe(b);
		// the mirror image for the other receiver
		expect(fromB.own).toBe(b.body.shapes[0]);
		expect(fromB.other).toBe(a.body.shapes[0]);
		expect(fromB.partner).toBe(a);
	});

	// ── lifecycle ───────────────────────────────────────────────────────

	describe("start / active / end", () => {
		it("fires Start once, Active every step, End on separation", () => {
			const log = [];
			const a = add(100, [new Rect(0, 0, 32, 32)]);
			a.onShapeCollisionStart = () => {
				return log.push("start");
			};
			a.onShapeCollisionActive = () => {
				return log.push("active");
			};
			a.onShapeCollisionEnd = () => {
				return log.push("end");
			};
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });

			world.update(16);
			world.update(16);
			expect(
				log.filter((e) => {
					return e === "start";
				}),
			).toHaveLength(1);
			expect(
				log.filter((e) => {
					return e === "active";
				}).length,
			).toBeGreaterThanOrEqual(2);
			expect(log).not.toContain("end");

			// separate them
			a.pos.x = 400;
			a.body.getBounds().translate(300, 0);
			world.update(16);
			expect(log).toContain("end");
		});

		it("End carries identity but no geometry", () => {
			const a = add(100, [new Rect(0, 0, 32, 32)]);
			let ended = null;
			a.onShapeCollisionEnd = (contact, other) => {
				ended = {
					own: contact.shapeA,
					partner: other,
					overlap: contact.overlap,
					depth: contact.depth,
				};
			};
			const b = add(108, [new Rect(0, 0, 32, 32)], {
				collisionType: T.ENEMY_OBJECT,
			});
			world.update(16);
			a.pos.x = 400;
			a.body.getBounds().translate(300, 0);
			world.update(16);

			expect(ended).not.toBeNull();
			expect(ended.own).toBe(a.body.shapes[0]);
			expect(ended.partner).toBe(b);
			// separated, so there is nothing truthful to measure
			expect(ended.overlap).toBe(0);
			expect(ended.depth).toBe(0);
		});
	});

	// ── the identity hazard the ticket called out ───────────────────────

	describe("identity survives body mutation", () => {
		it("re-indexing does not end a surviving contact", () => {
			// `removeShapeAt(0)` splices, so the survivor moves from index 1 to
			// index 0. An identity built on array position would End and Start
			// it here; a stamped id must not.
			//
			// NOTE the shapes are read back from `body.shapes`: `addShape`
			// converts a Rect into a pooled Polygon, so the instance passed in
			// is NOT the one stored, and removing by the original reference is
			// a silent no-op.
			const a = add(100, [new Rect(0, 0, 8, 32), new Rect(8, 0, 24, 32)]);
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			const survivor = a.body.shapes[1];
			const starts = [];
			const ends = [];
			a.onShapeCollisionStart = (contact) => {
				starts.push(contact.shapeA);
			};
			a.onShapeCollisionEnd = (contact) => {
				ends.push(contact.shapeA);
			};

			world.update(16);
			expect(starts).toContain(survivor);
			const before = starts.length;
			expect(a.body.shapes).toHaveLength(2);

			a.body.removeShapeAt(0);
			expect(a.body.shapes).toHaveLength(1);
			expect(a.body.shapes[0]).toBe(survivor); // it really did re-index
			world.update(16);

			// the survivor's contact must be continuous across the re-index
			expect(starts.slice(before)).not.toContain(survivor);
			expect(ends).not.toContain(survivor);
		});

		it("a handler removing a shape mid-dispatch does not throw", () => {
			// Enumeration runs user code INSIDE the narrowphase scan, so a
			// handler can mutate either body before the winning pair is
			// re-measured. Capturing indices during the scan made that a
			// TypeError on `undefined.type` and took the whole world step down.
			const a = add(100, [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)]);
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			a.onShapeCollisionStart = () => {
				if (a.body.shapes.length > 1) {
					a.body.removeShapeAt(0);
				}
			};
			expect(() => {
				world.update(16);
			}).not.toThrow();
			// and the world keeps stepping afterwards
			expect(() => {
				world.update(16);
			}).not.toThrow();
		});

		it("a handler removing the PARTNER's shape does not throw", () => {
			const a = add(100, [new Rect(0, 0, 32, 32)]);
			const b = add(108, [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)], {
				collisionType: T.ENEMY_OBJECT,
			});
			a.onShapeCollisionStart = () => {
				if (b.body.shapes.length > 1) {
					b.body.removeShapeAt(0);
				}
			};
			expect(() => {
				world.update(16);
			}).not.toThrow();
		});
	});

	it("delivers events to a subscriber on a STATIC body", () => {
		// a static body's own `collisions()` never runs, so its events can only
		// arrive through the dynamic partner's visit. The `_wantsShapeContacts`
		// gate checks BOTH objects for exactly this reason.
		const wall = add(108, [new Rect(0, 0, 32, 32)], {
			type: "static",
			collisionType: T.WORLD_SHAPE,
		});
		add(100, [new Rect(0, 0, 32, 32)]);
		const seen = [];
		wall.onShapeCollisionActive = (contact, other) => {
			seen.push({ own: contact.shapeA, partner: other });
		};
		world.update(16);

		expect(seen.length).toBeGreaterThan(0);
		expect(seen[0].own).toBe(wall.body.shapes[0]);
	});

	it("keeps Z data sign-symmetric between the two receivers", () => {
		// `_fillShapeView` negates the Z triple on the flipped side, exactly as
		// `_fillSymView` does. A sign error there would ship silently because
		// planar pairs leave every Z field at 0.
		const a = add(100, [new Rect(0, 0, 32, 32)]);
		const b = add(108, [new Rect(0, 0, 32, 32)], {
			collisionType: T.ENEMY_OBJECT,
		});
		let fromA = null;
		let fromB = null;
		a.onShapeCollisionActive = (contact) => {
			fromA = { nx: contact.normal.x, ovx: contact.overlapV.x };
		};
		b.onShapeCollisionActive = (contact) => {
			fromB = { nx: contact.normal.x, ovx: contact.overlapV.x };
		};
		world.update(16);

		// the two receivers must see opposing vectors for the same overlap
		expect(fromA).not.toBeNull();
		expect(fromB).not.toBeNull();
		expect(fromA.ovx).toBeCloseTo(-fromB.ovx, 6);
		expect(fromA.nx).toBeCloseTo(-fromB.nx, 6);
	});

	it("reports one contact per partner when three bodies overlap", () => {
		// the pooled 2-slot view is reused across pairs in sequence, which is
		// the classic place for a stale-field bug to hide
		const a = add(100, [new Rect(0, 0, 40, 32)]);
		const b = add(108, [new Rect(0, 0, 32, 32)], {
			collisionType: T.ENEMY_OBJECT,
		});
		const c = add(120, [new Rect(0, 0, 32, 32)], {
			collisionType: T.ENEMY_OBJECT,
		});
		const partners = [];
		a.onShapeCollisionActive = (contact, other) => {
			partners.push(other);
			// the view must describe THIS pair, not the previous one
			expect(contact.b).toBe(other);
		};
		world.update(16);

		expect(partners).toContain(b);
		expect(partners).toContain(c);
	});
});
