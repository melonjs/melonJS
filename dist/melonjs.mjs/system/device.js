/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { getParent } from '../video/video.js';
import save from './save.js';
import { prefixed } from '../utils/agent.js';
import { DOMContentLoaded } from './dom.js';
import * as platform$1 from './platform.js';

/**
 * device type and capabilities
 * @namespace device
 */

let accelInitialized = false;
let deviceOrientationInitialized = false;
// swipe utility fn & flag
let swipeEnabled = true;
// a cache DOMRect object
let domRect = {left: 0, top: 0, x: 0, y: 0, width: 0, height: 0, right: 0, bottom: 0};

function disableSwipeFn(e) {
    e.preventDefault();
    if (typeof globalThis.scroll === "function") {
        globalThis.scroll(0, 0);
    }
    return false;
}

function hasLocalStorage() {
    try {
        return !!globalThis.localStorage;
    } catch (e) {
        // the above generates an exception when cookies are blocked
        return false;
    }
}

function hasOffscreenCanvas() {
    try {
        // some browser (e.g. Safari) implements WebGL1 and WebGL2 contexts only
        // https://bugzilla.mozilla.org/show_bug.cgi?id=801176
        return (typeof globalThis.OffscreenCanvas !== "undefined") && ((new globalThis.OffscreenCanvas(0, 0).getContext( "2d" )) !== null);
    } catch (e) {
        return false;
    }
}

/**
 * used by [un]watchAccelerometer()
 */
function onDeviceMotion(e) {
    // Accelerometer information
    accelerationX = e.accelerationIncludingGravity.x;
    accelerationY = e.accelerationIncludingGravity.y;
    accelerationZ = e.accelerationIncludingGravity.z;
}

/**
 * used by [un]watchDeviceOrientation()
 */
function onDeviceRotate(e) {
    gamma = e.gamma;
    beta = e.beta;
    alpha = e.alpha;
}

/**
 * the device platform type
 * @name platform
 * @memberof device
 * @readonly
 * @public
 * @type {device.platform}
 */
let platform = platform$1;

/**
 * True if the browser supports Touch Events
 * @name touchEvent
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const touchEvent = !!("ontouchstart" in globalThis);

/**
 * True if the browser supports Pointer Events
 * @name pointerEvent
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const pointerEvent = !!globalThis.PointerEvent;

/**
 * Touch capabilities (support either Touch or Pointer events)
 * @name touch
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const touch = touchEvent || (pointerEvent && globalThis.navigator.maxTouchPoints > 0);

/**
 * the maximum number of simultaneous touch contact points are supported by the current device.
 * @name maxTouchPoints
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @example
 * if (me.device.maxTouchPoints > 1) {
 *     // device supports multi-touch
 * }
 */
const maxTouchPoints = touch ? (pointerEvent ? globalThis.navigator.maxTouchPoints || 1 : 10) : 1;

/**
 * W3C standard wheel events
 * @name wheel
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const wheel = typeof globalThis.document !== "undefined" && "onwheel" in globalThis.document.createElement("div");


/**
 * Browser pointerlock api support
 * @name hasPointerLockSupport
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const hasPointerLockSupport = typeof globalThis.document !== "undefined" && typeof globalThis.document.pointerLockElement !== "undefined";

/**
 * Browser device orientation
 * @name hasDeviceOrientation
 * @memberof device
 * @readonly
 * @public
 * @type {boolean}
 */
const hasDeviceOrientation = !!globalThis.DeviceOrientationEvent;

/**
 * Supports the ScreenOrientation API
 * @name screenOrientation
 * @memberof device
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/onchange
 * @type {boolean}
 * @readonly
 * @public
 */
const screenOrientation = (typeof screen !== "undefined") && (typeof screen.orientation !== "undefined");

/**
 * Browser accelerometer capabilities
 * @name hasAccelerometer
 * @memberof device
 * @readonly
 * @public
 * @type {boolean}
 */
const hasAccelerometer = !!globalThis.DeviceMotionEvent;

