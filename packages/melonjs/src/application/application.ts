import type Camera2d from "./../camera/camera2d.ts";
import { AUTO, CANVAS, WEBGL, WEBGPU } from "../const.ts";
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
import WebGLRenderer from "../video/webgl/webgl_renderer.js";
import WebGPURenderer from "../video/webgpu/webgpu_renderer.js";
import { defaultApplicationSettings } from "./defaultApplicationSettings.ts";
import { consoleHeader } from "./header.ts";
import { onresize } from "./resize.ts";
import { ScaleMethods } from "./scaleMethods.ts";
import type {
	ApplicationSettings,
	ResolvedApplicationSettings,
} from "./settings.ts";

// vendor-prefixed fullscreen entry points still ship on older WebKit /
// Gecko / IE-derived engines; spelled out here so requestFullscreen()
// works on any browser whose `hasFullscreenSupport` flag was set via a
// prefix probe rather than the unprefixed standard.
type ElementWithLegacyFullscreen = Element & {
	mozRequestFullScreen?: () => void;
	webkitRequestFullscreen?: () => void;
	msRequestFullscreen?: () => void;
};
// `document.exitFullscreen()` is the modern entry but older WebKit /
// Gecko / IE-derived browsers shipped vendor-prefixed variants. Same
// rationale as `ElementWithLegacyFullscreen`: kept here as a local
// intersection so `app.exitFullscreen()` no-ops cleanly on every
// browser whose `hasFullscreenSupport` was set via a prefix probe.
// Note: Mozilla uses `mozCancelFullScreen` (not `mozExitFullScreen`).
type DocumentWithLegacyExitFullscreen = Document & {
	webkitExitFullscreen?: () => Promise<void> | void;
	mozCancelFullScreen?: () => Promise<void> | void;
	msExitFullscreen?: () => Promise<void> | void;
};

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
 * @internal
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
 * The constructor resolves the given settings, creates the game world and
 * registers DOM event listeners (resize, orientation, scroll); you **MUST**
 * then call (and await) {@link Application#init init}, which builds the
 * renderer, appends the canvas to the parent element, and starts the game
 * loop — without it the application has no renderer and displays nothing.
 *
 * The Application instance provides access to the core game systems:
 * - {@link Application#renderer renderer} — the active Canvas, WebGL or (experimental) WebGPU renderer
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
 * // build the renderer (mandatory — only suspends for WebGPU)
 * await app.init();
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
	parentElement: HTMLElement;

	/**
	 * a reference to the active Canvas, WebGL or (experimental) WebGPU renderer
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
	world: World;

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
	settings: ResolvedApplicationSettings;

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
	/**
	 * @ignore
	 * @internal
	 */
	private _onResize?: (e: Event) => void;
	/**
	 * @ignore
	 * @internal
	 */
	private _onOrientationChange?: (e: Event) => void;
	/**
	 * @ignore
	 * @internal
	 */
	private _onScroll?: (e: Event) => void;
	// melonJS-event resize subscription (stored for cleanup in destroy)
	/**
	 * @ignore
	 * @internal
	 */
	private _doResize?: () => void;
	// the parent-element observer installed by init() (disconnected in destroy)
	/**
	 * @ignore
	 * @internal
	 */
	private _resizeObserver: MutationObserver | undefined;
	// set by destroy(); a destroyed Application is terminal — init() refuses
	// to run (or, if already in flight, aborts) instead of resurrecting it
	/**
	 * @ignore
	 * @internal
	 */
	private _destroyed = false;
	/**
	 * Simulated time advanced by one logic step, in ms — what `world.update()`
	 * receives. Fixed at `1000 / world.fps` unless `timer.interpolation` is on,
	 * in which case it follows the real frame delta.
	 *
	 * Not to be confused with {@link Application#lastUpdateDelta}, which is how
	 * long that step actually took to compute.
	 */
	updateDelta: number;
	lastUpdateStart: number | null;

	/**
	 * Measured wall-clock cost of the most recent logic step, in ms
	 * (`performance.now()` taken either side of the world/stage update).
	 *
	 * Used by the fixed-timestep loop to avoid a spiral of death: the
	 * accumulator drains by at least this much, so a scene too heavy to
	 * simulate in real time slows down instead of locking up.
	 *
	 * Only the *last* step of a frame is recorded, so a frame that ran several
	 * catch-up steps reports less than its total update cost.
	 * Renamed from `updateAverageDelta` in 20.0.0.
	 * @since 20.0.0
	 */
	lastUpdateDelta: number;

	/**
	 * @deprecated since 20.0.0 — renamed to {@link Application#lastUpdateDelta}.
	 * The old name claimed an average that has not existed since 2015, when the
	 * exponential smoothing behind it was removed a day after being added.
	 */
	get updateAverageDelta() {
		return this.lastUpdateDelta;
	}

	set updateAverageDelta(value: number) {
		this.lastUpdateDelta = value;
	}

	/**
	 * Create a new melonJS Application.
	 * Constructing the instance is only the first half of starting a game:
	 * you **MUST** then call (and await) {@link Application#init init} to
	 * build the renderer — an Application on which `init()` has not resolved
	 * has no `renderer`, no canvas, and cannot render anything.
	 * @param width - The width of the canvas viewport
	 * @param height - The height of the canvas viewport
	 * @param options - The optional parameters for the application and default renderer
	 * @example
	 * const app = new Application(1024, 768, {
	 *     parent: "game-container",
	 *     scale: "auto",
	 *     scaleMethod: "fit",
	 *     renderer: 2, // AUTO
	 * });
	 * await app.init();
	 */
	constructor(
		width: number,
		height: number,
		options: Partial<ApplicationSettings> = {},
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
		this.lastUpdateDelta = 0;

		// Everything renderer-independent is built here — resolved settings,
		// the parent element, the DOM event bridging, the physic world — so a
		// constructed Application already owns its world and its wiring.
		// `init()` only adds the renderer and what depends on it (canvas,
		// resize layout, console banner), which is what allows the renderer
		// to be acquired asynchronously.

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
		// (the WebGL renderer is WebGL 2 only since 20.0 — the legacy
		// `#webgl1` flag is gone, `#webgl`/`#webgl2` are synonyms)
		const uriFragment = getUriFragment();
		if (uriFragment.webgl === true || uriFragment.webgl2 === true) {
			settings.renderer = WEBGL;
		} else if (uriFragment.canvas === true) {
			settings.renderer = CANVAS;
		} else if (uriFragment.webgpu === true) {
			// exactly like passing `renderer: video.WEBGPU`: requires the
			// backend rather than trusting AUTO's ladder to land on it
			settings.renderer = WEBGPU;
		}

		// computed scaled size
		settings.zoomX = width * settings.scale;
		settings.zoomY = height * settings.scale;

		this.settings = settings;

		// identify parent element and/or the html target for resizing
		this.parentElement = device.getElement(settings.parent!);
		if (typeof settings.scaleTarget !== "undefined") {
			settings.scaleTarget = device.getElement(settings.scaleTarget);
		}

		// set the CSS background color on the parent element to prevent
		// a white flash before the first render frame
		if (
			settings.backgroundColor !== "transparent" &&
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
				this.parentElement.style.backgroundColor = settings.backgroundColor;
			}
		}

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

		// react to resize/orientation changes. These subscriptions live from
		// construction on, but `onresize` lays out the canvas through
		// `this.renderer`, which does not exist until `init()` resolves —
		// hence the `isInitialized` guard.
		this._doResize = () => {
			if (this.isInitialized) {
				onresize(this);
			}
		};
		on(WINDOW_ONRESIZE, this._doResize);
		on(WINDOW_ONORIENTATION_CHANGE, this._doResize);

		// Mobile browser hacks
		if (device.platform.isMobile) {
			// Prevent the webview from moving on a swipe
			device.enableSwipe(false);
		}

		// resolve the physic setting into (adapter, legacy-string) pair.
		// Accepts a string ("builtin"/"none" — built-in adapters that ship
		// in core), a {@link PhysicsAdapter} instance (e.g.
		// `new BuiltinAdapter({ gravity })` or
		// `new MatterAdapter()` from `@melonjs/matter-adapter`), or the
		// explicit form `{ adapter: PhysicsAdapter }`.
		const { adapter, physicLabel } = resolvePhysicSetting(settings.physic);

		// create a new physic world wired to the resolved adapter
		this.world = new World(0, 0, settings.width, settings.height, adapter);

		// set the reference to this application instance
		this.world.app = this;
		// `world.physic` carries the active adapter's identifier
		// (`"builtin"`, `"matter"`, third-party label, or the reserved
		// `"none"` when physics is disabled). User code branches on it;
		// `World.step` short-circuits the simulation only when the value
		// is `"none"`.
		this.world.physic = physicLabel;
		this.world.gpuTilemap = settings.gpuTilemap;

		// If a custom cameraClass is specified, seed the world's sort
		// mode from the camera's `defaultSortOn` static. Camera2d
		// declares `"z"` (today's default — no behavior change for
		// existing games); Camera3d declares `"depth"`, which switches
		// the world to the camera-distance painter's sort required by
		// perspective. User code can still override `world.sortOn` after
		// this point; we only set the initial value.
		const cameraClass = settings.cameraClass as
			| { defaultSortOn?: "x" | "y" | "z" | "depth" }
			| undefined;
		if (cameraClass?.defaultSortOn) {
			this.world.sortOn = cameraClass.defaultSortOn;
		}
	}

	/**
	 * Build the renderer and everything that depends on it — the canvas
	 * (appended to the parent element), the initial resize layout, and the
	 * console banner. Reads {@link Application#settings}, resolved by the
	 * constructor; it takes no arguments of its own.
	 *
	 * **Calling and awaiting this is mandatory** — it is the second half of
	 * every Application's start-up, not an optional step. It resolves
	 * synchronously for the Canvas and WebGL backends, which acquire their
	 * context without suspending — but WebGPU cannot, and an application
	 * whose `init()` has not resolved has no `renderer`.
	 * @throws {Error} if it fails to instantiate the requested renderer
	 * (e.g. `renderer: video.WEBGL` on a device with no WebGL 2 support)
	 * @returns resolves once the application is ready to use
	 * @example
	 * const app = new Application(640, 480, { parent: "screen" });
	 * await app.init();
	 */
	async init(): Promise<void> {
		if (this._destroyed) {
			throw new Error(
				"Application: this instance was destroyed — construct a new " +
					"Application instead of re-initializing it",
			);
		}
		if (this.isInitialized) {
			// a repeated call would append a second canvas and abandon the
			// live renderer — refuse it loudly but harmlessly
			console.warn("Application: init() called twice — ignoring");
			return;
		}

		// a previous init() attempt may have constructed a renderer before
		// rejecting (e.g. the WebGPU device negotiation failed) — release
		// it before building a new one, so a retry does not leak a backend
		this.renderer?.destroy();

		if (typeof this.settings.renderer === "number") {
			switch (this.settings.renderer) {
				case AUTO: {
					// WebGPU first, then WebGL 2, then Canvas. WebGPU support
					// can only be proven by negotiating an adapter/device, so
					// the attempt is a full backend init awaited here —
					// rejection falls through to the synchronous candidates
					// (autoDetectRenderer) instead of failing the application.
					let negotiated;
					if (typeof globalThis.navigator?.gpu !== "undefined") {
						const attempt = new WebGPURenderer(this.settings as any);
						attempt.parentApplication = this;
						try {
							await attempt.init();
							negotiated = attempt;
						} catch (e) {
							// release the half-built backend (listeners
							// unhook; no device was retained on rejection)
							attempt.destroy();
							console.log(
								`AUTO: WebGPU unavailable (${
									e instanceof Error ? e.message : String(e)
								}) — falling back to WebGL`,
							);
						}
					}
					this.renderer =
						negotiated ?? autoDetectRenderer(this.settings as any);
					break;
				}
				case WEBGL:
					// "I require WebGL" — fail loudly if it isn't
					// available instead of silently falling back to
					// Canvas. Camera3d, mesh rendering, ShaderEffect /
					// post-FX, GPU tilemap and Light2d all require a
					// WebGL context; falling back to Canvas would
					// produce a silently broken scene with no signal to
					// the dev about why. Use `video.AUTO` to opt into
					// the fall-back behavior explicitly.
					if (!device.isWebGLSupported(this.settings)) {
						throw new Error(
							"Application: `renderer: video.WEBGL` was requested " +
								"but a WebGL 2 context could not be created in this " +
								"environment (WebGL-1-only device, driver-blocklisted " +
								"GPU, `failIfMajorPerformanceCaveat: true` on a " +
								"software renderer, etc.). The WebGL renderer is " +
								"WebGL 2 only since 20.0. Use `video.AUTO` if Canvas " +
								"fallback is acceptable, or check " +
								"`device.isWebGLSupported()` before construction.",
						);
					}
					this.renderer = new WebGLRenderer(this.settings as any);
					break;
				case WEBGPU:
					// "I require WebGPU" — like WEBGL, an explicit request
					// either runs on WebGPU or fails; a quiet substitution
					// would make the request meaningless. Construction
					// acquires the GPUCanvasContext (throws when WebGPU is
					// unavailable, surfacing as a rejection of this method);
					// the adapter/device negotiation happens in the
					// `renderer.init()` await below. Use `video.AUTO` for
					// the WebGPU → WebGL → Canvas fallback ladder.
					this.renderer = new WebGPURenderer(this.settings as any);
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

		// the renderer carries its owning application — engine code holding
		// a renderer reference must use this rather than the global game
		this.renderer.parentApplication = this;

		// let the backend acquire whatever it cannot acquire synchronously —
		// an immediate resolve for Canvas and WebGL, the adapter/device
		// negotiation for WebGPU. This await is why `init()` is asynchronous.
		// (optional-chained so a duck-typed custom renderer that does not
		// extend `Renderer` keeps working without the new lifecycle hook)
		await this.renderer.init?.();

		// destroy() may have run while the backend was negotiating its
		// context — finishing the bootstrap now would resurrect a torn-down
		// application (re-registered listeners, an appended canvas, a live
		// GPU device nothing will ever release, and the `game` global
		// pointing at a dead app)
		if (this._destroyed) {
			this.renderer.destroy();
			throw new Error(
				"Application: destroyed while init() was awaiting the renderer — " +
					"initialization aborted",
			);
		}

		// Cross-check the chosen camera class against the renderer the
		// engine actually instantiated. Camera classes that declare
		// `static defaultSortOn = "depth"` (Camera3d and any subclass)
		// need the WebGL backend — depth attachment, projection matrix
		// uniform, `drawMesh`, frustum culling — none of which the
		// Canvas renderer provides. Catches the
		// `{ renderer: video.AUTO, cameraClass: Camera3d }` combination
		// where AUTO fell back to Canvas and the user wouldn't otherwise
		// see anything go wrong until the first frame rendered a black
		// canvas. Uses `defaultSortOn === "depth"` as the signal so
		// Application doesn't need to import the concrete Camera3d class.
		//
		// Warn (not throw) so unit-level integration tests that bypass
		// real rendering can still verify the `cameraClass → world.sortOn`
		// bootstrap wiring under Canvas without crashing. The strong
		// failure mode for users who genuinely need WebGL is to set
		// `renderer: video.WEBGL` — that throws above when WebGL is
		// unavailable, which is the right signal at construction time.
		const CameraClass = this.settings.cameraClass as
			| { defaultSortOn?: string; name?: string }
			| undefined;
		if (
			CameraClass?.defaultSortOn === "depth" &&
			!this.renderer.supportsDepthBuffer
		) {
			console.warn(
				`Application: \`cameraClass\` (${
					CameraClass.name ?? "anonymous"
				}) declares \`defaultSortOn = "depth"\` (Camera3d or subclass), ` +
					"which requires a renderer with a depth buffer — the active " +
					"renderer has none, and so has no 3D projection path and " +
					"no `drawMesh`. The scene will not " +
					"render correctly. Use `{ renderer: video.WEBGL }` (throws " +
					"if WebGL is unavailable) instead of `video.AUTO` (silently " +
					"falls back to Canvas).",
			);
		}

		// add our canvas (default to document.body if settings.parent is undefined)
		const canvas = this.renderer.getCanvas();
		// the browser default `display: inline` puts the canvas on the text
		// baseline, so an auto-sized ancestor measures canvas + baseline gap —
		// and the auto-scale resize path then re-applies that few-px excess on
		// EVERY resize event (the slow canvas-growth loop of #1231). `block`
		// removes the gap. Only applied when the canvas carries no explicit
		// inline display, so user styling stays authoritative.
		if (canvas.style.display === "") {
			canvas.style.display = "block";
		}
		this.parentElement.appendChild(canvas);

		// trigger an initial resize();
		onresize(this);

		// add an observer to detect when the dom tree is modified
		if ("MutationObserver" in globalThis) {
			// Create an observer instance linked to the callback function
			// (stored so destroy() can disconnect it — otherwise every
			// discarded Application keeps re-laying-out against a parent
			// element that outlives it)
			this._resizeObserver = new MutationObserver(() => {
				onresize(this);
			});

			// Start observing the target node for configured mutations
			this._resizeObserver.observe(this.parentElement, {
				attributes: false,
				childList: true,
				subtree: true,
			});
		}

		if (this.settings.consoleHeader) {
			consoleHeader(this);
		}

		// report the active physics adapter (wired in the constructor) —
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
					physicLabel?: string;
					version?: string;
					url?: string;
				};
				// prefer the adapter's declared name, then its stable physicLabel;
				// `constructor.name` is a last resort (it's mangled in minified
				// builds, e.g. the built-in adapter would print "physics: ry")
				const label = a.name ?? a.physicLabel ?? a.constructor.name;
				const version = a.version ? ` ${a.version}` : "";
				const url = a.url ? ` | ${a.url}` : "";
				console.log(`physics: ${label}${version}${url}`);
			} else {
				console.log("physics: enabled (no adapter)");
			}
		}

		// The GPU tilemap path needs a WebGL 2 renderer. The previous
		// "gpuTilemap is enabled but the active renderer is not WebGL 2"
		// app-init warning was emitted regardless of whether a tilemap
		// was ever loaded, so apps with no TMX layers (e.g. spine demos
		// under Canvas) got a spurious noise line. TMXLayer now emits a
		// single deferred warning the first time a layer hits the
		// no-WebGL2 fallback, so the heads-up only fires when relevant.

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

		// Only publish this instance as the default `game` once it is fully
		// usable — a constructed-but-not-initialized Application has no
		// renderer, which is precisely the half-built state this split
		// removes from the global.
		setDefaultGame(this);

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
	get sortOn(): "x" | "y" | "z" | "depth" {
		return this.world.sortOn;
	}
	set sortOn(value: "x" | "y" | "z" | "depth") {
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
	 * Returns `true` if the browser/device is currently in fullscreen mode.
	 * Thin convenience around {@link device.isFullscreen} so the
	 * fullscreen trio (`isFullscreen` / `requestFullscreen` /
	 * `exitFullscreen`) lives together on the app instance.
	 * @category Application
	 */
	isFullscreen(): boolean {
		return device.isFullscreen();
	}

	/**
	 * Trigger a fullscreen request for this application. Defaults to this
	 * application's `parentElement` (the container the canvas was appended
	 * into — see {@link Application#getParentElement}), so the canvas and
	 * any sibling HUD / overlay markup inside that container go fullscreen
	 * together.
	 * @param element - optional element to fullscreen instead of `this.parentElement`
	 * @example
	 * // bind F to toggle fullscreen
	 * me.input.bindKey(me.input.KEY.F, "toggleFullscreen");
	 * me.event.on(me.event.KEYDOWN, (action) => {
	 *   if (action === "toggleFullscreen") {
	 *     if (!app.isFullscreen()) app.requestFullscreen();
	 *     else app.exitFullscreen();
	 *   }
	 * });
	 * @category Application
	 */
	requestFullscreen(element?: Element): void {
		if (device.hasFullscreenSupport && !this.isFullscreen()) {
			const target = (element ??
				this.parentElement) as ElementWithLegacyFullscreen;
			/* eslint-disable @typescript-eslint/unbound-method -- `this` is restored explicitly via `.call(target)` below */
			const request =
				target.requestFullscreen ||
				target.webkitRequestFullscreen ||
				target.mozRequestFullScreen ||
				target.msRequestFullscreen;
			/* eslint-enable @typescript-eslint/unbound-method */
			const result = request?.call(target);
			if (result instanceof Promise) result.catch(console.error);
		}
	}

	/**
	 * Exit fullscreen mode for this application.
	 * @category Application
	 */
	exitFullscreen(): void {
		if (!device.hasFullscreenSupport || !this.isFullscreen()) return;
		const doc = globalThis.document as DocumentWithLegacyExitFullscreen;
		/* eslint-disable @typescript-eslint/unbound-method -- `this` is restored explicitly via `.call(doc)` below */
		const exit =
			doc.exitFullscreen ||
			doc.webkitExitFullscreen ||
			doc.mozCancelFullScreen ||
			doc.msExitFullscreen;
		/* eslint-enable @typescript-eslint/unbound-method */
		const result = exit?.call(doc);
		if (result instanceof Promise) result.catch(console.error);
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
	 *
	 * **Terminal**: a destroyed Application cannot be re-initialized —
	 * `init()` rejects afterwards (and an `init()` still in flight aborts).
	 * Construct a new Application to start again.
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

		// remove the melonJS-event resize subscriptions registered by the
		// constructor — without this every discarded Application instance
		// keeps fanning out on WINDOW_ONRESIZE for the page's lifetime
		if (this._doResize) {
			off(WINDOW_ONRESIZE, this._doResize);
			off(WINDOW_ONORIENTATION_CHANGE, this._doResize);
		}

		// stop watching the parent element — the observer would otherwise
		// keep re-laying-out this dead app on every DOM mutation (including
		// the canvas removal below)
		this._resizeObserver?.disconnect();
		this._resizeObserver = undefined;

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

		// tear down the renderer's batchers so their `event.on(...)`
		// subscriptions (e.g. `GPU_TEXTURE_CACHE_RESET` on
		// `MaterialBatcher`) don't leak across the disposal — every
		// otherwise-discarded `Application` would otherwise keep the
		// batchers (and their renderer reference) alive for the rest
		// of the page's lifetime.
		this.renderer?.destroy();

		// remove the canvas from the DOM
		if (removeCanvas && this.renderer) {
			const canvas = this.renderer.getCanvas();
			if (canvas.parentElement) {
				canvas.parentElement.removeChild(canvas);
			}
		}

		this.isInitialized = false;
		// terminal: init() refuses to run on this instance from here on,
		// and an init() currently awaiting its renderer aborts instead of
		// resurrecting the app
		this._destroyed = true;
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

	/**
	 * @ignore
	 * @internal
	 */
	_tick(time: number): void {
		this.update(time);
		this.draw();
	}

	/**
	 * @ignore
	 * @internal
	 */
	_onBlur(): void {
		if (this.stopOnBlur) {
			state.stop(true);
		}
		if (this.pauseOnBlur) {
			state.pause(true);
		}
	}

	/**
	 * @ignore
	 * @internal
	 */
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
				: Math.max(this.updateDelta, this.lastUpdateDelta);

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
				this.lastUpdateDelta = this.lastUpdate - this.lastUpdateStart;

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

			// The screen-space bracket `Container.draw` opens around a
			// floating child is not exception-safe: a child that throws
			// leaves the depth raised, and every later drain of the
			// transparent queue then silently skips — for the rest of the
			// session, since `reset()` only runs on a stage change. A frame is
			// the natural boundary, and by here the previous one is over.
			this.renderer.resetFrameState?.();

			// Distance fog belongs to the camera that installed it, and is
			// installed once per camera in `Camera2d.draw`. Clearing it here
			// means a frame starts with none, so anything drawn before a camera
			// gets to it cannot inherit the fog of whichever camera happened to
			// draw last — including across frames, which is where it would be
			// hardest to see.
			this.renderer.setFog(null);

			// render the stage
			state.current()!.draw(this.renderer, this.world);

			// set back to flag
			this.isDirty = false;

			// ground shadows are held back until every opaque mesh is down
			// (#1515); a scene that is nothing but meshes never switches away
			// from mesh mode, so the pass is closed here
			this.renderer.flushTransparent();

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
 * @internal
 */
export function setDefaultGame(app: Application) {
	game = app;
}
