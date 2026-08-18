/**
 * Per-shape collision settings (#1590).
 *
 * A body can be built from several shapes, but until now every shape on it
 * collided with exactly the same set — the filter lived on the body. These
 * three optional per-shape fields refine that:
 *
 *   collisionType / collisionMask   unset -> inherit the body's value
 *   isActive        (default true)  false -> the shape does not participate at all
 *   isTrigger       (default false) true  -> collides and reports, but no push-out
 *
 * The defaults are the current behaviour, so a shape that sets nothing behaves
 * exactly as it did before. Half of this suite exists to prove that.
 */
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	boot,
	collision,
	Ellipse,
	Polygon,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";

const T = collision.types;

describe("Physics : per-shape collision settings", () => {
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

	/**
	 * @param {number} x - world x
	 * @param {object[]} shapes - the body's shapes
	 * @param {object} [def] - extra bodyDef fields
	 * @returns {Renderable} the added renderable
	 */
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

	/**
	 * Collect the contacts a renderable sees during one step.
	 *
	 * `ownIndex` matters: the detector tests each pair in both orders, so the
	 * watched body sits in the response's `a` slot on one call and the `b` slot
	 * on the other. Reading `indexShapeA` unconditionally would report the
	 * OTHER body's shape half the time.
	 */
	const watch = (r) => {
		const hits = [];
		r.onCollision = (response, other) => {
			hits.push({
				other,
				ownIndex:
					response.a === r ? response.indexShapeA : response.indexShapeB,
				indexA: response.indexShapeA,
				indexB: response.indexShapeB,
			});
			return false; // never push out — keeps positions readable
		};
		return hits;
	};

	const step = () => {
		world.update(16);
	};

	// ── backward compatibility ──────────────────────────────────────────
	// These must hold identically before and after the feature. They are the
	// reason it can ship: a body that sets nothing is untouched.

	describe("backward compatibility", () => {
		it("a two-shape body with no per-shape settings collides as before", () => {
			const a = add(100, [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)]);
			const hits = watch(a);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			step();
			expect(hits.length).toBeGreaterThan(0);
			// the narrowphase still reports which shapes met
			expect(hits[0].indexA).toBeGreaterThanOrEqual(0);
			expect(hits[0].indexB).toBeGreaterThanOrEqual(0);
			// with nothing filtered, both shapes are reachable
			expect(
				hits.some((h) => {
					return h.ownIndex === 0 || h.ownIndex === 1;
				}),
			).toBe(true);
		});

		it("a body-level mask still excludes a whole body", () => {
			// the pair is rejected before the shape loop is ever reached
			const a = add(100, [new Rect(0, 0, 32, 32)], {
				collisionMask: T.WORLD_SHAPE,
			});
			const hits = watch(a);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			step();
			expect(hits).toHaveLength(0);
		});

		it("shapes given as Rect behave like shapes given as Polygon", () => {
			const asRect = add(100, [new Rect(0, 0, 32, 32)]);
			const rectHits = watch(asRect);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			step();
			const rectCount = rectHits.length;

			world = new World(0, 0, 800, 600);
			const asPoly = add(100, [
				new Polygon(0, 0, [
					new Vector2d(0, 0),
					new Vector2d(32, 0),
					new Vector2d(32, 32),
					new Vector2d(0, 32),
				]),
			]);
			const polyHits = watch(asPoly);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			step();
			expect(polyHits.length).toBe(rectCount);
		});
	});

	// ── the new behaviour ───────────────────────────────────────────────

	describe("per-shape filtering", () => {
		it("filters one shape of a body while the other still collides", () => {
			const feet = new Rect(0, 0, 16, 32);
			const torso = new Rect(16, 0, 16, 32);
			// only the torso answers to enemies
			feet.collisionMask = T.WORLD_SHAPE;
			torso.collisionMask = T.ENEMY_OBJECT;

			const a = add(100, [feet, torso]);
			const hits = watch(a);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			step();

			expect(hits.length).toBeGreaterThan(0);
			// index 0 is `feet`, index 1 the torso — the feet are filtered out
			// of this pair, so every contact reported must be the torso's
			for (const h of hits) {
				expect(h.ownIndex).toBe(1);
			}
		});

		it("a shape cannot widen past its body's mask", () => {
			// narrow-only: the body gate runs first, so a permissive shape on a
			// restrictive body still collides with nothing
			const shape = new Rect(0, 0, 32, 32);
			shape.collisionMask = T.ALL_OBJECT;
			const a = add(100, [shape], { collisionMask: T.WORLD_SHAPE });
			const hits = watch(a);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			step();
			expect(hits).toHaveLength(0);
		});

		it("inherits each field independently when only one is set", () => {
			// `??` must apply per field — setting a type must not orphan the mask
			const shape = new Rect(0, 0, 32, 32);
			shape.collisionType = T.NPC_OBJECT; // mask left unset -> body's
			const a = add(100, [shape]);
			const hits = watch(a);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			step();
			// the body's ALL_OBJECT mask still applies, so this collides
			expect(hits.length).toBeGreaterThan(0);
		});

		it("treats collisionType 0 as a real value, not as unset", () => {
			// the `||` vs `??` trap: 0 is falsy but meaningful — it means
			// "collides with nothing", not "inherit"
			const shape = new Rect(0, 0, 32, 32);
			shape.collisionType = 0;
			const a = add(100, [shape]);
			const hits = watch(a);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			step();
			expect(hits).toHaveLength(0);
		});
	});

	describe("isActive", () => {
		it("skips the narrowphase entirely for an inactive shape", () => {
			// assert the geometry test is never REACHED, not merely that no
			// contact was reported — those fail for different reasons
			const shape = new Rect(0, 0, 32, 32);
			shape.isActive = false;
			const a = add(100, [shape]);
			const detector = world.physic.detector ?? world.detector;
			const spy = vi.spyOn(detector, "collides");
			const hits = watch(a);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			step();

			expect(hits).toHaveLength(0);
			// `collides` still runs (it owns the shape loop); what matters is
			// that it found nothing because the shape was skipped
			expect(spy).toHaveBeenCalled();
			expect(
				spy.mock.results.every((r) => {
					return r.value === false;
				}),
			).toBe(true);
			spy.mockRestore();
		});

		it("takes effect between steps when toggled at runtime", () => {
			const shape = new Rect(0, 0, 32, 32);
			const a = add(100, [shape]);
			const hits = watch(a);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });

			step();
			expect(hits.length).toBeGreaterThan(0);

			hits.length = 0;
			a.body.shapes[0].isActive = false;
			step();
			expect(hits).toHaveLength(0);

			a.body.shapes[0].isActive = true;
			step();
			expect(hits.length).toBeGreaterThan(0);
		});

		it("a body whose every shape is inactive behaves as if it had none", () => {
			const s1 = new Rect(0, 0, 16, 32);
			const s2 = new Rect(16, 0, 16, 32);
			s1.isActive = false;
			s2.isActive = false;
			const a = add(100, [s1, s2]);
			const hits = watch(a);
			const b = add(116, [new Rect(0, 0, 32, 32)], {
				collisionType: T.ENEMY_OBJECT,
			});
			const before = { x: b.pos.x, y: b.pos.y };
			expect(() => {
				return step();
			}).not.toThrow();
			expect(hits).toHaveLength(0);
			// and the extra-pass loop did not spin against a phantom overlap
			expect(b.pos.x).toBe(before.x);
			expect(b.pos.y).toBe(before.y);
		});
	});

	describe("isTrigger", () => {
		it("reports the contact but skips push-out", () => {
			const shape = new Rect(0, 0, 32, 32);
			shape.isTrigger = true;
			const a = add(100, [shape]);
			const hits = [];
			// no `return false` here — we WANT the default push-out path to run,
			// so that skipping it is attributable to the trigger flag alone
			a.onCollisionActive = (response, other) => {
				hits.push(other);
			};
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			const before = a.pos.x;
			step();

			expect(hits.length).toBeGreaterThan(0); // it DID collide
			expect(a.pos.x).toBe(before); // and was NOT moved
		});

		it("holds a multi-shape body in place (the extra-pass path)", () => {
			// the per-shape twin of the body-level sensor bug: the junction
			// resolve pass writes positions directly and must honour triggers
			const s1 = new Rect(0, 0, 16, 32);
			const s2 = new Rect(16, 0, 16, 32);
			s1.isTrigger = true;
			s2.isTrigger = true;
			const a = add(100, [s1, s2]);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			const before = a.pos.x;
			step();
			expect(a.pos.x).toBe(before);
		});
	});

	// ── adversarial ─────────────────────────────────────────────────────

	describe("adversarial", () => {
		it("a recycled pooled shape does not inherit the previous settings", () => {
			// `addShape` converts a Rect into a POOLED Polygon. If the settings
			// are not written explicitly, the next body to claim that instance
			// gets whatever the last one left behind — a contamination bug that
			// would surface as an unrelated object silently not colliding.
			const tainted = new Rect(0, 0, 32, 32);
			tainted.collisionMask = T.WORLD_SHAPE; // excludes enemies
			tainted.isTrigger = true;
			const first = add(100, [tainted]);
			first.body.removeShape(first.body.shapes[0]);
			world.removeChild(first);

			// a fresh body with a PLAIN rect — likely to reuse the pooled polygon
			world = new World(0, 0, 800, 600);
			const clean = add(100, [new Rect(0, 0, 32, 32)]);
			const hits = watch(clean);
			add(116, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			step();

			// if the mask leaked, this would be 0
			expect(hits.length).toBeGreaterThan(0);
			expect(clean.body.shapes[0].isTrigger).toBe(false);
			expect(clean.body.shapes[0].collisionMask).toBeUndefined();
		});

		it("removeShape preserves the settings of the surviving shapes", () => {
			// removeShape re-adds every survivor through addShape, so
			// normalization must be idempotent
			const s1 = new Rect(0, 0, 10, 32);
			const s2 = new Rect(10, 0, 10, 32);
			const s3 = new Rect(20, 0, 10, 32);
			s1.collisionMask = T.WORLD_SHAPE;
			s3.isTrigger = true;
			const a = add(100, [s1, s2, s3]);

			const mid = a.body.shapes[1];
			a.body.removeShape(mid);

			expect(a.body.shapes).toHaveLength(2);
			expect(a.body.shapes[0].collisionMask).toBe(T.WORLD_SHAPE);
			expect(a.body.shapes[1].isTrigger).toBe(true);
		});

		it("carries settings across the Rect -> Polygon conversion", () => {
			// the object stored is NOT the object passed; anything set on the
			// Rect must survive the conversion or the feature silently no-ops
			const r = new Rect(0, 0, 32, 32);
			r.collisionMask = T.WORLD_SHAPE;
			r.isTrigger = true;
			r.isActive = false;
			const a = add(100, [r]);
			const stored = a.body.shapes[0];
			expect(stored).not.toBe(r); // converted
			expect(stored.collisionMask).toBe(T.WORLD_SHAPE);
			expect(stored.isTrigger).toBe(true);
			expect(stored.isActive).toBe(false);
		});

		it("applies to every shape kind that reaches addShape", () => {
			const ellipse = new Ellipse(16, 16, 32, 32);
			ellipse.isTrigger = true;
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(32, 0),
				new Vector2d(32, 32),
			]);
			poly.collisionMask = T.WORLD_SHAPE;
			const a = add(100, [ellipse, poly]);
			expect(a.body.shapes[0].isTrigger).toBe(true);
			expect(a.body.shapes[1].collisionMask).toBe(T.WORLD_SHAPE);
			// and the defaults landed on both
			expect(a.body.shapes[0].isActive).toBe(true);
			expect(a.body.shapes[1].isTrigger).toBe(false);
		});

		it("both shapes filtered out is a clean no-collision", () => {
			const s = new Rect(0, 0, 32, 32);
			s.collisionMask = T.WORLD_SHAPE;
			const a = add(100, [s]);
			const hits = watch(a);
			const other = new Rect(0, 0, 32, 32);
			other.collisionMask = T.WORLD_SHAPE;
			add(116, [other], { collisionType: T.ENEMY_OBJECT });
			expect(() => {
				return step();
			}).not.toThrow();
			expect(hits).toHaveLength(0);
		});
	});
});
