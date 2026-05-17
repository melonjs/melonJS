/**
 * Adversarial coverage for the PhysicsAdapter abstraction.
 *
 * Every test here tries to break the equivalence between the legacy
 * Body/World API and the new adapter API. If the two APIs ever observe
 * different state after the same sequence of operations, this is where
 * we'd catch it — not in the next release, with users hitting it.
 *
 * Categories:
 *  - API equivalence under interleaving
 *  - Double-registration / re-registration
 *  - Removing bodies that were never added
 *  - Adapter swap rejection (no runtime swap)
 *  - Empty / pathological BodyDefinitions
 *  - Persistent bodies across world.reset
 *  - Gravity mutation via both APIs
 *  - syncFromPhysics is idempotent
 *  - Boundary cases on velocity/impulse math
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Body,
	BuiltinAdapter,
	boot,
	collision,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";

describe("Physics : BuiltinAdapter (adversarial)", () => {
	/** @type {World} */
	let world;
	/** @type {BuiltinAdapter} */
	let adapter;

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
		adapter = world.adapter;
	});

	describe("API equivalence — same end state from both APIs", () => {
		it("setting velocity via property == setting via adapter", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			adapter.addBody(r1, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			r1.body.vel.set(3, 4);

			const r2 = new Renderable(0, 0, 32, 32);
			adapter.addBody(r2, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.setVelocity(r2, new Vector2d(3, 4));

			expect(adapter.getVelocity(r1).x).toEqual(adapter.getVelocity(r2).x);
			expect(adapter.getVelocity(r1).y).toEqual(adapter.getVelocity(r2).y);
			expect(r1.body.vel.x).toEqual(r2.body.vel.x);
		});

		it("setting isStatic via property == setting via def.type", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			adapter.addBody(r1, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			r1.body.setStatic(true);

			const r2 = new Renderable(0, 0, 32, 32);
			adapter.addBody(r2, {
				type: "static",
				shapes: [new Rect(0, 0, 32, 32)],
			});

			expect(r1.body.isStatic).toEqual(r2.body.isStatic);
		});

		it("force accumulation via property == accumulation via applyForce", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			adapter.addBody(r1, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			r1.body.force.x += 10;
			r1.body.force.y += 5;

			const r2 = new Renderable(0, 0, 32, 32);
			adapter.addBody(r2, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.applyForce(r2, new Vector2d(10, 5));

			expect(r1.body.force.x).toEqual(r2.body.force.x);
			expect(r1.body.force.y).toEqual(r2.body.force.y);
		});

		it("teleport via pos.set == teleport via adapter.setPosition", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			adapter.addBody(r1, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			r1.pos.x = 50;
			r1.pos.y = 60;

			const r2 = new Renderable(0, 0, 32, 32);
			adapter.addBody(r2, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.setPosition(r2, new Vector2d(50, 60));

			expect(r1.pos.x).toEqual(r2.pos.x);
			expect(r1.pos.y).toEqual(r2.pos.y);
		});
	});

	describe("registration path: pick one per body", () => {
		it("addBody throws if the renderable is already adapter-managed", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			expect(() => {
				adapter.addBody(r, {
					type: "dynamic",
					shapes: [new Rect(0, 0, 16, 16)],
				});
			}).toThrow(/already adapter-managed/);
		});

		it("removeBody + re-addBody is legal (cycle)", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.removeBody(r);
			expect(() => {
				adapter.addBody(r, {
					type: "static",
					shapes: [new Rect(0, 0, 16, 16)],
				});
			}).not.toThrow();
			expect(adapter.bodies.size).toEqual(1);
			expect(r.body.isStatic).toEqual(true);
		});

		it("legacy bridge: addBody after `new Body(...)` registers the existing instance", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.body = new Body(r, [new Rect(0, 0, 32, 32)]);
			const before = r.body;
			expect(adapter.bodies.size).toEqual(0); // not yet registered
			adapter.addBody(r, { type: "static", shapes: [] });
			expect(r.body).toBe(before); // not replaced
			expect(adapter.bodies.size).toEqual(1);
			expect(r.body.isStatic).toEqual(true); // def applied to existing
		});

		it("legacy bridge: def.shapes replaces existing shapes when non-empty", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.body = new Body(r, [new Rect(0, 0, 100, 100)]);
			const originalFirstShape = r.body.shapes[0];
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32), new Rect(32, 0, 16, 16)],
			});
			// shapes array was cleared and re-populated with the def's shapes
			expect(r.body.shapes.length).toEqual(2);
			expect(r.body.shapes[0]).not.toBe(originalFirstShape);
		});

		it("legacy bridge: empty def.shapes preserves existing shapes", () => {
			const r = new Renderable(0, 0, 32, 32);
			const originalShape = new Rect(0, 0, 100, 100);
			r.body = new Body(r, [originalShape]);
			const originalFirstShape = r.body.shapes[0];
			adapter.addBody(r, { type: "static", shapes: [] });
			expect(r.body.shapes.length).toEqual(1);
			// same Polygon instance still in place (not replaced)
			expect(r.body.shapes[0]).toBe(originalFirstShape);
		});

		it("legacy bridge: def fields override the existing body's properties", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.body = new Body(r, [new Rect(0, 0, 32, 32)]);
			r.body.bounce = 0.1;
			r.body.mass = 1;
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [],
				restitution: 0.9,
				density: 5,
			});
			expect(r.body.bounce).toEqual(0.9);
			expect(r.body.mass).toEqual(5);
		});
	});

	describe("removeBody — robustness", () => {
		it("removing a renderable that was never added is a no-op", () => {
			const r = new Renderable(0, 0, 32, 32);
			expect(() => {
				adapter.removeBody(r);
			}).not.toThrow();
			expect(adapter.bodies.size).toEqual(0);
		});

		it("removing the same body twice is a no-op the second time", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.removeBody(r);
			expect(adapter.bodies.size).toEqual(0);
			adapter.removeBody(r); // already gone
			expect(adapter.bodies.size).toEqual(0);
		});

		it("removing a body via world.removeBody after adapter.addBody works", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			world.removeBody(r.body);
			expect(adapter.bodies.size).toEqual(0);
		});
	});

	describe("pathological BodyDefinition", () => {
		it("type: static + shapes: [] still creates and registers a body", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, { type: "static", shapes: [] });
			expect(body).toBeInstanceOf(Body);
			expect(body.shapes.length).toEqual(0);
			expect(body.isStatic).toEqual(true);
			expect(adapter.bodies.size).toEqual(1);
		});

		it("density of 0 sets mass to 0 (impulse is then a no-op)", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				density: 0,
			});
			expect(body.mass).toEqual(0);
			adapter.applyImpulse(r, new Vector2d(100, 100));
			expect(body.vel.x).toEqual(0);
			expect(body.vel.y).toEqual(0);
		});

		it("restitution = 1 + bounce property are equivalent", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			const b1 = adapter.addBody(r1, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				restitution: 1,
			});
			const r2 = new Renderable(0, 0, 32, 32);
			const b2 = adapter.addBody(r2, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			b2.bounce = 1;
			expect(b1.bounce).toEqual(b2.bounce);
		});

		it("negative density is preserved (engine doesn't validate)", () => {
			// document current behavior — Body doesn't validate mass.
			// If the engine ever adds validation, this test catches that.
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				density: -1,
			});
			expect(body.mass).toEqual(-1);
		});

		it("very large velocity is clamped by body.maxVel under simulation", () => {
			// This is BuiltinAdapter-specific behavior (maxVel clamping).
			// MatterAdapter has no equivalent; document the divergence in docs.
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			body.setMaxVelocity(10, 20);
			body.vel.set(1e6, 1e6);
			expect(body.vel.x).toEqual(1e6); // before update, raw value is preserved
			// `body.update(dt)` clamps `vel` against `maxVel` per axis
			body.update(16);
			expect(Math.abs(body.vel.x)).toBeLessThanOrEqual(body.maxVel.x);
			expect(Math.abs(body.vel.y)).toBeLessThanOrEqual(body.maxVel.y);
		});
	});

	describe("gravity mutation through both APIs", () => {
		it("mutating adapter.gravity is visible via world.gravity", () => {
			adapter.gravity.set(0, 1.0);
			expect(world.gravity.y).toEqual(1.0);
		});

		it("setting adapter.gravity to a new Vector2d updates world.gravity", () => {
			adapter.gravity = new Vector2d(0, 2);
			expect(world.gravity.y).toEqual(2);
			expect(world.gravity).toBe(adapter.gravity);
		});

		it("mutating world.gravity is visible via adapter.gravity", () => {
			world.gravity.set(1, 9.8);
			expect(adapter.gravity.x).toEqual(1);
			expect(adapter.gravity.y).toEqual(9.8);
		});
	});

	describe("persistent bodies across world.reset", () => {
		it("persistent body added via adapter survives reset", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.isPersistent = true;
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			expect(adapter.bodies.size).toEqual(1);
			world.reset();
			expect(adapter.bodies.size).toEqual(1);
			expect(adapter.bodies.has(r.body)).toEqual(true);
		});

		it("mixed persistent + transient: only persistent survives", () => {
			const persistent = new Renderable(0, 0, 32, 32);
			persistent.isPersistent = true;
			adapter.addBody(persistent, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});

			const transient = new Renderable(0, 0, 32, 32);
			adapter.addBody(transient, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});

			world.reset();
			expect(adapter.bodies.size).toEqual(1);
			expect(adapter.bodies.has(persistent.body)).toEqual(true);
			expect(adapter.bodies.has(transient.body)).toEqual(false);
		});
	});

	describe("collision filter bits — engine-portable", () => {
		it("collisionType in def maps to body.collisionType", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				collisionType: collision.types.NPC_OBJECT,
			});
			expect(body.collisionType).toEqual(collision.types.NPC_OBJECT);
		});

		it("collisionMask in def maps to body.collisionMask", () => {
			const r = new Renderable(0, 0, 32, 32);
			const mask =
				collision.types.PLAYER_OBJECT | collision.types.COLLECTABLE_OBJECT;
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				collisionMask: mask,
			});
			expect(body.collisionMask).toEqual(mask);
		});

		it("omitting filter fields uses Body defaults (no override)", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.body = new Body(r, [new Rect(0, 0, 32, 32)]);
			r.body.collisionType = collision.types.PLAYER_OBJECT;
			r.body.collisionMask = collision.types.ENEMY_OBJECT;
			adapter.addBody(r, { type: "dynamic", shapes: [] });
			// no override → original values preserved
			expect(r.body.collisionType).toEqual(collision.types.PLAYER_OBJECT);
			expect(r.body.collisionMask).toEqual(collision.types.ENEMY_OBJECT);
		});
	});

	describe("syncFromPhysics is idempotent", () => {
		it("calling syncFromPhysics any number of times has no effect", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			r.pos.x = 100;
			r.pos.y = 200;
			adapter.syncFromPhysics();
			adapter.syncFromPhysics();
			adapter.syncFromPhysics();
			// BuiltinAdapter.syncFromPhysics is a no-op — position unchanged
			expect(r.pos.x).toEqual(100);
			expect(r.pos.y).toEqual(200);
		});
	});

	describe("velocity / impulse boundary math", () => {
		it("zero impulse leaves velocity unchanged", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			r.body.vel.set(3, 4);
			adapter.applyImpulse(r, new Vector2d(0, 0));
			expect(r.body.vel.x).toEqual(3);
			expect(r.body.vel.y).toEqual(4);
		});

		it("negative impulse on a moving body reduces velocity", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				density: 1,
			});
			r.body.vel.set(10, 0);
			adapter.applyImpulse(r, new Vector2d(-5, 0));
			expect(r.body.vel.x).toEqual(5);
		});

		it("multiple applyForce calls accumulate (no per-frame reset)", () => {
			// Force is only cleared at the end of adapter.step. Within a
			// frame, repeated applyForce calls accumulate. This matches
			// box2d-style usage.
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.applyForce(r, new Vector2d(1, 0));
			adapter.applyForce(r, new Vector2d(2, 0));
			adapter.applyForce(r, new Vector2d(3, 0));
			expect(r.body.force.x).toEqual(6);
		});

		it("Quirk #1: applyForce silently drops the optional `point` arg", () => {
			// Matter / Box2D adapters use the point for off-center force
			// application (producing torque). Builtin has no rotational
			// dynamics, so the point is ignored — same end-state whether
			// the force is applied at the centroid, an off-center point,
			// or with no point at all.
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const force = new Vector2d(0.5, 0);
			const centerPoint = new Vector2d(16, 16);
			const offCenterPoint = new Vector2d(100, 200);

			adapter.applyForce(r, force);
			const noPoint = r.body.force.x;
			r.body.force.set(0, 0);

			adapter.applyForce(r, force, centerPoint);
			const atCenter = r.body.force.x;
			r.body.force.set(0, 0);

			adapter.applyForce(r, force, offCenterPoint);
			const atOffCenter = r.body.force.x;

			expect(atCenter).toEqual(noPoint);
			expect(atOffCenter).toEqual(noPoint);
			// no rotational state was introduced
			expect(r.currentTransform.tx).toEqual(0);
			expect(r.currentTransform.ty).toEqual(0);
		});
	});

	describe("explicit adapter via World constructor", () => {
		it("uses the supplied adapter instead of constructing a new one", () => {
			const custom = new BuiltinAdapter({ gravity: new Vector2d(0, 5) });
			const w = new World(0, 0, 800, 600, custom);
			expect(w.adapter).toBe(custom);
			expect(w.gravity.y).toEqual(5);
		});

		it("init was called: detector is set", () => {
			const custom = new BuiltinAdapter();
			expect(custom.detector).toBeUndefined();
			const w = new World(0, 0, 800, 600, custom);
			expect(custom.detector).toBeDefined();
			expect(custom.world).toBe(w);
		});

		it("supplying undefined falls back to a fresh BuiltinAdapter", () => {
			const w = new World(0, 0, 800, 600, undefined);
			expect(w.adapter).toBeInstanceOf(BuiltinAdapter);
		});
	});

	describe("bodies Set mutation during step", () => {
		/**
		 * `BuiltinAdapter.step` iterates `this.bodies` with a `for..of`
		 * loop. The Set spec defines what happens when entries are
		 * added/removed mid-iteration:
		 *  - entries added after iteration started ARE visited
		 *  - entries deleted before they're visited are SKIPPED
		 *
		 * These tests pin that behavior so a future iterator change
		 * (e.g. snapshotting to an Array, or a deferred mutation queue)
		 * doesn't silently break user code that relies on it.
		 */

		// Force each body to have an inViewport-style ancestor so step()
		// actually visits them (otherwise the `ancestor.inViewport` guard
		// short-circuits the body).
		const visibleRenderable = () => {
			const r = new Renderable(0, 0, 32, 32);
			r.alwaysUpdate = true;
			return r;
		};

		it("a body removed before being visited is skipped", () => {
			const visited = [];
			const r1 = visibleRenderable();
			const r2 = visibleRenderable();
			const r3 = visibleRenderable();
			adapter.addBody(r1, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.addBody(r2, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.addBody(r3, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});

			// Wrap each body.update to record visitation order and have
			// r1's update remove r3 before iteration reaches it.
			[r1, r2, r3].forEach((r, i) => {
				const tag = `r${i + 1}`;
				const original = r.body.update.bind(r.body);
				r.body.update = (dt) => {
					visited.push(tag);
					if (tag === "r1") {
						adapter.removeBody(r3);
					}
					return original(dt);
				};
			});

			adapter.step(16);
			expect(visited).toEqual(["r1", "r2"]);
			expect(adapter.bodies.has(r3.body)).toEqual(false);
		});

		it("a body added during iteration IS visited in the same step", () => {
			const visited = [];
			const r1 = visibleRenderable();
			const r2 = visibleRenderable();
			adapter.addBody(r1, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.addBody(r2, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});

			const r3 = visibleRenderable();
			const r3Body = new Body(r3, [new Rect(0, 0, 32, 32)]);
			r3.body = r3Body;
			r3Body.update = () => {
				visited.push("r3");
				return false;
			};

			const originalR1 = r1.body.update.bind(r1.body);
			r1.body.update = (dt) => {
				visited.push("r1");
				// add r3 mid-iteration
				adapter.bodies.add(r3Body);
				return originalR1(dt);
			};
			const originalR2 = r2.body.update.bind(r2.body);
			r2.body.update = (dt) => {
				visited.push("r2");
				return originalR2(dt);
			};

			adapter.step(16);
			expect(visited).toEqual(["r1", "r2", "r3"]);
		});

		it("clearing bodies during iteration stops further visits", () => {
			const visited = [];
			const r1 = visibleRenderable();
			const r2 = visibleRenderable();
			const r3 = visibleRenderable();
			[r1, r2, r3].forEach((r) => {
				adapter.addBody(r, {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
			});

			[r1, r2, r3].forEach((r, i) => {
				const tag = `r${i + 1}`;
				const original = r.body.update.bind(r.body);
				r.body.update = (dt) => {
					visited.push(tag);
					if (tag === "r1") {
						adapter.bodies.clear();
					}
					return original(dt);
				};
			});

			adapter.step(16);
			expect(visited).toEqual(["r1"]);
		});
	});

	describe("getVelocity output vector", () => {
		it("allocates a new Vector2d when no out is provided", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			r.body.vel.set(1, 2);
			const v1 = adapter.getVelocity(r);
			const v2 = adapter.getVelocity(r);
			expect(v1).not.toBe(v2); // different instances
			expect(v1.x).toEqual(v2.x);
		});

		it("returns the same instance when an out is provided", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const out = new Vector2d();
			expect(adapter.getVelocity(r, out)).toBe(out);
		});

		it("mutating the returned vector does NOT alter body.vel (defensive copy)", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			r.body.vel.set(5, 6);
			const v = adapter.getVelocity(r);
			v.set(99, 99);
			expect(r.body.vel.x).toEqual(5);
			expect(r.body.vel.y).toEqual(6);
		});
	});

	// Bug-hunting scenarios exercising the body-level helpers through the
	// integration + collision loop. These don't assert against the helper
	// surface (that's body.spec.js); they look for cases where the SAT
	// detector + Body integration produce surprising end-state when the
	// helpers compose with bouncing, push-back, and state toggles.
	describe("body helpers under integration: bouncing + push-back", () => {
		// builtin step() skips bodies whose ancestor is `!inViewport &&
		// !alwaysUpdate` — these unit-level tests don't run inside a real
		// viewport, so we opt into always-update.
		//
		// `detector.collisions()` looks up candidates via the world's
		// broadphase, which is populated by `world.addChild`. Bodies added
		// via `adapter.addBody` alone are *not* in the broadphase and
		// won't be returned as collision candidates, so we use `bodyDef +
		// addChild` here (the same auto-registration path real game code
		// uses).
		const addDynamic = (x, y, def) => {
			const r = new Renderable(x, y, 32, 32);
			r.alwaysUpdate = true;
			r.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)], ...def };
			world.addChild(r);
			return r;
		};
		const addStatic = (x, y, w, h, def) => {
			const r = new Renderable(x, y, w, h);
			r.alwaysUpdate = true;
			r.bodyDef = { type: "static", shapes: [new Rect(0, 0, w, h)], ...def };
			world.addChild(r);
			return r;
		};

		it("dynamic body lands on a static floor and stops (push-back works for static)", () => {
			// Body starts slightly overlapping the floor so SAT detects
			// overlap on the very first step. Using a small downward
			// velocity (no impulse) keeps the body from tunneling.
			const r = addDynamic(100, 130, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.WORLD_SHAPE,
			});
			addStatic(0, 140, 800, 20, {
				collisionType: collision.types.WORLD_SHAPE,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			r.body.setVelocity(0, 4);
			world.update(16);
			world.update(16);
			// SAT push-out separates the bodies and cancels the in-surface
			// velocity component. Final body bottom must be at or above
			// floor top (140) — no tunneling.
			expect(r.pos.y + 32).toBeLessThanOrEqual(140 + 0.5);
			expect(r.body.vel.y).toBeLessThanOrEqual(0);
		});

		it("equal-mass dynamic pair: stationary body stays put; moving body's vel decays asymptotically", () => {
			// The builtin SAT detector does mass-proportional push-out
			// per call (detector.js + Body.respondToCollision), but the
			// outer-loop iterates each non-static body once, so push-out
			// fires twice per pair. With equal masses, the second pass
			// effectively un-does the first body's positional shift —
			// the stationary body never visibly moves, and the moving
			// body's velocity is halved each frame (the normal-component
			// cancellation runs from both calls).
			//
			// This is acceptable for typical platformer play (player +
			// enemies are dynamic, world geometry is static — collisions
			// between two dynamics are rare and don't need Newtonian
			// elastic response). For billiards-style dyn-dyn elastic
			// collisions, use the matter adapter.
			const a = addDynamic(100, 100, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			const b = addDynamic(124, 100, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			a.body.setVelocity(5, 0);
			world.update(16);
			// stationary body did not move
			expect(b.pos.x).toEqual(124);
			expect(b.body.vel.x).toEqual(0);
			// moving body integrated forward and had its vel halved
			expect(a.body.vel.x).toBeCloseTo(2.5, 5);
		});

		it("asymmetric-mass dynamic pair: light is pushed back, heavy barely moves", () => {
			// Push-out scales by `other.mass / total_mass`. A light body
			// hitting a heavy one experiences a large positional
			// correction; the heavy body experiences a tiny one.
			const light = addDynamic(100, 100, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			light.body.mass = 1;
			const heavy = addDynamic(124, 100, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			heavy.body.mass = 10;
			light.body.setVelocity(5, 0);
			world.update(16);
			// light was pushed back from its post-integration spot — its
			// final X is *less* than its starting X (it backed up further
			// than it moved forward).
			expect(light.pos.x).toBeLessThan(100);
			// heavy was nudged slightly but only by a small fraction
			expect(heavy.pos.x).toBeLessThan(124);
			expect(124 - heavy.pos.x).toBeLessThan(2);
			// magnitude check: light moved at least 4× more than heavy
			expect(100 - light.pos.x).toBeGreaterThan(4 * (124 - heavy.pos.x));
		});

		it("Quirk #6: collision callbacks fire INLINE during step — handler-side vel mutation on a peer is integrated within the same step", () => {
			// Builtin's `BuiltinAdapter.step` interleaves
			//   integrate(body N) → dispatch(body N) → integrate(body N+1) → dispatch(body N+1)
			// for every body in the iteration order. So a handler dispatched
			// during body N's iter that mutates body N+1's `vel` is visible
			// when N+1 integrates *in the same step*.
			//
			// Matter dispatches all collision events AFTER its world step
			// completes — the same handler-side mutation wouldn't affect
			// any body's integration for the step that fired the event.
			//
			// We isolate the ordering signal by making A a sensor (no
			// push-out perturbing B's pos) and having A's handler write a
			// known velocity to B. B's post-step position must reflect
			// that vel having driven integration.
			// A must be DYNAMIC for `BuiltinAdapter.step` to iterate it
			// (static bodies are skipped in the outer loop). Making it a
			// sensor keeps it from being pushed back by B and lets us
			// isolate the handler-mutation effect on B.
			const a = addDynamic(100, 100, {
				gravityScale: 0,
				isSensor: true,
				collisionType: collision.types.ACTION_OBJECT,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			a.onCollision = (_response, other) => {
				// inline mutation: set B's velocity. If dispatch were
				// after-step, B would have already integrated with vel=0
				// for this frame and this write wouldn't move anything
				// until next frame.
				other.body.vel.x = 50;
				return false;
			};
			const b = addDynamic(110, 100, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.ACTION_OBJECT,
			});
			const startBX = b.pos.x;
			expect(b.body.vel.x).toEqual(0);
			world.update(16);
			// B integrated AFTER A's handler set vel.x = 50, so B moved
			// forward by ~50 px in this single step. (timer.tick scaling
			// applies, but the magnitude is unmistakably larger than the
			// vel=0 it started with.)
			expect(b.pos.x - startBX).toBeGreaterThan(40);
		});

		it("dyn-dyn collision does NOT transfer velocity (no Newtonian momentum exchange)", () => {
			// Heavy body moves into a stationary light body. Position-wise
			// the light body is shoved aside, but it gains no velocity —
			// the push-out only mutates `vel` via the normal-component
			// cancellation, which never *adds* velocity, only subtracts.
			// Game code that wants impacted bodies to inherit motion needs
			// either matter-adapter or manual handling in onCollisionStart.
			const heavy = addDynamic(100, 100, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			heavy.body.mass = 10;
			const light = addDynamic(124, 100, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			light.body.mass = 1;
			heavy.body.setVelocity(5, 0);
			world.update(16);
			// light got pushed (position moved forward)
			expect(light.pos.x).toBeGreaterThan(124);
			// but light has zero velocity — no momentum transfer
			expect(light.body.vel.x).toEqual(0);
		});

		it("setStatic(true) on a moving body freezes both velocity and position", () => {
			const r = addDynamic(100, 100, { gravityScale: 0 });
			r.body.applyImpulse(10, 0);
			expect(r.body.vel.x).toBeGreaterThan(0);
			r.body.setStatic(true);
			const startX = r.pos.x;
			world.update(16);
			world.update(16);
			world.update(16);
			// static body must not integrate position even with stale vel
			expect(r.pos.x).toEqual(startX);
		});

		it("setSensor(true) on a colliding body lets it overlap without push-out", () => {
			// Trigger / pickup pattern: sensor body overlapping a dynamic
			// one fires events but doesn't separate. We just probe the
			// position outcome here — the dynamic body should keep moving
			// through the sensor area, not bounce off it.
			addStatic(120, 100, 32, 32, {
				collisionType: collision.types.ACTION_OBJECT,
				collisionMask: collision.types.PLAYER_OBJECT,
				isSensor: true,
			});
			const r = addDynamic(100, 100, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.ACTION_OBJECT,
			});
			r.body.setVelocity(2, 0);
			const startX = r.pos.x;
			world.update(16);
			world.update(16);
			// no push-back from the sensor — body moved forward
			expect(r.pos.x).toBeGreaterThan(startX);
		});

		it("bouncing: restitution > 0 reverses Y velocity component on floor contact", () => {
			// Bug-hunt: verify the Body.respondToCollision bounce branch
			// (body.js:565) actually fires when push-out runs through it
			// from the matter-aligned default path. Body starts already
			// overlapping the floor so SAT detects the contact on step 1,
			// dispatches push-out via respondToCollision, and applies the
			// bounce factor to the in-surface velocity component.
			// Body at y=110 → bottom=142. Floor at y=140 (top=140). Small
			// penetration of 2px ensures SAT chooses "push UP" as the
			// minimum-overlap escape — deeper penetration would flip to
			// "push DOWN out the bottom" and produce surprising results.
			const r = addDynamic(100, 110, {
				gravityScale: 0,
				restitution: 0.5,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.WORLD_SHAPE,
			});
			addStatic(0, 140, 800, 20, {
				collisionType: collision.types.WORLD_SHAPE,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			r.body.setVelocity(0, 8);
			world.update(16);
			// after contact: vel.y reversed (negative) and dampened by 1+bounce
			expect(r.body.vel.y).toBeLessThan(0);
			expect(Math.abs(r.body.vel.y)).toBeLessThan(8);
		});

		it("restitution = 0 absorbs the collision — vel.y goes to 0 on floor contact", () => {
			const r = addDynamic(100, 110, {
				gravityScale: 0,
				restitution: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.WORLD_SHAPE,
			});
			addStatic(0, 140, 800, 20, {
				collisionType: collision.types.WORLD_SHAPE,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			r.body.setVelocity(0, 8);
			world.update(16);
			// with no bounce, normal-component vel is killed (resting contact)
			expect(r.body.vel.y).toBeLessThanOrEqual(0);
			expect(Math.abs(r.body.vel.y)).toBeLessThanOrEqual(1);
		});

		it("setCollisionMask = NO_OBJECT mid-simulation drops further contacts", () => {
			// "Pickup" / "death" pattern: an entity flips its mask to
			// NO_OBJECT mid-step so the other body passes through on the
			// next frame, even if they're still overlapping.
			const a = addDynamic(100, 100, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.ENEMY_OBJECT,
			});
			const b = addDynamic(125, 100, {
				gravityScale: 0,
				collisionType: collision.types.ENEMY_OBJECT,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			// drop b out of the filter — a should now see it as NO_OBJECT
			b.body.setCollisionMask(collision.types.NO_OBJECT);
			b.body.setCollisionType(collision.types.NO_OBJECT);
			a.body.setVelocity(5, 0);
			const startX = a.pos.x;
			world.update(16);
			// a should keep advancing freely, no push-back from b
			expect(a.pos.x).toBeGreaterThan(startX);
		});

		it("applyImpulse + applyForce in the same frame both contribute", () => {
			// Impulse is integrated immediately (vel += J/m); force is
			// accumulated for end-of-step integration. Both should affect
			// the next step's velocity.
			const r = addDynamic(0, 0, { gravityScale: 0, density: 1 });
			const startVelX = r.body.vel.x;
			r.body.applyImpulse(2, 0);
			const afterImpulseVelX = r.body.vel.x;
			expect(afterImpulseVelX).toBeGreaterThan(startVelX);
			r.body.applyForce(3, 0);
			// force is staged but not yet integrated until the step runs
			expect(r.body.force.x).toEqual(3);
			world.update(16);
			// after step: vel reflects the impulse AND the force integration
			expect(r.body.vel.x).toBeGreaterThan(afterImpulseVelX);
		});

		it("high-velocity downward motion tunnels through a thin static (no CCD)", () => {
			// Gap: probes the tunneling threshold. SAT push-out is
			// discrete — a body moving fast enough to clear a thin static
			// in a single step passes through. This locks in the safe-
			// range expectation for game tuning: keep `vel.y * step_dt`
			// below the thinnest static's height.
			const r = addDynamic(100, 100, {
				gravityScale: 0,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.WORLD_SHAPE,
			});
			// 4-px thin floor at y=140 (one-way platform-style thickness)
			addStatic(0, 140, 800, 4, {
				collisionType: collision.types.WORLD_SHAPE,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			// vel.y = 50 px/frame: body moves 50 in one step. Body bottom
			// goes from 132 to 182, clean past the floor's 140-144 band.
			r.body.setVelocity(0, 50);
			world.update(16);
			expect(r.pos.y).toBeGreaterThan(140); // body fell THROUGH the floor
		});

		it("restitution > 1 amplifies the rebound (energy gain — not clamped)", () => {
			// Documents that Builtin doesn't clamp restitution to ≤ 1.
			// A value > 1 produces a faster rebound than the impact —
			// physically unrealistic but useful for arcadey "super-bounce"
			// pickups. Worth pinning down so a future "fix" that clamps
			// doesn't silently break game-feel.
			const r = addDynamic(100, 110, {
				gravityScale: 0,
				restitution: 1.5,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.WORLD_SHAPE,
			});
			addStatic(0, 140, 800, 20, {
				collisionType: collision.types.WORLD_SHAPE,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			r.body.setVelocity(0, 8);
			world.update(16);
			// expected rebound: vel.y -= (1 + 1.5) * 8 * 1 (ratio=1, static) = vel.y - 20 = -12
			expect(r.body.vel.y).toBeLessThan(-8); // faster than the impact velocity
		});

		it("sensor-inside-sensor: both fire events, neither pushes the other", () => {
			// Gap: two sensor bodies in contact. The dispatcher should
			// fire `onCollision` on both sides (events still dispatch on
			// sensors) but `respondToCollision` must NOT run (sensor gate
			// at detector.js:387). Neither body's pos should change.
			let aFired = 0;
			let bFired = 0;
			const a = addDynamic(100, 100, {
				gravityScale: 0,
				isSensor: true,
				collisionType: collision.types.ACTION_OBJECT,
				collisionMask: collision.types.ACTION_OBJECT,
			});
			a.onCollision = () => {
				aFired++;
				return false;
			};
			const b = addDynamic(110, 100, {
				gravityScale: 0,
				isSensor: true,
				collisionType: collision.types.ACTION_OBJECT,
				collisionMask: collision.types.ACTION_OBJECT,
			});
			b.onCollision = () => {
				bFired++;
				return false;
			};
			const aStartX = a.pos.x;
			const bStartX = b.pos.x;
			world.update(16);
			// events fired on both sides
			expect(aFired).toBeGreaterThan(0);
			expect(bFired).toBeGreaterThan(0);
			// no push-out: positions unchanged
			expect(a.pos.x).toEqual(aStartX);
			expect(b.pos.x).toEqual(bStartX);
		});

		it("dyn-dyn with different masses + restitution: light bounces back (position), heavy stays put (velocity)", () => {
			// Gap: the missing combo from the recent quirk #10 work.
			// Asserts the actual observed behavior — not idealised
			// Newtonian, but what falls out of Builtin's
			// mass-proportional push-out + bounce factor:
			//
			//   - LIGHT's position is shoved back past its starting X
			//     (the bounce magnifies the push-out). Velocity drops
			//     sharply but doesn't fully reverse — see quirk #10
			//     "no momentum transfer".
			//   - HEAVY's position is nudged slightly by the per-frame
			//     push-out. Velocity stays at 0 — no momentum is
			//     transferred from the light body into the heavy one.
			const light = addDynamic(100, 100, {
				gravityScale: 0,
				restitution: 0.8,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			light.body.mass = 1;
			const heavy = addDynamic(124, 100, {
				gravityScale: 0,
				restitution: 0.8,
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.PLAYER_OBJECT,
			});
			heavy.body.mass = 10;
			light.body.setVelocity(5, 0);
			world.update(16);
			// light was bounced back: final X is less than the starting X
			expect(light.pos.x).toBeLessThan(100);
			// light's velocity was dampened (restitution + ratio cancel)
			expect(Math.abs(light.body.vel.x)).toBeLessThan(5);
			// heavy was nudged backward by the push-out, but slightly
			expect(heavy.pos.x).toBeLessThan(124);
			expect(124 - heavy.pos.x).toBeLessThan(2);
			// no momentum transfer to heavy — vel stays 0
			expect(heavy.body.vel.x).toEqual(0);
		});
	});
});
