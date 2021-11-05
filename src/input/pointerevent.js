import {preventDefault} from "./input.js";
import {getBindingKey, triggerKeyEvent} from "./keyboard.js";
import Vector2d from "./../math/vector2.js";
import { renderer, scaleRatio } from "./../video/video.js";
import * as fctUtil from "./../utils/function.js";
import * as arrayUtil from "./../utils/array.js";
import * as event from "./../system/event.js";
import timer from "./../system/timer.js";
import pool from "./../system/pooling.js";
import device from "./../system/device.js";
import Pointer from "./pointer.js";
import Rect from "./../shapes/rectangle.js";
import Container from "./../renderable/container.js";
import Renderable from "./../renderable/renderable.js";
import { world, viewport } from "./../game.js";

/**
 * A pool of `Pointer` objects to cache pointer/touch event coordinates.
 * @type {Array.<Vector>}
 * @ignore
 */
var T_POINTERS = [];

// list of registered Event handlers
var eventHandlers = new Map();

// a cache rect represeting the current pointer area
var currentPointer;

// some useful flags
var pointerInitialized = false;

// Track last event timestamp to prevent firing events out of order
var lastTimeStamp = 0;

// "active" list of supported events
var activeEventList = [];

// internal constants
var WHEEL           = ["wheel"];
var POINTER_MOVE    = ["pointermove",   "mousemove",    "touchmove"];
var POINTER_DOWN    = ["pointerdown",   "mousedown",    "touchstart"];
var POINTER_UP      = ["pointerup",     "mouseup",      "touchend"];
var POINTER_CANCEL  = ["pointercancel", "mousecancel",  "touchcancel"];
var POINTER_ENTER   = ["pointerenter",  "mouseenter",   "touchenter"];
var POINTER_OVER    = ["pointerover",   "mouseover",    "touchover"];
var POINTER_LEAVE   = ["pointerleave",  "mouseleave",   "touchleave"];

// list of standard pointer event type
var pointerEventList = [
    WHEEL[0],
    POINTER_MOVE[0],
    POINTER_DOWN[0],
    POINTER_UP[0],
    POINTER_CANCEL[0],
    POINTER_ENTER[0],
    POINTER_OVER[0],
    POINTER_LEAVE[0]
];

// legacy mouse event type
var mouseEventList = [
    WHEEL[0],
    POINTER_MOVE[1],
    POINTER_DOWN[1],
    POINTER_UP[1],
    POINTER_CANCEL[1],
    POINTER_ENTER[1],
    POINTER_OVER[1],
    POINTER_LEAVE[1]
];

// iOS style touch event type
var touchEventList = [
    POINTER_MOVE[2],
    POINTER_DOWN[2],
    POINTER_UP[2],
    POINTER_CANCEL[2],
    POINTER_ENTER[2],
    POINTER_OVER[2],
    POINTER_LEAVE[2]
];

var pointerEventMap = {
    wheel : WHEEL,
    pointermove: POINTER_MOVE,
    pointerdown: POINTER_DOWN,
    pointerup: POINTER_UP,
    pointercancel: POINTER_CANCEL,
    pointerenter: POINTER_ENTER,
    pointerover: POINTER_OVER,
    pointerleave: POINTER_LEAVE
};

/**
 * Array of normalized events (mouse, touch, pointer)
 * @ignore
 */
var normalizedEvents = [];

/**
 * addEventListerner for the specified event list and callback
 * @ignore
 */
function registerEventListener(eventList, callback) {
    for (var x = 0; x < eventList.length; x++) {
        if (POINTER_MOVE.indexOf(eventList[x]) === -1) {
            pointerEventTarget.addEventListener(eventList[x], callback, { passive: (preventDefault === false) });
        }
    }
}

/**
 * @ignore
 */
