/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Screens objects & State machine
 *
 */

(function($) {

	/**
	 * A class skeleton for "Screen" Object <br>
	 * every "screen" object (title screen, credits, ingame, etc...) to be managed <br>
	 * through the state manager must inherit from this base class.
	 * @class
	 * @extends me.Renderable
	 * @memberOf me
	 * @constructor
	 * @param {Boolean} [addAsObject] add the object in the game manager object pool<br>
	 * @param {Boolean} [isPersistent] make the screen persistent over level changes; requires addAsObject=true<br>
	 * @see me.state
	 * @example
	 * // create a custom loading screen
	 * var CustomLoadingScreen = me.ScreenObject.extend(
	 * {
	 *    // constructor
	 *    init: function()
	 *    {
	 *       // pass true to the parent constructor
	 *       // as we draw our progress bar in the draw function
	 *       this.parent(true);
	 *       // a font logo
	 *       this.logo = new me.Font('century gothic', 32, 'white');
	 *       // flag to know if we need to refresh the display
	 *       this.invalidate = false;
	 *       // load progress in percent
	 *       this.loadPercent = 0;
	 *       // setup a callback
	 *       me.loader.onProgress = this.onProgressUpdate.bind(this);
	 *
	 *    },
	 *
	 *    // will be fired by the loader each time a resource is loaded
	 *    onProgressUpdate: function(progress)
	 *    {
	 *       this.loadPercent = progress;
	 *       this.invalidate = true;
	 *    },
	 *
	 *
	 *    // make sure the screen is only refreshed on load progress
	 *    update: function()
	 *    {
	 *       if (this.invalidate===true)
	 *       {
	 *          // clear the flag
	 *          this.invalidate = false;
	 *          // and return true
	 *          return true;
	 *       }
	 *       // else return false
	 *       return false;
	 *    },
	 *
	 *    // on destroy event
	 *    onDestroyEvent : function ()
	 *    {
	 *       // "nullify" all fonts
	 *       this.logo = null;
	 *    },
	 *
	 *    //	draw function
	 *    draw : function(context)
	 *    {
	 *       // clear the screen
	 *       me.video.clearSurface (context, "black");
	 *
	 *       // measure the logo size
	 *       logo_width = this.logo.measureText(context,"awesome loading screen").width;
	 *
	 *       // draw our text somewhere in the middle
	 *       this.logo.draw(context,
	 *                      "awesome loading screen",
	 *                      ((me.video.getWidth() - logo_width) / 2),
	 *                      (me.video.getHeight() + 60) / 2);
	 *
	 *       // display a progressive loading bar
	 *       var width = Math.floor(this.loadPercent * me.video.getWidth());
	 *
	 *       // draw the progress bar
	 *       context.strokeStyle = "silver";
	 *       context.strokeRect(0, (me.video.getHeight() / 2) + 40, me.video.getWidth(), 6);
	 *       context.fillStyle = "#89b002";
	 *       context.fillRect(2, (me.video.getHeight() / 2) + 42, width-4, 2);
	 *    },
	 * });
	 *
	 */
	me.ScreenObject = me.Renderable.extend(
	/** @scope me.ScreenObject.prototype */	
	{
		/** @ignore */
		addAsObject : false,
		/** @ignore */
		visible : false,
		/** @ignore */
		frame : 0,

		/**
		 * Z-order for object sorting<br>
		 * only used by the engine if the object has been initialized using addAsObject=true<br>
		 * default value : 999
		 * @private
		 * @type Number
		 * @name z
		 * @memberOf me.ScreenObject
		 */
		z : 999,

		/**
		 * initialization function
		 * @ignore
		 */
		init : function(addAsObject, isPersistent) {
			this.parent(new me.Vector2d(0, 0), 0, 0);
			this.addAsObject = this.visible = (addAsObject === true) || false;
			this.isPersistent = (this.visible && (isPersistent === true)) || false;
		},

		/**
		 * Object reset function
		 * @ignore
		 */
		reset : function() {

			// reset the game manager
			me.game.reset();
			
			// reset the frame counter
			this.frame = 0;
			this.frameRate = Math.round(60/me.sys.fps);

			// call the onReset Function
			this.onResetEvent.apply(this, arguments);

			// add our object to the GameObject Manager
			// allowing to benefit from the keyboard event stuff
			if (this.addAsObject) {
				// make sure we are visible upon reset
				this.visible = true;
				// update the screen size if added as an object
				this.set(me.game.viewport.pos, me.game.viewport.width, me.game.viewport.height);
				// add ourself !
				me.game.add(this, this.z);
			}
			
			// sort the object pool
			me.game.sort();

		},

		/**
		 * destroy function
		 * @ignore
		 */
		destroy : function() {
			// notify the object
			this.onDestroyEvent.apply(this, arguments);
		},

		/**
		 * update function<br>
		 * optional empty function<br>
		 * only used by the engine if the object has been initialized using addAsObject=true<br>
		 * @name update
		 * @memberOf me.ScreenObject
		 * @function
		 * @example
		 * // define a Title Screen
		 * var TitleScreen = me.ScreenObject.extend(
		 * {
		 *    // override the default constructor
		 *    init : function()
		 *    {
		 *       //call the parent constructor giving true
		 *       //as parameter, so that we use the update & draw functions
		 *       this.parent(true);
		 *       // ...
		 *     },
		 *     // ...
		 * });
		 */
		update : function() {
			return false;
		},

		/**
		 * frame update function function
		 * @ignore
		 */
		onUpdateFrame : function() {
			// handle frame skipping if required
			if (!(++this.frame%this.frameRate)) {
				// reset the frame counter
				this.frame = 0;
				
				// update the timer
				me.timer.update();

				// update all games object
				me.game.update();

				// draw the game objects
				me.game.draw();

				// blit our frame
				me.video.blitSurface();
			}
		},

		/**
		 * draw function<br>
		 * optional empty function<br>
		 * only used by the engine if the object has been initialized using addAsObject=true<br>
		 * @name draw
		 * @memberOf me.ScreenObject
		 * @function
		 * @example
		 * // define a Title Screen
		 * var TitleScreen = me.ScreenObject.extend(
		 * {
		 *    // override the default constructor
		 *    init : function()
		 *    {
		 *       //call the parent constructor giving true
		 *       //as parameter, so that we use the update & draw functions
		 *       this.parent(true);
		 *       // ...
		 *     },
		 *     // ...
		 * });
		 */
		draw : function() {
			// to be extended
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
		onResetEvent : function() {
			// to be extended
		},

		/**
		 * onDestroyEvent function<br>
		 * called by the state manager before switching to another state<br>
		 * @name onDestroyEvent
		 * @memberOf me.ScreenObject
		 * @function
		 */
		onDestroyEvent : function() {
			// to be extended
		}

	});

	// based on the requestAnimationFrame polyfill by Erik Möller
	(function() {
		var lastTime = 0;
		var vendors = ['ms', 'moz', 'webkit', 'o'];
		// get unprefixed rAF and cAF, if present
		var requestAnimationFrame = window.requestAnimationFrame;
		var cancelAnimationFrame = window.cancelAnimationFrame;
		for(var x = 0; x < vendors.length; ++x) {
			if ( requestAnimationFrame && cancelAnimationFrame ) {
				break;
			}
			requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
			cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] ||
								   window[vendors[x]+'CancelRequestAnimationFrame'];
		}

		if (!requestAnimationFrame || !cancelAnimationFrame) {
			requestAnimationFrame = function(callback, element) {
				var currTime = Date.now();
				var timeToCall = Math.max(0, 16 - (currTime - lastTime));
				var id = window.setTimeout(function() { 
					callback(currTime + timeToCall); 
				}, timeToCall);
				lastTime = currTime + timeToCall;
				return id;
			};

			cancelAnimationFrame = function(id) {
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

	me.state = (function() {
		
		// hold public stuff in our singleton
		var obj = {};

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

		// cache reference to the active screen update frame
		var _activeUpdateFrame = null;

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
		};

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
		};

		/**
		 * Pause the loop for most screen objects.
		 * @ignore
		 */
		function _pauseRunLoop() {
			// Set the paused boolean to stop updates on (most) entities
			_isPaused = true;
		};

		/**
		 * this is only called when using requestAnimFrame stuff
		 * @ignore
		 */
		function _renderFrame() {
			_activeUpdateFrame();
			if (_animFrameId != -1) {
		           _animFrameId = window.requestAnimationFrame(_renderFrame);
		    }
		};

		/**
		 * stop the SO main loop
		 * @ignore
		 */
		function _stopRunLoop() {
			// cancel any previous animationRequestFrame
			window.cancelAnimationFrame(_animFrameId);
			_animFrameId = -1;
		};

		/**
		 * start the SO main loop
		 * @ignore
		 */
		function _switchState(state) {
			// clear previous interval if any
			_stopRunLoop();

			// call the screen object destroy method
			if (_screenObject[_state]) {
				if (_screenObject[_state].screen.visible) {
					// persistent or not, make sure we remove it
					// from the current object list
					me.game.remove.call(me.game, _screenObject[_state].screen, true);
				}
				// notify the object
				_screenObject[_state].screen.destroy();
			}

			if (_screenObject[state])
			{
				// set the global variable
				_state = state;

				// call the reset function with _extraArgs as arguments
				_screenObject[_state].screen.reset.apply(_screenObject[_state].screen, _extraArgs);

				// cache the new screen object update function
				_activeUpdateFrame = _screenObject[_state].screen.onUpdateFrame.bind(_screenObject[_state].screen);

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
		};

		/*---------------------------------------------
			PUBLIC STUFF
 		 ---------------------------------------------*/
		
		/**
		 * default state value for Loading Screen
		 * @constant
		 * @name LOADING
		 * @memberOf me.state
		 */
		obj.LOADING = 0;
		/**
		 * default state value for Menu Screen
		 * @constant
		 * @name MENU
		 * @memberOf me.state
		 */
		obj.MENU = 1;
		/**
		 * default state value for "Ready" Screen
		 * @constant
		 * @name READY
		 * @memberOf me.state
		 */
		obj.READY = 2;
		/**
		 * default state value for Play Screen
		 * @constant
		 * @name PLAY
		 * @memberOf me.state
		 */
		obj.PLAY = 3;
		/**
		 * default state value for Game Over Screen
		 * @constant
		 * @name GAMEOVER
		 * @memberOf me.state
		 */
		obj.GAMEOVER = 4;
		/**
		 * default state value for Game End Screen
		 * @constant
		 * @name GAME_END
		 * @memberOf me.state
		 */
		obj.GAME_END = 5;
		/**
		 * default state value for High Score Screen
		 * @constant
		 * @name SCORE
		 * @memberOf me.state
		 */
		obj.SCORE = 6;
		/**
		 * default state value for Credits Screen
		 * @constant
		 * @name CREDITS
		 * @memberOf me.state
		 */
		obj.CREDITS = 7;
		/**
		 * default state value for Settings Screen
		 * @constant
		 * @name SETTINGS
		 * @memberOf me.state
		 */
		obj.SETTINGS = 8;
		
		/**
		 * default state value for user defined constants<br>
		 * @constant
		 * @name USER
		 * @memberOf me.state
		 * @example
		 * var STATE_INFO = me.state.USER + 0;
		 * var STATE_WARN = me.state.USER + 1;
		 * var STATE_ERROR = me.state.USER + 2;
		 * var STATE_CUTSCENE = me.state.USER + 3;
		 */
		obj.USER = 100;

		/**
		 * onPause callback
		 * @callback
		 * @name onPause
		 * @memberOf me.state
		 */
		obj.onPause = null;

		/**
		 * onResume callback
		 * @callback
		 * @name onResume
		 * @memberOf me.state
		 */
		obj.onResume = null;

		/**
		 * onStop callback
		 * @callback
		 * @name onStop
		 * @memberOf me.state
		 */
		obj.onStop = null;

		/**
		 * onRestart callback
		 * @callback
		 * @name onRestart
		 * @memberOf me.state
		 */
		obj.onRestart = null;

		/**
		 * @ignore
		 */
		obj.init = function() {
			// set the embedded loading screen
			obj.set(obj.LOADING, new me.DefaultLoadingScreen());

			// set pause/stop action on losing focus
			$.addEventListener("blur", function() {
				// only in case we are not loading stuff
				if (_state != obj.LOADING) {
					if (me.sys.stopOnBlur) {
						obj.stop(true);	

						// callback?
						if (obj.onStop)
							obj.onStop();

						// publish the pause notification
						me.event.publish(me.event.STATE_STOP);
					}
					if (me.sys.pauseOnBlur) {
							obj.pause(true);	
						// callback?
						if (obj.onPause)
							obj.onPause();

						// publish the pause notification
						me.event.publish(me.event.STATE_PAUSE);
					}
				}
			}, false);
			// set restart/resume action on gaining focus
			$.addEventListener("focus", function() {
				// only in case we are not loading stuff
				if (_state != obj.LOADING) {
					// note: separate boolean so we can stay paused if user prefers
					if (me.sys.resumeOnFocus) {
						obj.resume(true);

						// callback?
						if (obj.onResume)
							obj.onResume();

						// publish the resume notification
						me.event.publish(me.event.STATE_RESUME);
					}
					if (me.sys.stopOnBlur) {
						obj.restart(true);

						// force repaint
						me.game.repaint();

						// callback?
						if (obj.onRestart)
							obj.onRestart();

						// publish the resume notification
						me.event.publish(me.event.STATE_RESTART);
					}
				}

			}, false);

		};

		/**
		 * Stop the current screen object.
		 * @name stop
		 * @memberOf me.state
		 * @public
		 * @function
		 * @param {Boolean} pauseTrack pause current track on screen stop.
		 */
		obj.stop = function(music) {
			// stop the main loop
			_stopRunLoop();
			// current music stop
			if (music)
				me.audio.pauseTrack();

		};

		/**
		 * pause the current screen object
		 * @name pause
		 * @memberOf me.state
		 * @public
		 * @function
		 * @param {Boolean} pauseTrack pause current track on screen pause
		 */
		obj.pause = function(music) {
			// stop the main loop
			_pauseRunLoop();
			// current music stop
			if (music)
				me.audio.pauseTrack();

		};

		/**
		 * Restart the screen object from a full stop.
		 * @name restart
		 * @memberOf me.state
		 * @public
		 * @function
		 * @param {Boolean} resumeTrack resume current track on screen resume
		 */
		obj.restart = function(music) {
			// restart the main loop
			_startRunLoop();
			// current music stop
			if (music)
				me.audio.resumeTrack();
		};

		/**
		 * resume the screen object
		 * @name resume
		 * @memberOf me.state
		 * @public
		 * @function
		 * @param {Boolean} resumeTrack resume current track on screen resume
		 */
		obj.resume = function(music) {
			// resume the main loop
			_resumeRunLoop();
			// current music stop
			if (music)
				me.audio.resumeTrack();
		};

		/**
		 * return the running state of the state manager
		 * @name isRunning
		 * @memberOf me.state
		 * @public
		 * @function
		 * @param {Boolean} true if a "process is running"
		 */
		obj.isRunning = function() {
			return (_animFrameId !== -1)
		};

		/**
		 * Return the pause state of the state manager
		 * @name isPaused
		 * @memberOf me.state
		 * @public
		 * @function
		 * @param {Boolean} true if the game is paused
		 */
		obj.isPaused = function() {
			return _isPaused;
		};

		/**
		 * associate the specified state with a screen object
		 * @name set
		 * @memberOf me.state
		 * @public
		 * @function
		 * @param {Int} state @see me.state#Constant
		 * @param {me.ScreenObject}
		 */
		obj.set = function(state, so) {
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
		obj.current = function() {
			return _screenObject[_state].screen;
		};

		/**
		 * specify a global transition effect
		 * @name transition
		 * @memberOf me.state
		 * @public
		 * @function
		 * @param {String} effect (only "fade" is supported for now)
		 * @param {String} color a CSS color value
		 * @param {Int} [duration=1000] expressed in milliseconds
		 */
		obj.transition = function(effect, color, duration) {
			if (effect == "fade") {
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
		 */
		obj.setTransition = function(state, enable) {
			_screenObject[state].transition = enable;
		};

		/**
		 * change the game/app state
		 * @name change
		 * @memberOf me.state
		 * @public
		 * @function
		 * @param {Int} state @see me.state#Constant
		 * @param {} [arguments...] extra arguments to be passed to the reset functions
		 * @example
		 * // The onResetEvent method on the play screen will receive two args:
		 * // "level_1" and the number 3
		 * me.state.change(me.state.PLAY, "level_1", 3);
		 */
		obj.change = function(state) {
			// Protect against undefined ScreenObject
			if (typeof(_screenObject[state]) === "undefined") {
				throw "melonJS : Undefined ScreenObject for state '" + state + "'";
			}

			_extraArgs = null;
			if (arguments.length > 1) {
				// store extra arguments if any
				_extraArgs = Array.prototype.slice.call(arguments, 1);
			}
			// if fading effect
			if (_fade.duration && _screenObject[state].transition) {
				/** @ignore */
				_onSwitchComplete = function() {
					me.game.viewport.fadeOut(_fade.color, _fade.duration);
				};
				me.game.viewport.fadeIn(_fade.color, _fade.duration,
										function() {
											_switchState.defer(state);
										});

			}
			// else just switch without any effects
			else {
				// wait for the last frame to be
				// "finished" before switching
				_switchState.defer(state);

			}
		};

		/**
		 * return true if the specified state is the current one
		 * @name isCurrent
		 * @memberOf me.state
		 * @public
		 * @function
		 * @param {Int} state @see me.state#Constant
		 */
		obj.isCurrent = function(state) {
			return _state == state;
		};

		// return our object
		return obj;

	})();


	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
