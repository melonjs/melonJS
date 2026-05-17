/**
 * Coverage for the angular API on BuiltinAdapter:
 *   - Body fields: `angle`, `angularVelocity`, `angularDrag`, `pseudoInertia`
 *   - Body methods: setAngle, getAngle, setAngularVelocity,
 *     getAngularVelocity, applyTorque, applyForce(x, y, pointX?, pointY?)
 *   - Adapter top-level: setAngle, getAngle, setAngularVelocity,
 *     getAngularVelocity, applyTorque, applyForce(rend, F, point?)
 *   - Integration: `update()` advances `angle` from `angularVelocity`,
 *     applies `angularDrag` damping, and writes the resulting rotation
 *     to `renderable.currentTransform` around the body bounds center.
 *
 * Default-off invariants: a body that never touches the angular API
 * must behave exactly as it did before the API existed — zero angular
 * fields, zero transform mutation, identical `update()` return values.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	BuiltinAdapter,
	boot,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";

describe("Physics : BuiltinAdapter angular API", () => {
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
		// eslint-disable-next-line no-new
		new World(0, 0, 800, 600, adapter);
	});

	/** Build a 32×32 dynamic body centered at the renderable origin. */
	const makeBody = (w = 32, h = 32) => {
		const r = new Renderable(0, 0, w, h);
		const body = adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, w, h)],
		});
		return { r, body };
	};

	describe("default state (off)", () => {
		it("a fresh body has zero angle / angularVelocity / angularDrag", () => {
			const { body } = makeBody();
			expect(body.angle).toBe(0);
			expect(body.angularVelocity).toBe(0);
			expect(body.angularDrag).toBe(0);
		});

		it("pseudoInertia is derived from bounds after addShape", () => {
			const { body } = makeBody(60, 80);
			// (60² + 80²) / 12 = (3600 + 6400)/12 = 833.33...
			expect(body.pseudoInertia).toBeCloseTo((60 * 60 + 80 * 80) / 12, 5);
		});

		it("a non-rotating body's update() does not write to currentTransform", () => {
			const { r, body } = makeBody();
			r.currentTransform.identity();
			const before = r.currentTransform.toArray().slice();
			body.update();
			expect(r.currentTransform.toArray()).toEqual(before);
		});

		it("a non-rotating body's update() returns false (no linear movement)", () => {
			const { body } = makeBody();
			expect(body.update()).toBe(false);
		});
	});

	describe("accessors", () => {
		it("setAngle / getAngle round-trips", () => {
			const { body } = makeBody();
			body.setAngle(1.234);
			expect(body.getAngle()).toBeCloseTo(1.234, 6);
			expect(body.angle).toBeCloseTo(1.234, 6);
		});

		it("setAngularVelocity / getAngularVelocity round-trips", () => {
			const { body } = makeBody();
			body.setAngularVelocity(0.05);
			expect(body.getAngularVelocity()).toBeCloseTo(0.05, 6);
			expect(body.angularVelocity).toBeCloseTo(0.05, 6);
		});

		it("setAngle immediately writes to currentTransform (no update() needed)", () => {
			const { r, body } = makeBody();
			r.currentTransform.identity();
			body.setAngle(Math.PI / 2);
			// After a 90° rotation, the transform is no longer identity
			expect(r.currentTransform.isIdentity()).toBe(false);
		});

		it("setAngle(0) on a previously-rotated body restores identity", () => {
			const { r, body } = makeBody();
			body.setAngle(0.5);
			expect(r.currentTransform.isIdentity()).toBe(false);
			body.setAngle(0);
			expect(r.currentTransform.isIdentity()).toBe(true);
		});
	});

	describe("integration", () => {
		it("update() advances angle by angularVelocity each step", () => {
			const { body } = makeBody();
			body.setAngularVelocity(0.1);
			const before = body.angle;
			body.update();
			// dt is internally `timer.tick` which is normalized to 1 by
			// default in tests; verify the delta matches angularVelocity
			expect(body.angle - before).toBeCloseTo(0.1, 4);
		});

		it("multiple updates accumulate", () => {
			const { body } = makeBody();
			body.setAngularVelocity(0.05);
			body.update();
			body.update();
			body.update();
			expect(body.angle).toBeCloseTo(0.15, 3);
		});

		it("angularDrag damps angularVelocity exponentially", () => {
			const { body } = makeBody();
			body.setAngularVelocity(1.0);
			body.angularDrag = 0.1;
			body.update();
			// after one step, ω *= (1 - 0.1) = 0.9
			expect(body.angularVelocity).toBeCloseTo(0.9, 4);
			body.update();
			// 0.9 * 0.9 = 0.81
			expect(body.angularVelocity).toBeCloseTo(0.81, 4);
		});

		it("angularDrag of 0 leaves angularVelocity unchanged", () => {
			const { body } = makeBody();
			body.setAngularVelocity(0.5);
			body.angularDrag = 0;
			body.update();
			body.update();
			expect(body.angularVelocity).toBe(0.5);
		});

		it("angularDrag of 1 zeros angularVelocity in one step", () => {
			const { body } = makeBody();
			body.setAngularVelocity(2.0);
			body.angularDrag = 1.0;
			body.update();
			expect(body.angularVelocity).toBe(0);
		});

		it("integration is gated: ω=0 AND angle=0 means transform untouched", () => {
			const { r, body } = makeBody();
			r.currentTransform.identity();
			r.currentTransform.translate(10, 20); // user-set transform
			const before = r.currentTransform.toArray().slice();
			body.update();
			// no angular activity — user's transform should be preserved
			expect(r.currentTransform.toArray()).toEqual(before);
		});
	});

	describe("applyTorque", () => {
		it("adds torque/pseudoInertia to angularVelocity", () => {
			const { body } = makeBody();
			const I = body.pseudoInertia;
			body.applyTorque(I); // expect Δω = 1
			expect(body.angularVelocity).toBeCloseTo(1.0, 5);
		});

		it("is additive (multiple calls accumulate)", () => {
			const { body } = makeBody();
			const I = body.pseudoInertia;
			body.applyTorque(I * 0.3);
			body.applyTorque(I * 0.4);
			expect(body.angularVelocity).toBeCloseTo(0.7, 5);
		});

		it("torque of 0 is a no-op", () => {
			const { body } = makeBody();
			body.applyTorque(0);
			expect(body.angularVelocity).toBe(0);
		});

		it("negative torque rotates the other way", () => {
			const { body } = makeBody();
			const I = body.pseudoInertia;
			body.applyTorque(-I);
			expect(body.angularVelocity).toBeCloseTo(-1.0, 5);
		});
	});

	describe("applyForce with offset (lever arm → torque)", () => {
		it("applyForce(x, y) without point: no rotation generated", () => {
			const { body } = makeBody();
			body.applyForce(10, 0);
			expect(body.angularVelocity).toBe(0);
			expect(body.force.x).toBe(10);
		});

		it("applyForce at the body centroid: no torque, only linear", () => {
			const { body } = makeBody();
			// bounds are 0..32 → centroid at (16, 16)
			body.applyForce(5, 0, 16, 16);
			expect(body.angularVelocity).toBe(0);
			expect(body.force.x).toBe(5);
		});

		it("force pushing right at top of body rotates clockwise (visual)", () => {
			const { body } = makeBody();
			// centroid (16, 16). Apply +X force at top (y=0):
			// r = (16-16, 0-16) = (0, -16). F = (10, 0).
			// τ = rx*Fy - ry*Fx = 0*0 - (-16)*10 = +160.
			// Positive τ with screen-Y-down convention reads as clockwise.
			body.applyForce(10, 0, 16, 0);
			expect(body.angularVelocity).toBeGreaterThan(0);
			expect(body.force.x).toBe(10);
		});

		it("force pushing right at bottom of body rotates counter-clockwise", () => {
			const { body } = makeBody();
			// r = (16-16, 32-16) = (0, 16). F = (10, 0).
			// τ = 0 - 16*10 = -160. Negative → counter-clockwise visually.
			body.applyForce(10, 0, 16, 32);
			expect(body.angularVelocity).toBeLessThan(0);
		});

		it("vertical force at horizontal offset produces a torque too", () => {
			const { body } = makeBody();
			// centroid (16, 16). Apply +Y at left edge (x=0).
			// r = (0-16, 16-16) = (-16, 0). F = (0, 10).
			// τ = rx*Fy - ry*Fx = (-16)*10 - 0 = -160.
			body.applyForce(0, 10, 0, 16);
			expect(body.angularVelocity).toBeLessThan(0);
			expect(body.force.y).toBe(10);
		});

		it("magnitude scales with lever arm length", () => {
			const { body: b1 } = makeBody();
			const { body: b2 } = makeBody();
			b1.applyForce(10, 0, 16, 0); // offset 16
			b2.applyForce(10, 0, 16, -16); // offset 32 (twice as far)
			expect(Math.abs(b2.angularVelocity)).toBeCloseTo(
				Math.abs(b1.angularVelocity) * 2,
				4,
			);
		});

		it("torque additive across multiple applyForce calls", () => {
			const { body } = makeBody();
			body.applyForce(10, 0, 16, 0); // some +τ
			const first = body.angularVelocity;
			body.applyForce(10, 0, 16, 0); // same again
			expect(body.angularVelocity).toBeCloseTo(first * 2, 5);
		});
	});

	describe("pseudoInertia behavior", () => {
		it("manual override is respected by applyTorque", () => {
			const { body } = makeBody();
			body.pseudoInertia = 100;
			body.applyTorque(100);
			expect(body.angularVelocity).toBeCloseTo(1.0, 5);
		});

		it("manual override is respected by applyForce-with-offset", () => {
			const { body } = makeBody();
			body.pseudoInertia = 1;
			body.applyForce(1, 0, 16, 0);
			// τ = 0*0 - (-16)*1 = 16; Δω = 16/1 = 16
			expect(body.angularVelocity).toBeCloseTo(16, 4);
		});
	});

	describe("transform pivot", () => {
		it("rotation pivot is the body's bounds center, not the renderable origin", () => {
			const { r, body } = makeBody(40, 40);
			// Set angle to 90°. The transform should map (0, 0) — the
			// renderable origin (top-left of the 40×40 box) — to a point
			// reachable by rotating around the bounds center (20, 20).
			// Rotating (0, 0) by +90° around (20, 20):
			//   translate(-20, -20): (-20, -20)
			//   rotate(+90°): (20, -20)
			//   translate(+20, +20): (40, 0)
			body.setAngle(Math.PI / 2);
			const t = r.currentTransform;
			const p = new Vector2d(0, 0);
			t.apply(p);
			expect(p.x).toBeCloseTo(40, 4);
			expect(p.y).toBeCloseTo(0, 4);
		});
	});

	describe("adversarial / robustness", () => {
		it("applyTorque is a no-op when pseudoInertia is 0", () => {
			const { body } = makeBody();
			body.pseudoInertia = 0;
			body.applyTorque(100);
			expect(body.angularVelocity).toBe(0);
		});

		it("applyForce-with-offset is a no-op when pseudoInertia is 0", () => {
			const { body } = makeBody();
			body.pseudoInertia = 0;
			body.applyForce(10, 0, 16, 0);
			expect(body.angularVelocity).toBe(0);
			// linear part still applies
			expect(body.force.x).toBe(10);
		});

		it("applyTorque is a no-op when pseudoInertia is negative", () => {
			const { body } = makeBody();
			body.pseudoInertia = -5;
			body.applyTorque(100);
			expect(body.angularVelocity).toBe(0);
		});

		it("very large angularVelocity integrates without crashing", () => {
			const { body } = makeBody();
			body.setAngularVelocity(1e6);
			body.update();
			expect(Number.isFinite(body.angle)).toBe(true);
			expect(Number.isFinite(body.angularVelocity)).toBe(true);
		});

		it("very large angle (multi-revolution) is preserved (no auto-wrap)", () => {
			const { body } = makeBody();
			body.setAngle(100 * Math.PI);
			expect(body.angle).toBeCloseTo(100 * Math.PI, 4);
		});

		it("angularDrag > 1 flips sign each step (documented foot-gun)", () => {
			const { body } = makeBody();
			body.setAngularVelocity(1.0);
			body.angularDrag = 2.0;
			body.update();
			// ω *= (1 - 2) = -1
			expect(body.angularVelocity).toBeCloseTo(-1.0, 4);
		});

		it("negative angularDrag is ignored (no amplification, no crash)", () => {
			const { body } = makeBody();
			body.setAngularVelocity(1.0);
			body.angularDrag = -0.5;
			body.update();
			// drag is gated on `> 0`, so negative values are treated as "off"
			// — angularVelocity stays put rather than exploding.
			expect(body.angularVelocity).toBe(1.0);
		});

		it("an explicit angle but zero velocity keeps the transform synced", () => {
			const { r, body } = makeBody();
			body.setAngle(0.5);
			body.update();
			// Even with ω=0, because angle != 0 the integrator runs and
			// re-syncs the transform — important if the user manually
			// clobbers currentTransform between frames.
			expect(r.currentTransform.isIdentity()).toBe(false);
		});
	});

	describe("adapter top-level surface", () => {
		it("setAngle / getAngle delegate to the body", () => {
			const { r, body } = makeBody();
			adapter.setAngle(r, 1.0);
			expect(body.angle).toBeCloseTo(1.0, 6);
			expect(adapter.getAngle(r)).toBeCloseTo(1.0, 6);
		});

		it("setAngularVelocity / getAngularVelocity delegate to the body", () => {
			const { r, body } = makeBody();
			adapter.setAngularVelocity(r, 0.25);
			expect(body.angularVelocity).toBeCloseTo(0.25, 6);
			expect(adapter.getAngularVelocity(r)).toBeCloseTo(0.25, 6);
		});

		it("applyTorque delegates to the body", () => {
			const { r, body } = makeBody();
			adapter.applyTorque(r, body.pseudoInertia);
			expect(body.angularVelocity).toBeCloseTo(1.0, 5);
		});

		it("applyForce without point: linear only (backward compat)", () => {
			const { r, body } = makeBody();
			adapter.applyForce(r, new Vector2d(7, 0));
			expect(body.force.x).toBe(7);
			expect(body.angularVelocity).toBe(0);
		});

		it("applyForce with point: linear + torque", () => {
			const { r, body } = makeBody();
			adapter.applyForce(r, new Vector2d(10, 0), new Vector2d(16, 0));
			expect(body.force.x).toBe(10);
			expect(body.angularVelocity).toBeGreaterThan(0);
		});
	});
});