function findActiveEvent(activeEventList, eventTypes) {
    for (var i = 0; i < eventTypes.length; i++) {
        var event = activeEventList.indexOf(eventTypes[i]);
        if (event !== -1) {
            return eventTypes[i];
        }
    }
}

/**
 * @ignore
 */
function findAllActiveEvents(activeEventList, eventTypes) {
    var events = [];
    for (var i = 0; i < eventTypes.length; i++) {
        var event = activeEventList.indexOf(eventTypes[i]);
        if (event !== -1) {
            events.push(eventTypes[i]);
        }
    }

    return events;
}

/**
 * @ignore
 */
function triggerEvent(handlers, type, pointer, pointerId) {
    var callback;
    if (handlers.callbacks[type]) {
        handlers.pointerId = pointerId;
        for (var i = handlers.callbacks[type].length - 1; (i >= 0) && (callback = handlers.callbacks[type][i]); i--) {
            if (callback(pointer) === false) {
                // stop propagating the event if return false
                return true;
            }
        }
    }
    return false;
}

/**
 * propagate events to registered objects
 * @ignore
 */
function dispatchEvent(normalizedEvents) {
    var handled = false;

    while (normalizedEvents.length > 0) {

        // keep a reference to the last item
        var pointer = normalizedEvents.pop();
        // and put it back into our cache
        T_POINTERS.push(pointer);

        // Do not fire older events
        if (typeof(pointer.event.timeStamp) !== "undefined") {
            if (pointer.event.timeStamp < lastTimeStamp) {
                continue;
            }
            lastTimeStamp = pointer.event.timeStamp;
        }

        currentPointer.setShape(
            pointer.gameWorldX,
            pointer.gameWorldY,
            pointer.width,
            pointer.height
        );

        // trigger a global event for pointer move
        if (POINTER_MOVE.includes(pointer.type)) {
            pointer.gameX = pointer.gameLocalX = pointer.gameScreenX;
            pointer.gameY = pointer.gameLocalY = pointer.gameScreenY;
            event.emit(event.POINTERMOVE, pointer);
        }

        // fetch valid candiates from the game world container
        var candidates = world.broadphase.retrieve(currentPointer, Container.prototype._sortReverseZ);

        // add the main game viewport to the list of candidates
        candidates = candidates.concat([ viewport ]);

        for (var c = candidates.length, candidate; c--, (candidate = candidates[c]);) {
            if (eventHandlers.has(candidate) && (candidate.isKinematic !== true)) {
                var handlers = eventHandlers.get(candidate);
                var region = handlers.region;
                var ancestor = region.ancestor;
                var bounds = region.getBounds();
                var eventInBounds = false;

                if (region.floating === true) {
                    pointer.gameX = pointer.gameLocalX = pointer.gameScreenX;
                    pointer.gameY = pointer.gameLocalY = pointer.gameScreenY;
                } else {
                    pointer.gameX = pointer.gameLocalX = pointer.gameWorldX;
                    pointer.gameY = pointer.gameLocalY = pointer.gameWorldY;
                }

                // adjust gameLocalX to specify coordinates
                // within the region ancestor container
                if (typeof ancestor !== "undefined") {
                    var parentBounds = ancestor.getBounds();
                    pointer.gameLocalX = pointer.gameX - parentBounds.x;
                    pointer.gameLocalY = pointer.gameY - parentBounds.y;
                }

                // apply inverse transformation for renderable
                if (region instanceof Renderable) {
                    var gameX = pointer.gameX;
                    var gameY = pointer.gameY;
                    if (!region.currentTransform.isIdentity()) {
                        var invV = region.currentTransform.applyInverse(
                            pool.pull("Vector2d", gameX, gameY)
                        );
                        gameX = invV.x;
                        gameY = invV.y;
                        pool.push(invV);
                    }
                    eventInBounds = bounds.contains(gameX, gameY);
                } else {
                    eventInBounds =
                        bounds.contains(pointer.gameX, pointer.gameY) &&
                        (bounds === region ||
                        // if the given target is another shape than me.Rect
                        region.contains(pointer.gameLocalX, pointer.gameLocalY));
                }

                switch (pointer.type) {
                    case POINTER_MOVE[0]:
                    case POINTER_MOVE[1]:
                    case POINTER_MOVE[2]:
                    case POINTER_MOVE[3]:
                        // moved out of bounds: trigger the POINTER_LEAVE callbacks
                        if (handlers.pointerId === pointer.pointerId && !eventInBounds) {
                            if (triggerEvent(handlers, findActiveEvent(activeEventList, POINTER_LEAVE), pointer, null)) {
                                handled = true;
                                break;
                            }
                        }
                        // no pointer & moved inside of bounds: trigger the POINTER_ENTER callbacks
                        else if (handlers.pointerId === null && eventInBounds) {
                            if (triggerEvent(handlers, findActiveEvent(activeEventList, POINTER_ENTER), pointer, pointer.pointerId)) {
                                handled = true;
                                break;
                            }
                        }

                        // trigger the POINTER_MOVE callbacks
                        if (eventInBounds && triggerEvent(handlers, pointer.type, pointer, pointer.pointerId)) {
                            handled = true;
                            break;
                        }
                        break;

                    case POINTER_UP[0]:
                    case POINTER_UP[1]:
                    case POINTER_UP[2]:
                    case POINTER_UP[3]:
                        // pointer defined & inside of bounds: trigger the POINTER_UP callback
                        if (handlers.pointerId === pointer.pointerId && eventInBounds) {
                            // trigger the corresponding callback
                            if (triggerEvent(handlers, pointer.type, pointer, null)) {
                                handled = true;
                                break;
                            }
                        }
                        break;

                    case POINTER_CANCEL[0]:
                    case POINTER_CANCEL[1]:
                    case POINTER_CANCEL[2]:
                    case POINTER_CANCEL[3]:
                        // pointer defined: trigger the POINTER_CANCEL callback
                        if (handlers.pointerId === pointer.pointerId) {
                            // trigger the corresponding callback
                            if (triggerEvent(handlers, pointer.type, pointer, null)) {
                                handled = true;
                                break;
                            }
                        }
                        break;

                    default:
                        // event inside of bounds: trigger the POINTER_DOWN or WHEEL callback
                        if (eventInBounds) {
                            // trigger the corresponding callback
                            if (triggerEvent(handlers, pointer.type, pointer, pointer.pointerId)) {
                                handled = true;
                                break;
                            }
                        }
                        break;
                }
            }
            if (handled === true) {
                // stop iterating through this list of candidates
                break;
            }
        }
    }
    return handled;
}

