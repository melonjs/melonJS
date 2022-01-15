import { hasAudio } from "./../audio/audio.js";
import { getParent } from "./../video/video.js";
import save from "./../system/save.js";
import { prefixed } from "./../utils/agent.js";
import state from "./../state/state.js";
import * as event from "./../system/event.js";

/**
 * The device capabilities and specific events
 * @namespace me.device
 * @memberof me
 */

// private properties
let accelInitialized = false;
let deviceOrientationInitialized = false;

// swipe utility fn & flag
let swipeEnabled = true;

/**
 * @ignore
 */
function _disableSwipeFn(e) {
    e.preventDefault();
    if (typeof window.scroll === "function") {
        window.scroll(0, 0);
    }
    return false;
};

// DOM loading stuff
let readyBound = false, isReady = false, readyList = [];

/**
 * // called to check if the device is ready
 * @ignore
 */
function _domReady() {
    // Make sure that the DOM is not already loaded
    if (!isReady) {
        // be sure document.body is there
        if (!document.body) {
            return setTimeout(_domReady, 13);
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
        window.removeEventListener("load", _domReady, false);

        // execute all callbacks
        while (readyList.length) {
            readyList.shift().call(window, []);
        }

        // Remember that the DOM is ready
        isReady = true;
    }
};

// a cache DOMRect object
let _domRect = {left: 0, top: 0, x: 0, y: 0, width: 0, height: 0, right: 0, bottom: 0};

/**
 * detect the device type
 * @ignore
 */
function _detectDevice() {
    // iOS Device ?
    device.iOS = /iPhone|iPad|iPod/i.test(device.ua);
    // Android Device ?
    device.android = /Android/i.test(device.ua);
    device.android2 = /Android 2/i.test(device.ua);
    // Linux platform
    device.linux = /Linux/i.test(device.ua);
    // Chrome OS ?
    device.chromeOS = /CrOS/.test(device.ua);
    // Windows Device ?
    device.wp = /Windows Phone/i.test(device.ua);
    // Blackberry device ?
    device.BlackBerry = /BlackBerry/i.test(device.ua);
    // Kindle device ?
    device.Kindle = /Kindle|Silk.*Mobile Safari/i.test(device.ua);
    // Mobile platform
    device.isMobile = /Mobi/i.test(device.ua) ||
                         device.iOS ||
                         device.android ||
                         device.wp ||
                         device.BlackBerry ||
                         device.Kindle || false;
    // ejecta
    device.ejecta = (typeof window.ejecta !== "undefined");
    // Wechat
    device.isWeixin = /MicroMessenger/i.test(device.ua);
};

/**
 * check the device capapbilities
 * @ignore
 */
function _checkCapabilities() {

    // detect device type/platform
    _detectDevice();

    // Mobile browser hacks
    if (device.isMobile) {
        // Prevent the webview from moving on a swipe
        device.enableSwipe(false);
    }

    // Touch/Gesture Event feature detection
    device.TouchEvent = !!("ontouchstart" in window);
    device.PointerEvent = !!window.PointerEvent;
    window.gesture = prefixed("gesture");

    // detect touch capabilities
    device.touch = device.TouchEvent || device.PointerEvent;

    // max amount of touch points ; always at least return 1 (e.g. headless chrome will return 0)
    device.maxTouchPoints = device.touch ? (device.PointerEvent ? navigator.maxTouchPoints || 1 : 10) : 1;

    // detect wheel event support
    // Modern browsers support "wheel", Webkit and IE support at least "mousewheel
    device.wheel = ("onwheel" in document.createElement("div"));

    // pointerlock detection (pointerLockElement can be null when the feature is supported)
    device.hasPointerLockSupport = typeof document.pointerLockElement !== "undefined";

    // device orientation and motion detection
    device.hasDeviceOrientation = !!window.DeviceOrientationEvent;
    device.hasAccelerometer = !!window.DeviceMotionEvent;

    // support the ScreenOrientation API
    device.ScreenOrientation = (typeof screen !== "undefined") &&
                               (typeof screen.orientation !== "undefined");

    // fullscreen api detection & polyfill when possible
    device.hasFullscreenSupport = prefixed("fullscreenEnabled", document) ||
                                document.mozFullScreenEnabled;

    document.exitFullscreen = prefixed("cancelFullScreen", document) ||
                              prefixed("exitFullscreen", document);

    // vibration API poyfill
    navigator.vibrate = prefixed("vibrate", navigator);

    // web Audio detection
    device.hasWebAudio = !!(window.AudioContext || window.webkitAudioContext);

    try {
        device.localStorage = !!window.localStorage;
    } catch (e) {
        // the above generates an exception when cookies are blocked
        device.localStorage = false;
    }

    try {
        // some browser (e.g. Safari) implements WebGL1 and WebGL2 contexts only
        // https://bugzilla.mozilla.org/show_bug.cgi?id=801176
        device.OffscreenCanvas =
            (typeof window.OffscreenCanvas !== "undefined") &&
            ((new OffscreenCanvas(0, 0).getContext( "2d" )) !== null);
    } catch (e) {
        device.OffscreenCanvas = false;
    }

    // set pause/stop action on losing focus
    window.addEventListener("blur", function () {
        if (device.stopOnBlur) {
            state.stop(true);
        }
        if (device.pauseOnBlur) {
            state.pause(true);
        }
    }, false);
    // set restart/resume action on gaining focus
    window.addEventListener("focus", function () {
        if (device.stopOnBlur) {
            state.restart(true);
        }
        if (device.resumeOnFocus) {
            state.resume(true);
        }
        // force focus if autofocus is on
        if (device.autoFocus) {
            device.focus();
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
                    if (device.stopOnBlur) {
                        state.stop(true);
                    }
                    if (device.pauseOnBlur) {
                        state.pause(true);
                    }
                } else {
                    if (device.stopOnBlur) {
                        state.restart(true);
                    }
                    if (device.resumeOnFocus) {
                        state.resume(true);
                    }
                }
            }, false
        );
    }
};


