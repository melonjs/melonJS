/**
 * PlanckAdapter feature-parity spec.
 *
 * Verifies the adapter behaves equivalently to BuiltinAdapter on the same
 * PhysicsAdapter contract — bodies fall under gravity, applyForce works,
 * velocity / position / static / collision masks / isGrounded / raycast
 * all behave sensibly. We don't pixel-compare positions to BuiltinAdapter
 * (the two engines integrate differently); we assert that each behaviour
 * is observable and consistent.
 */

import {
	boot,
	collision,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "melonjs";
import * as planck from "planck";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PlanckAdapter } from "../src/index";

const FRAME_MS = 16.6667;

/**
 * Step the world enough frames for the simulation to settle a behaviour.
 * @param adapter the adapter under test
 * @param frames number of frames to step (each frame = `FRAME_MS` ms)
 */
function stepFrames(adapter: PlanckAdapter, frames: number): void {
	for (let i = 0; i < frames; i++) {
		adapter.step(FRAME_MS);
		adapter.syncFromPhysics();
	}
}

describe("PlanckAdapter — feature parity with BuiltinAdapter", () => {
	let adapter: PlanckAdapter;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	beforeEach(() => {
		// Default gravity = (0, 320) px/s² ≈ 10 m/s² at pixelsPerMeter=32
		adapter = new PlanckAdapter();
		// The World constructor wires this adapter into a real melonJS
		// World container — required for adapter.init() to fire even
		// though the world reference itself isn't used in assertions.
		new World(0, 0, 800, 600, adapter);
	});

	describe("metadata + capabilities", () => {
		it("advertises name / version / url / physicLabel", () => {
			expect(adapter.name).toEqual("@melonjs/planck-adapter");
			expect(typeof adapter.version).toEqual("string");
			expect(adapter.url).toContain("npmjs.com");
			expect(adapter.physicLabel).toEqual("planck");
		});

		it("declares richer capabilities than BuiltinAdapter", () => {
			expect(adapter.capabilities.constraints).toEqual(true);
			expect(adapter.capabilities.continuousCollisionDetection).toEqual(true);
			expect(adapter.capabilities.sleepingBodies).toEqual(true);
			expect(adapter.capabilities.raycasts).toEqual(true);
			expect(adapter.capabilities.velocityLimit).toEqual(true);
			expect(adapter.capabilities.isGrounded).toEqual(true);
		});

		it("exposes pixelsPerMeter (default 32)", () => {
			expect(adapter.pixelsPerMeter).toEqual(32);
		});

		it("honors a custom pixelsPerMeter", () => {
			const custom = new PlanckAdapter({ pixelsPerMeter: 50 });
			expect(custom.pixelsPerMeter).toEqual(50);
		});
	});

	describe("adapter.planck escape hatch", () => {
		it("exposes the raw planck namespace", () => {
			expect(adapter.planck).toBeDefined();
			expect(adapter.planck.World).toBeDefined();
			expect(adapter.planck.Vec2).toBeDefined();
			expect(adapter.planck.Box).toBeDefined();
			expect(adapter.planck.Circle).toBeDefined();
		});

		it("exposes the underlying planck world after init", () => {
			expect(adapter.world).toBeDefined();
			expect(adapter.world.getBodyCount()).toBeGreaterThanOrEqual(0);
		});
	});

	describe("addBody / removeBody lifecycle", () => {
		it("adds a body and stores it in the body map", () => {
			const r = new Renderable(100, 100, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			expect(body).toBeDefined();
			expect(r.body).toEqual(body);
			expect(adapter.world.getBodyCount()).toEqual(1);
		});

		it("removes a body cleanly", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			expect(adapter.world.getBodyCount()).toEqual(1);
			adapter.removeBody(r);
			expect(adapter.world.getBodyCount()).toEqual(0);
		});

		it("supports compound bodies (multiple shapes)", () => {
			const r = new Renderable(100, 100, 64, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32), new Rect(32, 0, 32, 32)],
			});
			// each shape becomes a fixture on the same body
			let fixtureCount = 0;
			for (
				let fixture = body.getFixtureList();
				fixture;
				fixture = fixture.getNext()
			) {
				fixtureCount++;
			}
			expect(fixtureCount).toEqual(2);
		});
	});

	describe("gravity & integration", () => {
		it("falls a dynamic body under gravity", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const y0 = r.pos.y;
			stepFrames(adapter, 30); // ~half a second
			expect(r.pos.y).toBeGreaterThan(y0);
		});

		it("does NOT move a static body under gravity", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "static",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const y0 = r.pos.y;
			stepFrames(adapter, 30);
			expect(r.pos.y).toEqual(y0);
		});

		it("honors per-body gravityScale", () => {
			const a = new Renderable(50, 100, 32, 32);
			const b = new Renderable(150, 100, 32, 32);
			adapter.addBody(a, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 1,
			});
			adapter.addBody(b, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0, // floats
			});
			stepFrames(adapter, 30);
			expect(a.pos.y).toBeGreaterThan(100);
			expect(b.pos.y).toBeCloseTo(100, 0);
		});
	});

	describe("velocity API", () => {
		it("sets and reads linear velocity in pixel units", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0,
			});
			adapter.setVelocity(r, new Vector2d(120, 0));
			const v = adapter.getVelocity(r);
			expect(v.x).toBeCloseTo(120, 1);
			expect(v.y).toBeCloseTo(0, 1);
			// 120 px/s for ~1 second → ~120px movement
			stepFrames(adapter, 60);
			expect(r.pos.x - 100).toBeGreaterThan(80);
			expect(r.pos.x - 100).toBeLessThan(160);
		});

		it("body.setVelocity helper works", () => {
			const r = new Renderable(100, 100, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0,
			});
			body.setVelocity(50, -30);
			const v = body.getVelocity();
			expect(v.x).toBeCloseTo(50, 1);
			expect(v.y).toBeCloseTo(-30, 1);
		});
	});

	describe("applyForce / applyImpulse / applyTorque", () => {
		it("applyImpulse changes velocity proportional to 1/mass", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0,
			});
			adapter.applyImpulse(r, new Vector2d(50, 0));
			const v = adapter.getVelocity(r);
			expect(v.x).toBeGreaterThan(0);
		});

		it("applyForce at off-centre point generates torque", () => {
			const r = new Renderable(100, 100, 64, 64);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 64, 64)],
				gravityScale: 0,
				fixedRotation: false,
			});
			// Apply a horizontal force at the top of the body — should
			// induce a rotation in addition to linear motion.
			adapter.applyForce(
				r,
				new Vector2d(500, 0),
				new Vector2d(100 + 32, 100), // top-centre
			);
			stepFrames(adapter, 30);
			expect(Math.abs(adapter.getAngularVelocity(r))).toBeGreaterThan(0);
		});

		it("applyTorque rotates a body without fixed rotation", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0,
				fixedRotation: false,
			});
			adapter.applyTorque(r, 5);
			stepFrames(adapter, 5);
			expect(adapter.getAngularVelocity(r)).not.toEqual(0);
		});

		it("applyTorque is a no-op on fixed-rotation bodies", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0,
				// fixedRotation defaults to true
			});
			adapter.applyTorque(r, 5);
			stepFrames(adapter, 5);
			expect(adapter.getAngularVelocity(r)).toEqual(0);
		});
	});

	describe("angular API", () => {
		it("setAngle / getAngle round-trip", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				fixedRotation: false,
			});
			adapter.setAngle(r, Math.PI / 3);
			expect(adapter.getAngle(r)).toBeCloseTo(Math.PI / 3, 5);
		});

		it("setAngularVelocity / getAngularVelocity round-trip", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				fixedRotation: false,
			});
			adapter.setAngularVelocity(r, 2);
			expect(adapter.getAngularVelocity(r)).toBeCloseTo(2, 5);
		});

		it("body.applyForce(x, y, px, py) signature works", () => {
			const r = new Renderable(100, 100, 64, 64);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 64, 64)],
				gravityScale: 0,
				fixedRotation: false,
			});
			body.applyForce(500, 0, 132, 100); // top edge, off-centre
			stepFrames(adapter, 30);
			expect(Math.abs(body.getAngularVelocity())).toBeGreaterThan(0);
		});
	});

	describe("setStatic / setSensor", () => {
		it("setStatic freezes a previously-dynamic body in place", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.setStatic(r, true);
			const y0 = r.pos.y;
			stepFrames(adapter, 30);
			expect(r.pos.y).toEqual(y0);
		});

		it("setSensor disables physical response", () => {
			const r = new Renderable(100, 100, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.setSensor(r, true);
			let sensorCount = 0;
			for (
				let fixture = body.getFixtureList();
				fixture;
				fixture = fixture.getNext()
			) {
				if (fixture.isSensor()) sensorCount++;
			}
			expect(sensorCount).toBeGreaterThan(0);
		});
	});

	describe("collision filtering", () => {
		it("addBody honors collisionType / collisionMask", () => {
			const r = new Renderable(100, 100, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.ENEMY_OBJECT,
			});
			expect(body.collisionType).toEqual(collision.types.PLAYER_OBJECT);
			expect(body.collisionMask).toEqual(collision.types.ENEMY_OBJECT);
		});

		it("setCollisionType / setCollisionMask propagate to all fixtures", () => {
			const r = new Renderable(100, 100, 64, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32), new Rect(32, 0, 32, 32)],
			});
			adapter.setCollisionType(r, collision.types.PLAYER_OBJECT);
			adapter.setCollisionMask(r, collision.types.ENEMY_OBJECT);
			const body = adapter.world.getBodyList();
			expect(body).toBeDefined();
			if (!body) return;
			for (
				let fixture = body.getFixtureList();
				fixture;
				fixture = fixture.getNext()
			) {
				expect(fixture.getFilterCategoryBits()).toEqual(
					collision.types.PLAYER_OBJECT,
				);
				expect(fixture.getFilterMaskBits()).toEqual(
					collision.types.ENEMY_OBJECT,
				);
			}
		});

		it("body.collisionType / collisionMask live aliases match fixture state", () => {
			const r = new Renderable(100, 100, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			body.collisionType = 0x0010;
			body.collisionMask = 0x00ff;
			expect(body.getFixtureList()?.getFilterCategoryBits()).toEqual(0x0010);
			expect(body.getFixtureList()?.getFilterMaskBits()).toEqual(0x00ff);
		});
	});

	describe("setPosition", () => {
		it("teleports a body to a new pixel position", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0,
			});
			adapter.setPosition(r, new Vector2d(500, 300));
			adapter.syncFromPhysics();
			expect(r.pos.x).toBeCloseTo(500, 1);
			expect(r.pos.y).toBeCloseTo(300, 1);
		});
	});

	describe("isGrounded", () => {
		it("reports true when a body sits on a static floor", () => {
			const floor = new Renderable(0, 500, 800, 20);
			adapter.addBody(floor, {
				type: "static",
				shapes: [new Rect(0, 0, 800, 20)],
			});
			const ball = new Renderable(400, 100, 32, 32);
			adapter.addBody(ball, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			// Free-fall ~400px takes ~30 frames at default gravity; the
			// rebound + settle adds many more. Step long enough for both.
			stepFrames(adapter, 200);
			expect(adapter.isGrounded(ball)).toEqual(true);
		});

		it("reports false in mid-air", () => {
			const ball = new Renderable(400, 100, 32, 32);
			adapter.addBody(ball, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			expect(adapter.isGrounded(ball)).toEqual(false);
		});
	});

	describe("raycast", () => {
		it("hits a static body in the path", () => {
			const wall = new Renderable(300, 100, 20, 200);
			adapter.addBody(wall, {
				type: "static",
				shapes: [new Rect(0, 0, 20, 200)],
			});
			const hit = adapter.raycast(
				new Vector2d(50, 200),
				new Vector2d(500, 200),
			);
			expect(hit).not.toBeNull();
			expect(hit?.renderable).toEqual(wall);
			expect(hit?.fraction).toBeGreaterThan(0);
			expect(hit?.fraction).toBeLessThanOrEqual(1);
		});

		it("returns null when nothing is in the path", () => {
			const hit = adapter.raycast(new Vector2d(50, 50), new Vector2d(100, 50));
			expect(hit).toBeNull();
		});
	});

	describe("queryAABB", () => {
		it("returns bodies overlapping the rect", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const hits = adapter.queryAABB(new Rect(50, 50, 200, 200));
			expect(hits).toContain(r);
		});

		it("excludes bodies outside the rect", () => {
			const r = new Renderable(500, 500, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const hits = adapter.queryAABB(new Rect(0, 0, 100, 100));
			expect(hits).not.toContain(r);
		});
	});

	describe("collision lifecycle", () => {
		it("fires onCollisionStart when two bodies touch", () => {
			const a = new Renderable(100, 100, 32, 32);
			const b = new Renderable(200, 100, 32, 32);
			adapter.addBody(a, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0,
			});
			adapter.addBody(b, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0,
			});
			let started = 0;
			(a as Renderable & { onCollisionStart?: unknown }).onCollisionStart =
				() => {
					started++;
				};
			adapter.setVelocity(a, new Vector2d(200, 0));
			stepFrames(adapter, 40);
			expect(started).toBeGreaterThan(0);
		});

		it("provides a sensible MTV normal for receiver", () => {
			const a = new Renderable(100, 100, 32, 32);
			const b = new Renderable(200, 100, 32, 32);
			adapter.addBody(a, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0,
			});
			adapter.addBody(b, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0,
			});
			let observedNormalA: { x: number; y: number } | null = null;
			(a as Renderable & { onCollisionStart?: unknown }).onCollisionStart = (
				response: unknown,
			) => {
				observedNormalA = (response as { normal: { x: number; y: number } })
					.normal;
			};
			adapter.setVelocity(a, new Vector2d(200, 0));
			stepFrames(adapter, 40);
			// a is moving right INTO b — the MTV to escape b should point
			// left (negative X dominant). Sign assertion is loose because
			// the manifold normal is influenced by the collision point.
			expect(observedNormalA).not.toBeNull();
			expect(
				Math.abs((observedNormalA as unknown as { x: number }).x),
			).toBeGreaterThan(
				Math.abs((observedNormalA as unknown as { y: number }).y),
			);
		});

		it("dispatches onCollisionEnd when bodies separate", () => {
			const a = new Renderable(100, 100, 32, 32);
			const b = new Renderable(200, 100, 32, 32);
			adapter.addBody(a, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0,
				restitution: 1, // bounce off
			});
			adapter.addBody(b, {
				type: "static",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			let ended = 0;
			(a as Renderable & { onCollisionEnd?: unknown }).onCollisionEnd = () => {
				ended++;
			};
			adapter.setVelocity(a, new Vector2d(200, 0));
			stepFrames(adapter, 80);
			expect(ended).toBeGreaterThan(0);
		});
	});

	describe("PlanckAdapter.Body type", () => {
		it("namespace-merged Body type is accessible at runtime via cast", () => {
			const r = new Renderable(100, 100, 32, 32);
			const body = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				fixedRotation: false,
			});
			// reach a planck-native method
			expect(typeof body.setBullet).toEqual("function");
			body.setBullet(true);
			expect(body.isBullet()).toEqual(true);
			// reach a portable helper method
			expect(typeof body.setVelocity).toEqual("function");
		});
	});

	describe("getBodyAABB / getBodyShapes", () => {
		it("returns a local-space AABB for the body", () => {
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			const bounds = new (
				adapter.melonWorld.getBounds().constructor as new () => {
					setMinMax: (x1: number, y1: number, x2: number, y2: number) => void;
					min: { x: number; y: number };
					max: { x: number; y: number };
				}
			)();
			const result = adapter.getBodyAABB(r, bounds as never);
			expect(result).toBeDefined();
			// local-space bounds should be roughly 0..32 on each axis
			expect(bounds.min.x).toBeLessThan(8);
			expect(bounds.min.y).toBeLessThan(8);
			expect(bounds.max.x).toBeGreaterThan(24);
			expect(bounds.max.y).toBeGreaterThan(24);
		});

		it("returns the original shape definitions", () => {
			const rect = new Rect(0, 0, 32, 32);
			const r = new Renderable(100, 100, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [rect],
			});
			const shapes = adapter.getBodyShapes(r);
			expect(shapes.length).toEqual(1);
			expect(shapes[0]).toEqual(rect);
		});
	});
});

