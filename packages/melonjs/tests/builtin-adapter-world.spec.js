/**
 * Parity coverage for `world.spec.js` using the new PhysicsAdapter API.
 *
 * Every test that exercises `World.bodies`, `World.gravity`,
 * `World.detector`, `World.addBody/removeBody/reset/bodyApplyGravity`
 * has a counterpart here that reaches the same state through
 * `world.adapter.*`. The two APIs must agree on every observable
 * property after every mutation, or the abstraction has leaked.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Body,
	BuiltinAdapter,
	boot,
	Container,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";

describe("Physics : World (parity with world.spec.js via adapter)", () => {
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

	describe("default adapter wiring", () => {
		it("World instantiates a BuiltinAdapter by default", () => {
			expect(adapter).toBeInstanceOf(BuiltinAdapter);
		});

		it("World accepts an explicit adapter via constructor", () => {
			const explicit = new BuiltinAdapter();
			const w = new World(0, 0, 800, 600, explicit);
			expect(w.adapter).toBe(explicit);
		});

		it("adapter.init() was called and set the detector", () => {
			expect(adapter.detector).toBeDefined();
			expect(adapter.detector.world).toBe(world);
		});

		it("legacy world.detector forwarder returns the adapter's detector", () => {
			expect(world.detector).toBe(adapter.detector);
		});

		it("legacy world.bodies forwarder returns the adapter's bodies", () => {
			expect(world.bodies).toBe(adapter.bodies);
		});

		it("legacy world.gravity forwarder reads/writes adapter.gravity", () => {
			world.gravity.set(0, 5);
			expect(adapter.gravity.x).toEqual(0);
			expect(adapter.gravity.y).toEqual(5);

			adapter.gravity.set(1, 2);
			expect(world.gravity.x).toEqual(1);
			expect(world.gravity.y).toEqual(2);
		});
	});

	describe("addBody (legacy API → adapter state)", () => {
		it("world.addBody(body) ends up in adapter.bodies", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			world.addBody(body);
			expect(adapter.bodies.size).toEqual(1);
			expect(adapter.bodies.has(body)).toEqual(true);
		});

		it("adapter.addBody adds to adapter.bodies", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			expect(adapter.bodies.size).toEqual(1);
		});

		it("legacy and adapter additions interleave correctly", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			const legacyBody = new Body(r1, new Rect(0, 0, 32, 32));
			world.addBody(legacyBody);

			const r2 = new Renderable(0, 0, 32, 32);
			adapter.addBody(r2, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});

			expect(adapter.bodies.size).toEqual(2);
			expect(world.bodies.size).toEqual(2);
		});

		it("does not add a body when physic is 'none' (legacy world.addBody)", () => {
			world.physic = "none";
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			world.addBody(body);
			expect(adapter.bodies.size).toEqual(0);
		});

		it("world.addBody returns the world for chaining", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			expect(world.addBody(body)).toBe(world);
		});
	});

	describe("removeBody", () => {
		it("world.removeBody removes from adapter.bodies", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			world.addBody(body);
			expect(adapter.bodies.size).toEqual(1);
			world.removeBody(body);
			expect(adapter.bodies.size).toEqual(0);
		});

		it("adapter.removeBody removes from adapter.bodies", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			expect(adapter.bodies.size).toEqual(1);
			adapter.removeBody(r);
			expect(adapter.bodies.size).toEqual(0);
		});

		it("legacy and adapter removals see the same state", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			// remove via the legacy API — must reach the same Set
			world.removeBody(r.body);
			expect(adapter.bodies.size).toEqual(0);
		});

		it("does not remove when physic is 'none' (legacy world.removeBody)", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			world.addBody(body);
			world.physic = "none";
			world.removeBody(body);
			expect(adapter.bodies.size).toEqual(1);
		});

		it("world.removeBody returns the world for chaining", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			world.addBody(body);
			expect(world.removeBody(body)).toBe(world);
		});
	});

	describe("reset", () => {
		it("clears non-persistent bodies in the adapter", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			expect(adapter.bodies.size).toEqual(1);
			world.reset();
			expect(adapter.bodies.size).toEqual(0);
		});

		it("preserves bodies whose ancestor.isPersistent is true", () => {
			const persistent = new Renderable(0, 0, 32, 32);
			persistent.isPersistent = true;
			adapter.addBody(persistent, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});

			const nonPersistent = new Renderable(0, 0, 16, 16);
			adapter.addBody(nonPersistent, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 16, 16)],
			});

			expect(adapter.bodies.size).toEqual(2);
			world.reset();
			expect(adapter.bodies.size).toEqual(1);
			expect(adapter.bodies.has(persistent.body)).toEqual(true);
		});

		it("preserves multiple persistent bodies", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			r1.isPersistent = true;
			adapter.addBody(r1, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const r2 = new Renderable(0, 0, 64, 64);
			r2.isPersistent = true;
			adapter.addBody(r2, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 64, 64)],
			});
			const r3 = new Renderable(0, 0, 16, 16);
			adapter.addBody(r3, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 16, 16)],
			});

			expect(adapter.bodies.size).toEqual(3);
			world.reset();
			expect(adapter.bodies.size).toEqual(2);
		});

		it("does not re-add persistent bodies when physic is 'none'", () => {
			const persistent = new Renderable(0, 0, 32, 32);
			persistent.isPersistent = true;
			adapter.addBody(persistent, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			expect(adapter.bodies.size).toEqual(1);
			world.physic = "none";
			world.reset();
			expect(adapter.bodies.size).toEqual(0);
		});

		it("resets anchorPoint to (0, 0)", () => {
			world.anchorPoint.set(0.5, 0.5);
			world.reset();
			expect(world.anchorPoint.x).toEqual(0);
			expect(world.anchorPoint.y).toEqual(0);
		});
	});

	describe("gravity (legacy + adapter)", () => {
		it("default gravity is (0, 0.98)", () => {
			expect(world.gravity.x).toEqual(0);
			expect(world.gravity.y).toEqual(0.98);
		});

		it("legacy world.bodyApplyGravity routes to adapter.applyGravity", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			body.force.set(0, 0);
			world.bodyApplyGravity(body);
			expect(body.force.y).toEqual(body.mass * world.gravity.y);
		});

		it("ignoreGravity skips force accumulation", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			body.ignoreGravity = true;
			body.force.set(0, 0);
			world.bodyApplyGravity(body);
			expect(body.force.y).toEqual(0);
		});

		it("gravityScale = 0 skips force accumulation", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			body.gravityScale = 0;
			body.force.set(0, 0);
			world.bodyApplyGravity(body);
			expect(body.force.y).toEqual(0);
		});

		it("custom gravityScale is honored", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			body.gravityScale = 2;
			body.force.set(0, 0);
			world.bodyApplyGravity(body);
			expect(body.force.y).toEqual(body.mass * world.gravity.y * 2);
		});

		it("setting gravity via the adapter is visible to legacy callers", () => {
			adapter.gravity.set(0.5, 1.5);
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			body.force.set(0, 0);
			world.bodyApplyGravity(body);
			expect(body.force.x).toEqual(body.mass * 0.5);
			expect(body.force.y).toEqual(body.mass * 1.5);
		});

		it("constructor-supplied adapter options carry through", () => {
			const a = new BuiltinAdapter({ gravity: new Vector2d(0, 9.8) });
			const w = new World(0, 0, 800, 600, a);
			expect(w.gravity.y).toEqual(9.8);
		});
	});

	describe("broadphase", () => {
		it("world keeps the broadphase quadtree", () => {
			expect(world.broadphase).toBeDefined();
		});

		it("broadphase exists independent of the adapter's detector", () => {
			// pointer events rely on broadphase even when the active adapter
			// doesn't expose its own; both must be available
			expect(world.broadphase).toBeDefined();
			expect(adapter.detector).toBeDefined();
		});
	});

	describe("bodyDef auto-registration via Container.addChild", () => {
		it("registers child.bodyDef when added to world", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			expect(r.body).toBeUndefined();
			world.addChild(r);
			expect(r.body).toBeInstanceOf(Body);
			expect(adapter.bodies.has(r.body)).toEqual(true);
		});

		it("applies bodyDef physics fields", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				maxVelocity: { x: 3, y: 15 },
				frictionAir: { x: 0.4, y: 0 },
				gravityScale: 0.5,
				collisionType: 16,
			};
			world.addChild(r);
			expect(r.body.maxVel.x).toEqual(3);
			expect(r.body.maxVel.y).toEqual(15);
			expect(r.body.friction.x).toEqual(0.4);
			expect(r.body.friction.y).toEqual(0);
			expect(r.body.gravityScale).toEqual(0.5);
			expect(r.body.collisionType).toEqual(16);
		});

		it("declarative path skipped when child.body is already set (legacy wins)", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.body = new Body(r, new Rect(0, 0, 32, 32));
			const legacyBody = r.body;
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 64, 64)], // different shape — should be ignored
			};
			world.addChild(r);
			expect(r.body).toBe(legacyBody);
			expect(adapter.bodies.size).toEqual(1);
		});

		it("nested container children are auto-registered too", () => {
			const inner = new Container(0, 0, 800, 600);
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			inner.addChild(r);
			expect(r.body).toBeUndefined(); // inner not attached to root yet
			world.addChild(inner);
			expect(r.body).toBeInstanceOf(Body);
			expect(adapter.bodies.has(r.body)).toEqual(true);
		});

		it("removeChild unregisters an adapter-managed body", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			world.addChild(r);
			expect(adapter.bodies.size).toEqual(1);
			world.removeChildNow(r, true);
			expect(adapter.bodies.size).toEqual(0);
		});
	});
});
