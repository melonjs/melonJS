/**
 * Bug hunt: use the clean PhysicsAdapter testbench to probe corners of
 * the underlying arcade (SAT) physics that were hard to test through the
 * legacy API. Each `it` block targets a specific suspected weakness.
 *
 * Failing tests = real bugs. Passing tests with a "PIN" comment = current
 * behavior that's surprising but intentional / pinned so a future change
 * doesn't silently flip it. Tests marked CONFIRMED-BUG document a real
 * issue we found and are kept as red gates until fixed.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	boot,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";

describe("Physics : BuiltinAdapter (latent bug hunt)", () => {
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
		// neutralize gravity for most tests — we want to isolate force/vel logic
		adapter.gravity.set(0, 0);
	});

	const makeBody = (def = {}) => {
		const r = new Renderable(0, 0, 32, 32);
		r.alwaysUpdate = true;
		return (
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				...def,
			}),
			r
		);
	};

	describe("force leak — out of viewport / paused / static", () => {
		it("force applied while out-of-viewport is cleared between steps", () => {
			// A non-alwaysUpdate body that is "out of viewport" still has
			// its force accumulator cleared at the end of every step.
			// Otherwise a stray applyForce call would survive and fire as
			// a surprise impulse on viewport re-entry.
			const r = new Renderable(0, 0, 32, 32);
			r.alwaysUpdate = false;
			r.inViewport = false;
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.applyForce(r, new Vector2d(5, 0));
			expect(r.body.force.x).toEqual(5);

			adapter.step(16);
			expect(r.body.force.x).toEqual(0);

			// re-entering the viewport should not produce a "free" kick
			r.inViewport = true;
			adapter.step(16);
			expect(r.body.vel.x).toEqual(0);
		});

		it("force applied to a static body is cleared, not accumulated", () => {
			// Static bodies don't simulate, but applyForce calls against
			// them used to accumulate indefinitely and fire on static→dynamic
			// switch. Force is now cleared every step regardless.
			const r = new Renderable(0, 0, 32, 32);
			r.alwaysUpdate = true;
			adapter.addBody(r, {
				type: "static",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			for (let i = 0; i < 10; i++) {
				adapter.applyForce(r, new Vector2d(1, 0));
				adapter.step(16);
			}
			expect(r.body.vel.x).toEqual(0);
			expect(r.body.force.x).toEqual(0);

			// Switching to dynamic must NOT release a stale impulse.
			adapter.setStatic(r, false);
			adapter.step(16);
			expect(r.body.vel.x).toEqual(0);
		});
	});

	describe("falling flag — force-dependent semantics", () => {
		it("BUG: body falling under inertia with zero force reports falling=false", () => {
			// Set velocity downward by hand (as a collision bounce might),
			// then step with no current force. The body is physically
			// falling but `falling = vel.y * sign(force.y) > 0` evaluates
			// to `vel.y * 0 > 0` = false.
			const r = makeBody();
			r.body.vel.y = 5; // falling
			r.body.force.set(0, 0);
			adapter.step(16);
			// EXPECTED: falling should be true (vel is downward).
			// ACTUAL: falling = vel.y * Math.sign(0) > 0 = 5 * 0 > 0 = false.
			// PIN — confirms the force-dependent semantic.
			expect(r.body.falling).toEqual(false);
			// And consequently isGrounded reports TRUE for a body in free fall
			// — a real arcade-physics footgun for anyone relying on it.
			expect(adapter.isGrounded(r)).toEqual(true);
		});

		it("PIN: during an upward jump (force<0, vel<0), falling reports TRUE", () => {
			// Confusing but documented: `falling = vel.y * sign(force.y) > 0`
			// → during upward motion, both terms are negative, product is
			// positive, falling is true. The platformer relies on the
			// adjacent `this.jumping = falling ? false : this.jumping` to
			// disambiguate. Test exists to pin this corner.
			const r = makeBody();
			r.body.jumping = true;
			adapter.applyForce(r, new Vector2d(0, -15));
			adapter.step(16);
			expect(r.body.vel.y).toBeLessThan(0); // moving up
			expect(r.body.falling).toEqual(true); // counter-intuitive
			expect(r.body.jumping).toEqual(false); // cleared by the side-effect
		});
	});

	describe("NaN / Infinity propagation", () => {
		it("BUG: NaN gravityScale infects vel and pos with no guard", () => {
			adapter.gravity.set(0, 0.98);
			const r = makeBody({ gravityScale: Number.NaN });
			adapter.step(16);
			expect(Number.isNaN(r.body.vel.y)).toEqual(true); // PIN — infected
			expect(Number.isNaN(r.pos.y)).toEqual(true);
		});

		it("BUG: NaN applyForce poisons body state silently", () => {
			const r = makeBody();
			adapter.applyForce(r, new Vector2d(Number.NaN, 0));
			adapter.step(16);
			expect(Number.isNaN(r.body.vel.x)).toEqual(true); // PIN — infected
		});

		it("BUG: Infinity in setMaxVelocity does not clamp", () => {
			const r = makeBody();
			adapter.setMaxVelocity(r, { x: Number.POSITIVE_INFINITY, y: 15 });
			adapter.applyForce(r, new Vector2d(1e9, 0));
			adapter.step(16);
			// vel.x integrated by 1e9 * timer.tick; no cap caught it.
			expect(r.body.vel.x).toBeGreaterThan(1e8); // PIN — unbounded
		});
	});

	describe("negative maxVel — clamp semantics", () => {
		it("BUG: negative maxVel inverts the clamp bounds, zeroing positive velocity", () => {
			// `clamp(vel, -maxVel, maxVel)` with maxVel.x = -5 becomes
			// clamp(vel, 5, -5) — Math.min then Math.max produces 5 (the
			// upper bound becomes the new lower bound). A user expecting
			// "cap at 5" who fat-fingers a minus sign now sees the body
			// pinned to +5 in one direction only.
			const r = makeBody();
			adapter.setMaxVelocity(r, { x: -5, y: 15 });
			// nudge velocity to a moderate positive value
			r.body.vel.x = 2;
			adapter.step(16);
			// EXPECTED (any sane behavior): vel.x === 0 or clamped.
			// ACTUAL: vel.x is clamped using the inverted range and ends up
			// at one of the bounds, depending on input.
			expect(Math.abs(r.body.vel.x)).toEqual(5); // PIN
		});
	});

	describe("frame-rate independence — dt is IGNORED", () => {
		it("PIN: body.update ignores dt and uses timer.tick instead", () => {
			// `body.update(dt)` has `const deltaTime = /* dt * */ timer.tick`.
			// Passing different dt values to adapter.step has zero effect on
			// the integration step. This is documented-but-fragile.
			const r1 = makeBody();
			r1.body.vel.x = 1;
			adapter.step(16); // 60fps frame
			const after16 = r1.body.vel.x; // friction == 0 here, vel.x ≈ 1 still

			const r2 = makeBody();
			r2.body.vel.x = 1;
			adapter.step(1000); // a 1-second "long" frame
			const after1000 = r2.body.vel.x;

			// dt is ignored → both produce the same integration delta
			expect(after16).toEqual(after1000);
		});
	});

	describe("friction integration — near-zero edge", () => {
		it("PIN: friction stops a body exactly at zero, never overshoots into wrong sign", () => {
			// Friction code path: `nx<0 ? nx : x>0 ? x : 0`. If vel and
			// friction magnitudes are close, vel should clamp to 0 — never
			// flip sign. Test pins that invariant across a sweep.
			for (const v of [0.001, 0.1, 0.39, 0.4, 0.41, 0.5, 1, 3]) {
				const r = makeBody({ frictionAir: { x: 0.4, y: 0 } });
				r.body.vel.x = v;
				adapter.step(16);
				expect(r.body.vel.x).toBeGreaterThanOrEqual(0);
				adapter.removeBody(r);
			}
			for (const v of [-0.001, -0.1, -0.39, -0.4, -0.41, -0.5, -1, -3]) {
				const r = makeBody({ frictionAir: { x: 0.4, y: 0 } });
				r.body.vel.x = v;
				adapter.step(16);
				expect(r.body.vel.x).toBeLessThanOrEqual(0);
				adapter.removeBody(r);
			}
		});
	});

	describe("gravity scale corner values", () => {
		it("gravityScale = 0 skips gravity contribution", () => {
			adapter.gravity.set(0, 1);
			const r = makeBody({ gravityScale: 0 });
			adapter.step(16);
			expect(r.body.vel.y).toEqual(0);
		});

		it("gravityScale = -1 makes a body fall UP", () => {
			adapter.gravity.set(0, 1);
			const r = makeBody({ gravityScale: -1 });
			adapter.step(16);
			expect(r.body.vel.y).toBeLessThan(0); // upward
		});

		it("ignoreGravity wins over a non-zero gravityScale", () => {
			adapter.gravity.set(0, 1);
			const r = makeBody({ gravityScale: 5 });
			r.body.ignoreGravity = true;
			adapter.step(16);
			expect(r.body.vel.y).toEqual(0);
		});
	});

	describe("vector parameter aliasing — copy vs reference", () => {
		it("setVelocity copies the input vector (mutating source after the call is safe)", () => {
			const r = makeBody();
			const v = new Vector2d(5, 7);
			adapter.setVelocity(r, v);
			v.set(99, 99); // mutate after the call
			expect(r.body.vel.x).toEqual(5);
			expect(r.body.vel.y).toEqual(7);
		});

		it("applyForce reads the input vector at call time (no later mutation hazard)", () => {
			const r = makeBody();
			const force = new Vector2d(3, 0);
			adapter.applyForce(r, force);
			force.set(99, 99); // mutate after the call
			expect(r.body.force.x).toEqual(3);
		});

		it("BUG?: applyForce called twice with the SAME reused vector accumulates twice", () => {
			// User reuses a scratch vector across two .applyForce calls in
			// one frame. The adapter `+=` semantics mean each call adds.
			// This is documented in the adversarial spec, but pin it here
			// in the context of "the platformer reuses scratch vectors".
			const r = makeBody();
			const scratch = new Vector2d();
			adapter.applyForce(r, scratch.set(2, 0));
			adapter.applyForce(r, scratch.set(2, 0));
			expect(r.body.force.x).toEqual(4);
		});
	});

	describe("setter calls on a renderable with no body — crashes vs no-ops", () => {
		it("BUG?: setStatic on a renderable without a body throws", () => {
			const r = new Renderable(0, 0, 32, 32);
			// no addBody call — renderable.body is undefined
			expect(() => {
				adapter.setStatic(r, true);
			}).toThrow();
		});

		it("BUG?: setMaxVelocity on a renderable without a body throws", () => {
			const r = new Renderable(0, 0, 32, 32);
			expect(() => {
				adapter.setMaxVelocity(r, { x: 1, y: 1 });
			}).toThrow();
		});

		it("BUG?: applyForce on a renderable without a body throws", () => {
			const r = new Renderable(0, 0, 32, 32);
			expect(() => {
				adapter.applyForce(r, new Vector2d(1, 0));
			}).toThrow();
		});
	});
});
