import audio from "./../audio/audio.js";
import utils from "./../utils/utils.js";
import event from "./../system/event.js";
import timer from "./../system/timer.js";
import game from "./../game.js";
import Stage from "./../state/stage.js";
import defaultLoadingScreen from "./../loader/loadingscreen.js";


// current state
var _state = -1;

// requestAnimeFrame Id
var _animFrameId = -1;

// whether the game state is "paused"
var _isPaused = false;

// list of stages
var _stages = {};

// fading transition parameters between screen
var _fade = {
    color : "",
    duration : 0
};

// callback when state switch is done
/** @ignore */
var _onSwitchComplete = null;

// just to keep track of possible extra arguments
var _extraArgs = null;

// store the elapsed time during pause/stop period
var _pauseTime = 0;

/**
 * @ignore
 */
function _startRunLoop() {
    // ensure nothing is running first and in valid state
    if ((_animFrameId === -1) && (_state !== -1)) {
        // reset the timer
        timer.reset();

        // start the main loop
        _animFrameId = window.requestAnimationFrame(_renderFrame);
    }
}

/**
 * Resume the game loop after a pause.
 * @ignore
 */
function _resumeRunLoop() {
    // ensure game is actually paused and in valid state
    if (_isPaused && (_state !== -1)) {
        // reset the timer
        timer.reset();

        _isPaused = false;
    }
}

/**
 * Pause the loop for most screen objects.
 * @ignore
 */
function _pauseRunLoop() {
    // Set the paused boolean to stop updates on (most) entities
    _isPaused = true;
}

/**
 * this is only called when using requestAnimFrame stuff
 * @param {Number} time current timestamp in milliseconds
 * @ignore
 */
function _renderFrame(time) {
    var stage = _stages[_state].stage;
    // update all game objects
    game.update(time, stage);
    // render all game objects
    game.draw(stage);
    // schedule the next frame update
    if (_animFrameId !== -1) {
        _animFrameId = window.requestAnimationFrame(_renderFrame);
    }
}

/**
 * stop the SO main loop
 * @ignore
 */
function _stopRunLoop() {
    // cancel any previous animationRequestFrame
    window.cancelAnimationFrame(_animFrameId);
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

        // execute callback if defined
        if (_onSwitchComplete) {
            _onSwitchComplete();
        }

        // force repaint
        game.repaint();
    }
}


/**
 * a State Manager (state machine)
 * @namespace state
 * @memberOf me
 */

