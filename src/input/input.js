/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function(window) {
	
	/**
	 * The built in Event Object
	 * @external Event
	 * @see {@link https://developer.mozilla.org/en/docs/Web/API/Event|Event}
	 */
	 
	 /**
	  * Event normalized X coordinate within the game canvas itself<br>
	  * <img src="images/event_coord.png"/>
	  * @memberof! external:Event#
	  * @name external:Event#gameX
	  * @type {Number}
	  */
	  
	 /**
	  * Event normalized Y coordinate within the game canvas itself<br>
	  * <img src="images/event_coord.png"/>
	  * @memberof! external:Event#
	  * @name external:Event#gameY
	  * @type {Number}
	  */

	 /**
	  * Event X coordinate relative to the viewport<br>
	  * @memberof! external:Event#
	  * @name external:Event#gameScreenX
	  * @type {Number}
	  */

	 /**
	  * Event Y coordinate relative to the viewport<br>
	  * @memberof! external:Event#
	  * @name external:Event#gameScreenY
	  * @type {Number}
	  */

	 /**
	  * Event X coordinate relative to the map<br>
	  * @memberof! external:Event#
	  * @name external:Event#gameWorldX
	  * @type {Number}
	  */

	 /**
	  * Event Y coordinate relative to the map<br>
	  * @memberof! external:Event#
	  * @name external:Event#gameWorldY
	  * @type {Number}
	  */
	  
	 /**
	  * The unique identifier of the contact for a touch, mouse or pen <br>
	  * (This id is also defined on non Pointer Event Compatible platform like pure mouse or iOS-like touch event) 
	  * @memberof! external:Event#
	  * @name external:Event#pointerId
	  * @type {Number}
	  * @see http://msdn.microsoft.com/en-us/library/windows/apps/hh466123.aspx
	  */

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

		// List of binded keys being held
		var keyRefs = {};

		// list of registered Event handlers
		var evtHandlers = {};

		// some usefull flags
		var keyboardInitialized = false;
		var pointerInitialized = false;
		
		// to keep track of the supported wheel event
		var wheeltype = 'mousewheel';

		// Track last event timestamp to prevent firing events out of order
		var lastTimeStamp = 0;

	    // list of supported mouse & touch events
		var activeEventList = null;
		var mouseEventList =   ['mousewheel', 'mousemove', 'mousedown', 'mouseup', undefined, 'click', 'dblclick'];
		var touchEventList =   [undefined, 'touchmove', 'touchstart', 'touchend', 'touchcancel', 'tap', 'dbltap'];
		// (a polyfill will probably be required at some stage, once this will be fully standardized
		var pointerEventList = ['mousewheel', 'pointermove', 'pointerdown', 'pointerup', 'pointercancel', undefined, undefined ];
		var MSPointerEventList = ['mousewheel', 'MSPointerMove', 'MSPointerDown', 'MSPointerUp', 'MSPointerCancel', undefined, undefined ];
		
		// internal constants
		var MOUSE_WHEEL = 0;
		var POINTER_MOVE = 1;
		var POINTER_DOWN = 2;
		var POINTER_UP = 3;
		var POINTER_CANCEL = 4;

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
				obj.changedTouches.push({ x: 0, y: 0 });
				obj.mouse.pos = new me.Vector2d(0,0);
				// get relative canvas position in the page
				obj.offset = me.video.getPos();
				// Automatically update relative canvas position on scroll
				window.addEventListener("scroll", throttle(100, false,
					function (e) {
						obj.offset = me.video.getPos();
						me.event.publish(me.event.WINDOW_ONSCROLL, [ e ]);
					}
				), false);

				// check standard
				if(window.navigator.pointerEnabled) {
					activeEventList = pointerEventList;
				}
				else if(window.navigator.msPointerEnabled) { // check for backward compatibility with the 'MS' prefix
					activeEventList = MSPointerEventList;
				}
				else if (me.device.touch) { //  `touch****` events for iOS/Android devices
					activeEventList = touchEventList;
				}
				else { // Regular Mouse events
					activeEventList = mouseEventList;
				}

				registerEventListener(activeEventList, onPointerEvent);

				// detect wheel event support
				// Modern browsers support "wheel", Webkit and IE support at least "mousewheel
				wheeltype = "onwheel" in document.createElement("div") ? "wheel" : "mousewheel";
				window.addEventListener(wheeltype, onMouseWheel, false);

				// set the PointerMove/touchMove/MouseMove event
				if (obj.throttlingInterval === undefined) {
					// set the default value
					obj.throttlingInterval = Math.floor(1000/me.sys.fps);
				}
				// if time interval <= 16, disable the feature
				if (obj.throttlingInterval < 17) {
					me.video.getScreenCanvas().addEventListener(activeEventList[POINTER_MOVE], onMoveEvent, false);
				}
				else {
					me.video.getScreenCanvas().addEventListener(activeEventList[POINTER_MOVE], throttle(obj.throttlingInterval, false, function(e){onMoveEvent(e);}), false);
				}
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
		function keydown(e, keyCode, mouseButton) {

            keyCode = keyCode || e.keyCode || e.which;
            var action = KeyBinding[keyCode];

            // publish a message for keydown event
            me.event.publish(me.event.KEYDOWN, [
                action,
                keyCode,
                action ? !keyLocked[action] : true
            ]);

			if (action) {
				if (!keyLocked[action]) {
					var trigger = mouseButton ? mouseButton : keyCode;
					if (!keyRefs[action][trigger]) {
						keyStatus[action]++;
						keyRefs[action][trigger] = true;
					}
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
		function keyup(e, keyCode, mouseButton) {

            keyCode = keyCode || e.keyCode || e.which;
            var action = KeyBinding[keyCode];

            // publish a message for keydown event
            me.event.publish(me.event.KEYUP, [ action, keyCode ]);

			if (action) {
				var trigger = mouseButton ? mouseButton : keyCode;
				keyRefs[action][trigger] = undefined;
				if (keyStatus[action] > 0)
					keyStatus[action]--;
				keyLocked[action] = false;

				// prevent the event propagation
				return preventDefault(e);
			}

			return true;
		}
		
		/**
		 * propagate events to registered objects 
		 * @ignore
		 */
		function dispatchEvent(e) {
			var handled = false;
			var handlers = evtHandlers[e.type];

			// Convert touchcancel -> touchend, and pointercancel -> pointerup
			if (!handlers) {
				if (activeEventList.indexOf(e.type) === POINTER_CANCEL) {
					handlers = evtHandlers[activeEventList[POINTER_UP]];
				} else {
					handlers = evtHandlers[e.type];
				}
			}

			if (handlers) {
				// get the current screen to world offset 
				var offset = me.game.viewport.localToWorld(0,0);
				for(var t=0, l=obj.changedTouches.length; t<l; t++) {
					// Do not fire older events
					if (typeof(e.timeStamp) !== "undefined") {
						if (e.timeStamp < lastTimeStamp) continue;
						lastTimeStamp = e.timeStamp;
					}

					// if PointerEvent is not supported 
					if (!me.device.pointerEnabled) {	
						// -> define pointerId to simulate the PointerEvent standard
						e.pointerId = obj.changedTouches[t].id;
					}

					/* Initialize the two coordinate space properties. */
					e.gameScreenX = obj.changedTouches[t].x;
					e.gameScreenY = obj.changedTouches[t].y;
					e.gameWorldX = e.gameScreenX + offset.x;
					e.gameWorldY = e.gameScreenY + offset.y;
					// parse all handlers
					for (var i = handlers.length, handler; i--, handler = handlers[i];) {
						/* Set gameX and gameY depending on floating. */
						if (handler.floating === true) {
							e.gameX = e.gameScreenX;
							e.gameY = e.gameScreenY;
						} else {
							e.gameX = e.gameWorldX;
							e.gameY = e.gameWorldY;
						}
						// call the defined handler
						if ((handler.rect === null) || handler.rect.containsPoint(e.gameX, e.gameY)) {
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
		 * translate event coordinates
		 * @ignore
		 */
		function updateCoordFromEvent(e) {
			var local;

			// reset the touch array cache
			obj.changedTouches.length=0;
			
			// PointerEvent or standard Mouse event
			if (!e.touches) {
				local = obj.globalToLocal(e.clientX, e.clientY);
				local.id =  e.pointerId || 1;
				obj.changedTouches.push(local);
			}
			// iOS/Android like touch event
			else {
				for(var i=0, l=e.changedTouches.length; i<l; i++) {
					var t = e.changedTouches[i];
					local = obj.globalToLocal(t.clientX, t.clientY);
					local.id = t.identifier;
					obj.changedTouches.push(local);
				}
			}
			// if event.isPrimary is defined and false, return
			if (e.isPrimary === false) {
				return;
			}
			// Else use the first entry to simulate mouse event
			obj.mouse.pos.set(obj.changedTouches[0].x,obj.changedTouches[0].y);
		}

	
		/**
		 * mouse event management (mousewheel)
		 * @ignore
		 */
		function onMouseWheel(e) {
			/* jshint expr:true */
			if (e.target === me.video.getScreenCanvas()) {
				// create a (fake) normalized event object
				var _event = {
					deltaMode : 1,
					type : "mousewheel",
					deltaX: e.deltaX,
					deltaY: e.deltaY,
					deltaZ: e.deltaZ
				};
				if ( wheeltype === "mousewheel" ) {
					_event.deltaY = - 1/40 * e.wheelDelta;
					// Webkit also support wheelDeltaX
					e.wheelDeltaX && ( _event.deltaX = - 1/40 * e.wheelDeltaX );
				}
				// dispatch mouse event to registered object
				if (dispatchEvent(_event)) {
					// prevent default action
					return preventDefault(e);
				}
			}
			return true;
		}

		
		/**
		 * mouse/touch/pointer event management (move)
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
		 * mouse/touch/pointer event management (start/down, end/up)
		 * @ignore
		 */
		function onPointerEvent(e) {
			// update the pointer position
			updateCoordFromEvent(e);
		
			// dispatch event to registered objects
			if (dispatchEvent(e)) {
				// prevent default action
				return preventDefault(e);
			}

			// in case of touch event button is undefined
			var button = e.button || 0;
			var keycode = obj.mouse.bind[button];

			// check if mapped to a key
			if (keycode) {
				if (e.type === activeEventList[POINTER_DOWN])
					return keydown(e, keycode, button + 1);
				else // 'mouseup' or 'touchend'
					return keyup(e, keycode, button + 1);
			}

			return true;
		}

		/*---------------------------------------------
			
			PUBLIC STUFF
				
		  ---------------------------------------------*/
		
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
		 * time interval for event throttling in milliseconds<br>
		 * default value : "1000/me.sys.fps" ms<br>
		 * set to 0 ms to disable the feature
		 * @public
		 * @type Number
		 * @name throttlingInterval
		 * @memberOf me.input
		 */
		obj.throttlingInterval = undefined;
			
		/**
		 * Array of object containing changed touch information (iOS event model)<br>
		 * properties : <br>
		 * x : x position of the touch event in the canvas (screen coordinates)<br>
		 * y : y position of the touch event in the canvas (screen coordinates)<br>
		 * id : unique finger identifier<br>
		 * @public
		 * @type Array
		 * @name touches
		 * @memberOf me.input
		 */		
		obj.changedTouches = [];
		
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
			'TAB' : 9,
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
		 * @return {Boolean} true if pressed
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
			if (keyStatus[action] && !keyLocked[action]) {
				if (keyLock[action]) {
					keyLocked[action] = true;
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
		 * @return {Boolean} down (true) or up(false)
		 */

		obj.keyStatus = function(action) {
			return (keyStatus[action] > 0);
		};

		
		/**
		 * trigger the specified key (simulated) event <br>
		 * @name triggerKeyEvent
		 * @memberOf me.input
		 * @public
		 * @function
		 * @param {me.input#KEY} keycode
		 * @param {Boolean} true to trigger a key press, or false for key release
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
		 * @param {Boolean} lock cancel the keypress event once read
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

			keyStatus[action] = 0;
			keyLock[action] = lock ? lock : false;
			keyLocked[action] = false;
			keyRefs[action] = {};
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
			keyStatus[KeyBinding[keycode]] = 0;
			keyLock[KeyBinding[keycode]] = false;
			keyRefs[KeyBinding[keycode]] = {};
			// remove the key binding
			KeyBinding[keycode] = null;
		};
		
		/** 
		 * Translate the specified x and y values from the global (absolute) 
		 * coordinate to local (viewport) relative coordinate.
		 * @name globalToLocal
		 * @memberOf me.input
		 * @public
		 * @function
		 * @param {Number} x the global x coordinate to be translated.
		 * @param {Number} y the global y coordinate to be translated.
		 * @return {me.Vector2d} A vector object with the corresponding translated coordinates.
		 * @example
		 * onMouseEvent : function(e) {
		 *    // convert the given into local (viewport) relative coordinates
		 *    var pos = me.input.globalToLocal(e.clientX, e,clientY);
		 *    // do something with pos !
		 * };
		 */
		obj.globalToLocal = function (x, y) {
			var offset = obj.offset;
			var pixelRatio = me.device.getPixelRatio();
			x -= offset.left;
			y -= offset.top;
			var scale = me.sys.scale;
			if (scale.x !== 1.0 || scale.y !== 1.0) {
				x/= scale.x;
				y/= scale.y;
			}
			return new me.Vector2d(x * pixelRatio, y * pixelRatio);
		};

		/**
		 * Associate a mouse (button) action to a keycode<br>
		 * Left button – 0
		 * Middle button – 1
		 * Right button – 2
		 * @name bindMouse
		 * @memberOf me.input
		 * @public
		 * @function
		 * @param {Number} button (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
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
		 * @param {Number} button (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
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
		 * allows registration of event listeners on the object target. <br>
		 * (on a touch enabled device mouse event will automatically be converted to touch event)<br>
		 * <br>
		 * melonJS defines the additional `gameX` and `gameY` properties when passing the Event object <br>
		 * to the defined callback (see below)<br>
		 * @see external:Event
		 * @name registerPointerEvent
		 * @memberOf me.input
		 * @public
		 * @function
		 * @param {String} eventType  The event type for which the object is registering ('mousemove','mousedown','mouseup','mousewheel','touchstart','touchmove','touchend')
		 * @param {me.Rect} rect object target (or corresponding region defined through me.Rect)
		 * @param {Function} callback methods to be called when the event occurs.
		 * @param {Boolean} [floating="floating property of the given object"] specify if the object is a floating object (if yes, screen coordinates are used, if not mouse/touch coordinates will be converted to world coordinates)
		 * @example
		 * // register on the 'mousemove' event
		 * me.input.registerPointerEvent('mousemove', this.collisionBox, this.mouseMove.bind(this));
		 */
		obj.registerPointerEvent = function (eventType, rect, callback, floating) {
		    // make sure the mouse/touch events are initialized
		    enablePointerEvent();

		    // convert mouse events to iOS/PointerEvent equivalent
		    if ((mouseEventList.indexOf(eventType) !== -1) && (me.device.touch || me.device.pointerEnabled)) {
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
		 * allows the removal of event listeners from the object target.
		 * note : on a touch enabled device mouse event will automatically be converted to touch event
		 * @name releasePointerEvent
		 * @memberOf me.input
		 * @public
		 * @function
		 * @param {String} eventType  The event type for which the object is registering ('mousemove', 'mousedown', 'mouseup', 'mousewheel', 'click', 'dblclick', 'touchstart', 'touchmove', 'touchend', 'tap', 'dbltap')
		 * @param {me.Rect} region object target (or corresponding region defined through me.Rect)
		 * @example
		 * // release the registered object/region on the 'mousemove' event
		 * me.input.releasePointerEvent('mousemove', this.collisionBox);
		 */
		obj.releasePointerEvent = function(eventType, rect) {
			// convert mouse events to iOS/MSPointer equivalent
		    if ((mouseEventList.indexOf(eventType) !== -1) && (me.device.touch || me.device.pointerEnabled)) {
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

	    // return our object
		return obj;

	})();

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
