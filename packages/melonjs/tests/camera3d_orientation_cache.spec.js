/**
 * `Camera3d` builds its orientation from `yaw`, `pitch` and `roll` once, as a
 * `Quaternion`, and reuses it for the view, the frustum, the fog and
 * `getBasis` until an angle changes. It applies the view to a container by
 * one multiply, and reverts it by putting back the transform the container
 * had: exactly, where turning it back by the opposite angles left a rounding
 * error in it every frame.
 *
 * The reference here is the way the camera built its turn before: three
 * `Matrix3d#rotate` calls, yaw about Y, then pitch about X, then roll about Z.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera3d,
	Container,
	Matrix3d,
	Renderable,
	Vector3d,
	video,
} from "../src/index.js";

const AXIS_X = new Vector3d(1, 0, 0);
const AXIS_Y = new Vector3d(0, 1, 0);
const AXIS_Z = new Vector3d(0, 0, 1);

/** the camera's orientation as it was built before: camera to world */
const reference = (yaw, pitch, roll) => {
	return new Matrix3d()
		.rotate(yaw, AXIS_Y)
		.rotate(pitch, AXIS_X)
		.rotate(roll, AXIS_Z);
};

/** the camera's right, up and forward, through the public API */
const basisOf = (cam) => {
	const r = new Vector3d();
	const u = new Vector3d();
	const f = new Vector3d();
	cam.getBasis(r, u, f);
	return [r, u, f];
};

const expectBasis = (cam, m, digits = 5) => {
	const [r, u, f] = basisOf(cam);
	const v = m.val;
	for (const [vec, o] of [
		[r, 0],
		[u, 4],
		[f, 8],
	]) {
		expect(vec.x).toBeCloseTo(v[o], digits);
		expect(vec.y).toBeCloseTo(v[o + 1], digits);
		expect(vec.z).toBeCloseTo(v[o + 2], digits);
	}
};

/** the view rotation as it was built before: world to camera */
const referenceView = (yaw, pitch, roll) => {
	return new Matrix3d()
		.rotate(-roll, AXIS_Z)
		.rotate(-pitch, AXIS_X)
		.rotate(-yaw, AXIS_Y);
};

