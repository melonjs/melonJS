import type Application from "./../application/application.ts";
import Camera2d from "./../camera/camera2d.ts";
import { Color } from "./../math/color.ts";
import type World from "./../physics/world.js";
import type Light2d from "./../renderable/light2d.js";
import { emit, STAGE_RESET } from "../system/event.ts";
import type Renderer from "./../video/renderer.js";
import { MAX_LIGHTS } from "./../video/webgl/shaders/multitexture-lit.js";

interface StageSettings {
	cameras: Camera2d[];
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
	 * scratch buffers for `collectLightingUniforms()` so the per-frame
	 * uniform upload doesn't allocate.
	 * @ignore
	 */
	_lightUniformsScratch: {
		positions: Float32Array;
		colors: Float32Array;
		heights: Float32Array;
		ambient: number[];
	} | null;

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
		this._lightUniformsScratch = null;
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
		// add all defined cameras
		this.settings.cameras.forEach((camera) => {
			this.cameras.set(camera.name, camera);
		});

		// use the application's default camera if no "default" camera is defined
		if (!this.cameras.has("default")) {
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
	 * Collect the per-frame lighting uniforms used by the WebGL renderer's
	 * lit pipeline (sprite normal-map shading). Returns an object with
	 * flat `Float32Array`s suitable for direct upload via
	 * `WebGLRenderer.setLightUniforms`.
	 *
	 * Light positions are translated from world-space (where
	 * `light.getBounds().centerX/Y` lives) into the renderer's
	 * pre-projection coords by subtracting `(translateX, translateY)` —
	 * the same translate `Camera2d.draw()` applies to the world
	 * container. This matches what `Stage.drawLighting` does for the
	 * cutout pass, so the lit fragment's `lightPos - vWorldPos` math
	 * lines up with the camera's view.
	 *
	 * The returned `positions` packs `[x, y, radius, intensity]` per
	 * light; `colors` packs `[r, g, b]`. Lights past `MAX_LIGHTS` (8)
	 * are silently dropped — no animation system has more than that
	 * for a single visible scene in practice, and the cap keeps the
	 * shader compatible with WebGL1's uniform-array size limits.
	 *
	 * Both buffers are reused across frames; callers must not retain
	 * references between frames.
	 * @param translateX - world-to-screen X translate (matches `Camera2d.draw()`)
	 * @param translateY - world-to-screen Y translate
	 * @returns lighting uniforms ready for the renderer
	 */
	collectLightingUniforms(
		translateX: number,
		translateY: number,
	): {
		positions: Float32Array;
		colors: Float32Array;
		heights: Float32Array;
		count: number;
		ambient: number[];
	} {
		// `MAX_LIGHTS` is imported from `multitexture-lit.js` — single source
		// of truth shared with the lit fragment shader and the
		// `QuadBatcher.setLightUniforms` clamp.
		if (this._lightUniformsScratch === null) {
			this._lightUniformsScratch = {
				positions: new Float32Array(MAX_LIGHTS * 4),
				colors: new Float32Array(MAX_LIGHTS * 3),
				heights: new Float32Array(MAX_LIGHTS),
				ambient: [0, 0, 0],
			};
		}
		const scratch = this._lightUniformsScratch;
		// reset to zero for any unused slots so stale data from the
		// previous frame doesn't leak into the shader
		scratch.positions.fill(0);
		scratch.colors.fill(0);
		scratch.heights.fill(0);

		let i = 0;
		this._activeLights.forEach((light) => {
			if (i >= MAX_LIGHTS) {
				return;
			}
			const b = light.getBounds();
			// derive the radius from the transform-aware bbox (so a
			// scaled light's brightness range tracks its visible range —
			// matches the cutout pass's `getVisibleArea()` sizing)
			const radius = Math.max(b.width, b.height) / 2;
			scratch.positions[i * 4 + 0] = b.centerX - translateX;
			scratch.positions[i * 4 + 1] = b.centerY - translateY;
			scratch.positions[i * 4 + 2] = radius;
			scratch.positions[i * 4 + 3] = light.intensity;
			scratch.colors[i * 3 + 0] = light.color.r / 255;
			scratch.colors[i * 3 + 1] = light.color.g / 255;
			scratch.colors[i * 3 + 2] = light.color.b / 255;
			scratch.heights[i] = light.lightHeight;
			i++;
		});

		scratch.ambient[0] = this.ambientLightingColor.r / 255;
		scratch.ambient[1] = this.ambientLightingColor.g / 255;
		scratch.ambient[2] = this.ambientLightingColor.b / 255;

		return {
			positions: scratch.positions,
			colors: scratch.colors,
			heights: scratch.heights,
			count: i,
			ambient: scratch.ambient,
		};
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
