/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * There is no constructor function for me.input.
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	me.input = (function() {

		// hold public stuff in our singleton
		var obj = {};

		/*---------------------------------------------
			
			PRIVATE STUFF
				
		  ---------------------------------------------*/

		// list of binded keys
		var KeyBinding = {};

		// corresponding actions
		var keyStatus = {};

		// lock enable flag for keys
		var keyLock = {};
		// actual lock status of each key
		var keyLocked = {};

		// some usefull flags
		var keyboardInitialized = false;
		var mouseInitialized = false;
		var accelInitialized = false;
		
		// list of supported mouse & touch events
		var mouseEventList = ['mousewheel', 'mousemove', 'mousedown',  'mouseup', 'click', 'dblclick'];
		var touchEventList = [ undefined,   'touchmove', 'touchstart', 'touchend', 'tap' , 'dbltap'];
		
		
		/**
		 * enable keyboard event
		 * @private
		 */

		function enableKeyboardEvent() {
			if (!keyboardInitialized) {
				$.addEventListener('keydown', keydown, false);
				$.addEventListener('keyup', keyup, false);
				keyboardInitialized = true;
			}
		}
		
		/**
		 * enable mouse event
		 * @private
		 */
		function enableMouseEvent() {
			if (!mouseInitialized) {
				// initialize mouse pos (0,0)
				obj.touches.push({ x: 0, y: 0 });
				obj.mouse.pos = new me.Vector2d(0,0);
				// get relative canvas position in the page
				obj.mouse.offset = me.video.getPos();
				
				// add event listener for mouse & touch event
				if (me.sys.touch) {
					me.video.getScreenCanvas().addEventListener('touchmove', onMouseMove, false );
					for (var x = 2; x < touchEventList.length;++x) {
						me.video.getScreenCanvas().addEventListener(touchEventList[x], onTouchEvent, false );
					}
				} else {
					me.video.getScreenCanvas().addEventListener('mousemove', onMouseMove, false);
					$.addEventListener('mousewheel', onMouseWheel, false );
					for (var x = 2; x < mouseEventList.length;++x) {
						me.video.getScreenCanvas().addEventListener(mouseEventList[x], onMouseEvent, false );
					}
				}
				mouseInitialized = true;
			}
		}


		/**
		 * prevent event propagation
		 * @private
		 */
		function preventDefault(e) {
			// stop event propagation
			if (e.stopPropagation) {
				e.stopPropagation();
			}
			else {
				e.cancelBubble = true; 
			}
			// stop event default processing
			if (e.preventDefault)  {
				e.preventDefault();
			}
			else  {
				e.returnValue = false;
			}

			return false;
		}

		/**
		 * key down event
		 * @private
		 */
		function keydown(e, keyCode) {

			var action = KeyBinding[keyCode || e.keyCode || e.which];

			if (action) {
				if (!keyLocked[action]) {
					keyStatus[action] = true;
					// lock the key if requested
					keyLocked[action] = keyLock[action];

					// publish a message for keydown event
					me.event.publish(me.event.KEYDOWN, [ action ]);
				}
				// prevent event propagation
				return preventDefault(e);
			}

			return true;
		}


		/**
		 * key up event
		 * @private
		 */
		function keyup(e, keyCode) {

			var action = KeyBinding[keyCode || e.keyCode || e.which];

			if (action) {

				keyStatus[action] = false;
				keyLocked[action] = false;

				// publish message for keyup event
				me.event.publish(me.event.KEYUP, [ action ]);

				// prevent the event propagation
				return preventDefault(e);
			}

			return true;
		}
		
		/**
		 * propagate mouse event to registed object 
		 * @private
		 */
		function dispatchMouseEvent(e) {
			var handled = false;
			var handlers = obj.mouse.handlers[e.type];
			if (handlers) {
				var vpos = me.game.viewport.pos;
				var map_pos = me.game.currentLevel.pos;
				for(var t=0, l=obj.touches.length; t<l; t++) {
					// cache the x/y coordinates
					var x = obj.touches[t].x;
					var y = obj.touches[t].y;
					for (var i = handlers.length, handler; i--, handler = handlers[i];) {
						// adjust to world coordinates if not a floating object
						if (handler.floating===false) {
							var v = {x: x + vpos.x - map_pos.x, y: y + vpos.y - map_pos.y };
						} else {
							var v = {x: x, y: y};
						}
						// call the defined handler
						if ((handler.rect === null) || handler.rect.containsPoint(v)) {
							// trigger the corresponding callback
							if (handler.cb(e) === false) {
								// stop propagating the event if return false 
								handled = true;
								break;
							}
						}
					}
				} 
			}

			return handled;
		}

		
		/**
		 * translate Mouse Coordinates
		 * @private
		 */
		function updateCoordFromEvent(e) {

			// reset the touch array cache
			obj.touches.length=0;
			// non touch event (mouse)
			if (!e.touches) {
				var offset = obj.mouse.offset;
				var x = e.pageX - offset.x;
				var y = e.pageY - offset.y;
				var scale = me.sys.scale;
				if (scale.x != 1.0 || scale.y != 1.0) {
					x/=scale.x;
					y/=scale.y;
				}
				obj.touches.push({ x: x, y: y, id: 0});
			}
			// touch event
			else {
				var offset = obj.mouse.offset;
				for(var i=0, l=e.changedTouches.length; i<l; i++) {
					var t = e.changedTouches[i];
					var x = t.clientX - offset.x;
					var y = t.clientY - offset.y;
					var scale = me.sys.scale;
					if (scale.x != 1.0 || scale.y != 1.0) {
						x/=scale.x; 
						y/=scale.y;
					}
					obj.touches.push({ x: x, y: y, id: t.identifier });
				}
			}
			obj.mouse.pos.set(obj.touches[0].x,obj.touches[0].y);
		}

	
		/**
		 * mouse event management (mousewheel)
		 * @private
		 */
		function onMouseWheel(e) {
			if (e.target == me.video.getScreenCanvas()) {
				// dispatch mouse event to registered object
				if (dispatchMouseEvent(e)) {
					// prevent default action
					return preventDefault(e);
				}
			}

			return true;
		}

		
		/**
		 * mouse event management (mousemove)
		 * @private
		 */
		function onMouseMove(e) {
			// update position
			updateCoordFromEvent(e);
			// dispatch mouse event to registered object
			if (dispatchMouseEvent(e)) {
				// prevent default action
				return preventDefault(e);
			}

			return true;
		}
		
		/**
		 * mouse event management (mousedown, mouseup)
		 * @private
		 */
		function onMouseEvent(e) {
			// dispatch event to registered objects
			if (dispatchMouseEvent(e)) {
				// prevent default action
				return preventDefault(e);
			}

			// in case of touch event button is undefined
			var keycode = obj.mouse.bind[e.button || 0];

			// check if mapped to a key
			if (keycode) {
				if (e.type === 'mousedown' || e.type === 'touchstart')
					return keydown(e, keycode);
				else // 'mouseup' or 'touchend'
					return keyup(e, keycode);
			}

			return true;
		}
		
		/**
		 * mouse event management (touchstart, touchend)
		 * @private
		 */
		function onTouchEvent(e) {
			// update the new touch position
			updateCoordFromEvent(e);
			// reuse the mouse event function
			return onMouseEvent(e);
		}

		/**
		 * event management (Accelerometer)
		 * http://www.mobilexweb.com/samples/ball.html
		 * http://www.mobilexweb.com/blog/safari-ios-accelerometer-websockets-html5
		 * @private		
		 */
		function onDeviceMotion(e) {
			// Accelerometer information  
			obj.accel = e.accelerationIncludingGravity;
		}

		/*---------------------------------------------
			
			PUBLIC STUFF
				
		  ---------------------------------------------*/
		
		/**
		 * Accelerometer information<br>
		 * properties : x, y, z
		 * @public
		 * @enum {number}
		 * @name me.input#accel
		 */
		obj.accel = {
			x: 0, 
			y: 0, 
			z: 0
		};
		
		/**
		 * Mouse information<br>
		 * properties : <br>
		 * pos (me.Vector2d) : pointer position (in screen coordinates) <br>
		 * LEFT : constant for left button <br>
		 * MIDDLE : constant for middle button <br>
		 * RIGHT : constant for right button <br>
		 * @public
		 * @enum {number}
		 * @name me.input#mouse
		 */		
		 obj.mouse = {
			// mouse position
			pos : null,
			// canvas offset
			offset : null,
			// button constants (W3C)
			LEFT:	0,
			MIDDLE: 1,
			RIGHT:	2,
			// bind list for mouse buttons
			bind: [ 0, 0, 0 ],
			handlers:{} 
		};
		
		/**
		 * Array of object containing touch information<br>
		 * properties : <br>
		 * x : x position of the touch event in the canvas (screen coordinates)<br>
		 * y : y position of the touch event in the canvas (screen coordinates)<br>
		 * id : unique finger identifier<br>
		 * @public
		 * @type {Array}
		 * @name me.input#touches
		 */		
		obj.touches = [];
		
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
			'Z' : 90
		};

		/**
		 * return the key press status of the specified action
		 * @name me.input#isKeyPressed
		 * @public
		 * @function
		 * @param {String} action user defined corresponding action
		 * @return {boolean} true if pressed
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
		 * @param {String} action user defined corresponding action
		 * @return {boolean} down (true) or up(false)
		 */

		obj.keyStatus = function(action) {
			return (keyLocked[action] === true) ? true : keyStatus[action];
		};

		
		/**
		 * trigger the specified key (simulated) event <br>
		 * @name me.input#triggerKeyEvent
		 * @public
		 * @function
		 * @param {me.input#KEY} keycode
		 * @param {boolean} true to trigger a key press, or false for key release
		 * @example
		 * // trigger a key press
		 * me.input.triggerKeyEvent(me.input.KEY.LEFT, true);
		 */

		obj.triggerKeyEvent = function(keycode, status) {
			if (status) {
				keydown({}, keycode);
			}
			else {
				keyup({}, keycode);
			}
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
			// make sure the keyboard is enable
			enableKeyboardEvent();

			KeyBinding[keycode] = action;

			keyStatus[action] = false;
			keyLock[action] = lock ? lock : false;
			keyLocked[action] = false;
		};
		
		/**
		 * unbind the defined keycode
		 * @name me.input#unbindKey
		 * @public
		 * @function
		 * @param {me.input#KEY} keycode
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
		 * me.input.bindMouse(me.input.mouse.LEFT, me.input.KEY.X);
		 */
		obj.bindMouse = function (button, keyCode)
		{
			// make sure the mouse is initialized
			enableMouseEvent();
			
			// throw an exception if no action is defined for the specified keycode
			if (!KeyBinding[keyCode])
			  throw "melonJS : no action defined for keycode " + keyCode;
			// map the mouse button to the keycode
			obj.mouse.bind[button] = keyCode;
		};
		/**
		 * unbind the defined keycode
		 * @name me.input#unbindMouse
		 * @public
		 * @function
		 * @param {Integer} button (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
		 * @example
		 * me.input.unbindMouse(me.input.mouse.LEFT);
		 */
		obj.unbindMouse = function(button) {
			// clear the event status
			obj.mouse.bind[button] = null;
		};
		
		/**
		 * Associate a touch action to a keycode
		 * @name me.input#bindTouch
		 * @public
		 * @function
		 * @param {me.input#KEY} keyCode
		 * @example
		 * // enable the keyboard
		 * me.input.bindKey(me.input.KEY.X, "shoot");
		 * // map the touch event on the X key
		 * me.input.bindTouch(me.input.KEY.X);
		 */
		obj.bindTouch = function (keyCode)
		{	
			// reuse the mouse emulation stuff
			// where left mouse button is map to touch event
			obj.bindMouse(me.input.mouse.LEFT, keyCode);
		};
		
		/**
		 * unbind the defined touch binding
		 * @name me.input#unbindTouch
		 * @public
		 * @function
		 * @example
		 * me.input.unbindTouch();
		 */
		obj.unbindTouch = function() {
			// clear the key binding
			obj.unbindMouse(me.input.mouse.LEFT);
		};


			
		/**
		 * register on a mouse event for a given region
		 * note : on a touch enabled device mouse event will automatically be converted to touch event
		 * @name me.input#registerMouseEvent
		 * @public
		 * @function
		 * @param {String} eventType ('mousemove','mousedown','mouseup','mousewheel','touchstart','touchmove','touchend')
		 * @param {me.Rect} rect (object must inherits from me.Rect)
		 * @param {Function} callback
		 * @param {Boolean} [floating="floating property of the given object"] specify if the object is a floating object (if yes, screen coordinates are used, if not mouse/touch coordinates will be converted to world coordinates)
		 * @example
		 * // register on the 'mousemove' event
		 * me.input.registerMouseEvent('mousemove', this.collisionBox, this.mouseMove.bind(this));
		 */
		obj.registerMouseEvent = function(eventType, rect, callback, floating) {
			// make sure the mouse is initialized
			enableMouseEvent();
			
			// convert the mouse event into a touch event 
			// if we are on a touch device
			if ( me.sys.touch && (mouseEventList.indexOf(eventType) !== -1)) {
				eventType = touchEventList[mouseEventList.indexOf(eventType)];
			}
			
			// check if this is supported event
			if (eventType && ((mouseEventList.indexOf(eventType) !== -1) || 
				(touchEventList.indexOf(eventType) !== -1))) {
				
				// register the event
				if (!obj.mouse.handlers[eventType]) {
					obj.mouse.handlers[eventType] = [];
 				}
				// check if this is a floating object or not
				var _float = rect.floating===true?true:false;
				// check if there is a given parameter
				if (floating) {
					// ovveride the previous value
					_float = floating===true?true:false;
				}
				// initialize the handler
				obj.mouse.handlers[eventType].push({rect:rect||null,cb:callback,floating:_float});
				return;
			}
			throw "melonJS : invalid event type : " + eventType;
		};
		
		/**
		 * release the previously registered mouse event callback
		 * note : on a touch enabled device mouse event will automatically be converted to touch event
		 * @name me.input#releaseMouseEvent
		 * @public
		 * @function
		 * @param {String} eventType ('mousemove', 'mousedown', 'mouseup', 'mousewheel', 'click', 'dblclick', 'touchstart', 'touchmove', 'touchend', 'tap', 'dbltap')
		 * @param {me.Rect} region
		 * @example
		 * // release the registered callback on the 'mousemove' event
		 * me.input.releaseMouseEvent('mousemove', this.collisionBox);
		 */
		obj.releaseMouseEvent = function(eventType, rect) {
			// convert the mouse event into a touch event 
			// if we are on a touch device
			if ( me.sys.touch && (mouseEventList.indexOf(eventType) !== -1)) {
				eventType = touchEventList[mouseEventList.indexOf(eventType)];
			}			
			// check if this is supported event
			if (eventType && ((mouseEventList.indexOf(eventType) !== -1) || 
				(touchEventList.indexOf(eventType) !== -1))) {
				
				// unregister the event
				if (!obj.mouse.handlers[eventType]) {
					obj.mouse.handlers[eventType] = [];
 				}
				var handlers = obj.mouse.handlers[eventType];
				if (handlers) {
					for (var i = handlers.length, handler; i--, handler = handlers[i];) {
						if (handler.rect === rect) {
							// make sure all references are null
							handler.rect = handler.cb = handler.floating = null;
							obj.mouse.handlers[eventType].splice(i, 1);
						}
					}
				}
				return;
			}
			throw "melonJS : invalid event type : " + eventType;
		};

		/**
		 * watch Accelerator event 
		 * @name me.input#watchAccelerometer
		 * @public
		 * @function
		 * @return {boolean} false if not supported by the device
		 */
		obj.watchAccelerometer = function() {
			if ($.sys.gyro) {
				if (!accelInitialized) {
					// add a listener for the mouse
					$.addEventListener('devicemotion', onDeviceMotion, false);
					accelInitialized = true;
				}
				return true;
			}
			return false;
		};
		
		/**
		 * unwatch Accelerometor event 
		 * @name me.input#unwatchAccelerometer
		 * @public
		 * @function
		 */
		obj.unwatchAccelerometer = function() {
			if (accelInitialized) {
				// add a listener for the mouse
				$.removeEventListener('devicemotion', onDeviceMotion, false);
				accelInitialized = false;
			}
		};

		// return our object
		return obj;

	})();

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
