import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera3d,
	Renderable,
	Vector3d,
	video,
} from "../src/index.js";

/**
 * `Camera3d.setBasis` and `lookAt(target, up)` — posing a camera FROM an
 * orientation rather than integrating towards one.
 *
 * The case that needs it is a view over a curved surface, where up is the
 * surface normal and differs at every point, so no pitch and yaw pair
 * expresses it. An in-repo example had to rotate the whole world into the
 * camera's frame instead, and said so in a comment.
 *
 * What these tests are really defending:
 *
 * - the decode has no `1 / cos(pitch)` anywhere, so there is no pole to
 *   special-case. The textbook `atan2(right.y, up.y)` divides by it and needs
 *   a degenerate branch that pins the roll to zero and loses the orientation.
 *   B2 and B3 are the tests that tell the two apart.
 * - a drifted, slightly sheared basis is ABSORBED rather than stored. The
 *   camera keeps three angles, not a matrix, so it cannot end up holding
 *   something that is not a rotation.
 * - the angles remain the only orientation state, so everything downstream
 *   (view transform, frustum, billboards) follows with nothing to
 *   invalidate. B9 and B10 are the links that prove it.
 *
 * The basis columns come out of a `Float32Array`, so 6 decimal places is the
 * meaningful precision here, not 12.
 */