// Initialize me.timer on Boot event
event.on(event.BOOT, () => {
    _checkCapabilities();
});


// public export
let device = {

    /**
     * the `ua` read-only property returns the user agent string for the current browser.
     * @type {string}
     * @readonly
     * @name ua
     * @memberof me.device
     */
    ua : navigator.userAgent,

    /**
     * Browser Local Storage capabilities <br>
     * (this flag will be set to false if cookies are blocked)
     * @type {boolean}
     * @readonly
     * @name localStorage
     * @memberof me.device
     */
    localStorage : false,

    /**
     * Browser accelerometer capabilities
     * @type {boolean}
     * @readonly
     * @name hasAccelerometer
     * @memberof me.device
     */
    hasAccelerometer : false,

    /**
     * Browser device orientation
     * @type {boolean}
     * @readonly
     * @name hasDeviceOrientation
     * @memberof me.device
     */
    hasDeviceOrientation : false,

    /**
     * Supports the ScreenOrientation API
     * @see https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/onchange
     * @type {boolean}
     * @readonly
     * @name ScreenOrientation
     * @memberof me.device
     */
    ScreenOrientation : false,

    /**
     * Browser full screen support
     * @type {boolean}
     * @readonly
     * @name hasFullscreenSupport
     * @memberof me.device
     */
    hasFullscreenSupport : false,

    /**
     * Browser pointerlock api support
     * @type {boolean}
     * @readonly
     * @name hasPointerLockSupport
     * @memberof me.device
     */
    hasPointerLockSupport : false,

    /**
     * Device WebAudio Support
     * @type {boolean}
     * @readonly
     * @name hasWebAudio
     * @memberof me.device
     */
    hasWebAudio : false,

    /**
     * Browser Base64 decoding capability
     * @type {boolean}
     * @readonly
     * @name nativeBase64
     * @memberof me.device
     */
    nativeBase64 : (typeof(window.atob) === "function"),

    /**
     * Return the maximum number of simultaneous touch contact points are supported by the current device.
     * @type {number}
     * @readonly
     * @name maxTouchPoints
     * @memberof me.device
     * @example
     * if (me.device.maxTouchPoints > 1) {
     *     // device supports multi-touch
     * }
     */
    maxTouchPoints : 1,

    /**
     * Touch capabilities
     * @type {boolean}
     * @readonly
     * @name touch
     * @memberof me.device
     */
    touch : false,

    /**
     * W3C standard wheel events
     * @type {boolean}
     * @readonly
     * @name wheel
     * @memberof me.device
     */
    wheel : false,

    /**
     * equals to true if a mobile device <br>
     * (Android | iPhone | iPad | iPod | BlackBerry | Windows Phone | Kindle)
     * @type {boolean}
     * @readonly
     * @name isMobile
     * @memberof me.device
     */
    isMobile : false,

    /**
     * equals to true if the device is an iOS platform.
     * @type {boolean}
     * @readonly
     * @name iOS
     * @memberof me.device
     */
    iOS : false,

    /**
     * equals to true if the device is an Android platform.
     * @type {boolean}
     * @readonly
     * @name android
     * @memberof me.device
     */
    android : false,

    /**
     * equals to true if the device is an Android 2.x platform.
     * @type {boolean}
     * @readonly
     * @name android2
     * @memberof me.device
     */
    android2 : false,

    /**
     * equals to true if the device is a Linux platform.
     * @type {boolean}
     * @readonly
     * @name linux
     * @memberof me.device
     */
    linux : false,

   /**
    * equals to true if the game is running under Ejecta.
    * @type {boolean}
    * @readonly
    * @see http://impactjs.com/ejecta
    * @name ejecta
    * @memberof me.device
    */
    ejecta : false,

    /**
     * equals to true if the game is running under Wechat.
     * @type {boolean}
     * @readonly
     * @name isWeixin
     * @memberof me.device
     */
     isWeixin : false,

    /**
     * equals to true if the device is running on ChromeOS.
     * @type {boolean}
     * @readonly
     * @name chromeOS
     * @memberof me.device
     */
    chromeOS : false,

    /**
     * equals to true if the device is a Windows Phone platform.
     * @type {boolean}
     * @readonly
     * @name wp
     * @memberof me.device
     */
    wp : false,

    /**
     * equals to true if the device is a BlackBerry platform.
     * @type {boolean}
     * @readonly
     * @name BlackBerry
     * @memberof me.device
     */
    BlackBerry : false,

    /**
     * equals to true if the device is a Kindle platform.
     * @type {boolean}
     * @readonly
     * @name Kindle
     * @memberof me.device
     */
    Kindle : false,

    /**
     * contains the g-force acceleration along the x-axis.
     * @public
     * @type {number}
     * @readonly
     * @name accelerationX
     * @see me.device.watchAccelerometer
     * @memberof me.device
     */
    accelerationX : 0,

    /**
     * contains the g-force acceleration along the y-axis.
     * @public
     * @type {number}
     * @readonly
     * @name accelerationY
     * @see me.device.watchAccelerometer
     * @memberof me.device
     */
    accelerationY : 0,

    /**
     * contains the g-force acceleration along the z-axis.
     * @public
     * @type {number}
     * @readonly
     * @name accelerationZ
     * @see me.device.watchAccelerometer
     * @memberof me.device
     */
    accelerationZ : 0,

    /**
     * Device orientation Gamma property. Gives angle on tilting a portrait held phone left or right
     * @public
     * @type {number}
     * @readonly
     * @name gamma
     * @see me.device.watchDeviceOrientation
     * @memberof me.device
     */
    gamma : 0,

    /**
     * Device orientation Beta property. Gives angle on tilting a portrait held phone forward or backward
     * @public
     * @type {number}
     * @readonly
     * @name beta
     * @see me.device.watchDeviceOrientation
     * @memberof me.device
     */
    beta: 0,

    /**
     * Device orientation Alpha property. Gives angle based on the rotation of the phone around its z axis.
     * The z-axis is perpendicular to the phone, facing out from the center of the screen.
     * @public
     * @type {number}
     * @readonly
     * @name alpha
     * @see me.device.watchDeviceOrientation
     * @memberof me.device
     */
    alpha : 0,

    /**
     * a string representing the preferred language of the user, usually the language of the browser UI.
     * (will default to "en" if the information is not available)
     * @public
     * @type {string}
     * @readonly
     * @see http://www.w3schools.com/tags/ref_language_codes.asp
     * @name language
     * @memberof me.device
     */
    language : navigator.language || navigator.browserLanguage || navigator.userLanguage || "en",

    /**
     * Specify whether to pause the game when losing focus
     * @type {boolean}
     * @default true
     * @memberof me.device
     */
    pauseOnBlur : true,

    /**
     * Specify whether to unpause the game when gaining focus
     * @type {boolean}
     * @default true
     * @memberof me.device
     */
    resumeOnFocus : true,

    /**
     * Specify whether to automatically bring the window to the front
     * @type {boolean}
     * @default true
     * @memberof me.device
     */
    autoFocus : true,

    /**
     * Specify whether to stop the game when losing focus or not.
     * The engine restarts on focus if this is enabled.
     * @type {boolean}
     * @default false
     * @memberof me.device
     */
    stopOnBlur : false,

    /**
     * equals to true if the device browser supports OffScreenCanvas.
     * @type {boolean}
     * @readonly
     * @name OffScreenCanvas
     * @memberof me.device
     */
    OffscreenCanvas : false,


   /**
    * specify a function to execute when the Device is fully loaded and ready
    * @function me.device.onReady
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
                    window.setTimeout(_domReady, 0);
                }
                else {
                    if (document.addEventListener) {
                        // Use the handy event callback
                        document.addEventListener("DOMContentLoaded", _domReady, false);
                    }
                    // A fallback to window.onload, that will always work
                    window.addEventListener("load", _domReady, false);
                }
                readyBound = true;
            }
        }
    },

    /**
     * enable/disable swipe on WebView.
     * @function me.device.enableSwipe
     * @param {boolean} [enable=true] enable or disable swipe.
     */
    enableSwipe(enable) {
        if (enable !== false) {
            if (swipeEnabled === false) {
                window.document.removeEventListener("touchmove", _disableSwipeFn, false);
                swipeEnabled = true;
            }
        } else if (swipeEnabled === true) {
            window.document.addEventListener("touchmove", _disableSwipeFn, false);
            swipeEnabled = false;
        }
    },

    /**
     * Triggers a fullscreen request. Requires fullscreen support from the browser/device.
     * @function me.device.requestFullscreen
     * @param {object} [element=default canvas object] the element to be set in full-screen mode.
     * @example
     * // add a keyboard shortcut to toggle Fullscreen mode on/off
     * me.input.bindKey(me.input.KEY.F, "toggleFullscreen");
     * me.event.on(me.event.KEYDOWN, function (action, keyCode, edge) {
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
            element = element || getParent();
            element.requestFullscreen = prefixed("requestFullscreen", element) ||
                                        element.mozRequestFullScreen;

            element.requestFullscreen();
        }
    },

    /**
     * Exit fullscreen mode. Requires fullscreen support from the browser/device.
     * @function me.device.exitFullscreen
     */
    exitFullscreen() {
        if (this.hasFullscreenSupport) {
            document.exitFullscreen();
        }
    },

    /**
     * Return a string representing the orientation of the device screen.
     * It can be "any", "natural", "landscape", "portrait", "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"
     * @function me.device.getScreenOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
     * @returns {string} the screen orientation
     */
    getScreenOrientation() {
        var PORTRAIT = "portrait";
        var LANDSCAPE = "landscape";

        var screen = window.screen;

        // first try using "standard" values
        if (this.ScreenOrientation === true) {
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
     * @function me.device.lockOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @param {string|string[]} orientation The orientation into which to lock the screen.
     * @returns {boolean} true if the orientation was unsuccessfully locked
     */
    lockOrientation(orientation) {
        var screen = window.screen;
        if (typeof screen !== "undefined") {
            var _lockOrientation = prefixed("lockOrientation", screen);
            if (typeof _lockOrientation !== "undefined") {
                return _lockOrientation(orientation);
            }
        }
        return false;
    },

    /**
     * unlocks the device screen into the specified orientation.<br>
     * This method only works for installed Web apps or for Web pages in full-screen mode.
     * @function me.device.unlockOrientation
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
     * @returns {boolean} true if the orientation was unsuccessfully unlocked
     */
    unlockOrientation() {
        var screen = window.screen;
        if (typeof screen !== "undefined") {
            var _unlockOrientation = prefixed("unlockOrientation", screen);
            if (typeof _unlockOrientation !== "undefined") {
                return _unlockOrientation();
            }
        }
        return false;
    },

    /**
     * return true if the device screen orientation is in Portrait mode
     * @function me.device.isPortrait
     * @returns {boolean}
     */
    isPortrait() {
        return this.getScreenOrientation().includes("portrait");
    },

    /**
     * return true if the device screen orientation is in Portrait mode
     * @function me.device.isLandscape
     * @returns {boolean}
     */
    isLandscape() {
        return this.getScreenOrientation().includes("landscape");
    },

    /**
     * return the device storage
     * @function me.device.getStorage
     * @see me.save
     * @param {string} [type="local"]
     * @returns {object} a reference to the device storage
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
     * @function me.device.getParentElement
     * @param {string|HTMLElement} element the parent element name or a HTMLElement object
     * @returns {HTMLElement} the parent Element
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
     * @function me.device.getElement
     * @param {string|HTMLElement} element the parent element name or a HTMLElement object
     * @returns {HTMLElement} the corresponding DOM Element or null if not existing
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
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @function me.device.getElementBounds
     * @param {string|HTMLElement} element an HTMLElement object
     * @returns {DOMRect} the size and position of the element relatively to the viewport
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
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
     * @function me.device.getParentBounds
     * @param {string|HTMLElement} element an HTMLElement object
     * @returns {DOMRect} the size and position of the given element parent relative to the viewport
     */
    getParentBounds(element) {
        return this.getElementBounds(this.getParentElement(element));
    },

    /**
     * returns true if the device supports WebGL
     * @function me.device.isWebGLSupported
     * @param {object} [options] context creation options
     * @param {boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @returns {boolean} true if WebGL is supported
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
     * @function me.device.getMaxShaderPrecision
     * @param {WebGLRenderingContext} gl
     * @returns {boolean} "lowp", "mediump", or "highp"
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
     * @function me.device.focus
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

    /**
     * event management (Accelerometer)
     * @ignore
     */
    onDeviceRotate(e) {
        this.gamma = e.gamma;
        this.beta = e.beta;
        this.alpha = e.alpha;
    },

    /**
     * Enable monitor of the device accelerator to detect the amount of physical force of acceleration the device is receiving.
     * (one some device a first user gesture will be required before calling this function)
     * @function me.device.watchAccelerometer
     * @see me.device.accelerationX
     * @see me.device.accelerationY
     * @see me.device.accelerationZ
     * @returns {boolean} false if not supported or permission not granted by the user
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
     * @function me.device.unwatchAccelerometer
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
     * @function me.device.watchDeviceOrientation
     * @see me.device.alpha
     * @see me.device.beta
     * @see me.device.gamma
     * @returns {boolean} false if not supported or permission not granted by the user
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
     * @function me.device.unwatchDeviceOrientation
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
     * @function me.device.vibrate
     * @param {number|number[]} pattern pattern of vibration and pause intervals
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
 * @memberof me.device
 * @public
 * @type {number}
 * @readonly
 * @returns {number}
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
 * @memberof me.device
 * @public
 * @type {boolean}
 * @readonly
 * @returns {boolean}
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
 * @memberof me.device
 * @public
 * @type {boolean}
 * @readonly
 * @returns {boolean}
 */
Object.defineProperty(device, "sound", {
    /**
     * @ignore
     */
    get: function () {
        return hasAudio();
    }
});

export default device;
