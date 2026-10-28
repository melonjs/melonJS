import type Application from "../application/application.ts";
import { pauseTrack, resumeTrack } from "./../audio/audio.ts";
import FadeEffect from "../camera/effects/fade_effect.ts";
import MaskEffect from "../camera/effects/mask_effect.ts";
import PixelateTransitionEffect from "../camera/effects/pixelate_transition_effect.ts";
import DefaultLoadingScreen from "./../loader/loadingscreen.js";
import Stage from "./../state/stage.ts";
import {
	BLUR,
	BOOT,
	emit,
	GAME_INIT,
	on,
	once,
	STATE_CHANGE,
	STATE_PAUSE,
	STATE_RESTART,
	STATE_RESUME,
	STATE_STOP,
	TICK,
	VIDEO_INIT,
} from "../system/event.ts";
import { defer } from "../utils/function.ts";
import type Renderer from "../video/renderer.js";

interface StageEntry {
	stage: Stage;
	transition: boolean;
}

// current state
let _state: number = -1;

// requestAnimeFrame Id
let _animFrameId: number = -1;

// whether the game state is "paused"
let _isPaused: boolean = false;

// list of stages
const _stages: Record<number, StageEntry> = {};

// transition type and parameters
let _transitionType: "fade" | "mask" | "pixelate" = "fade";

const _transitionConfig: {
	color: string;
	duration: number;
	shape?:
		| import("../geometries/ellipse.ts").Ellipse
		| import("../geometries/polygon.ts").Polygon
		| undefined;
	// the largest blocks of a pixelate transition, in screen pixels
	size?: number | undefined;
} = {
	color: "",
	duration: 0,
};

// callback when state switch is done
/**
 * @ignore
 * @internal
 */
let _onSwitchComplete: (() => void) | null = null;

/**
 * The longest a state's first frame waits for its stage's warm-ups, in ms.
 *
 * The wait is normally the time the pipelines take to compile, and that
 * time is spent either way: drawing sooner only moves it into the frame,
 * where whatever is still compiling is compiled a second time. The cap is
 * for a compile that never reports back, so a state cannot be held forever.
 * Past it the stage draws, and the frame builds what is still missing, as
 * it did before there was a wait.
 * @ignore
 * @internal
 */
const MAX_WARM_HOLD = 1500;

/**
 * The end of a state switch held back until its stage's warm-ups are built
 * (see `_switchState`), or `null` when none is waiting.
 * @ignore
 * @internal
 */
let _heldSwitch: (() => void) | null = null;

// just to keep track of possible extra arguments
let _extraArgs: unknown[] | null = null;

// store the elapsed time during pause/stop period
let _pauseTime: number = 0;

// freeze() bookkeeping
let _freezeTimer: ReturnType<typeof setTimeout> | null = null;
let _freezeEndsAt: number = 0;
let _freezeMusic: boolean = false;
// whether freeze() itself performed the pause (vs. the game was already paused)
let _freezeStartedPause: boolean = false;
let _freezeResolvers: Array<() => void> = [];

/**
 * @ignore
 * @internal
 */
function _startRunLoop(): void {
	// ensure nothing is running first and in valid state
	if (_animFrameId === -1 && _state !== -1) {
		// start the main loop
		_animFrameId = globalThis.requestAnimationFrame(_renderFrame);
	}
}

/**
 * Resume the game loop after a pause.
 * @ignore
 * @internal
 */
function _resumeRunLoop(): void {
	// ensure game is actually paused and in valid state
	if (_isPaused && _state !== -1) {
		_isPaused = false;
	}
}

/**
 * Pause the loop for most stage objects.
 * @ignore
 * @internal
 */
function _pauseRunLoop(): void {
	// Set the paused boolean to stop updates on (most) entities
	/**
	 * @ignore
	 * @internal
	 */
	_isPaused = true;
}

/**
 * Drain and resolve any pending freeze() promises.
 * @ignore
 * @internal
 */
function _resolveFreezeWaiters(): void {
	const resolvers = _freezeResolvers;
	/**
	 * @ignore
	 * @internal
	 */
	_freezeResolvers = [];
	for (const resolve of resolvers) {
		resolve();
	}
}

/**
 * End an active freeze on timer expiry: optionally resume the run loop
 * (only if freeze itself performed the pause), then resolve waiters.
 * @ignore
 * @internal
 */
