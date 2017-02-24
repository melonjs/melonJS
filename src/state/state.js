/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Screens objects & State machine
 *
 */

(function () {
    /**
     * A class skeleton for "Screen" Object <br>
     * every "screen" object (title screen, credits, ingame, etc...) to be managed <br>
     * through the state manager must inherit from this base class.
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @see me.state
     */
    me.ScreenObject = me.Object.extend(
    /** @scope me.ScreenObject.prototype */
    {
        /** @ignore */
        init: function () {},

        /**
         * Object reset function
         * @ignore
         */
        reset : function () {
            // reset the game manager
            me.game.reset();
            // call the onReset Function
            this.onResetEvent.apply(this, arguments);
        },

        /**
         * destroy function
         * @ignore
         */
        destroy : function () {
            // notify the object
            this.onDestroyEvent.apply(this, arguments);
        },

        /**
         * onResetEvent function<br>
         * called by the state manager when reseting the object<br>
         * this is typically where you will load a level, etc...
         * to be extended
         * @name onResetEvent
         * @memberOf me.ScreenObject
         * @function
         * @param {} [arguments...] optional arguments passed when switching state
         * @see me.state#change
         */
        onResetEvent : function () {
            // to be extended
        },

        /**
         * onDestroyEvent function<br>
         * called by the state manager before switching to another state<br>
         * @name onDestroyEvent
         * @memberOf me.ScreenObject
         * @function
         */
        onDestroyEvent : function () {
            // to be extended
        }
    });

    // based on the requestAnimationFrame polyfill by Erik Möller
    (function () {
        var lastTime = 0;
        var frameDuration = 1000 / 60;
        // get unprefixed rAF and cAF, if present
        var requestAnimationFrame = me.agent.prefixed("requestAnimationFrame");
        var cancelAnimationFrame = me.agent.prefixed("cancelAnimationFrame") ||
                                   me.agent.prefixed("cancelRequestAnimationFrame");

        if (!requestAnimationFrame || !cancelAnimationFrame) {
            requestAnimationFrame = function (callback) {
                var currTime = window.performance.now();
                var timeToCall = Math.max(0, frameDuration - (currTime - lastTime));
                var id = window.setTimeout(function () {
                    callback(currTime + timeToCall);
                }, timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };

            cancelAnimationFrame = function (id) {
                window.clearTimeout(id);
            };
        }

         // put back in global namespace
        window.requestAnimationFrame = requestAnimationFrame;
        window.cancelAnimationFrame = cancelAnimationFrame;
    }());


    /**
     * a State Manager (state machine)<p>
     * There is no constructor function for me.state.
     * @namespace me.state
     * @memberOf me
     */

    me.state = (function () {
        // hold public stuff in our singleton
        var api = {};

        /*-------------------------------------------
            PRIVATE STUFF
         --------------------------------------------*/

        // current state
        var _state = -1;

        // requestAnimeFrame Id
        var _animFrameId = -1;

        // whether the game state is "paused"
        var _isPaused = false;

        // list of screenObject
        var _screenObject = {};

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
                me.timer.reset();

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
                me.timer.reset();

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
            // update all game objects
            me.game.update(time);
            // render all game objects
            me.game.draw();
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

            // call the screen object destroy method
            if (_screenObject[_state]) {
                // just notify the object
                _screenObject[_state].screen.destroy();
            }

            if (_screenObject[state]) {
                // set the global variable
                _state = state;

                // call the reset function with _extraArgs as arguments
                _screenObject[_state].screen.reset.apply(_screenObject[_state].screen, _extraArgs);

                // and start the main loop of the
                // new requested state
                _startRunLoop();

                // execute callback if defined
                if (_onSwitchComplete) {
                    _onSwitchComplete();
                }

                // force repaint
                me.game.repaint();
            }
        }

        /*
         * PUBLIC STUFF
         */

        /**
         * default state ID for Loading Screen
         * @constant
         * @name LOADING
         * @memberOf me.state
         */
        api.LOADING = 0;

        /**
         * default state ID for Menu Screen
         * @constant
         * @name MENU
         * @memberOf me.state
         */

        api.MENU = 1;
        /**
         * default state ID for "Ready" Screen
         * @constant
         * @name READY
         * @memberOf me.state
         */

        api.READY = 2;
        /**
         * default state ID for Play Screen
         * @constant
         * @name PLAY
         * @memberOf me.state
         */

        api.PLAY = 3;
        /**
         * default state ID for Game Over Screen
         * @constant
         * @name GAMEOVER
         * @memberOf me.state
         */

        api.GAMEOVER = 4;
        /**
         * default state ID for Game End Screen
         * @constant
         * @name GAME_END
         * @memberOf me.state
         */

        api.GAME_END = 5;
        /**
         * default state ID for High Score Screen
         * @constant
         * @name SCORE
         * @memberOf me.state
         */

        api.SCORE = 6;
        /**
         * default state ID for Credits Screen
         * @constant
         * @name CREDITS
         * @memberOf me.state
         */

        api.CREDITS = 7;
        /**
         * default state ID for Settings Screen
         * @constant
         * @name SETTINGS
         * @memberOf me.state
         */
        api.SETTINGS = 8;

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
        api.USER = 100;

        /**
         * onPause callback
         * @function
         * @name onPause
         * @memberOf me.state
         */
        api.onPause = null;

        /**
         * onResume callback
         * @function
         * @name onResume
         * @memberOf me.state
         */
        api.onResume = null;

        /**
         * onStop callback
         * @function
         * @name onStop
         * @memberOf me.state
         */
        api.onStop = null;

        /**
         * onRestart callback
         * @function
         * @name onRestart
         * @memberOf me.state
         */
        api.onRestart = null;

        /**
         * @ignore
         */
        api.init = function () {
            // set the embedded loading screen
            api.set(api.LOADING, new me.DefaultLoadingScreen());
        };

        /**
         * Stop the current screen object.
         * @name stop
         * @memberOf me.state
         * @public
         * @function
         * @param {Boolean} pauseTrack pause current track on screen stop.
         */
        api.stop = function (music) {
            // only stop when we are not loading stuff
            if ((_state !== api.LOADING) && api.isRunning()) {
                // stop the main loop
                _stopRunLoop();
                // current music stop
                if (music === true) {
                    me.audio.pauseTrack();
                }

                // store time when stopped
                _pauseTime = window.performance.now();

                // publish the stop notification
                me.event.publish(me.event.STATE_STOP);
                // any callback defined ?
                if (typeof(api.onStop) === "function") {
                    api.onStop();
                }
            }
        };

        /**
         * pause the current screen object
         * @name pause
         * @memberOf me.state
         * @public
         * @function
         * @param {Boolean} pauseTrack pause current track on screen pause
         */
        api.pause = function (music) {
            // only pause when we are not loading stuff
            if ((_state !== api.LOADING) && !api.isPaused()) {
                // stop the main loop
                _pauseRunLoop();
                // current music stop
                if (music === true) {
                    me.audio.pauseTrack();
                }

                // store time when paused
                _pauseTime = window.performance.now();

                // publish the pause event
                me.event.publish(me.event.STATE_PAUSE);
                // any callback defined ?
                if (typeof(api.onPause) === "function") {
                    api.onPause();
                }
            }
        };

        /**
         * Restart the screen object from a full stop.
         * @name restart
         * @memberOf me.state
         * @public
         * @function
         * @param {Boolean} resumeTrack resume current track on screen resume
         */
        api.restart = function (music) {
            if (!api.isRunning()) {
                // restart the main loop
                _startRunLoop();
                // current music stop
                if (music === true) {
                    me.audio.resumeTrack();
                }

                // calculate the elpased time
                _pauseTime = window.performance.now() - _pauseTime;

                // force repaint
                me.game.repaint();

                // publish the restart notification
                me.event.publish(me.event.STATE_RESTART, [ _pauseTime ]);
                // any callback defined ?
                if (typeof(api.onRestart) === "function") {
                    api.onRestart();
                }
            }
        };

        /**
         * resume the screen object
         * @name resume
         * @memberOf me.state
         * @public
         * @function
         * @param {Boolean} resumeTrack resume current track on screen resume
         */
        api.resume = function (music) {
            if (api.isPaused()) {
                // resume the main loop
                _resumeRunLoop();
                // current music stop
                if (music === true) {
                    me.audio.resumeTrack();
                }

                // calculate the elpased time
                _pauseTime = window.performance.now() - _pauseTime;

                // publish the resume event
                me.event.publish(me.event.STATE_RESUME, [ _pauseTime ]);
                // any callback defined ?
                if (typeof(api.onResume) === "function") {
                    api.onResume();
                }
            }
        };

        /**
         * return the running state of the state manager
         * @name isRunning
         * @memberOf me.state
         * @public
         * @function
         * @return {Boolean} true if a "process is running"
         */
        api.isRunning = function () {
            return _animFrameId !== -1;
        };

        /**
         * Return the pause state of the state manager
         * @name isPaused
         * @memberOf me.state
         * @public
         * @function
         * @return {Boolean} true if the game is paused
         */
        api.isPaused = function () {
            return _isPaused;
        };

        /**
         * associate the specified state with a screen object
         * @name set
         * @memberOf me.state
         * @public
         * @function
         * @param {Number} state State ID (see constants)
         * @param {me.ScreenObject} so Instantiated ScreenObject to associate
         * with state ID
         * @example
         * var MenuButton = me.GUI_Object.extend({
         *     "onClick" : function () {
         *         // Change to the PLAY state when the button is clicked
         *         me.state.change(me.state.PLAY);
         *         return true;
         *     }
         * });
         *
         * var MenuScreen = me.ScreenObject.extend({
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
        api.set = function (state, so) {
            if (!(so instanceof me.ScreenObject)) {
                throw new me.Error(so + " is not an instance of me.ScreenObject");
            }
            _screenObject[state] = {};
            _screenObject[state].screen = so;
            _screenObject[state].transition = true;
        };

        /**
         * return a reference to the current screen object<br>
         * useful to call a object specific method
         * @name current
         * @memberOf me.state
         * @public
         * @function
         * @return {me.ScreenObject}
         */
        api.current = function () {
            return _screenObject[_state].screen;
        };

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
        api.transition = function (effect, color, duration) {
            if (effect === "fade") {
                _fade.color = color;
                _fade.duration = duration;
            }
        };

        /**
         * enable/disable transition for a specific state (by default enabled for all)
         * @name setTransition
         * @memberOf me.state
         * @public
         * @function
         * @param {Number} state State ID (see constants)
         * @param {Boolean} enable
         */
        api.setTransition = function (state, enable) {
            _screenObject[state].transition = enable;
        };

        /**
         * change the game/app state
         * @name change
         * @memberOf me.state
         * @public
         * @function
         * @param {Number} state State ID (see constants)
         * @param {} [arguments...] extra arguments to be passed to the reset functions
         * @example
         * // The onResetEvent method on the play screen will receive two args:
         * // "level_1" and the number 3
         * me.state.change(me.state.PLAY, "level_1", 3);
         */
        api.change = function (state) {
            // Protect against undefined ScreenObject
            if (typeof(_screenObject[state]) === "undefined") {
                throw new me.Error("Undefined ScreenObject for state '" + state + "'");
            }

            if (api.isCurrent(state)) {
                // do nothing if already the current state
                return;
            }

            _extraArgs = null;
            if (arguments.length > 1) {
                // store extra arguments if any
                _extraArgs = Array.prototype.slice.call(arguments, 1);
            }
            // if fading effect
            if (_fade.duration && _screenObject[state].transition) {
                /** @ignore */
                _onSwitchComplete = function () {
                    me.game.viewport.fadeOut(_fade.color, _fade.duration);
                };
                me.game.viewport.fadeIn(
                    _fade.color,
                    _fade.duration,
                    function () {
                        _switchState.defer(this, state);
                    }
                );

            }
            // else just switch without any effects
            else {
                // wait for the last frame to be
                // "finished" before switching
                _switchState.defer(this, state);
            }
        };

        /**
         * return true if the specified state is the current one
         * @name isCurrent
         * @memberOf me.state
         * @public
         * @function
         * @param {Number} state State ID (see constants)
         */
        api.isCurrent = function (state) {
            return _state === state;
        };

        // return our object
        return api;
    })();
})();
