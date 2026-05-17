import type Camera2d from "./../camera/camera2d.ts";
import { AUTO, CANVAS, WEBGL } from "../const.ts";
import type { PhysicsAdapter } from "../physics/adapter.ts";
import World from "../physics/world.js";
import state from "../state/state.ts";
import { boot, initialized } from "../system/bootstrap.ts";
import * as device from "../system/device.js";
import {
	BLUR,
	emit,
	FOCUS,
	GAME_AFTER_DRAW,
	GAME_AFTER_UPDATE,
	GAME_BEFORE_DRAW,
	GAME_BEFORE_UPDATE,
	GAME_INIT,
	GAME_RESET,
	GAME_UPDATE,
	off,
	on,
	STAGE_RESET,
	STATE_CHANGE,
	STATE_RESTART,
	STATE_RESUME,
	TICK,
	VIDEO_INIT,
	WINDOW_ONORIENTATION_CHANGE,
	WINDOW_ONRESIZE,
	WINDOW_ONSCROLL,
} from "../system/event.ts";
import timer from "../system/timer.ts";
import { getUriFragment } from "../utils/utils.ts";
import CanvasRenderer from "../video/canvas/canvas_renderer.js";
import type Renderer from "./../video/renderer.js";
import { autoDetectRenderer } from "../video/utils/autodetect.js";
import { defaultApplicationSettings } from "./defaultApplicationSettings.ts";
import { consoleHeader } from "./header.ts";
import { onresize } from "./resize.ts";
import { ScaleMethods } from "./scaleMethods.ts";
import type {
	ApplicationSettings,
	ResolvedApplicationSettings,
} from "./settings.ts";

/**
 * Resolve the user-supplied `physic` setting into the (optional) adapter
 * to pass into the {@link World} constructor plus the legacy "builtin"
 * / "none" string the rest of the engine still reads via `world.physic`.
 *
 * Accepted shapes:
 *  - `"builtin"` / `undefined` → World constructs its own BuiltinAdapter
 *  - `"none"` → World constructs its own BuiltinAdapter that we never `step()`
 *  - a `PhysicsAdapter` instance → forwarded to the World constructor
 *  - `{ adapter: PhysicsAdapter }` → explicit form, room for future fields
 *
 * "none" still constructs an adapter so any code touching `world.adapter`
 * keeps working; the simulation is frozen because `World.step()`
 * short-circuits on `world.physic === "none"`.
 *
 * We deliberately don't import `BuiltinAdapter` here — letting `World`
 * apply its own default avoids a circular import via
 * `physics/collision.js`, which imports the `game` reference back from
 * this module.
 * @ignore
 */
function resolvePhysicSetting(physic: ApplicationSettings["physic"]): {
	adapter: PhysicsAdapter | undefined;
	physicLabel: string;
} {
	if (physic === "none") {
		return { adapter: undefined, physicLabel: "none" };
	}
	if (physic === undefined || physic === "builtin") {
		return { adapter: undefined, physicLabel: "builtin" };
	}
	// instance or { adapter } object — extract and pass through. The
	// adapter's `physicLabel` becomes `world.physic` so user code can
	// branch on `world.physic === "matter"` (etc.) without importing the
	// concrete adapter class. Falls back to "builtin" for adapters
	// predating the `physicLabel` field.
	const adapter =
		typeof physic === "object" && "adapter" in physic ? physic.adapter : physic;
	return { adapter, physicLabel: adapter?.physicLabel ?? "builtin" };
}

/**
 * The Application class is the main entry point for creating a melonJS game.
 * It initializes the renderer, creates the game world and viewport, registers DOM event
 * listeners (resize, orientation, scroll), and starts the game loop.
 *
 * The Application instance provides access to the core game systems:
 * - {@link Application#renderer renderer} — the active Canvas or WebGL renderer
 * - {@link Application#world world} — the root container for all game objects
 * - {@link Application#viewport viewport} — the default camera / viewport
 *
 * The app instance is automatically passed to {@link Stage#onResetEvent} and
 * {@link Stage#onDestroyEvent}, and is accessible from any renderable via
 * {@link Renderable#parentApp parentApp}.
 * @category Application
 * @example
 * // create a new melonJS Application
 * const app = new Application(800, 600, {
 *     parent: "screen",
 *     scaleMethod: "flex-width",
 *     renderer: 2, // AUTO
 * });
 *
 * // add objects to the world
 * app.world.addChild(new Sprite(0, 0, { image: "player" }));
 *
 * // access the viewport
 * app.viewport.follow(player, app.viewport.AXIS.BOTH);
 */
