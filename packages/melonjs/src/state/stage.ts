import type Application from "./../application/application.ts";
import Camera2d from "./../camera/camera2d.ts";
import { Color } from "./../math/color.ts";
import type World from "./../physics/world.js";
import type Light2d from "./../renderable/light2d.js";
import { emit, STAGE_RESET } from "../system/event.ts";
import type Renderer from "./../video/renderer.js";

interface StageSettings {
	cameras: Camera2d[];
	/**
	 * Default camera class to instantiate when this stage has no
	 * explicit `cameras` list. Overrides any app-level `cameraClass`
	 * setting for this specific stage. Built-in stages (e.g.
	 * {@link DefaultLoadingScreen}) pin this to {@link Camera2d} so
	 * the loader stays 2D regardless of app-wide `cameraClass`.
	 */
	cameraClass?: new (
		minX: number,
		minY: number,
		maxX: number,
		maxY: number,
	) => Camera2d;
	onResetEvent?: (app: Application, ...args: unknown[]) => void;
	onDestroyEvent?: (app: Application) => void;
}

// a default camera instance to use across all stages
let default_camera: Camera2d | undefined;

// default stage settings
const default_settings: StageSettings = {
	cameras: [],
};

/**
 * a default "Stage" object.
 * every "stage" object (title screen, credits, ingame, etc...) to be managed
 * through the state manager must inherit from this base class.
 * @category Application
 * @see state
 */
export default class Stage {
	/**
	 * The list of active cameras in this stage.
	 * Cameras will be rendered based on this order defined in this list.
	 * Only the "default" camera will be resized when the window or canvas is resized.
	 */
	cameras: Map<string, Camera2d>;

	/**
	 * The list of active lights in this stage.
	 *
	 * Since 19.3.0, `Light2d` is a first-class world Renderable — the
	 * recommended pattern is to add lights directly to `app.world` (or any
	 * container, including a sprite, so the light follows it via parent
	 * transforms). The `lights` Map remains for backward compatibility:
	 * any entry added via `this.lights.set(name, light)` in
	 * `onResetEvent()` is automatically adopted into the world tree at
	 * stage reset time so it renders normally.
	 * @see Light2d
	 * @see Stage.ambientLight
	 * @example
	 * // recommended:
	 * const whiteLight = new Light2d(100, 100, 140, 140, "#fff", 0.7);
	 * app.world.addChild(whiteLight);
	 *
	 * // legacy (still works, auto-adopted into world):
	 * this.lights.set("whiteLight", whiteLight);
	 *
	 * this.ambientLight.parseCSS("#1117");
	 */
	lights: Map<string, Light2d>;

	/**
	 * Internal set of active lights, auto-populated by `Light2d`'s
	 * `onActivateEvent` / `onDeactivateEvent` hooks. Used by Camera2d's
	 * ambient-overlay pass to compute the cutouts.
	 * @ignore
	 */
	_activeLights: Set<Light2d>;

	/**
	 * an ambient light that will be added to the stage rendering
	 * @default "#000000"
	 * @see Light2d
	 */
	ambientLight: Color;

	/**
	 * Base light level applied to every normal-mapped sprite in the
	 * lit rendering path. Unlike {@link Stage#ambientLight} (which is
	 * the dark overlay punched by each light's cutout), this color is
	 * added to every lit pixel so unlit areas don't render pure
	 * black. Defaults to black (0, 0, 0) — sprites without a
	 * `normalMap` ignore it entirely.
	 * @default "#000000"
	 */
	ambientLightingColor: Color;

	/**
	 * The given constructor options
	 */
	settings: StageSettings;

	/**
	 * @param settings - The stage parameters
	 * @param [settings.cameras=[]] - a list of cameras (experimental)
	 * @param [settings.onResetEvent] - called by the state manager when reseting the object
	 * @param [settings.onDestroyEvent] - called by the state manager before switching to another state
	 */
	constructor(settings?: Partial<StageSettings>) {
		this.cameras = new Map();
		this.lights = new Map();
		this._activeLights = new Set();
		this.ambientLight = new Color(0, 0, 0, 0);
		this.ambientLightingColor = new Color(0, 0, 0, 1);
		this.settings = Object.assign({}, default_settings, settings || {});
	}

	/**
	 * Called by `Light2d.onActivateEvent` to register the light with the
	 * stage's ambient-overlay cutout list. Users normally don't call this.
	 * @ignore
	 */
	_registerLight(light: Light2d): void {
		this._activeLights.add(light);
	}

	/**
	 * Called by `Light2d.onDeactivateEvent` to deregister the light.
	 * @ignore
	 */
	_unregisterLight(light: Light2d): void {
		this._activeLights.delete(light);
	}