/**
 * Browser full screen support
 * @name hasFullscreenSupport
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const hasFullscreenSupport = typeof globalThis.document !== "undefined" && (prefixed("fullscreenEnabled", globalThis.document) || globalThis.document.mozFullScreenEnabled);

if (hasFullscreenSupport === true) {
    globalThis.document.exitFullscreen = prefixed("cancelFullScreen", globalThis.document) || prefixed("exitFullscreen", globalThis.document);
}

/**
 * Device WebAudio Support
 * @name hasWebAudio
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const hasWebAudio = !!(globalThis.AudioContext || globalThis.webkitAudioContext);

/**
 * Device HTML5Audio Support
 * @name hasHTML5Audio
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const hasHTML5Audio = (typeof globalThis.Audio !== "undefined");

/**
 * Returns true if the browser/device has audio capabilities.
 * @name sound
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const sound = hasWebAudio || hasHTML5Audio;

/**
 * Browser Local Storage capabilities <br>
 * (this flag will be set to false if cookies are blocked)
 * @name localStorage
 * @memberof device
 * @readonly
 * @public
 * @type {boolean}
 */
const localStorage = hasLocalStorage();

/**
 * equals to true if the device browser supports OffScreenCanvas.
 * @name offscreenCanvas
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const offscreenCanvas = hasOffscreenCanvas();

/**
 * Browser Base64 decoding capability
 * @name nativeBase64
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const nativeBase64 = (typeof(globalThis.atob) === "function");

/**
 * a string representing the preferred language of the user, usually the language of the browser UI.
 * (will default to "en" if the information is not available)
 * @name language
 * @memberof device
 * @type {string}
 * @readonly
 * @public
 * @see http://www.w3schools.com/tags/ref_language_codes.asp
 */
const language = typeof globalThis.navigator !== "undefined" ? globalThis.navigator.language || globalThis.navigator.browserLanguage || globalThis.navigator.userLanguage || "en" : "en";

/**
 * Ratio of the resolution in physical pixels to the resolution in CSS pixels for the current display device.
 * @name devicePixelRatio
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 */
const devicePixelRatio = globalThis.devicePixelRatio || 1;

/**
 * equals to true if a mobile device.
 * (Android | iPhone | iPad | iPod | BlackBerry | Windows Phone | Kindle)
 * @name isMobile
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
const isMobile = platform.isMobile;

/**
 * contains the g-force acceleration along the x-axis.
 * @name accelerationX
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @see device.watchAccelerometer
 */
let accelerationX = 0;

/**
 * contains the g-force acceleration along the y-axis.
 * @name accelerationY
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @see device.watchAccelerometer
 */
let accelerationY = 0;

/**
 * contains the g-force acceleration along the z-axis.
 * @name accelerationZ
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @see device.watchAccelerometer
 */
let accelerationZ = 0;

/**
 * Device orientation Gamma property. Gives angle on tilting a portrait held phone left or right
 * @name gamma
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @see device.watchDeviceOrientation
 */
let gamma = 0;

/**
 * Device orientation Beta property. Gives angle on tilting a portrait held phone forward or backward
 * @name beta
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @see device.watchDeviceOrientation
 */
let beta = 0;

/**
 * Device orientation Alpha property. Gives angle based on the rotation of the phone around its z axis.
 * The z-axis is perpendicular to the phone, facing out from the center of the screen.
 * @name alpha
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @see device.watchDeviceOrientation
 */
let alpha = 0;

/**
 * Specify whether to pause the game when losing focus
 * @name pauseOnBlur
 * @memberof device
 * @type {boolean}
 * @public
 * @default true
 */
let pauseOnBlur = true;

/**
 * Specify whether to unpause the game when gaining focus
 * @name resumeOnFocus
 * @memberof device
 * @type {boolean}
 * @public
 * @default true
 */
let resumeOnFocus = true;

/**
 * Specify whether to automatically bring the window to the front
 * @name autoFocus
 * @memberof device
 * @type {boolean}
 * @public
 * @default true
 */
let autoFocus = true;

/**
 * Specify whether to stop the game when losing focus or not.
 * The engine restarts on focus if this is enabled.
 * @name stopOnBlur
 * @memberof device
 * @type {boolean}
 * @public
 * @default false
 */
let stopOnBlur = false;

/**
* specify a function to execute when the Device is fully loaded and ready
* @function onReady
* @memberof device
* @public
* @param {Function} fn - the function to be executed
* @example
* // small game skeleton
* let game = {
*    // called by the me.device.onReady function
*    onload = function () {
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
*    };
*
*    // callback when everything is loaded
*    loaded = function () {
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
function onReady(fn) {
    DOMContentLoaded(fn);
}

/**
 * enable/disable swipe on WebView.
 * @function enableSwipe
 * @memberof device
 * @public
 * @param {boolean} [enable=true] - enable or disable swipe.
 */