export default class Application {
	/**
	 * the parent HTML element holding the main canvas of this application
	 */
	parentElement!: HTMLElement;

	/**
	 * a reference to the active Canvas or WebGL renderer
	 */
	renderer!: Renderer;

	/**
	 * the active stage "default" camera
	 */
	viewport!: Camera2d;

	/**
	 * a reference to the game world, <br>
	 * a world is a virtual environment containing all the game objects
	 */
	world!: World;

	/**
	 * when true, all objects will be added under the root world container.<br>
	 * When false, a `me.Container` object will be created for each corresponding groups
	 * @default true
	 */
	mergeGroup: boolean;

	/**
	 * Last time the game update loop was executed. <br>
	 * Use this value to implement frame prediction in drawing events,
	 * for creating smooth motion while running game update logic at
	 * a lower fps.
	 */
	lastUpdate: DOMHighResTimeStamp;

	/**
	 * true when this app instance has been initialized
	 * @default false
	 */
	isInitialized: boolean;

	/**
	 * the given settings used when creating this application
	 */
	settings!: ResolvedApplicationSettings;

	/**
	 * Specify whether to pause this app when losing focus
	 * @default true
	 * @example
	 *  // keep the default game instance running even when losing focus
	 *  app.pauseOnBlur = false;
	 */
	pauseOnBlur: boolean;

	/**
	 * Specify whether to unpause this app when gaining back focus
	 * @default true
	 */
	resumeOnFocus: boolean;

	/**
	 * Specify whether to stop this app when losing focus
	 * @default false
	 */
	stopOnBlur: boolean;

	// to know when we have to refresh the display
	isDirty: boolean;

	// always refresh the display when updatesPerSecond are lower than fps
	isAlwaysDirty: boolean;

	// frame counter for frameSkipping
	frameCounter: number;
	frameRate: number;

	// time accumulation for multiple update calls
	accumulator: number;
	accumulatorMax: number;
	accumulatorUpdateDelta: number;

	// min update step size
	stepSize: number;

	// DOM event handlers (stored for cleanup in destroy)
	private _onResize?: (e: Event) => void;
	private _onOrientationChange?: (e: Event) => void;
	private _onScroll?: (e: Event) => void;
	updateDelta: number;
	lastUpdateStart: number | null;
	updateAverageDelta: number;

	/**
	 * Create and initialize a new melonJS Application.
	 * This is the recommended way to start a melonJS game.
	 * @param width - The width of the canvas viewport
	 * @param height - The height of the canvas viewport
	 * @param options - The optional parameters for the application and default renderer
	 * @throws {Error} Will throw an exception if it fails to instantiate a renderer
	 * @example
	 * const app = new Application(1024, 768, {
	 *     parent: "game-container",
	 *     scale: "auto",
	 *     scaleMethod: "fit",
	 *     renderer: 2, // AUTO
	 * });
	 */
	constructor(
		width: number,
		height: number,
		options: Partial<ApplicationSettings> & { legacy?: boolean } = {},
	) {
		this.mergeGroup = true;
		this.lastUpdate = 0;
		this.isInitialized = false;
		this.pauseOnBlur = true;
		this.resumeOnFocus = true;
		this.stopOnBlur = false;
		this.isDirty = true;
		this.isAlwaysDirty = false;
		this.frameCounter = 0;
		this.frameRate = 1;
		this.accumulator = 0.0;
		this.accumulatorMax = 0.0;
		this.accumulatorUpdateDelta = 0;
		this.stepSize = 1000 / 60;
		this.updateDelta = 0;
		this.lastUpdateStart = null;
		this.updateAverageDelta = 0;

		// when using the default game application, legacy is set to true
		// and init is called through the legacy video.init() call
		if (options.legacy !== true) {
			this.init(width, height, options);
		}
	}

