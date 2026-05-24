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

	describe("isVisible (plane-based frustum culling)", () => {
		// Camera2d's `isVisible` tests a 2D rect overlap against
		// `worldView` — invalid under perspective, because the visible
		// region is a frustum that widens with distance and rotates
		// with the camera. Camera3d overrides to do proper plane-based
		// frustum culling: each renderable's bounding sphere is tested
		// against the six frustum planes built in `update()`.
		const setupCam = () => {
			const cam = new Camera3d(0, 0, 800, 600);
			// camera behind the origin, looking straight ahead
			cam.pos.set(0, 0, -200);
			cam.yaw = 0;
			cam.pitch = 0;
			cam.update(); // rebuild planes for the current pose
			return cam;
		};

		it("sprite in front of the camera is visible", () => {
			const cam = setupCam();
			const sprite = new Renderable(0, 0, 32, 32);
			sprite.pos.z = 200; // in front of camera at z=-200
			expect(cam.isVisible(sprite)).toBe(true);
		});

		it("sprite behind the camera is culled", () => {
			const cam = setupCam();
			const sprite = new Renderable(0, 0, 32, 32);
			sprite.pos.z = -500; // behind camera at z=-200 (past near plane)
			expect(cam.isVisible(sprite)).toBe(false);
		});

		it("sprite far past the far plane is culled", () => {
			const cam = setupCam();
			const sprite = new Renderable(0, 0, 32, 32);
			sprite.pos.z = 5000; // past far=1000
			expect(cam.isVisible(sprite)).toBe(false);
		});

		it("sprite far to the right (outside horizontal FOV) is culled", () => {
			const cam = setupCam();
			const sprite = new Renderable(5000, 0, 32, 32);
			sprite.pos.z = 100;
			expect(cam.isVisible(sprite)).toBe(false);
		});

		it("rotating the camera brings a previously off-screen sprite into view", () => {
			const cam = setupCam();
			// sprite at world z = -400: behind camera (which is at z = -200
			// looking +Z, so anything at z < -200 is behind it)
			const sprite = new Renderable(0, 0, 64, 64);
			sprite.pos.z = -400;
			expect(cam.isVisible(sprite)).toBe(false);

			// turn 180° around Y — camera now faces -Z, sprite at z=-400
			// is in front
			cam.yaw = Math.PI;
			cam.update();
			expect(cam.isVisible(sprite)).toBe(true);
		});

		it("delegates to Camera2d's 2D rect test for floating elements", () => {
			const cam = setupCam();
			const inViewport = new Renderable(100, 100, 32, 32);
			inViewport.floating = true;
			expect(cam.isVisible(inViewport)).toBe(true);

			const outsideViewport = new Renderable(5000, 5000, 32, 32);
			outsideViewport.floating = true;
			expect(cam.isVisible(outsideViewport)).toBe(false);
		});

		// ---- vertical FOV / pitch ----

		it("sprite far above the camera (outside vertical FOV) is culled", () => {
			const cam = setupCam();
			// Y-down: large negative y is "above" (off the top of the screen)
			const sprite = new Renderable(0, -5000, 32, 32);
			sprite.pos.z = 100;
			expect(cam.isVisible(sprite)).toBe(false);
		});

		it("sprite far below the camera (outside vertical FOV) is culled", () => {
			const cam = setupCam();
			const sprite = new Renderable(0, 5000, 32, 32);
			sprite.pos.z = 100;
			expect(cam.isVisible(sprite)).toBe(false);
		});

		it("pitching up reveals a sprite that's above the original frustum", () => {
			const cam = setupCam();
			// sprite well above the camera in Y-down coords
			const sprite = new Renderable(0, -800, 32, 32);
			sprite.pos.z = 200;
			expect(cam.isVisible(sprite)).toBe(false);

			// pitch up — frustum tilts to include things above
			cam.pitch = Math.PI / 3; // 60° upward
			cam.update();
			expect(cam.isVisible(sprite)).toBe(true);
		});

		it("pitching down reveals a sprite that's below the original frustum", () => {
			const cam = setupCam();
			const sprite = new Renderable(0, 800, 32, 32);
			sprite.pos.z = 200;
			expect(cam.isVisible(sprite)).toBe(false);

			cam.pitch = -Math.PI / 3; // 60° downward
			cam.update();
			expect(cam.isVisible(sprite)).toBe(true);
		});

		// ---- sphere edge cases ----

		it("sprite straddling the near plane (center behind, radius pokes through) is visible", () => {
			const cam = new Camera3d(0, 0, 800, 600, { near: 1, far: 1000 });
			cam.pos.set(0, 0, 0);
			cam.update();
			// sprite center at z=-0.5 (behind near plane at z=1) but radius
			// large enough that the sphere overlaps the near plane
			const sprite = new Renderable(0, 0, 200, 200);
			sprite.pos.z = -0.5;
			expect(cam.isVisible(sprite)).toBe(true);
		});

		it("sprite at exactly the far plane is visible (edge of frustum)", () => {
			const cam = new Camera3d(0, 0, 800, 600, { near: 0.1, far: 1000 });
			cam.pos.set(0, 0, 0);
			cam.update();
			const sprite = new Renderable(0, 0, 32, 32);
			sprite.pos.z = 1000; // exactly at far
			expect(cam.isVisible(sprite)).toBe(true);
		});

		it("very small sprite (1px) deep in the frustum is still classified correctly", () => {
			const cam = setupCam();
			const sprite = new Renderable(0, 0, 1, 1);
			sprite.pos.z = 500; // well inside frustum
			expect(cam.isVisible(sprite)).toBe(true);
		});

		// ---- off-axis camera positions ----

		it("works with camera offset in X (not just at origin)", () => {
			const cam = new Camera3d(0, 0, 800, 600);
			cam.pos.set(1000, 0, 0); // camera shifted right
			cam.update();
			// sprite at world (1000, 0, 200) is straight ahead of THIS camera
			const sprite = new Renderable(1000, 0, 32, 32);
			sprite.pos.z = 200;
			expect(cam.isVisible(sprite)).toBe(true);
			// sprite at world (0, 0, 200) is 1000 units to the left of camera —
			// outside the horizontal FOV
			const sprite2 = new Renderable(0, 0, 32, 32);
			sprite2.pos.z = 200;
			expect(cam.isVisible(sprite2)).toBe(false);
		});

		// ---- narrow FOV ----

		it("narrow FOV culls sprites that wide FOV would include", () => {
			const wideCam = new Camera3d(0, 0, 800, 600, { fov: Math.PI / 2 });
			wideCam.pos.set(0, 0, -200);
			wideCam.update();
			const narrowCam = new Camera3d(0, 0, 800, 600, {
				fov: Math.PI / 12, // 15° — very narrow telephoto
			});
			narrowCam.pos.set(0, 0, -200);
			narrowCam.update();

			// sprite off to the side: wide FOV should see it, narrow shouldn't
			const sprite = new Renderable(150, 0, 32, 32);
			sprite.pos.z = 100;
			expect(wideCam.isVisible(sprite)).toBe(true);
			expect(narrowCam.isVisible(sprite)).toBe(false);
		});

		// ---- regression: PR #1464 user report ----

		it("user-reported regression: sprites stay visible after a single left-arrow click", () => {
			// Reproduces the exact scenario from the user report on
			// PR #1464: Camera3d example with 3 monsters at z=200/400/600,
			// camera at (0, 0, -300) orbiting target z=400 at distance=700,
			// one left-arrow click (yaw -= 0.15). Pre-frustum-culling fix,
			// inheriting Camera2d's worldView 2D-rect test silently culled
			// the monsters because the rect was at the camera's pos.x/y,
			// not in the actual perspective view.
			const cam = new Camera3d(0, 0, 1024, 768, {
				fov: Math.PI / 3,
				near: 0.1,
				far: 1000,
			});

			const sprites = [200, 400, 600].map((z) => {
				const s = new Renderable(0, 0, 112, 112); // monster size after 0.5 scale
				s.pos.z = z;
				return s;
			});

			// initial camera pose: yaw=0 pitch=0 distance=700 orbiting z=400
			const orbit = (yaw, pitch, distance, target) => {
				cam.pos.set(
					Math.sin(yaw) * Math.cos(pitch) * -distance,
					Math.sin(pitch) * distance,
					target - Math.cos(yaw) * Math.cos(pitch) * distance,
				);
				cam.lookAt(0, 0, target);
				cam.update();
			};

			orbit(0, 0, 700, 400);
			// at initial pose, all 3 monsters in front of camera → visible
			for (const s of sprites) {
				expect(cam.isVisible(s)).toBe(true);
			}

			// simulate one left-arrow click — yaw decreases by 0.15
			orbit(-0.15, 0, 700, 400);
			// regression: every monster must STILL be visible after the
			// camera orbits slightly. Pre-fix, all 3 silently disappeared.
			for (const s of sprites) {
				expect(cam.isVisible(s)).toBe(true);
			}

			// stress: 8 clicks to the left (yaw = -1.2 ≈ 69°) — camera
			// orbits to the side; front monster might rotate out of view
			// but the middle (target) one should remain inside
			orbit(-1.2, 0, 700, 400);
			expect(cam.isVisible(sprites[1])).toBe(true); // middle, orbited around
		});

		// ---- multi-update consistency ----

		it("planes update correctly on every update() call (no stale state)", () => {
			const cam = setupCam();
			const sprite = new Renderable(0, 0, 32, 32);
			sprite.pos.z = 200;
			expect(cam.isVisible(sprite)).toBe(true);

			// move camera way off, no update yet — isVisible still sees
			// the old planes
			cam.pos.set(10000, 10000, 10000);
			// (no update call — verifies planes don't auto-rebuild)
			expect(cam.isVisible(sprite)).toBe(true);

			// after update, planes refresh and reflect the new pose
			cam.update();
			expect(cam.isVisible(sprite)).toBe(false);

			// move back, update again — planes refresh
			cam.pos.set(0, 0, -200);
			cam.update();
			expect(cam.isVisible(sprite)).toBe(true);
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
