/**
 * Cross-adapter parity spec — `BuiltinAdapter` vs `PlanckAdapter`.
 *
 * Mirror of `@melonjs/matter-adapter/tests/parity.spec.ts`. Runs the
 * same test body against both adapters to catch behavioural drift in
 * the shared `PhysicsAdapter` contract. Things that are *supposed* to
 * be identical regardless of physics engine live here; things that
 * are inherently engine-dependent (Box2D's meters-based units, native
 * rotational dynamics, sleeping bodies, etc.) belong in the adapter's
 * own spec instead.
 *
 * If a test in this file passes on one adapter and fails on the other,
 * that's a real bug in adapter parity, not an "expected difference."
 */

import {
	Bounds,
	BuiltinAdapter,
	boot,
	collision,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PlanckAdapter } from "../src/index";

interface AdapterFactory {
	name: string;
	make(): {
		adapter: BuiltinAdapter | PlanckAdapter;
		world: World;
	};
	/**
	 * Decimal-place precision for AABB assertions. The builtin SAT
	 * adapter is exact (precision 1 → within 0.05 px). Planck converts
	 * positions through meters, and Box2D's polygon `radius`
	 * (≈ 2 × b2_linearSlop ≈ 0.32 px at the default `pixelsPerMeter`)
	 * inflates AABBs by that amount in each direction — too far for
	 * precision 1, fine at precision 0 (within 0.5 px).
	 */
	aabbPrecision: number;
	/** Expected `adapter.capabilities` shape — pinned per adapter. */
	expectedCapabilities: {
		constraints: boolean;
		continuousCollisionDetection: boolean;
		sleepingBodies: boolean;
		raycasts: boolean;
		velocityLimit: boolean;
		isGrounded: boolean;
	};
}

const factories: AdapterFactory[] = [
	{
		name: "BuiltinAdapter",
		aabbPrecision: 1,
		expectedCapabilities: {
			constraints: false,
			continuousCollisionDetection: false,
			sleepingBodies: false,
			raycasts: true,
			velocityLimit: true,
			isGrounded: true,
		},
		make() {
			const adapter = new BuiltinAdapter({
				gravity: new Vector2d(0, 1),
			});
			const world = new World(0, 0, 800, 600, adapter);
			return { adapter, world };
		},
	},
	{
		name: "PlanckAdapter",
		aabbPrecision: 0,
		expectedCapabilities: {
			constraints: true,
			continuousCollisionDetection: true,
			sleepingBodies: true,
			raycasts: true,
			velocityLimit: true,
			isGrounded: true,
		},
		make() {
			// Gravity is in px/s² at the adapter surface (planck converts
			// to meters internally via `pixelsPerMeter`). Use a real
			// gravity value so the collision-lifecycle tests' 60-tick
			// fall window actually produces a contact — at the matter
			// parity's `(0, 1)`, planck would integrate at 0.03 m/s²
			// and the ball wouldn't reach the floor.
			const adapter = new PlanckAdapter({
				gravity: new Vector2d(0, 320),
			});
			const world = new World(0, 0, 800, 600, adapter);
			return { adapter, world };
		},
	},
];

beforeAll(() => {
	boot();
	video.init(800, 600, {
		parent: "screen",
		scale: "auto",
		renderer: video.CANVAS,
	});
});