function enableSwipe(enable) {
    let moveEvent = pointerEvent ? "pointermove" : (touchEvent ? "touchmove" : "mousemove");
    if (enable !== false) {
        if (swipeEnabled === false) {
            globalThis.document.removeEventListener(moveEvent, disableSwipeFn);
            swipeEnabled = true;
        }
    } else if (swipeEnabled === true) {
        globalThis.document.addEventListener(moveEvent, disableSwipeFn, { passive: false });
        swipeEnabled = false;
    }
}

/**
 * Returns true if the browser/device is in full screen mode.
 * @function isFullscreen
 * @memberof device
 * @public
 * @returns {boolean}
 */
function isFullscreen() {
    if (hasFullscreenSupport) {
        return !!(prefixed("fullscreenElement", globalThis.document) || globalThis.document.mozFullScreenElement);
    } else {
        return false;
    }
}

/**
 * Triggers a fullscreen request. Requires fullscreen support from the browser/device.
 * @function requestFullscreen
 * @memberof device
 * @public
 * @param {Element} [element] - the element to be set in full-screen mode.
 * @example
 * // add a keyboard shortcut to toggle Fullscreen mode on/off
 * me.input.bindKey(me.input.KEY.F, "toggleFullscreen");
 * me.event.on(me.event.KEYDOWN, function (action, keyCode, edge) {
 *    // toggle fullscreen on/off
 *    if (action === "toggleFullscreen") {
 *       me.device.requestFullscreen();
 *    } else {
 *       me.device.exitFullscreen();
 *    }
 * });
 */
function requestFullscreen(element) {
    if (hasFullscreenSupport && !isFullscreen()) {
        element = element || getParent();
        element.requestFullscreen = prefixed("requestFullscreen", element) || element.mozRequestFullScreen;
        element.requestFullscreen();
    }
}

/**
 * Exit fullscreen mode. Requires fullscreen support from the browser/device.
 * @function exitFullscreen
 * @memberof device
 * @public
 */
function exitFullscreen() {
    if (hasFullscreenSupport && isFullscreen()) {
        globalThis.document.exitFullscreen();
    }
}

/**
 * Return a string representing the orientation of the device screen.
 * It can be "any", "natural", "landscape", "portrait", "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"
 * @function getScreenOrientation
 * @memberof device
 * @public
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
 * @returns {string} the screen orientation
 */
function getScreenOrientation() {
    const PORTRAIT = "portrait";
    const LANDSCAPE = "landscape";

    let screen = globalThis.screen;

    // first try using "standard" values
    if (screenOrientation === true) {
        let orientation = prefixed("orientation", screen);
        if (typeof orientation !== "undefined" && typeof orientation.type === "string") {
            // Screen Orientation API specification
            return orientation.type;
        } else if (typeof orientation === "string") {
            // moz/ms-orientation are strings
            return orientation;
        }
    }

    // check using the deprecated API
    if (typeof globalThis.orientation === "number") {
        return (Math.abs(globalThis.orientation) === 90) ? LANDSCAPE : PORTRAIT;
    }

    // fallback to window size check
    return (globalThis.outerWidth > globalThis.outerHeight) ? LANDSCAPE : PORTRAIT;
}

/**
 * locks the device screen into the specified orientation.<br>
 * This method only works for installed Web apps or for Web pages in full-screen mode.
 * @function lockOrientation
 * @memberof device
 * @public
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
 * @param {string|string[]} orientation - The orientation into which to lock the screen.
 * @returns {boolean} true if the orientation was unsuccessfully locked
 */
function lockOrientation(orientation) {
    let screen = globalThis.screen;
    if (typeof screen !== "undefined") {
        let _lockOrientation = prefixed("lockOrientation", screen);
        if (typeof _lockOrientation !== "undefined") {
            return _lockOrientation(orientation);
        }
    }
    return false;
}

/**
 * unlocks the device screen into the specified orientation.<br>
 * This method only works for installed Web apps or for Web pages in full-screen mode.
 * @function unlockOrientation
 * @memberof device
 * @public
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
 * @returns {boolean} true if the orientation was unsuccessfully unlocked
 */
