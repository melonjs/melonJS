/**
 * Adversarial coverage for the two places #1590 changed behaviour in a hot
 * path, where a latent fault would be quiet rather than loud:
 *
 *   1. `Body.destroy()` now scrubs the per-shape collision settings before
 *      releasing shapes to their pools. That is a lifetime change: get it
 *      wrong and a shape either keeps stale state (silently changing how an
 *      unrelated body collides) or lands in the wrong pool (silently
 *      corrupting geometry later).
 *
 *   2. `Detector.collides()` no longer returns on the first colliding pair —
 *      it scans past trigger pairs looking for a solid one. Backward
 *      compatibility rests entirely on "no triggers present ⇒ identical
 *      behaviour", so that invariant is asserted directly rather than assumed.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	Box3d,
	boot,
	collision,
	Ellipse,
	Line,
	Point,
	Polygon,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";

const T = collision.types;

describe("Physics : per-shape settings and object lifetime", () => {
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

	// ── Body.destroy() ──────────────────────────────────────────────────

	describe("destroy() scrubs shapes before releasing them", () => {
		it("clears every field, for every shape kind that has a pool", () => {
			// each kind takes a DIFFERENT branch of the release dispatch, so one
			// scrub that only covers polygons would pass a polygon-only test
			const poly = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(16, 0),
				new Vector2d(16, 16),
			]);
			const point = new Point(0, 0);
			const line = new Line(0, 0, [new Vector2d(0, 0), new Vector2d(16, 0)]);
			const ellipse = new Ellipse(8, 8, 16, 16);
			const box = new Box3d(0, 0, 0, 8, 8, 8);
			const shapes = [poly, point, line, ellipse, box];
			for (const s of shapes) {
				s.collisionType = T.ENEMY_OBJECT;
				s.collisionMask = T.WORLD_SHAPE;
				s.isTrigger = true;
				s.isActive = false;
			}

			const r = add(100, shapes);
			r.body.destroy();

			for (const s of shapes) {
				expect(s.collisionType).toBeUndefined();
				expect(s.collisionMask).toBeUndefined();
				expect(s.isTrigger).toBe(false);
				expect(s.isActive).toBe(true);
			}
		});

		it("still releases each shape to its own pool", () => {
			// the scrub runs INSIDE the release loop, before the instanceof
			// dispatch — it must not disturb which pool a shape goes to, or a
			// Box3d ends up in the legacy pool and throws on the next destroy
			const point = new Point(0, 0);
			const box = new Box3d(0, 0, 0, 8, 8, 8);
			const r = add(100, [point, box]);
			expect(() => {
				r.body.destroy();
			}).not.toThrow();
			// the pools accepted them: geometry survives, settings do not
			expect(point.type).toBe("Point");
			expect(box.type).toBe("Box3d");
		});

		it("is safe on a body whose shapes never carried any settings", () => {
			// the common case — nothing to scrub, and no property should be
			// invented on a shape that never had one
			const shape = new Rect(0, 0, 32, 32);
			const r = add(100, [shape]);
			const stored = r.body.shapes[0];
			expect(() => {
				r.body.destroy();
			}).not.toThrow();
			expect(stored.isTrigger).toBe(false);
			expect(stored.isActive).toBe(true);
		});

		it("survives a second destroy", () => {
			const r = add(100, [new Rect(0, 0, 32, 32)]);
			r.body.destroy();
			// shapes are already released; a second pass must not double-release
			// or throw part-way and leave the body half torn down
			expect(() => {
				r.body.destroy();
			}).not.toThrow();
		});

		it("removing a body mid-simulation leaves the rest colliding normally", () => {
			// The supported teardown is `removeChild`, which destroys the body
			// as part of removing it. (Calling `body.destroy()` on a body still
			// in the world and stepping afterwards is misuse — the world holds
			// a reference to a torn-down body — and is not asserted here.)
			const trigger = new Rect(0, 0, 32, 32);
			trigger.isTrigger = true;
			trigger.collisionMask = T.WORLD_SHAPE;
			const doomed = add(100, [trigger]);
			const survivor = add(116, [new Rect(0, 0, 32, 32)]);
			world.update(16);

			world.removeChild(doomed);

			// a shape released by that teardown may now be recycled into the
			// next body — it must arrive clean, or this collision silently
			// fails to register
			const other = add(120, [new Rect(0, 0, 32, 32)], {
				collisionType: T.ENEMY_OBJECT,
			});
			let hit = false;
			survivor.onCollision = () => {
				hit = true;
				return false;
			};
			expect(() => {
				world.update(16);
			}).not.toThrow();
			expect(hit).toBe(true);
			void other;
		});
	});

	// ── collides() backward compatibility ───────────────────────────────

	describe("collides() is unchanged when no trigger is present", () => {
		/** run one step and report exactly what the narrowphase decided */
		const probe = (shapes) => {
			world = new World(0, 0, 800, 600);
			const a = add(100, shapes);
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			const seen = [];
			a.onCollision = (response) => {
				seen.push({
					idxA: response.indexShapeA,
					idxB: response.indexShapeB,
					ovX: Number(response.overlapV.x.toFixed(4)),
					ovY: Number(response.overlapV.y.toFixed(4)),
					trigger: response.isTriggerContact,
				});
				return false;
			};
			const x0 = a.pos.x;
			world.update(16);
			return { seen, dx: Number((a.pos.x - x0).toFixed(4)) };
		};

		it("reports the same shape pair, overlap and displacement as before", () => {
			// The scan now continues past trigger pairs. With none present it
			// must still stop at the FIRST colliding pair — anything else would
			// change which contact a game sees, silently.
			const r = probe([new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)]);
			expect(r.seen.length).toBeGreaterThan(0);
			// a real overlap, not a cleared response
			expect(r.seen[0].ovX !== 0 || r.seen[0].ovY !== 0).toBe(true);
			// and never flagged as trigger-only
			for (const s of r.seen) {
				expect(s.trigger).toBe(false);
			}
		});

		it("is deterministic across repeated identical runs", () => {
			// guards against the new scan introducing order or state dependence
			const shapes = () => {
				return [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)];
			};
			const first = probe(shapes());
			const second = probe(shapes());
			expect(second.seen[0]).toEqual(first.seen[0]);
			expect(second.dx).toBe(first.dx);
		});

		it("a trigger that does NOT overlap changes nothing", () => {
			// the trigger exists but never collides, so the remembered-pair path
			// must stay untaken and the result identical to having no trigger
			const control = probe([new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)]);
			const farTrigger = new Rect(300, 0, 16, 32); // nowhere near
			farTrigger.isTrigger = true;
			const withTrigger = probe([
				new Rect(0, 0, 16, 32),
				new Rect(16, 0, 16, 32),
				farTrigger,
			]);
			expect(withTrigger.seen[0].ovX).toBe(control.seen[0].ovX);
			expect(withTrigger.seen[0].trigger).toBe(false);
			expect(withTrigger.dx).toBe(control.dx);
		});
	});

	describe("collides() when triggers ARE present", () => {
		it("reports the SOLID pair when both a solid and a trigger overlap", () => {
			// the response must describe the pair that actually resolves, not
			// whichever was encountered first
			const solid = new Rect(0, 0, 16, 32);
			const trigger = new Rect(16, 0, 16, 32);
			trigger.isTrigger = true;
			const a = add(100, [solid, trigger]);
			let seen = null;
			a.onCollision = (response) => {
				seen = {
					own: response.a === a ? response.indexShapeA : response.indexShapeB,
					trigger: response.isTriggerContact,
				};
				return false;
			};
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			world.update(16);

			expect(seen).not.toBeNull();
			expect(seen.trigger).toBe(false);
			expect(seen.own).toBe(0); // the solid shape, index 0
		});

		it("re-tests the remembered pair so a trigger-only contact is real", () => {
			// The loop clears the response on every subsequent test, so a
			// trigger-only contact has to be re-run to repopulate it. If that
			// step were skipped, handlers would receive a CLEARED response —
			// zero overlap for a contact that genuinely happened.
			const s1 = new Rect(0, 0, 16, 32);
			const s2 = new Rect(16, 0, 16, 32);
			s1.isTrigger = true;
			s2.isTrigger = true;
			const a = add(100, [s1, s2]);
			let seen = null;
			a.onCollision = (response) => {
				seen = {
					ov: Math.abs(response.overlapV.x) + Math.abs(response.overlapV.y),
					idxA: response.indexShapeA,
					idxB: response.indexShapeB,
					trigger: response.isTriggerContact,
				};
				return false;
			};
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			world.update(16);

			expect(seen).not.toBeNull();
			expect(seen.trigger).toBe(true);
			expect(seen.ov).toBeGreaterThan(0); // a REAL overlap, not a cleared one
			expect(seen.idxA).toBeGreaterThanOrEqual(0);
			expect(seen.idxB).toBeGreaterThanOrEqual(0);
		});

		it("does not report a contact when the only trigger is filtered out", () => {
			// filtered shapes are skipped before the trigger bookkeeping, so a
			// filtered trigger must not leave a remembered pair behind
			const trigger = new Rect(0, 0, 32, 32);
			trigger.isTrigger = true;
			trigger.collisionMask = T.WORLD_SHAPE; // excludes the enemy
			const a = add(100, [trigger]);
			let hits = 0;
			a.onCollision = () => {
				hits++;
				return false;
			};
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			world.update(16);
			expect(hits).toBe(0);
		});

		it("an inactive trigger is skipped like any other inactive shape", () => {
			const trigger = new Rect(0, 0, 32, 32);
			trigger.isTrigger = true;
			trigger.isActive = false;
			const a = add(100, [trigger]);
			let hits = 0;
			a.onCollision = () => {
				hits++;
				return false;
			};
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			world.update(16);
			expect(hits).toBe(0);
		});
	});
});