	/**
	 * Object reset function
	 * @ignore
	 */
	reset(app: Application, ...extraArgs: unknown[]): void {
		// Snapshot whether this is the first reset of this stage instance
		// BEFORE we touch the cameras map. Used below to gate the
		// `defaultSortOn` re-apply — once the cameras map is populated,
		// subsequent resets must NOT trample the user's `world.sortOn`
		// override.
		const isFirstReset = !this.cameras.has("default");

		// add all defined cameras
		this.settings.cameras.forEach((camera) => {
			this.cameras.set(camera.name, camera);
		});

		// default-camera resolution order (most-specific wins):
		//   1. explicit `cameras` array on the stage → handled above
		//   2. `cameraClass` on the stage settings → fresh instance,
		//      overrides app-level (used by DefaultLoadingScreen to
		//      pin Camera2d regardless of app.settings.cameraClass)
		//   3. `cameraClass` on the application settings → fresh
		//      instance per stage (Camera3d state shouldn't bleed
		//      across stages)
		//   4. neither set → fall back to the Camera2d module-level
		//      singleton (preserves pre-19.7 behavior bit-for-bit
		//      for every app that doesn't opt into cameraClass)
		const StageCameraClass = this.settings.cameraClass;
		const AppCameraClass = app?.settings.cameraClass;
		if (!this.cameras.has("default") && app) {
			const width = app.renderer.width;
			const height = app.renderer.height;

			if (typeof StageCameraClass === "function") {
				this.cameras.set("default", new StageCameraClass(0, 0, width, height));
			} else if (typeof AppCameraClass === "function") {
				this.cameras.set("default", new AppCameraClass(0, 0, width, height));
			} else {
				// no cameraClass anywhere — use the shared Camera2d singleton
				if (typeof default_camera === "undefined") {
					default_camera = new Camera2d(0, 0, width, height);
				}
				this.cameras.set("default", default_camera);
			}
		}

		// Re-apply the chosen camera's `defaultSortOn` to the world on
		// the FIRST reset of this stage — NOT on re-resets (`isFirstReset`
		// gate above), and NOT when the camera came from the
		// shared-Camera2d-singleton fallback (preserves pre-19.7
		// behavior for apps that don't opt into `cameraClass`).
		//
		// Sources for the chosen class, in priority order:
		//   1. `Stage({ cameraClass: ... })` — the loader uses this to
		//      pin Camera2d on a Camera3d app
		//   2. `Application({ cameraClass: ... })`
		//   3. `Stage({ cameras: [new MyCam(...)] })` — the documented
		//      explicit-camera pattern. Pulls the class off the
		//      already-instantiated camera's `constructor`.
		//
		// Without (3), a stage using the explicit pattern silently
		// inherited the loader's Camera2d → "z" sortOn and a Camera3d
		// sub-stage would never snap back to "depth".
		if (isFirstReset && app?.world) {
			type SortAwareCameraClass = {
				defaultSortOn?: "x" | "y" | "z" | "depth";
			};
			let chosenClass: SortAwareCameraClass | undefined;
			if (typeof StageCameraClass === "function") {
				chosenClass = StageCameraClass as unknown as SortAwareCameraClass;
			} else if (typeof AppCameraClass === "function") {
				chosenClass = AppCameraClass as unknown as SortAwareCameraClass;
			} else if (this.settings.cameras.length > 0) {
				// Read the camera actually registered under the "default"
				// key, NOT `settings.cameras[0]`. A split-screen / minimap
				// stage can list a non-default Camera2d before its main
				// Camera3d in the cameras array, and `[0].constructor`
				// would pick the wrong class — leaving `world.sortOn` at
				// "z" while the main perspective view needed "depth".
				//
				// Gated on `settings.cameras.length > 0` so the
				// shared-Camera2d-singleton fallback (no cameraClass +
				// no explicit cameras anywhere) leaves `world.sortOn`
				// untouched, preserving pre-19.7 behavior.
				const defaultCam = this.cameras.get("default");
				if (defaultCam) {
					chosenClass =
						defaultCam.constructor as unknown as SortAwareCameraClass;
				}
			}
			const defaultSortOn = chosenClass?.defaultSortOn;
			if (defaultSortOn && app.world.sortOn !== defaultSortOn) {
				app.world.sortOn = defaultSortOn;
			}
		}

		// reset the game
		emit(STAGE_RESET, this);

		// call the onReset Function with the app reference and any extra args
		this.onResetEvent(app, ...extraArgs);

		// adopt any lights registered via the legacy `this.lights.set(...)` API
		// into the world tree so they render as standard Renderables. Their
		// onActivateEvent hook then auto-registers them with `_activeLights`.
		if (app && app.world) {
			this.lights.forEach((light) => {
				if (!light.ancestor) {
					app.world.addChild(light);
				}
			});
		}
	}

