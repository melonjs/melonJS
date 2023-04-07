/**
 * used by [un]watchDeviceOrientation()
 */
export function onDeviceRotate(e: any): void;
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
export function onReady(fn: Function): void;
/**
 * enable/disable swipe on WebView.
 * @function enableSwipe
 * @memberof device
 * @public
 * @param {boolean} [enable=true] - enable or disable swipe.
 */
export function enableSwipe(enable?: boolean | undefined): void;
/**
 * Returns true if the browser/device is in full screen mode.
 * @function isFullscreen
 * @memberof device
 * @public
 * @returns {boolean}
 */
export function isFullscreen(): boolean;
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
export function requestFullscreen(element?: Element | undefined): void;
/**
 * Exit fullscreen mode. Requires fullscreen support from the browser/device.
 * @function exitFullscreen
 * @memberof device
 * @public
 */
export function exitFullscreen(): void;
/**
 * Return a string representing the orientation of the device screen.
 * It can be "any", "natural", "landscape", "portrait", "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"
 * @function getScreenOrientation
 * @memberof device
 * @public
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
 * @returns {string} the screen orientation
 */
export function getScreenOrientation(): string;
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
export function lockOrientation(orientation: string | string[]): boolean;
/**
 * unlocks the device screen into the specified orientation.<br>
 * This method only works for installed Web apps or for Web pages in full-screen mode.
 * @function unlockOrientation
 * @memberof device
 * @public
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
 * @returns {boolean} true if the orientation was unsuccessfully unlocked
 */
export function unlockOrientation(): boolean;
/**
 * return true if the device screen orientation is in Portrait mode
 * @function isPortrait
 * @memberof device
 * @public
 * @returns {boolean}
 */
export function isPortrait(): boolean;
/**
 * return true if the device screen orientation is in Portrait mode
 * @function isLandscape
 * @memberof device
 * @public
 * @returns {boolean}
 */
export function isLandscape(): boolean;
/**
 * return the device storage
 * @function getStorage
 * @memberof device
 * @public
 * @see save
 * @param {string} [type="local"]
 * @returns {object} a reference to the device storage
 */
export function getStorage(type?: string | undefined): object;
/**
 * return the parent DOM element for the given parent name or HTMLElement object
 * @function getParentElement
 * @memberof device
 * @public
 * @param {string|HTMLElement} element - the parent element name or a HTMLElement object
 * @returns {HTMLElement} the parent Element
 */
export function getParentElement(element: string | HTMLElement): HTMLElement;
/**
 * return the DOM element for the given element name or HTMLElement object
 * @function getElement
 * @memberof device
 * @public
 * @param {string|HTMLElement} element - the parent element name or a HTMLElement object
 * @returns {HTMLElement} the corresponding DOM Element or null if not existing
 */
export function getElement(element: string | HTMLElement): HTMLElement;
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
export function getElementBounds(element: string | HTMLElement): DOMRect;
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
export function getParentBounds(element: string | HTMLElement): DOMRect;
/**
 * returns true if the device supports WebGL
 * @function isWebGLSupported
 * @memberof device
 * @public
 * @param {object} [options] - context creation options
 * @param {boolean} [options.failIfMajorPerformanceCaveat=true] - If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
 * @returns {boolean} true if WebGL is supported
 */
export function isWebGLSupported(options?: {
    failIfMajorPerformanceCaveat?: boolean | undefined;
} | undefined): boolean;
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
export function focus(): void;
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
export function watchAccelerometer(): boolean;
/**
 * unwatch Accelerometor event
 * @function unwatchAccelerometer
 * @memberof device
 * @public
 */
export function unwatchAccelerometer(): void;
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
export function watchDeviceOrientation(): boolean;
/**
 * unwatch Device orientation event
 * @function unwatchDeviceOrientation
 * @memberof device
 * @public
 */
export function unwatchDeviceOrientation(): void;
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
export function vibrate(pattern: number | number[]): void;
/**
 * the device platform type
 * @name platform
 * @memberof device
 * @readonly
 * @public
 * @type {device.platform}
 */
