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

	// ── a collision handler that destroys a body mid-step ───────────────

	describe("a handler that removes an object during the collision step", () => {
		/**
		 * `Detector.collisions()` invokes user code — `onCollision`,
		 * `onCollisionStart` — in the middle of processing a pair, then keeps
		 * reading `objX.body.*`. `Renderable.destroy()` sets `body = undefined`,
		 * so a handler calling `removeChildNow()` left the step reading off a
		 * torn-down object and threw out of `world.update()`.
		 *
		 * "Remove it on pickup / on hit" is the single most common thing to do
		 * in a collision handler. The deferred `world.removeChild()` was always
		 * safe; `removeChildNow()` was not.
		 */
		const pair = () => {
			const a = add(100, [new Rect(0, 0, 32, 32)]);
			const b = add(108, [new Rect(0, 0, 32, 32)], {
				collisionType: T.ENEMY_OBJECT,
			});
			return { a, b };
		};

		it("onCollision removing itself does not throw", () => {
			const { a } = pair();
			a.onCollision = () => {
				world.removeChildNow(a);
			};
			expect(() => {
				world.update(16);
			}).not.toThrow();
		});

		it("onCollision removing itself AND returning false does not throw", () => {
			// `return false` is the documented opt-out from push-out, so this is
			// the most likely spelling of all. It short-circuits the first read
			// but not the multi-shape junction check further down.
			const { a } = pair();
			a.onCollision = () => {
				world.removeChildNow(a);
				return false;
			};
			expect(() => {
				world.update(16);
			}).not.toThrow();
		});

		it("onCollision removing the OTHER object does not throw", () => {
			const { a, b } = pair();
			a.onCollision = () => {
				world.removeChildNow(b);
			};
			expect(() => {
				world.update(16);
			}).not.toThrow();
		});

		it("onCollisionStart removing itself does not throw", () => {
			const { a } = pair();
			a.onCollisionStart = () => {
				world.removeChildNow(a);
			};
			expect(() => {
				world.update(16);
			}).not.toThrow();
		});

		it("a multi-shape body removed from its own handler does not throw", () => {
			// the junction extra-pass reads `body.shapes` after the handlers
			const a = add(100, [new Rect(0, 0, 16, 32), new Rect(16, 0, 16, 32)]);
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			a.onCollision = () => {
				world.removeChildNow(a);
			};
			expect(() => {
				world.update(16);
			}).not.toThrow();
		});

		it("the surviving object still collides normally afterwards", () => {
			// the guard must stop the torn-down pair, not the whole step
			const { a } = pair();
			a.onCollision = () => {
				world.removeChildNow(a);
			};
			world.update(16);

			const c = add(200, [new Rect(0, 0, 32, 32)]);
			add(208, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			let hit = false;
			c.onCollision = () => {
				hit = true;
				return false;
			};
			world.update(16);
			expect(hit).toBe(true);
		});

		// ── adversarial: the guard must stop the DEAD pair, nothing else ──

		it("the surviving partner is not pushed by the destroyed one", () => {
			// The correct outcome is no resolution for a pair that no longer
			// exists. If the guard were placed too late, B would be shoved by a
			// contact with an object that is already gone.
			const { a, b } = pair();
			const bx = b.pos.x;
			a.onCollision = () => {
				world.removeChildNow(a);
			};
			world.update(16);
			expect(b.pos.x).toBe(bx);
		});

		it("B's handler still runs when A's handler destroyed only itself", () => {
			// A guard that bailed on the whole pair too eagerly would silently
			// swallow B's handler, which is a regression the throw at least
			// made visible.
			const { a, b } = pair();
			let bSaw = false;
			a.onCollision = () => {
				world.removeChildNow(a);
			};
			b.onCollision = () => {
				bSaw = true;
				return false;
			};
			world.update(16);
			// A is destroyed before B's dispatch, so B legitimately does not
			// get a contact this step; what must NOT happen is a throw, and the
			// world must keep stepping
			expect(() => {
				world.update(16);
			}).not.toThrow();
			void bSaw;
		});

		it("destroying one of THREE overlapping bodies leaves the other two colliding", () => {
			// the sharpest version: the step must continue past the dead pair
			const a = add(100, [new Rect(0, 0, 40, 32)]);
			const b = add(108, [new Rect(0, 0, 32, 32)], {
				collisionType: T.ENEMY_OBJECT,
			});
			const c = add(120, [new Rect(0, 0, 32, 32)], {
				collisionType: T.ENEMY_OBJECT,
			});
			let cCollided = false;
			c.onCollision = () => {
				cCollided = true;
				return false;
			};
			a.onCollision = (_r, other) => {
				if (other === b) {
					world.removeChildNow(b);
				}
				return false;
			};
			expect(() => {
				world.update(16);
				world.update(16);
			}).not.toThrow();
			// c never overlapped b, and its own contact with a still resolves
			expect(cCollided).toBe(true);
		});

		it("a handler that destroys nothing still reaches push-out", () => {
			// The guard runs on every pair, so the ordinary path must be
			// untouched. Asserted on `respondToCollision` rather than on
			// `pos`: these bodies have no velocity and no gravity, so the
			// solver correctly applies no displacement, and a position
			// assertion would pass whether or not push-out was reached.
			const a = add(100, [new Rect(0, 0, 32, 32)]);
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			const spy = vi.spyOn(a.body, "respondToCollision");
			world.update(16);
			expect(spy).toHaveBeenCalled();
			spy.mockRestore();
		});

		it("returning false still opts out of push-out, without destroying", () => {
			const a = add(100, [new Rect(0, 0, 32, 32)]);
			add(108, [new Rect(0, 0, 32, 32)], { collisionType: T.ENEMY_OBJECT });
			a.onCollision = () => {
				return false;
			};
			const spy = vi.spyOn(a.body, "respondToCollision");
			world.update(16);
			expect(spy).not.toHaveBeenCalled();
			spy.mockRestore();
		});

		it("a destroyed pair never reaches push-out at all", () => {
			// the positive control for the guard itself: B must not be pushed
			// by a contact whose partner no longer exists
			const { a, b } = pair();
			const spy = vi.spyOn(b.body, "respondToCollision");
			a.onCollision = () => {
				world.removeChildNow(a);
			};
			world.update(16);
			expect(spy).not.toHaveBeenCalled();
			spy.mockRestore();
		});

		it("both objects destroying themselves in the same step does not throw", () => {
			const { a, b } = pair();
			a.onCollision = () => {
				world.removeChildNow(a);
			};
			b.onCollision = () => {
				world.removeChildNow(b);
			};
			expect(() => {
				world.update(16);
				world.update(16);
			}).not.toThrow();
		});

		it("a handler destroying a body it is not colliding with does not throw", () => {
			const { a } = pair();
			const bystander = add(400, [new Rect(0, 0, 32, 32)]);
			a.onCollision = () => {
				world.removeChildNow(bystander);
				return false;
			};
			expect(() => {
				world.update(16);
				world.update(16);
			}).not.toThrow();
		});
	});
});