	/**
	 * update function
	 * @ignore
	 * @param dt - time since the last update in milliseconds.
	 * @returns true if the stage needs to be redrawn
	 */
	update(dt: number): boolean {
		let isDirty = false;

		// update the camera/viewport
		this.cameras.forEach((camera) => {
			if (camera.update(dt)) {
				isDirty = true;
			}
		});

		// lights are part of the world tree now and updated by Container.update;
		// no separate per-light update loop is needed here.

		return isDirty;
	}

	/**
	 * draw the current stage
	 *
	 * Lights are rendered as part of the world tree (they're now first-class
	 * Renderables) and the ambient overlay pass runs inside each Camera's
	 * post-effect FBO bracket via {@link Stage#drawLighting}.
	 * @ignore
	 * @param renderer - the renderer object to draw with
	 * @param world - the world object to draw
	 */
	draw(renderer: Renderer, world: World): void {
		this.cameras.forEach((camera) => {
			camera.draw(renderer, world);
		});
	}

	/**
	 * Draw the stage's ambient-light overlay with cutouts for each active
	 * light. Called from each `Camera2d` inside its post-effect FBO bracket —
	 * lights themselves render via the world tree (they're standard
	 * Renderables); this pass only paints the dark fill that the lights cut
	 * holes through.
	 *
	 * Subclasses can override this method to implement custom lighting (e.g.
	 * per-pixel normal-mapped lighting via a custom shader). Called once per
	 * camera per frame.
	 * @param renderer - the active renderer
	 * @param camera - the camera currently rendering this stage
	 * @param translateX - the same world-to-screen X translate that
	 *   `Camera2d.draw()` applies to the world container (i.e.
	 *   `camera.pos.x + camera.offset.x` for the default camera, plus
	 *   the container's own offset for non-default cameras)
	 * @param translateY - the world-to-screen Y translate (see `translateX`)
	 */
	drawLighting(
		renderer: Renderer,
		camera: Camera2d,
		translateX: number = camera.pos.x + camera.offset.x,
		translateY: number = camera.pos.y + camera.offset.y,
	): void {
		if (this.ambientLight.alpha === 0) {
			return;
		}
		// cast for renderer-specific methods (setMask, setColor, fillRect, translate)
		const r = renderer as any;
		r.save();
		// `light.getVisibleArea()` returns world-space coords (via
		// `getBounds()` → `getAbsolutePosition()` walking ancestors), but by
		// the time `drawLighting` runs the world container's
		// `translate(-translateX, -translateY)` has already been popped —
		// the renderer is back in camera-local/FBO space. Re-apply the
		// same world-to-screen translate here so the cutouts align with
		// the gradient regardless of camera scroll, container parenting,
		// or non-default cameras (minimap / splitscreen).
		const tx = translateX;
		const ty = translateY;
		if (tx !== 0 || ty !== 0) {
			r.translate(-tx, -ty);
		}
		// punch out each active light's visible area so the ambient fill
		// doesn't darken what the light is illuminating
		this._activeLights.forEach((light) => {
			r.setMask(light.getVisibleArea(), true);
		});
		r.setColor(this.ambientLight);
		// fillRect must cover the camera's view in the (now world-space)
		// renderer — offset by the camera origin so it matches the viewport.
		r.fillRect(tx, ty, camera.width, camera.height);
		r.clearMask();
		r.restore();
	}

	/**
	 * destroy function
	 * @ignore
	 */
	destroy(app: Application): void {
		// clear all cameras
		this.cameras.clear();
		// clear all lights — Light2d.onDeactivateEvent will deregister each
		// from `_activeLights` as the world container removes them. Lights
		// only stored in the legacy `lights` map (never adopted into the
		// world) get destroyed directly.
		this.lights.forEach((light) => {
			if (!light.ancestor) {
				light.destroy();
			}
		});
		this.lights.clear();
		this._activeLights.clear();
		// notify the object
		this.onDestroyEvent(app);
	}

	/**
	 * onResetEvent function<br>
	 * called by the state manager when resetting the object
	 * this is typically where you will load a level, add renderables, etc...
	 * @param app - the current application instance
	 * @param args - optional arguments passed when switching state
	 * @see state#change
	 */
	onResetEvent(app: Application, ...args: unknown[]): void {
		// execute onResetEvent function if given through the constructor
		if (typeof this.settings.onResetEvent === "function") {
			this.settings.onResetEvent(app, ...args);
		}
	}

	/**
	 * onDestroyEvent function<br>
	 * called by the state manager before switching to another state
	 * @param app - the current application instance
	 */
	onDestroyEvent(app: Application): void {
		// execute onDestroyEvent function if given through the constructor
		if (typeof this.settings.onDestroyEvent === "function") {
			this.settings.onDestroyEvent(app);
		}
	}
}