export let platform: device.platform;
/**
 * True if the browser supports Touch Events
 * @name touchEvent
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const touchEvent: boolean;
/**
 * True if the browser supports Pointer Events
 * @name pointerEvent
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const pointerEvent: boolean;
/**
 * Touch capabilities (support either Touch or Pointer events)
 * @name touch
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const touch: boolean;
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
export const maxTouchPoints: number;
/**
 * W3C standard wheel events
 * @name wheel
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const wheel: boolean;
/**
 * Browser pointerlock api support
 * @name hasPointerLockSupport
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const hasPointerLockSupport: boolean;
/**
 * Browser device orientation
 * @name hasDeviceOrientation
 * @memberof device
 * @readonly
 * @public
 * @type {boolean}
 */
export const hasDeviceOrientation: boolean;
/**
 * Supports the ScreenOrientation API
 * @name screenOrientation
 * @memberof device
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/onchange
 * @type {boolean}
 * @readonly
 * @public
 */
export const screenOrientation: boolean;
/**
 * Browser accelerometer capabilities
 * @name hasAccelerometer
 * @memberof device
 * @readonly
 * @public
 * @type {boolean}
 */
export const hasAccelerometer: boolean;
/**
 * Browser full screen support
 * @name hasFullscreenSupport
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const hasFullscreenSupport: boolean;
/**
 * Device WebAudio Support
 * @name hasWebAudio
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const hasWebAudio: boolean;
/**
 * Device HTML5Audio Support
 * @name hasHTML5Audio
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const hasHTML5Audio: boolean;
/**
 * Returns true if the browser/device has audio capabilities.
 * @name sound
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const sound: boolean;
/**
 * Browser Local Storage capabilities <br>
 * (this flag will be set to false if cookies are blocked)
 * @name localStorage
 * @memberof device
 * @readonly
 * @public
 * @type {boolean}
 */
export const localStorage: boolean;
/**
 * equals to true if the device browser supports OffScreenCanvas.
 * @name offscreenCanvas
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const offscreenCanvas: boolean;
/**
 * Browser Base64 decoding capability
 * @name nativeBase64
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const nativeBase64: boolean;
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
export const language: string;
/**
 * Ratio of the resolution in physical pixels to the resolution in CSS pixels for the current display device.
 * @name devicePixelRatio
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 */
export const devicePixelRatio: number;
/**
 * equals to true if a mobile device.
 * (Android | iPhone | iPad | iPod | BlackBerry | Windows Phone | Kindle)
 * @name isMobile
 * @memberof device
 * @type {boolean}
 * @readonly
 * @public
 */
export const isMobile: boolean;
/**
 * contains the g-force acceleration along the x-axis.
 * @name accelerationX
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @see device.watchAccelerometer
 */
export let accelerationX: number;
/**
 * contains the g-force acceleration along the y-axis.
 * @name accelerationY
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @see device.watchAccelerometer
 */
export let accelerationY: number;
/**
 * contains the g-force acceleration along the z-axis.
 * @name accelerationZ
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @see device.watchAccelerometer
 */
export let accelerationZ: number;
/**
 * Device orientation Gamma property. Gives angle on tilting a portrait held phone left or right
 * @name gamma
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @see device.watchDeviceOrientation
 */
export let gamma: number;
/**
 * Device orientation Beta property. Gives angle on tilting a portrait held phone forward or backward
 * @name beta
 * @memberof device
 * @type {number}
 * @readonly
 * @public
 * @see device.watchDeviceOrientation
 */
export let beta: number;
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
export let alpha: number;
/**
 * Specify whether to pause the game when losing focus
 * @name pauseOnBlur
 * @memberof device
 * @type {boolean}
 * @public
 * @default true
 */
export let pauseOnBlur: boolean;
/**
 * Specify whether to unpause the game when gaining focus
 * @name resumeOnFocus
 * @memberof device
 * @type {boolean}
 * @public
 * @default true
 */
export let resumeOnFocus: boolean;
/**
 * Specify whether to automatically bring the window to the front
 * @name autoFocus
 * @memberof device
 * @type {boolean}
 * @public
 * @default true
 */
export let autoFocus: boolean;
/**
 * Specify whether to stop the game when losing focus or not.
 * The engine restarts on focus if this is enabled.
 * @name stopOnBlur
 * @memberof device
 * @type {boolean}
 * @public
 * @default false
 */
export let stopOnBlur: boolean;
