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

		// Regression for PR #1464 review round 2: the `defaultSortOn`
		// re-apply was nested INSIDE the `if (!this.cameras.has("default"))`
		// branch, which is skipped entirely when the user opts into the
		// documented explicit-cameras pattern (`new Stage({ cameras:
		// [new Camera3d(...)] })`). World.sortOn therefore stayed at the
		// app's default — "z" if the app didn't also opt into Camera3d —
		// and a hand-rolled Camera3d stage on a Camera2d app would
		// silently render with the wrong painter sort.
		it("Stage with explicit Camera3d in `cameras: [...]` array sets world.sortOn = 'depth'", () => {
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				// app uses Camera2d default — world starts at 'z'
			});
			expect(app.world.sortOn).toBe("z");

			const stage = new Stage({
				cameras: [new Camera3d(0, 0, 400, 300)],
			});
			stage.reset(app);
			expect(app.world.sortOn).toBe("depth");
		});
	});

	// --- Adversarial / regression coverage --------------------------------
	//
	// The fix in `stage.ts` removed a `StageCameraClass &&` gate that was
	// silently skipping `defaultSortOn` re-application whenever a stage
	// didn't override the camera class. The bug surfaced in real apps via
	// the engine's built-in `DefaultLoadingScreen`: that stage explicitly
	// pins Camera2d, so it would set `world.sortOn = "z"` on a Camera3d
	// app, and then the next user stage (which inherits the app's Camera3d
	// without overriding) would NEVER snap back to "depth" — distant
	// meshes painted on top of nearer ones under perspective.
	//
	// These tests pin down every path through `Stage.reset()`'s sortOn
	// handling. They use raw `Stage` instances rather than driving
	// `state.change(...)` so they don't depend on the loader implementation
	// (the loader is a *user* of this contract, not a precondition).
	describe("world.sortOn re-applies on every stage reset (regression for #1464 loader→stage hand-off)", () => {
		it("loader-pinned 'z' snaps back to 'depth' when the next stage uses the app's Camera3d", () => {
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});
			expect(app.world.sortOn).toBe("depth");

			// Simulate DefaultLoadingScreen: a stage with explicit Camera2d
			// that pins sortOn to "z" while preload runs.
			const loader = new Stage({ cameraClass: Camera2d });
			loader.reset(app);
			expect(app.world.sortOn).toBe("z");

			// Now the real game stage — no explicit cameraClass, so it
			// inherits Camera3d from the application. sortOn MUST come
			// back to "depth" or perspective draws are sort-broken.
			const gameplay = new Stage();
			gameplay.reset(app);
			expect(app.world.sortOn).toBe("depth");
		});

		it("ping-pongs cleanly across many stage swaps", () => {
			// Three-stage chain exercising every cell of the camera/sort
			// matrix:
			//   app=Camera3d, stage=Camera2d  → "z"
			//   app=Camera3d, stage=none      → "depth" (inherit app)
			//   app=Camera3d, stage=Camera3d  → "depth"
			//   app=Camera3d, stage=Camera2d  → "z" (round trip)
			//   app=Camera3d, stage=none      → "depth"
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});

			const expected = ["z", "depth", "depth", "z", "depth"];
			const stages = [
				new Stage({ cameraClass: Camera2d }),
				new Stage(),
				new Stage({ cameraClass: Camera3d }),
				new Stage({ cameraClass: Camera2d }),
				new Stage(),
			];
			for (let i = 0; i < stages.length; i++) {
				stages[i].reset(app);
				expect(app.world.sortOn, `stage[${i}]`).toBe(expected[i]);
			}
		});

		it("plain App + plain Stage = no auto-apply (no chosen camera class to read defaultSortOn from)", () => {
			// When neither the app nor the stage declares a cameraClass,
			// the stage falls back to the module-level Camera2d
			// singleton — but the bootstrap logic only reads
			// `defaultSortOn` off `StageCameraClass ?? AppCameraClass`,
			// both of which are undefined here. So sortOn stays at
			// whatever it was, NOT auto-pinned to Camera2d's "z".
			//
			// This matters: it means a Camera3d stage that runs against
			// a plain App leaves "depth" behind, and a subsequent plain
			// stage does NOT silently flip the world back to "z". A
			// regression in either direction would break user games
			// that mix-and-match.
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
			});
			// Constructor leaves sortOn at the world's default ("z").
			expect(app.world.sortOn).toBe("z");

			// Explicit Camera3d stage → pins "depth".
			new Stage({ cameraClass: Camera3d }).reset(app);
			expect(app.world.sortOn).toBe("depth");

			// Plain stage on a plain app — no class anywhere to source
			// defaultSortOn from, so sortOn is left alone. The previous
			// stage's "depth" persists.
			new Stage().reset(app);
			expect(app.world.sortOn).toBe("depth");

			// To get back to "z" without an app-level cameraClass, the
			// next stage has to assert it via Camera2d.
			new Stage({ cameraClass: Camera2d }).reset(app);
			expect(app.world.sortOn).toBe("z");
		});

		it("Camera3d subclass without its own defaultSortOn still picks up the inherited 'depth' value", () => {
			// JS static-field inheritance: a subclass that doesn't
			// redeclare `defaultSortOn` reads the parent's value when
			// `(SubclassedCam).defaultSortOn` is accessed. Locks in that
			// the bootstrap doesn't accidentally require a redeclare.
			class FollowCam extends Camera3d {}
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: FollowCam,
			});
			expect(app.world.sortOn).toBe("depth");

			// Loader trip — should still come back to "depth".
			new Stage({ cameraClass: Camera2d }).reset(app);
			expect(app.world.sortOn).toBe("z");
			new Stage().reset(app);
			expect(app.world.sortOn).toBe("depth");
		});

		it("camera class without a `defaultSortOn` static leaves world.sortOn untouched", () => {
			// Defensive: a user-authored Camera subclass that forgot to
			// declare `defaultSortOn` should NOT crash and should NOT
			// silently flip the world's existing sortOn. The bootstrap
			// only acts when there's something to apply.
			class NoSortOnCam extends Camera2d {}
			// Suppress inherited static by replacing with `undefined` —
			// own-property check: `NoSortOnCam.defaultSortOn` returns the
			// inherited Camera2d static ("z") via the prototype chain, so
			// we explicitly shadow it to undefined to model "no static
			// declared at all" from the engine's perspective.
			NoSortOnCam.defaultSortOn = undefined;

			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: NoSortOnCam,
			});
			// Pin a custom value, then run a stage reset with the same
			// (defaultSortOn-less) camera. The bootstrap MUST NOT clobber
			// the user's pin just because the camera doesn't declare a
			// default.
			app.world.sortOn = "x";
			new Stage().reset(app);
			expect(app.world.sortOn).toBe("x");
		});

		it("Stage.onResetEvent can override sortOn AFTER the auto-apply (user override wins for the current stage)", () => {
			// onResetEvent runs at the very end of Stage.reset() — after
			// the camera/sortOn bootstrap. A stage that pins a custom
			// sortOn in its onResetEvent should win for its lifetime;
			// the auto-apply only sets the initial value for the stage.
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});
			expect(app.world.sortOn).toBe("depth");

			class OverrideStage extends Stage {
				onResetEvent(_app) {
					_app.world.sortOn = "y";
				}
			}
			new OverrideStage().reset(app);
			expect(app.world.sortOn).toBe("y");
		});

		it("re-resetting the SAME stage instance is a no-op for sortOn (cameras.has('default') guard)", () => {
			// The whole sortOn bootstrap block sits inside
			// `if (!this.cameras.has("default") && app)`. Once a stage
			// has been reset once, its cameras map is populated, so
			// subsequent resets of the same instance must NOT touch
			// sortOn — even if the user has overridden it.
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});
			const stage = new Stage();
			stage.reset(app);
			expect(app.world.sortOn).toBe("depth");

			// User pins something custom after the first reset.
			app.world.sortOn = "x";
			// Second reset on the SAME stage instance — should NOT
			// overwrite the user's pin.
			stage.reset(app);
			expect(app.world.sortOn).toBe("x");
		});

		it("Stage with explicit `cameras: [...]` pins sortOn from the camera's constructor (PR #1464 round 2)", () => {
			// Updated from the prior contract (which silently inherited
			// the loader's "z") after PR #1464 round 2 review: a stage
			// constructed with `cameras: [new MyCam(...)]` (not
			// `cameraClass: MyCam`) should now pull `defaultSortOn` off
			// the supplied instance's `constructor`. Otherwise the user's
			// hand-rolled Camera3d would silently inherit the loader's
			// "z" and a fresh stage would never snap back to "depth".
			const app = new Application(400, 300, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});
			// Loader-pin to "z" first…
			new Stage({ cameraClass: Camera2d }).reset(app);
			expect(app.world.sortOn).toBe("z");
			// …then a stage that provides an explicit Camera3d INSTANCE.
			const cam = new Camera3d(0, 0, 400, 300);
			cam.name = "default";
			new Stage({ cameras: new Map([["default", cam]]) }).reset(app);
			// Reads `cam.constructor.defaultSortOn` = Camera3d's "depth"
			// → snaps the world back to "depth".
			expect(app.world.sortOn).toBe("depth");
		});
	});
});