for (const { name, make, aabbPrecision, expectedCapabilities } of factories) {
	describe(`Adapter parity — ${name}`, () => {
		let adapter: BuiltinAdapter | PlanckAdapter;
		let world: World;

		beforeEach(() => {
			({ adapter, world } = make());
		});

		// Helper: add a renderable to the world container. The builtin
		// adapter only integrates bodies whose renderable is in the scene
		// tree (`body.ancestor` set); planck integrates anything added to
		// the world. Going through the world container is the realistic
		// usage and makes the two adapters comparable.
		const addToWorld = (
			r: Renderable,
			def: Parameters<typeof adapter.addBody>[1],
		) => {
			r.alwaysUpdate = true;
			r.bodyDef = def;
			world.addChild(r);
			return r;
		};

		describe("velocity API", () => {
			it("velocity round-trips through set/get", () => {
				const r = addToWorld(new Renderable(100, 100, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.setVelocity(r, new Vector2d(3.5, -2.0));
				const out = adapter.getVelocity(r);
				expect(out.x).toBeCloseTo(3.5, 3);
				expect(out.y).toBeCloseTo(-2.0, 3);
			});

			it("static body ignores gravity", () => {
				const r = addToWorld(new Renderable(100, 100, 32, 32), {
					type: "static",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const startY = r.pos.y;
				for (let i = 0; i < 60; i++) {
					adapter.step(16);
				}
				adapter.syncFromPhysics();
				expect(Math.abs(r.pos.y - startY)).toBeLessThan(0.01);
			});

			it("dynamic body falls under gravity", () => {
				const r = addToWorld(new Renderable(100, 100, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const startY = r.pos.y;
				for (let i = 0; i < 60; i++) {
					adapter.step(16);
				}
				adapter.syncFromPhysics();
				expect(r.pos.y).toBeGreaterThan(startY);
			});
		});

		describe("body lifecycle", () => {
			it("removeBody silently no-ops on unknown renderables", () => {
				const r = new Renderable(0, 0, 32, 32);
				// removed without having been added — must not throw
				expect(() => {
					adapter.removeBody(r);
				}).not.toThrow();
			});

			it("removed body no longer integrates", () => {
				const r = addToWorld(new Renderable(100, 100, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.step(16);
				adapter.syncFromPhysics();
				adapter.removeBody(r);
				const yAtRemove = r.pos.y;
				for (let i = 0; i < 30; i++) {
					adapter.step(16);
				}
				adapter.syncFromPhysics();
				expect(Math.abs(r.pos.y - yAtRemove)).toBeLessThan(0.1);
			});
		});

		describe("collision filter", () => {
			it("setCollisionType propagates to body", () => {
				const r = addToWorld(new Renderable(0, 0, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
					collisionType: collision.types.PLAYER_OBJECT,
				});
				adapter.setCollisionType(r, collision.types.ENEMY_OBJECT);
				expect(
					(r.body as unknown as { collisionType?: number }).collisionType,
				).toEqual(collision.types.ENEMY_OBJECT);
			});

			it("setCollisionMask propagates to body", () => {
				const r = addToWorld(new Renderable(0, 0, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.setCollisionMask(
					r,
					collision.types.WORLD_SHAPE | collision.types.PLAYER_OBJECT,
				);
				expect(
					(r.body as unknown as { collisionMask?: number }).collisionMask,
				).toEqual(collision.types.WORLD_SHAPE | collision.types.PLAYER_OBJECT);
			});
		});

		describe("static toggle", () => {
			it("setStatic stops a falling body in place", () => {
				const r = addToWorld(new Renderable(100, 100, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				for (let i = 0; i < 10; i++) {
					adapter.step(16);
				}
				adapter.syncFromPhysics();
				adapter.setStatic(r, true);
				const lockedY = r.pos.y;
				for (let i = 0; i < 30; i++) {
					adapter.step(16);
				}
				adapter.syncFromPhysics();
				expect(Math.abs(r.pos.y - lockedY)).toBeLessThan(0.5);
			});
		});

		describe("setSensor", () => {
			it("is callable through the interface (typed optional)", () => {
				const r = addToWorld(new Renderable(0, 0, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				expect(typeof adapter.setSensor).toEqual("function");
				expect(() => {
					adapter.setSensor?.(r, true);
				}).not.toThrow();
				expect(() => {
					adapter.setSensor?.(r, false);
				}).not.toThrow();
			});
		});

		describe("regression — Container.removeChild auto-cleanup", () => {
			// Pool-recycled entities frequently take this path. `Container.
			// removeChildNow` used to only call the adapter's removeBody
			// when `child.body instanceof Body` (legacy melonJS Body).
			// Third-party adapter bodies failed that check and stayed in
			// the engine after the renderable was destroyed.
			it("removeChild also removes the adapter-managed body", () => {
				const r = addToWorld(new Renderable(100, 100, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.setVelocity(r, new Vector2d(5, 0));
				world.removeChildNow(r, true /* keepalive */);
				expect(adapter.getVelocity(r).x).toEqual(0);
			});
		});

		describe("collision lifecycle events", () => {
			// Drop a ball onto a floor and watch start/active/end fire.
			const setupContact = () => {
				const events: { kind: string; tick: number }[] = [];
				let tick = 0;
				class Reporter extends Renderable {
					onCollisionStart() {
						events.push({ kind: "start", tick });
					}
					onCollisionActive() {
						events.push({ kind: "active", tick });
					}
					onCollisionEnd() {
						events.push({ kind: "end", tick });
					}
				}
				const floor = new Reporter(0, 200, 800, 20);
				addToWorld(floor, {
					type: "static",
					shapes: [new Rect(0, 0, 800, 20)],
				});
				const ball = new Reporter(100, 150, 32, 32);
				addToWorld(ball, {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const step = (n = 1) => {
					for (let i = 0; i < n; i++) {
						tick++;
						// world.update populates the SAT broadphase and then
						// calls adapter.step — that's the realistic path the
						// engine takes each frame. Stepping the adapter
						// directly (as the simpler tests do) skips the
						// broadphase, so SAT finds no collision candidates.
						world.update(16);
					}
					adapter.syncFromPhysics();
				};
				return { events, step, floor, ball };
			};

			it("onCollisionStart fires exactly once per contact entry", () => {
				const { events, step } = setupContact();
				step(60);
				const starts = events.filter((e) => e.kind === "start");
				// 2 = one per renderable (both have a Reporter handler); the
				// key point is the count is small and bounded — *not*
				// multiplied per active-frame.
				expect(starts.length).toBeLessThanOrEqual(2);
				expect(starts.length).toBeGreaterThanOrEqual(1);
			});

			it("onCollisionActive fires while bodies remain in contact", () => {
				const { events, step } = setupContact();
				step(60);
				const actives = events.filter((e) => e.kind === "active");
				expect(actives.length).toBeGreaterThan(5);
			});

			it("onCollisionEnd fires when bodies separate", () => {
				const { events, step, ball } = setupContact();
				// Step long enough for the ball to actually reach the floor
				// under both gravity regimes (builtin per-frame, planck
				// per-second). 60 ticks is the same window the start /
				// active tests use to register contact.
				step(60);
				adapter.setPosition(ball, new Vector2d(2000, 0));
				step(30);
				const ends = events.filter((e) => e.kind === "end");
				expect(ends.length).toBeGreaterThan(0);
			});
		});

		describe("debug API (getBodyAABB / getBodyShapes)", () => {
			// Adapter-side debug surface. Both methods must return geometry
			// in renderable-LOCAL coordinates (relative to renderable.pos),
			// so `@melonjs/debug-plugin` can blit them after translating
			// to the renderable origin without knowing whether the
			// underlying engine uses a world- or local-space body frame.
			it("getBodyAABB returns local-space bounds", () => {
				const r = addToWorld(new Renderable(100, 200, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const out = new Bounds();
				const aabb = adapter.getBodyAABB?.(r, out);
				expect(aabb).toBeDefined();
				expect(aabb!.left).toBeCloseTo(0, aabbPrecision);
				expect(aabb!.top).toBeCloseTo(0, aabbPrecision);
				// Dimensions are `right - left`, so any per-edge drift
				// doubles. Use a slightly wider tolerance than the
				// single-coordinate precision.
				expect(Math.abs(aabb!.width - 32)).toBeLessThanOrEqual(1);
				expect(Math.abs(aabb!.height - 32)).toBeLessThanOrEqual(1);
			});

			it("getBodyAABB writes into the supplied out Bounds", () => {
				const r = addToWorld(new Renderable(50, 50, 16, 16), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 16, 16)],
				});
				const out = new Bounds();
				const aabb = adapter.getBodyAABB?.(r, out);
				expect(aabb).toBe(out); // same reference, no allocation
			});

			it("getBodyAABB returns undefined for unregistered renderables", () => {
				const r = new Renderable(0, 0, 32, 32);
				const out = new Bounds();
				expect(adapter.getBodyAABB?.(r, out)).toBeUndefined();
			});

			it("getBodyShapes returns the body's shape list", () => {
				const shape = new Rect(0, 0, 32, 32);
				const r = addToWorld(new Renderable(0, 0, 32, 32), {
					type: "dynamic",
					shapes: [shape],
				});
				const shapes = adapter.getBodyShapes?.(r);
				expect(shapes).toBeDefined();
				expect(shapes.length).toEqual(1);
			});

			it("getBodyShapes returns an empty list for unregistered renderables", () => {
				const r = new Renderable(0, 0, 32, 32);
				const shapes = adapter.getBodyShapes?.(r);
				expect(shapes).toBeDefined();
				expect(shapes.length).toEqual(0);
			});
		});

		describe("debug API: coordinate-space adversarial", () => {
			// These tests pin down the contract the debug plugin depends
			// on: `getBodyAABB` must return bounds in **renderable-local**
			// coordinates regardless of where the renderable lives in the
			// world or how the body has been moved since registration.
			it("AABB stays local-space at a non-trivial world position", () => {
				const r = addToWorld(new Renderable(500, 300, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const aabb = adapter.getBodyAABB?.(r, new Bounds())!;
				expect(aabb.left).toBeCloseTo(0, aabbPrecision);
				expect(aabb.top).toBeCloseTo(0, aabbPrecision);
				expect(aabb.right).toBeCloseTo(32, aabbPrecision);
				expect(aabb.bottom).toBeCloseTo(32, aabbPrecision);
			});

			it("AABB stays local-space at NEGATIVE world coords", () => {
				const r = addToWorld(new Renderable(-450, -275, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const aabb = adapter.getBodyAABB?.(r, new Bounds())!;
				expect(aabb.left).toBeCloseTo(0, aabbPrecision);
				expect(aabb.top).toBeCloseTo(0, aabbPrecision);
				expect(aabb.right).toBeCloseTo(32, aabbPrecision);
				expect(aabb.bottom).toBeCloseTo(32, aabbPrecision);
			});

			it("AABB reflects an OFFSET shape inside the renderable", () => {
				const r = addToWorld(new Renderable(0, 0, 64, 64), {
					type: "dynamic",
					shapes: [new Rect(10, 12, 32, 40)],
				});
				const aabb = adapter.getBodyAABB?.(r, new Bounds())!;
				expect(aabb.left).toBeCloseTo(10, 0);
				expect(aabb.top).toBeCloseTo(12, 0);
				expect(Math.abs(aabb.width - 32)).toBeLessThanOrEqual(1);
				expect(Math.abs(aabb.height - 40)).toBeLessThanOrEqual(1);
			});

			it("AABB encompasses a multi-shape body in local coords", () => {
				const r = addToWorld(new Renderable(200, 200, 64, 64), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 16, 16), new Rect(0, 0, 48, 32)],
				});
				const aabb = adapter.getBodyAABB?.(r, new Bounds())!;
				expect(aabb.left).toBeCloseTo(0, 0);
				expect(aabb.top).toBeCloseTo(0, 0);
				expect(Math.abs(aabb.right - 48)).toBeLessThanOrEqual(1);
				expect(Math.abs(aabb.bottom - 32)).toBeLessThanOrEqual(1);
			});

			it("AABB stays local-space across many simulation steps (static body)", () => {
				const r = addToWorld(new Renderable(100, 100, 32, 32), {
					type: "static",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const before = adapter.getBodyAABB?.(r, new Bounds())!;
				const beforeLeft = before.left;
				const beforeTop = before.top;
				const beforeRight = before.right;
				const beforeBottom = before.bottom;
				for (let i = 0; i < 50; i++) {
					adapter.step(16);
				}
				const after = adapter.getBodyAABB?.(r, new Bounds())!;
				expect(after.left).toBeCloseTo(beforeLeft, 3);
				expect(after.top).toBeCloseTo(beforeTop, 3);
				expect(after.right).toBeCloseTo(beforeRight, 3);
				expect(after.bottom).toBeCloseTo(beforeBottom, 3);
			});

			it("AABB stays local-space while a dynamic body is falling", () => {
				const r = addToWorld(new Renderable(100, 100, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.step(16);
				const after = adapter.getBodyAABB?.(r, new Bounds())!;
				const cx = (after.left + after.right) / 2;
				const cy = (after.top + after.bottom) / 2;
				expect(Math.abs(cx - 16)).toBeLessThan(10);
				expect(Math.abs(cy - 16)).toBeLessThan(10);
			});

			it("AABB stays local-space after adapter.setPosition teleport", () => {
				const r = addToWorld(new Renderable(0, 0, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.setPosition(r, new Vector2d(1234, -567));
				const aabb = adapter.getBodyAABB?.(r, new Bounds())!;
				expect(aabb.left).toBeCloseTo(0, aabbPrecision);
				expect(aabb.top).toBeCloseTo(0, aabbPrecision);
			});

			it("the debug-plugin draw transform reproduces the body's WORLD AABB", () => {
				const r = addToWorld(new Renderable(400, 250, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const aabb = adapter.getBodyAABB?.(r, new Bounds())!;
				const worldLeft = r.pos.x + aabb.left;
				const worldTop = r.pos.y + aabb.top;
				expect(worldLeft).toBeCloseTo(400, aabbPrecision);
				expect(worldTop).toBeCloseTo(250, aabbPrecision);
			});

			it("repeated polls are idempotent (no drift on the shared out)", () => {
				const r = addToWorld(new Renderable(123, 456, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const out1 = new Bounds();
				const out2 = new Bounds();
				adapter.getBodyAABB?.(r, out1);
				adapter.getBodyAABB?.(r, out2);
				expect(out1.left).toBeCloseTo(out2.left, 4);
				expect(out1.top).toBeCloseTo(out2.top, 4);
				expect(out1.right).toBeCloseTo(out2.right, 4);
				expect(out1.bottom).toBeCloseTo(out2.bottom, 4);
			});

			it("getBodyShapes preserves the shape origin in local coords", () => {
				const shape = new Rect(10, 12, 32, 40);
				const r = addToWorld(new Renderable(500, 600, 64, 64), {
					type: "dynamic",
					shapes: [shape],
				});
				const shapes = adapter.getBodyShapes?.(r);
				expect(shapes.length).toEqual(1);
				const sb = shapes[0].getBounds();
				expect(sb.left).toBeCloseTo(10, 0);
				expect(sb.top).toBeCloseTo(12, 0);
				expect(sb.width).toBeCloseTo(32, 0);
				expect(sb.height).toBeCloseTo(40, 0);
			});
		});

		describe("capabilities advertise honestly", () => {
			it("isGrounded capability matches actual implementation", () => {
				const advertised = adapter.capabilities.isGrounded;
				const implemented = typeof adapter.isGrounded === "function";
				expect(advertised).toEqual(implemented);
			});

			it("velocityLimit capability matches the setMaxVelocity contract", () => {
				expect(adapter.capabilities.velocityLimit).toEqual(true);
				expect(typeof adapter.setMaxVelocity).toEqual("function");
			});
		});

		describe("setAngle is callable through the interface", () => {
			it("setAngle either rotates (planck) or no-ops (builtin) without throwing", () => {
				const r = addToWorld(new Renderable(0, 0, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				expect(typeof adapter.setAngle).toEqual("function");
				expect(() => {
					adapter.setAngle?.(r, Math.PI / 4);
				}).not.toThrow();
			});
		});

		describe("destroy clears adapter state", () => {
			it("after destroy(), the body is forgotten", () => {
				const r = addToWorld(new Renderable(0, 0, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.setVelocity(r, new Vector2d(5, 5));
				expect(adapter.getVelocity(r).x).toBeCloseTo(5, 3);
				adapter.destroy?.();
				// post-destroy, the adapter should no longer report the
				// body's velocity (both adapters return 0 once unmanaged)
				expect(adapter.getVelocity(r).x).toEqual(0);
			});
		});

		describe("add-remove-add cycle keeps state consistent", () => {
			// Pool-recycled entities frequently take this path: a body is
			// registered, the entity is removed from the world, then later
			// re-added with fresh setup. The adapter must not leak the
			// previous body and must accept the same renderable again
			// without throwing.
			it("a renderable can be re-added after removeBody", () => {
				const r = new Renderable(0, 0, 32, 32);
				r.alwaysUpdate = true;
				const def = {
					type: "dynamic" as const,
					shapes: [new Rect(0, 0, 32, 32)],
				};
				r.bodyDef = def;
				world.addChild(r);
				adapter.setVelocity(r, new Vector2d(7, 0));
				adapter.removeBody(r);
				// re-adding must not throw
				expect(() => adapter.addBody(r, def)).not.toThrow();
				// after re-add, the body responds to setVelocity / getVelocity
				adapter.setVelocity(r, new Vector2d(3, 0));
				expect(adapter.getVelocity(r).x).toBeCloseTo(3, 3);
			});
		});

		describe("getVelocity with a pre-allocated out vector", () => {
			it("writes into the caller's vector and returns it", () => {
				const r = addToWorld(new Renderable(0, 0, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.setVelocity(r, new Vector2d(2.5, -1.5));
				const out = new Vector2d(99, 99);
				const result = adapter.getVelocity(r, out);
				// must reuse the supplied vector — no allocation
				expect(result).toBe(out);
				expect(out.x).toBeCloseTo(2.5, 3);
				expect(out.y).toBeCloseTo(-1.5, 3);
			});
		});

		// ----------------------------------------------------------
		// 19.5 portable surface — coverage gaps surfaced when the
		// release-prep wiki audit found `raycast` / `queryAABB` still
		// described as matter-only. They're on every adapter now;
		// these tests pin that.
		// ----------------------------------------------------------

		describe("adapter.capabilities — shape pin", () => {
			it("matches the per-adapter expected capability set exactly", () => {
				// Guards against a PR that flips a capability flag without
				// updating callers, or a refactor that drops a key. The
				// values themselves are pinned by the factory, so each
				// adapter asserts its own shape.
				expect(adapter.capabilities).toEqual(expectedCapabilities);
			});
		});

		describe("raycast — portable hit shape", () => {
			// Static box at (200,200)..(240,240). Ray from x=0 at y=220
			// crosses the left face at x≈200; from x=500 at y=220 crosses
			// the right face at x≈240. Ray well above the box must miss.
			const placeBox = () => {
				const wall = new Renderable(200, 200, 40, 40);
				wall.alwaysUpdate = true;
				wall.bodyDef = {
					type: "static",
					shapes: [new Rect(0, 0, 40, 40)],
				};
				world.addChild(wall);
				// `world.update(dt)` rebuilds the builtin broadphase each
				// frame; raycast / queryAABB walk that broadphase. planck
				// indexes on `addBody`, but a single `world.update` is the
				// portable "everything's settled" handshake here.
				world.update(16);
				return wall;
			};

			it("returns a hit with point / normal / fraction / renderable when the ray crosses a body", () => {
				const wall = placeBox();
				const hit = adapter.raycast(
					new Vector2d(0, 220),
					new Vector2d(400, 220),
				);
				expect(hit).not.toBeNull();
				expect(hit!.renderable).toBe(wall);
				expect(hit!.point.x).toBeCloseTo(200, aabbPrecision);
				expect(hit!.point.y).toBeCloseTo(220, aabbPrecision);
				expect(hit!.normal.x).toBeCloseTo(-1, aabbPrecision);
				expect(hit!.normal.y).toBeCloseTo(0, aabbPrecision);
				// (200 - 0) / (400 - 0) = 0.5
				expect(hit!.fraction).toBeCloseTo(0.5, aabbPrecision);
			});

			it("returns a right-face hit (normal flips) when shot from the other side", () => {
				placeBox();
				const hit = adapter.raycast(
					new Vector2d(500, 220),
					new Vector2d(0, 220),
				);
				expect(hit).not.toBeNull();
				expect(hit!.point.x).toBeCloseTo(240, aabbPrecision);
				expect(hit!.normal.x).toBeCloseTo(1, aabbPrecision);
			});

			it("returns null when the ray misses every body", () => {
				placeBox();
				const hit = adapter.raycast(new Vector2d(0, 50), new Vector2d(400, 50));
				expect(hit).toBeNull();
			});
		});

		describe("queryAABB — portable region query", () => {
			const placeBox = (x: number, y: number) => {
				const r = new Renderable(x, y, 40, 40);
				r.alwaysUpdate = true;
				r.bodyDef = {
					type: "static",
					shapes: [new Rect(0, 0, 40, 40)],
				};
				world.addChild(r);
				return r;
			};
			const flush = () => world.update(16);

			it("returns every body whose AABB overlaps the region", () => {
				const a = placeBox(100, 100);
				placeBox(400, 100);
				flush();
				const hits = adapter.queryAABB(new Rect(80, 80, 80, 80));
				expect(hits).toContain(a);
				expect(hits.length).toEqual(1);
			});

			it("returns an empty array when the region overlaps nothing", () => {
				placeBox(100, 100);
				flush();
				const hits = adapter.queryAABB(new Rect(500, 500, 40, 40));
				expect(hits).toEqual([]);
			});

			it("returns multiple bodies when the region spans them", () => {
				const a = placeBox(100, 100);
				const b = placeBox(200, 100);
				flush();
				const hits = adapter.queryAABB(new Rect(50, 50, 300, 100));
				expect(hits).toContain(a);
				expect(hits).toContain(b);
				expect(hits.length).toEqual(2);
			});
		});

		describe("isGrounded — in-air parity", () => {
			// Cross-adapter parity intentionally tests the in-air case
			// only — both adapters agree that an isolated body in
			// free-fall is NOT grounded. The "resting on a static floor"
			// half diverges by design: builtin tracks an internal
			// `falling` / `jumping` flag pair that gravity toggles every
			// frame, while matter / planck track real contact pairs.
			// See the BuiltinAdapter Quirks wiki page.
			it("a body in mid-air with no body below is not grounded", () => {
				const ball = new Renderable(100, 50, 32, 32);
				ball.alwaysUpdate = true;
				ball.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				};
				world.addChild(ball);

				world.update(16);
				adapter.syncFromPhysics();
				expect(adapter.isGrounded(ball)).toEqual(false);
			});
		});

		describe("updateShape — preserves linear velocity", () => {
			it("a moving body keeps its velocity when its shape is swapped", () => {
				const r = new Renderable(100, 100, 32, 32);
				r.alwaysUpdate = true;
				r.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				};
				world.addChild(r);

				adapter.setVelocity(r, new Vector2d(5, -3));
				// updateShape rebuilds the underlying body on matter / planck
				// (and mutates the shape list in place on builtin); either
				// way, the public velocity must survive.
				adapter.updateShape(r, [new Rect(0, 0, 16, 16)]);
				const vel = adapter.getVelocity(r);
				expect(vel.x).toBeCloseTo(5, aabbPrecision);
				expect(vel.y).toBeCloseTo(-3, aabbPrecision);
			});
		});

		describe("sensor + push-out matrix", () => {
			// Drop a dynamic body onto a static floor under each adapter's
			// own gravity. Solid pair → body rests at the floor top.
			// Any sensor → body passes through to below the floor bottom.
			const setup = (
				dynSensor: boolean,
				staticSensor: boolean,
			): { dyn: Renderable; floorY: number; floorBottom: number } => {
				const floorY = 200;
				const floorBottom = floorY + 20;
				const floor = new Renderable(0, floorY, 800, 20);
				floor.alwaysUpdate = true;
				floor.bodyDef = {
					type: "static",
					shapes: [new Rect(0, 0, 800, 20)],
					isSensor: staticSensor,
				};
				world.addChild(floor);

				const dyn = new Renderable(100, 150, 32, 32);
				dyn.alwaysUpdate = true;
				dyn.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
					isSensor: dynSensor,
				};
				world.addChild(dyn);
				return { dyn, floorY, floorBottom };
			};

			it("(solid dynamic) vs (solid static): push-out — body stops above the floor", () => {
				const { dyn, floorY } = setup(false, false);
				for (let i = 0; i < 60; i++) world.update(16);
				adapter.syncFromPhysics();
				expect(dyn.pos.y).toBeLessThan(floorY + 1);
				expect(dyn.pos.y).toBeGreaterThan(floorY - 40);
			});

			it("(sensor dynamic) vs (solid static): no push-out — body passes through", () => {
				const { dyn, floorBottom } = setup(true, false);
				for (let i = 0; i < 60; i++) world.update(16);
				adapter.syncFromPhysics();
				expect(dyn.pos.y).toBeGreaterThan(floorBottom);
			});

			it("(solid dynamic) vs (sensor static): no push-out — body passes through", () => {
				const { dyn, floorBottom } = setup(false, true);
				for (let i = 0; i < 60; i++) world.update(16);
				adapter.syncFromPhysics();
				expect(dyn.pos.y).toBeGreaterThan(floorBottom);
			});

			it("(sensor dynamic) vs (sensor static): no push-out — body passes through", () => {
				const { dyn, floorBottom } = setup(true, true);
				for (let i = 0; i < 60; i++) world.update(16);
				adapter.syncFromPhysics();
				expect(dyn.pos.y).toBeGreaterThan(floorBottom);
			});
		});
	});
}
