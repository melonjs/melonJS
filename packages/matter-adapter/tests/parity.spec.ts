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
}

const factories: AdapterFactory[] = [
	{
		name: "BuiltinAdapter",
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

for (const { name, make } of factories) {
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
	});
}