/**
 * translate event coordinates
 * @ignore
 */
function normalizeEvent(originalEvent) {
    var pointer;

    // PointerEvent or standard Mouse event
    if (device.TouchEvent && originalEvent.changedTouches) {
        // iOS/Android Touch event
        for (var i = 0, l = originalEvent.changedTouches.length; i < l; i++) {
            var touchEvent = originalEvent.changedTouches[i];
            pointer = T_POINTERS.pop();
            pointer.setEvent(
                originalEvent,
                touchEvent.pageX,
                touchEvent.pageY,
                touchEvent.clientX,
                touchEvent.clientY,
                touchEvent.identifier
            );
            normalizedEvents.push(pointer);
        }
    } else {
        // Mouse or PointerEvent
        pointer = T_POINTERS.pop();
        pointer.setEvent(
            originalEvent,
            originalEvent.pageX,
            originalEvent.pageY,
            originalEvent.clientX,
            originalEvent.clientY,
            originalEvent.pointerId
        );
        normalizedEvents.push(pointer);
    }

    // if event.isPrimary is defined and false, return
    if (originalEvent.isPrimary === false) {
        return normalizedEvents;
    }

    // else use the first entry to simulate mouse event
    normalizedEvents[0].isPrimary = true;
    Object.assign(pointer, normalizedEvents[0]);

    return normalizedEvents;
}