function unlockOrientation() {
    let screen = globalThis.screen;
    if (typeof screen !== "undefined") {
        let _unlockOrientation = prefixed("unlockOrientation", screen);
        if (typeof _unlockOrientation !== "undefined") {
            return _unlockOrientation();
        }
    }
    return false;
}

/**
 * return true if the device screen orientation is in Portrait mode
 * @function isPortrait
 * @memberof device
 * @public
 * @returns {boolean}
 */
function isPortrait() {
    return getScreenOrientation().includes("portrait");
}

/**
 * return true if the device screen orientation is in Portrait mode
 * @function isLandscape
 * @memberof device
 * @public
 * @returns {boolean}
 */
function isLandscape() {
    return getScreenOrientation().includes("landscape");
}

/**
 * return the device storage
 * @function getStorage
 * @memberof device
 * @public
 * @see save
 * @param {string} [type="local"]
 * @returns {object} a reference to the device storage
 */
function getStorage(type = "local") {
    switch (type) {
        case "local" :
            return save;

        default :
            throw new Error("storage type " + type + " not supported");
    }
}

/**
 * return the parent DOM element for the given parent name or HTMLElement object
 * @function getParentElement
 * @memberof device
 * @public
 * @param {string|HTMLElement} element - the parent element name or a HTMLElement object
 * @returns {HTMLElement} the parent Element
 */
function getParentElement(element) {
    let target = getElement(element);

    if (target.parentNode !== null) {
        target = target.parentNode;
    }

    return target;
}

/**
 * return the DOM element for the given element name or HTMLElement object
 * @function getElement
 * @memberof device
 * @public
 * @param {string|HTMLElement} element - the parent element name or a HTMLElement object
 * @returns {HTMLElement} the corresponding DOM Element or null if not existing
 */
function getElement(element) {
    let target = null;

    if (element !== "undefined") {
        if (typeof element === "string") {
            target = globalThis.document.getElementById(element);
        } else if (typeof element === "object" && element.nodeType === Node.ELEMENT_NODE) {
            target = element;
        }
    }

    // fallback, if invalid target or non HTMLElement object
    if (!target)  {
        //default to document.body
        target = globalThis.document.body;
    }

    return target;
}

/**
 * returns the size of the given HTMLElement and its position relative to the viewport
 * <br><img src="images/element-box-diagram.png"/>
 * @function getElementBounds
 * @memberof device
 * @public
 * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
 * @param {string|HTMLElement} element - an HTMLElement object
 * @returns {DOMRect} the size and position of the element relatively to the viewport
 */
function getElementBounds(element) {
    if (typeof element === "object" && element !== globalThis.document.body && typeof element.getBoundingClientRect !== "undefined") {
        return element.getBoundingClientRect();
    } else {
        domRect.width = domRect.right = globalThis.innerWidth;
        domRect.height = domRect.bottom = globalThis.innerHeight;
        return domRect;
    }
}

/**
 * returns the size of the given HTMLElement Parent and its position relative to the viewport
 * <br><img src="images/element-box-diagram.png"/>
 * @function getParentBounds
 * @memberof device
 * @public
 * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMRect
 * @param {string|HTMLElement} element - an HTMLElement object
 * @returns {DOMRect} the size and position of the given element parent relative to the viewport
 */
function getParentBounds(element) {
    return getElementBounds(getParentElement(element));
}

/**
 * returns true if the device supports WebGL
 * @function isWebGLSupported
 * @memberof device
 * @public
 * @param {object} [options] - context creation options
 * @param {boolean} [options.failIfMajorPerformanceCaveat=true] - If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
 * @returns {boolean} true if WebGL is supported
 */
function isWebGLSupported(options) {
    let _supported = false;
    try {
        let canvas = globalThis.document.createElement("canvas");
        let ctxOptions = {
            stencil: true,
            failIfMajorPerformanceCaveat: options.failIfMajorPerformanceCaveat
        };
        _supported = !! (globalThis.WebGLRenderingContext && (canvas.getContext("webgl", ctxOptions) || canvas.getContext("experimental-webgl", ctxOptions)));
    } catch (e) {
        _supported = false;
    }

    return _supported;
}

