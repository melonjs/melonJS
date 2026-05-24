import { beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Camera2d,
	Camera3d,
	Frustum,
	Matrix3d,
	Renderable,
	Vector3d,
	video,
} from "../src/index.js";

/**
 * Unit tests for the Camera3d class.
 * Most tests run without WebGL — the camera's math (frustum,
 * pitch/yaw, follow logic) is pure JS.
 */
describe("Camera3d", () => {
	beforeAll(() => {
		// some Camera2d subclass paths need a renderer to construct
		// (e.g. Renderable observableVector callbacks). Boot a Canvas
		// renderer for those.
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	describe("constructor + defaults", () => {
		it("extends Camera2d (drop-in compatible)", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			expect(cam).toBeInstanceOf(Camera2d);
			expect(cam).toBeInstanceOf(Camera3d);
		});

		it("creates a Frustum with sensible defaults", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			expect(cam.frustum).toBeInstanceOf(Frustum);
			expect(cam.fov).toBeCloseTo(Math.PI / 3, 5); // 60°
			// aspect derived from viewport rect (800/600 = 4/3)
			expect(cam.aspect).toBeCloseTo(800 / 600, 5);
			expect(cam.near).toBe(0.1);
			expect(cam.far).toBe(1000);
		});

		it("honors constructor opts", () => {
			const cam = new Camera3d(0, 0, 800, 600, {
				fov: Math.PI / 4,
				near: 0.5,
				far: 2000,
				aspect: 16 / 9,
			});
			expect(cam.fov).toBeCloseTo(Math.PI / 4, 5);
			expect(cam.near).toBe(0.5);
			expect(cam.far).toBe(2000);
			expect(cam.aspect).toBeCloseTo(16 / 9, 5);
		});

		it("initializes orientation to zero (looking straight ahead)", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			expect(cam.pitch).toBe(0);
			expect(cam.yaw).toBe(0);
		});

		it("initializes followOffset/lookAhead Vector3d's", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			expect(cam.followOffset).toBeInstanceOf(Vector3d);
			expect(cam.followOffset.x).toBe(0);
			expect(cam.followOffset.y).toBe(0);
			expect(cam.followOffset.z).toBe(0);
			expect(cam.lookAhead).toBeInstanceOf(Vector3d);
		});

		it("uses perspective projection (not ortho)", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			// perspective matrix has element [11] != 0 (the -1 from the
			// perspective divide row). Ortho would have [11] = 0.
			// After our Y-flip + Z-flip scale, element [11] is still
			// non-zero (it's part of the unscaled perspective divide row).
			expect(cam.projectionMatrix.val[11]).not.toBe(0);
		});
	});

	describe("fov / aspect setters", () => {
		it("setting fov updates the projection matrix", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			const before = cam.projectionMatrix.val[0];
			cam.fov = Math.PI / 2; // change to 90°
			const after = cam.projectionMatrix.val[0];
			expect(after).not.toBeCloseTo(before, 5);
			expect(cam.fov).toBeCloseTo(Math.PI / 2, 5);
		});

		it("setting aspect updates the projection matrix", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			cam.aspect = 2.0;
			expect(cam.aspect).toBeCloseTo(2.0, 5);
			expect(cam.frustum.aspect).toBeCloseTo(2.0, 5);
		});
	});

	describe("resize", () => {
		it("recomputes aspect from new viewport rect", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			expect(cam.aspect).toBeCloseTo(800 / 600, 5);
			cam.resize(1920, 1080);
			expect(cam.aspect).toBeCloseTo(1920 / 1080, 5);
		});

		it("rebuilds projection matrix on resize", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			const before = cam.projectionMatrix.val[0];
			cam.resize(1920, 1080); // different aspect
			const after = cam.projectionMatrix.val[0];
			expect(after).not.toBeCloseTo(before, 5);
		});
	});

	describe("lookAt", () => {
		it("derives yaw from XZ direction (target to the right → positive yaw)", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			cam.pos.set(0, 0, 0);
			// target directly to the right (+x), at the same z+depth
			cam.lookAt(10, 0, 1);
			// atan2(10, 1) ≈ PI/2 - epsilon. Direction to the right.
			expect(cam.yaw).toBeGreaterThan(0);
		});

		it("derives pitch from vertical direction", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			cam.pos.set(0, 0, 0);
			// target below the camera (positive y in Y-down)
			cam.lookAt(0, 10, 1);
			// Y-down: pitch should be negative (camera points downward)
			expect(cam.pitch).toBeLessThan(0);
		});

		it("yaw=0, pitch=0 when target is straight ahead (+z)", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			cam.pos.set(0, 0, 0);
			cam.lookAt(0, 0, 100);
			expect(cam.yaw).toBeCloseTo(0, 5);
			expect(cam.pitch).toBeCloseTo(0, 5);
		});

		it("setLookAt accepts Vector3d", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			cam.pos.set(0, 0, 0);
			cam.setLookAt(new Vector3d(0, 0, 100));
			expect(cam.yaw).toBeCloseTo(0, 5);
			expect(cam.pitch).toBeCloseTo(0, 5);
		});

		it("returns this for chaining", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			expect(cam.lookAt(1, 2, 3)).toBe(cam);
			expect(cam.setLookAt(new Vector3d(1, 2, 3))).toBe(cam);
		});
	});

	describe("followOffset / target follow", () => {
		it("setFollowOffset sets the offset vector", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			cam.setFollowOffset(1, 2, 3);
			expect(cam.followOffset.x).toBe(1);
			expect(cam.followOffset.y).toBe(2);
			expect(cam.followOffset.z).toBe(3);
		});

		it("setFollowOffset returns this for chaining", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			expect(cam.setFollowOffset(0, 0, 0)).toBe(cam);
		});

		it("updateTarget resolves to target.pos + followOffset", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			const target = new Vector3d(100, 50, 200);
			cam.target = target;
			cam.setFollowOffset(0, -5, -10);

			cam.updateTarget();

			expect(cam.pos.x).toBe(100); // target.x + 0
			expect(cam.pos.y).toBe(45); // target.y + -5
			expect(cam.pos.z).toBe(190); // target.z + -10
		});

		it("updateTarget with Renderable target uses target.pos", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			const target = new Renderable(10, 20, 32, 32);
			cam.target = target.pos;
			cam.setFollowOffset(0, 0, -8);

			cam.updateTarget();

			expect(cam.pos.x).toBe(10);
			expect(cam.pos.y).toBe(20);
			expect(cam.pos.z).toBe(-8); // pos.z defaults to 0, + offset.z
		});

		it("updateTarget tracks z from a Renderable with non-zero depth (Copilot review #1463)", () => {
			// Regression: `Camera2d.follow(renderable)` assigns
			// `cam.target = renderable.pos`, which is an
			// ObservableVector3d (not a plain Vector3d). The first cut
			// of updateTarget did `target instanceof Vector3d` to read
			// z, which silently treated z as 0 for every Renderable
			// target. Duck-typed `typeof target.z === "number"` fixes it.
			const cam = new Camera3d(0, 0, 800, 600);
			const target = new Renderable(10, 20, 32, 32);
			target.pos.z = 500; // non-zero depth — this MUST flow to the camera
			cam.target = target.pos;
			cam.setFollowOffset(0, 0, -8);

			cam.updateTarget();

			expect(cam.pos.x).toBe(10);
			expect(cam.pos.y).toBe(20);
			expect(cam.pos.z).toBe(492); // target.pos.z (500) + offset.z (-8)
		});

		it("no-op when target is null (falls through to Camera2d behavior)", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			cam.pos.set(50, 60, 70);
			cam.target = null;

			cam.updateTarget();

			// position unchanged
			expect(cam.pos.x).toBe(50);
			expect(cam.pos.y).toBe(60);
			expect(cam.pos.z).toBe(70);
		});
	});

	describe("isVisible (frustum-aware culling)", () => {
		it("returns true for non-floating sprites far outside Camera2d's worldView (regression)", () => {
			// Camera2d's `isVisible` tests a 2D rect overlap against
			// `worldView`. When Camera3d rotates / orbits, world
			// coordinates that should be visible through the frustum
			// can fall outside that 2D rect (which is locked to the
			// camera's pos.x/y + width/height). Camera3d must NOT
			// inherit that test verbatim — it would silently cull
			// sprites mid-orbit.
			const cam = new Camera3d(0, 0, 800, 600);
			cam.pos.set(0, 0, -500); // camera behind the world
			cam.yaw = Math.PI / 4; // looking 45° to the right

			const sprite = new Renderable(2000, 2000, 32, 32);
			sprite.pos.z = 500;
			// world (2000, 2000) is far outside the camera's 2D worldView
			// (which is at camera.pos.x/y = 0,0 + width/height = 800,600).
			// Camera3d must still return true — the GPU clips off-frustum
			// fragments; visibility culling on the CPU is conservative.
			expect(cam.isVisible(sprite)).toBe(true);
		});

		it("delegates to Camera2d's 2D rect test for floating elements", () => {
			// floating = screen-space, no perspective involved
			const cam = new Camera3d(0, 0, 800, 600);
			const inViewport = new Renderable(100, 100, 32, 32);
			inViewport.floating = true;
			expect(cam.isVisible(inViewport)).toBe(true);

			const outsideViewport = new Renderable(5000, 5000, 32, 32);
			outsideViewport.floating = true;
			expect(cam.isVisible(outsideViewport)).toBe(false);
		});
	});

	describe("backward compat with Camera2d API", () => {
		it("near/far inherited and overridden by perspective defaults", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			// Camera2d defaults to ±1e6; Camera3d narrows to 0.1/1000
			// for meaningful perspective z resolution
			expect(cam.near).toBe(0.1);
			expect(cam.far).toBe(1000);
		});

		it("inherits shake / fade / camera-effect plumbing", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			expect(typeof cam.shake).toBe("function");
			expect(typeof cam.fadeIn).toBe("function");
			expect(typeof cam.fadeOut).toBe("function");
			expect(Array.isArray(cam.cameraEffects)).toBe(true);
		});

		it("inherits follow() from Camera2d", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			expect(typeof cam.follow).toBe("function");
		});

		it("name defaults to 'default'", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			expect(cam.name).toBe("default");
		});

		it("projectionMatrix is a Matrix3d", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			expect(cam.projectionMatrix).toBeInstanceOf(Matrix3d);
		});
	});
});
