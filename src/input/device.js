(function(window) {
	me.device = (function() {
		// defines object for holding public information/functionality.
		var obj = {};

		/**
		 * Accelerometer information<br>
		 * properties : x, y, z
		 * @public
		 * @enum {number}
		 * @name accel
		 * @memberOf me.device
		 */
		obj.accel = {
			x: 0, 
			y: 0, 
			z: 0
		};

		/** 
		 * Device Orientation. Stores angle in degrees for each axis.
		 * properties : gamma, beta, alpha
		 * @public
		 * @name orientation
		 * @memberOf me.device
		 */
		obj.orientation = {
			gamma: 0,
			beta: 0,
			alpha: 0
		};

		/**
		 * watch Accelerator event 
		 * @name watchAccelerometer
		 * @memberOf me.device
		 * @public
		 * @function
		 * @return {boolean} false if not supported by the device
		 */
		obj.watchAccelerometer = function () {
			if (me.sys.hasAccelerometer) {
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
			if(me.sys.hasDeviceOrientation && !deviceOrientationInitialized) {
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