	/**
	 * init the game instance (create a physic world, update starting time, etc..)
	 * @param width - The width of the canvas viewport
	 * @param height - The height of the canvas viewport
	 * @param options - The optional parameters for the application and default renderer
	 */
	init(
		width: number,
		height: number,
		options?: Partial<ApplicationSettings>,
	): void {
		// ensure the engine is bootstrapped
		if (!initialized) {
			boot();
		}

		const merged = {
			...defaultApplicationSettings,
			...(options || {}),
		};

		const autoScale =
			merged.scale === "auto" ||
			/^(fill-(min|max)|fit|flex(-(width|height))?|stretch)$/.test(
				merged.scaleMethod,
			);

		const settings = {
			...merged,
			width,
			height,
			autoScale,
			scale: autoScale ? 1.0 : +merged.scale || 1.0,
			zoomX: 0,
			zoomY: 0,
			scaleMethod: /^(fill-(min|max)|fit|flex(-(width|height))?|stretch)$/.test(
				merged.scaleMethod,
			)
				? merged.scaleMethod
				: ScaleMethods.Fit,
		} as ResolvedApplicationSettings;

		// override renderer settings if &webgl or &canvas is defined in the URL
		const uriFragment = getUriFragment();
		if (
			uriFragment.webgl === true ||
			uriFragment.webgl1 === true ||
			uriFragment.webgl2 === true
		) {
			settings.renderer = WEBGL;
			if (uriFragment.webgl1 === true) {
				settings.preferWebGL1 = true;
			}
		} else if (uriFragment.canvas === true) {
			settings.renderer = CANVAS;
		}

		// computed scaled size
		settings.zoomX = width * settings.scale;
		settings.zoomY = height * settings.scale;

		this.settings = settings;

		// identify parent element and/or the html target for resizing
		this.parentElement = device.getElement(this.settings.parent!);
		if (typeof this.settings.scaleTarget !== "undefined") {
			this.settings.scaleTarget = device.getElement(this.settings.scaleTarget);
		}

		// set the CSS background color on the parent element to prevent
		// a white flash before the first render frame
		if (
			this.settings.backgroundColor !== "transparent" &&
			typeof globalThis.getComputedStyle === "function"
		) {
			const computedBg = globalThis.getComputedStyle(
				this.parentElement,
			).backgroundColor;
			if (
				!computedBg ||
				computedBg === "rgba(0, 0, 0, 0)" ||
				computedBg === "transparent"
			) {
				this.parentElement.style.backgroundColor =
					this.settings.backgroundColor;
			}
		}

		if (typeof this.settings.renderer === "number") {
			switch (this.settings.renderer) {
				case AUTO:
				case WEBGL:
					this.renderer = autoDetectRenderer(this.settings as any);
					break;
				default:
					this.renderer = new CanvasRenderer(this.settings as any);
					break;
			}
		} else {
			const CustomRenderer = this.settings.renderer as any;
			// a renderer class
			this.renderer = new CustomRenderer(this.settings);
		}

		// make this the active game instance for modules that reference the global
		setDefaultGame(this);

		// bridge DOM events to the melonJS event system
		this._onResize = (e: Event) => {
			emit(WINDOW_ONRESIZE, e);
		};
		this._onOrientationChange = (e: Event) => {
			emit(WINDOW_ONORIENTATION_CHANGE, e);
		};
		this._onScroll = (e: Event) => {
			emit(WINDOW_ONSCROLL, e);
		};
		globalThis.addEventListener("resize", this._onResize);
		globalThis.addEventListener("orientationchange", this._onOrientationChange);
		if (device.screenOrientation) {
			globalThis.screen.orientation.onchange = this._onOrientationChange;
		}
		globalThis.addEventListener("scroll", this._onScroll);

		// react to resize/orientation changes
		on(WINDOW_ONRESIZE, () => {
			onresize(this);
		});
		on(WINDOW_ONORIENTATION_CHANGE, () => {
			onresize(this);
		});

		// add our canvas (default to document.body if settings.parent is undefined)
		this.parentElement.appendChild(this.renderer.getCanvas());

		// Mobile browser hacks
		if (device.platform.isMobile) {
			// Prevent the webview from moving on a swipe
			device.enableSwipe(false);
		}

		// trigger an initial resize();
		onresize(this);

		// add an observer to detect when the dom tree is modified
		if ("MutationObserver" in globalThis) {
			// Create an observer instance linked to the callback function
			const observer = new MutationObserver(() => {
				onresize(this);
			});

			// Start observing the target node for configured mutations
			observer.observe(this.parentElement, {
				attributes: false,
				childList: true,
				subtree: true,
			});
		}

		if (this.settings.consoleHeader) {
			consoleHeader(this);
		}

		// resolve the physic setting into (adapter, legacy-string) pair.
		// Accepts a string ("builtin"/"none" — built-in adapters that ship
		// in core), a {@link PhysicsAdapter} instance (e.g.
		// `new BuiltinAdapter({ gravity })` or
		// `new MatterAdapter()` from `@melonjs/matter-adapter`), or the
		// explicit form `{ adapter: PhysicsAdapter }`.
		const { adapter, physicLabel } = resolvePhysicSetting(this.settings.physic);

		// create a new physic world wired to the resolved adapter
		this.world = new World(
			0,
			0,
			this.settings.width,
			this.settings.height,
			adapter,
		);

		// set the reference to this application instance
		this.world.app = this;
		// `world.physic` carries the active adapter's identifier
		// (`"builtin"`, `"matter"`, third-party label, or the reserved
		// `"none"` when physics is disabled). User code branches on it;
		// `World.step` short-circuits the simulation only when the value
		// is `"none"`.
		this.world.physic = physicLabel;
		this.world.gpuTilemap = this.settings.gpuTilemap;

		// report the active physics adapter once the world is wired —
		// useful confirmation when a third-party adapter (e.g.
		// `@melonjs/matter-adapter`) is plugged in via `settings.physic`.
		// External adapters that set `name` / `version` / `url` get logged
		// the same way as @melonjs/debug-plugin; BuiltinAdapter falls back
		// to just its class name. Skipped when `consoleHeader` is disabled.
		if (this.settings.consoleHeader) {
			if (this.world.physic === "none") {
				console.log("physics: disabled");
			} else if (this.world.adapter) {
				const a = this.world.adapter as {
					constructor: { name: string };
					name?: string;
					version?: string;
					url?: string;
				};
				const label = a.name ?? a.constructor.name;
				const version = a.version ? ` ${a.version}` : "";
				const url = a.url ? ` | ${a.url}` : "";
				console.log(`physics: ${label}${version}${url}`);
			} else {
				console.log("physics: enabled (no adapter)");
			}
		}

		// The GPU tilemap path needs a WebGL 2 renderer. Warn once at app
		// startup when the user asked for it but the active renderer
		// can't honor it (Canvas mode, WebGL 1 driver, `preferWebGL1`
		// override, etc.) — individual layers will silently fall through
		// to the legacy renderer, but the user gets one heads-up that
		// the feature they enabled isn't actually in effect.
		if (
			this.settings.gpuTilemap &&
			// duck-type rather than `instanceof WebGLRenderer` to avoid a
			// runtime import; only the WebGL renderer carries `WebGLVersion`
			(this.renderer as unknown as { WebGLVersion?: number }).WebGLVersion !== 2
		) {
			console.warn(
				"melonJS: gpuTilemap is enabled but the active renderer is not WebGL 2 — falling back to the legacy tile renderer for every tile layer",
			);
		}

		// app starting time
		this.lastUpdate = globalThis.performance.now();
		// only register event listeners once per instance
		if (!this.isInitialized) {
			/* eslint-disable @typescript-eslint/unbound-method */
			on(STATE_CHANGE, this.repaint, this);
			on(STATE_RESTART, this.repaint, this);
			on(STATE_RESUME, this.repaint, this);
			on(STAGE_RESET, this.reset, this);
			/* eslint-enable @typescript-eslint/unbound-method */
			// eslint-disable-next-line @typescript-eslint/unbound-method
			on(TICK, this._tick, this);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			on(BLUR, this._onBlur, this);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			on(FOCUS, this._onFocus, this);
		}

		this.isInitialized = true;

		emit(GAME_INIT, this);
		emit(VIDEO_INIT, this.renderer);
	}

