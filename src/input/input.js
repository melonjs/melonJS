/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function(window) {

	/**
	 * There is no constructor function for me.input.
	 * @namespace me.input
	 * @memberOf me
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
		
		// list of registered Event handlers
		var evtHandlers = {};

		// some usefull flags
		var keyboardInitialized = false;
		var pointerInitialized = false;
		var accelInitialized = false;
		
	    // list of supported mouse & touch events
		var activeEventList = null;
		var mouseEventList =   ['mousewheel', 'mousemove', 'mousedown', 'mouseup', 'click', 'dblclick'];
		var touchEventList =   [undefined, 'touchmove', 'touchstart', 'touchend', 'tap', 'dbltap'];
		// (a polyfill will probably be required at some stage, once this will be fully standardized0
		var pointerEventList = [undefined, 'PointerMove', 'PointerDown', 'PointerUp', 'MSGestureTap', undefined ];
		
		/**
		 * enable keyboard event
		 * @ignore
		 */

		function enableKeyboardEvent() {
			if (!keyboardInitialized) {
				window.addEventListener('keydown', keydown, false);
				window.addEventListener('keyup', keyup, false);
				keyboardInitialized = true;
			}
		}
		
		/** 
		 * addEventListerner for the specified event list and callback
		 * @private
		 */
		function registerEventListener(eventList, callback) {
			for (var x = 2; x < eventList.length; ++x) {
				if (eventList[x] !== undefined) {
					me.video.getScreenCanvas().addEventListener(eventList[x], callback, false);
				}
			}
		}
		
		
		/**
		 * enable pointer event (MSPointer/Mouse/Touch)
		 * @ignore
		 */
		function enablePointerEvent() {
			if (!pointerInitialized) {
				// initialize mouse pos (0,0)
				obj.touches.push({ x: 0, y: 0 });
				obj.mouse.pos = new me.Vector2d(0,0);
				// get relative canvas position in the page
				obj.offset = me.video.getPos();
				
			    // MSPointer can hold Mouse & Touch events
				if (window.navigator.pointerEnabled) {
					activeEventList = pointerEventList;
					// check for backward compatibility with the 'MS' prefix
					var useMSPrefix = window.navigator.msPointerEnabled;
					for(var x = 0; x < activeEventList.length; ++x) {
						if (activeEventList[x] && !activeEventList[x].contains('MS')) {
							activeEventList[x] = useMSPrefix ? 'MS' + activeEventList[x] : activeEventList[x].toLowerCase();
						}
					}
					// check if multi-touch & Gesture is supported !
					if (me.sys.touch & window.Gesture) {
						var Gesture = new Gesture();
						Gesture.target = me.video.getScreenCanvas();
					} else {
						// set as not suppported
						activeEventList[4] = undefined;
					}
					// register PointerEvents
					registerEventListener(activeEventList, onPointerEvent);
				} else {
                    // Regular `touch****` events for iOS/Android devices
				    if (me.sys.touch) {
						activeEventList = touchEventList;
						registerEventListener(activeEventList, onTouchEvent);
				    } else {
						// Regular Mouse events
				        activeEventList = mouseEventList;
						window.addEventListener('mousewheel', onMouseWheel, false);
						registerEventListener(activeEventList, onMouseEvent);
				    }
				}
				// set the PointerMove/touchMove/MouseMove event
				me.video.getScreenCanvas().addEventListener(activeEventList[1], onMoveEvent, false);
				pointerInitialized = true;
			}
		}


		/**
		 * prevent event propagation
		 * @ignore
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
		 * @ignore
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
		 * @ignore
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
		 * @ignore
		 */
		function dispatchEvent(e) {
			var handled = false;
			var handlers = evtHandlers[e.type];
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
		 * @ignore
		 */
		function updateCoordFromEvent(e) {
			// reset the touch array cache
			obj.touches.length=0;
			
			// PointerEvent or standard Mouse event
			if (!e.touches) {
				var offset = obj.offset;
				var x = e.clientX - offset.left;
				var y = e.clientY - offset.top;
				var scale = me.sys.scale;
				if (scale.x != 1.0 || scale.y != 1.0) {
					x/=scale.x;
					y/=scale.y;
				}
				obj.touches.push({ x: x, y: y, id: e.pointerId || 1});
			}
			// iOS/Android like touch event
			else {
				var offset = obj.offset;
				for(var i=0, l=e.changedTouches.length; i<l; i++) {
					var t = e.changedTouches[i];
					var x = t.clientX - offset.left;
					var y = t.clientY - offset.top;
					var scale = me.sys.scale;
					if (scale.x != 1.0 || scale.y != 1.0) {
						x/=scale.x; 
						y/=scale.y;
					}
					obj.touches.push({ x: x, y: y, id: t.identifier });
				}
			}
			// if event.isPrimary is defined and false, return
			if (e.isPrimary === false) {
				return;
			}
			// Else use the first entry to simulate mouse event
			obj.mouse.pos.set(obj.touches[0].x,obj.touches[0].y);
		}

	
		/**
		 * mouse event management (mousewheel)
		 * @ignore
		 */
		function onMouseWheel(e) {
			if (e.target == me.video.getScreenCanvas()) {
				// dispatch mouse event to registered object
				if (dispatchEvent(e)) {
					// prevent default action
					return preventDefault(e);
				}
			}

			return true;
		}

		
		/**
		 * mouse event management (mousemove)
		 * @ignore
		 */
		function onMoveEvent(e) {
			// update position
			updateCoordFromEvent(e);
			// dispatch mouse event to registered object
			if (dispatchEvent(e)) {
				// prevent default action
				return preventDefault(e);
			}

			return true;
		}
		
		/**
		 * mouse event management (mousedown, mouseup)
		 * @ignore
		 */
		function onMouseEvent(e) {
			// dispatch event to registered objects
			if (dispatchEvent(e)) {
				// prevent default action
				return preventDefault(e);
			}

			// in case of touch event button is undefined
			var keycode = obj.mouse.bind[e.button || 0];

			// check if mapped to a key
			if (keycode) {
				if (e.type === activeEventList[3])
					return keydown(e, keycode);
				else // 'mouseup' or 'touchend'
					return keyup(e, keycode);
			}

			return true;
		}
		
		/**
		 * mouse event management (touchstart, touchend)
		 * @ignore
		 */
		function onTouchEvent(e) {
			// update the new touch position
			updateCoordFromEvent(e);
			// reuse the mouse event function
			return onMouseEvent(e);
		}

		/**
		 * PointerEvent management (pointerdown, pointerup)
		 * @ignore
		 */
		function onPointerEvent(e) {
			// manage the new ("mouse") and old {1) spec
			if (e.pointerType === "mouse" || e.pointerType === 1) {
				return onMouseEvent(e);
			}
			// reuse onTouchEvent for "touch" and "pen" type
			return onTouchEvent(e);
		}

		/**
		 * event management (Accelerometer)
		 * http://www.mobilexweb.com/samples/ball.html
		 * http://www.mobilexweb.com/blog/safari-ios-accelerometer-websockets-html5
		 * @ignore		
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
		 * @name accel
		 * @memberOf me.input
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
		 * @name mouse
		 * @memberOf me.input
		 */		
		 obj.mouse = {
			// mouse position
			pos : null,
			// button constants (W3C)
			LEFT:	0,
			MIDDLE: 1,
			RIGHT:	2,
			// bind list for mouse buttons
			bind: [ 0, 0, 0 ]
		};

		/**
		 * cache value for the offset of the canvas position within the page
		 * @private
		 */
		obj.offset = null;
			
		/**
		 * Array of object containing touch information<br>
		 * properties : <br>
		 * x : x position of the touch event in the canvas (screen coordinates)<br>
		 * y : y position of the touch event in the canvas (screen coordinates)<br>
		 * id : unique finger identifier<br>
		 * @public
		 * @type Array
		 * @name touches
		 * @memberOf me.input
		 */		
		obj.touches = [];
		
		/**
		 * list of mappable keys :
		 * LEFT, UP, RIGHT, DOWN, ENTER, SHIFT, CTRL, ALT, PAUSE, ESC, ESCAPE, [0..9], [A..Z]
		 * @public
		 * @enum {number}
		 * @name KEY
		 * @memberOf me.input
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
		 * @name isKeyPressed
		 * @memberOf me.input
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
		 * @name keyStatus
		 * @memberOf me.input
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
		 * @name triggerKeyEvent
		 * @memberOf me.input
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
		 * @name bindKey
		 * @memberOf me.input
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
		 * unlock a key manually
		 * @name unlockKey
		 * @memberOf me.input
		 * @public
		 * @function
		 * @param {String} action user defined corresponding action
		 * @example
		 * // Unlock jump when touching the ground
		 * if(!this.falling && !this.jumping) {
		 * me.input.unlockKey("jump");
		 * }
		 */
		obj.unlockKey = function(action) {
			keyLocked[action] = false;			
		};
		
		/**
		 * unbind the defined keycode
		 * @name unbindKey
		 * @memberOf me.input
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
		 * @name bindMouse
		 * @memberOf me.input
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
			enablePointerEvent();
			
			// throw an exception if no action is defined for the specified keycode
			if (!KeyBinding[keyCode])
			  throw "melonJS : no action defined for keycode " + keyCode;
			// map the mouse button to the keycode
			obj.mouse.bind[button] = keyCode;
		};
		/**
		 * unbind the defined keycode
		 * @name unbindMouse
		 * @memberOf me.input
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
		 * @name bindTouch
		 * @memberOf me.input
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
		 * @name unbindTouch
		 * @memberOf me.input
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
		 * @name registerMouseEvent
		 * @memberOf me.input
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
		obj.registerMouseEvent = function (eventType, rect, callback, floating) {
		    // make sure the mouse/touch events are initialized
		    enablePointerEvent();

		    // convert mouse events to iOS/PointerEvent equivalent
		    if ((mouseEventList.indexOf(eventType) !== -1) && (me.sys.touch || window.navigator.msPointerEnabled)) {
		        eventType = activeEventList[mouseEventList.indexOf(eventType)];
		    }
			// >>>TODO<<< change iOS touch event to their PointerEvent equivalent & vice-versa
			
		    // check if this is supported event
		    if (eventType && (activeEventList.indexOf(eventType) !== -1)) {
		        // register the event
		        if (!evtHandlers[eventType]) {
		            evtHandlers[eventType] = [];
		        }
		        // check if this is a floating object or not
		        var _float = rect.floating === true ? true : false;
		        // check if there is a given parameter
		        if (floating) {
		            // ovveride the previous value
		            _float = floating === true ? true : false;
		        }
		        // initialize the handler
		        evtHandlers[eventType].push({ rect: rect || null, cb: callback, floating: _float });
		        return;
		    }
		    throw "melonJS : invalid event type : " + eventType;
		};
		
		/**
		 * release the previously registered mouse event callback
		 * note : on a touch enabled device mouse event will automatically be converted to touch event
		 * @name releaseMouseEvent
		 * @memberOf me.input
		 * @public
		 * @function
		 * @param {String} eventType ('mousemove', 'mousedown', 'mouseup', 'mousewheel', 'click', 'dblclick', 'touchstart', 'touchmove', 'touchend', 'tap', 'dbltap')
		 * @param {me.Rect} region
		 * @example
		 * // release the registered callback on the 'mousemove' event
		 * me.input.releaseMouseEvent('mousemove', this.collisionBox);
		 */
		obj.releaseMouseEvent = function(eventType, rect) {
			// convert mouse events to iOS/MSPointer equivalent
		    if ((mouseEventList.indexOf(eventType) !== -1) && (me.sys.touch || window.navigator.msPointerEnabled)) {
		        eventType = activeEventList[mouseEventList.indexOf(eventType)];
		    }
			// >>>TODO<<< change iOS touch event to their PointerEvent equivalent & vice-versa
			
		    // check if this is supported event
		    if (eventType && (activeEventList.indexOf(eventType) !== -1)) {
				// unregister the event
				if (!evtHandlers[eventType]) {
					evtHandlers[eventType] = [];
 				}
				var handlers = evtHandlers[eventType];
				if (handlers) {
					for (var i = handlers.length, handler; i--, handler = handlers[i];) {
						if (handler.rect === rect) {
							// make sure all references are null
							handler.rect = handler.cb = handler.floating = null;
							evtHandlers[eventType].splice(i, 1);
						}
					}
				}
				return;
			}
			throw "melonJS : invalid event type : " + eventType;
		};

		/**
		 * watch Accelerator event 
		 * @name watchAccelerometer
		 * @memberOf me.input
		 * @public
		 * @function
		 * @return {boolean} false if not supported by the device
		 */
		obj.watchAccelerometer = function() {
			if (window.sys.gyro) {
				if (!accelInitialized) {
					// add a listener for the mouse
					window.addEventListener('devicemotion', onDeviceMotion, false);
					accelInitialized = true;
				}
				return true;
			}
			return false;
		};
		
		/**
		 * unwatch Accelerometor event 
		 * @name unwatchAccelerometer
		 * @memberOf me.input
		 * @public
		 * @function
		 */
		obj.unwatchAccelerometer = function() {
			if (accelInitialized) {
				// add a listener for the mouse
				window.removeEventListener('devicemotion', onDeviceMotion, false);
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
