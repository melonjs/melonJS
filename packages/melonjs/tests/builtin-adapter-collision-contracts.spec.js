/**
 * Collision-handler contracts under the BuiltinAdapter.
 *
 * Two contracts coexist:
 *
 *   - **`onCollision` (legacy)** — unchanged from 19.4. Single shared
 *     response object passed to both sides per outer iteration; `a`/`b`
 *     are fixed per pair (set by the order the detector calls
 *     `collides(a, b)`); fires 2× per frame for dynamic-dynamic pairs;
 *     `return false` skips the SAT push-out.
 *
 *   - **`onCollisionStart` / `onCollisionActive` / `onCollisionEnd`
 *     (new in 19.5)** — receiver-symmetric. Each side receives a
 *     response where `response.a === this` and `response.b === other`,
 *     with `response.normal` pointing in the receiver's MTV direction.
 *     Dispatched once per pair per side per frame (dedup'd via
 *     `_pairKey` / `_frameSeen`). Same contract under every adapter.
 *
 * These tests pin both contracts so neither side regresses.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	boot,
	collision,
	Rect,
	Renderable,
	video,
	World,
} from "../src/index.js";

describe("Physics : onCollision legacy contract (19.4 backward-compat)", () => {
	/** @type {World} */
	let world;
	let a;
	let b;
	let aCalls;
	let bCalls;

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
		aCalls = [];
		bCalls = [];

		a = new Renderable(100, 100, 32, 32);
		a.alwaysUpdate = true;
		a.bodyDef = {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
			collisionType: collision.types.PLAYER_OBJECT,
			collisionMask: collision.types.ALL_OBJECT,
		};
		// disable gravity for these tests — we want deterministic positions
		a.bodyDef.gravityScale = 0;
		world.addChild(a);

		b = new Renderable(116, 100, 32, 32); // overlaps a horizontally by 16
		b.alwaysUpdate = true;
		b.bodyDef = {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask: collision.types.ALL_OBJECT,
			gravityScale: 0,
		};
		world.addChild(b);

		a.onCollision = function (response, other) {
			aCalls.push({
				responseA: response.a,
				responseB: response.b,
				other,
				overlap: response.overlap,
				overlapVx: response.overlapV.x,
			});
			return true;
		};
		b.onCollision = function (response, other) {
			bCalls.push({
				responseA: response.a,
				responseB: response.b,
				other,
				overlap: response.overlap,
				overlapVx: response.overlapV.x,
			});
			return true;
		};
	});

	it("fires twice per frame per side for dynamic-dynamic pair", () => {
		world.update(16);
		// 2× per side because the detector iterates each non-static body
		// in the outer loop, finds the other one as a broadphase
		// candidate, and dispatches `onCollision` to both sides each
		// time. This is the 19.4 behavior and we are NOT changing it.
		expect(aCalls.length).toEqual(2);
		expect(bCalls.length).toEqual(2);
	});

	it("response.a is fixed per pair (not flipped per receiver)", () => {
		world.update(16);
		// In each outer iteration the detector picks a specific body
		// as "first" (response.a) and the other as "second" (response.b).
		// The receiver might be either one. What's pinned is: across
		// the four dispatches in this frame, the (response.a, response.b)
		// pair takes exactly two distinct shapes — (a, b) and (b, a) —
		// each seen twice, because the outer loop visits both bodies
		// and each visit dispatches to both sides with the same response.
		const shapes = [...aCalls, ...bCalls].map((c) => {
			return c.responseA === a ? "AB" : "BA";
		});
		expect(shapes.sort()).toEqual(["AB", "AB", "BA", "BA"]);
	});

	it("`return false` from onCollision skips the SAT push-out", () => {
		// Set both handlers to return false → no push-out → bodies stay
		// in their starting overlap configuration after the step.
		a.onCollision = () => {
			return false;
		};
		b.onCollision = () => {
			return false;
		};
		const startAx = a.pos.x;
		const startBx = b.pos.x;
		world.update(16);
		expect(a.pos.x).toBeCloseTo(startAx, 3);
		expect(b.pos.x).toBeCloseTo(startBx, 3);
	});

	// "supersedes" rule: defining `onCollisionActive` on a renderable
	// suppresses the legacy `onCollision` dispatch on that same
	// renderable. They are the same every-frame handler in two API
	// styles; firing both would call user code twice with different
	// response shapes for one overlap.
	describe("onCollisionActive supersedes onCollision on the same renderable", () => {
		it("does NOT dispatch onCollision on a renderable that defines onCollisionActive", () => {
			let legacyAFires = 0;
			let modernAFires = 0;
			let legacyBFires = 0;
			a.onCollision = () => {
				legacyAFires++;
				return true;
			};
			a.onCollisionActive = () => {
				modernAFires++;
			};
			// b stays on the legacy handler only — should still be dispatched
			b.onCollision = () => {
				legacyBFires++;
				return true;
			};
			world.update(16);
			// a has modern handler → legacy onCollision skipped for a
			expect(legacyAFires).toEqual(0);
			// modern still fires (once per pair per side per frame)
			expect(modernAFires).toEqual(1);
			// b has only legacy → fires with its usual 2× cadence (dyn-dyn)
			expect(legacyBFires).toEqual(2);
		});

		it("push-out still runs for the modern-handler renderable (matter-aligned default)", () => {
			// Even though onCollision is suppressed, the modern semantics
			// apply push-out by default (unless isSensor / isStatic).
			// Use a dyn-static pair for clean observable separation.
			// Reset world with a fresh dyn-static setup.
			const w2 = new World(0, 0, 800, 600);
			const floor = new Renderable(0, 200, 800, 20);
			floor.bodyDef = {
				type: "static",
				shapes: [new Rect(0, 0, 800, 20)],
				collisionType: collision.types.WORLD_SHAPE,
				collisionMask: collision.types.ALL_OBJECT,
			};
			w2.addChild(floor);
			const c = new Renderable(300, 188, 32, 32);
			c.alwaysUpdate = true;
			c.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				collisionType: collision.types.PLAYER_OBJECT,
				collisionMask: collision.types.ALL_OBJECT,
				gravityScale: 0,
			};
			c.onCollisionActive = () => {};
			// Stale legacy that would have opted out — should be IGNORED
			// because onCollisionActive is defined.
			c.onCollision = () => {
				return false;
			};
			w2.addChild(c);
			const startY = c.pos.y;
			w2.update(16);
			expect(c.pos.y).not.toBe(startY);
		});
	});

	// Modern default (matter-aligned, gap-#7 fix): with no `onCollision`
	// defined, push-out runs by default for dynamic non-sensor bodies.
	// The pre-19.5 behavior was "no handler = implicit sensor"; that quirk
	// is gone, replaced by the explicit `isSensor` flag.
	it("push-out runs by default when neither side defines onCollision (matter-aligned)", () => {
		// Pin a static floor so dyn-static push-out separates the dynamic
		// body upward — easier to observe than dyn-dyn symmetric push-out.
		const floor = new Renderable(0, 200, 800, 20);
		floor.bodyDef = {
			type: "static",
			shapes: [new Rect(0, 0, 800, 20)],
			collisionType: collision.types.WORLD_SHAPE,
			collisionMask: collision.types.ALL_OBJECT,
		};
		world.addChild(floor);

		// Place a dynamic body sitting on top of the floor with a slight
		// overlap. NO collision handlers defined → modern default applies.
		const c = new Renderable(300, 188, 32, 32);
		c.alwaysUpdate = true;
		c.bodyDef = {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
			collisionType: collision.types.PLAYER_OBJECT,
			collisionMask: collision.types.ALL_OBJECT,
			gravityScale: 0,
		};
		// No onCollision, onCollisionStart, etc. defined.
		world.addChild(c);
		const startY = c.pos.y;
		world.update(16);
		// Push-out should have moved the dynamic body off the floor.
		// Direction depends on which side of the floor's midline c sits
		// on at impact — what's locked in here is "it moved at all",
		// i.e., push-out ran on a renderable without a user-defined
		// `onCollision`. Under the pre-19.5 implicit-sensor behavior,
		// c.pos.y would still be 188.
		expect(c.pos.y).not.toBe(startY);
	});
});

