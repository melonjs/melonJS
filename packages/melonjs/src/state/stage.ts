import type Application from "./../application/application.ts";
import Camera2d from "./../camera/camera2d.ts";
import { Color } from "./../math/color.ts";
import type World from "./../physics/world.js";
import type Light2d from "./../renderable/light2d.js";
import { emit, STAGE_RESET } from "../system/event.ts";
import type Renderer from "./../video/renderer.js";

/**
 * @import Container from "./../renderable/container.js";
 */

interface StageSettings {
	cameras: Camera2d[];
	onResetEvent?: (...args: unknown[]) => void;
	onDestroyEvent?: (app?: Application) => void;
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
	 * Cameras will be renderered based on this order defined in this list.
	 * Only the "default" camera will be resized when the window or canvas is resized.
	 */
	cameras: Map<string, Camera2d>;

	/**
	 * The list of active lights in this stage.
	 * (Note: Canvas Renderering mode will only properly support one light per stage)
	 * @see Light2d
	 * @see Stage.ambientLight
	 * @example
	 * // create a white spot light
	 * let whiteLight = new me.Light2d(0, 0, 140, "#fff", 0.7);
	 * // and add the light to this current stage
	 * this.lights.set("whiteLight", whiteLight);
	 * // set a dark ambient light
	 * this.ambientLight.parseCSS("#1117");
	 * // make the light follow the mouse
	 * me.input.registerPointerEvent("pointermove", app.viewport, (event) => {
	 *    whiteLight.centerOn(event.gameX, event.gameY);
	 * });
	 */
	lights: Map<string, Light2d>;

	/**
	 * an ambient light that will be added to the stage rendering
	 * @default "#000000"
	 * @see Light2d
	 */
	ambientLight: Color;

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
		this.ambientLight = new Color(0, 0, 0, 0);
		this.settings = Object.assign({}, default_settings, settings || {});
	}

	/**
	 * Object reset function
	 * @ignore
	 */
	reset(app: Application, ...extraArgs: unknown[]): void {
		// add all defined cameras
		this.settings.cameras.forEach((camera) => {
			this.cameras.set(camera.name, camera);
		});

		// use the application's default camera if no "default" camera is defined
		if (this.cameras.has("default") === false) {
			if (typeof default_camera === "undefined" && app) {
				const width = app.renderer.width;
				const height = app.renderer.height;
				default_camera = new Camera2d(0, 0, width, height);
			}
			if (typeof default_camera !== "undefined") {
				this.cameras.set("default", default_camera);
			}
		}

		// reset the game
		emit(STAGE_RESET, this);

		// call the onReset Function with the app reference and any extra args
		this.onResetEvent(app, ...extraArgs);
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
		// iterate through all cameras
		this.cameras.forEach((camera) => {
			if (camera.update(dt) === true) {
				isDirty = true;
			}
		});

		// update all lights
		this.lights.forEach((light) => {
			if (light.update() === true) {
				isDirty = true;
			}
		});

		return isDirty;
	}

	/**
	 * draw the current stage
	 * @ignore
	 * @param renderer - the renderer object to draw with
	 * @param world - the world object to draw
	 */
	draw(renderer: Renderer, world: World): void {
		// cast to any to access canvas/webgl renderer-specific methods
		const r = renderer as any;

		// iterate through all cameras
		this.cameras.forEach((camera) => {
			// render the root container
			camera.draw(renderer, world);

			// render the ambient light
			if (this.ambientLight.alpha !== 0) {
				r.save();
				// iterate through all lights
				this.lights.forEach((light) => {
					// cut out all lights visible areas
					r.setMask(light.getVisibleArea(), true);
				});
				// fill the screen with the ambient color
				r.setColor(this.ambientLight);
				r.fillRect(0, 0, camera.width, camera.height);
				// clear all masks
				r.clearMask();
				r.restore();
			}

			// render all lights
			this.lights.forEach((light) => {
				light.preDraw(r);
				light.draw(r);
				light.postDraw(r);
			});
		});
	}

	/**
	 * destroy function
	 * @ignore
	 */
	destroy(app: Application): void {
		// clear all cameras
		this.cameras.clear();
		// clear all lights
		this.lights.forEach((light) => {
			light.destroy();
		});
		this.lights.clear();
		// notify the object
		this.onDestroyEvent(app);
	}

	/**
	 * onResetEvent function<br>
	 * called by the state manager when reseting the object
	 * this is typically where you will load a level, add renderables, etc...
	 * @param app - the current application instance
	 * @param args - optional arguments passed when switching state
	 * @see state#change
	 */
	onResetEvent(app?: Application, ...args: unknown[]): void {
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
	onDestroyEvent(app?: Application): void {
		// execute onDestroyEvent function if given through the constructor
		if (typeof this.settings.onDestroyEvent === "function") {
			this.settings.onDestroyEvent(app);
		}
	}
}
