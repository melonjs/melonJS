/**
 * `Camera2d` moves the container it draws by the opposite of its position,
 * and takes the move off again after the draw. Moving it back by the
 * opposite offset left a rounding error in the container's transform every
 * frame, in 32-bit floats, growing with the camera's distance from the
 * origin: the container drifted. The camera now puts back what was there.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Camera3d,
	Container,
	Matrix3d,
	Renderable,
	video,
} from "../src/index.js";

describe("Camera2d takes its view off a container exactly", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	const make = () => {
		return new Camera2d(0, 0, 320, 240);
	};

	/** a container with a transform of its own */
	const turned = () => {
		const c = new Container(0, 0, 100, 100);
		c.currentTransform.translate(3.3, -7.1, 2.2).rotate(0.37).scale(1.3);
		return c;
	};

	it("far from the origin, frame after frame, the container does not drift", () => {
		const cam = make();
		const c = new Container(0, 0, 100, 100);
		for (let i = 0; i < 1000; i++) {
			const x = 1234.567 + i * 0.37;
			const y = -987.123 - i * 0.11;
			cam._applyContainerViewTransform(c, x, y);
			cam._revertContainerViewTransform(c, x, y);
		}
		// moved back by the opposite offset, it was off by about 0.015 px
		expect(c.currentTransform.isIdentity()).toBe(true);
	});

	it("a container with a transform of its own gets it back, bit for bit", () => {
		const cam = make();
		const c = turned();
		const before = Array.from(c.currentTransform.val);
		for (let i = 0; i < 1000; i++) {
			const x = 50000.3 + i * 1.7;
			cam._applyContainerViewTransform(c, x, -x / 3);
			cam._revertContainerViewTransform(c, x, -x / 3);
		}
		expect(Array.from(c.currentTransform.val)).toEqual(before);
	});

	it("moves the container as before while the view is on", () => {
		const cam = make();
		const c = turned();
		const expected = new Matrix3d()
			.copy(c.currentTransform)
			.translate(-123.25, 45.5);
		cam._applyContainerViewTransform(c, 123.25, -45.5);
		expect(Array.from(c.currentTransform.val)).toEqual(
			Array.from(expected.val),
		);
		cam._revertContainerViewTransform(c, 123.25, -45.5);
	});

	it("nested containers are put back in the order they were moved", () => {
		const cam = make();
		const outer = turned();
		const inner = new Container(0, 0, 10, 10);
		inner.currentTransform.translate(1.1, 2.2, 3.3);
		const o = Array.from(outer.currentTransform.val);
		const n = Array.from(inner.currentTransform.val);
		cam._applyContainerViewTransform(outer, 1000.1, 2000.2);
		cam._applyContainerViewTransform(inner, 3000.3, 4000.4);
		cam._revertContainerViewTransform(inner, 3000.3, 4000.4);
		cam._revertContainerViewTransform(outer, 1000.1, 2000.2);
		expect(Array.from(outer.currentTransform.val)).toEqual(o);
		expect(Array.from(inner.currentTransform.val)).toEqual(n);
	});

	it("two cameras on one container each take off their own move", () => {
		const a = make();
		const b = make();
		const c = turned();
		const before = Array.from(c.currentTransform.val);
		a._applyContainerViewTransform(c, 10.5, 20.5);
		a._revertContainerViewTransform(c, 10.5, 20.5);
		b._applyContainerViewTransform(c, -300.75, 7.125);
		a._applyContainerViewTransform(c, 99.9, 88.8);
		a._revertContainerViewTransform(c, 99.9, 88.8);
		b._revertContainerViewTransform(c, -300.75, 7.125);
		expect(Array.from(c.currentTransform.val)).toEqual(before);
	});

	it("the camera moved between apply and revert still puts back what was there", () => {
		const cam = make();
		const c = turned();
		const before = Array.from(c.currentTransform.val);
		cam._applyContainerViewTransform(c, 10, 20);
		cam.move(500, -300);
		cam._revertContainerViewTransform(c, 510, -280);
		expect(Array.from(c.currentTransform.val)).toEqual(before);
	});

	it("a revert with no apply before it moves the container back, as before", () => {
		const cam = make();
		const c = new Container(0, 0, 10, 10);
		// what a hand-made apply would have left
		c.currentTransform.translate(-5, -6);
		cam._revertContainerViewTransform(c, 5, 6);
		expect(c.currentTransform.isIdentity()).toBe(true);
		// and a revert too many after a pair does the same, not a stale put-back
		cam._applyContainerViewTransform(c, 7, 8);
		cam._revertContainerViewTransform(c, 7, 8);
		cam._revertContainerViewTransform(c, 1, 2);
		expect(c.currentTransform.val[12]).toBe(1);
		expect(c.currentTransform.val[13]).toBe(2);
	});

	it("the container's bounds are back where they were, and it redraws", () => {
		const cam = make();
		const c = new Container(0, 0, 200, 100);
		c.addChild(new Renderable(10, 10, 20, 20));
		c.updateBounds();
		const b = c.getBounds();
		const before = [b.left, b.top, b.right, b.bottom];
		cam._applyContainerViewTransform(c, 40.3, 30.7);
		const moved = c.getBounds();
		expect(moved.left).not.toBe(before[0]);
		c.isDirty = false;
		cam._revertContainerViewTransform(c, 40.3, 30.7);
		const after = c.getBounds();
		expect([after.left, after.top, after.right, after.bottom]).toEqual(before);
		expect(c.isDirty).toBe(true);
	});

	it("a Camera3d keeps the whole transform, since its view also turns", () => {
		const cam = new Camera3d(0, 0, 320, 240);
		cam.yaw = 0.4;
		cam.pitch = -0.2;
		const c = turned();
		const before = Array.from(c.currentTransform.val);
		cam._applyContainerViewTransform(c, 12.5, -8.25);
		cam._revertContainerViewTransform(c, 12.5, -8.25);
		expect(Array.from(c.currentTransform.val)).toEqual(before);
	});
});
