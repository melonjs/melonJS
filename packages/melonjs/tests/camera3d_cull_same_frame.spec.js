import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera3d,
	event,
	Renderable,
	video,
} from "../src/index.js";

/**
 * Camera3d culling lagged a frame behind a camera moved outside
 * `camera.update()`.
 *
 * A frame steps `world.update()` (which is where every object's `inViewport`
 * is decided, by `camera.isVisible`) BEFORE `stage.update()` (which runs
 * `camera.update()`, the only place the six frustum planes were rebuilt).
 * So a camera moved or turned from a `GAME_UPDATE` listener, or from an
 * entity's own `update()`, culled the world that frame against the planes of
 * where it USED to look: an object it had just turned to face kept
 * `inViewport = false`, was not drawn, and popped in a frame late, while an
 * object it had turned away from was still drawn. A `Camera2d` has no such
 * lag, because its `worldView` is computed from `pos` on every read.
 *
 * Fixed by remembering the pose (pos, depth, pitch, yaw, roll) and the
 * projection the planes were built from, and rebuilding them lazily, on the
 * first visibility query after either changed; an unchanged camera never
 * rebuilds outside `update()`.
 */
describe("Camera3d culls against the camera of the current frame", () => {
	let app;
	let camera;
	// straight ahead of a camera at the origin looking down +Z
	let ahead;
	// 63° to the right: outside the ~46° half-width of a 60° fov at 16:9
	let right;

	beforeAll(async () => {
		boot();
		app = new Application(1024, 576, {
			parent: "screen",
			scale: "auto",
			// no GPU needed: this exercises culling, not rasterization
			renderer: video.CANVAS,
			cameraClass: Camera3d,
		});
		await app.init();
		camera = app.viewport;
		app.world.autoDepth = false;
		ahead = new Renderable(0, 0, 8, 8);
		ahead.pos.z = 300;
		right = new Renderable(600, 0, 8, 8);
		right.pos.z = 300;
		app.world.addChild(ahead, 300);
		app.world.addChild(right, 300);
	});

	afterAll(() => {
		app?.destroy();
	});

	// one whole application frame: GAME_UPDATE, world.update, stage.update
	const frame = () => {
		app.accumulatorMax = app.stepSize * 10;
		app.accumulator = app.accumulatorUpdateDelta = app.stepSize;
		app.frameCounter = app.frameRate - 1;
		app.update(performance.now());
	};

	const lookAhead = () => {
		camera.setPosition(0, 0, 0);
		camera.pitch = 0;
		camera.yaw = 0;
		camera.roll = 0;
		camera.update(0);
		frame();
	};

	beforeEach(() => {
		lookAhead();
	});

	it("the setup: is a Camera3d that sees `ahead` and not `right`", () => {
		expect(camera).toBeInstanceOf(Camera3d);
		expect(ahead.inViewport).toBe(true);
		expect(right.inViewport).toBe(false);
	});

	describe("the bug: a camera moved before the world steps", () => {
		it("a turn made in a GAME_UPDATE listener culls the same frame", () => {
			const turn = () => {
				camera.yaw = Math.atan2(600, 300);
			};
			event.once(event.GAME_UPDATE, turn);
			frame();
			expect(right.inViewport).toBe(true);
			expect(ahead.inViewport).toBe(false);
		});

		it("a move made in a GAME_UPDATE listener culls the same frame", () => {
			const move = () => {
				camera.setPosition(600, 0, 0);
			};
			event.once(event.GAME_UPDATE, move);
			frame();
			expect(right.inViewport).toBe(true);
			expect(ahead.inViewport).toBe(false);
		});

		it("a turn made by an entity's own update culls the same frame", () => {
			// children update in reverse order, so an entity added LAST is
			// stepped FIRST, before the objects it brings into view
			const director = new Renderable(0, 0, 1, 1);
			director.alwaysUpdate = true;
			director.update = () => {
				camera.yaw = Math.atan2(600, 300);
				return false;
			};
			app.world.addChild(director, 0);
			try {
				frame();
				expect(right.inViewport).toBe(true);
			} finally {
				app.world.removeChildNow(director);
			}
		});

		it("isVisible() straight after a turn answers for the new view", () => {
			camera.yaw = Math.atan2(600, 300);
			expect(camera.isVisible(right)).toBe(true);
			expect(camera.isVisible(ahead)).toBe(false);
		});

		it("isVisible() straight after setClipPlanes answers for the new range", () => {
			// `ahead` is 300 units out: a far plane at 200 excludes it
			camera.setClipPlanes(0.1, 200);
			try {
				expect(camera.isVisible(ahead)).toBe(false);
			} finally {
				camera.setClipPlanes(0.1, 1000);
			}
			expect(camera.isVisible(ahead)).toBe(true);
		});
	});

	describe("normal behaviour the fix must keep", () => {
		it("an unchanged camera does not rebuild its planes per query", () => {
			let rebuilt = 0;
			const original = camera._rebuildFrustumPlanes;
			camera._rebuildFrustumPlanes = function () {
				rebuilt++;
				return original.call(this);
			};
			try {
				for (let i = 0; i < 50; i++) {
					camera.isVisible(ahead);
					camera.isVisible(right);
				}
				expect(rebuilt).toBe(0);
			} finally {
				camera._rebuildFrustumPlanes = original;
			}
		});

		it("a changed camera rebuilds once for many queries, not per query", () => {
			let rebuilt = 0;
			const original = camera._rebuildFrustumPlanes;
			camera._rebuildFrustumPlanes = function () {
				rebuilt++;
				return original.call(this);
			};
			try {
				camera.yaw = 0.2;
				for (let i = 0; i < 50; i++) {
					camera.isVisible(ahead);
				}
				expect(rebuilt).toBeLessThanOrEqual(1);
			} finally {
				camera._rebuildFrustumPlanes = original;
			}
		});

		it("an object left alone stays visible frame after frame", () => {
			for (let i = 0; i < 3; i++) {
				frame();
				expect(ahead.inViewport).toBe(true);
				expect(right.inViewport).toBe(false);
			}
		});

		it("camera.update() still rebuilds the planes", () => {
			camera.yaw = Math.atan2(600, 300);
			camera.update(16);
			expect(camera.isVisible(right)).toBe(true);
		});

		it("follow, which moves the camera inside update(), still culls", () => {
			const target = new Renderable(600, 0, 8, 8);
			target.pos.z = 0;
			camera.follow(target);
			try {
				// followed at its own depth, the camera sits beside `right`
				// looking down +Z: `right` is now straight ahead of it
				camera.update(16);
				camera.update(16);
				expect(camera.isVisible(right)).toBe(true);
			} finally {
				camera.unfollow();
			}
		});

		it("a floating object is still tested in screen space", () => {
			const hud = new Renderable(10, 10, 20, 20);
			hud.floating = true;
			camera.yaw = 2.5;
			expect(camera.isVisible(hud)).toBe(true);
		});
	});
});