describe("Camera3d.setBasis", () => {
	let app;
	beforeAll(async () => {
		// Renderable's observable callbacks need a renderer to construct
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	/** read a camera's basis into three fresh vectors */
	const basisOf = (cam) => {
		const right = new Vector3d();
		const up = new Vector3d();
		const forward = new Vector3d();
		cam.getBasis(right, up, forward);
		return { right, up, forward };
	};

	const expectVectorClose = (actual, expected, label) => {
		expect(actual.x, `${label}.x`).toBeCloseTo(expected.x, 6);
		expect(actual.y, `${label}.y`).toBeCloseTo(expected.y, 6);
		expect(actual.z, `${label}.z`).toBeCloseTo(expected.z, 6);
	};

	it("round-trips getBasis at a generic pose", () => {
		const source = new Camera3d(0, 0, 800, 600);
		source.pitch = 0.3;
		source.yaw = -1.1;
		source.roll = 0.7;
		const b = basisOf(source);

		const posed = new Camera3d(0, 0, 800, 600);
		posed.setBasis(b.right, b.up, b.forward);

		expect(posed.pitch).toBeCloseTo(0.3, 6);
		expect(posed.yaw).toBeCloseTo(-1.1, 6);
		expect(posed.roll).toBeCloseTo(0.7, 6);

		// and the basis it reports back is the one it was given
		const after = basisOf(posed);
		expectVectorClose(after.right, b.right, "right");
		expectVectorClose(after.up, b.up, "up");
		expectVectorClose(after.forward, b.forward, "forward");
	});

	it("reproduces a pole basis exactly, from a different angle triple", () => {
		// Looking straight down (+Y is down here) with a quarter turn of
		// roll. The decode returns (pitch PI/2, yaw 0, roll -PI/2) rather
		// than the (PI/2, PI/2, 0) that generated it: at cos(pitch) = 0 the
		// matrix depends only on yaw - roll, so a DIFFERENT triple gives the
		// SAME matrix. Asserting on the columns rather than the angles is
		// what makes that a pass instead of a false alarm.
		const posed = new Camera3d(0, 0, 800, 600);
		posed.setBasis(
			new Vector3d(0, 0, -1),
			new Vector3d(1, 0, 0),
			new Vector3d(0, -1, 0),
		);
		const b = basisOf(posed);
		expectVectorClose(b.right, new Vector3d(0, 0, -1), "right");
		expectVectorClose(b.up, new Vector3d(1, 0, 0), "up");
		expectVectorClose(b.forward, new Vector3d(0, -1, 0), "forward");
	});

	it("reproduces the opposite pole too", () => {
		// the sign of the zero-roll up axis is only exercised by the other
		// pole: a slip there passes the test above and fails this one
		const posed = new Camera3d(0, 0, 800, 600);
		posed.setBasis(
			new Vector3d(1, 0, 0),
			new Vector3d(0, 0, -1),
			new Vector3d(0, 1, 0),
		);
		const b = basisOf(posed);
		expectVectorClose(b.right, new Vector3d(1, 0, 0), "right");
		expectVectorClose(b.up, new Vector3d(0, 0, -1), "up");
		expectVectorClose(b.forward, new Vector3d(0, 1, 0), "forward");
	});

	it("stays conditioned within a microradian of the pole", () => {
		// any `1 / cos(pitch)` in the roll extraction blows up here
		const source = new Camera3d(0, 0, 800, 600);
		source.pitch = Math.PI / 2 - 1e-6;
		source.yaw = 1.2;
		source.roll = -0.4;
		const b = basisOf(source);

		const posed = new Camera3d(0, 0, 800, 600);
		posed.setBasis(b.right, b.up, b.forward);

		const after = basisOf(posed);
		expectVectorClose(after.right, b.right, "right");
		expectVectorClose(after.up, b.up, "up");
		expectVectorClose(after.forward, b.forward, "forward");
	});

	it("absorbs a drifted, sheared basis instead of storing it", () => {
		// A surface frame integrated over thousands of steps comes back
		// scaled and no longer square. Measured in one example at |pos| =
		// 1.03. The camera keeps angles, not a matrix, so the only question
		// is whether the decode survives it: `forward` wins, and only the
		// part of `up` perpendicular to it is consulted.
		const source = new Camera3d(0, 0, 800, 600);
		source.pitch = 0.3;
		source.yaw = -1.1;
		source.roll = 0.7;
		const clean = basisOf(source);

		const drift = (v) => {
			return new Vector3d(
				(v.x + 0.02 * clean.forward.x) * 1.03,
				(v.y + 0.02 * clean.forward.y) * 1.03,
				(v.z + 0.02 * clean.forward.z) * 1.03,
			);
		};

		const posed = new Camera3d(0, 0, 800, 600);
		posed.setBasis(drift(clean.right), drift(clean.up), drift(clean.forward));

		expect(posed.pitch).toBeCloseTo(0.3, 4);
		expect(posed.yaw).toBeCloseTo(-1.1, 4);
		expect(posed.roll).toBeCloseTo(0.7, 4);

		// and what it reports back is a proper rotation again
		const after = basisOf(posed);
		expect(after.right.length()).toBeCloseTo(1, 6);
		expect(after.up.length()).toBeCloseTo(1, 6);
		expect(after.forward.length()).toBeCloseTo(1, 6);
	});

	it("does not modify the vectors it is given", () => {
		// a caller may hand over a shared, read-only axis; normalising in
		// place would corrupt it for everyone else
		const right = new Vector3d(2, 0, 0);
		const up = new Vector3d(0, 2, 0);
		const forward = new Vector3d(0, 0, 2);
		const posed = new Camera3d(0, 0, 800, 600);
		posed.setBasis(right, up, forward);

		expectVectorClose(right, new Vector3d(2, 0, 0), "right");
		expectVectorClose(up, new Vector3d(0, 2, 0), "up");
		expectVectorClose(forward, new Vector3d(0, 0, 2), "forward");
	});

	it("leaves currentTransform alone and returns this", () => {
		// the 3D view never reads the camera's 2D transform, so writing the
		// orientation there would look right in isolation and render nothing
		const posed = new Camera3d(0, 0, 800, 600);
		const returned = posed.setBasis(
			new Vector3d(1, 0, 0),
			new Vector3d(0, 1, 0),
			new Vector3d(0, 0, 1),
		);
		expect(returned).toBe(posed);
		expect(posed.currentTransform.isIdentity()).toBe(true);
	});

	it("throws on a zero-length or non-finite basis", () => {
		const posed = new Camera3d(0, 0, 800, 600);
		// without the guard these produce NaN angles, the view matrix goes
		// NaN, and the frame renders empty with nothing in the console
		expect(() => {
			return posed.setBasis(
				new Vector3d(1, 0, 0),
				new Vector3d(0, 1, 0),
				new Vector3d(0, 0, 0),
			);
		}).toThrow(/forward must have a non-zero length/);
		expect(() => {
			return posed.setBasis(
				new Vector3d(Number.NaN, 0, 0),
				new Vector3d(0, 1, 0),
				new Vector3d(0, 0, 1),
			);
		}).toThrow(/must all be finite/);
	});

	it("resolves a direction whose length would underflow", () => {
		// squaring 1e-200 is 0 in float64, so a length taken in the input's
		// own scale is 0 even though no component is. That is a property of
		// the arithmetic, not of the input: the vector names a direction, so
		// the camera resolves it instead of rejecting it. Only an all-zero
		// forward carries no direction, and that is the case that throws.
		const posed = new Camera3d(0, 0, 800, 600);
		posed.setBasis(
			new Vector3d(1, 0, 0),
			new Vector3d(0, 0, 1),
			new Vector3d(0, -1e-200, 0),
		);
		expect(posed.pitch).toBeCloseTo(Math.PI / 2, 6);
	});

	it("falls back to the right axis when up cannot decide", () => {
		// up parallel to forward determines no rotation about the view axis.
		// Dropping `right` from the signature as "redundant" would lose this.
		const posed = new Camera3d(0, 0, 800, 600);
		// a NON-zero prior roll, so that "solve it from right" and "keep the
		// roll we had" give different answers. With roll already 0 the two
		// coincide and the test proves nothing.
		posed.roll = 1;
		posed.setBasis(
			new Vector3d(1, 0, 0),
			new Vector3d(0, 0, 1),
			new Vector3d(0, 0, 1),
		);
		expect(posed.roll).toBeCloseTo(0, 6);
		const b = basisOf(posed);
		expectVectorClose(b.right, new Vector3d(1, 0, 0), "right");
		expectVectorClose(b.forward, new Vector3d(0, 0, 1), "forward");
	});

	it("reaches the view transform", () => {
		// the failure this catches is an orientation written into new
		// private state that the view never reads
		const cam = new Camera3d(0, 0, 800, 600);
		cam.pos.set(0, 0);
		cam.depth = 0;
		// look along +X, with screen-up along -Y
		cam.setBasis(
			new Vector3d(0, 0, -1),
			new Vector3d(0, 1, 0),
			new Vector3d(1, 0, 0),
		);
		const centre = cam.worldToScreen(new Vector3d(100, 0, 0));
		expect(centre.x).toBeCloseTo(400, 0);
		expect(centre.y).toBeCloseTo(300, 0);
	});

	it("reaches the frustum planes", () => {
		const cam = new Camera3d(0, 0, 800, 600);
		cam.pos.set(0, 0);
		cam.depth = 0;
		cam.setBasis(
			new Vector3d(0, 0, -1),
			new Vector3d(0, 1, 0),
			new Vector3d(1, 0, 0),
		);
		cam.update(16);

		const ahead = new Renderable(0, 0, 10, 10);
		ahead.pos.set(200, 0, 0);
		const behind = new Renderable(0, 0, 10, 10);
		behind.pos.set(-200, 0, 0);

		expect(cam.isVisible(ahead, false)).toBe(true);
		expect(cam.isVisible(behind, false)).toBe(false);
	});
});

describe("Camera3d.lookAt with an up vector", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	it("takes the direction that should appear UP ON SCREEN", () => {
		// The sign decision, asserted in screen terms so it cannot hide
		// behind a plausible-looking vector. This engine renders Y-down, so
		// the visual up axis is -Y and a level horizon is (0, -1, 0) — which
		// is the sense the engine's own WORLD_UP constant already uses.
		const cam = new Camera3d(0, 0, 800, 600);
		cam.pos.set(0, 0);
		cam.depth = 0;
		cam.roll = 1.23;

		cam.lookAt(0, 0, 100, new Vector3d(0, -1, 0));
		expect(cam.roll).toBeCloseTo(0, 9);

		// world +X asked for as screen-up: a point offset along +X must
		// render ABOVE centre, not beside it
		cam.lookAt(0, 0, 100, new Vector3d(1, 0, 0));
		const p = cam.worldToScreen(new Vector3d(10, 0, 100));
		expect(p.y).toBeLessThan(300);
		expect(p.x).toBeCloseTo(400, 0);
	});

	it("agrees with setBasis on the same pose", () => {
		// the two entry points take `up` in opposite senses by design; this
		// is what stops that becoming an inconsistency
		const cam = new Camera3d(0, 0, 800, 600);
		cam.pos.set(0, 0);
		cam.depth = 0;
		cam.lookAt(30, -20, 100, new Vector3d(0, -1, 0));

		const right = new Vector3d();
		const up = new Vector3d();
		const forward = new Vector3d();
		cam.getBasis(right, up, forward);

		const posed = new Camera3d(0, 0, 800, 600);
		posed.setBasis(right, up, forward);
		expect(posed.pitch).toBeCloseTo(cam.pitch, 6);
		expect(posed.yaw).toBeCloseTo(cam.yaw, 6);
		expect(posed.roll).toBeCloseTo(cam.roll, 6);
	});

	it("keeps the roll it had when the target lies along up", () => {
		// both projections are exactly zero here, so without the guard
		// atan2(0, 0) returns 0 and the camera lurches whenever a target
		// crosses the up axis
		const cam = new Camera3d(0, 0, 800, 600);
		cam.pos.set(0, 0);
		cam.depth = 0;
		cam.roll = 0.42;

		cam.lookAt(0, -100, 0, new Vector3d(0, -1, 0));
		expect(cam.roll).toBe(0.42);

		const forward = new Vector3d();
		cam.getForward(forward);
		expect(forward.y).toBeCloseTo(-1, 6);

		// antiparallel too
		cam.lookAt(0, 100, 0, new Vector3d(0, -1, 0));
		expect(cam.roll).toBe(0.42);
	});

	it("accepts up in the object call shape as the second argument", () => {
		const cam = new Camera3d(0, 0, 800, 600);
		cam.pos.set(0, 0);
		cam.depth = 0;
		cam.roll = 1.5;
		cam.lookAt(new Vector3d(0, 0, 100), new Vector3d(0, -1, 0));
		expect(cam.roll).toBeCloseTo(0, 9);
	});

	it("setLookAt forwards the up vector", () => {
		const cam = new Camera3d(0, 0, 800, 600);
		cam.pos.set(0, 0);
		cam.depth = 0;
		cam.roll = 1.5;
		cam.setLookAt(new Vector3d(0, 0, 100), new Vector3d(0, -1, 0));
		expect(cam.roll).toBeCloseTo(0, 9);
	});
});

describe("Camera3d.reset", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	it("clears all three angles, not just roll", () => {
		// The inherited 2D reset clears `roll` only, because in 2D the roll
		// IS the transform matrix it identity-resets. It knows nothing about
		// pitch and yaw, so a reset camera used to keep pointing wherever it
		// had been left.
		const cam = new Camera3d(0, 0, 800, 600);
		cam.pitch = 0.3;
		cam.yaw = 0.4;
		cam.roll = 0.5;
		cam.reset();
		expect(cam.pitch).toBe(0);
		expect(cam.yaw).toBe(0);
		expect(cam.roll).toBe(0);
	});

	it("clears the depth, which the 2D reset does not know about", () => {
		// `Camera2d.reset` writes pos.x and pos.y and stops, so the depth
		// survived and a reset camera stood wherever it had flown to
		const cam = new Camera3d(0, 0, 800, 600);
		cam.setPosition(50, 60, -400);
		cam.reset();
		expect(cam.pos.x).toBe(0);
		expect(cam.pos.y).toBe(0);
		expect(cam.depth).toBe(0);
	});

	it("takes an explicit position, depth included", () => {
		const cam = new Camera3d(0, 0, 800, 600);
		cam.setPosition(1, 2, 3);
		cam.pitch = 1;
		cam.reset(10, 20, 30);
		expect(cam.pos.x).toBe(10);
		expect(cam.pos.y).toBe(20);
		expect(cam.depth).toBe(30);
		expect(cam.pitch).toBe(0);
	});

	it("still does the 2D reset it inherits", () => {
		// the override must not replace the parent's work, only add to it
		const cam = new Camera3d(0, 0, 800, 600);
		cam.roll = 0.5;
		cam.reset();
		expect(cam.currentTransform.isIdentity()).toBe(true);
	});

	it("leaves a basis-posed camera looking straight down z", () => {
		// the case the override exists for: posed by basis, then reset
		const cam = new Camera3d(0, 0, 800, 600);
		cam.setBasis(
			new Vector3d(0, 0, -1),
			new Vector3d(1, 0, 0),
			new Vector3d(0, -1, 0),
		);
		cam.reset();
		const forward = new Vector3d();
		cam.getForward(forward);
		expect(forward.x).toBeCloseTo(0, 6);
		expect(forward.y).toBeCloseTo(0, 6);
		expect(forward.z).toBeCloseTo(1, 6);
	});
});

