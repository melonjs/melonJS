import type Camera2d from "./../camera/camera2d.ts";
import { AUTO, CANVAS, WEBGL } from "../const.ts";
import World from "../physics/world.js";
import state from "../state/state.ts";
import * as device from "../system/device.js";
import {
	BLUR,
	eventEmitter,
	FOCUS,
	GAME_AFTER_DRAW,
	GAME_AFTER_UPDATE,
	GAME_BEFORE_DRAW,
	GAME_BEFORE_UPDATE,
	GAME_INIT,
	GAME_RESET,
	GAME_UPDATE,
	STAGE_RESET,
	STATE_CHANGE,
	STATE_RESTART,
	STATE_RESUME,
	TICK,
	WINDOW_ONORIENTATION_CHANGE,
	WINDOW_ONRESIZE,
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
import type { ApplicationSettings } from "./settings.ts";

/**
 * An Application represents a single melonJS game, and is responsible for updating (each frame) all the related object status and draw them.
 * @category Application
 * @see {@link game}
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
	settings!: ApplicationSettings & {
		width: number;
		height: number;
		autoScale: boolean;
		zoomX: number;
		zoomY: number;
		scale: number | "auto";
	};

	/**
	 * Specify whether to pause this app when losing focus
	 * @default true
	 * @example
	 *  // keep the default game instance running even when losing focus
	 *  me.game.pauseOnBlur = false;
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
	updateDelta: number;
	lastUpdateStart: number | null;
	updateAverageDelta: number;

	/**
	 * @param width - The width of the canvas viewport
	 * @param height - The height of the canvas viewport
	 * @param options - The optional parameters for the application and default renderer
	 * @throws {Error} Will throw an exception if it fails to instantiate a renderer
	 */
	constructor(
		width: number,
		height: number,
		options: Partial<ApplicationSettings> & { legacy?: boolean },
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
		this.settings = Object.assign(
			defaultApplicationSettings,
			options || {},
		) as any;

		// sanitize potential given parameters
		(this.settings as any).width = width;
		(this.settings as any).height = height;
		// These are already booleans from the settings type, so no conversion needed
		this.settings.depthTest =
			this.settings.depthTest === "z-buffer" ? "z-buffer" : "sorting";
		if (
			this.settings.scaleMethod.search(
				/^(fill-(min|max)|fit|flex(-(width|height))?|stretch)$/,
			) !== -1
		) {
			(this.settings as any).autoScale = this.settings.scale === "auto" || true;
		} else {
			// default scaling method
			this.settings.scaleMethod = ScaleMethods.Fit;
			(this.settings as any).autoScale =
				this.settings.scale === "auto" || false;
		}

		// override renderer settings if &webgl or &canvas is defined in the URL
		const uriFragment = getUriFragment(undefined as unknown as string);
		if (
			uriFragment.webgl === true ||
			uriFragment.webgl1 === true ||
			uriFragment.webgl2 === true
		) {
			this.settings.renderer = WEBGL;
			if (uriFragment.webgl1 === true) {
				this.settings.preferWebGL1 = true;
			}
		} else if (uriFragment.canvas === true) {
			this.settings.renderer = CANVAS;
		}

		// normalize scale
		(this.settings as any).scale = (this.settings as any).autoScale
			? 1.0
			: +this.settings.scale || 1.0;

		// default scaled size value
		(this.settings as any).zoomX = width * (this.settings.scale as number);
		(this.settings as any).zoomY = height * (this.settings.scale as number);

		// identify parent element and/or the html target for resizing
		this.parentElement = device.getElement((this.settings as any).parent);
		if (typeof this.settings.scaleTarget !== "undefined") {
			this.settings.scaleTarget = device.getElement(this.settings.scaleTarget);
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

		// register to the channel
		eventEmitter.addListener(WINDOW_ONRESIZE, () => {
			onresize(this);
		});
		eventEmitter.addListener(WINDOW_ONORIENTATION_CHANGE, () => {
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

		// create a new physic world
		this.world = new World(0, 0, this.settings.width, this.settings.height);

		// set the reference to this application instance
		this.world.app = this;
		// set the reference to this application instance
		this.world.physic = this.settings.physic;

		// app starting time
		this.lastUpdate = globalThis.performance.now();
		// manually sort child if depthTest setting is "sorting"
		this.world.autoSort = !(
			this.renderer.type === "WEBGL" && this.settings.depthTest === "z-buffer"
		);

		this.isInitialized = true;

		eventEmitter.emit(GAME_INIT);
		eventEmitter.addListener(STATE_CHANGE, this.repaint.bind(this));
		eventEmitter.addListener(STATE_RESTART, this.repaint.bind(this));
		eventEmitter.addListener(STATE_RESUME, this.repaint.bind(this));
		eventEmitter.addListener(STAGE_RESET, this.reset.bind(this));
		eventEmitter.addListener(TICK, (time: number) => {
			this.update(time);
			this.draw();
		});

		eventEmitter.addListener(BLUR, () => {
			if (this.stopOnBlur) {
				state.stop(true);
			}
			if (this.pauseOnBlur) {
				state.pause(true);
			}
		});

		eventEmitter.addListener(FOCUS, () => {
			if (this.stopOnBlur) {
				state.restart(true);
			}
			if (this.resumeOnFocus) {
				state.resume(true);
			}
		});
	}

	/**
	 * reset the game Object manager
	 * destroy all current objects
	 */
	reset(): void {
		// point to the current active stage "default" camera
		const current = state.get();
		if (typeof current !== "undefined") {
			this.viewport = (current.cameras as unknown as Map<string, Camera2d>).get(
				"default",
			)!;
		}

		// publish reset notification
		eventEmitter.emit(GAME_RESET);

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
	 * me.game.onLevelLoaded = this.myFunction.bind(this);
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
	 * force the redraw (not update) of all objects
	 */
	repaint(): void {
		this.isDirty = true;
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
			eventEmitter.emit(GAME_BEFORE_UPDATE, time);
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
					eventEmitter.emit(GAME_UPDATE, time);
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
			eventEmitter.emit(GAME_AFTER_UPDATE, this.lastUpdate);
		}
	}

	/**
	 * draw the active scene/stage associated to this game
	 */
	draw(): void {
		if (this.renderer.isContextValid && (this.isDirty || this.isAlwaysDirty)) {
			// publish notification
			eventEmitter.emit(GAME_BEFORE_DRAW, globalThis.performance.now());

			// prepare renderer to draw a new frame
			this.renderer.clear();

			// render the stage
			state.current()!.draw(this.renderer, this.world);

			// set back to flag
			this.isDirty = false;

			// flush/render our frame
			this.renderer.flush();

			// publish notification
			eventEmitter.emit(GAME_AFTER_DRAW, globalThis.performance.now());
		}
	}
}
