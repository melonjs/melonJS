/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { pauseTrack, resumeTrack } from '../audio/audio.js';
import { defer } from '../utils/function.js';
import { once, VIDEO_INIT, BOOT, emit, STATE_STOP, STATE_PAUSE, STATE_RESTART, STATE_RESUME, STATE_CHANGE, TICK } from '../system/event.js';
import { game } from '../index.js';
import Stage from './stage.js';
import DefaultLoadingScreen from '../loader/loadingscreen.js';

// current state
let _state = -1;

// requestAnimeFrame Id
let _animFrameId = -1;

// whether the game state is "paused"
let _isPaused = false;

// list of stages
let _stages = {};

// fading transition parameters between screen
let _fade = {
    color : "",
    duration : 0
};

// callback when state switch is done
/** @ignore */
let _onSwitchComplete = null;

// just to keep track of possible extra arguments
let _extraArgs = null;

// store the elapsed time during pause/stop period
let _pauseTime = 0;

/**
 * @ignore
 */
function _startRunLoop() {
    // ensure nothing is running first and in valid state
    if ((_animFrameId === -1) && (_state !== -1)) {
        // start the main loop
        _animFrameId = globalThis.requestAnimationFrame(_renderFrame);
    }
}

/**
 * Resume the game loop after a pause.
 * @ignore
 */
function _resumeRunLoop() {
    // ensure game is actually paused and in valid state
    if (_isPaused && (_state !== -1)) {
        _isPaused = false;
    }
}

/**
 * Pause the loop for most stage objects.
 * @ignore
 */
function _pauseRunLoop() {
    // Set the paused boolean to stop updates on (most) entities
    _isPaused = true;
}

/**
 * this is only called when using requestAnimFrame stuff
 * @param {number} time - current timestamp in milliseconds
 * @ignore
 */
