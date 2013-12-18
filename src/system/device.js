/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013 melonJS
 * http://www.melonjs.org
 *
 */
(function(window) {

	/**	
	 * A singleton object representing the device capabilities and specific events
	 * @namespace me.device
	 * @memberOf me
	 */
	me.device = (function() {
		
		// defines object for holding public information/functionality.
		var obj = {};
		// private properties
		var accelInitialized = false;
		var deviceOrientationInitialized = false;
		var devicePixelRatio = null;

		/**
		 * check the device capapbilities
		 * @ignore
		 */
		obj._check = function() {

			// detect audio capabilities (should be moved here too)
			me.audio.detectCapabilities();

			// future proofing (MS) feature detection
			me.device.pointerEnabled = navigator.pointerEnabled || navigator.msPointerEnabled;
			navigator.maxTouchPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints || 0;
			window.gesture = window.gesture || window.MSGesture;

			// detect touch capabilities
			me.device.touch = ('createTouch' in document) || ('ontouchstart' in window) || 
							  (navigator.isCocoonJS) || (navigator.maxTouchPoints > 0);

			// detect platform
			me.device.isMobile = me.device.ua.match(/Android|iPhone|iPad|iPod|BlackBerry|Windows Phone|Mobi/i) || false;

			// accelerometer detection
			me.device.hasAccelerometer = (
				(typeof (window.DeviceMotionEvent) !== 'undefined') || (
					(typeof (window.Windows) !== 'undefined') && 
					(typeof (Windows.Devices.Sensors.Accelerometer) === 'function')
				)
			);

			if (window.DeviceOrientationEvent) {
				me.device.hasDeviceOrientation = true;
			}

			try {
				obj.localStorage = !!window.localStorage;
			} catch (e) {
				// the above generates an exception when cookies are blocked
				obj.localStorage = false;
			}
		};

		// ----- PUBLIC Properties & Functions -----

		// Browser capabilities

		/**
		 * Browser User Agent
		 * @type Boolean
         * @readonly
		 * @name ua
		 * @memberOf me.device
		 */
		obj.ua = navigator.userAgent;
		/**
		 * Browser Audio capabilities
		 * @type Boolean
         * @readonly
		 * @name sound
		 * @memberOf me.device
		 */
		obj.sound = false;
		/**
		 * Browser Local Storage capabilities <br>
		 * (this flag will be set to false if cookies are blocked) 
		 * @type Boolean
         * @readonly
		 * @name localStorage
		 * @memberOf me.device
		 */
		obj.localStorage = false;
		/**
		 * Browser accelerometer capabilities
		 * @type Boolean
         * @readonly
		 * @name hasAccelerometer
		 * @memberOf me.device
		 */
		obj.hasAccelerometer = false;

		/**
		 * Browser device orientation
		 * @type Boolean
         * @readonly
		 * @name hasDeviceOrientation
		 * @memberOf me.device
		 */
		obj.hasDeviceOrientation = false;

		/**
		 * Browser Base64 decoding capability
		 * @type Boolean
         * @readonly
		 * @name nativeBase64
		 * @memberOf me.device
		 */
		obj.nativeBase64 = (typeof(window.atob) === 'function');

		/**
		 * Touch capabilities
		 * @type Boolean
         * @readonly
		 * @name touch
		 * @memberOf me.device
		 */
		obj.touch = false;

		/**
		 * equals to true if a mobile device <br>
		 * (Android | iPhone | iPad | iPod | BlackBerry | Windows Phone)
		 * @type Boolean
         * @readonly
		 * @name isMobile
		 * @memberOf me.device
		 */
		obj.isMobile = false;
        
        /**
         * The device current orientation status. <br>
         *   0 : default orientation<br>
         *  90 : 90 degrees clockwise from default<br>
         * -90 : 90 degrees anti-clockwise from default<br>
         * 180 : 180 degrees from default
         * @type Number
         * @readonly
         * @name orientation
         * @memberOf me.device
         */
        obj.orientation = 0;

		/**
		 * contains the g-force acceleration along the x-axis.
		 * @public
		 * @type Number
         * @readonly
		 * @name accelerationX
		 * @memberOf me.device
		 */
		obj.accelerationX = 0;

		/**
		 * contains the g-force acceleration along the y-axis.
		 * @public
		 * @type Number
         * @readonly
		 * @name accelerationY
		 * @memberOf me.device
		 */
		obj.accelerationY = 0;

		/**
		 * contains the g-force acceleration along the z-axis.
		 * @public
		 * @type Number
         * @readonly
		 * @name accelerationZ
		 * @memberOf me.device
		 */
		obj.accelerationZ = 0;


		/**
		 * Device orientation Gamma property. Gives angle on tilting a portrait held phone left or right
		 * @public
		 * @type Number
         * @readonly
		 * @name gamma
		 * @memberOf me.device
		 */
		obj.gamma = 0;

		/**
		 * Device orientation Beta property. Gives angle on tilting a portrait held phone forward or backward
		 * @public
		 * @type Number
         * @readonly
		 * @name beta
		 * @memberOf me.device
		 */
		obj.beta = 0;

		/**
		 * Device orientation Alpha property. Gives angle based on the rotation of the phone around its z axis. 
		 * The z-axis is perpendicular to the phone, facing out from the center of the screen.
		 * @public
		 * @type Number
         * @readonly
		 * @name alpha
		 * @memberOf me.device
		 */
		obj.alpha = 0;

		/**
		 * return the device pixel ratio
		 * @name getPixelRatio
		 * @memberOf me.device
		 * @function
		 */
		obj.getPixelRatio = function() {

			if (devicePixelRatio===null) {
				var _context = me.video.getScreenContext();
				var _devicePixelRatio = window.devicePixelRatio || 1,
					_backingStoreRatio = _context.webkitBackingStorePixelRatio ||
					_context.mozBackingStorePixelRatio ||
					_context.msBackingStorePixelRatio ||
					_context.oBackingStorePixelRatio ||
					_context.backingStorePixelRatio || 1;
				devicePixelRatio = _devicePixelRatio / _backingStoreRatio;
			}
			return devicePixelRatio;
		};

		/**
		 * return the device storage
		 * @name getStorage
		 * @memberOf me.device
		 * @function
		 * @param {String} [type="local"]
		 * @return me.save object
		 */
		obj.getStorage = function(type) {

			type = type || "local";

			switch (type) {
				case "local" :
					return me.save;

				default :
					break;
			}
			throw "melonJS : storage type " + type + " not supported";
		};

		/**
		 * event management (Accelerometer)
		 * http://www.mobilexweb.com/samples/ball.html
		 * http://www.mobilexweb.com/blog/safari-ios-accelerometer-websockets-html5
		 * @ignore
		 */
		function onDeviceMotion(e) {
			if (e.reading) {
				// For Windows 8 devices
				obj.accelerationX = e.reading.accelerationX;
				obj.accelerationY = e.reading.accelerationY;
				obj.accelerationZ = e.reading.accelerationZ;
			} else {
				// Accelerometer information
				obj.accelerationX = e.accelerationIncludingGravity.x;
				obj.accelerationY = e.accelerationIncludingGravity.y;
				obj.accelerationZ = e.accelerationIncludingGravity.z;
			}
		}

		function onDeviceRotate(e) {
			obj.gamma = e.gamma;
			obj.beta = e.beta;
			obj.alpha = e.alpha;
		}

		/**
		 * watch Accelerator event 
		 * @name watchAccelerometer
		 * @memberOf me.device
		 * @public
		 * @function
		 * @return {Boolean} false if not supported by the device
		 */
		obj.watchAccelerometer = function () {
			if (me.device.hasAccelerometer) {
				if (!accelInitialized) {
					if (typeof Windows === 'undefined') {
						// add a listener for the devicemotion event
						window.addEventListener('devicemotion', onDeviceMotion, false);
					} else {
						// On Windows 8 Device
						var accelerometer = Windows.Devices.Sensors.Accelerometer.getDefault();
						if (accelerometer) {
							// Capture event at regular intervals
							var minInterval = accelerometer.minimumReportInterval;
							var Interval = minInterval >= 16 ? minInterval : 25;
							accelerometer.reportInterval = Interval;

							accelerometer.addEventListener('readingchanged', onDeviceMotion, false);
						}
					}
					accelInitialized = true;
				}
				return true;
			}
			return false;
		};
		
		/**
		 * unwatch Accelerometor event 
		 * @name unwatchAccelerometer
		 * @memberOf me.device
		 * @public
		 * @function
		 */
		obj.unwatchAccelerometer = function() {
			if (accelInitialized) {
				if (typeof Windows === 'undefined') {
					// add a listener for the mouse
					window.removeEventListener('devicemotion', onDeviceMotion, false);
				} else {
					// On Windows 8 Devices
					var accelerometer = Windows.Device.Sensors.Accelerometer.getDefault();

					accelerometer.removeEventListener('readingchanged', onDeviceMotion, false);
				}
				accelInitialized = false;
			}
		};

		/**
		 * watch the device orientation event 
		 * @name watchDeviceOrientation
		 * @memberOf me.device
		 * @public
		 * @function
		 * @return {Boolean} false if not supported by the device
		 */
		obj.watchDeviceOrientation = function() {
			if(me.device.hasDeviceOrientation && !deviceOrientationInitialized) {
				window.addEventListener('deviceorientation', onDeviceRotate, false);
				deviceOrientationInitialized = true;
			}
			return false;
		};

		/**
		 * unwatch Device orientation event 
		 * @name unwatchDeviceOrientation
		 * @memberOf me.device
		 * @public
		 * @function
		 */
		obj.unwatchDeviceOrientation = function() {
			if(deviceOrientationInitialized) {
				window.removeEventListener('deviceorientation', onDeviceRotate, false);
				deviceOrientationInitialized = false;
			}
		};

		return obj;
	})();
})(window);
