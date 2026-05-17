/**
 * Parity coverage for `body.spec.js` using the new PhysicsAdapter API.
 *
 * Every test that exercises Body behavior via the legacy property/method
 * API has a counterpart here that goes through `world.adapter.addBody`,
 * `adapter.setVelocity`, `adapter.applyForce`, etc. Same behavior, new
 * surface. If a test passes here but not in `body.spec.js` (or vice
 * versa) the abstraction has leaked and the two APIs are no longer
 * equivalent — that's exactly the bug we want to catch early.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Body,
	BuiltinAdapter,
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

describe("Physics : BuiltinAdapter (Body parity with body.spec.js)", () => {
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
		adapter = new BuiltinAdapter();
		// World wiring sets adapter.world and adapter.detector via init();
		// we don't need the World reference itself in this spec.
		// eslint-disable-next-line no-new
		new World(0, 0, 800, 600, adapter);
	});

	describe("addBody", () => {
		it("creates a body with a single Rect shape", () => {
			const r = new Renderable(0, 0, 32, 64);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 64)],
			});
			expect(body.shapes.length).toEqual(1);
			expect(body.ancestor).toBe(r);
			expect(r.body).toBe(body);
		});

		it("creates a body with an Ellipse shape", () => {
			const r = new Renderable(0, 0, 32, 64);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Ellipse(16, 32, 32, 64)],
			});
			expect(body.shapes.length).toEqual(1);
		});

		it("creates a body with a Polygon shape", () => {
			const r = new Renderable(0, 0, 32, 64);
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 32, y: 0 },
				{ x: 32, y: 64 },
				{ x: 0, y: 64 },
			]);
			const body = adapter.addBody(r, { type: "dynamic", shapes: [poly] });
			expect(body.shapes.length).toEqual(1);
		});

		it("creates a body with multiple shapes (compound body)", () => {
			const r = new Renderable(0, 0, 64, 64);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32), new Rect(32, 0, 32, 32)],
			});
			expect(body.shapes.length).toEqual(2);
		});

		it("creates a body with no initial shape (empty shapes array)", () => {
			const r = new Renderable(0, 0, 32, 64);
			const body = adapter.addBody(r, { type: "dynamic", shapes: [] });
			expect(body.shapes.length).toEqual(0);
		});

		it("registers the new body with the adapter", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			expect(adapter.bodies.size).toEqual(1);
		});

		it('sets `type: "static"` via setStatic()', () => {
			const r = new Renderable(0, 0, 32, 64);
			const body = adapter.addBody(r, {
				type: "static",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			expect(body.isStatic).toEqual(true);
		});

		it("dynamic body has isStatic = false", () => {
			const r = new Renderable(0, 0, 32, 64);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			expect(body.isStatic).toEqual(false);
		});

		it("applies collisionType from the BodyDefinition", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				collisionType: collision.types.PLAYER_OBJECT,
			});
			expect(body.collisionType).toEqual(collision.types.PLAYER_OBJECT);
		});

		it("applies collisionMask from the BodyDefinition", () => {
			const r = new Renderable(0, 0, 32, 32);
			const mask = collision.types.PLAYER_OBJECT | collision.types.ENEMY_OBJECT;
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				collisionMask: mask,
			});
			expect(body.collisionMask).toEqual(mask);
		});

		it("applies frictionAir (scalar) from the BodyDefinition", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				frictionAir: 0.5,
			});
			expect(body.friction.x).toEqual(0.5);
			expect(body.friction.y).toEqual(0.5);
		});

		it("applies frictionAir (per-axis) from the BodyDefinition", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				frictionAir: { x: 0.3, y: 0.7 },
			});
			expect(body.friction.x).toEqual(0.3);
			expect(body.friction.y).toEqual(0.7);
		});

		it("applies gravityScale from the BodyDefinition", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0.5,
			});
			expect(body.gravityScale).toEqual(0.5);
		});

		it("applies maxVelocity from the BodyDefinition", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				maxVelocity: { x: 3, y: 15 },
			});
			expect(body.maxVel.x).toEqual(3);
			expect(body.maxVel.y).toEqual(15);
		});

		it("applies restitution → bounce from the BodyDefinition", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				restitution: 0.75,
			});
			expect(body.bounce).toEqual(0.75);
		});

		it("applies density → mass from the BodyDefinition", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				density: 5,
			});
			expect(body.mass).toEqual(5);
		});

		it("leaves defaults intact when optional fields are omitted", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			expect(body.mass).toEqual(1);
			expect(body.bounce).toEqual(0);
			expect(body.friction.x).toEqual(0);
			expect(body.friction.y).toEqual(0);
			expect(body.collisionType).toEqual(collision.types.ENEMY_OBJECT);
			expect(body.collisionMask).toEqual(collision.types.ALL_OBJECT);
		});
	});

	describe("legacy bridge: existing renderable.body is registered, not replaced", () => {
		it("addBody on a renderable that already has a Body registers the existing instance", () => {
			const r = new Renderable(0, 0, 32, 32);
			// Legacy construction path: user creates Body directly, then
			// later registers it through the adapter API.
			r.body = new Body(r, [new Rect(0, 0, 32, 32)]);
			const before = r.body;
			const handle = adapter.addBody(r, {
				type: "dynamic",
				shapes: [], // shapes deliberately empty — the existing body's shapes survive
			});
			expect(handle).toBe(before); // same instance, not replaced
			expect(adapter.bodies.has(before)).toEqual(true);
		});
	});

	describe("removeBody", () => {
		it("unregisters the body from the adapter", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			expect(adapter.bodies.size).toEqual(1);
			adapter.removeBody(r);
			expect(adapter.bodies.size).toEqual(0);
		});

		it("is a no-op on a renderable without a body", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.removeBody(r); // must not throw
			expect(adapter.bodies.size).toEqual(0);
		});

		it("is a no-op on a renderable that was never registered", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.body = new Body(r, [new Rect(0, 0, 32, 32)]);
			adapter.removeBody(r); // body exists but isn't in the Set
			expect(adapter.bodies.size).toEqual(0);
		});
	});

	describe("updateShape", () => {
		it("replaces shapes on an existing body", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			expect(r.body.shapes.length).toEqual(1);
			adapter.updateShape(r, [new Rect(0, 0, 16, 16), new Rect(16, 0, 16, 16)]);
			expect(r.body.shapes.length).toEqual(2);
		});

		it("updates bounds after shape replacement", () => {
			const r = new Renderable(0, 0, 64, 64);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 60, 60)] });
			expect(r.body.getBounds().width).toEqual(60);
			adapter.updateShape(r, [new Rect(0, 0, 20, 20)]);
			expect(r.body.getBounds().width).toEqual(20);
		});

		it("is a no-op on a renderable without a body", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.updateShape(r, [new Rect(0, 0, 8, 8)]);
			expect(r.body).toBeUndefined();
		});
	});

	describe("velocity API", () => {
		it("getVelocity returns the current velocity", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			r.body.vel.set(3, 4);
			const v = adapter.getVelocity(r);
			expect(v.x).toEqual(3);
			expect(v.y).toEqual(4);
		});

		it("getVelocity writes into the provided out vector", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			r.body.vel.set(5, 6);
			const out = new Vector2d();
			const v = adapter.getVelocity(r, out);
			expect(v).toBe(out);
			expect(out.x).toEqual(5);
		});

		it("setVelocity updates the body's vel", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			adapter.setVelocity(r, new Vector2d(7, -2));
			expect(r.body.vel.x).toEqual(7);
			expect(r.body.vel.y).toEqual(-2);
		});

		it("setVelocity is observable via the legacy property API", () => {
			// proves the two APIs touch the same underlying state
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			adapter.setVelocity(r, new Vector2d(1, 2));
			expect(r.body.vel.x).toEqual(1);
			expect(r.body.vel.y).toEqual(2);
			// and the reverse:
			r.body.vel.set(10, 20);
			const v = adapter.getVelocity(r);
			expect(v.x).toEqual(10);
		});
	});

	describe("applyForce / applyImpulse", () => {
		it("applyForce accumulates into body.force", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			adapter.applyForce(r, new Vector2d(10, 0));
			adapter.applyForce(r, new Vector2d(5, 7));
			expect(r.body.force.x).toEqual(15);
			expect(r.body.force.y).toEqual(7);
		});

		it("applyImpulse modifies velocity by impulse / mass", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				density: 2,
			});
			adapter.applyImpulse(r, new Vector2d(10, 0));
			expect(r.body.vel.x).toEqual(5); // 10 / 2
		});

		it("applyImpulse with zero-mass body is a no-op (avoids divide-by-zero)", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			r.body.mass = 0;
			adapter.applyImpulse(r, new Vector2d(10, 10));
			expect(r.body.vel.x).toEqual(0);
			expect(r.body.vel.y).toEqual(0);
		});
	});

	describe("setPosition", () => {
		it("writes to renderable.pos", () => {
			const r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			adapter.setPosition(r, new Vector2d(100, 200));
			expect(r.pos.x).toEqual(100);
			expect(r.pos.y).toEqual(200);
		});

		it("preserves the depth (pos.z) field", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.depth = 42;
			adapter.addBody(r, { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] });
			adapter.setPosition(r, new Vector2d(10, 20));
			expect(r.pos.z).toEqual(42);
		});
	});

	describe("gravity", () => {
		it("default gravity is (0, 0.98)", () => {
			expect(adapter.gravity.x).toEqual(0);
			expect(adapter.gravity.y).toEqual(0.98);
		});

		it("can be set via the constructor options", () => {
			const a = new BuiltinAdapter({ gravity: new Vector2d(0, 5) });
			expect(a.gravity.x).toEqual(0);
			expect(a.gravity.y).toEqual(5);
		});

		it("applyGravity adds force.y = mass * gravity.y * gravityScale", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			body.force.set(0, 0);
			adapter.applyGravity(body);
			expect(body.force.y).toEqual(body.mass * adapter.gravity.y);
		});

		it("applyGravity is skipped when ignoreGravity = true", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			body.ignoreGravity = true;
			body.force.set(0, 0);
			adapter.applyGravity(body);
			expect(body.force.y).toEqual(0);
		});

		it("applyGravity is skipped when gravityScale = 0", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			body.gravityScale = 0;
			body.force.set(0, 0);
			adapter.applyGravity(body);
			expect(body.force.y).toEqual(0);
		});

		it("applyGravity respects custom gravity components", () => {
			adapter.gravity.set(0.5, 1.5);
			const r = new Renderable(0, 0, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			body.force.set(0, 0);
			adapter.applyGravity(body);
			expect(body.force.x).toEqual(body.mass * 0.5);
			expect(body.force.y).toEqual(body.mass * 1.5);
		});
	});

	describe("capabilities", () => {
		it("declares the right capability flags", () => {
			expect(adapter.capabilities.constraints).toEqual(false);
			expect(adapter.capabilities.continuousCollisionDetection).toEqual(false);
			expect(adapter.capabilities.sleepingBodies).toEqual(false);
			expect(adapter.capabilities.raycasts).toEqual(false);
			expect(adapter.capabilities.velocityLimit).toEqual(true);
			expect(adapter.capabilities.isGrounded).toEqual(true);
		});
	});

	describe("runtime setters", () => {
		/** @type {Renderable} */
		let r;
		beforeEach(() => {
			r = new Renderable(0, 0, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
		});

		it("setStatic toggles body.isStatic", () => {
			adapter.setStatic(r, true);
			expect(r.body.isStatic).toEqual(true);
			adapter.setStatic(r, false);
			expect(r.body.isStatic).toEqual(false);
		});

		it("setGravityScale writes body.gravityScale", () => {
			adapter.setGravityScale(r, 0.25);
			expect(r.body.gravityScale).toEqual(0.25);
		});

		it("setFrictionAir (scalar) sets both axes", () => {
			adapter.setFrictionAir(r, 0.6);
			expect(r.body.friction.x).toEqual(0.6);
			expect(r.body.friction.y).toEqual(0.6);
		});

		it("setFrictionAir (per-axis) sets each independently", () => {
			adapter.setFrictionAir(r, { x: 0.2, y: 0.8 });
			expect(r.body.friction.x).toEqual(0.2);
			expect(r.body.friction.y).toEqual(0.8);
		});

		it("setMaxVelocity writes body.maxVel", () => {
			adapter.setMaxVelocity(r, { x: 5, y: 20 });
			expect(r.body.maxVel.x).toEqual(5);
			expect(r.body.maxVel.y).toEqual(20);
		});

		it("getMaxVelocity mirrors setMaxVelocity", () => {
			adapter.setMaxVelocity(r, { x: 7, y: 12 });
			const v = adapter.getMaxVelocity(r);
			expect(v.x).toEqual(7);
			expect(v.y).toEqual(12);
		});

		it("setCollisionType writes body.collisionType", () => {
			adapter.setCollisionType(r, 42);
			expect(r.body.collisionType).toEqual(42);
		});

		it("setCollisionMask writes body.collisionMask", () => {
			adapter.setCollisionMask(r, 7);
			expect(r.body.collisionMask).toEqual(7);
		});

		it("isGrounded reflects !body.falling && !body.jumping", () => {
			r.body.falling = false;
			r.body.jumping = false;
			expect(adapter.isGrounded(r)).toEqual(true);

			r.body.falling = true;
			expect(adapter.isGrounded(r)).toEqual(false);

			r.body.falling = false;
			r.body.jumping = true;
			expect(adapter.isGrounded(r)).toEqual(false);
		});

		// Regression: previously emulated by toggling collisionMask to
		// NO_OBJECT, which silenced collision events entirely — diverging
		// from the PhysicsAdapter contract that sensors still fire events.
		it("setSensor sets body.isSensor (events still fire, push-out skipped)", () => {
			expect(r.body.isSensor).toEqual(false);
			adapter.setSensor(r, true);
			expect(r.body.isSensor).toEqual(true);
			// collisionMask must not have been mangled
			expect(r.body.collisionMask).not.toEqual(0);
			adapter.setSensor(r, false);
			expect(r.body.isSensor).toEqual(false);
		});

		// Regression: setAngle was undefined on the builtin adapter,
		// so portable code that called `adapter.setAngle?.(...)` had to
		// branch by adapter. Now it's a no-op stub.
		it("setAngle is callable as a no-op", () => {
			expect(typeof adapter.setAngle).toEqual("function");
			expect(() => {
				adapter.setAngle(r, Math.PI / 4);
			}).not.toThrow();
		});
	});
});
