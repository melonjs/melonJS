import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	Matrix3d,
	Renderable,
	video,
} from "../src/index.js";

/**
 * `Renderable.getLocalTransform()` / `getWorldTransform()`.
 *
 * `getAbsolutePosition()` sums positions up the ancestor chain and returns a
 * vector, which cannot express the rotation, scale or flip accumulated along
 * the way. These two are the matrix form of the same question, and the whole
 * point is that they agree with what the renderer ACTUALLY accumulates — so
 * the central test here captures the live matrix off the renderer mid-draw
 * rather than recomputing it, which would just be the implementation checking
 * itself.
 */
describe("renderable transforms", () => {
	let app;

	beforeEach(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "1.0",
			// WebGL exposes the accumulated matrix directly, and sub-pixel
			// snapping off keeps it from being floored between ops
			renderer: video.WEBGL,
			subPixel: true,
		});
		await app.init();
	});

	afterEach(() => {
		app?.destroy();
	});

	/** a leaf that records the transform the renderer held when it drew */
	class Probe extends Renderable {
		constructor(x, y, w, h) {
			super(x, y, w, h);
			this.captured = new Matrix3d();
			this.drew = false;
			this.isKinematic = false;
		}

		draw(renderer) {
			this.captured.copy(renderer.currentTransform);
			this.drew = true;
		}
	}

	/** render one frame and hand back what the renderer gave the probe */
	const accumulatedFor = (probe) => {
		app.world.update(16);
		app.renderer.clear();
		app.world.draw(app.renderer, app.viewport);
		app.renderer.flush();
		expect(probe.drew, "probe never drew").toBe(true);
		return probe.captured;
	};

	const expectMatrixClose = (actual, expected, label = "") => {
		for (let i = 0; i < 16; i++) {
			expect(actual.val[i], `${label}element ${i}`).toBeCloseTo(
				expected.val[i],
				3,
			);
		}
	};

	describe("agreement with the renderer", () => {
		it("matches the accumulated matrix through rotation and scale", () => {
			// the anti-drift guard: if preDraw ever changes what it applies,
			// this fails instead of the composition silently going stale
			const outer = new Container(30, 40, 400, 400);
			outer.anchorPoint.set(0, 0);
			const inner = new Container(15, 25, 200, 200);
			inner.anchorPoint.set(0, 0);
			inner.rotate(0.4);
			inner.scale(1.5, 0.8);

			const probe = new Probe(11, 7, 20, 20);
			probe.anchorPoint.set(0.25, 0.75);

			inner.addChild(probe);
			outer.addChild(inner);
			app.world.addChild(outer);

			expectMatrixClose(
				accumulatedFor(probe),
				probe.getWorldTransform(new Matrix3d()),
			);
		});

		it("matches with a flipped renderable in the chain", () => {
			const group = new Container(20, 30, 300, 300);
			group.anchorPoint.set(0, 0);
			group.rotate(-0.3);

			const probe = new Probe(40, 15, 24, 18);
			probe.anchorPoint.set(0.5, 0.5);
			probe.flipX(true);
			probe.flipY(true);

			group.addChild(probe);
			app.world.addChild(group);

			expectMatrixClose(
				accumulatedFor(probe),
				probe.getWorldTransform(new Matrix3d()),
			);
		});
	});

	describe("the fold", () => {
		it("equals the product of each level's local transform", () => {
			// verified independently of the per-level maths, so a correct L
			// composed in the wrong order still fails
			const a = new Container(12, 8, 400, 400);
			a.anchorPoint.set(0, 0);
			a.rotate(0.25);
			const b = new Container(30, 14, 200, 200);
			b.anchorPoint.set(0, 0);
			b.scale(2, 0.5);
			const leaf = new Renderable(7, 3, 10, 10);
			leaf.anchorPoint.set(0, 0);

			b.addChild(leaf);
			a.addChild(b);
			app.world.addChild(a);

			const manual = new Matrix3d();
			manual.identity();
			for (const node of [app.world, a, b, leaf]) {
				manual.multiply(node.getLocalTransform(new Matrix3d()));
			}

			expectMatrixClose(leaf.getWorldTransform(new Matrix3d()), manual);
		});

		it("stops at a floating ancestor", () => {
			// a floating renderable draws in screen space — Container.draw
			// resets the transform outright — so the chain genuinely ends
			const level = new Container(500, 400, 400, 400);
			level.anchorPoint.set(0, 0);
			const hud = new Container(20, 10, 100, 100);
			hud.anchorPoint.set(0, 0);
			hud.floating = true;
			const label = new Renderable(5, 5, 10, 10);
			label.anchorPoint.set(0, 0);

			hud.addChild(label);
			level.addChild(hud);
			app.world.addChild(level);

			const world = label.getWorldTransform(new Matrix3d());
			// the hud's 20, with the level's 500 NOT accumulated. The label's
			// own 5 is absent because a leaf applies its position inside its
			// own draw() rather than contributing it to the frame.
			expect(world.tx).toBeCloseTo(20);
			expect(world.ty).toBeCloseTo(10);
		});
	});

	describe("relationship to the existing API", () => {
		it("degenerates to getAbsolutePosition for a container", () => {
			const outer = new Container(30, 40, 400, 400);
			outer.anchorPoint.set(0, 0);
			const inner = new Container(15, 25, 200, 200);
			inner.anchorPoint.set(0, 0);

			outer.addChild(inner);
			app.world.addChild(outer);

			const world = inner.getWorldTransform(new Matrix3d());
			const abs = inner.getAbsolutePosition();
			expect(world.tx).toBeCloseTo(abs.x);
			expect(world.ty).toBeCloseTo(abs.y);
		});

		it("gives a LEAF the frame it draws in, not where it sits", () => {
			// the distinction that matters when reaching for this instead of
			// getAbsolutePosition: a leaf's own position is applied by its own
			// draw(), so it is not part of the frame handed to it
			const outer = new Container(30, 40, 400, 400);
			outer.anchorPoint.set(0, 0);
			const leaf = new Renderable(11, 7, 20, 20);
			leaf.anchorPoint.set(0, 0);

			outer.addChild(leaf);
			app.world.addChild(outer);

			const world = leaf.getWorldTransform(new Matrix3d());
			expect(world.tx, "leaf position leaked into the frame").toBeCloseTo(30);
			expect(leaf.getAbsolutePosition().x, "sanity").toBeCloseTo(41);
		});

		it("is NOT currentTransform — that one has no position in it", () => {
			// the confusion this API most invites. `currentTransform` holds
			// only what rotate/scale/translate accumulate; the position lives
			// in `pos` and preDraw composes the two.
			const container = new Container(120, 45, 200, 200);
			container.anchorPoint.set(0, 0);
			app.world.addChild(container);

			expect(container.currentTransform.isIdentity()).toBe(true);

			const local = container.getLocalTransform(new Matrix3d());
			expect(local.tx).toBeCloseTo(120);
			expect(local.ty).toBeCloseTo(45);
		});

		it("gives a container the child offset a leaf does not have", () => {
			// the one asymmetry in the definition: a leaf places itself from
			// `pos` inside its own draw(), a container offsets its children
			const container = new Container(60, 25, 100, 100);
			container.anchorPoint.set(0, 0);
			const leaf = new Renderable(60, 25, 100, 100);
			leaf.anchorPoint.set(0, 0);

			expect(container.getLocalTransform(new Matrix3d()).tx).toBeCloseTo(60);
			expect(leaf.getLocalTransform(new Matrix3d()).tx).toBeCloseTo(0);
		});
	});

	describe("the out-parameter contract", () => {
		it("writes into out and returns it", () => {
			const leaf = new Renderable(10, 20, 5, 5);
			const out = new Matrix3d();
			expect(leaf.getLocalTransform(out)).toBe(out);
			expect(leaf.getWorldTransform(out)).toBe(out);
		});

		it("stores nothing on the renderable", () => {
			// the memory contract: a Matrix3d per renderable would be a real
			// cost across thousands of them, so there must be no cached field
			const leaf = new Renderable(10, 20, 5, 5);
			const before = Object.keys(leaf).length;
			leaf.getWorldTransform(new Matrix3d());
			expect(Object.keys(leaf).length).toBe(before);
		});

		it("does not disturb the receiver's own transform", () => {
			const container = new Container(10, 20, 50, 50);
			container.rotate(0.3);
			const snapshot = container.currentTransform.clone();

			container.getWorldTransform(new Matrix3d());

			expect(container.currentTransform.equals(snapshot)).toBe(true);
		});

		it("returns the same answer when called twice in a row", () => {
			// the shared scratch used during the walk must not leak between
			// calls or accumulate
			const group = new Container(33, 17, 100, 100);
			group.anchorPoint.set(0, 0);
			group.rotate(0.2);
			const leaf = new Renderable(4, 9, 8, 8);
			leaf.anchorPoint.set(0, 0);
			group.addChild(leaf);
			app.world.addChild(group);

			const first = leaf.getWorldTransform(new Matrix3d());
			const second = leaf.getWorldTransform(new Matrix3d());
			expectMatrixClose(second, first);
		});
	});
});