describe("Camera3d orientation cache", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	const make = () => {
		const cam = new Camera3d(0, 0, 320, 240);
		cam.setPosition(30, -40, -500);
		return cam;
	};

	describe("matches the turn it replaces", () => {
		const angles = [
			[0, 0, 0],
			[0.3, -0.2, 0.05],
			[Math.PI, 0, 0],
			[-Math.PI, Math.PI / 2, -Math.PI],
			[Math.PI / 2, -Math.PI / 2 + 1e-9, 0],
			[1e-12, -1e-12, 1e-12],
			[-0, -0, -0],
			[12.7, -9.1, 31.4],
			[1000, -2000, 3000],
		];
		for (const [yaw, pitch, roll] of angles) {
			it(`getBasis at yaw ${yaw}, pitch ${pitch}, roll ${roll}`, () => {
				const cam = make();
				cam.yaw = yaw;
				cam.pitch = pitch;
				cam.roll = roll;
				// large angles lose digits in either build: compare looser
				expectBasis(cam, reference(yaw, pitch, roll), yaw > 100 ? 3 : 5);
			});
		}

		it("a point is placed on screen where the old view put it", () => {
			const cam = make();
			const angles2 = [0.7, -0.4, 0.2];
			[cam.yaw, cam.pitch, cam.roll] = angles2;
			const p = new Vector3d(120, -60, 300);
			const screen = cam.worldToScreen(p);
			// the old view, by hand: rotate, translate, project, viewport
			const view = referenceView(...angles2).translate(
				-cam.pos.x,
				-cam.pos.y,
				-cam.depth,
			);
			const clip = new Matrix3d()
				.copy(cam.frustum.projectionMatrix)
				.multiply(view);
			const v = clip.val;
			const w = v[3] * p.x + v[7] * p.y + v[11] * p.z + v[15];
			const nx = (v[0] * p.x + v[4] * p.y + v[8] * p.z + v[12]) / w;
			const ny = (v[1] * p.x + v[5] * p.y + v[9] * p.z + v[13]) / w;
			const sx = ((nx + 1) / 2) * cam.width;
			const sy = ((1 - ny) / 2) * cam.height;
			expect(screen.x).toBeCloseTo(sx, 2);
			expect(screen.y).toBeCloseTo(sy, 2);
		});
	});

	describe("is rebuilt when an angle changes, and only then", () => {
		it("each angle alone, written as a field, turns the basis", () => {
			const cam = make();
			expectBasis(cam, reference(0, 0, 0));
			cam.yaw = 0.5;
			expectBasis(cam, reference(0.5, 0, 0));
			cam.pitch = -0.3;
			expectBasis(cam, reference(0.5, -0.3, 0));
			cam.roll = 0.9;
			expectBasis(cam, reference(0.5, -0.3, 0.9));
			// and back to where it started
			cam.yaw = 0;
			cam.pitch = 0;
			cam.roll = 0;
			expectBasis(cam, reference(0, 0, 0));
		});

		it("an angle changed by the smallest step is seen", () => {
			const cam = make();
			cam.yaw = 1;
			const [, , before] = basisOf(cam);
			cam.yaw = 1 + Number.EPSILON * 4;
			const [, , after] = basisOf(cam);
			// the same to the eye, but rebuilt: no stale cache
			expect(after.x).toBeCloseTo(before.x, 12);
			cam.yaw = 1.0001;
			const [, , moved] = basisOf(cam);
			expect(moved.x).not.toBe(before.x);
		});

		it("setBasis and lookAt turn the camera the cache reads", () => {
			const cam = make();
			cam.yaw = 0.4;
			basisOf(cam);
			cam.lookAt(new Vector3d(0, 0, 0));
			expectBasis(cam, reference(cam.yaw, cam.pitch, cam.roll));
			cam.setBasis(
				new Vector3d(0, 0, -1),
				new Vector3d(0, 1, 0),
				new Vector3d(1, 0, 0),
			);
			expectBasis(cam, reference(cam.yaw, cam.pitch, cam.roll));
			const [, , f] = basisOf(cam);
			expect(f.x).toBeCloseTo(1, 5);
		});

		it("reset turns the camera back to looking down +Z", () => {
			const cam = make();
			cam.yaw = 1.2;
			cam.pitch = 0.4;
			basisOf(cam);
			cam.reset();
			const [, , f] = basisOf(cam);
			expect(f.z).toBeCloseTo(1, 6);
		});

		it("two cameras keep their own orientation", () => {
			const a = make();
			const b = make();
			a.yaw = 0.3;
			b.yaw = -1.1;
			b.pitch = 0.2;
			for (let i = 0; i < 3; i++) {
				expectBasis(a, reference(0.3, 0, 0));
				expectBasis(b, reference(-1.1, 0.2, 0));
			}
		});

		it("a NaN angle leaves that turn out, rather than filling the view with NaN", () => {
			const cam = make();
			cam.yaw = Number.NaN;
			cam.pitch = 0.3;
			const [r, u, f] = basisOf(cam);
			for (const v of [r, u, f]) {
				expect(Number.isFinite(v.x + v.y + v.z)).toBe(true);
			}
			expectBasis(cam, reference(0, 0.3, 0));
			// and a finite angle again is used again
			cam.yaw = 0.5;
			expectBasis(cam, reference(0.5, 0.3, 0));
		});
	});

	describe("the view on a container is reverted exactly", () => {
		const turned = () => {
			const c = new Container(0, 0, 100, 100);
			c.currentTransform.translate(3.3, -7.1, 2.2).rotate(0.37).scale(1.3);
			return c;
		};

		it("after one frame, and after ten thousand", () => {
			const cam = make();
			cam.yaw = 0.731;
			cam.pitch = -0.219;
			cam.roll = 0.083;
			const c = turned();
			const before = Float32Array.from(c.currentTransform.val);
			cam._applyContainerViewTransform(c, 11.5, -4.25);
			// the view is on it
			expect(Array.from(c.currentTransform.val)).not.toEqual(
				Array.from(before),
			);
			cam._revertContainerViewTransform(c, 11.5, -4.25);
			expect(Array.from(c.currentTransform.val)).toEqual(Array.from(before));
			for (let i = 0; i < 10000; i++) {
				cam.yaw = 0.731 + (i % 37) * 0.01;
				cam._applyContainerViewTransform(c, 11.5, -4.25);
				cam._revertContainerViewTransform(c, 11.5, -4.25);
			}
			expect(Array.from(c.currentTransform.val)).toEqual(Array.from(before));
		});

		it("applies the same transform the old rotations did", () => {
			const cam = make();
			[cam.yaw, cam.pitch, cam.roll] = [0.4, -0.6, 0.25];
			const c = turned();
			const expected = new Matrix3d()
				.copy(c.currentTransform)
				.multiply(referenceView(0.4, -0.6, 0.25))
				.translate(-11.5, 4.25, -cam.depth);
			cam._applyContainerViewTransform(c, 11.5, -4.25);
			const got = c.currentTransform.val;
			for (let i = 0; i < 16; i++) {
				expect(got[i]).toBeCloseTo(expected.val[i], 4);
			}
			cam._revertContainerViewTransform(c, 11.5, -4.25);
		});

		it("nested containers are put back in the order they were turned", () => {
			const cam = make();
			cam.yaw = 0.5;
			const outer = turned();
			const inner = new Container(0, 0, 10, 10);
			inner.currentTransform.translate(1, 2, 3);
			const o = Array.from(outer.currentTransform.val);
			const n = Array.from(inner.currentTransform.val);
			cam._applyContainerViewTransform(outer, 1, 2);
			cam._applyContainerViewTransform(inner, 3, 4);
			cam._revertContainerViewTransform(inner, 3, 4);
			cam._revertContainerViewTransform(outer, 1, 2);
			expect(Array.from(outer.currentTransform.val)).toEqual(o);
			expect(Array.from(inner.currentTransform.val)).toEqual(n);
		});

		it("the camera turned between apply and revert still puts back what was there", () => {
			const cam = make();
			cam.yaw = 0.2;
			const c = turned();
			const before = Array.from(c.currentTransform.val);
			cam._applyContainerViewTransform(c, 0, 0);
			cam.yaw = 1.4;
			cam.pitch = -0.8;
			cam._revertContainerViewTransform(c, 0, 0);
			expect(Array.from(c.currentTransform.val)).toEqual(before);
		});

		it("a revert with no apply before it undoes by the opposite turns, as before", () => {
			const cam = make();
			[cam.yaw, cam.pitch] = [0.3, 0.1];
			const c = new Container(0, 0, 10, 10);
			// what a hand-made apply would have left
			c.currentTransform
				.multiply(referenceView(0.3, 0.1, 0))
				.translate(-5, -6, -cam.depth);
			cam._revertContainerViewTransform(c, 5, 6);
			expect(c.currentTransform.isIdentity()).toBe(false);
			const v = c.currentTransform.val;
			for (let i = 0; i < 16; i++) {
				expect(v[i]).toBeCloseTo(i % 5 === 0 ? 1 : 0, 4);
			}
		});

		it("the container's bounds are back where they were, and it redraws", () => {
			const cam = make();
			cam.yaw = 0.6;
			const c = new Container(0, 0, 200, 100);
			c.addChild(new Renderable(10, 10, 20, 20));
			c.updateBounds();
			const b = c.getBounds();
			const before = [b.left, b.top, b.right, b.bottom];
			cam._applyContainerViewTransform(c, 40, 30);
			c.isDirty = false;
			cam._revertContainerViewTransform(c, 40, 30);
			const after = c.getBounds();
			expect([after.left, after.top, after.right, after.bottom]).toEqual(
				before,
			);
			expect(c.isDirty).toBe(true);
		});
	});
});