/**
 * mouse/touch/pointer event management (move)
 * @ignore
 */
function onMoveEvent(e) {
    // dispatch mouse event to registered object
    dispatchEvent(normalizeEvent(e));
    // do not prevent default on moveEvent :
}

/**
 * mouse/touch/pointer event management (start/down, end/up)
 * @ignore
 */
function onPointerEvent(e) {
    // normalize eventTypes
    normalizeEvent(e);

    // remember/use the first "primary" normalized event for pointer.bind
    var button = normalizedEvents[0].button;

    // dispatch event to registered objects
    if (dispatchEvent(normalizedEvents) || e.type === "wheel") {
        // always preventDefault for wheel event (?legacy code/behavior?)
        if (preventDefault === true) {
            e.preventDefault();
        }
    }

    var keycode = pointer.bind[button];

    // check if mapped to a key
    if (keycode) {
        triggerKeyEvent(keycode, POINTER_DOWN.includes(e.type), button + 1);
    }
}

/*
 * PUBLIC STUFF
 */

 /**
  * the default target element for pointer events (usually the canvas element in which the game is rendered)
  * @public
  * @type EventTarget
  * @name pointerEventTarget
  * @memberOf me.input
  */
 export var pointerEventTarget = null;

/**
 * Pointer information (current position and size)
 * @public
 * @type {me.Rect}
 * @name pointer
 * @memberOf me.input
 */
export var pointer;

/**
 * time interval for event throttling in milliseconds<br>
 * default value : "1000/me.timer.maxfps" ms<br>
 * set to 0 ms to disable the feature
 * @public
 * @type Number
 * @name throttlingInterval
 * @memberOf me.input
 */
export var throttlingInterval;

/**
 * Translate the specified x and y values from the global (absolute)
 * coordinate to local (viewport) relative coordinate.
 * @name globalToLocal
 * @memberOf me.input
 * @public
 * @function
 * @param {Number} x the global x coordinate to be translated.
 * @param {Number} y the global y coordinate to be translated.
 * @param {Number} [v] an optional vector object where to set the
 * @return {me.Vector2d} A vector object with the corresponding translated coordinates.
 * @example
 * onMouseEvent : function (pointer) {
 *    // convert the given into local (viewport) relative coordinates
 *    var pos = me.input.globalToLocal(pointer.clientX, pointer.clientY);
 *    // do something with pos !
 * };
 */
export function globalToLocal(x, y, v) {
    v = v || new Vector2d();
    var rect = device.getElementBounds(renderer.getScreenCanvas());
    var pixelRatio = device.devicePixelRatio;
    x -= rect.left + (window.pageXOffset || 0);
    y -= rect.top + (window.pageYOffset || 0);
    var scale = scaleRatio;
    if (scale.x !== 1.0 || scale.y !== 1.0) {
        x /= scale.x;
        y /= scale.y;
    }
    return v.set(x * pixelRatio, y * pixelRatio);
};

/**
 * enable/disable all gestures on the given element.<br>
 * by default melonJS will disable browser handling of all panning and zooming gestures.
 * @name setTouchAction
 * @memberOf me.input
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
 * @public
 * @function
 * @param {HTMLCanvasElement} element
 * @param {String} [value="none"]
 */
export function setTouchAction(element, value) {
    element.style["touch-action"] = value || "none";
};

/**
 * Associate a pointer event to a keycode<br>
 * Left button – 0
 * Middle button – 1
 * Right button – 2
 * @name bindPointer
 * @memberOf me.input
 * @public
 * @function
 * @param {Number} [button=me.input.pointer.LEFT] (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
 * @param {me.input.KEY} keyCode
 * @example
 * // enable the keyboard
 * me.input.bindKey(me.input.KEY.X, "shoot");
 * // map the left button click on the X key (default if the button is not specified)
 * me.input.bindPointer(me.input.KEY.X);
 * // map the right button click on the X key
 * me.input.bindPointer(me.input.pointer.RIGHT, me.input.KEY.X);
 */
