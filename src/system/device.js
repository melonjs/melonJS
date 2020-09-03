import audio from "./../audio/audio.js";
import video from "./../video/video.js";
import save from "./../system/save.js";
import { prefixed } from "./../utils/agent.js";
import state from "./../state/state.js";

// private properties
let accelInitialized = false;
let deviceOrientationInitialized = false;

// swipe utility fn & flag
let swipeEnabled = true;
function disableSwipeFn(e) {
    e.preventDefault();
    if (typeof window.scroll === "function") {
        window.scroll(0, 0);
    }
    return false;
};

// DOM loading stuff
let readyBound = false, isReady = false, readyList = [];

// a cache DOMRect object
let _domRect = {left: 0, top: 0, x: 0, y: 0, width: 0, height: 0, right: 0, bottom: 0};

/**
 * The device capabilities and specific events
 * @namespace me.device
 * @memberOf me
 */
let device = {

    /**
     * called to check if the device is ready
     * @ignore
     */
    _domReady(fn) {
        // Make sure that the DOM is not already loaded
        if (!isReady) {
            // be sure document.body is there
            if (!document.body) {
                return setTimeout(this._domReady, 13);
            }

            // clean up loading event
            if (document.removeEventListener) {
                document.removeEventListener(
                    "DOMContentLoaded",
                    this._domReady,
                    false
                );
            }
            // remove the event on window.onload (always added in `onReady`)
            window.removeEventListener("load", this._domReady, false);

            // execute all callbacks
            while (readyList.length) {
                readyList.shift().call(window, []);
            }

            // Remember that the DOM is ready
            isReady = true;
        }
    },



    /**
     * check the device capapbilities
     * @ignore
     */
    _check() {

        // detect device type/platform
        this._detectDevice();

        // Mobile browser hacks
        if (this.isMobile) {
            // Prevent the webview from moving on a swipe
            this.enableSwipe(false);
        }

        // Touch/Gesture Event feature detection
        this.TouchEvent = !!("ontouchstart" in window);
        this.PointerEvent = !!window.PointerEvent;
        window.gesture = prefixed("gesture");

        // detect touch capabilities
        this.touch = this.TouchEvent || this.PointerEvent;

        // max amount of touch points ; always at least return 1 (e.g. headless chrome will return 0)
        this.maxTouchPoints = this.touch ? (this.PointerEvent ? navigator.maxTouchPoints || 1 : 10) : 1;

        // detect wheel event support
        // Modern browsers support "wheel", Webkit and IE support at least "mousewheel
        this.wheel = ("onwheel" in document.createElement("div"));

        // pointerlock detection
        this.hasPointerLockSupport = prefixed("pointerLockElement", document);

        if (this.hasPointerLockSupport) {
            document.exitPointerLock = prefixed("exitPointerLock", document);
        }

        // device orientation and motion detection
        if (window.DeviceOrientationEvent) {

        }
        // device accelerometer and orientation detection
        this.hasDeviceOrientation = !!window.DeviceOrientationEvent;
        this.hasAccelerometer = !!window.DeviceMotionEvent;

        // fullscreen api detection & polyfill when possible
        this.hasFullscreenSupport = prefixed("fullscreenEnabled", document) ||
                                    document.mozFullScreenEnabled;

        document.exitFullscreen = prefixed("cancelFullScreen", document) ||
                                  prefixed("exitFullscreen", document);

        // vibration API poyfill
        navigator.vibrate = prefixed("vibrate", navigator);

        // web Audio detection
        this.hasWebAudio = !!(window.AudioContext || window.webkitAudioContext);

        try {
            this.localStorage = !!window.localStorage;
        } catch (e) {
            // the above generates an exception when cookies are blocked
            this.localStorage = false;
        }

        try {
            // some browser (e.g. Safari) implements WebGL1 and WebGL2 contexts only
            // https://bugzilla.mozilla.org/show_bug.cgi?id=801176
            this.OffscreenCanvas =
                (typeof window.OffscreenCanvas !== "undefined") &&
                ((new OffscreenCanvas(0, 0).getContext( "2d" )) !== null);
        } catch (e) {
            this.OffscreenCanvas = false;
        }

        // set pause/stop action on losing focus
        window.addEventListener("blur", function () {
            if (this.stopOnBlur) {
                state.stop(true);
            }
            if (this.pauseOnBlur) {
                state.pause(true);
            }
        }, false);
        // set restart/resume action on gaining focus
        window.addEventListener("focus", function () {
            if (this.stopOnBlur) {
                state.restart(true);
            }
            if (this.resumeOnFocus) {
                state.resume(true);
            }
            // force focus if autofocus is on
            if (this.autoFocus) {
                this.focus();
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
                        if (this.stopOnBlur) {
                            state.stop(true);
                        }
                        if (this.pauseOnBlur) {
                            state.pause(true);
                        }
                    } else {
                        if (this.stopOnBlur) {
                            state.restart(true);
                        }
                        if (this.resumeOnFocus) {
                            state.resume(true);
                        }
                    }
                }, false
            );
        }
    },

    /**
     * detect the device type
     * @ignore
     */
    _detectDevice() {
        // iOS Device ?
        this.iOS = /iPhone|iPad|iPod/i.test(this.ua);
        // Android Device ?
        this.android = /Android/i.test(this.ua);
        this.android2 = /Android 2/i.test(this.ua);
        // Linux platform
        this.linux = /Linux/i.test(this.ua);
        // Chrome OS ?
        this.chromeOS = /CrOS/.test(this.ua);
        // Windows Device ?
        this.wp = /Windows Phone/i.test(this.ua);
        // Blackberry device ?
        this.BlackBerry = /BlackBerry/i.test(this.ua);
        // Kindle device ?
        this.Kindle = /Kindle|Silk.*Mobile Safari/i.test(this.ua);
        // Mobile platform
        this.isMobile = /Mobi/i.test(this.ua) ||
                             this.iOS ||
                             this.android ||
                             this.wp ||
                             this.BlackBerry ||
                             this.Kindle || false;
        // ejecta
        this.ejecta = (typeof window.ejecta !== "undefined");
        // Wechat
        this.isWeixin = /MicroMessenger/i.test(this.ua);
    },

    /**
     * the `ua` read-only property returns the user agent string for the current browser.
     * @type String
     * @readonly
     * @name ua
     * @memberOf me.device
     */
    ua : navigator.userAgent,

    /**
     * Browser Local Storage capabilities <br>
     * (this flag will be set to false if cookies are blocked)
     * @type Boolean
     * @readonly
     * @name localStorage
     * @memberOf me.device
     */
    localStorage : false,

    /**
     * Browser accelerometer capabilities
     * @type Boolean
     * @readonly
     * @name hasAccelerometer
     * @memberOf me.device
     */
    hasAccelerometer : false,

    /**
     * Browser device orientation
     * @type Boolean
     * @readonly
     * @name hasDeviceOrientation
     * @memberOf me.device
     */
    hasDeviceOrientation : false,

    /**
     * Browser full screen support
     * @type Boolean
     * @readonly
     * @name hasFullscreenSupport
     * @memberOf me.device
     */
    hasFullscreenSupport : false,

     /**
     * Browser pointerlock api support
     * @type Boolean
     * @readonly
     * @name hasPointerLockSupport
     * @memberOf me.device
     */
    hasPointerLockSupport : false,

    /**
    * Device WebAudio Support
    * @type Boolean
    * @readonly
    * @name hasWebAudio
    * @memberOf me.device
    */
   hasWebAudio : false,

    /**
     * Browser Base64 decoding capability
     * @type Boolean
     * @readonly
     * @name nativeBase64
     * @memberOf me.device
     */
    nativeBase64 : (typeof(window.atob) === "function"),

    /**
     * Return the maximum number of simultaneous touch contact points are supported by the current device.
     * @type Number
     * @readonly
     * @name maxTouchPoints
     * @memberOf me.device
     * @example
     * if (me.device.maxTouchPoints > 1) {
     *     // device supports multi-touch
     * }
     */
    maxTouchPoints : 1,

    /**
     * Touch capabilities
     * @type Boolean
     * @readonly
     * @name touch
     * @memberOf me.device
     */
    touch : false,

    /**
     * W3C standard wheel events
     * @type Boolean
     * @readonly
     * @name wheel
     * @memberOf me.device
     */
    wheel : false,

    /**
     * equals to true if a mobile device <br>
     * (Android | iPhone | iPad | iPod | BlackBerry | Windows Phone | Kindle)
     * @type Boolean
     * @readonly
     * @name isMobile
     * @memberOf me.device
     */
    isMobile : false,

    /**
     * equals to true if the device is an iOS platform.
     * @type Boolean
     * @readonly
     * @name iOS
     * @memberOf me.device
     */
    iOS : false,

    /**
     * equals to true if the device is an Android platform.
     * @type Boolean
     * @readonly
     * @name android
     * @memberOf me.device
     */
    android : false,

    /**
     * equals to true if the device is an Android 2.x platform.
     * @type Boolean
     * @readonly
     * @name android2
     * @memberOf me.device
     */
    android2 : false,

    /**
     * equals to true if the device is a Linux platform.
     * @type Boolean
     * @readonly
     * @name linux
     * @memberOf me.device
     */
    linux : false,

   /**
    * equals to true if the game is running under Ejecta.
    * @type Boolean
    * @readonly
    * @see http://impactjs.com/ejecta
    * @name ejecta
    * @memberOf me.device
    */
    ejecta : false,

    /**
     * equals to true if the game is running under Wechat.
     * @type Boolean
     * @readonly
     * @name isWeixin
     * @memberOf me.device
     */
     isWeixin : false,

    /**
     * equals to true if the device is running on ChromeOS.
     * @type Boolean
     * @readonly
     * @name chromeOS
     * @memberOf me.device
     */
    chromeOS : false,

     /**
     * equals to true if the device is a Windows Phone platform.
     * @type Boolean
     * @readonly
     * @name wp
     * @memberOf me.device
     */
    wp : false,

    /**
     * equals to true if the device is a BlackBerry platform.
     * @type Boolean
     * @readonly
     * @name BlackBerry
     * @memberOf me.device
     */
    BlackBerry : false,

    /**
     * equals to true if the device is a Kindle platform.
     * @type Boolean
     * @readonly
     * @name Kindle
     * @memberOf me.device
     */
    Kindle : false,

    /**
     * contains the g-force acceleration along the x-axis.
     * @public
     * @type Number
     * @readonly
     * @name accelerationX
     * @see me.device.watchAccelerometer
     * @memberOf me.device
     */
    accelerationX : 0,

    /**
     * contains the g-force acceleration along the y-axis.
     * @public
     * @type Number
     * @readonly
     * @name accelerationY
     * @see me.device.watchAccelerometer
     * @memberOf me.device
     */
    accelerationY : 0,

    /**
     * contains the g-force acceleration along the z-axis.
     * @public
     * @type Number
     * @readonly
     * @name accelerationZ
     * @see me.device.watchAccelerometer
     * @memberOf me.device
     */
    accelerationZ : 0,

    /**
     * Device orientation Gamma property. Gives angle on tilting a portrait held phone left or right
     * @public
     * @type Number
     * @readonly
     * @name gamma
     * @see me.device.watchDeviceOrientation
     * @memberOf me.device
     */
    gamma : 0,

    /**
     * Device orientation Beta property. Gives angle on tilting a portrait held phone forward or backward
     * @public
     * @type Number
     * @readonly
     * @name beta
     * @see me.device.watchDeviceOrientation
     * @memberOf me.device
     */
    beta: 0,

    /**
     * Device orientation Alpha property. Gives angle based on the rotation of the phone around its z axis.
     * The z-axis is perpendicular to the phone, facing out from the center of the screen.
     * @public
     * @type Number
     * @readonly
     * @name alpha
     * @see me.device.watchDeviceOrientation
     * @memberOf me.device
     */
    alpha : 0,

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
    language : navigator.language || navigator.browserLanguage || navigator.userLanguage || "en",

    /**
     * Specify whether to pause the game when losing focus
     * @type {Boolean}
     * @default true
     * @memberOf me.device
     */
    pauseOnBlur : true,

    /**
     * Specify whether to unpause the game when gaining focus
     * @type {Boolean}
     * @default true
     * @memberOf me.device
     */
    resumeOnFocus : true,

    /**
     * Specify whether to automatically bring the window to the front
     * @type {Boolean}
     * @default true
     * @memberOf me.device
     */
    autoFocus : true,

    /**
     * Specify whether to stop the game when losing focus or not.
     * The engine restarts on focus if this is enabled.
     * @type {boolean}
     * @default false
     * @memberOf me.device
     */
    stopOnBlur : false,

    /**
     * equals to true if the device browser supports OffScreenCanvas.
     * @type Boolean
     * @readonly
     * @name OffScreenCanvas
     * @memberOf me.device
     */
    OffscreenCanvas : false,


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
    * }, // game
    *
    * // "bootstrap"
    * me.device.onReady(function () {
    *    game.onload();
    * });
    */
    onReady(fn) {
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
                    window.setTimeout(this._domReady, 0);
                }
                else {
                    if (document.addEventListener) {
                        // Use the handy event callback
                        document.addEventListener("DOMContentLoaded", this._domReady, false);
                    }
                    // A fallback to window.onload, that will always work
                    window.addEventListener("load", this._domReady, false);
                }
                readyBound = true;
            }
        }
    },

    /**
     * enable/disable swipe on WebView.
     * @name enableSwipe
     * @memberOf me.device
     * @function
     * @param {boolean} [enable=true] enable or disable swipe.
     */
    enableSwipe(enable) {
        if (enable !== false) {
            if (swipeEnabled === false) {
                window.document.removeEventListener("touchmove", disableSwipeFn, false);
                swipeEnabled = true;
            }
        } else if (swipeEnabled === true) {
            window.document.addEventListener("touchmove", disableSwipeFn, false);
            swipeEnabled = false;
        }
    },

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
    requestFullscreen(element) {
        if (this.hasFullscreenSupport) {
            element = element || video.getParent();
            element.requestFullscreen = prefixed("requestFullscreen", element) ||
                                        element.mozRequestFullScreen;

            element.requestFullscreen();
        }
    },

    /**
     * Exit fullscreen mode. Requires fullscreen support from the browser/device.
     * @name exitFullscreen
     * @memberOf me.device
     * @function
     */
    exitFullscreen() {
        if (this.hasFullscreenSupport) {
            document.exitFullscreen();
        }
    },

    /**
     * Return a string representing the orientation of the device screen.
     * It can be "any", "natural", "landscape", "portrait", "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"
     * @name getScreenOrientation
     * @memberOf me.device
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
     * @function
     * @return {String} the screen orientation
     */
    getScreenOrientation() {
        var PORTRAIT = "portrait";
        var LANDSCAPE = "landscape";

        var screen = window.screen;

        // first try using "standard" values
        if (typeof screen !== "undefined") {
            var orientation = prefixed("orientation", screen);
            if (typeof orientation !== "undefined" && typeof orientation.type === "string") {
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
    },

    /**
     * locks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @name lockOrientation
     * @memberOf me.device
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @function
     * @return {Boolean} true if the orientation was unsuccessfully locked
     */
    lockOrientation(orientation) {
        var screen = window.screen;
        if (typeof screen !== "undefined") {
            var lockOrientation = prefixed("lockOrientation", screen);
            if (typeof lockOrientation !== "undefined") {
                return lockOrientation(orientation);
            }
        }
        return false;
    },

    /**
     * unlocks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @name unlockOrientation
     * @memberOf me.device
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @function
     * @return {Boolean} true if the orientation was unsuccessfully unlocked
     */
    unlockOrientation(orientation) {
        var screen = window.screen;
        if (typeof screen !== "undefined") {
            var unlockOrientation = prefixed("unlockOrientation", screen);
            if (typeof unlockOrientation !== "undefined") {
                return unlockOrientation(orientation);
            }
        }
        return false;
    },

    /**
     * return true if the device screen orientation is in Portrait mode
     * @name isPortrait
     * @memberOf me.device
     * @function
     * @return {Boolean}
     */
    isPortrait() {
        return this.getScreenOrientation().includes("portrait");
    },

    /**
     * return true if the device screen orientation is in Portrait mode
     * @name isLandscape
     * @memberOf me.device
     * @function
     * @return {Boolean}
     */
    isLandscape() {
        return this.getScreenOrientation().includes("landscape");
    },

    /**
     * return the device storage
     * @name getStorage
     * @memberOf me.device
     * @function
     * @param {String} [type="local"]
     * @see me.save
     * @return {Object} a reference to the device storage
     */
    getStorage(type = "local") {
        switch (type) {
            case "local" :
                return save;

            default :
                throw new Error("storage type " + type + " not supported");
        }
    },

    /**
     * return the parent DOM element for the given parent name or HTMLElement object
     * @name getParentElement
     * @memberOf me.device
     * @function
     * @param {String|HTMLElement} element the parent element name or a HTMLElement object
     * @return {HTMLElement} the parent Element
     */
    getParentElement(element) {
        var target = this.getElement(element);

        if (target.parentNode !== null) {
            target = target.parentNode;
        }

        return target;
    },

    /**
     * return the DOM element for the given element name or HTMLElement object
     * @name getElement
     * @memberOf me.device
     * @function
     * @param {String|HTMLElement} element the parent element name or a HTMLElement object
     * @return {HTMLElement} the corresponding DOM Element or null if not existing
     */
    getElement(element) {
        var target = null;

        if (element !== "undefined") {
            if (typeof element === "string") {
                target = document.getElementById(element);
            } else if (typeof element === "object" && element.nodeType === Node.ELEMENT_NODE) {
                target = element;
            }
        }

        // fallback, if invalid target or non HTMLElement object
        if (!target)  {
            //default to document.body
            target = document.body;
        }

        return target;
    },

    /**
     * returns the size of the given HTMLElement and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @name getElementBounds
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @memberOf me.device
     * @function
     * @param {String|HTMLElement} element an HTMLElement object
     * @return {DOMRect} the size and position of the element relatively to the viewport
     */
    getElementBounds(element) {
        if (typeof element === "object" && element !== document.body && typeof element.getBoundingClientRect !== "undefined") {
            return element.getBoundingClientRect();
        } else {
            _domRect.width = _domRect.right = window.innerWidth;
            _domRect.height = _domRect.bottom = window.innerHeight;
            return _domRect;
        };
    },

    /**
     * returns the size of the given HTMLElement Parent and its position relative to the viewport
     * <br><img src="images/element-box-diagram.png"/>
     * @name getParentBounds
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @memberOf me.device
     * @function
     * @param {String|HTMLElement} element an HTMLElement object
     * @return {DOMRect} the size and position of the given element parent relative to the viewport
     */
    getParentBounds(element) {
        return this.getElementBounds(this.getParentElement(element));
    },

    /**
     * returns true if the device supports WebGL
     * @name isWebGLSupported
     * @memberOf me.device
     * @function
     * @param {Object} [options] context creation options
     * @param {Boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @return {Boolean} true if WebGL is supported
     */
    isWebGLSupported(options) {
        var _supported = false;
        try {
            var canvas = document.createElement("canvas");
            var ctxOptions = {
                stencil: true,
                failIfMajorPerformanceCaveat : options.failIfMajorPerformanceCaveat
            };
            _supported = !! (window.WebGLRenderingContext && (canvas.getContext("webgl", ctxOptions) || canvas.getContext("experimental-webgl", ctxOptions)));
        } catch (e) {
            _supported = false;
        }

        return _supported;
    },

    /**
     * return the highest precision format supported by this device for GL Shaders
     * @name getMaxShaderPrecision
     * @memberOf me.device
     * @function
     * @param {WebGLRenderingContext} gl
     * @return {Boolean} "lowp", "mediump", or "highp"
     */
    getMaxShaderPrecision(gl) {
        if (gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT ).precision > 0 &&
            gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT ).precision > 0) {
                return "highp";
        }
        if (gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT ).precision > 0 &&
            gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT ).precision > 0) {
                return "mediump";
        }
        return "lowp";
    },

    /**
     * Makes a request to bring this device window to the front.
     * @name focus
     * @memberOf me.device
     * @function
     * @example
     *  if (clicked) {
     *    me.device.focus();
     *  }
     */
    focus() {
        if (typeof (window.focus) === "function") {
            window.focus();
        }
    },


    /**
     * event management (Accelerometer)
     * http://www.mobilexweb.com/samples/ball.html
     * http://www.mobilexweb.com/blog/safari-ios-accelerometer-websockets-html5
     * @ignore
     */
    onDeviceMotion(e) {
        // Accelerometer information
        this.accelerationX = e.accelerationIncludingGravity.x;
        this.accelerationY = e.accelerationIncludingGravity.y;
        this.accelerationZ = e.accelerationIncludingGravity.z;
    },

    onDeviceRotate(e) {
        this.gamma = e.gamma;
        this.beta = e.beta;
        this.alpha = e.alpha;
    },

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
    turnOnPointerLock() {
        if (this.hasPointerLockSupport) {
            var element = video.getParent();
            if (this.ua.match(/Firefox/i)) {
                var fullscreenchange = function() {
                    if ((prefixed("fullscreenElement", document) ||
                        document.mozFullScreenElement) === element) {

                        document.removeEventListener("fullscreenchange", fullscreenchange);
                        document.removeEventListener("mozfullscreenchange", fullscreenchange);
                        element.requestPointerLock = prefixed("requestPointerLock", element);
                        element.requestPointerLock();
                    }
                };

                document.addEventListener("fullscreenchange", fullscreenchange, false);
                document.addEventListener("mozfullscreenchange", fullscreenchange, false);

                this.requestFullscreen();

            }
            else {
                element.requestPointerLock();
            }
        }
    },

    /**
     * Exits pointer lock. Works on supported devices & browsers
     * @name turnOffPointerLock
     * @memberOf me.device
     * @function
     */
    turnOffPointerLock() {
        if (this.hasPointerLockSupport) {
            document.exitPointerLock();
        }
    },

    /**
     * Enable monitor of the device accelerator to detect the amount of physical force of acceleration the device is receiving.
     * (one some device a first user gesture will be required before calling this function)
     * @name watchAccelerometer
     * @memberOf me.device
     * @public
     * @function
     * @see me.device.accelerationX
     * @see me.device.accelerationY
     * @see me.device.accelerationZ
     * @return {Boolean} false if not supported or permission not granted by the user
     * @example
     * // try to enable device accelerometer event on user gesture
     * me.input.registerPointerEvent("pointerleave", me.game.viewport, function() {
     *     if (me.device.watchAccelerometer() === true) {
     *         // Success
     *         me.input.releasePointerEvent("pointerleave", me.game.viewport);
     *     } else {
     *         // ... fail at enabling the device accelerometer event
     *     }
     * });
     */
    watchAccelerometer() {
        if (this.hasAccelerometer && !accelInitialized) {
            if (DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") {
                DeviceOrientationEvent.requestPermission()
                    .then(response => {
                        if (response === "granted") {
                            // add a listener for the devicemotion event
                            window.addEventListener("devicemotion", this.onDeviceMotion, false);
                            accelInitialized = true;
                        }
                    }).catch(console.error);
            } else {
                // add a listener for the devicemotion event
                window.addEventListener("devicemotion", this.onDeviceMotion, false);
                accelInitialized = true;
            }
        }
        return accelInitialized;
    },

    /**
     * unwatch Accelerometor event
     * @name unwatchAccelerometer
     * @memberOf me.device
     * @public
     * @function
     */
    unwatchAccelerometer() {
        if (accelInitialized) {
            // remove the listener for the devicemotion event
            window.removeEventListener("devicemotion", this.onDeviceMotion, false);
            accelInitialized = false;
        }
    },

    /**
     * Enable monitor of the device orientation to detect the current orientation of the device as compared to the Earth coordinate frame.
     * (one some device a first user gesture will be required before calling this function)
     * @name watchDeviceOrientation
     * @memberOf me.device
     * @public
     * @function
     * @see me.device.alpha
     * @see me.device.beta
     * @see me.device.gamma
     * @return {Boolean} false if not supported or permission not granted by the user
     * @example
     * // try to enable device orientation event on user gesture
     * me.input.registerPointerEvent("pointerleave", me.game.viewport, function() {
     *     if (me.device.watchDeviceOrientation() === true) {
     *         // Success
     *         me.input.releasePointerEvent("pointerleave", me.game.viewport);
     *     } else {
     *         // ... fail at enabling the device orientation event
     *     }
     * });
     */
    watchDeviceOrientation() {
        if (this.hasDeviceOrientation && !deviceOrientationInitialized) {
            if (typeof DeviceOrientationEvent.requestPermission === "function") {
                DeviceOrientationEvent.requestPermission()
                    .then(response => {
                        if (response === "granted") {
                            window.addEventListener("deviceorientation", this.onDeviceRotate, false);
                            deviceOrientationInitialized = true;
                        }
                    }).catch(console.error);
            } else {
                window.addEventListener("deviceorientation", this.onDeviceRotate, false);
                deviceOrientationInitialized = true;
            }
        }
        return deviceOrientationInitialized;
    },

    /**
     * unwatch Device orientation event
     * @name unwatchDeviceOrientation
     * @memberOf me.device
     * @public
     * @function
     */
    unwatchDeviceOrientation() {
        if (deviceOrientationInitialized) {
            window.removeEventListener("deviceorientation", this.onDeviceRotate, false);
            deviceOrientationInitialized = false;
        }
    },

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
    vibrate(pattern) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

};

/**
 * Ratio of the resolution in physical pixels to the resolution in CSS pixels for the current display device.
 * @name devicePixelRatio
 * @memberOf me.device
 * @public
 * @type Number
 * @readonly
 * @return {Number}
 */
Object.defineProperty(device, "devicePixelRatio", {
    /**
     * @ignore
     */
    get: function () {
        return (window.devicePixelRatio || 1);
    }
});

/**
 * Returns true if the browser/device is in full screen mode.
 * @name isFullscreen
 * @memberOf me.device
 * @public
 * @type Boolean
 * @readonly
 * @return {boolean}
 */
Object.defineProperty(device, "isFullscreen", {
    /**
     * @ignore
     */
    get: function () {
        if (this.hasFullscreenSupport) {
            return !!(prefixed("fullscreenElement", document) ||
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
Object.defineProperty(device, "sound", {
    /**
     * @ignore
     */
    get: function () {
        return audio.hasAudio();
    }
});

export default device;
