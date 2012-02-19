/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($, undefined) {

	/**
	 * There is no constructor function for me.input.
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	me.input = (function() {

		// hold public stuff in our singletong
		var obj = {};

		/*---------------------------------------------
			
			PRIVATE STUFF
				
		  ---------------------------------------------*/

		// list of binded keys
		var KeyBinding = [];

		// corresponding actions
		var keyStatus = [];

		// lock enable flag for keys
		var keyLock = [];
		// actual lock status of each key
		var keyLocked = [];

		// callback function for mouse & gyro
		var mouseEventCB = null;
		var gyroEventCB = null;

		// some usefull flags
		var keyboardInitialized = false;
		var mouseInitialized = false;

		
		/**
		 * enable keyboard event
		 * @private
		 */

		function enableKeyboardEvent(enable) {
			if (enable) {
				// Event Management
				if (!keyboardInitialized) {
					$.addEventListener('keydown', keydown, false);
					$.addEventListener('keyup', keyup, false);
				}
			} else {
				// remove the even listeners
				$.removeEventListener('keydown', keydown, false);
				$.removeEventListener('keyup', keyup, false);
			}
			keyboardInitialized = enable;
		};


		/**
		 * prevent event propagation
		 * @private
		 */
		function preventDefault(e) {
			e.stopPropagation();
			if (e.preventDefault)
				e.preventDefault();
			e.returnValue = false;
			// this is apprently needed on some platforms
			e.cancelBubble = true;
		};

		/**
		 * key down event
		 * @private
		 */
		function keydown(e, keyCode) {

			var action = KeyBinding[keyCode || e.keyCode || e.which];

			if (action) {
				//console.log(e, action);

				//console.log(action);
				if (!keyLocked[action]) {
					keyStatus[action] = true;
					// lock the key if requested
					keyLocked[action] = keyLock[action];
				}
				// prevent event propagation
				preventDefault(e);
				return false;
			}
			return true;
		};


		/**
		 * key up event
		 * @private
		 */
		function keyup(e, keyCode) {

			var action = KeyBinding[keyCode || e.keyCode || e.which];

			//console.log(e, action);

			if (action) {

				keyStatus[action] = false;
				keyLocked[action] = false;
				// prevent the event propagation
				preventDefault(e);
				return false;
			}
			return true;

		}

		
		/**
		 * translate Mouse Coordinates
		 * @private
		 */
		function updateMouseCoords(x, y) {
			obj.mouse.pos.set(x,y);
			obj.mouse.pos.sub(obj.mouse.offset);
			return obj.mouse.pos;
		};

		
		/**
		 * mouse event management (mousemove)
		 * @private
		 */
		function onMouseMove(e) {
			// update mouse position
			updateMouseCoords(e.pageX, e.pageY);
			preventDefault(e);
		};
		
		/**
		 * mouse event management (mousedown, mouseup)
		 * @private
		 */
		function onMouseEvent(e) {
			// propagate the event to the callback with x,y coords
			mouseEventCB(obj.mouse.pos);
			
			// check if mouse is mapped to a key
			var keycode = me.input.mouse.bind[event.button];
			if (keycode) {
				if (e.type=="mousedown")
					keydown(e, keycode);
				else // (e.type=="mouseup")
					keyup(e, keycode);
			}
		};
		
		/* ---
			
				 event management (Gyroscopic)
				
				---										*/
		function onGyroEvent(event) {
			// http://www.mobilexweb.com/samples/ball.html
			// http://www.mobilexweb.com/blog/safari-ios-accelerometer-websockets-html5
			// 
			// ax = event.accelerationIncludingGravity.x;
			// ay = event.accelerationIncludingGravity.y;

			// use acceleration instead on iphone4  
			// event.accelerationIncludingGravity.x
			// event.accelerationIncludingGravity.y
			// event.accelerationIncludingGravity.z

			// Gyroscope
			// window.ondeviceorientation = function(event) {
			// event.alpha
			// event.beta
			// event.gamma
			//}
		}
		;

		/*---------------------------------------------
			
			PUBLIC STUFF
				
		  ---------------------------------------------*/
		
		
		obj.mouse = {
			// mouse position
			pos : null,
			// canvas offset
			offset : null,
			// button constants (W3C)
			LEFT : 0,
			MIDDLE: 1,
			RIGHT: 2,
			// bind list for mouse buttons
			bind: [3]
		}
		
		/**
		 * list of mappable keys :
		 * LEFT, UP, RIGHT, DOWN, ENTER, SHIFT, CTRL, ALT, PAUSE, ESC, ESCAPE, [0..9], [A..Z]
		 * @public
		 * @enum {number}
		 * @name me.input#KEY
		 */
		obj.KEY = {
			'LEFT' : 37,
			'UP' : 38,
			'RIGHT' : 39,
			'DOWN' : 40,
			'ENTER' : 13,
			'SHIFT' : 16,
			'CTRL' : 17,
			'ALT' : 18,
			'PAUSE' : 19,
			'ESC' : 27,
			'SPACE' : 32,
			'NUM0' : 48,
			'NUM1' : 49,
			'NUM2' : 50,
			'NUM3' : 51,
			'NUM4' : 52,
			'NUM5' : 53,
			'NUM6' : 54,
			'NUM7' : 55,
			'NUM8' : 56,
			'NUM9' : 57,
			'A' : 65,
			'B' : 66,
			'C' : 67,
			'D' : 68,
			'E' : 69,
			'F' : 70,
			'G' : 71,
			'H' : 72,
			'I' : 73,
			'J' : 74,
			'K' : 75,
			'L' : 76,
			'M' : 77,
			'N' : 78,
			'O' : 79,
			'P' : 80,
			'Q' : 81,
			'R' : 82,
			'S' : 83,
			'T' : 84,
			'U' : 85,
			'V' : 86,
			'W' : 87,
			'X' : 88,
			'Y' : 89,
			'Z' : 90,
		};

		/**
		 * return the key press status of the specified action
		 * @name me.input#isKeyPressed
		 * @public
		 * @function
		 * @example
		 * if (me.input.isKeyPressed('left'))
		 * {
		 *    //do something
		 * }
		 * else if (me.input.isKeyPressed('right'))
		 * {
		 *    //do something else...
		 * }
		 *
		 */

		obj.isKeyPressed = function(action) {
			if (keyStatus[action]) {
				if (keyLock[action]) {
					keyLocked[action] = true;
					// "eat" the event
					keyStatus[action] = false;
				}
				return true;
			}
			return false;
		};

		/**
		 * return the key status of the specified action
		 * @name me.input#keyStatus
		 * @public
		 * @function
		 * @return {boolean} down (true) or up(false)
		 */

		obj.keyStatus = function(action) {
			return (keyLocked[action] === true) ? true : keyStatus[action];
		};

		/**
		 * associate a user defined action to a keycode
		 * @name me.input#bindKey
		 * @public
		 * @function
		 * @param {me.input#KEY} keycode
		 * @param {String} action user defined corresponding action
		 * @param {boolean} lock cancel the keypress event once read
		 * @example
		 * // enable the keyboard
		 * me.input.bindKey(me.input.KEY.LEFT,  "left");
		 * me.input.bindKey(me.input.KEY.RIGHT, "right");
		 * me.input.bindKey(me.input.KEY.X,     "jump", true);
		 */
		obj.bindKey = function(keycode, action, lock) {
			if (!keyboardInitialized)
				enableKeyboardEvent(true);

			KeyBinding[keycode] = action;

			keyLock[action] = lock ? lock : false;
			keyLocked[action] = false;
			//console.log(this);
		};
		
		/**
		 * unbind the defined keycode
		 * @name me.input#unbindKey
		 * @public
		 * @function
		 * @example
		 * me.input.unbindKey(me.input.KEY.LEFT);
		 */
		obj.unbindKey = function(keycode) {
			// clear the event status
			keyStatus[KeyBinding[keycode]] = false;
			keyLock[KeyBinding[keycode]] = false;
			// remove the key binding
			KeyBinding[keycode] = null;
		};

		/**
		 * Associate a mouse (button) action to a keycode
		 * Left button – 0
		 * Middle button – 1
		 * Right button – 2
		 * @name me.input#bindMouse
		 * @public
		 * @function
		 * @param {Integer} button (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
		 * @param {me.input#KEY} keyCode
		 * @example
		 * // enable the keyboard
		 * me.input.bindKey(me.input.KEY.X, "shoot");
		 * // map the left button click on the X key
		 * me.input.bindKey(me.input.mouse.LEFT, me.input.KEY.X);
		 */
		obj.bindMouse = function (button, keyCode)
		{
			// make sure the mouse is initialized
			if (!mouseInitialized)
				obj.enableMouseEvent(true);
			// throw an exception if no action is defined for the specified keycode
			if (!KeyBinding[keyCode])
			  throw "melonJS : no action defined for keycode " + keyCode;
			// map the mouse button to the keycode
			me.input.mouse.bind[button] = keyCode;
		};
		/**
		 * unbind the defined keycode
		 * @name me.input#unbindMouse
		 * @public
		 * @function
		 * @example
		 * me.input.unbindMouse(me.input.mouse.LEFT);
		 */
		obj.unbindMouse = function(button) {
			// clear the event status
			me.input.mouse.bind[button] = null;
		};


		/**
		 * enable mouse event
		 * @name me.input#enableMouseEvent
		 * @public
		 * @function
		 * @deprecated to be rewritten
		 */
		obj.enableMouseEvent = function(enable, callback) {
			if (enable) {
				// initialize mouse pos (0,0)
				obj.mouse.pos = new me.Vector2d(0,0);
				// get relative canvas position in the page
				obj.mouse.offset = me.video.getPos();
				// add a listener for the mouse
				me.video.getScreenCanvas().addEventListener('mousemove', onMouseMove, false);
				me.video.getScreenCanvas().addEventListener('mousedown', onMouseEvent, false );
				me.video.getScreenCanvas().addEventListener('mouseup', onMouseEvent, false );

				// set the callback
				mouseEventCB = callback || me.game.mouseEvent.bind(me.game);
			} else {
				me.video.getScreenCanvas().removeEventListener('mousemove', onMouseMove, false);
				me.video.getScreenCanvas().removeEventListener('mousedown', onMouseEvent, false );
				me.video.getScreenCanvas().removeEventListener('mouseup', onMouseEvent, false );

			}
			mouseInitialized = enable;
		};

		/**
		 * enable gyroscopic event (not implemented)
		 * @name me.input#enableGyroscopicEvent
		 * @public
		 * @function
		 */
		obj.enableGyroscopicEvent = function(enable, callback) {
			if ($.sys.gyro) {
				// add a listener for the mouse
				$.ondevicemotion = enable ? onGyroEvent : null;
				// set the callback
				gyroEventCB = enable ? callback : null;
			}

		};

		// return our object
		return obj;

	})();

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
