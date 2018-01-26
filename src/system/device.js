/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 *
 */

(function () {
    /**
     * A singleton object representing the device capabilities and specific events
     * @namespace me.device
     * @memberOf me
     */
    me.device = (function () {
        // defines object for holding public information/functionality.
        var api = {};
        // private properties
        var accelInitialized = false;
        var deviceOrientationInitialized = false;
        var devicePixelRatio = null;

        // swipe utility fn & flag
        var swipeEnabled = true;
        var disableSwipeFn = function (e) {
            e.preventDefault();
            if (!me.device.isWxSmallGame)
            {
                // There is not DOM in WxSmallGame runtime.
                window.scroll(0, 0);
            }
            
            return false;
        };

        /*
         * DOM loading stuff
         */
        var readyBound = false, isReady = false, readyList = [];

        /**
         * called to check if the device is ready
         * @ignore
         */
        api._domReady = function (fn) {
            // Make sure that the DOM is not already loaded
            if (!isReady) {
                // be sure document.body is there
                if (!document.body) {
                    return setTimeout(me.device._domReady, 13);
                }

                // clean up loading event
                if (document.removeEventListener) {
                    document.removeEventListener(
                        "DOMContentLoaded",
                        me.device._domReady,
                        false
                    );
                }
                // remove the event on window.onload (always added in `onReady`)
                window.removeEventListener("load", me.device._domReady, false);

                // execute all callbacks
                while (readyList.length) {
                    readyList.shift().call(window, []);
                }

                // Remember that the DOM is ready
                isReady = true;
            }
        };

        /**
         * check the device capapbilities
         * @ignore
         */
        api._check = function () {

            // detect device type/platform
            me.device._detectDevice();

            // Mobile browser hacks
            if (me.device.isMobile && !me.device.cocoon) {
                // Prevent the webview from moving on a swipe
                api.enableSwipe(false);
            }

            // Touch/Gesture Event feature detection
            me.device.TouchEvent = !!("ontouchstart" in window);
            me.device.PointerEvent = !!window.PointerEvent;
            window.gesture = me.agent.prefixed("gesture");

            // detect touch capabilities
            me.device.touch = (me.device.cocoon) || me.device.TouchEvent || me.device.PointerEvent;

            // max amount of touch points ; always at least return 1 (e.g. headless chrome will return 0)
            me.device.maxTouchPoints = me.device.touch ? (me.device.PointerEvent ? navigator.maxTouchPoints || 1 : 10) : 1;

            // detect wheel event support
            // Modern browsers support "wheel", Webkit and IE support at least "mousewheel
            me.device.wheel = ("onwheel" in document.createElement("div"));

            // accelerometer detection
            me.device.hasAccelerometer = (
                (typeof (window.DeviceMotionEvent) !== "undefined") || (
                    (typeof (window.Windows) !== "undefined") &&
                    (typeof (Windows.Devices.Sensors.Accelerometer) === "function")
                )
            );

            // pointerlock detection
            this.hasPointerLockSupport = me.agent.prefixed("pointerLockElement", document);

            if (this.hasPointerLockSupport) {
                document.exitPointerLock = me.agent.prefixed("exitPointerLock", document);
            }

            // device orientation and motion detection
            if (window.DeviceOrientationEvent) {
                me.device.hasDeviceOrientation = true;
            }
            if (typeof window.screen !== "undefined") {
                var screen = window.screen;
                screen.orientation = me.agent.prefixed("orientation", screen);
                screen.lockOrientation = me.agent.prefixed("lockOrientation", screen);
                screen.unlockOrientation = me.agent.prefixed("unlockOrientation", screen);
            }

            // fullscreen api detection & polyfill when possible
            this.hasFullscreenSupport = me.agent.prefixed("fullscreenEnabled", document) ||
                                        document.mozFullScreenEnabled;

            document.exitFullscreen = me.agent.prefixed("cancelFullScreen", document) ||
                                      me.agent.prefixed("exitFullscreen", document);

            // vibration API poyfill
            navigator.vibrate = me.agent.prefixed("vibrate", navigator);

            try {
                api.localStorage = !!window.localStorage;
            } catch (e) {
                // the above generates an exception when cookies are blocked
                api.localStorage = false;
            }

            // set pause/stop action on losing focus
            window.addEventListener("blur", function () {
                if (me.sys.stopOnBlur) {
                    me.state.stop(true);
                }
                if (me.sys.pauseOnBlur) {
                    me.state.pause(true);
                }
            }, false);
            // set restart/resume action on gaining focus
            window.addEventListener("focus", function () {
                if (me.sys.stopOnBlur) {
                    me.state.restart(true);
                }
                if (me.sys.resumeOnFocus) {
                    me.state.resume(true);
                }
            }, false);


            // Set the name of the hidden property and the change event for visibility
            var hidden, visibilityChange;
            if (typeof document.hidden !== "undefined") {
                // Opera 12.10 and Firefox 18 and later support
                hidden = "hidden";
                visibilityChange = "visibilitychange";
            } else if (typeof document.mozHidden !== "undefined") {
                hidden = "mozHidden";
                visibilityChange = "mozvisibilitychange";
            } else if (typeof document.msHidden !== "undefined") {
                hidden = "msHidden";
                visibilityChange = "msvisibilitychange";
            } else if (typeof document.webkitHidden !== "undefined") {
                hidden = "webkitHidden";
                visibilityChange = "webkitvisibilitychange";
            }

            // register on the event if supported
            if (typeof (visibilityChange) === "string") {
                // add the corresponding event listener
                document.addEventListener(visibilityChange,
                    function () {
                        if (document[hidden]) {
                            if (me.sys.stopOnBlur) {
                                me.state.stop(true);
                            }
                            if (me.sys.pauseOnBlur) {
                                me.state.pause(true);
                            }
                        } else {
                            if (me.sys.stopOnBlur) {
                                me.state.restart(true);
                            }
                            if (me.sys.resumeOnFocus) {
                                me.state.resume(true);
                            }
                        }
                    }, false
                );
            }
        };

        /**
         * detect the device type
         * @ignore
         */
        api._detectDevice = function () {
            // iOS Device ?
            me.device.iOS = /iPhone|iPad|iPod/i.test(me.device.ua);
            // Android Device ?
            me.device.android = /Android/i.test(me.device.ua);
            me.device.android2 = /Android 2/i.test(me.device.ua);
            // Chrome OS ?
            me.device.chromeOS = /CrOS/.test(me.device.ua);
            // Windows Device ?
            me.device.wp = /Windows Phone/i.test(me.device.ua);
            // Kindle device ?
            me.device.BlackBerry = /BlackBerry/i.test(me.device.ua);
            // Kindle device ?
            me.device.Kindle = /Kindle|Silk.*Mobile Safari/i.test(me.device.ua);

            // Mobile platform
            me.device.isMobile = /Mobi/i.test(me.device.ua) ||
                                 me.device.iOS ||
                                 me.device.android ||
                                 me.device.wp ||
                                 me.device.BlackBerry ||
                                 me.device.Kindle || false;

            // Wechat small game platform
            me.device.isWxSmallGame = (typeof wx !== "undefined");
            // ejecta
            me.device.ejecta = (typeof window.ejecta !== "undefined");

            // cocoon/cocoonJS
            me.device.cocoon = navigator.isCocoonJS ||  // former cocoonJS
                               (typeof window.Cocoon !== "undefined"); // new cocoon

        };


        /*
         * PUBLIC Properties & Functions
         */

        // Browser capabilities

        /**
         * the `ua` read-only property returns the user agent string for the current browser.
         * @type String
         * @readonly
         * @name ua
         * @memberOf me.device
         */
        api.ua = navigator.userAgent;

        /**
         * Browser Local Storage capabilities <br>
         * (this flag will be set to false if cookies are blocked)
         * @type Boolean
         * @readonly
         * @name localStorage
         * @memberOf me.device
         */
        api.localStorage = false;

        /**
         * Browser accelerometer capabilities
         * @type Boolean
         * @readonly
         * @name hasAccelerometer
         * @memberOf me.device
         */
        api.hasAccelerometer = false;

        /**
         * Browser device orientation
         * @type Boolean
         * @readonly
         * @name hasDeviceOrientation
         * @memberOf me.device
         */
        api.hasDeviceOrientation = false;

        /**
         * Browser full screen support
         * @type Boolean
         * @readonly
         * @name hasFullscreenSupport
         * @memberOf me.device
         */
        api.hasFullscreenSupport = false;

         /**
         * Browser pointerlock api support
         * @type Boolean
         * @readonly
         * @name hasPointerLockSupport
         * @memberOf me.device
         */
        api.hasPointerLockSupport = false;

        /**
         * Browser Base64 decoding capability
         * @type Boolean
         * @readonly
         * @name nativeBase64
         * @memberOf me.device
         */
        api.nativeBase64 = (typeof(window.atob) === "function");

        /**
         * Return  the maximum number of simultaneous touch contact points are supported by the current device.
         * @type Number
         * @readonly
         * @name maxTouchPoints
         * @memberOf me.device
         * @example
         * if (me.device.maxTouchPoints > 1) {
         *     // device supports multi-touch
         * }
         */
        api.maxTouchPoints = 1;

        /**
         * Touch capabilities
         * @type Boolean
         * @readonly
         * @name touch
         * @memberOf me.device
         */
        api.touch = false;

        /**
         * W3C standard wheel events
         * @type Boolean
         * @readonly
         * @name wheel
         * @memberOf me.device
         */
        api.wheel = false;

        /**
         * equals to true if a mobile device <br>
         * (Android | iPhone | iPad | iPod | BlackBerry | Windows Phone | Kindle)
         * @type Boolean
         * @readonly
         * @name isMobile
         * @memberOf me.device
         */
        api.isMobile = false;

        /**
         * equals to true if the device is an iOS platform.
         * @type Boolean
         * @readonly
         * @name iOS
         * @memberOf me.device
         */
        api.iOS = false;

        /**
         * equals to true if the device is an Android platform.
         * @type Boolean
         * @readonly
         * @name android
         * @memberOf me.device
         */
        api.android = false;

        /**
         * equals to true if the device is an Android 2.x platform.
         * @type Boolean
         * @readonly
         * @name android2
         * @memberOf me.device
         */
        api.android2 = false;

       /**
        * equals to true if the game is running under Ejecta.
        * @type Boolean
        * @readonly
        * @see http://impactjs.com/ejecta
        * @name ejecta
        * @memberOf me.device
        */
        api.ejecta = false;

        /**
         * equals to true if the game is running under cocoon/cocoonJS.
         * @type Boolean
         * @readonly
         * @see https://cocoon.io
         * @name cocoon
         * @memberOf me.device
         */
         api.cocoon = false;

        /**
         * equals to true if the device is running on ChromeOS.
         * @type Boolean
         * @readonly
         * @name chromeOS
         * @memberOf me.device
         */
        api.chromeOS = false;

         /**
         * equals to true if the device is a Windows Phone platform.
         * @type Boolean
         * @readonly
         * @name wp
         * @memberOf me.device
         */
        api.wp = false;

        /**
         * equals to true if the device is a BlackBerry platform.
         * @type Boolean
         * @readonly
         * @name BlackBerry
         * @memberOf me.device
         */
        api.BlackBerry = false;

        /**
         * equals to true if the device is a Kindle platform.
         * @type Boolean
         * @readonly
         * @name Kindle
         * @memberOf me.device
         */
        api.Kindle = false;

        /**
         * equals to true if the device is running under wechat small game platform.
         * @type Boolean
         * @readonly
         * @name isWxSmallGame
         * @memberOf me.device
         */
        api.isWxSmallGame = false;

        /**
         * contains the g-force acceleration along the x-axis.
         * @public
         * @type Number
         * @readonly
         * @name accelerationX
         * @memberOf me.device
         */
        api.accelerationX = 0;

        /**
         * contains the g-force acceleration along the y-axis.
         * @public
         * @type Number
         * @readonly
         * @name accelerationY
         * @memberOf me.device
         */
        api.accelerationY = 0;

        /**
         * contains the g-force acceleration along the z-axis.
         * @public
         * @type Number
         * @readonly
         * @name accelerationZ
         * @memberOf me.device
         */
        api.accelerationZ = 0;

        /**
         * Device orientation Gamma property. Gives angle on tilting a portrait held phone left or right
         * @public
         * @type Number
         * @readonly
         * @name gamma
         * @memberOf me.device
         */
        api.gamma = 0;

        /**
         * Device orientation Beta property. Gives angle on tilting a portrait held phone forward or backward
         * @public
         * @type Number
         * @readonly
         * @name beta
         * @memberOf me.device
         */
        api.beta = 0;

        /**
         * Device orientation Alpha property. Gives angle based on the rotation of the phone around its z axis.
         * The z-axis is perpendicular to the phone, facing out from the center of the screen.
         * @public
         * @type Number
         * @readonly
         * @name alpha
         * @memberOf me.device
         */
        api.alpha = 0;

        /**
         * a string representing the preferred language of the user, usually the language of the browser UI.
         * (will default to "en" if the information is not available)
         * @public
         * @type String
         * @readonly
         * @see http://www.w3schools.com/tags/ref_language_codes.asp
         * @name language
         * @memberOf me.device
         */
        api.language = navigator.language || navigator.browserLanguage || navigator.userLanguage || "en";

      /**
        * specify a function to execute when the Device is fully loaded and ready
        * @name onReady
        * @memberOf me.device
        * @function
        * @param {Function} fn the function to be executed
        * @example
        * // small game skeleton
        * var game = {
        *    // called by the me.device.onReady function
        *    onload : function () {
        *       // init video
        *       if (!me.video.init('screen', 640, 480, true)) {
        *          alert("Sorry but your browser does not support html 5 canvas.");
        *          return;
        *       }
        *
        *       // initialize the "audio"
        *       me.audio.init("mp3,ogg");
        *
        *       // set callback for ressources loaded event
        *       me.loader.onload = this.loaded.bind(this);
        *
        *       // set all ressources to be loaded
        *       me.loader.preload(game.assets);
        *
        *       // load everything & display a loading screen
        *       me.state.change(me.state.LOADING);
        *    },
        *
        *    // callback when everything is loaded
        *    loaded : function () {
        *       // define stuff
        *       // ....
        *
        *       // change to the menu screen
        *       me.state.change(me.state.PLAY);
        *    }
        * }; // game
        *
        * // "bootstrap"
        * me.device.onReady(function () {
        *    game.onload();
        * });
        */
        api.onReady = function (fn) {
            // If the DOM is already ready
            if (isReady) {
                // Execute the function immediately
                fn.call(window, []);
            }
            else {
                // Add the function to the wait list
                readyList.push(fn);

                // attach listeners if not yet done
                if (!readyBound) {
                    // directly call domReady if document is already "ready"
                    if (document.readyState === "complete") {
                        // defer the fn call to ensure our script is fully loaded
                        window.setTimeout(me.device._domReady, 0);
                    }
                    else {
                        if (document.addEventListener) {
                            // Use the handy event callback
                            document.addEventListener("DOMContentLoaded", me.device._domReady, false);
                        }
                        // A fallback to window.onload, that will always work
                        window.addEventListener("load", me.device._domReady, false);
                    }
                    readyBound = true;
                }
            }
        };

        /**
         * enable/disable swipe on WebView.
         * @name enableSwipe
         * @memberOf me.device
         * @function
         * @param {boolean} [enable=true] enable or disable swipe.
         */
        api.enableSwipe = function (enable) {
            if (enable !== false) {
                if (swipeEnabled === false) {
                    window.document.removeEventListener("touchmove", disableSwipeFn, false);
                    swipeEnabled = true;
                }
            } else if (swipeEnabled === true) {
                window.document.addEventListener("touchmove", disableSwipeFn, false);
                swipeEnabled = false;
            }
        };

        /**
         * Triggers a fullscreen request. Requires fullscreen support from the browser/device.
         * @name requestFullscreen
         * @memberOf me.device
         * @function
         * @param {Object} [element=default canvas object] the element to be set in full-screen mode.
         * @example
         * // add a keyboard shortcut to toggle Fullscreen mode on/off
         * me.input.bindKey(me.input.KEY.F, "toggleFullscreen");
         * me.event.subscribe(me.event.KEYDOWN, function (action, keyCode, edge) {
         *    // toggle fullscreen on/off
         *    if (action === "toggleFullscreen") {
         *       if (!me.device.isFullscreen) {
         *          me.device.requestFullscreen();
         *       } else {
         *          me.device.exitFullscreen();
         *       }
         *    }
         * });
         */
        api.requestFullscreen = function (element) {
            if (this.hasFullscreenSupport) {
                element = element || me.video.getWrapper();
                element.requestFullscreen = me.agent.prefixed("requestFullscreen", element) ||
                                            element.mozRequestFullScreen;

                element.requestFullscreen();
            }
        };

        /**
         * Exit fullscreen mode. Requires fullscreen support from the browser/device.
         * @name exitFullscreen
         * @memberOf me.device
         * @function
         */
        api.exitFullscreen = function () {
            if (this.hasFullscreenSupport) {
                document.exitFullscreen();
            }
        };

        /**
         * return the device pixel ratio
         * @name getPixelRatio
         * @memberOf me.device
         * @function
         */
        api.getPixelRatio = function () {

            if (devicePixelRatio === null) {
                var _context;
                if (typeof me.video.renderer !== "undefined") {
                    _context = me.video.renderer.getScreenContext();
                } else {
                    _context = me.Renderer.prototype.getContext2d(document.createElement("canvas"));
                }
                var _devicePixelRatio = window.devicePixelRatio || 1,
                    _backingStoreRatio = me.agent.prefixed("backingStorePixelRatio", _context) || 1;
                devicePixelRatio = _devicePixelRatio / _backingStoreRatio;
            }
            return devicePixelRatio;
        };

        /**
         * Return a string representing the orientation of the device screen.
         * It can be "any", "natural", "landscape", "portrait", "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"
         * @name getScreenOrientation
         * @memberOf me.device
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
         * @function
         * @return {String} the screen orientation
         */
        api.getScreenOrientation = function () {
            var PORTRAIT = "portrait";
            var LANDSCAPE = "landscape";

            var screen = window.screen;

            // first try using "standard" values
            if (typeof screen !== "undefined") {
                var orientation = screen.orientation
                if ((typeof orientation !== "undefined") && typeof (orientation.type === "string")) {
                    // Screen Orientation API specification
                    return orientation.type;
                } else if (typeof orientation === "string") {
                    // moz/ms-orientation are strings
                    return orientation;
                }
            }

            // check using the deprecated API
            if (typeof window.orientation === "number") {
                return (Math.abs(window.orientation) === 90) ? LANDSCAPE : PORTRAIT;
            }

            // fallback to window size check
            return (window.outerWidth > window.outerHeight) ? LANDSCAPE : PORTRAIT;
        };

        /**
         * locks the device screen into the specified orientation.<br>
         * This method only works for installed Web apps or for Web pages in full-screen mode.
         * @name lockOrientation
         * @memberOf me.device
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
         * @function
         * @return {Boolean} true if the orientation was unsuccessfully locked
         */
        api.lockOrientation = function (orientation) {
            if (typeof window.screen !== "undefined") {
                if (typeof screen.lockOrientation !== "undefined") {
                    return screen.lockOrientation(orientation);
                }
            }
            return false;
        };

        /**
         * unlocks the device screen into the specified orientation.<br>
         * This method only works for installed Web apps or for Web pages in full-screen mode.
         * @name unlockOrientation
         * @memberOf me.device
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
         * @function
         * @return {Boolean} true if the orientation was unsuccessfully unlocked
         */
        api.unlockOrientation = function (orientation) {
            if (typeof window.screen !== "undefined") {
                if (typeof screen.unlockOrientation !== "undefined") {
                    return screen.unlockOrientation(orientation);
                }
            }
            return false;
        };

        /**
         * return true if the device screen orientation is in Portrait mode
         * @name isPortrait
         * @memberOf me.device
         * @function
         * @return {Boolean}
         */
        api.isPortrait = function () {
            return me.device.getScreenOrientation().includes("portrait");
        };

        /**
         * return true if the device screen orientation is in Portrait mode
         * @name isLandscape
         * @memberOf me.device
         * @function
         * @return {Boolean}
         */
        api.isLandscape = function () {
            return me.device.getScreenOrientation().includes("landscape");
        };

        /**
         * return the device storage
         * @name getStorage
         * @memberOf me.device
         * @function
         * @param {String} [type="local"]
         * @return me.save object
         */
        api.getStorage = function (type) {

            type = type || "local";

            switch (type) {
                case "local" :
                    return me.save;

                default :
                    throw new me.Error("storage type " + type + " not supported");
            }
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
                api.accelerationX = e.reading.accelerationX;
                api.accelerationY = e.reading.accelerationY;
                api.accelerationZ = e.reading.accelerationZ;
            }
            else {
                // Accelerometer information
                api.accelerationX = e.accelerationIncludingGravity.x;
                api.accelerationY = e.accelerationIncludingGravity.y;
                api.accelerationZ = e.accelerationIncludingGravity.z;
            }
        }

        function onDeviceRotate(e) {
            api.gamma = e.gamma;
            api.beta = e.beta;
            api.alpha = e.alpha;
        }

        /**
         * Enters pointer lock, requesting it from the user first. Works on supported devices & browsers
         * Must be called in a click event or an event that requires user interaction.
         * If you need to run handle events for errors or change of the pointer lock, see below.
         * @name turnOnPointerLock
         * @memberOf me.device
         * @function
         * @example
         * document.addEventListener("pointerlockchange", pointerlockchange, false);
         * document.addEventListener("mozpointerlockchange", pointerlockchange, false);
         * document.addEventListener("webkitpointerlockchange", pointerlockchange, false);
         *
         * document.addEventListener("pointerlockerror", pointerlockerror, false);
         * document.addEventListener("mozpointerlockerror", pointerlockerror, false);
         * document.addEventListener("webkitpointerlockerror", pointerlockerror, false);
         */
        api.turnOnPointerLock = function () {
            if (this.hasPointerLockSupport) {
                var element = me.video.getWrapper();
                if (me.device.ua.match(/Firefox/i)) {
                    var fullscreenchange = function () {
                        if ((me.agent.prefixed("fullscreenElement", document) ||
                            document.mozFullScreenElement) === element) {

                            document.removeEventListener("fullscreenchange", fullscreenchange);
                            document.removeEventListener("mozfullscreenchange", fullscreenchange);
                            element.requestPointerLock = me.agent.prefixed("requestPointerLock", element);
                            element.requestPointerLock();
                        }
                    };

                    document.addEventListener("fullscreenchange", fullscreenchange, false);
                    document.addEventListener("mozfullscreenchange", fullscreenchange, false);

                    me.device.requestFullscreen();

                }
                else {
                    element.requestPointerLock();
                }
            }
        };

        /**
         * Exits pointer lock. Works on supported devices & browsers
         * @name turnOffPointerLock
         * @memberOf me.device
         * @function
         */
        api.turnOffPointerLock = function () {
            if (this.hasPointerLockSupport) {
                document.exitPointerLock();
            }
        };

        /**
         * watch Accelerator event
         * @name watchAccelerometer
         * @memberOf me.device
         * @public
         * @function
         * @return {Boolean} false if not supported by the device
         */
        api.watchAccelerometer = function () {
            if (me.device.hasAccelerometer) {
                if (!accelInitialized) {
                    if (typeof Windows === "undefined") {
                        // add a listener for the devicemotion event
                        window.addEventListener("devicemotion", onDeviceMotion, false);
                    }
                    else {
                        // On Windows 8 Device
                        var accelerometer = Windows.Devices.Sensors.Accelerometer.getDefault();
                        if (accelerometer) {
                            // Capture event at regular intervals
                            var minInterval = accelerometer.minimumReportInterval;
                            var Interval = minInterval >= 16 ? minInterval : 25;
                            accelerometer.reportInterval = Interval;

                            accelerometer.addEventListener("readingchanged", onDeviceMotion, false);
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
        api.unwatchAccelerometer = function () {
            if (accelInitialized) {
                if (typeof Windows === "undefined") {
                    // add a listener for the mouse
                    window.removeEventListener("devicemotion", onDeviceMotion, false);
                } else {
                    // On Windows 8 Devices
                    var accelerometer = Windows.Device.Sensors.Accelerometer.getDefault();

                    accelerometer.removeEventListener("readingchanged", onDeviceMotion, false);
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
        api.watchDeviceOrientation = function () {
            if (me.device.hasDeviceOrientation && !deviceOrientationInitialized) {
                window.addEventListener("deviceorientation", onDeviceRotate, false);
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
        api.unwatchDeviceOrientation = function () {
            if (deviceOrientationInitialized) {
                window.removeEventListener("deviceorientation", onDeviceRotate, false);
                deviceOrientationInitialized = false;
            }
        };

        /**
         * the vibrate method pulses the vibration hardware on the device, <br>
         * If the device doesn't support vibration, this method has no effect. <br>
         * If a vibration pattern is already in progress when this method is called,
         * the previous pattern is halted and the new one begins instead.
         * @name vibrate
         * @memberOf me.device
         * @public
         * @function
         * @param {Number|Number[]} pattern pattern of vibration and pause intervals
         * @example
         * // vibrate for 1000 ms
         * me.device.vibrate(1000);
         * // or alternatively
         * me.device.vibrate([1000]);
         * // vibrate for 50 ms, be still for 100 ms, and then vibrate for 150 ms:
         * me.device.vibrate([50, 100, 150]);
         * // cancel any existing vibrations
         * me.device.vibrate(0);
         */
        api.vibrate = function (pattern) {
            if (navigator.vibrate) {
                navigator.vibrate(pattern);
            }
        };


        return api;
    })();

    /**
     * Returns true if the browser/device is in full screen mode.
     * @name isFullscreen
     * @memberOf me.device
     * @public
     * @type Boolean
     * @readonly
     * @return {boolean}
     */
    Object.defineProperty(me.device, "isFullscreen", {
        /**
         * @ignore
         */
        get: function () {
            if (me.device.hasFullscreenSupport) {
                return !!(me.agent.prefixed("fullscreenElement", document) ||
                    document.mozFullScreenElement);
            } else {
                return false;
            }
        }
    });

    /**
     * Returns true if the browser/device has audio capabilities.
     * @name sound
     * @memberOf me.device
     * @public
     * @type Boolean
     * @readonly
     * @return {boolean}
     */
    Object.defineProperty(me.device, "sound", {
        /**
         * @ignore
         */
        get: function () {
                return !Howler.noAudio;
        }
    });
})();