	/**
	 * reset the game Object manager
	 * destroy all current objects
	 */
	reset(): void {
		// point to the current active stage "default" camera
		const current = state.get();
		if (typeof current !== "undefined") {
			this.viewport = current.cameras.get("default")!;
		}

		// publish reset notification
		emit(GAME_RESET);

		// Refresh internal variables for framerate  limiting
		this.updateFrameRate();
	}

	/**
	 * Specify the property to be used when sorting renderables for this application game world.
	 * Accepted values : "x", "y", "z", "depth"
	 * @see {@link World.sortOn}
	 */
	get sortOn(): string {
		return this.world.sortOn;
	}
	set sortOn(value: string) {
		this.world.sortOn = value;
	}

	/**
	 * Fired when a level is fully loaded and all renderable instantiated. <br>
	 * Additionally the level id will also be passed to the called function.
	 * @example
	 * // call myFunction () everytime a level is loaded
	 * app.onLevelLoaded = this.myFunction.bind(this);
	 */
	onLevelLoaded(): void {}

	/**
	 * Update the renderer framerate using the system config variables.
	 * @see {@link timer.maxfps}
	 * @see {@link World.fps}
	 */
	updateFrameRate(): void {
		// reset the frame counter
		this.frameCounter = 0;
		this.frameRate = ~~(0.5 + 60 / timer.maxfps);

		// set step size based on the updatesPerSecond
		this.stepSize = 1000 / this.world.fps;
		this.accumulator = 0.0;
		this.accumulatorMax = this.stepSize * 10;

		// display should always re-draw when update speed doesn't match fps
		// this means the user intends to write position prediction drawing logic
		this.isAlwaysDirty = timer.maxfps > this.world.fps;
	}