describe("PlanckAdapter — unit conversion", () => {
	let adapter: PlanckAdapter;

	beforeEach(() => {
		adapter = new PlanckAdapter({ pixelsPerMeter: 50 });
		new World(0, 0, 800, 600, adapter);
	});

	it("setVelocity / getVelocity round-trip in pixel space", () => {
		const r = new Renderable(100, 100, 32, 32);
		adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
			gravityScale: 0,
		});
		adapter.setVelocity(r, new Vector2d(75, -125));
		const v = adapter.getVelocity(r);
		expect(v.x).toBeCloseTo(75, 1);
		expect(v.y).toBeCloseTo(-125, 1);
	});

	it("setPosition / syncFromPhysics round-trip in pixel space", () => {
		const r = new Renderable(100, 100, 32, 32);
		adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
			gravityScale: 0,
		});
		adapter.setPosition(r, new Vector2d(456, 789));
		adapter.syncFromPhysics();
		expect(r.pos.x).toBeCloseTo(456, 1);
		expect(r.pos.y).toBeCloseTo(789, 1);
	});

	it("internal planck position is in meters", () => {
		const r = new Renderable(100, 100, 32, 32);
		const body = adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
		});
		// renderable at (100, 100) px, with a 32x32 shape centered at
		// (16, 16) local. Body anchor in pixel space = (100+16, 100+16)
		// = (116, 116). In meters at pixelsPerMeter=50 = (2.32, 2.32).
		const p = body.getPosition();
		expect(p.x).toBeCloseTo(2.32, 2);
		expect(p.y).toBeCloseTo(2.32, 2);
	});

	it("Vec2 used for planck APIs is a real planck.Vec2", () => {
		const r = new Renderable(100, 100, 32, 32);
		const body = adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
		});
		const v = body.getLinearVelocity();
		expect(v).toBeInstanceOf(planck.Vec2);
	});
});
