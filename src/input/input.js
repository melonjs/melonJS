/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($, undefined) 
{
	
	/**
	 * There is no constructor function for me.input.
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	input = (function()
	{	
		
		// hold public stuff in our singletong
		var obj	= {};
		
		/*---------------------------------------------
			
			PRIVATE STUFF
				
		  ---------------------------------------------*/

		// list of binded keys
		var KeyBinding = [];
		
		// corresponding actions
		var keyStatus = [];
		
		// lock enable flag for keys
		var keyLock	= [];
		// actual lock status of each key
		var keyLocked	= [];
		
		// callback function for mouse & gyro
		var mouseEventCB  = null;
		var gyroEventCB	= null;
		
		// some usefull flags
		var keyboardInitialized = false;
		
		
		/*---
			
			enable keyboard event
				
			---*/
		function enableKeyboardEvent (enable)
		{
			if (enable)
			{
				// Event Management
				if (!keyboardInitialized)
				{
					$.addEventListener('keydown',keydown,false);
					$.addEventListener('keyup',keyup,false);
				}
			}
			else
			{
				// remove the even listeners
				$.removeEventListener('keydown',keydown,false);
				$.removeEventListener('keyup',keyup,false);
			}
			keyboardInitialized = enable;
		};

		
		
		/* ---
			
			prevent event propagation
				
			---*/    
		function preventDefault(e)
		{
			e.stopPropagation();
			if (e.preventDefault)
				e.preventDefault();
			e.returnValue = false;
			//e.cancelBubble = true;
		};
		
		/* ---
			
			key down event
				
			---	*/    
		/*
		function dispatchEvent (e)
		{
			var action = KeyBinding[e.keyCode || e.which];
			
			if(action)
			{
				console.log(e);
				if ((e.type === "keydown")&&(!keyLocked[action]))
				{
						keyStatus[action] = true;
						// lock the key if requested
						keyLocked[action] = keyLock[action];
				} 
				else if(e.type === "keyup")
				{
					keyStatus[action] = false;
					keyLocked[action] = false;
				}
			}
			// prevent event propagation
			preventDefault(event);
			return false;
		};
		*/

		
		function keydown (e)
		{
			
			var action = KeyBinding[e.keyCode|| e.which];
			
			if(action)
			{
				//console.log(e, action);
			
				//console.log(action);
				if (!keyLocked[action])
				{
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
		
		/* ---
			
			key up event
				
			---	*/ 
		function keyup (e)
		{
			
			
			var action = KeyBinding[e.keyCode|| e.which];
			
			//console.log(e, action);
			
			if (action)
			{
				
				keyStatus[action] = false;
				keyLocked[action] = false;
				// prevent the event propagation
				preventDefault(e);
				return false;
			}
			return true;
			
		};
	
		/* ---
		
			 mouse event management (click)
			
			---										*/    
		function onMouseEvent(e)
		{
			var x = e.clientX - me.video.getScreenCanvas().offsetLeft;
			var y = e.clientY - me.video.getScreenCanvas().offsetTop;
				
			// propagate the event to the callback with x,y coords
			mouseEventCB(x, y);
		
		};
	
	
	
		/* ---
			
				 event management (Gyroscopic)
				
				---										*/    
		function onGyroEvent(event)
		{
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
		};

	
		
		/*---------------------------------------------
			
			PUBLIC STUFF
				
		  ---------------------------------------------*/
		
		/**
       * list of mappable keys :
       * LEFT, UP, RIGHT, DOWN, ENTER, SHIFT, CTRL, ALT, PAUSE, ESC, ESCAPE, [0..9], [A..Z]
       * @public
       * @enum {number}
       * @name me.input#KEY
       */		
		obj.KEY = { 'LEFT'	: 37,
						'UP'		: 38,
						'RIGHT'	: 39,
						'DOWN'	: 40,
						'ENTER'	: 13,
						'SHIFT'	: 16,
						'CTRL'	: 17,
						'ALT'		: 18,
						'PAUSE'	: 19,
						'ESC'		: 27,
						'SPACE'	: 32,
						'0'		: 48,
						'1'		: 49,
						'2'		: 50,
						'3'		: 51,
						'4'		: 52,
						'5'		: 53,
						'6'		: 54,
						'7'		: 55,
						'8'		: 56,
						'9'		: 57,
						'A'		: 65,
						'B'		: 66,
						'C'		: 67,
						'D'		: 68,
						'E'		: 69,
						'F'		: 70,
						'G'		: 71,
						'H'		: 72,
						'I'		: 73,
						'J'		: 74,
						'K'		: 75,
						'L'		: 76,
						'M'		: 77,
						'N'		: 78,
						'O'		: 79,
						'P'		: 80,
						'Q'		: 81,
						'R'		: 82,
						'S'		: 83,
						'T'		: 84,
						'U'		: 85,
						'V'		: 86,
						'W'		: 87,
						'X'		: 88,
						'Y'		: 89,
						'Z'		: 90,
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

		obj.isKeyPressed = function (action)
		{
			if (keyStatus[action])
			{
				if (keyLock[action])
				{
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

		obj.keyStatus = function (action)
		{
			return (keyLocked[action]===true)? true : keyStatus[action];
		};

	
		
		/**
		 * associate a user defined action to a keycode
		 * @name me.input#bindKey
		 * @public
		 * @function
       *	@param {me.input#KEY} keycode
       *	@param {String} action user defined corresponding action
       *	@param {boolean} lock cancel the keypress event once read
       * @example
       * // enable the keyboard
		 * me.input.bindKey(me.input.KEY.LEFT,  "left");
		 * me.input.bindKey(me.input.KEY.RIGHT, "right");
		 * me.input.bindKey(me.input.KEY.X,     "jump", true);
		 */
		obj.bindKey = function (keycode, action, lock)
		{
			if (!keyboardInitialized)
				enableKeyboardEvent(true);
			
			KeyBinding[keycode]=action;
			
			keyLock[action] = lock?lock:false;
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
		obj.unbindKey = function (keycode)
		{
			// clear the event status
			keyStatus[KeyBinding[keycode]] = false;
			keyLock[KeyBinding[keycode]] = false;
			// remove the key binding
			KeyBinding[keycode]=null;
		};

		
		/**
		 * enable mouse event
		 * @name me.input#enableMouseEvent
		 * @public
		 * @function
       * @deprecated to be rewritten
		 */
		obj.enableMouseEvent = function (enable, callback)
		{
			if (enable)
			{
				// add a listener for the mouse
				me.video.getScreenCanvas().addEventListener('click',onMouseEvent, false);
				// set the callback
				mouseEventCB = callback || me.game.mouseEvent.bind(me.game);
			}
			else
			{	
				me.video.getScreenCanvas().removeEventListener('click',onMouseEvent, false);
			}
		};
	
		/**
		 * enable gyroscopic event (not implemented)
		 * @name me.input#enableGyroscopicEvent
		 * @public
		 * @function
		 */
		obj.enableGyroscopicEvent = function (enable, callback)
		{
			if ($.sys.gyro)
			{
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
	// expose our stuff to the global scope
	/*---------------------------------------------------------*/
	$.me.input	= input;

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);	


