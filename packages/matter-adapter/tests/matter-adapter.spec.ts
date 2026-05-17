/**
 * MatterAdapter feature-parity spec.
 *
 * Verifies the adapter behaves equivalently to BuiltinAdapter on the same
 * PhysicsAdapter contract — bodies fall under gravity, applyForce works,
 * velocity / position / static / collision masks / isGrounded / raycast
 * all behave sensibly. We don't pixel-compare positions to BuiltinAdapter
 * (the two engines integrate differently); we assert that each behavior
 * is observable and consistent.
 */

import * as Matter from "matter-js";
import { boot, Rect, Renderable, Vector2d, video, World } from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MatterAdapter } from "../src/index";

describe("MatterAdapter — feature parity with BuiltinAdapter", () => {
	let world: World;
	let adapter: MatterAdapter;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	beforeEach(() => {
		adapter = new MatterAdapter({ gravity: { x: 0, y: 1 } });
		world = new World(0, 0, 800, 600, adapter);
	});

	describe("metadata + capabilities", () => {
		it("advertises name / version / url for the boot banner", () => {
			expect(adapter.name).toEqual("@melonjs/matter-adapter");
			expect(typeof adapter.version).toEqual("string");
			expect(adapter.url).toContain("npmjs.com");
		});

		it("declares richer capabilities than BuiltinAdapter", () => {
			expect(adapter.capabilities.constraints).toEqual(true);
			expect(adapter.capabilities.continuousCollisionDetection).toEqual(true);
			expect(adapter.capabilities.sleepingBodies).toEqual(true);
			expect(adapter.capabilities.raycasts).toEqual(true);
			expect(adapter.capabilities.velocityLimit).toEqual(true);
			expect(adapter.capabilities.isGrounded).toEqual(true);
		});
	});

	// Escape hatch: matter-specific features that don't fit the portable
	// PhysicsAdapter surface (constraints, queries, raw events) should be
	// reachable without forcing the user to add matter-js as a direct dep.
	describe("adapter.matter escape hatch", () => {
		it("exposes the raw matter-js namespace", () => {
			expect(adapter.matter).toBeDefined();
			expect(adapter.matter.Constraint).toBeDefined();
			expect(adapter.matter.Composite).toBeDefined();
			expect(adapter.matter.Bodies).toBeDefined();
			expect(adapter.matter.Body).toBeDefined();
			expect(adapter.matter.Events).toBeDefined();
			expect(adapter.matter.Query).toBeDefined();
			expect(adapter.matter.Vector).toBeDefined();
		});

		it("lets the user build and add a Matter.Constraint via the namespace alone", () => {
			const a = new Renderable(100, 100, 32, 32);
			const b = new Renderable(180, 100, 32, 32);
			adapter.addBody(a, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.addBody(b, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			// hold a in place so we can observe b being pulled toward it
			adapter.setStatic(a, true);

			const spring = adapter.matter.Constraint.create({
				bodyA: a.body as unknown as Parameters<
					typeof adapter.matter.Constraint.create
				>[0]["bodyA"],
				bodyB: b.body as unknown as Parameters<
					typeof adapter.matter.Constraint.create
				>[0]["bodyB"],
				stiffness: 0.1,
				length: 0,
			});
			adapter.matter.Composite.add(adapter.engine.world, spring);

			const startDx =
				(b.body as unknown as { position: { x: number } }).position.x -
				(a.body as unknown as { position: { x: number } }).position.x;
			for (let i = 0; i < 30; i++) {
				adapter.step(16);
			}
			const endDx =
				(b.body as unknown as { position: { x: number } }).position.x -
				(a.body as unknown as { position: { x: number } }).position.x;
			// the spring should have pulled them closer together
			expect(Math.abs(endDx)).toBeLessThan(Math.abs(startDx));
		});
	});

	describe("init wires up the engine", () => {
		it("engine instance is created", () => {
			expect(adapter.engine).toBeDefined();
			expect(adapter.world).toBe(world);
		});

		it("mirrors initial gravity into the matter engine", () => {
			adapter.gravity.set(0, 0.5);
			adapter.step(16);
			expect(adapter.engine.gravity.y).toEqual(0.5);
		});
	});

	describe("addBody / removeBody lifecycle", () => {
		it("creates a matter body from a Rect bodyDef", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			expect(r.body).toBeDefined();
		});

		it("applies def.collisionType / collisionMask", () => {
			const r = new Renderable(100, 100, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				collisionType: 16,
				collisionMask: 7,
			});
			expect(body.collisionFilter.category).toEqual(16);
			expect(body.collisionFilter.mask).toEqual(7);
		});

		it("applies def.restitution / frictionAir / density", () => {
			const r = new Renderable(100, 100, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				restitution: 0.7,
				frictionAir: 0.2,
				density: 2,
			});
			expect(body.restitution).toEqual(0.7);
			expect(body.frictionAir).toEqual(0.2);
			expect(body.density).toEqual(2);
		});

		it("static def → matter isStatic", () => {
			const r = new Renderable(100, 100, 32, 32);
			const body = adapter.addBody(r, {
				type: "static",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			expect(body.isStatic).toEqual(true);
		});

		it("removeBody pulls the matter body out of the world", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.removeBody(r);
			// further setters silently no-op on an unregistered renderable
			expect(() => {
				adapter.setVelocity(r, new Vector2d(1, 0));
			}).not.toThrow();
		});
	});

	describe("simulation — gravity + force + velocity", () => {
		it("a dynamic body falls under gravity", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const startY = r.pos.y;
			// step the simulation a few times
			for (let i = 0; i < 5; i++) {
				adapter.step(16);
			}
			expect(r.pos.y).toBeGreaterThan(startY);
		});

		it("applyForce nudges the body horizontally", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.applyForce(r, new Vector2d(0.1, 0));
			adapter.step(16);
			const v = adapter.getVelocity(r);
			expect(v.x).toBeGreaterThan(0);
		});

		it("setVelocity sets the body velocity directly", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.setVelocity(r, new Vector2d(5, 3));
			const v = adapter.getVelocity(r);
			expect(v.x).toEqual(5);
			expect(v.y).toEqual(3);
		});

		it("applyImpulse applies dv = J / m", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const beforeV = adapter.getVelocity(r).clone();
			adapter.applyImpulse(r, new Vector2d(10, 0));
			const afterV = adapter.getVelocity(r);
			expect(afterV.x).toBeGreaterThan(beforeV.x);
		});

		it("setPosition teleports the body", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.setPosition(r, new Vector2d(500, 200));
			expect(r.pos.x).toEqual(500);
			expect(r.pos.y).toEqual(200);
		});
	});

	describe("setMaxVelocity clamps velocity in the afterUpdate hook", () => {
		it("velocity is capped after step()", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				maxVelocity: { x: 3, y: 15 },
			});
			adapter.setVelocity(r, new Vector2d(50, 50));
			adapter.step(16);
			const v = adapter.getVelocity(r);
			// gravity nudges v.y slightly above the cap during the step's
			// integration, then the afterUpdate hook clamps it back. Allow
			// a small epsilon for floating-point in Matter's vector math.
			const epsilon = 1e-6;
			expect(Math.abs(v.x)).toBeLessThanOrEqual(3 + epsilon);
			expect(Math.abs(v.y)).toBeLessThanOrEqual(15 + epsilon);
		});

		it("getMaxVelocity mirrors the cap", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				maxVelocity: { x: 7, y: 12 },
			});
			const cap = adapter.getMaxVelocity(r);
			expect(cap.x).toEqual(7);
			expect(cap.y).toEqual(12);
		});
	});

	describe("runtime setters", () => {
		let r: Renderable;
		beforeEach(() => {
			r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
		});

		it("setStatic toggles isStatic on the matter body", () => {
			adapter.setStatic(r, true);
			expect((r.body as unknown as { isStatic: boolean }).isStatic).toEqual(
				true,
			);
			adapter.setStatic(r, false);
			expect((r.body as unknown as { isStatic: boolean }).isStatic).toEqual(
				false,
			);
		});

		it("setCollisionType / setCollisionMask write to collisionFilter", () => {
			adapter.setCollisionType(r, 42);
			adapter.setCollisionMask(r, 9);
			const filter = (
				r.body as unknown as {
					collisionFilter: { category: number; mask: number };
				}
			).collisionFilter;
			expect(filter.category).toEqual(42);
			expect(filter.mask).toEqual(9);
		});

		it("setFrictionAir writes frictionAir", () => {
			adapter.setFrictionAir(r, 0.4);
			expect(
				(r.body as unknown as { frictionAir: number }).frictionAir,
			).toEqual(0.4);
		});

		it("setGravityScale emulates per-body gravity via counter-force", async () => {
			// Place bodies far apart so they don't collide.
			const r1 = new Renderable(0, 0, 32, 32);
			const r2 = new Renderable(500, 0, 32, 32);
			adapter.addBody(r1, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.addBody(r2, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.setGravityScale(r2, 0);
			const start1 = (r1.body as unknown as { position: { y: number } })
				.position.y;
			const start2 = (r2.body as unknown as { position: { y: number } })
				.position.y;
			adapter.step(16);
			adapter.step(16);
			const end1 = (r1.body as unknown as { position: { y: number } }).position
				.y;
			const end2 = (r2.body as unknown as { position: { y: number } }).position
				.y;
			// Scale=1 (default) body falls; scale=0 body stays put.
			expect(end1).toBeGreaterThan(start1);
			expect(Math.abs(end2 - start2)).toBeLessThan(0.01);
		});
	});

	// Parity with the legacy melonJS Body API: the matter body handle
	// (`renderable.body`) must expose the same setVelocity / getVelocity /
	// applyForce / setSensor methods that builtin Body now offers, so user
	// code touching `renderable.body.*` is portable across adapters.
	describe("renderable.body helper parity with legacy Body", () => {
		let r: Renderable;
		let body: {
			setVelocity: (x: number, y: number) => void;
			getVelocity: (out?: Vector2d) => Vector2d;
			applyForce: (x: number, y: number) => void;
			applyImpulse: (x: number, y: number) => void;
			setSensor: (isSensor?: boolean) => void;
			setStatic: (isStatic?: boolean) => void;
			setCollisionMask: (mask: number) => void;
			setCollisionType: (type: number) => void;
			mass: number;
			velocity: { x: number; y: number };
			force: { x: number; y: number };
			isSensor: boolean;
			isStatic: boolean;
			collisionFilter: { category: number; mask: number };
		};

		beforeEach(() => {
			r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			body = r.body as unknown as typeof body;
		});

		it("body.setVelocity writes through to Matter.Body.velocity", () => {
			body.setVelocity(3, -4);
			expect(body.velocity.x).toBeCloseTo(3, 5);
			expect(body.velocity.y).toBeCloseTo(-4, 5);
		});

		it("body.getVelocity returns a fresh Vector2d by default", () => {
			body.setVelocity(1, 2);
			const v = body.getVelocity();
			expect(v).toBeInstanceOf(Vector2d);
			expect(v.x).toBeCloseTo(1, 5);
			expect(v.y).toBeCloseTo(2, 5);
			v.set(99, 99);
			expect(body.velocity.x).toBeCloseTo(1, 5);
		});

		it("body.getVelocity writes into the provided output vector", () => {
			body.setVelocity(5, 6);
			const out = new Vector2d();
			const result = body.getVelocity(out);
			expect(result).toBe(out);
			expect(out.x).toBeCloseTo(5, 5);
			expect(out.y).toBeCloseTo(6, 5);
		});

		it("body.applyForce accumulates onto Matter.Body.force across calls", () => {
			body.applyForce(0.01, 0);
			body.applyForce(0.005, -0.002);
			expect(body.force.x).toBeCloseTo(0.015, 5);
			expect(body.force.y).toBeCloseTo(-0.002, 5);
		});

		it("body.setSensor toggles Matter.Body.isSensor", () => {
			expect(body.isSensor).toEqual(false);
			body.setSensor();
			expect(body.isSensor).toEqual(true);
			body.setSensor(false);
			expect(body.isSensor).toEqual(false);
		});

		it("body.applyForce moves a dynamic body over a few steps", () => {
			adapter.setGravityScale(r, 0);
			const startX = body.velocity.x;
			for (let i = 0; i < 5; i++) {
				body.applyForce(0.02, 0);
				adapter.step(16);
			}
			expect(body.velocity.x).toBeGreaterThan(startX);
		});

		it("body.applyImpulse updates Matter.Body.velocity by J / mass", () => {
			// dynamic body with known mass — use setMass for determinism
			Matter.Body.setMass(body as unknown as Matter.Body, 2);
			body.setVelocity(0, 0);
			body.applyImpulse(10, -6);
			expect(body.velocity.x).toBeCloseTo(5, 5);
			expect(body.velocity.y).toBeCloseTo(-3, 5);
		});

		it("body.applyImpulse accumulates onto velocity across calls", () => {
			Matter.Body.setMass(body as unknown as Matter.Body, 1);
			body.setVelocity(0, 0);
			body.applyImpulse(3, 4);
			body.applyImpulse(-1, 2);
			expect(body.velocity.x).toBeCloseTo(2, 5);
			expect(body.velocity.y).toBeCloseTo(6, 5);
		});

		it("body.setStatic toggles Matter.Body.isStatic", () => {
			expect(body.isStatic).toEqual(false);
			body.setStatic();
			expect(body.isStatic).toEqual(true);
			body.setStatic(false);
			expect(body.isStatic).toEqual(false);
		});

		it("body.setCollisionMask writes to collisionFilter.mask", () => {
			body.setCollisionMask(42);
			expect(body.collisionFilter.mask).toEqual(42);
		});

		it("body.setCollisionType writes to collisionFilter.category", () => {
			body.setCollisionType(7);
			expect(body.collisionFilter.category).toEqual(7);
		});

		it("body.setMass updates Matter.Body.mass via Matter.Body.setMass", () => {
			(body as unknown as { setMass: (m: number) => void }).setMass(4);
			expect(body.mass).toBeCloseTo(4, 5);
		});

		it("body.setBounce writes to Matter.Body.restitution", () => {
			(
				body as unknown as {
					setBounce: (r: number) => void;
					restitution: number;
				}
			).setBounce(0.6);
			expect(
				(body as unknown as { restitution: number }).restitution,
			).toBeCloseTo(0.6, 5);
		});

		it("body.setGravityScale toggles the adapter's per-body counter-force map", () => {
			// default scale of 1 → no entry in the map (hot path)
			(
				body as unknown as { setGravityScale: (s: number) => void }
			).setGravityScale(0);
			// observable: body now ignores world gravity. Step a few frames
			// with gravity on and verify the body does not fall.
			const startY = r.pos.y;
			adapter.gravity.set(0, 5);
			for (let i = 0; i < 5; i++) adapter.step(16);
			expect(r.pos.y).toBeCloseTo(startY, 0);
			// reverting to scale=1 restores normal gravity
			(
				body as unknown as { setGravityScale: (s: number) => void }
			).setGravityScale(1);
			for (let i = 0; i < 5; i++) adapter.step(16);
			expect(r.pos.y).toBeGreaterThan(startY);
		});
	});

	describe("isGrounded — contact pair scan", () => {
		it("returns false for a body that is not touching anything", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.step(16);
			expect(adapter.isGrounded(r)).toEqual(false);
		});

		it("returns true when a dynamic body lands on a static one", () => {
			// static floor
			const floor = new Renderable(0, 200, 800, 20);
			adapter.addBody(floor, {
				type: "static",
				shapes: [new Rect(0, 0, 800, 20)],
			});
			// dynamic body just above (close gap so it lands fast)
			const r = new Renderable(100, 150, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.setVelocity(r, new Vector2d(0, 5));
			for (let i = 0; i < 30; i++) {
				adapter.step(16);
			}
			expect(adapter.isGrounded(r)).toEqual(true);
		});
	});

	describe("collision callback bridge", () => {
		it("Renderable.onCollision is invoked when two bodies collide", () => {
			const events: { a: Renderable; b: Renderable }[] = [];
			class Reporter extends Renderable {
				onCollision(_response: unknown, other: Renderable) {
					events.push({ a: this, b: other });
					return false;
				}
			}
			const floor = new Reporter(0, 200, 800, 20);
			adapter.addBody(floor, {
				type: "static",
				shapes: [new Rect(0, 0, 800, 20)],
			});
			const ball = new Reporter(100, 150, 32, 32);
			adapter.addBody(ball, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			for (let i = 0; i < 300; i++) {
				adapter.step(16);
			}
			expect(events.length).toBeGreaterThan(0);
		});

		// "supersedes" rule (same on both adapters): if a renderable
		// defines the modern `onCollisionActive`, the legacy `onCollision`
		// is NOT dispatched on that renderable. They are the same
		// every-frame contact handler in two API styles; firing both
		// would invoke user code twice for one overlap with different
		// response shapes.
		it("onCollisionActive supersedes onCollision on the same renderable", () => {
			let legacyAFires = 0;
			let modernAFires = 0;
			let legacyBFires = 0;
			class WithBoth extends Renderable {
				onCollision() {
					legacyAFires++;
					return true;
				}
				onCollisionActive() {
					modernAFires++;
				}
			}
			class LegacyOnly extends Renderable {
				onCollision() {
					legacyBFires++;
					return true;
				}
			}
			const a = new WithBoth(100, 100, 32, 32);
			adapter.addBody(a, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const floor = new LegacyOnly(0, 200, 800, 20);
			adapter.addBody(floor, {
				type: "static",
				shapes: [new Rect(0, 0, 800, 20)],
			});
			// step long enough to settle into sustained contact
			for (let i = 0; i < 120; i++) {
				adapter.step(16);
			}
			// a has the modern handler → legacy onCollision must never
			// have fired on it.
			expect(legacyAFires).toEqual(0);
			// modern fired (one per active step the pair was in contact)
			expect(modernAFires).toBeGreaterThan(0);
			// floor has only the legacy handler → still fires
			expect(legacyBFires).toBeGreaterThan(0);
		});

		// Per-side: the supersedes rule is independent per renderable. If
		// A defines `onCollisionActive` and B defines only `onCollision`,
		// A gets modern semantics and B keeps legacy semantics for the
		// same pair.
		it("supersedes is per-side, not per-pair", () => {
			const fires: string[] = [];
			class A extends Renderable {
				onCollision() {
					fires.push("A.legacy");
					return true;
				}
				onCollisionActive() {
					fires.push("A.modern");
				}
			}
			class B extends Renderable {
				onCollision() {
					fires.push("B.legacy");
					return true;
				}
			}
			const a = new A(100, 100, 32, 32);
			adapter.addBody(a, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const b = new B(0, 200, 800, 20);
			adapter.addBody(b, {
				type: "static",
				shapes: [new Rect(0, 0, 800, 20)],
			});
			for (let i = 0; i < 120; i++) {
				adapter.step(16);
			}
			// A: only modern fires
			expect(fires.filter((s) => s === "A.legacy").length).toEqual(0);
			expect(fires.filter((s) => s === "A.modern").length).toBeGreaterThan(0);
			// B: only legacy fires (B has no modern handler so the rule
			// doesn't apply to it; legacy keeps dispatching).
			expect(fires.filter((s) => s === "B.legacy").length).toBeGreaterThan(0);
		});

		// Regression: destroy() must Matter.Events.off its listeners. Without
		// it, init→destroy→init→step double-dispatches every event.
		it("destroy() removes matter event listeners (no double-dispatch after re-init)", () => {
			const fires: string[] = [];
			class Probe extends Renderable {
				onCollisionStart() {
					fires.push("start");
				}
			}
			// init #1 → register listeners → destroy → re-init
			const w1 = adapter.world;
			adapter.destroy();
			adapter.init(w1);
			// now drive a contact and verify exactly one onCollisionStart
			const floor = new Probe(0, 200, 800, 20);
			adapter.addBody(floor, {
				type: "static",
				shapes: [new Rect(0, 0, 800, 20)],
			});
			const ball = new Probe(100, 100, 32, 32);
			adapter.addBody(ball, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			for (let i = 0; i < 60; i++) {
				adapter.step(16);
			}
			// Exactly one start per renderable (2 total). If destroy left
			// the previous listeners attached we'd see 4.
			expect(fires.length).toBeLessThanOrEqual(2);
			expect(fires.length).toBeGreaterThanOrEqual(1);
		});

		// Regression: updateShape used to drop the body's velocity and
		// angular velocity (removeBody + addBody starts fresh). A moving
		// body whose shape changed mid-flight would stop dead.
		it("updateShape preserves linear + angular velocity", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.setVelocity(r, new Vector2d(5, -3));
			// swap to a smaller shape mid-flight
			adapter.updateShape(r, [new Rect(0, 0, 16, 16)]);
			const v = adapter.getVelocity(r);
			expect(v.x).toBeCloseTo(5, 3);
			expect(v.y).toBeCloseTo(-3, 3);
		});

		// `response.normal` is the receiver's MTV — the direction `this` must
		// move to separate from `other`. Matter's raw `pair.collision.normal`
		// is the MTV of `bodyA`; for the B-side dispatch the adapter negates
		// so each handler reads its own MTV. A ball landing on a floor below
		// it must be pushed UP to separate → `normal.y < 0`.
		it("response.normal is the receiver's MTV (matter-native)", () => {
			let captured:
				| { ay: number; by: number; nx: number; ny: number; depth: number }
				| undefined;
			class Top extends Renderable {
				onCollisionStart(response: unknown, _other: Renderable) {
					if (captured) return;
					const r = response as {
						normal: { x: number; y: number };
						depth: number;
						a: Renderable;
						b: Renderable;
					};
					captured = {
						ay: r.a.pos.y,
						by: r.b.pos.y,
						nx: r.normal.x,
						ny: r.normal.y,
						depth: r.depth,
					};
				}
			}
			const floor = new Renderable(0, 200, 800, 20);
			adapter.addBody(floor, {
				type: "static",
				shapes: [new Rect(0, 0, 800, 20)],
			});
			const ball = new Top(100, 100, 32, 32);
			adapter.addBody(ball, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			for (let i = 0; i < 60; i++) {
				adapter.step(16);
			}
			expect(captured).toBeDefined();
			// Ball (above) lands on floor (below) — MTV of the ball points up
			// (separate by moving away from the floor).
			expect(captured!.ay).toBeLessThan(captured!.by);
			expect(captured!.ny).toBeLessThan(0);
			expect(captured!.depth).toBeGreaterThan(0);
		});

		// The B-side dispatch mirrors the normal so both handlers receive
		// their own MTV. The floor under a falling ball must be pushed DOWN
		// to separate → its normal.y > 0, opposite of the ball's.
		it("response.normal is mirrored on the partner side", () => {
			const seen: Array<{ self: string; ny: number }> = [];
			class Tagged extends Renderable {
				tag: string;
				constructor(tag: string, x: number, y: number, w: number, h: number) {
					super(x, y, w, h);
					this.tag = tag;
				}
				onCollisionStart(response: unknown, _other: Renderable) {
					const r = response as { normal: { y: number } };
					seen.push({ self: this.tag, ny: r.normal.y });
				}
			}
			const floor = new Tagged("floor", 0, 200, 800, 20);
			adapter.addBody(floor, {
				type: "static",
				shapes: [new Rect(0, 0, 800, 20)],
			});
			const ball = new Tagged("ball", 100, 100, 32, 32);
			adapter.addBody(ball, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			for (let i = 0; i < 60; i++) {
				adapter.step(16);
			}
			const ballSide = seen.find((s) => s.self === "ball");
			const floorSide = seen.find((s) => s.self === "floor");
			expect(ballSide).toBeDefined();
			expect(floorSide).toBeDefined();
			expect(ballSide!.ny).toBeLessThan(0);
			expect(floorSide!.ny).toBeGreaterThan(0);
			expect(ballSide!.ny).toBeCloseTo(-floorSide!.ny, 5);
		});

		// `response.pair` exposes the raw matter Pair for advanced use.
		it("response.pair exposes the raw matter Pair", () => {
			let pair: unknown;
			class Top extends Renderable {
				onCollisionStart(response: unknown, _other: Renderable) {
					if (pair) return;
					pair = (response as { pair: unknown }).pair;
				}
			}
			const floor = new Renderable(0, 200, 800, 20);
			adapter.addBody(floor, {
				type: "static",
				shapes: [new Rect(0, 0, 800, 20)],
			});
			const ball = new Top(100, 100, 32, 32);
			adapter.addBody(ball, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			for (let i = 0; i < 60; i++) {
				adapter.step(16);
			}
			const p = pair as
				| {
						bodyA?: unknown;
						bodyB?: unknown;
						collision?: { normal: { x: number; y: number }; depth: number };
				  }
				| undefined;
			expect(p).toBeDefined();
			expect(p!.bodyA).toBeDefined();
			expect(p!.bodyB).toBeDefined();
			expect(p!.collision?.depth).toBeGreaterThan(0);
		});
	});

	describe("raycast / queryAABB", () => {
		it("raycast hits a body in the ray's path", () => {
			const target = new Renderable(200, 100, 32, 32);
			adapter.addBody(target, {
				type: "static",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.step(16); // give matter a chance to settle bounds
			const hit = adapter.raycast(new Vector2d(0, 116), new Vector2d(400, 116));
			expect(hit).not.toBeNull();
			expect(hit?.renderable).toBe(target);
		});

		it("raycast returns null when nothing is in the path", () => {
			adapter.step(16);
			const hit = adapter.raycast(new Vector2d(0, 0), new Vector2d(10, 0));
			expect(hit).toBeNull();
		});

		it("queryAABB returns renderables overlapping the rectangle", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "static",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.step(16);
			const matches = adapter.queryAABB(new Rect(90, 90, 50, 50));
			expect(matches).toContain(r);
		});
	});
});