var state = {

    /**
     * default state ID for Loading Stage
     * @constant
     * @name LOADING
     * @memberOf me.state
     */
    LOADING : 0,

    /**
     * default state ID for Menu Stage
     * @constant
     * @name MENU
     * @memberOf me.state
     */
    MENU : 1,

    /**
     * default state ID for "Ready" Stage
     * @constant
     * @name READY
     * @memberOf me.state
     */
    READY : 2,

    /**
     * default state ID for Play Stage
     * @constant
     * @name PLAY
     * @memberOf me.state
     */
    PLAY : 3,

    /**
     * default state ID for Game Over Stage
     * @constant
     * @name GAMEOVER
     * @memberOf me.state
     */
    GAMEOVER : 4,

    /**
     * default state ID for Game End Stage
     * @constant
     * @name GAME_END
     * @memberOf me.state
     */
    GAME_END : 5,

    /**
     * default state ID for High Score Stage
     * @constant
     * @name SCORE
     * @memberOf me.state
     */
    SCORE : 6,

    /**
     * default state ID for Credits Stage
     * @constant
     * @name CREDITS
     * @memberOf me.state
     */
    CREDITS : 7,

    /**
     * default state ID for Settings Stage
     * @constant
     * @name SETTINGS
     * @memberOf me.state
     */
    SETTINGS : 8,

    /**
     * default state ID for the default Stage
     * (the default stage is the one running as soon as melonJS is started)
     * @constant
     * @name SETTINGS
     * @memberOf me.state
     */
    DEFAULT : 9,

    /**
     * default state ID for user defined constants<br>
     * @constant
     * @name USER
     * @memberOf me.state
     * @example
     * var STATE_INFO = me.state.USER + 0;
     * var STATE_WARN = me.state.USER + 1;
     * var STATE_ERROR = me.state.USER + 2;
     * var STATE_CUTSCENE = me.state.USER + 3;
     */
    USER : 100,

    /**
     * onPause callback
     * @function
     * @name onPause
     * @memberOf me.state
     */
    onPause : null,

    /**
     * onResume callback
     * @function
     * @name onResume
     * @memberOf me.state
     */
    onResume : null,

    /**
     * onStop callback
     * @function
     * @name onStop
     * @memberOf me.state
     */
    onStop : null,

    /**
     * onRestart callback
     * @function
     * @name onRestart
     * @memberOf me.state
     */
    onRestart : null,

    /**
     * @ignore
     */
    init() {
        // set the built-in loading stage
        this.set(this.LOADING, defaultLoadingScreen);
        // set and enable the default stage
        this.set(this.DEFAULT, new Stage());
        // enable by default as soon as the display is initialized
        var _state = this;
        event.subscribe(event.VIDEO_INIT, function () {
            _state.change(_state.DEFAULT, true);
        });
    },

    /**
     * Stop the current screen object.
     * @name stop
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} pauseTrack pause current track on screen stop.
     */
    stop(music) {
        // only stop when we are not loading stuff
        if ((_state !== this.LOADING) && this.isRunning()) {
            // stop the main loop
            _stopRunLoop();
            // current music stop
            if (music === true) {
                audio.pauseTrack();
            }

            // store time when stopped
            _pauseTime = window.performance.now();

            // publish the stop notification
            event.publish(event.STATE_STOP);
            // any callback defined ?
            if (typeof(this.onStop) === "function") {
                this.onStop();
            }
        }
    },

    /**
     * pause the current screen object
     * @name pause
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} pauseTrack pause current track on screen pause
     */
    pause(music) {
        // only pause when we are not loading stuff
        if ((_state !== this.LOADING) && !this.isPaused()) {
            // stop the main loop
            _pauseRunLoop();
            // current music stop
            if (music === true) {
                audio.pauseTrack();
            }

            // store time when paused
            _pauseTime = window.performance.now();

            // publish the pause event
            event.publish(event.STATE_PAUSE);
            // any callback defined ?
            if (typeof(this.onPause) === "function") {
                this.onPause();
            }
        }
    },

    /**
     * Restart the screen object from a full stop.
     * @name restart
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} resumeTrack resume current track on screen resume
     */
    restart(music) {
        if (!this.isRunning()) {
            // restart the main loop
            _startRunLoop();
            // current music stop
            if (music === true) {
                audio.resumeTrack();
            }

            // calculate the elpased time
            _pauseTime = window.performance.now() - _pauseTime;

            // force repaint
            game.repaint();

            // publish the restart notification
            event.publish(event.STATE_RESTART, [ _pauseTime ]);
            // any callback defined ?
            if (typeof(this.onRestart) === "function") {
                this.onRestart();
            }
        }
    },

    /**
     * resume the screen object
     * @name resume
     * @memberOf me.state
     * @public
     * @function
     * @param {Boolean} resumeTrack resume current track on screen resume
     */
    resume(music) {
        if (this.isPaused()) {
            // resume the main loop
            _resumeRunLoop();
            // current music stop
            if (music === true) {
                audio.resumeTrack();
            }

            // calculate the elpased time
            _pauseTime = window.performance.now() - _pauseTime;

            // publish the resume event
            event.publish(event.STATE_RESUME, [ _pauseTime ]);
            // any callback defined ?
            if (typeof(this.onResume) === "function") {
                this.onResume();
            }
        }
    },

    /**
     * return the running state of the state manager
     * @name isRunning
     * @memberOf me.state
     * @public
     * @function
     * @return {Boolean} true if a "process is running"
     */
    isRunning() {
        return _animFrameId !== -1;
    },

    /**
     * Return the pause state of the state manager
     * @name isPaused
     * @memberOf me.state
     * @public
     * @function
     * @return {Boolean} true if the game is paused
     */
    isPaused() {
        return _isPaused;
    },

    /**
     * associate the specified state with a Stage
     * @name set
     * @memberOf me.state
     * @public
     * @function
     * @param {Number} state State ID (see constants)
     * @param {me.Stage} stage Instantiated Stage to associate with state ID
     * @param {Boolean} [start = false] if true the state will be changed immediately after adding it.
     * @example
     * var MenuButton = me.GUI_Object.extend({
     *     "onClick" : function () {
     *         // Change to the PLAY state when the button is clicked
     *         me.state.change(me.state.PLAY);
     *         return true;
     *     }
     * });
     *
     * var MenuScreen = me.Stage.extend({
     *     onResetEvent: function() {
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
     *     },
     *
     *     "onDestroyEvent" : function () {
     *         // Stop music
     *         me.audio.stopTrack();
     *     }
     * });
     *
     * me.state.set(me.state.MENU, new MenuScreen());
     */
    set(state, stage, start) {
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
     * return a reference to the current screen object<br>
     * useful to call a object specific method
     * @name current
     * @memberOf me.state
     * @public
     * @function
     * @return {me.Stage}
     */
    current() {
        if (typeof _stages[_state] !== "undefined") {
            return _stages[_state].stage;
        }
    },

    /**
     * specify a global transition effect
     * @name transition
     * @memberOf me.state
     * @public
     * @function
     * @param {String} effect (only "fade" is supported for now)
     * @param {me.Color|String} color a CSS color value
     * @param {Number} [duration=1000] expressed in milliseconds
     */
    transition(effect, color, duration) {
        if (effect === "fade") {
            _fade.color = color;
            _fade.duration = duration;
        }
    },

    /**
     * enable/disable transition for a specific state (by default enabled for all)
     * @name setTransition
     * @memberOf me.state
     * @public
     * @function
     * @param {Number} state State ID (see constants)
     * @param {Boolean} enable
     */
    setTransition(state, enable) {
        _stages[state].transition = enable;
    },

    /**
     * change the game/app state
     * @name change
     * @memberOf me.state
     * @public
     * @function
     * @param {Number} state State ID (see constants)
     * @param {Boolean} forceChange if true the state will be changed immediately
     * @param {} [arguments...] extra arguments to be passed to the reset functions
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

        if (this.isCurrent(state)) {
            // do nothing if already the current state
            return;
        }

        _extraArgs = null;
        if (arguments.length > 1) {
            // store extra arguments if any
            _extraArgs = Array.prototype.slice.call(arguments, 1);
        }
        // if fading effect
        if (_fade.duration && _stages[state].transition) {
            /** @ignore */
            _onSwitchComplete = function() {
                game.viewport.fadeOut(_fade.color, _fade.duration);
            };
            game.viewport.fadeIn(
                _fade.color,
                _fade.duration,
                function () {
                    utils.function.defer(_switchState, this, state);
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
                utils.function.defer(_switchState, this, state);
            }
        }
    },

    /**
     * return true if the specified state is the current one
     * @name isCurrent
     * @memberOf me.state
     * @public
     * @function
     * @param {Number} state State ID (see constants)
     */
    isCurrent(state) {
        return _state === state;
    }

};
export default state;