/**
 * Makes a request to bring this device window to the front.
 * @function focus
 * @memberof device
 * @public
 * @example
 *  if (clicked) {
 *    me.device.focus();
 *  }
 */
function focus() {
    if (typeof (globalThis.focus) === "function") {
        globalThis.focus();
    }
}

/**
 * Enable monitor of the device accelerator to detect the amount of physical force of acceleration the device is receiving.
 * (one some device a first user gesture will be required before calling this function)
 * @function watchAccelerometer
 * @memberof device
 * @public
 * @see device.accelerationX
 * @see device.accelerationY
 * @see device.accelerationZ
 * @link {http://www.mobilexweb.com/samples/ball.html}
 * @link {http://www.mobilexweb.com/blog/safari-ios-accelerometer-websockets-html5}
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
function watchAccelerometer() {
    if (hasAccelerometer && !accelInitialized) {
        if (DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === "granted") {
                        // add a listener for the devicemotion event
                        globalThis.addEventListener("devicemotion", onDeviceMotion, false);
                        accelInitialized = true;
                    }
                }).catch(console.error);
        } else {
            // add a listener for the devicemotion event
            globalThis.addEventListener("devicemotion", onDeviceMotion, false);
            accelInitialized = true;
        }
    }
    return accelInitialized;
}

/**
 * unwatch Accelerometor event
 * @function unwatchAccelerometer
 * @memberof device
 * @public
 */
function unwatchAccelerometer() {
    if (accelInitialized) {
        // remove the listener for the devicemotion event
        globalThis.removeEventListener("devicemotion", onDeviceMotion, false);
        accelInitialized = false;
    }
}

/**
 * Enable monitor of the device orientation to detect the current orientation of the device as compared to the Earth coordinate frame.
 * (one some device a first user gesture will be required before calling this function)
 * @function watchDeviceOrientation
 * @memberof device
 * @public
 * @see device.alpha
 * @see device.beta
 * @see device.gamma
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
function watchDeviceOrientation() {
    if (hasDeviceOrientation && !deviceOrientationInitialized) {
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === "granted") {
                        globalThis.addEventListener("deviceorientation", onDeviceRotate, false);
                        deviceOrientationInitialized = true;
                    }
                }).catch(console.error);
        } else {
            globalThis.addEventListener("deviceorientation", onDeviceRotate, false);
            deviceOrientationInitialized = true;
        }
    }
    return deviceOrientationInitialized;
}

/**
 * unwatch Device orientation event
 * @function unwatchDeviceOrientation
 * @memberof device
 * @public
 */
function unwatchDeviceOrientation() {
    if (deviceOrientationInitialized) {
        globalThis.removeEventListener("deviceorientation", onDeviceRotate, false);
        deviceOrientationInitialized = false;
    }
}

/**
 * the vibrate method pulses the vibration hardware on the device, <br>
 * If the device doesn't support vibration, this method has no effect. <br>
 * If a vibration pattern is already in progress when this method is called,
 * the previous pattern is halted and the new one begins instead.
 * @function vibrate
 * @memberof device
 * @public
 * @param {number|number[]} pattern - pattern of vibration and pause intervals
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
function vibrate(pattern) {
    if (typeof globalThis.navigator !== "undefined" && typeof globalThis.navigator.vibrate === "function") {
        globalThis.navigator.vibrate(pattern);
    }
}

export { accelerationX, accelerationY, accelerationZ, alpha, autoFocus, beta, devicePixelRatio, enableSwipe, exitFullscreen, focus, gamma, getElement, getElementBounds, getParentBounds, getParentElement, getScreenOrientation, getStorage, hasAccelerometer, hasDeviceOrientation, hasFullscreenSupport, hasHTML5Audio, hasPointerLockSupport, hasWebAudio, isFullscreen, isLandscape, isMobile, isPortrait, isWebGLSupported, language, localStorage, lockOrientation, maxTouchPoints, nativeBase64, offscreenCanvas, onDeviceRotate, onReady, pauseOnBlur, platform, pointerEvent, requestFullscreen, resumeOnFocus, screenOrientation, sound, stopOnBlur, touch, touchEvent, unlockOrientation, unwatchAccelerometer, unwatchDeviceOrientation, vibrate, watchAccelerometer, watchDeviceOrientation, wheel };