describe("Camera3d.setPosition", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	it("writes all three components, which pos.set cannot", () => {
		// `pos` is typed as the 2D vector its geometry declares, so
		// `pos.set(x, y)` takes two arguments and zeroes the depth. Reaching
		// past that needed a double cast in two separate examples.
		const cam = new Camera3d(0, 0, 800, 600);
		cam.setPosition(10, -20, 30);
		expect(cam.pos.x).toBe(10);
		expect(cam.pos.y).toBe(-20);
		expect(cam.depth).toBe(30);
		// asserted on the VECTOR as well, not just the accessor: `depth` is
		// `pos.z` today, and checking only `depth` would pass just as
		// happily if it were a separate field the position never reached
		expect(cam.pos.z).toBe(30);
	});

	it("does not clamp to the camera bounds, and chains", () => {
		// deliberately unlike moveTo: a 3D camera is placed, not scrolled,
		// and a 2D scroll bound rarely suits a viewpoint
		const cam = new Camera3d(0, 0, 800, 600);
		cam.setBounds(0, 0, 100, 100);
		const returned = cam.setPosition(-500, -500, -500);
		expect(returned).toBe(cam);
		expect(cam.pos.x).toBe(-500);
		expect(cam.pos.y).toBe(-500);
		expect(cam.depth).toBe(-500);
	});
});