function _endFreeze(): void {
	/**
	 * @ignore
	 * @internal
	 */
	_freezeTimer = null;
	/**
	 * @ignore
	 * @internal
	 */
	_freezeEndsAt = 0;
	const wasOwnedPause = _freezeStartedPause;
	/**
	 * @ignore
	 * @internal
	 */
	_freezeStartedPause = false;
	if (wasOwnedPause) {
		state.resume(_freezeMusic);
	}
	_resolveFreezeWaiters();
}

/**
 * Cancel any active freeze without auto-resuming (the caller is taking over
 * pause/resume control). Clears the timer and resolves pending waiters.
 * @ignore
 * @internal
 */
function _cancelFreeze(): void {
	if (_freezeTimer !== null) {
		clearTimeout(_freezeTimer);
		_freezeTimer = null;
		_freezeEndsAt = 0;
		_freezeStartedPause = false;
		_resolveFreezeWaiters();
	}
}

/**
 * this is only called when using requestAnimFrame stuff
 * @param time - current timestamp in milliseconds
 * @ignore
 * @internal
 */
function _renderFrame(time: number): void {
	emit(TICK, time);
	// schedule the next frame update
	if (_animFrameId !== -1) {
		_animFrameId = globalThis.requestAnimationFrame(_renderFrame);
	}
}

/**
 * stop the SO main loop
 * @ignore
 * @internal
 */
function _stopRunLoop(): void {
	// first, as ending a held switch runs game code that may start the loop
	_endHeldSwitches();
	// cancel any previous animationRequestFrame
	globalThis.cancelAnimationFrame(_animFrameId);
	/**
	 * @ignore
	 * @internal
	 */
	_animFrameId = -1;
}

/**
 * End every switch still waiting to draw, without starting the loop: whoever
 * ended it decides when the loop runs again. Ended rather than dropped, so
 * its `STATE_CHANGE` is still sent and its transition still takes away the
 * cover it put up.
 *
 * Until none is left, because ending one can start another: a
 * `STATE_CHANGE` listener is free to call `state.change`, and that switch
 * may be held in turn.
 * @ignore
 * @internal
 */
function _endHeldSwitches(): void {
	while (_heldSwitch !== null) {
		const finish = _heldSwitch;
		_heldSwitch = null;
		finish();
	}
}

/**
 * start the SO main loop
 * @ignore
 * @internal
 */