	/**
	 * Returns the parent HTML Element holding the main canvas of this application
	 * @returns the parent HTML element
	 */
	getParentElement(): HTMLElement {
		return this.parentElement;
	}

	/**
	 * The HTML canvas element associated with this application's renderer.
	 * @example
	 * // access the canvas DOM element
	 * const canvas = app.canvas;
	 */
	get canvas(): HTMLCanvasElement {
		return this.renderer.getCanvas();
	}

	/**
	 * Trigger a manual resize of the application canvas to fit the parent element.
	 * This is automatically called on window resize/orientation change, but can
	 * be called manually if the parent element size changes programmatically.
	 * @example
	 * // force a resize after changing the parent element dimensions
	 * app.resize();
	 */
	resize(): void {
		onresize(this);
	}

	/**
	 * Destroy this application instance and release all associated resources.
	 * Removes the canvas from the DOM, destroys the world, and unregisters
	 * all event listeners.
	 * @param removeCanvas - if true, the canvas element is removed from the DOM (default: true)
	 * @example
	 * // clean up when done
	 * app.destroy();
	 */
	destroy(removeCanvas: boolean = true): void {
		// stop the render loop and remove all event listeners
		/* eslint-disable @typescript-eslint/unbound-method */
		off(TICK, this._tick, this);
		off(BLUR, this._onBlur, this);
		off(FOCUS, this._onFocus, this);
		off(STATE_CHANGE, this.repaint, this);
		off(STATE_RESTART, this.repaint, this);
		off(STATE_RESUME, this.repaint, this);
		off(STAGE_RESET, this.reset, this);
		/* eslint-enable @typescript-eslint/unbound-method */

		// remove DOM event listeners
		if (this._onResize) {
			globalThis.removeEventListener("resize", this._onResize);
			globalThis.removeEventListener(
				"orientationchange",
				this._onOrientationChange!,
			);
			globalThis.removeEventListener("scroll", this._onScroll!);
			if (device.screenOrientation) {
				globalThis.screen.orientation.onchange = null;
			}
		}

		// destroy the world and all its children
		if (this.world) {
			this.world.destroy();
		}

		// remove the canvas from the DOM
		if (removeCanvas && this.renderer) {
			const canvas = this.renderer.getCanvas();
			if (canvas.parentElement) {
				canvas.parentElement.removeChild(canvas);
			}
		}

		this.isInitialized = false;
	}

	/**
	 * force the redraw (not update) of all objects
	 */
	repaint(): void {
		this.isDirty = true;
	}

	/**
	 * Pause the current stage. Convenience proxy for {@link state.pause}.
	 * @param [music=false] - also pause the current music track
	 * @example
	 * app.pause();        // pause game updates, keep music playing
	 * app.pause(true);    // pause game updates and music
	 */
	pause(music: boolean = false): void {
		state.pause(music);
	}