export function bindPointer() {
    var button = (arguments.length < 2) ? pointer.LEFT : arguments[0];
    var keyCode = (arguments.length < 2) ? arguments[0] : arguments[1];

    // make sure the mouse is initialized
    enablePointerEvent();

    // throw an exception if no action is defined for the specified keycode
    if (!getBindingKey(keyCode)) {
        throw new Error("no action defined for keycode " + keyCode);
    }
    // map the mouse button to the keycode
    pointer.bind[button] = keyCode;
};

/**
 * unbind the defined keycode
 * @name unbindPointer
 * @memberOf me.input
 * @public
 * @function
 * @param {Number} [button=me.input.pointer.LEFT] (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
 * @example
 * me.input.unbindPointer(me.input.pointer.LEFT);
 */
export function unbindPointer(button) {
    // clear the event status
    pointer.bind[
        typeof(button) === "undefined" ?
        pointer.LEFT : button
    ] = null;
};


/**
 * allows registration of event listeners on the object target. <br>
 * melonJS will pass a me.Pointer object to the defined callback.
 * @see me.Pointer
 * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
 * @name registerPointerEvent
 * @memberOf me.input
 * @public
 * @function
 * @param {String} eventType The event type for which the object is registering <br>
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
 * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} region a shape representing the region to register on
 * @param {Function} callback methods to be called when the event occurs.
 * Returning `false` from the defined callback will prevent the event to be propagated to other objects
 * @example
 *  // onActivate function
 *  onActivateEvent: function () {
 *     // register on the 'pointerdown' event
 *     me.input.registerPointerEvent('pointerdown', this, this.pointerDown.bind(this));
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
export function registerPointerEvent(eventType, region, callback) {
    // make sure the mouse/touch events are initialized
    enablePointerEvent();

    if (pointerEventList.indexOf(eventType) === -1) {
        throw new Error("invalid event type : " + eventType);
    }

    if (typeof region === "undefined") {
        throw new Error("registerPointerEvent: region for " + toString(region) + " event is undefined ");
    }

    var eventTypes = findAllActiveEvents(activeEventList, pointerEventMap[eventType]);

    // register the event
    if (!eventHandlers.has(region)) {
        eventHandlers.set(region, {
            region : region,
            callbacks : {},
            pointerId : null
        });
    }

    // allocate array if not defined
    var handlers = eventHandlers.get(region);
    for (var i = 0; i < eventTypes.length; i++) {
        eventType = eventTypes[i];
        if (handlers.callbacks[eventType]) {
            handlers.callbacks[eventType].push(callback);
        } else {
            handlers.callbacks[eventType] = [callback];
        }
    }
};

/**
 * allows the removal of event listeners from the object target.
 * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
 * @name releasePointerEvent
 * @memberOf me.input
 * @public
 * @function
 * @param {String} eventType The event type for which the object was registered. See {@link me.input.registerPointerEvent}
 * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} region the registered region to release for this event
 * @param {Function} [callback="all"] if specified unregister the event only for the specific callback
 * @example
 * // release the registered region on the 'pointerdown' event
 * me.input.releasePointerEvent('pointerdown', this);
 */
