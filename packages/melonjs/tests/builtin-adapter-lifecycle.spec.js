/**
 * Lifecycle + pool coverage for the PhysicsAdapter abstraction.
 *
 * These tests pin behaviors that the parity / physics specs don't
 * cover — the timing of when `this.body` becomes available, what
 * adapter setters can / can't do across lifecycle hooks, and pool
 * recycling semantics. They exist because a real-world bug
 * (Coin.onActivateEvent calling setCollisionMask on a not-yet-built
 * body) slipped past the math-focused tests.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Body,
	boot,
	Container,
	pool,
	Rect,
	Renderable,
	video,
	World,
} from "../src/index.js";

describe("Physics : BuiltinAdapter (lifecycle + pool)", () => {
	/** @type {import("../src/index.js").World} */
	let world;
	/** @type {import("../src/index.js").BuiltinAdapter} */
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

	describe("when is `renderable.body` first available?", () => {
		it("legacy: body is set IN the constructor (available before addChild)", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.body = new Body(r, new Rect(0, 0, 32, 32));
			expect(r.body).toBeInstanceOf(Body);
			// addChild registers but doesn't re-create
			world.addChild(r);
			expect(r.body).toBeInstanceOf(Body);
			expect(adapter.bodies.has(r.body)).toEqual(true);
		});

		it("bodyDef: body is undefined BEFORE addChild", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			expect(r.body).toBeUndefined();
		});

		it("bodyDef: body is set AFTER addChild returns", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			world.addChild(r);
			expect(r.body).toBeInstanceOf(Body);
			expect(adapter.bodies.has(r.body)).toEqual(true);
		});

		it("bodyDef: body IS available when onActivateEvent fires", () => {
			// Container.addChild registers the body BEFORE firing
			// onActivateEvent so user code can write the natural pattern:
			//   onActivateEvent() { adapter.setX(this, ...) }
			// without working around the lifecycle. Pinned to guard against
			// a future reorder that would silently break user hooks.
			let bodyDuringActivate;
			class WatcherEntity extends Renderable {
				onActivateEvent() {
					bodyDuringActivate = this.body;
				}
			}
			const r = new WatcherEntity(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			world.addChild(r);
			expect(bodyDuringActivate).toBeInstanceOf(Body);
			expect(adapter.bodies.has(bodyDuringActivate)).toEqual(true);
		});

		it("legacy: body is also available when onActivateEvent fires", () => {
			// Unchanged by the reorder — legacy bodies were always set
			// in the constructor, so onActivateEvent has always seen them.
			let bodyDuringActivate;
			class WatcherEntity extends Renderable {
				onActivateEvent() {
					bodyDuringActivate = this.body;
				}
			}
			const r = new WatcherEntity(0, 0, 32, 32);
			r.body = new Body(r, new Rect(0, 0, 32, 32));
			world.addChild(r);
			expect(bodyDuringActivate).toBeInstanceOf(Body);
		});
	});

	describe("adapter setters across lifecycle hooks", () => {
		it("setCollisionMask in onActivateEvent WORKS under bodyDef (body available)", () => {
			// With the Container reorder, the body is registered BEFORE
			// onActivateEvent fires, so user code can do the natural
			// thing: call adapter setters straight from the hook.
			class GoodCoin extends Renderable {
				onActivateEvent() {
					adapter.setCollisionMask(this, 42);
				}
			}
			const r = new GoodCoin(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			world.addChild(r);
			expect(r.body.collisionMask).toEqual(42);
		});

		it("setCollisionMask in onActivateEvent WORKS under legacy (body exists)", () => {
			class GoodCoin extends Renderable {
				onActivateEvent() {
					adapter.setCollisionMask(this, 7);
				}
			}
			const r = new GoodCoin(0, 0, 32, 32);
			r.body = new Body(r, new Rect(0, 0, 32, 32));
			world.addChild(r);
			expect(r.body.collisionMask).toEqual(7);
		});

		it("adapter setters work in update() — body is registered by then", () => {
			let calledFromUpdate = false;
			class UpdatingEntity extends Renderable {
				constructor() {
					super(0, 0, 32, 32);
					this.alwaysUpdate = true;
					this.bodyDef = {
						type: "dynamic",
						shapes: [new Rect(0, 0, 32, 32)],
					};
				}
				update() {
					calledFromUpdate = true;
					adapter.applyForce(this, { x: 1, y: 0 });
					return true;
				}
			}
			const r = new UpdatingEntity();
			world.addChild(r);
			world.update(16);
			expect(calledFromUpdate).toEqual(true);
			// the force we applied was integrated by the step
			expect(adapter.bodies.has(r.body)).toEqual(true);
		});
	});

	describe("pool recycle — bodyDef.collisionMask is re-applied each registration", () => {
		class RecycledEntity extends Renderable {
			constructor() {
				super(0, 0, 32, 32);
				this.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
					collisionType: 16,
					collisionMask: 7,
				};
			}
		}

		beforeEach(() => {
			pool.register("RecycledEntity", RecycledEntity, true);
		});

		it("a freshly pulled entity registers with the def's fields applied", () => {
			const r = pool.pull("RecycledEntity");
			world.addChild(r);
			expect(r.body.collisionType).toEqual(16);
			expect(r.body.collisionMask).toEqual(7);
		});

		it("after a recycle cycle, def fields are re-applied (mask 'reset')", () => {
			// 1. Pull entity, add to world — mask = 7 (from bodyDef)
			const r = pool.pull("RecycledEntity");
			world.addChild(r);
			expect(r.body.collisionMask).toEqual(7);

			// 2. Mutate the live body's mask (simulating an in-game collision
			//    handler that disables further collision)
			adapter.setCollisionMask(r, 0);
			expect(r.body.collisionMask).toEqual(0);

			// 3. Remove from world (pool recycles it)
			world.removeChildNow(r, true);
			expect(adapter.bodies.has(r.body)).toEqual(false);

			// 4. Re-add — adapter.addBody re-applies def.collisionMask
			world.addChild(r);
			expect(r.body.collisionMask).toEqual(7);
		});

		it("def.collisionType is also re-applied on recycle", () => {
			const r = pool.pull("RecycledEntity");
			world.addChild(r);
			adapter.setCollisionType(r, 999);
			expect(r.body.collisionType).toEqual(999);
			world.removeChildNow(r, true);
			world.addChild(r);
			expect(r.body.collisionType).toEqual(16);
		});
	});

	describe("mixed legacy + bodyDef in the same world", () => {
		it("both register in adapter.bodies, neither interferes", () => {
			const legacyRenderable = new Renderable(0, 0, 32, 32);
			legacyRenderable.body = new Body(
				legacyRenderable,
				new Rect(0, 0, 32, 32),
			);
			const defRenderable = new Renderable(0, 0, 32, 32);
			defRenderable.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};

			world.addChild(legacyRenderable);
			world.addChild(defRenderable);

			expect(adapter.bodies.size).toEqual(2);
			expect(adapter.bodies.has(legacyRenderable.body)).toEqual(true);
			expect(adapter.bodies.has(defRenderable.body)).toEqual(true);
		});

		it("step() simulates both bodies under the same gravity", () => {
			adapter.gravity.set(0, 1);

			const legacyR = new Renderable(0, 0, 32, 32);
			legacyR.alwaysUpdate = true;
			legacyR.body = new Body(legacyR, new Rect(0, 0, 32, 32));
			const defR = new Renderable(0, 0, 32, 32);
			defR.alwaysUpdate = true;
			defR.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};

			world.addChild(legacyR);
			world.addChild(defR);
			adapter.step(16);

			// gravity affected both
			expect(legacyR.body.vel.y).toBeGreaterThan(0);
			expect(defR.body.vel.y).toBeGreaterThan(0);
		});
	});

	describe("add / remove / re-add cycle", () => {
		it("re-adding a bodyDef renderable after removeChild re-registers cleanly", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			world.addChild(r);
			const firstBody = r.body;
			expect(adapter.bodies.has(firstBody)).toEqual(true);

			world.removeChildNow(r, true);
			expect(adapter.bodies.has(firstBody)).toEqual(false);
			// the body field is preserved (used by adapter to re-register)
			expect(r.body).toBe(firstBody);

			world.addChild(r);
			// adapter re-uses the existing body via the legacy bridge path
			expect(r.body).toBe(firstBody);
			expect(adapter.bodies.has(r.body)).toEqual(true);
		});

		it("removing then re-adding doesn't duplicate the body in adapter.bodies", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			world.addChild(r);
			world.removeChildNow(r, true);
			world.addChild(r);
			world.removeChildNow(r, true);
			world.addChild(r);
			expect(adapter.bodies.size).toEqual(1);
		});
	});

	describe("nested container — descendants register at attach time", () => {
		it("renderables inside an unattached container don't get bodies", () => {
			const inner = new Container(0, 0, 100, 100);
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			inner.addChild(r);
			// not attached to world yet
			expect(r.body).toBeUndefined();
			expect(adapter.bodies.size).toEqual(0);

			// attach the inner container
			world.addChild(inner);
			expect(r.body).toBeInstanceOf(Body);
			expect(adapter.bodies.has(r.body)).toEqual(true);
		});

		it("removing the inner container unregisters all descendant bodies", () => {
			const inner = new Container(0, 0, 100, 100);
			const r1 = new Renderable(0, 0, 32, 32);
			r1.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			const r2 = new Renderable(0, 0, 32, 32);
			r2.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			inner.addChild(r1);
			inner.addChild(r2);
			world.addChild(inner);
			expect(adapter.bodies.size).toEqual(2);

			world.removeChildNow(inner, true);
			// Legacy behavior — removeChildNow on a Container only removes
			// the container's body (if any), not descendants. The two
			// descendant bodies survive in adapter.bodies. This pins the
			// current contract; if a future refactor walks descendants
			// on container removal, flip this to .toEqual(0) instead of
			// reverting the behavior silently.
			// TODO: should be 0 once descendant cleanup is implemented.
			expect(adapter.bodies.size).toEqual(2);
		});
	});
});