	/**
	 * Resume the current stage. Convenience proxy for {@link state.resume}.
	 * @param [music=false] - also resume the current music track
	 */
	resume(music: boolean = false): void {
		state.resume(music);
	}

	/**
	 * Freeze the current stage for a fixed duration, then automatically resume.
	 * Useful for hit-stop / hit-pause effects on impact.
	 *
	 * Convenience proxy for {@link state.freeze}; see that method's
	 * documentation for the full behaviour matrix (extend-not-stack semantics,
	 * interaction with manual `state.pause()` / `state.resume()`, automatic
	 * cancellation on window blur, etc.).
	 * @param duration - duration of the freeze in milliseconds
	 * @param [music=false] - also pause the current music track during the freeze
	 * @returns a Promise that resolves once the freeze ends (or is cancelled)
	 * @example
	 * // simple hit-stop on impact
	 * app.freeze(80);
	 *
	 * // chain VFX after the freeze
	 * await app.freeze(120);
	 * spawnImpactParticles();
	 */
	freeze(duration: number, music: boolean = false): Promise<void> {
		return state.freeze(duration, music);
	}

	/** @ignore */
	_tick(time: number): void {
		this.update(time);
		this.draw();
	}

	/** @ignore */
	_onBlur(): void {
		if (this.stopOnBlur) {
			state.stop(true);
		}
		if (this.pauseOnBlur) {
			state.pause(true);
		}
	}

	/** @ignore */
	_onFocus(): void {
		if (this.stopOnBlur) {
			state.restart(true);
		}
		if (this.resumeOnFocus) {
			state.resume(true);
		}
	}

	/**
	 * update all objects related to this game active scene/stage
	 * @param time - current timestamp as provided by the RAF callback
	 */
	update(time: number): void {
		// handle frame skipping if required
		if (++this.frameCounter % this.frameRate === 0) {
			// reset the frame counter
			this.frameCounter = 0;

			// publish notification
			emit(GAME_BEFORE_UPDATE, time);
			this.accumulator += timer.getDelta();
			this.accumulator = Math.min(this.accumulator, this.accumulatorMax);

			this.updateDelta = timer.interpolation ? timer.getDelta() : this.stepSize;
			this.accumulatorUpdateDelta = timer.interpolation
				? this.updateDelta
				: Math.max(this.updateDelta, this.updateAverageDelta);

			while (
				this.accumulator >= this.accumulatorUpdateDelta ||
				timer.interpolation
			) {
				this.lastUpdateStart = globalThis.performance.now();

				// game update event
				if (!state.isPaused()) {
					emit(GAME_UPDATE, time);
				}

				// update all objects (and pass the elapsed time since last frame)
				this.isDirty = this.world.update(this.updateDelta);
				this.isDirty =
					state.current()!.update(this.updateDelta) || this.isDirty;

				this.lastUpdate = globalThis.performance.now();
				this.updateAverageDelta = this.lastUpdate - this.lastUpdateStart;

				this.accumulator -= this.accumulatorUpdateDelta;
				if (timer.interpolation) {
					this.accumulator = 0;
					break;
				}
			}

			// publish notification
			emit(GAME_AFTER_UPDATE, this.lastUpdate);
		}
	}

	/**
	 * draw the active scene/stage associated to this game
	 */
	draw(): void {
		if (this.renderer.isContextValid && (this.isDirty || this.isAlwaysDirty)) {
			// publish notification
			emit(GAME_BEFORE_DRAW, globalThis.performance.now());

			// prepare renderer to draw a new frame
			this.renderer.clear();

			// render the stage
			state.current()!.draw(this.renderer, this.world);

			// set back to flag
			this.isDirty = false;

			// flush/render our frame
			this.renderer.flush();

			// publish notification
			emit(GAME_AFTER_DRAW, globalThis.performance.now());
		}
	}
}

/**
 * The default game application instance.
 * Set via {@link setDefaultGame} during engine initialization.
 * When using {@link Application} directly, prefer using the app instance
 * (e.g. from {@link Stage#onResetEvent} or {@link Renderable#parentApp}).
 */
export let game: Application;

/**
 * Set the default game application instance.
 * @ignore
 */
export function setDefaultGame(app: Application) {
	game = app;
}