describe("Physics : onCollisionActive new contract (19.5+, receiver-symmetric)", () => {
	/** @type {World} */
	let world;
	let a;
	let b;
	let aCalls;
	let bCalls;

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
		aCalls = [];
		bCalls = [];

		a = new Renderable(100, 100, 32, 32);
		a.alwaysUpdate = true;
		a.bodyDef = {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
			collisionType: collision.types.PLAYER_OBJECT,
			collisionMask: collision.types.ALL_OBJECT,
			gravityScale: 0,
			isSensor: true, // skip push-out so positions stay stable for assertions
		};
		world.addChild(a);

		b = new Renderable(116, 100, 32, 32);
		b.alwaysUpdate = true;
		b.bodyDef = {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask: collision.types.ALL_OBJECT,
			gravityScale: 0,
			isSensor: true,
		};
		world.addChild(b);

		a.onCollisionActive = function (response, other) {
			aCalls.push({
				self: this,
				responseA: response.a,
				responseB: response.b,
				other,
				normal: response.normal && {
					x: response.normal.x,
					y: response.normal.y,
				},
				depth: response.depth,
			});
		};
		b.onCollisionActive = function (response, other) {
			bCalls.push({
				self: this,
				responseA: response.a,
				responseB: response.b,
				other,
				normal: response.normal && {
					x: response.normal.x,
					y: response.normal.y,
				},
				depth: response.depth,
			});
		};
	});

	it("fires exactly once per pair per side per frame (dedup'd)", () => {
		world.update(16);
		// Unlike legacy `onCollision`, the new handler is dedup'd via
		// `_pairKey` so the second outer iteration skips the dispatch.
		// Each side fires exactly once.
		expect(aCalls.length).toEqual(1);
		expect(bCalls.length).toEqual(1);
	});

	it("response.a is always the receiver (response.a === this)", () => {
		world.update(16);
		expect(aCalls[0].responseA).toBe(a);
		expect(bCalls[0].responseA).toBe(b);
	});

	it("response.b is always the partner (response.b === other)", () => {
		world.update(16);
		expect(aCalls[0].responseB).toBe(b);
		expect(aCalls[0].other).toBe(b);
		expect(bCalls[0].responseB).toBe(a);
		expect(bCalls[0].other).toBe(a);
	});

	it("response.normal is the MTV of the receiver (mirrored between sides)", () => {
		world.update(16);
		// a is to the left of b → a's MTV-to-escape points LEFT (negative x)
		// b's MTV-to-escape points RIGHT (positive x). The two normals
		// must be exactly opposite.
		expect(aCalls[0].normal).toBeDefined();
		expect(bCalls[0].normal).toBeDefined();
		expect(aCalls[0].normal.x).toBeCloseTo(-bCalls[0].normal.x, 5);
		expect(aCalls[0].normal.y).toBeCloseTo(-bCalls[0].normal.y, 5);
		// for a horizontal overlap, normal points along x with sign
		expect(Math.abs(aCalls[0].normal.x)).toBeGreaterThan(0.9);
	});

	it("response.depth is the penetration magnitude (positive scalar, same on both sides)", () => {
		world.update(16);
		expect(aCalls[0].depth).toBeGreaterThan(0);
		expect(bCalls[0].depth).toBeCloseTo(aCalls[0].depth, 5);
	});
});
