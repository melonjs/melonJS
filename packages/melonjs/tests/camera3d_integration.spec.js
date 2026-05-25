import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Camera3d,
	Stage,
	state,
	video,
} from "../src/index.js";

/**
 * Integration tests for Camera3d × Stage × Application wiring.
 *
 * Validates the 4-step camera resolution order in `Stage.reset()`:
 *   1. explicit `cameras` array on the stage (most-specific)
 *   2. `cameraClass` on the stage settings
 *   3. `cameraClass` on the application settings
 *   4. module-level Camera2d singleton (fallback / pre-19.7 path)
 *
 * Also verifies that `DefaultLoadingScreen` always uses Camera2d,
 * even when the app sets `cameraClass: Camera3d` globally.
 */
describe("Camera3d × Stage × Application integration", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	afterAll(() => {
		// hand the world back to a clean default for any later test files
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	describe("4-step camera resolution order", () => {
		it("step 1: explicit `cameras` wins over everything", () => {
			const explicitCam = new Camera3d(0, 0, 800, 600);
			explicitCam.name = "default";
			const stage = new Stage({ cameras: [explicitCam] });

			// fake app with cameraClass = Camera2d (would lose if step 1 didn't win)
			const fakeApp = {
				renderer: { width: 800, height: 600 },
				settings: { cameraClass: Camera2d },
			};
			stage.reset(fakeApp);

			expect(stage.cameras.get("default")).toBe(explicitCam);
		});

		it("step 2: stage.cameraClass wins over app.cameraClass", () => {
			const stage = new Stage({ cameraClass: Camera3d });
			const fakeApp = {
				renderer: { width: 800, height: 600 },
				settings: { cameraClass: Camera2d },
			};
			stage.reset(fakeApp);

			const cam = stage.cameras.get("default");
			expect(cam).toBeInstanceOf(Camera3d);
		});

		it("step 3: app.cameraClass used when stage has neither cameras nor cameraClass", () => {
			const stage = new Stage();
			const fakeApp = {
				renderer: { width: 800, height: 600 },
				settings: { cameraClass: Camera3d },
			};
			stage.reset(fakeApp);

			const cam = stage.cameras.get("default");
			expect(cam).toBeInstanceOf(Camera3d);
		});

		it("step 4: falls back to Camera2d singleton when no cameraClass set anywhere", () => {
			const stage = new Stage();
			const fakeApp = {
				renderer: { width: 800, height: 600 },
				settings: {}, // no cameraClass
			};
			stage.reset(fakeApp);

			const cam = stage.cameras.get("default");
			expect(cam).toBeInstanceOf(Camera2d);
		});

		it("singleton path: two stages share the same Camera2d instance (pre-19.7 behavior)", () => {
			// when neither stage opts in, the module-level singleton should
			// be shared. This is the existing behavior and PR B preserves it.
			const stageA = new Stage();
			const stageB = new Stage();
			const fakeApp = {
				renderer: { width: 800, height: 600 },
				settings: {},
			};

			stageA.reset(fakeApp);
			stageB.reset(fakeApp);

			const camA = stageA.cameras.get("default");
			const camB = stageB.cameras.get("default");

			expect(camA).toBeInstanceOf(Camera2d);
			expect(camA).toBe(camB); // same singleton reference
		});

		it("cameraClass path: two stages get distinct Camera3d instances (no state bleed)", () => {
			// Camera3d holds per-stage state (pitch/yaw/fov); singleton
			// sharing would cross-contaminate scenes. Each stage gets its
			// own instance.
			const stageA = new Stage({ cameraClass: Camera3d });
			const stageB = new Stage({ cameraClass: Camera3d });
			const fakeApp = {
				renderer: { width: 800, height: 600 },
				settings: {},
			};

			stageA.reset(fakeApp);
			stageB.reset(fakeApp);

			const camA = stageA.cameras.get("default");
			const camB = stageB.cameras.get("default");

			expect(camA).toBeInstanceOf(Camera3d);
			expect(camB).toBeInstanceOf(Camera3d);
			expect(camA).not.toBe(camB); // distinct instances
		});
	});

	describe("DefaultLoadingScreen protection", () => {
		it("uses Camera2d even when app.cameraClass = Camera3d", () => {
			// the built-in loader is registered at module load. Its
			// constructor pins cameraClass to Camera2d, so a global
			// Camera3d opt-in must not affect it.
			const loader = state.get(state.LOADING);
			expect(loader).toBeDefined();
			expect(loader).toBeInstanceOf(Stage);

			// reset as if launching with a Camera3d-defaulted app
			const fakeApp3d = {
				renderer: { width: 800, height: 600 },
				settings: { cameraClass: Camera3d },
				world: { backgroundColor: { parseCSS: () => {} } }, // stub world for onResetEvent
			};

			// only run the camera-resolution path, not the full onResetEvent
			// (which adds children, needs a real world). Call Stage.reset's
			// camera-resolution body directly via a fresh Stage with the
			// same cameraClass that DefaultLoadingScreen uses.
			const cam2dStage = new Stage({ cameraClass: Camera2d });
			cam2dStage.reset(fakeApp3d);

			expect(cam2dStage.cameras.get("default")).toBeInstanceOf(Camera2d);
			expect(cam2dStage.cameras.get("default")).not.toBeInstanceOf(Camera3d);

			// also verify the actual loader instance's settings
			expect(loader.settings.cameraClass).toBe(Camera2d);
		});
	});

	describe("Application.settings.cameraClass propagation", () => {
		it("Application accepts cameraClass in settings", () => {
			// don't construct a full Application (would conflict with the
			// boot() call above). Just verify the settings type accepts
			// the field — Application's settings is a public object.
			// Spot-check by reading the application module's exported type
			// behavior via a fresh Stage that consumes a fake app.
			const stage = new Stage();
			const fakeApp = {
				renderer: { width: 800, height: 600 },
				settings: { cameraClass: Camera3d },
			};

			stage.reset(fakeApp);

			const cam = stage.cameras.get("default");
			expect(cam).toBeInstanceOf(Camera3d);
			expect(cam.width).toBe(800);
			expect(cam.height).toBe(600);
		});

		it("Application without cameraClass setting → singleton Camera2d", () => {
			const stage = new Stage();
			const fakeApp = {
				renderer: { width: 800, height: 600 },
				settings: {}, // pre-19.7-style settings
			};
			stage.reset(fakeApp);

			expect(stage.cameras.get("default")).toBeInstanceOf(Camera2d);
		});
	});

	describe("smoke: full Application with cameraClass", () => {
		it("can construct an Application with cameraClass: Camera3d without error", () => {
			// use Canvas renderer so we don't spam WebGL contexts
			expect(() => {
				const app = new Application(400, 300, {
					parent: "screen",
					renderer: video.CANVAS,
					cameraClass: Camera3d,
				});
				// the app should accept the setting and store it
				expect(app.settings.cameraClass).toBe(Camera3d);
			}).not.toThrow();
		});
	});

	describe("world.sortOn auto-bootstrap from cameraClass.defaultSortOn", () => {
		it("Application(cameraClass: Camera3d) sets world.sortOn = 'depth'", () => {
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});
			expect(app.world.sortOn).toBe("depth");
		});

		it("Application(cameraClass: Camera2d) sets world.sortOn = 'z' (today's default)", () => {
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera2d,
			});
			expect(app.world.sortOn).toBe("z");
		});

		it("Application with no cameraClass leaves world.sortOn at its 'z' default", () => {
			// no-op bootstrap path — exists to lock in that we never
			// regress to silently switching modes on pre-19.7 games
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
			});
			expect(app.world.sortOn).toBe("z");
		});

		it("custom Camera subclass with defaultSortOn = 'y' bootstraps the world to 'y'", () => {
			class YSortCam extends Camera2d {
				static defaultSortOn = "y";
			}
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: YSortCam,
			});
			expect(app.world.sortOn).toBe("y");
		});

		it("user can override world.sortOn after construction — bootstrap is not sticky", () => {
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});
			expect(app.world.sortOn).toBe("depth");
			app.world.sortOn = "x";
			expect(app.world.sortOn).toBe("x");
			// nothing should silently switch it back
			expect(app.world._sortOn).toBe("x");
		});

		it("Stage.cameraClass override flips world.sortOn when the stage's camera differs from the app's", () => {
			// app uses Camera3d (world bootstrapped to 'depth'); when a
			// stage with `cameraClass: Camera2d` resets onto that app,
			// the loader pattern, world.sortOn flips back to 'z' so the
			// 2D stage paints correctly.
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});
			expect(app.world.sortOn).toBe("depth");

			const stage = new Stage({ cameraClass: Camera2d });
			stage.reset(app);
			expect(app.world.sortOn).toBe("z");
		});
	});
});
