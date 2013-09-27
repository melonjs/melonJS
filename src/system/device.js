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
		var accelInitialized = false;
		var deviceOrientationInitialized = false;
		
		// Browser capabilities
		/**
		 * Browser User Agent (read-only)
		 * @type Boolean
		 * @name ua
		 * @memberOf me.device
		 */
		obj.ua = navigator.userAgent;
		/**
		 * Browser Audio capabilities (read-only) <br>
		 * @type Boolean
		 * @name sound
		 * @memberOf me.device
		 */
		obj.sound = false;
		/**
		 * Browser Local Storage capabilities (read-only) <br>
		 * @type Boolean
		 * @name localStorage
		 * @memberOf me.device
		 */
		obj.localStorage = (typeof(window.localStorage) === 'object');
		/**
		 * Browser accelerometer capabilities (read-only) <br>
		 * @type Boolean
		 * @name hasAccelerometer
		 * @memberOf me.device
		 */
		obj.hasAccelerometer = false;

		/**
		 * Browser device orientation
		 * @type Boolean
		 * @name hasDeviceOrientation
		 * @memberOf me.device
		 */
		obj.hasDeviceOrientation = false;

		/**
		 * Browser Base64 decoding capability (read-only) <br>
		 * @type Boolean
		 * @name nativeBase64
		 * @memberOf me.device
		 */
		obj.nativeBase64 = (typeof(window.atob) === 'function');

		/**
		 * Touch capabilities <br>
		 * @type Boolean
		 * @name touch
		 * @memberOf me.device
		 */
		obj.touch = false;

		/**
		 * equals to true if a mobile device (read-only) <br>
		 * (Android | iPhone | iPad | iPod | BlackBerry | Windows Phone)
		 * @type Boolean
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
         * @name orientation
         * @memberOf me.device
         */
        obj.orientation = 0;

		/**
		 * contains the g-force acceleration along the x-axis.
		 * @public
		 * @type Number
		 * @name accelerationX
		 * @memberOf me.device
		 */
		obj.accelerationX = 0;

		/**
		 * contains the g-force acceleration along the y-axis.
		 * @public
		 * @type Number
		 * @name accelerationY
		 * @memberOf me.device
		 */
		obj.accelerationY = 0;

		/**
		 * contains the g-force acceleration along the z-axis.
		 * @public
		 * @type Number
		 * @name accelerationZ
		 * @memberOf me.device
		 */
		obj.accelerationZ = 0;


		/**
		 * Device orientation Gamma property. Gives angle on tilting a portrait held phone left or right
		 * @public
		 * @type Number
		 * @name gamma
		 * @memberOf me.device
		 */
		obj.gamma = 0;

		/**
		 * Device orientation Beta property. Gives angle on tilting a portrait held phone forward or backward
		 * @public
		 * @type Number
		 * @name beta
		 * @memberOf me.device
		 */
		obj.beta = 0;

		/**
		 * Device orientation Alpha property. Gives angle based on the rotation of the phone around its z axis. 
		 * The z-axis is perpendicular to the phone, facing out from the center of the screen.
		 * @public
		 * @type Number
		 * @name alpha
		 * @memberOf me.device
		 */
		obj.alpha = 0;

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
		 * @return {boolean} false if not supported by the device
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
		 * @return {boolean} false if not supported by the device
		 */
		obj.watchDeviceOrientation = function() {
			if(me.device.hasDeviceOrientation && !deviceOrientationInitialized) {
				window.addEventListener('deviceorientation', onDeviceRotate, false);
				deviceOrientationInitialized = true;
			}
			return false;
		}

		/**
		 * unwatch Device orientation event 
		 * @name unwatchAccelerometer
		 * @memberOf me.device
		 * @public
		 * @function
		 */
		obj.unwatchDeviceOrientation = function() {
			if(deviceOrientationInitialized) {
				window.removeEventListener('deviceorientation', onDeviceRotate, false);
				deviceOrientationInitialized = false;
			}
		}

		return obj;
	})();
})(window);