function _switchState(stateId: number): void {
	// clear previous interval if any
	_stopRunLoop();

	// call the stage destroy method
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (_stages[_state]) {
		_stages[_state].stage.destroy(_app);
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (_stages[stateId]) {
		// set the global variable
		_state = stateId;

		// Taken before the reset, so it stays this switch's own: a stage may
		// change state again from its `onResetEvent`, and a change asked for
		// while this one is held sets its own.
		const onSwitchComplete = _onSwitchComplete;
		_onSwitchComplete = null;
		const finish = () => {
			try {
				// publish the state change
				emit(STATE_CHANGE);
			} finally {
				// the transition's cover comes down even if a listener throws
				onSwitchComplete?.();
			}
		};

		// call the reset function with the app reference and any extra args
		if (_extraArgs) {
			_stages[_state].stage.reset(_app, ..._extraArgs);
		} else {
			_stages[_state].stage.reset(_app);
		}

		// The first frame waits for what the stage just built to be compiled.
		// It used to draw some milliseconds later regardless, and a pipeline
		// still compiling then was compiled again, on the spot, inside that
		// frame: the warm-ups only helped when they were fast enough not to
		// be needed. Everything after the start waits with it, so the timer
		// and a transition's reveal begin on the frame that is drawn, rather
		// than having run their course behind a screen that was not.
		// Optional all the way: there is no application yet when the display
		// is brought up without one (a stub renderer in a test), and a custom
		// renderer need not extend `Renderer` (see `Application#init`).
		const renderer = (_app as Application | undefined)?.renderer as
			| Partial<Renderer>
			| undefined;
		const warmed = renderer?._whenWarmed?.();
		// a switch the stage made from its own reset may be waiting to draw
		// a stage that is no longer current: it ends here, before this one
		// takes its place
		_endHeldSwitches();
		if (warmed === undefined) {
			// nothing being built: start now, as a stage always has
			_startRunLoop();
			finish();
			return;
		}
		_heldSwitch = finish;
		let cap: ReturnType<typeof setTimeout> | undefined;
		const start = () => {
			clearTimeout(cap);
			// stopped, or replaced by another switch, while it waited
			if (_heldSwitch !== finish) {
				return;
			}
			_heldSwitch = null;
			_startRunLoop();
			finish();
		};
		// a warm-up that fails is one the draw builds on first use, as it
		// did before there was a wait: the state starts either way
		void Promise.race([
			warmed,
			new Promise<void>((resolve) => {
				cap = setTimeout(resolve, MAX_WARM_HOLD);
			}),
		]).then(start, start);
	}
}

// the active application instance
let _app: Application;

// initialize me.state on system boot
once(BOOT, () => {
	// set the built-in loading stage
	state.set(state.LOADING, new DefaultLoadingScreen());
	// set and enable the default stage
	state.set(state.DEFAULT, new Stage());
	// store the application reference when initialized
	on(GAME_INIT, (app: Application) => {
		_app = app;
	});
	// enable by default as soon as the display is initialized
	once(VIDEO_INIT, () => {
		state.change(state.DEFAULT, true);
	});
	// cancel any in-flight freeze when the window loses focus — the visual
	// hit-stop is short enough that by the time the user comes back the
	// "moment" is over. Application._onBlur still pauses the state via the
	// regular pauseOnBlur path, so the game stays paused while away.
	on(BLUR, () => {
		_cancelFreeze();
	});
});

/**
 * a State Manager (state machine)
 */
const state = {
	/**
	 * default state ID for Loading Stage
	 */
	LOADING: 0 as const,

	/**
	 * default state ID for Menu Stage
	 */
	MENU: 1 as const,

	/**
	 * default state ID for "Ready" Stage
	 */
	READY: 2 as const,

	/**
	 * default state ID for Play Stage
	 */
	PLAY: 3 as const,

	/**
	 * default state ID for Game Over Stage
	 */
	GAMEOVER: 4 as const,

	/**
	 * default state ID for Game End Stage
	 */
	GAME_END: 5 as const,

	/**
	 * default state ID for High Score Stage
	 */
	SCORE: 6 as const,

	/**
	 * default state ID for Credits Stage
	 */
	CREDITS: 7 as const,

	/**
	 * default state ID for Settings Stage
	 */
	SETTINGS: 8 as const,

	/**
	 * default state ID for the default Stage
	 * (the default stage is the one running as soon as melonJS is started)
	 */
	DEFAULT: 9 as const,

	/**
	 * default state ID for user defined constants<br>
	 * @example
	 * const STATE_INFO = state.USER + 0;
	 * const STATE_WARN = state.USER + 1;
	 * const STATE_ERROR = state.USER + 2;
	 * const STATE_CUTSCENE = state.USER + 3;
	 */
	USER: 100 as const,

	/**
	 * Stop the current stage.
	 * @param [shouldPauseTrack=false] - pause current track on screen stop.
	 */
	stop(shouldPauseTrack: boolean = false): void {
		// only stop when we are not loading stuff
		if (_state !== this.LOADING && this.isRunning()) {
			// caller is taking over — drop any in-flight freeze
			_cancelFreeze();
			// stop the main loop
			_stopRunLoop();

			// current music stop
			if (shouldPauseTrack) {
				pauseTrack();
			}

			// store time when stopped
			_pauseTime = globalThis.performance.now();

			// publish the stop notification
			emit(STATE_STOP);
		}
	},

	/**
	 * pause the current stage
	 * @param [music=false] - pause current music track on screen pause
	 */
	pause(music: boolean = false): void {
		// only pause when we are not loading stuff
		if (_state !== this.LOADING && !this.isPaused()) {
			// stop the main loop
			_pauseRunLoop();
			// current music stop
			if (music) {
				pauseTrack();
			}

			// store time when paused
			_pauseTime = globalThis.performance.now();

			// publish the pause event
			emit(STATE_PAUSE);
		}
	},

	/**
	 * Restart the current stage from a full stop.
	 * @param [music=false] - resume current music track on screen resume
	 */
	restart(music: boolean = false): void {
		if (!this.isRunning()) {
			// restart the main loop
			_startRunLoop();
			// current music stop
			if (music) {
				resumeTrack();
			}

			// calculate the elpased time
			_pauseTime = globalThis.performance.now() - _pauseTime;

			// publish the restart notification
			emit(STATE_RESTART, _pauseTime);
		}
	},

	/**
	 * resume the current stage
	 * @param [music=false] - resume current music track on screen resume
	 */
	resume(music: boolean = false): void {
		if (this.isPaused()) {
			// caller is taking over — drop any in-flight freeze
			_cancelFreeze();
			// resume the main loop
			_resumeRunLoop();
			// current music stop
			if (music) {
				resumeTrack();
			}

			// calculate the elpased time
			_pauseTime = globalThis.performance.now() - _pauseTime;

			// publish the resume event
			emit(STATE_RESUME, _pauseTime);
		}
	},

	/**
	 * Freeze the current stage for a fixed duration, then automatically resume.
	 * Useful for hit-stop / hit-pause effects on impact.
	 *
	 * Behaviour notes:
	 * - If `freeze()` is called again while a freeze is already active, the
	 *   freeze is *extended* to whichever end-time is later (calls do not
	 *   stack). The `music` flag from the initial call is preserved.
	 * - If the game was already paused when `freeze()` was called, the freeze
	 *   timer will *not* unpause it on expiry — the game stays paused.
	 * - Calling `state.resume()` or `state.stop()` while a freeze is active
	 *   cancels the timer and resolves the returned promise immediately.
	 * - The freeze is also cancelled when the window loses focus (BLUR) since
	 *   the hit-stop's "moment" is short enough that the user has missed it
	 *   by the time they return. The regular `pauseOnBlur` behaviour still
	 *   keeps the game paused while away.
	 * - Negative, `NaN`, and `Infinity` durations silently no-op.
	 * @param duration - duration of the freeze in milliseconds
	 * @param [music=false] - also pause the current music track during the freeze
	 * @returns a Promise that resolves once the freeze ends (or is cancelled)
	 * @example
	 * // simple hit-stop on impact
	 * state.freeze(80);
	 *
	 * // chain VFX after the freeze
	 * await state.freeze(120);
	 * spawnImpactParticles();
	 */
	freeze(duration: number, music: boolean = false): Promise<void> {
		// guard against NaN, Infinity, and negative durations — silently no-op
		// (mirrors how state.pause/resume quietly ignore invalid states)
		if (!Number.isFinite(duration) || duration < 0) {
			return Promise.resolve();
		}
		const now = globalThis.performance.now();
		const newEndsAt = now + duration;

		if (_freezeTimer !== null) {
			// already frozen: only extend if the new end-time is later
			if (newEndsAt > _freezeEndsAt) {
				clearTimeout(_freezeTimer);
				_freezeEndsAt = newEndsAt;
				_freezeTimer = setTimeout(_endFreeze, newEndsAt - now);
			}
		} else {
			// start a new freeze
			_freezeMusic = music;
			_freezeEndsAt = newEndsAt;
			// only own the pause if the game wasn't already paused — that way
			// _endFreeze() won't unpause a manually-paused game on timer expiry
			_freezeStartedPause = !this.isPaused();
			if (_freezeStartedPause) {
				this.pause(music);
			}
			_freezeTimer = setTimeout(_endFreeze, duration);
		}

		return new Promise<void>((resolve) => {
			_freezeResolvers.push(resolve);
		});
	},

	/**
	 * return the running state of the state manager
	 * @returns true if a "process is running"
	 */
	isRunning(): boolean {
		// a switch waiting for its stage's warm-ups is running, about to draw
		return _animFrameId !== -1 || _heldSwitch !== null;
	},

	/**
	 * Return the pause state of the state manager
	 * @returns true if the game is paused
	 */
	isPaused(): boolean {
		return _isPaused;
	},

	/**
	 * associate the specified state with a Stage
	 * @param stateId - State ID (see constants)
	 * @param stage - Instantiated Stage to associate with state ID
	 * @param [start = false] - if true the state will be changed immediately after adding it.
	 * @example
	 * class MenuScreen extends Stage {
	 *     onResetEvent(app) {
	 *         // Load background image
	 *         app.world.addChild(
	 *             new ImageLayer(0, 0, {
	 *                 image : "bg",
	 *                 z: 0 // z-index
	 *             })
	 *         );
	 *
	 *         // Play music
	 *         audio.playTrack("menu");
	 *     }
	 *
	 *     onDestroyEvent() {
	 *         // Stop music
	 *         audio.stopTrack();
	 *     }
	 * }
	 *
	 * state.set(state.MENU, new MenuScreen());
	 */
	set(stateId: number, stage: Stage, start: boolean = false): void {
		if (!(stage instanceof Stage)) {
			throw new Error(`${String(stage)} is not an instance of me.Stage`);
		}
		_stages[stateId] = {
			stage,
			transition: true,
		};

		if (start) {
			this.change(stateId);
		}
	},

	/**
	 * returns the stage associated with the specified state
	 * (or the current one if none is specified)
	 * @param [stateId] - State ID (see constants)
	 * @returns the Stage instance associated with the given state ID, or undefined
	 */
	get(stateId: number = _state): Stage | undefined {
		if (typeof _stages[stateId] !== "undefined") {
			return _stages[stateId].stage;
		} else {
			return undefined;
		}
	},

	/**
	 * return a reference to the current stage<br>
	 * useful to call a object specific method
	 * @returns the current Stage instance, or undefined if no stage is active
	 */
	current(): Stage | undefined {
		return this.get();
	},

	/**
	 * specify a global transition effect
	 * @param effect - "fade" for a color fade, "mask" for a shape-based mask
	 * transition, "pixelate" for the screen breaking up into ever larger
	 * blocks, changing behind the largest, and coming back sharp (see
	 * {@link PixelateTransitionEffect}). A pixelate transition is a shader
	 * effect: on the Canvas renderer it does nothing, and the state changes
	 * directly.
	 * @param color - a CSS color value (not used by "pixelate")
	 * @param [duration=1000] - expressed in milliseconds, for each half: the
	 * cover, then the reveal
	 * @param [shape] - an Ellipse or Polygon defining the mask shape (required
	 * when effect is "mask"), or for "pixelate" the size of the largest
	 * blocks, in screen pixels (32 by default)
	 * @example
	 * // classic fade to black
	 * state.transition("fade", "#000", 500);
	 * @example
	 * // iris (circle) mask transition
	 * state.transition("mask", "#000", 500, new Ellipse(0, 0, 1, 1));
	 * @example
	 * // diamond mask transition
	 * state.transition("mask", "#000", 400, new Polygon(0, 0, [
	 *     { x: 0, y: -1 }, { x: 1, y: 0 },
	 *     { x: 0, y: 1 }, { x: -1, y: 0 },
	 * ]));
	 * @example
	 * // the screen breaks up into 32 pixel blocks, and comes back
	 * state.transition("pixelate", "#000", 300);
	 * // into 16 pixel blocks
	 * state.transition("pixelate", "#000", 300, 16);
	 */
	transition(
		effect: "fade" | "mask" | "pixelate",
		color: string,
		duration: number = 1000,
		shape?:
			| import("../geometries/ellipse.ts").Ellipse
			| import("../geometries/polygon.ts").Polygon
			| number,
	): void {
		_transitionType = effect;
		_transitionConfig.color = color;
		_transitionConfig.duration = duration;
		_transitionConfig.shape = typeof shape === "number" ? undefined : shape;
		_transitionConfig.size = typeof shape === "number" ? shape : undefined;
	},

	/**
	 * enable/disable the transition to a particular state (by default enabled for all)
	 * @param stateId - State ID (see constants)
	 * @param enable - true to enable transition, false to disable
	 */
	setTransition(stateId: number, enable: boolean): void {
		_stages[stateId].transition = enable;
	},

	/**
	 * change the game/app state
	 * @param stateId - State ID (see constants)
	 * @param [forceChange=false] - if true the state will be changed immediately (without waiting for the next frame)
	 * @param extraArgs - extra arguments to be passed to the reset functions
	 * @example
	 * // The onResetEvent method on the play screen will receive two args:
	 * // "level_1" and the number 3
	 * state.change(state.PLAY, false, "level_1", 3);
	 */
	change(
		stateId: number,
		forceChange: boolean = false,
		...extraArgs: unknown[]
	): void {
		// Protect against undefined Stage
		if (typeof _stages[stateId] === "undefined") {
			throw new Error(`Undefined Stage for state '${stateId}'`);
		}

		// do nothing if already the current state
		if (!this.isCurrent(stateId)) {
			// store extra arguments if any
			_extraArgs = extraArgs.length > 0 ? extraArgs : null;
			// apply transition effect if configured
			if (_transitionConfig.duration && _stages[stateId].transition) {
				const onComplete = () => {
					defer(_switchState, state, stateId);
				};

				switch (_transitionType) {
					case "fade": {
						const color = _transitionConfig.color;
						const duration = _transitionConfig.duration;
						const fadeEffect = new FadeEffect(_app.viewport, {
							color,
							duration,
							direction: "in",
							onComplete,
						});
						// Persistent, so the camera keeps it after it has
						// completed and through the stage reset: it is what
						// holds the screen covered across the deferred switch.
						// Taken away here, by its owner, which is what a
						// persistent effect means.
						fadeEffect.isPersistent = true;
						const hidCamera = _app.viewport;
						_onSwitchComplete = () => {
							// the camera it was ADDED to, which a stage is
							// free to have replaced by now
							hidCamera.removeCameraEffect(fadeEffect);
							// create reveal with the post-switch viewport
							_app.viewport.addCameraEffect(
								new FadeEffect(_app.viewport, {
									color,
									duration,
									direction: "out",
								}),
							);
						};
						_app.viewport.addCameraEffect(fadeEffect);
						break;
					}
					case "mask": {
						if (!_transitionConfig.shape) {
							console.warn(
								"melonJS: mask transition requires a shape, falling back to direct switch",
							);
							onComplete();
							break;
						}
						const shape = _transitionConfig.shape;
						const color = _transitionConfig.color;
						const duration = _transitionConfig.duration;
						const maskEffect = new MaskEffect(_app.viewport, {
							shape,
							color,
							duration,
							direction: "hide",
							onComplete,
						});
						// see the note in the fade case: persistent is what
						// keeps the closed iris on screen until the switch
						// lands, and the owner is what takes it away again
						maskEffect.isPersistent = true;
						const hidCamera = _app.viewport;
						_onSwitchComplete = () => {
							hidCamera.removeCameraEffect(maskEffect);
							// create reveal with the post-switch viewport
							_app.viewport.addCameraEffect(
								new MaskEffect(_app.viewport, {
									shape,
									color,
									duration,
									direction: "reveal",
								}),
							);
						};
						_app.viewport.addCameraEffect(maskEffect);
						break;
					}
					case "pixelate": {
						// a shader: on a renderer without them (Canvas) it does
						// nothing, and the state changes directly
						if (_app.renderer.shaderLanguage === null) {
							onComplete();
							break;
						}
						const renderer = _app.renderer;
						const size = _transitionConfig.size;
						const duration = _transitionConfig.duration;
						const coverEffect = new PixelateTransitionEffect(_app.viewport, {
							renderer,
							size,
							duration,
							direction: "hide",
							onComplete,
						});
						// see the note in the fade case: persistent is what
						// keeps the largest blocks on screen until the switch
						// lands, and the owner is what takes them away again
						coverEffect.isPersistent = true;
						const hidCamera = _app.viewport;
						_onSwitchComplete = () => {
							hidCamera.removeCameraEffect(coverEffect);
							// create reveal with the post-switch viewport
							_app.viewport.addCameraEffect(
								new PixelateTransitionEffect(_app.viewport, {
									renderer,
									size,
									duration,
									direction: "reveal",
								}),
							);
						};
						_app.viewport.addCameraEffect(coverEffect);
						break;
					}
					default:
						throw new Error(
							`Invalid transition type: ${_transitionType as string}`,
						);
				}
			}
			// no transition — switch directly
			else {
				// wait for the last frame to be
				// "finished" before switching
				if (forceChange) {
					_switchState(stateId);
				} else {
					defer(_switchState, this, stateId);
				}
			}
		}
	},

	/**
	 * return true if the specified state is the current one
	 * @param stateId - State ID (see constants)
	 * @returns true if the specified state is the current one
	 */
	isCurrent(stateId: number): boolean {
		return _state === stateId;
	},
};
export default state;
