import type Application from "../application/application.ts";
import { pauseTrack, resumeTrack } from "./../audio/audio.ts";
import DefaultLoadingScreen from "./../loader/loadingscreen.js";
import Stage from "./../state/stage.js";
import {
	BOOT,
	emit,
	GAME_INIT,
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

/**
 * @import {Color} from "./../math/color.ts";
 */

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

// fading transition parameters between screen
const _fade: { color: string; duration: number } = {
	color: "",
	duration: 0,
};

// callback when state switch is done
/** @ignore */
let _onSwitchComplete: (() => void) | null = null;

// just to keep track of possible extra arguments
let _extraArgs: unknown[] | null = null;

// store the elapsed time during pause/stop period
let _pauseTime: number = 0;

/**
 * @ignore
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
 */
function _pauseRunLoop(): void {
	// Set the paused boolean to stop updates on (most) entities
	_isPaused = true;
}

/**
 * this is only called when using requestAnimFrame stuff
 * @param time - current timestamp in milliseconds
 * @ignore
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
 */
function _stopRunLoop(): void {
	// cancel any previous animationRequestFrame
	globalThis.cancelAnimationFrame(_animFrameId);
	_animFrameId = -1;
}

/**
 * start the SO main loop
 * @ignore
 */
function _switchState(stateId: number): void {
	// clear previous interval if any
	_stopRunLoop();

	// call the stage destroy method
	if (_stages[_state]) {
		// just notify the object
		_stages[_state].stage.destroy();
	}

	if (_stages[stateId]) {
		// set the global variable
		_state = stateId;

		// call the reset function with the app reference and any extra args
		if (_extraArgs) {
			_stages[_state].stage.reset(_app, ..._extraArgs);
		} else {
			_stages[_state].stage.reset(_app);
		}

		// and start the main loop of the
		// new requested state
		_startRunLoop();

		// publish the pause event
		emit(STATE_CHANGE);

		// execute callback if defined
		if (_onSwitchComplete) {
			_onSwitchComplete();
		}
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
	once(GAME_INIT, (app: Application) => {
		_app = app;
	});
	// enable by default as soon as the display is initialized
	once(VIDEO_INIT, () => {
		state.change(state.DEFAULT, true);
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
	 * let STATE_INFO = me.state.USER + 0;
	 * let STATE_WARN = me.state.USER + 1;
	 * let STATE_ERROR = me.state.USER + 2;
	 * let STATE_CUTSCENE = me.state.USER + 3;
	 */
	USER: 100 as const,

	/**
	 * Stop the current stage.
	 * @param [shouldPauseTrack=false] - pause current track on screen stop.
	 */
	stop(shouldPauseTrack: boolean = false): void {
		// only stop when we are not loading stuff
		if (_state !== this.LOADING && this.isRunning()) {
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
	 * return the running state of the state manager
	 * @returns true if a "process is running"
	 */
	isRunning(): boolean {
		return _animFrameId !== -1;
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
	 * class MenuButton extends me.GUI_Object {
	 *     onClick() {
	 *         // Change to the PLAY state when the button is clicked
	 *         me.state.change(me.state.PLAY);
	 *         return true;
	 *     }
	 * };
	 *
	 * class MenuScreen extends me.Stage {
	 *     onResetEvent() {
	 *         // Load background image
	 *         me.game.world.addChild(
	 *             new me.ImageLayer(0, 0, {
	 *                 image : "bg",
	 *                 z: 0 // z-index
	 *             }
	 *         );
	 *
	 *         // Add a button
	 *         me.game.world.addChild(
	 *             new MenuButton(350, 200, { "image" : "start" }),
	 *             1 // z-index
	 *         );
	 *
	 *         // Play music
	 *         me.audio.playTrack("menu");
	 *     }
	 *
	 *     onDestroyEvent() {
	 *         // Stop music
	 *         me.audio.stopTrack();
	 *     }
	 * };
	 *
	 * me.state.set(me.state.MENU, new MenuScreen());
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
	 * @param effect - (only "fade" is supported for now)
	 * @param color - a CSS color value
	 * @param [duration=1000] - expressed in milliseconds
	 */
	transition(effect: string, color: string, duration: number): void {
		if (effect === "fade") {
			_fade.color = color;
			_fade.duration = duration;
		}
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
	 * me.state.change(me.state.PLAY, "level_1", 3);
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
			// if fading effect
			if (_fade.duration && _stages[stateId].transition) {
				_onSwitchComplete = () => {
					_app.viewport.fadeOut(_fade.color, _fade.duration);
				};
				_app.viewport.fadeIn(
					_fade.color,
					_fade.duration,
					function (this: typeof state) {
						defer(
							_switchState as unknown as (...args: unknown[]) => unknown,
							this,
							stateId,
						);
					},
				);
			}
			// else just switch without any effects
			else {
				// wait for the last frame to be
				// "finished" before switching
				if (forceChange) {
					_switchState(stateId);
				} else {
					defer(
						_switchState as unknown as (...args: unknown[]) => unknown,
						this,
						stateId,
					);
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
