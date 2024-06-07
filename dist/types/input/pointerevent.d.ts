/**
 * return true if there are pending pointer events in the queue
 * @memberof input
 * @returns true if there are pending events
 */
export function hasActiveEvents(): boolean;
/**
 * return true if there are register pointer events
 * @memberof input
 * @see registerPointerEvent
 * @returns true if there are pending events
 */
export function hasRegisteredEvents(): boolean;
/**
 * Translate the specified x and y values from the global (absolute)
 * coordinate to local (viewport) relative coordinate.
 * @memberof input
 * @param {number} x - the global x coordinate to be translated.
 * @param {number} y - the global y coordinate to be translated.
 * @param {Vector2d} [v] - an optional vector object where to set the translated coordinates
 * @returns {Vector2d} A vector object with the corresponding translated coordinates
 * @example
 * onMouseEvent : function (pointer) {
 *    // convert the given into local (viewport) relative coordinates
 *    let pos = me.input.globalToLocal(pointer.clientX, pointer.clientY);
 *    // do something with pos !
 * };
 */
export function globalToLocal(x: number, y: number, v?: Vector2d | undefined): Vector2d;
/**
 * enable/disable all gestures on the given element.<br>
 * by default melonJS will disable browser handling of all panning and zooming gestures.
 * @memberof input
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
 * @param {HTMLCanvasElement} element
 * @param {string} [value="none"]
 */
export function setTouchAction(element: HTMLCanvasElement, value?: string | undefined): void;
/**
 * Associate a pointer event to a keycode<br>
 * Left button – 0
 * Middle button – 1
 * Right button – 2
 * @memberof input
 * @param {number} [button=input.pointer.LEFT] - (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
 * @param {input.KEY} keyCode
 * @example
 * // enable the keyboard
 * me.input.bindKey(me.input.KEY.X, "shoot");
 * // map the left button click on the X key (default if the button is not specified)
 * me.input.bindPointer(me.input.KEY.X);
 * // map the right button click on the X key
 * me.input.bindPointer(me.input.pointer.RIGHT, me.input.KEY.X);
 */
export function bindPointer(...args: any[]): void;
/**
 * unbind the defined keycode
 * @memberof input
 * @param {number} [button=input.pointer.LEFT] - (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
 * @example
 * me.input.unbindPointer(me.input.pointer.LEFT);
 */
export function unbindPointer(button?: number | undefined): void;
/**
 * allows registration of event listeners on the object target. <br>
 * melonJS will pass a me.Pointer object to the defined callback.
 * @see Pointer
 * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
 * @memberof input
 * @param {string} eventType - The event type for which the object is registering <br>
 * melonJS currently supports: <br>
 * <ul>
 *   <li><code>"pointermove"</code></li>
 *   <li><code>"pointerdown"</code></li>
 *   <li><code>"pointerup"</code></li>
 *   <li><code>"pointerenter"</code></li>
 *   <li><code>"pointerover"</code></li>
 *   <li><code>"pointerleave"</code></li>
 *   <li><code>"pointercancel"</code></li>
 *   <li><code>"wheel"</code></li>
 * </ul>
 * @param {Rect|Polygon|Line|Ellipse} region - a shape representing the region to register on
 * @param {Function} callback - methods to be called when the event occurs.
 * Returning `false` from the defined callback will prevent the event to be propagated to other objects
 * @example
 *  // onActivate function
 *  onActivateEvent: function () {
 *     // register on the 'pointerdown' event
 *     me.input.registerPointerEvent('pointerdown', this, (e) => this.pointerDown(e));
 *  },
 *
 *  // pointerDown event callback
 *  pointerDown: function (pointer) {
 *    // do something
 *    ....
 *    // don"t propagate the event to other objects
 *    return false;
 *  },
 */
export function registerPointerEvent(eventType: string, region: Rect | Polygon | Line | Ellipse, callback: Function): void;
/**
 * allows the removal of event listeners from the object target.
 * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
 * @memberof input
 * @param {string} eventType - The event type for which the object was registered. See {@link input.registerPointerEvent}
 * @param {Rect|Polygon|Line|Ellipse} region - the registered region to release for this event
 * @param {Function} [callback="all"] - if specified unregister the event only for the specific callback
 * @example
 * // release the registered region on the 'pointerdown' event
 * me.input.releasePointerEvent('pointerdown', this);
 */
export function releasePointerEvent(eventType: string, region: Rect | Polygon | Line | Ellipse, callback?: Function | undefined): void;
/**
 * allows the removal of all registered event listeners from the object target.
 * @memberof input
 * @param {Rect|Polygon|Line|Ellipse} region - the registered region to release event from
 * @example
 * // release all registered event on the
 * me.input.releaseAllPointerEvents(this);
 */
export function releaseAllPointerEvents(region: Rect | Polygon | Line | Ellipse): void;
/**
 * request for the pointer to be locked on the parent DOM element.
 * (Must be called in a click event or an event that requires user interaction)
 * @memberof input
 * @returns {boolean} return true if the request was successfully submitted
 * @example
 * // register on the pointer lock change event
 * event.on(event.POINTERLOCKCHANGE, (locked)=> {
 *     console.log("pointer lock: " + locked);
 * });
 * // request for pointer lock
 * me.input.requestPointerLock();
 */
export function requestPointerLock(): boolean;
/**
 * Initiates an exit from pointer lock state
 * @memberof input
 * @returns {boolean} return true if the request was successfully submitted
 */
export function exitPointerLock(): boolean;
/**
  * the default target element for pointer events (usually the canvas element in which the game is rendered)
  * @public
  * @type {EventTarget}
  * @name pointerEventTarget
  * @memberof input
  */
export let pointerEventTarget: EventTarget;
/**
 * Pointer information (current position and size)
 * @public
 * @type {Rect}
 * @name pointer
 * @memberof input
 */
export let pointer: Rect;
/**
 * indicates if the pointer is currently locked
 * @public
 * @type {boolean}
 * @name locked
 * @memberof input
 */
export let locked: boolean;
/**
 * time interval for event throttling in milliseconds<br>
 * default value : "1000/me.timer.maxfps" ms<br>
 * set to 0 ms to disable the feature
 * @public
 * @type {number}
 * @name throttlingInterval
 * @memberof input
 */
export let throttlingInterval: number;
import type Vector2d from "./../math/vector2.js";
import Rect from "./../geometries/rectangle.js";