export function releasePointerEvent(eventType, region, callback) {
    if (pointerEventList.indexOf(eventType) === -1) {
        throw new Error("invalid event type : " + eventType);
    }

    // convert to supported event type if pointerEvent not natively supported
    var eventTypes = findAllActiveEvents(activeEventList, pointerEventMap[eventType]);

    var handlers = eventHandlers.get(region);
    if (typeof (handlers) !== "undefined") {
        for (var i = 0; i < eventTypes.length; i++) {
            eventType = eventTypes[i];
            if (handlers.callbacks[eventType]) {
                if (typeof (callback) !== "undefined") {
                    arrayUtil.remove(handlers.callbacks[eventType], callback);
                } else {
                    while (handlers.callbacks[eventType].length > 0) {
                        handlers.callbacks[eventType].pop();
                    }
                }
                // free the array if empty
                if (handlers.callbacks[eventType].length === 0) {
                    delete handlers.callbacks[eventType];
                }
            }
        }
        if (Object.keys(handlers.callbacks).length === 0) {
            eventHandlers.delete(region);
        }
    }
};

/**
 * allows the removal of all registered event listeners from the object target.
 * @name releaseAllPointerEvents
 * @memberOf me.input
 * @public
 * @function
 * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} region the registered region to release event from
 * @example
 * // release all registered event on the
 * me.input.releaseAllPointerEvents(this);
 */
export function releaseAllPointerEvents(region) {
    if (eventHandlers.has(region)) {
        for (var i = 0; i < pointerEventList.length; i++) {
            this.releasePointerEvent(pointerEventList[i], region);
        }
    };
};

/**
 * enable pointer event (Pointer/Mouse/Touch)
 *
 * me.video.init()
 * // ...
 * me.input.enablePointerEvents()
 * // ...
 * me.state.change(me.state.MENU)
 *
 */
export function enablePointerEvents() {
    if (!pointerInitialized) {

        // the current pointer area
        currentPointer = new Rect(0, 0, 1, 1);

        pointer = new Pointer(0, 0, 1, 1);

        // instantiate a pool of pointer catched
        for (var v = 0; v < device.maxTouchPoints; v++) {
            T_POINTERS.push(new Pointer());
        }

        if (pointerEventTarget === null) {
            // default pointer event target
            pointerEventTarget = renderer.getScreenCanvas();
        }

        if (device.PointerEvent) {
            // standard Pointer Events
            activeEventList = pointerEventList;
        } else {
            // Regular Mouse events
            activeEventList = mouseEventList;
        }
        if (device.touch && !device.PointerEvent) {
            // touch event on mobile devices
            activeEventList = activeEventList.concat(touchEventList);
        }
        registerEventListener(activeEventList, onPointerEvent);

        // set the PointerMove/touchMove/MouseMove event
        if (typeof(throttlingInterval) === "undefined") {
            // set the default value
            throttlingInterval = ~~(1000 / timer.maxfps);
        }

        if (device.autoFocus === true) {
            device.focus();
            pointerEventTarget.addEventListener(
                activeEventList[2], // MOUSE/POINTER DOWN
                function () {
                    device.focus();
                },
                { passive: (preventDefault === false) }
            );
        }

        // if time interval <= 16, disable the feature
        var i;
        var events = findAllActiveEvents(activeEventList, POINTER_MOVE);
        if (throttlingInterval < 17) {
            for (i = 0; i < events.length; i++) {
                if (activeEventList.indexOf(events[i]) !== -1) {
                    pointerEventTarget.addEventListener(
                        events[i],
                        onMoveEvent,
                        { passive: true } // do not preventDefault on Move events
                    );
                }

            }
        }
        else {
            for (i = 0; i < events.length; i++) {
                if (activeEventList.indexOf(events[i]) !== -1) {
                    pointerEventTarget.addEventListener(
                        events[i],
                        fctUtil.throttle(
                            onMoveEvent,
                            throttlingInterval,
                            false
                        ),
                        { passive: true } // do not preventDefault on Move events
                    );
                }
            }
        }
        // disable all gesture by default
        setTouchAction(pointerEventTarget);

        pointerInitialized = true;
    }
}

/**
 * this is a backwards compatibility definition so any code using enablePointerEvent internally does not break
 *
 * @deprecated
 * @type {enablePointerEvents}
 */
const enablePointerEvent = enablePointerEvents;