function _renderFrame(time) {
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
function _stopRunLoop() {
    // cancel any previous animationRequestFrame
    globalThis.cancelAnimationFrame(_animFrameId);
    _animFrameId = -1;
}

/**
 * start the SO main loop
 * @ignore
 */
function _switchState(state) {
    // clear previous interval if any
    _stopRunLoop();

    // call the stage destroy method
    if (_stages[_state]) {
        // just notify the object
        _stages[_state].stage.destroy();
    }

    if (_stages[state]) {
        // set the global variable
        _state = state;

        // call the reset function with _extraArgs as arguments
        _stages[_state].stage.reset.apply(_stages[_state].stage, _extraArgs);

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

// initialize me.state on system boot
once(BOOT, () => {
    // set the built-in loading stage
    state.set(state.LOADING, new DefaultLoadingScreen());
    // set and enable the default stage
    state.set(state.DEFAULT, new Stage());
    // enable by default as soon as the display is initialized
    once(VIDEO_INIT, () => {
        state.change(state.DEFAULT, true);
    });
});

/**
 * a State Manager (state machine)
 * @namespace state
 */
let state = {

    /**
     * default state ID for Loading Stage
     * @constant
     * @name LOADING
     * @memberof state
     */
    LOADING : 0,

    /**
     * default state ID for Menu Stage
     * @constant
     * @name MENU
     * @memberof state
     */
    MENU : 1,

    /**
     * default state ID for "Ready" Stage
     * @constant
     * @name READY
     * @memberof state
     */
    READY : 2,

    /**
     * default state ID for Play Stage
     * @constant
     * @name PLAY
     * @memberof state
     */
    PLAY : 3,

    /**
     * default state ID for Game Over Stage
     * @constant
     * @name GAMEOVER
     * @memberof state
     */
    GAMEOVER : 4,

    /**
     * default state ID for Game End Stage
     * @constant
     * @name GAME_END
     * @memberof state
     */
    GAME_END : 5,

    /**
     * default state ID for High Score Stage
     * @constant
     * @name SCORE
     * @memberof state
     */
    SCORE : 6,

    /**
     * default state ID for Credits Stage
     * @constant
     * @name CREDITS
     * @memberof state
     */
    CREDITS : 7,

    /**
     * default state ID for Settings Stage
     * @constant
     * @name SETTINGS
     * @memberof state
     */
    SETTINGS : 8,

    /**
     * default state ID for the default Stage
     * (the default stage is the one running as soon as melonJS is started)
     * @constant
     * @name DEFAULT
     * @memberof state
     */
    DEFAULT : 9,

    /**
     * default state ID for user defined constants<br>
     * @constant
     * @name USER
     * @memberof state
     * @example
     * let STATE_INFO = me.state.USER + 0;
     * let STATE_WARN = me.state.USER + 1;
     * let STATE_ERROR = me.state.USER + 2;
     * let STATE_CUTSCENE = me.state.USER + 3;
     */
    USER : 100,

    /**
     * Stop the current stage.
     * @name stop
     * @memberof state
     * @public
     * @param {boolean} [pauseTrack=false] - pause current track on screen stop.
     */
    stop(pauseTrack = false) {
        // only stop when we are not loading stuff
        if ((_state !== this.LOADING) && this.isRunning()) {
            // stop the main loop
            _stopRunLoop();

            // current music stop
            if (pauseTrack === true) {
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
     * @name pause
     * @memberof state
     * @public
     * @param {boolean} [music=false] - pause current music track on screen pause
     */
    pause(music = false) {
        // only pause when we are not loading stuff
        if ((_state !== this.LOADING) && !this.isPaused()) {
            // stop the main loop
            _pauseRunLoop();
            // current music stop
            if (music === true) {
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
     * @name restart
     * @memberof state
     * @public
     * @param {boolean} [music=false] - resume current music track on screen resume
     */
    restart(music = false) {
        if (!this.isRunning()) {
            // restart the main loop
            _startRunLoop();
            // current music stop
            if (music === true) {
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
     * @name resume
     * @memberof state
     * @public
     * @param {boolean} [music=false] - resume current music track on screen resume
     */
    resume(music = false) {
        if (this.isPaused()) {
            // resume the main loop
            _resumeRunLoop();
            // current music stop
            if (music === true) {
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
     * @name isRunning
     * @memberof state
     * @public
     * @returns {boolean} true if a "process is running"
     */
    isRunning() {
        return _animFrameId !== -1;
    },

    /**
     * Return the pause state of the state manager
     * @name isPaused
     * @memberof state
     * @public
     * @returns {boolean} true if the game is paused
     */
    isPaused() {
        return _isPaused;
    },

    /**
     * associate the specified state with a Stage
     * @name set
     * @memberof state
     * @public
     * @param {number} state - State ID (see constants)
     * @param {Stage} stage - Instantiated Stage to associate with state ID
     * @param {boolean} [start = false] - if true the state will be changed immediately after adding it.
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
    set(state, stage, start = false) {
        if (!(stage instanceof Stage)) {
            throw new Error(stage + " is not an instance of me.Stage");
        }
        _stages[state] = {};
        _stages[state].stage = stage;
        _stages[state].transition = true;

        if (start === true) {
            this.change(state);
        }
    },

    /**
     * returns the stage associated with the specified state
     * (or the current one if none is specified)
     * @name set
     * @memberof state
     * @public
     * @param {number} [state] - State ID (see constants)
     * @returns {Stage}
     */
    get(state = _state) {
        if (typeof _stages[state] !== "undefined") {
            return _stages[state].stage;
        } else {
            return undefined;
        }

    },

    /**
     * return a reference to the current stage<br>
     * useful to call a object specific method
     * @name current
     * @memberof state
     * @public
     * @returns {Stage}
     */
    current() {
        return this.get();
    },

    /**
     * specify a global transition effect
     * @name transition
     * @memberof state
     * @public
     * @param {string} effect - (only "fade" is supported for now)
     * @param {Color|string} color - a CSS color value
     * @param {number} [duration=1000] - expressed in milliseconds
     */
    transition(effect, color, duration) {
        if (effect === "fade") {
            _fade.color = color;
            _fade.duration = duration;
        }
    },

    /**
     * enable/disable the transition to a particular state (by default enabled for all)
     * @name setTransition
     * @memberof state
     * @public
     * @param {number} state - State ID (see constants)
     * @param {boolean} enable
     */
    setTransition(state, enable) {
        _stages[state].transition = enable;
    },

    /**
     * change the game/app state
     * @name change
     * @memberof state
     * @public
     * @param {number} state - State ID (see constants)
     * @param {boolean} forceChange - if true the state will be changed immediately
     * @param {...*} [args] - extra arguments to be passed to the reset functions
     * @example
     * // The onResetEvent method on the play screen will receive two args:
     * // "level_1" and the number 3
     * me.state.change(me.state.PLAY, "level_1", 3);
     */
    change(state, forceChange) {
        // Protect against undefined Stage
        if (typeof(_stages[state]) === "undefined") {
            throw new Error("Undefined Stage for state '" + state + "'");
        }

        // do nothing if already the current state
        if (!this.isCurrent(state)) {
            _extraArgs = null;
            if (arguments.length > 1) {
                // store extra arguments if any
                _extraArgs = Array.prototype.slice.call(arguments, 1);
            }
            // if fading effect
            if (_fade.duration && _stages[state].transition) {
                _onSwitchComplete = () => {
                    game.viewport.fadeOut(_fade.color, _fade.duration);
                };
                game.viewport.fadeIn(
                    _fade.color,
                    _fade.duration,
                    function () {
                        defer(_switchState, this, state);
                    }
                );

            }
            // else just switch without any effects
            else {
                // wait for the last frame to be
                // "finished" before switching
                if (forceChange === true) {
                    _switchState(state);
                } else {
                    defer(_switchState, this, state);
                }
            }
        }
    },

    /**
     * return true if the specified state is the current one
     * @name isCurrent
     * @memberof state
     * @public
     * @param {number} state - State ID (see constants)
     * @returns {boolean} true if the specified state is the current one
     */
    isCurrent(state) {
        return _state === state;
    }

};

export { state as default };
