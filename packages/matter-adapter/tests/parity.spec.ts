/**
 * Cross-adapter parity spec.
 *
 * Runs the same test body against BOTH BuiltinAdapter and MatterAdapter
 * to catch behavioural drift in the shared PhysicsAdapter contract.
 * Things that are *supposed* to be identical regardless of physics engine
 * live here; things that are inherently engine-dependent (Newtonian-force
 * units, rotation, slope handling, etc.) belong in each adapter's own
 * spec instead.
 *
 * If a test in this file passes on one adapter and fails on the other,
 * that's a real bug in adapter parity, not an "expected difference."
 */

import {
	Bounds,
	BuiltinAdapter,
	boot,
	Container,
	collision,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MatterAdapter } from "../src/index";

interface AdapterFactory {
	name: string;
	make(): {
		adapter: BuiltinAdapter | MatterAdapter;
		world: World;
	};
	/**
	 * Decimal-place precision for raycast / position assertions. The
	 * builtin SAT adapter resolves contacts at full precision; matter
	 * inflates slightly through its Verlet integration step + collision
	 * margin, so close-to assertions use precision 0 (within 0.5 px).
	 */
	rayPrecision: number;
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
		rayPrecision: 1,
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
		name: "MatterAdapter",
		rayPrecision: 0,
		expectedCapabilities: {
			constraints: true,
			continuousCollisionDetection: true,
			sleepingBodies: true,
			raycasts: true,
			velocityLimit: true,
			isGrounded: true,
		},
		make() {
			const adapter = new MatterAdapter({ gravity: { x: 0, y: 1 } });
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

for (const { name, make, rayPrecision, expectedCapabilities } of factories) {
	describe(`Adapter parity — ${name}`, () => {
		let adapter: BuiltinAdapter | MatterAdapter;
		let world: World;

		beforeEach(() => {
			({ adapter, world } = make());
		});

		// Helper: add a renderable to the world container. The builtin
		// adapter only integrates bodies whose renderable is in the scene
		// tree (`body.ancestor` set); matter integrates anything added to
		// the engine. Going through the world container is the realistic
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
				// step once so position is in sync
				adapter.step(16);
				adapter.syncFromPhysics();
				adapter.removeBody(r);
				const yAtRemove = r.pos.y;
				// further steps: position must NOT keep falling (body
				// is no longer in the simulation set)
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
				// optional method — both adapters implement it now
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
			// Previously `Container.removeChildNow` only called the adapter's
			// removeBody when `child.body instanceof Body` (legacy melonJS
			// Body). matter-adapter bodies (`Matter.Body` instances) failed
			// this check and stayed in the engine after the renderable was
			// destroyed — later collisionStart events fired on dead
			// renderables and crashed `setCurrentAnimation` etc.
			it("removeChild also removes the adapter-managed body", () => {
				const r = addToWorld(new Renderable(100, 100, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.setVelocity(r, new Vector2d(5, 0));
				world.removeChildNow(r, true /* keepalive */);
				// Body unregistered → getVelocity returns zero, and stepping
				// the adapter no longer integrates the body.
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
				// step long enough for the ball to fall onto the floor and
				// stay there
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
				// "every frame in contact" — should fire many times once
				// settled on the floor
				expect(actives.length).toBeGreaterThan(5);
			});

			it("onCollisionEnd fires when bodies separate", () => {
				const { events, step, ball } = setupContact();
				step(20); // initial fall + contact
				// teleport away and step long enough for the detector
				// frame-diff (builtin) / matter's collisionEnd event to
				// fire
				adapter.setPosition(ball, new Vector2d(2000, 0));
				step(30);
				const ends = events.filter((e) => e.kind === "end");
				// At least one end event should fire — either from natural
				// bouncing during settle, or from the explicit separation.
				// Both adapters honour the contract; we don't pin down the
				// exact timing since SAT bouncing behaves differently from
				// matter rest contact.
				expect(ends.length).toBeGreaterThan(0);
			});
		});

		describe("debug API (getBodyAABB / getBodyShapes)", () => {
			// Adapter-side debug surface. The contract is that both
			// methods return geometry in renderable-LOCAL coordinates
			// (relative to renderable.pos), so the @melonjs/debug-plugin
			// can blit them after a translate to the renderable origin
			// without knowing whether the underlying engine uses a
			// world- or local-space body frame.
			it("getBodyAABB returns local-space bounds", () => {
				const r = addToWorld(new Renderable(100, 200, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const out = new Bounds();
				const aabb = adapter.getBodyAABB?.(r, out);
				expect(aabb).toBeDefined();
				// In local space, the bounds should start at (0, 0) — not
				// at the renderable's world position.
				expect(aabb!.left).toBeCloseTo(0, 1);
				expect(aabb!.top).toBeCloseTo(0, 1);
				expect(aabb!.width).toBeCloseTo(32, 1);
				expect(aabb!.height).toBeCloseTo(32, 1);
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

			// Dangling-body case: `adapter.removeBody(r)` clears the
			// adapter's bookkeeping but doesn't reset `renderable.body` —
			// the field still points at the now-orphaned Body instance.
			// Before the contract fix in 27af71d98, BuiltinAdapter checked
			// only `body !== undefined` and happily returned debug geometry
			// for the dangling body, in violation of the adapter contract.
			// Pin the contract on every adapter so the regression can't
			// come back silently.
			it("getBodyAABB returns undefined for a body removed via adapter.removeBody", () => {
				const r = addToWorld(new Renderable(0, 0, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.removeBody(r);
				// renderable.body still points at the orphaned Body — the
				// adapter must NOT return debug geometry for it.
				const out = new Bounds();
				expect(adapter.getBodyAABB?.(r, out)).toBeUndefined();
			});

			it("getBodyShapes returns [] for a body removed via adapter.removeBody", () => {
				const r = addToWorld(new Renderable(0, 0, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.removeBody(r);
				expect(adapter.getBodyShapes(r).length).toEqual(0);
			});
		});

		describe("debug API: coordinate-space adversarial", () => {
			// These tests pin down the *contract* the debug plugin depends
			// on: `getBodyAABB` must return bounds in **renderable-local**
			// coordinates regardless of where the renderable lives in the
			// world or how the body has been moved since registration.
			//
			// The debug plugin's draw pass does:
			//     renderer.translate(bounds.x, bounds.y)  // to renderable origin
			//     renderer.stroke(adapter.getBodyAABB(...))
			// so if the AABB is *not* in local space the hitbox renders
			// offset by `renderable.pos`. These tests catch that
			// regression on either adapter immediately.

			it("AABB stays local-space at a non-trivial world position", () => {
				const r = addToWorld(new Renderable(500, 300, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const aabb = adapter.getBodyAABB?.(r, new Bounds())!;
				expect(aabb.left).toBeCloseTo(0, 1);
				expect(aabb.top).toBeCloseTo(0, 1);
				expect(aabb.right).toBeCloseTo(32, 1);
				expect(aabb.bottom).toBeCloseTo(32, 1);
			});

			it("AABB stays local-space at NEGATIVE world coords", () => {
				// Negative coords are a common source of off-by-sign bugs
				// in adapter coordinate translation — explicitly test.
				const r = addToWorld(new Renderable(-450, -275, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const aabb = adapter.getBodyAABB?.(r, new Bounds())!;
				expect(aabb.left).toBeCloseTo(0, 1);
				expect(aabb.top).toBeCloseTo(0, 1);
				expect(aabb.right).toBeCloseTo(32, 1);
				expect(aabb.bottom).toBeCloseTo(32, 1);
			});

			it("AABB reflects an OFFSET shape inside the renderable", () => {
				// Common pattern: sprite is 64×64, the collision shape sits
				// somewhere INSIDE the sprite bounds (e.g. a player whose
				// hitbox is smaller than the sprite). Local-space AABB
				// must reflect the shape's offset, not (0,0,w,h).
				const r = addToWorld(new Renderable(0, 0, 64, 64), {
					type: "dynamic",
					shapes: [new Rect(10, 12, 32, 40)],
				});
				const aabb = adapter.getBodyAABB?.(r, new Bounds())!;
				expect(aabb.left).toBeCloseTo(10, 0);
				expect(aabb.top).toBeCloseTo(12, 0);
				expect(aabb.width).toBeCloseTo(32, 0);
				expect(aabb.height).toBeCloseTo(40, 0);
			});

			it("AABB encompasses a multi-shape body in local coords", () => {
				// Body composed of two stacked shapes — AABB must wrap
				// both. Shapes share the origin (both start at 0, 0) and
				// differ in extent, sidestepping a pre-existing quirk in
				// the legacy Builtin `Body.addShape` path where the
				// internal `bounds.translate` for an offset rect overrides
				// rather than unions with prior shapes. Cross-adapter
				// parity in *this* test only requires the AABB to wrap
				// the visible shape extent, which holds on both adapters.
				const r = addToWorld(new Renderable(200, 200, 64, 64), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 16, 16), new Rect(0, 0, 48, 32)],
				});
				const aabb = adapter.getBodyAABB?.(r, new Bounds())!;
				expect(aabb.left).toBeCloseTo(0, 0);
				expect(aabb.top).toBeCloseTo(0, 0);
				expect(aabb.right).toBeCloseTo(48, 0);
				expect(aabb.bottom).toBeCloseTo(32, 0);
			});

			it("AABB stays local-space across many simulation steps (static body)", () => {
				// Adversarial: matter's internal `body.bounds` is in WORLD
				// space and updates every step. If the adapter forgets to
				// re-subtract `renderable.pos` the AABB would drift each
				// step. A **static** body is used here so matter doesn't
				// inflate the AABB by velocity for swept-AABB / CCD —
				// that's a separate matter-only behavior orthogonal to
				// the coordinate-system test.
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
				// Companion to the static test, focused on the dynamic
				// case where matter DOES inflate the AABB by velocity for
				// CCD. The *local-space invariant* still holds — the
				// AABB's geometric extent is always somewhere near the
				// origin (renderable.pos), never drifting toward the
				// body's growing world position. Use a single step so the
				// velocity-driven inflation is small enough to bound.
				const r = addToWorld(new Renderable(100, 100, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				adapter.step(16);
				const after = adapter.getBodyAABB?.(r, new Bounds())!;
				// After ONE step, body has moved by gravity (small delta)
				// and matter's CCD inflation is at most ~few px. We just
				// verify the AABB hasn't escaped to "near the renderable
				// world position" (which would mean world-space, not
				// local-space). Bound: AABB center within 10 px of (16, 16).
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
				expect(aabb.left).toBeCloseTo(0, 1);
				expect(aabb.top).toBeCloseTo(0, 1);
			});

			it("the debug-plugin draw transform reproduces the body's WORLD AABB", () => {
				// This is the integration-level invariant: when the debug
				// plugin does `translate(renderable.pos) + stroke(AABB)`,
				// the rectangle on screen must coincide with the body's
				// actual world-space extent. Equivalent to checking
				//   renderable.pos + aabb_local == world_extent
				// for every (renderable, body) pair the adapter knows
				// about, on either adapter.
				const r = addToWorld(new Renderable(400, 250, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const aabb = adapter.getBodyAABB?.(r, new Bounds())!;
				const worldLeft = r.pos.x + aabb.left;
				const worldTop = r.pos.y + aabb.top;
				// The body was registered at renderable pos (400, 250)
				// with a shape that occupies its full 32×32 extent, so
				// the world AABB top-left must be (400, 250).
				expect(worldLeft).toBeCloseTo(400, 1);
				expect(worldTop).toBeCloseTo(250, 1);
			});

			it("repeated polls are idempotent (no drift on the shared out)", () => {
				// The adapter writes into a caller-provided `out` Bounds.
				// Polling twice in succession must yield the same value —
				// would catch a bug where the adapter accidentally mutated
				// renderable.pos or other state during the read.
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
				// Companion to the offset-shape AABB test: even when each
				// individual shape is iterated by the debug plugin (after
				// translating to the renderable origin), the shape's
				// effective bounding box must match the input offset, not
				// a body- or world-relative one.
				//
				// Cross-adapter note: BuiltinAdapter converts every input
				// `Rect` to a `Polygon` internally (legacy SAT decomposes
				// rects into 4-vertex polys), while MatterAdapter returns
				// the input shapes verbatim. The debug-plugin contract is
				// `renderer.stroke(shape)`, which calls `shape.getBounds()`
				// under the hood — that's available on both Rect and the
				// converted Polygon. So we test the shape via its own
				// `getBounds()` instead of `.left`/`.top` to stay type-
				// agnostic and exercise the same path the plugin uses.
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
			it("setAngle either rotates (matter) or no-ops (builtin) without throwing", () => {
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

		describe("regression — collisionType / collisionFilter live alias", () => {
			// On matter, body.collisionType is a getter/setter alias for
			// body.collisionFilter.category — they share state and can't
			// drift. Verify either name reads back the value set via the
			// other name.
			it("setting collisionFilter.category is readable via collisionType", () => {
				const r = addToWorld(new Renderable(0, 0, 32, 32), {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				});
				const body = r.body as unknown as {
					collisionFilter?: { category: number };
					collisionType?: number;
				};
				// pick a path — write via filter, read via collisionType, or
				// the other way around. matter exposes both as aliases; the
				// builtin Body class only has collisionType so we test the
				// path that exists on each adapter.
				if (body.collisionFilter) {
					body.collisionFilter.category = 0x42;
					expect(body.collisionType).toEqual(0x42);
				} else {
					// builtin: collisionType is the canonical name
					(body as { collisionType: number }).collisionType = 0x42;
					expect(body.collisionType).toEqual(0x42);
				}
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
				// frame; raycast / queryAABB walk that broadphase. matter
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
				expect(hit!.point.x).toBeCloseTo(200, rayPrecision);
				expect(hit!.point.y).toBeCloseTo(220, rayPrecision);
				expect(hit!.normal.x).toBeCloseTo(-1, rayPrecision);
				expect(hit!.normal.y).toBeCloseTo(0, rayPrecision);
				// (200 - 0) / (400 - 0) = 0.5
				expect(hit!.fraction).toBeCloseTo(0.5, rayPrecision);
			});

			it("returns a right-face hit (normal flips) when shot from the other side", () => {
				placeBox();
				const hit = adapter.raycast(
					new Vector2d(500, 220),
					new Vector2d(0, 220),
				);
				expect(hit).not.toBeNull();
				expect(hit!.point.x).toBeCloseTo(240, rayPrecision);
				expect(hit!.normal.x).toBeCloseTo(1, rayPrecision);
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
			// frame, while matter / planck track real contact pairs. See
			// the BuiltinAdapter Quirks wiki page.
			it("a body in mid-air with no body below is not grounded", () => {
				const ball = new Renderable(100, 50, 32, 32);
				ball.alwaysUpdate = true;
				ball.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				};
				world.addChild(ball);

				// step once so contact lists / flags are populated under
				// the current state on every adapter.
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
				expect(vel.x).toBeCloseTo(5, rayPrecision);
				expect(vel.y).toBeCloseTo(-3, rayPrecision);
			});
		});

		describe("sensor + push-out matrix", () => {
			// Drop a dynamic body onto a static floor under each adapter's
			// own gravity (geometry mirrored from the collision-lifecycle
			// suite, which both adapters integrate cleanly within 60 ticks).
			// Solid pair → body rests at the floor top. Any sensor → body
			// passes through to below the floor bottom.
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
				// dyn.pos.y is the top edge; for a 32 px body resting on the
				// floor it should be ≈ floorY - 32 = 168. Allow a small
				// budget for solver penetration tolerance.
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

		describe("raycast / queryAABB are geometric (not collision-filtered)", () => {
			// Raycast and queryAABB are pure spatial queries — they return
			// every body whose geometry intersects the query, regardless of
			// `collisionType` / `collisionMask`. Box2D's RayCast and matter's
			// Query.ray both follow this convention; the portable adapter
			// surface inherits it. Pin that here so a future PR that adds
			// "helpful" implicit mask filtering to one adapter is caught.
			const placeWall = (
				x: number,
				collisionType: number,
				collisionMask: number,
			) => {
				const wall = new Renderable(x, 200, 40, 40);
				wall.alwaysUpdate = true;
				wall.bodyDef = {
					type: "static",
					shapes: [new Rect(0, 0, 40, 40)],
					collisionType,
					collisionMask,
				};
				world.addChild(wall);
				return wall;
			};

			it("raycast returns the nearest hit regardless of collisionMask", () => {
				// Two walls in line. Near wall has a mask that explicitly
				// would NOT collide with anything (mask === 0). A
				// collision-filtered raycast would skip it; a geometric
				// raycast must return it because it's nearer.
				const near = placeWall(100, collision.types.WORLD_SHAPE, 0);
				placeWall(300, collision.types.WORLD_SHAPE, collision.types.ALL_OBJECT);
				world.update(16);
				const hit = adapter.raycast(
					new Vector2d(0, 220),
					new Vector2d(500, 220),
				);
				expect(hit).not.toBeNull();
				expect(hit!.renderable).toBe(near);
			});

			it("queryAABB returns every overlapping body regardless of collisionMask", () => {
				const a = placeWall(100, collision.types.WORLD_SHAPE, 0);
				const b = placeWall(
					200,
					collision.types.WORLD_SHAPE,
					collision.types.ALL_OBJECT,
				);
				world.update(16);
				const hits = adapter.queryAABB(new Rect(50, 150, 300, 200));
				expect(hits).toContain(a);
				expect(hits).toContain(b);
				expect(hits.length).toEqual(2);
			});
		});

		describe("adversarial — common gameplay patterns", () => {
			// Patterns every game hits sooner or later. Bugs here cascade
			// silently in production, so each test pins an invariant that
			// is easy to break by refactoring the contact / lifecycle path.

			it("deferred-removal pickup pattern — body is gone from queries the next frame", () => {
				// The portable pickup idiom: onCollisionStart flags the coin
				// for removal, the actual removeChildNow happens AFTER the
				// world step. Matches the recommendation in BuiltinAdapter
				// Quirks #6 ("defer destructive ops in collision callbacks").
				// Pins that: (a) the contact fires exactly once, (b) the
				// post-removal queryAABB no longer returns the coin.
				let pickedUp = false;
				const events: string[] = [];
				class Coin extends Renderable {
					onCollisionStart() {
						events.push("pickup");
						pickedUp = true;
					}
				}
				const player = new Renderable(100, 100, 32, 32);
				player.alwaysUpdate = true;
				player.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
					gravityScale: 0,
				};
				world.addChild(player);
				const coin = new Coin(108, 100, 16, 16);
				coin.alwaysUpdate = true;
				coin.bodyDef = {
					type: "static",
					shapes: [new Rect(0, 0, 16, 16)],
					isSensor: true,
				};
				world.addChild(coin);

				world.update(16);
				expect(pickedUp).toEqual(true);
				expect(events.length).toEqual(1);

				// Deferred removal — safe on every adapter.
				coin.ancestor.removeChildNow(coin);
				world.update(16);
				adapter.syncFromPhysics();

				// Coin must not show up in subsequent spatial queries.
				const hits = adapter.queryAABB(new Rect(100, 95, 30, 30));
				expect(hits).not.toContain(coin);
				// And no second pickup fired.
				expect(events.length).toEqual(1);
			});

			it("setPosition out of penetration — no stale-contact correction", () => {
				// Regression: matter caches per-body position-correction
				// impulse across steps (the "warming" mechanism) and
				// would reapply the OLD penetration vector for one frame
				// after a teleport, yanking the body back ≈ penetration
				// depth toward the wall. Builtin and planck handle this
				// natively; matter-adapter fixes it by zeroing
				// `body.positionImpulse` inside `setPosition`. Pin
				// drift = 0 on every adapter.
				const wall = new Renderable(200, 200, 40, 40);
				wall.alwaysUpdate = true;
				wall.bodyDef = {
					type: "static",
					shapes: [new Rect(0, 0, 40, 40)],
				};
				world.addChild(wall);

				const mover = new Renderable(195, 200, 32, 32);
				mover.alwaysUpdate = true;
				mover.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
					gravityScale: 0,
				};
				world.addChild(mover);
				// Step once so matter caches the penetrating contact pair.
				world.update(16);

				adapter.setPosition(mover, new Vector2d(500, 100));
				adapter.setVelocity(mover, new Vector2d(0, 0));
				world.update(16);
				adapter.syncFromPhysics();
				expect(Math.abs(mover.pos.x - 500)).toBeLessThan(1);
				expect(Math.abs(mover.pos.y - 100)).toBeLessThan(1);
			});

			it("setPosition while in contact — teleport away from a resting body works", () => {
				// Common cutscene / level-transition pattern: a body
				// resting on a floor is teleported elsewhere. One step
				// later it must be where we put it, not pulled back to
				// the floor by a stale contact-resolution force.
				const floor = new Renderable(0, 200, 800, 20);
				floor.alwaysUpdate = true;
				floor.bodyDef = {
					type: "static",
					shapes: [new Rect(0, 0, 800, 20)],
				};
				world.addChild(floor);

				const ball = new Renderable(100, 150, 32, 32);
				ball.alwaysUpdate = true;
				ball.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				};
				world.addChild(ball);

				// Let it settle on the floor (real contact, no penetration).
				for (let i = 0; i < 60; i++) world.update(16);
				adapter.syncFromPhysics();

				// Teleport up high, zero velocity.
				adapter.setPosition(ball, new Vector2d(400, 50));
				adapter.setVelocity(ball, new Vector2d(0, 0));
				world.update(16);
				adapter.syncFromPhysics();
				// Position should be near the teleport target. Some y drift
				// is allowed under gravity for one step (gravity is tiny);
				// x has no force on it so should be exact.
				expect(Math.abs(ball.pos.x - 400)).toBeLessThan(2);
				expect(Math.abs(ball.pos.y - 50)).toBeLessThan(5);
			});

			it("setStatic mid-collision — frozen body stops, partner stops being pushed", () => {
				// A dynamic body sitting on a floor (in active contact)
				// is converted to static. After the toggle the formerly
				// dynamic body must not move — and gravity must not keep
				// applying through the (now static) contact.
				const floor = new Renderable(0, 200, 800, 20);
				floor.alwaysUpdate = true;
				floor.bodyDef = {
					type: "static",
					shapes: [new Rect(0, 0, 800, 20)],
				};
				world.addChild(floor);

				const dyn = new Renderable(100, 150, 32, 32);
				dyn.alwaysUpdate = true;
				dyn.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				};
				world.addChild(dyn);
				// Let it land + settle into contact with the floor.
				for (let i = 0; i < 60; i++) world.update(16);
				adapter.syncFromPhysics();
				const restingY = dyn.pos.y;

				adapter.setStatic(dyn, true);
				for (let i = 0; i < 30; i++) world.update(16);
				adapter.syncFromPhysics();
				expect(Math.abs(dyn.pos.y - restingY)).toBeLessThan(1);
			});

			it("nested-container removeChildNow de-registers the body from the adapter", () => {
				// Common level-management pattern: bodies live inside a
				// "level" subcontainer that gets cleared on transition.
				// Removing the child must drain the adapter's bookkeeping,
				// otherwise stale bodies keep showing up in raycast /
				// queryAABB after the level is gone.
				const sub = new Container(0, 0, 800, 600);
				world.addChild(sub);

				const r = new Renderable(100, 100, 32, 32);
				r.alwaysUpdate = true;
				r.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				};
				sub.addChild(r);
				world.update(16);

				const seenBefore = adapter.queryAABB(new Rect(90, 90, 50, 50));
				expect(seenBefore).toContain(r);

				sub.removeChildNow(r, true);
				world.update(16);
				const seenAfter = adapter.queryAABB(new Rect(90, 90, 50, 50));
				expect(seenAfter).not.toContain(r);
			});

			it("setSensor toggle mid-flight — one-way-platform pattern", () => {
				// A solid floor becomes a sensor for one frame so a falling
				// body passes through, then flips back to solid. Pin both
				// transitions: sensor=true ⇒ body falls past; sensor=false
				// ⇒ body lands on subsequent contact.
				const floor = new Renderable(0, 200, 800, 20);
				floor.alwaysUpdate = true;
				floor.bodyDef = {
					type: "static",
					shapes: [new Rect(0, 0, 800, 20)],
				};
				world.addChild(floor);

				const ball = new Renderable(100, 150, 32, 32);
				ball.alwaysUpdate = true;
				ball.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
				};
				world.addChild(ball);

				// Flip the floor to sensor before contact — the ball must
				// pass straight through.
				adapter.setSensor?.(floor, true);
				for (let i = 0; i < 60; i++) world.update(16);
				adapter.syncFromPhysics();
				expect(ball.pos.y).toBeGreaterThan(220); // past the floor's bottom

				// Now flip back to solid; teleport the ball above the
				// floor again and assert it lands on top this time.
				adapter.setSensor?.(floor, false);
				adapter.setPosition(ball, new Vector2d(100, 150));
				adapter.setVelocity(ball, new Vector2d(0, 0));
				for (let i = 0; i < 60; i++) world.update(16);
				adapter.syncFromPhysics();
				// Resting on top of the floor: ball top edge ≈ 200 - 32 = 168.
				expect(ball.pos.y).toBeLessThan(201);
				expect(ball.pos.y).toBeGreaterThan(140);
			});
		});

		describe("maxVelocity — actually clamps under sustained force", () => {
			// `maxVelocity` is a hard ceiling — applying a force every step
			// must not let `|vel|` exceed the configured limit. Pinning the
			// behaviour, not just the config propagation that the per-adapter
			// specs already cover.
			it("|vel.x| stays at or below the configured cap", () => {
				const r = new Renderable(100, 100, 32, 32);
				r.alwaysUpdate = true;
				r.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
					maxVelocity: { x: 5, y: 5 },
					// Disable gravity so the y component stays a clean
					// signal of the cap (gravity would constantly fight
					// the clamp from below).
					gravityScale: 0,
				};
				world.addChild(r);

				// Hammer with sustained force to push the body well past
				// the cap if clamping is broken.
				for (let i = 0; i < 30; i++) {
					adapter.applyForce(r, new Vector2d(100, 0));
					world.update(16);
				}
				const vel = adapter.getVelocity(r);
				// Allow a tiny per-adapter slop (matter integrates over dt
				// so the cap is reached asymptotically; planck rounds
				// through meters).
				expect(Math.abs(vel.x)).toBeLessThanOrEqual(5 + 0.1);
			});
		});
	});
}
