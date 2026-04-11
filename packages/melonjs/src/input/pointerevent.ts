import type Application from "../application/application.ts";
import { Rect } from "./../geometries/rectangle.ts";
import type { Vector2d } from "../math/vector2d.ts";
import { vector2dPool } from "../math/vector2d.ts";
import * as device from "./../system/device.js";
import {
	emit,
	GAME_INIT,
	on,
	POINTERLOCKCHANGE,
	POINTERMOVE,
} from "../system/event.ts";
import timer from "./../system/timer.ts";
import { remove } from "./../utils/array.ts";
import { throttle } from "./../utils/function.ts";
import { preventDefault } from "./input.ts";
import { getBindingKey, triggerKeyEvent } from "./keyboard.ts";
import Pointer from "./pointer.ts";

interface PointerHandler {
	region: any;
	callbacks: Record<string, Array<(pointer: Pointer) => boolean | void>>;
	pointerId: number | null;
}

/**
 * A pool of `Pointer` objects to cache pointer/touch event coordinates.
 * @ignore
 */
const T_POINTERS: Pointer[] = [];

// list of registered Event handlers
const eventHandlers: Map<any, PointerHandler> = new Map();

// a cache rect represeting the current pointer area
let currentPointer: Rect;

/**
 * reference to the active application instance
 * @ignore
 */
export let _app: Application | undefined;
on(GAME_INIT, (app: Application) => {
	_app = app;
});

// some useful flags
let pointerInitialized = false;

// Track last event timestamp to prevent firing events out of order
let lastTimeStamp = 0;

// "active" list of supported events
let activeEventList: string[] = [];

// internal constants
const WHEEL = ["wheel"];
const POINTER_MOVE = ["pointermove", "mousemove", "touchmove"];
const POINTER_DOWN = ["pointerdown", "mousedown", "touchstart"];
const POINTER_UP = ["pointerup", "mouseup", "touchend"];
const POINTER_CANCEL = ["pointercancel", "mousecancel", "touchcancel"];
const POINTER_ENTER = ["pointerenter", "mouseenter", "touchenter"];
const POINTER_OVER = ["pointerover", "mouseover", "touchover"];
const POINTER_LEAVE = ["pointerleave", "mouseleave", "touchleave"];

// list of standard pointer event type
const pointerEventList: string[] = [
	WHEEL[0],
	POINTER_MOVE[0],
	POINTER_DOWN[0],
	POINTER_UP[0],
	POINTER_CANCEL[0],
	POINTER_ENTER[0],
	POINTER_OVER[0],
	POINTER_LEAVE[0],
];

// legacy mouse event type
const mouseEventList: string[] = [
	WHEEL[0],
	POINTER_MOVE[1],
	POINTER_DOWN[1],
	POINTER_UP[1],
	POINTER_CANCEL[1],
	POINTER_ENTER[1],
	POINTER_OVER[1],
	POINTER_LEAVE[1],
];

// iOS style touch event type
const touchEventList: string[] = [
	POINTER_MOVE[2],
	POINTER_DOWN[2],
	POINTER_UP[2],
	POINTER_CANCEL[2],
	POINTER_ENTER[2],
	POINTER_OVER[2],
	POINTER_LEAVE[2],
];

const pointerEventMap: Record<string, string[]> = {
	wheel: WHEEL,
	pointermove: POINTER_MOVE,
	pointerdown: POINTER_DOWN,
	pointerup: POINTER_UP,
	pointercancel: POINTER_CANCEL,
	pointerenter: POINTER_ENTER,
	pointerover: POINTER_OVER,
	pointerleave: POINTER_LEAVE,
};

/**
 * Array of normalized events (mouse, touch, pointer)
 * @ignore
 */
const normalizedEvents: Pointer[] = [];

/**
 * addEventListerner for the specified event list and callback
 * @ignore
 */
function registerEventListener(
	eventList: string[],
	callback: EventListenerOrEventListenerObject,
): void {
	for (let x = 0; x < eventList.length; x++) {
		if (POINTER_MOVE.indexOf(eventList[x]) === -1) {
			pointerEventTarget!.addEventListener(eventList[x], callback, {
				passive: !preventDefault,
			});
		}
	}
}

/**
 * enable pointer event (Pointer/Mouse/Touch)
 * @ignore
 */
function enablePointerEvent(): void {
	if (!pointerInitialized) {
		if (!_app) {
			throw new Error("Pointer events require an initialized Application");
		}
		// the current pointer area
		currentPointer = new Rect(0, 0, 1, 1);

		// instantiate a pool of pointer catched
		for (let v = 0; v < device.maxTouchPoints; v++) {
			T_POINTERS.push(new Pointer());
		}

		if (pointerEventTarget === null || pointerEventTarget === undefined) {
			// default pointer event target
			pointerEventTarget = _app.renderer.getCanvas();
		}

		if (device.pointerEvent) {
			// standard Pointer Events
			activeEventList = pointerEventList;
		} else {
			// Regular Mouse events
			activeEventList = mouseEventList;
		}
		if (device.touch && !device.pointerEvent) {
			// touch event on mobile devices
			activeEventList = activeEventList.concat(touchEventList);
		}
		registerEventListener(activeEventList, onPointerEvent);

		// set the PointerMove/touchMove/MouseMove event
		if (typeof throttlingInterval === "undefined") {
			// set the default value
			throttlingInterval = ~~(1000 / timer.maxfps);
		}

		if (device.autoFocus) {
			device.focus();
			pointerEventTarget.addEventListener(
				activeEventList[2], // MOUSE/POINTER DOWN
				() => {
					device.focus();
				},
				{ passive: !preventDefault },
			);
		}

		// if time interval <= 16, disable the feature
		const events = findAllActiveEvents(activeEventList, POINTER_MOVE);
		if (throttlingInterval < 17) {
			for (let i = 0; i < events.length; i++) {
				if (activeEventList.indexOf(events[i]) !== -1) {
					pointerEventTarget.addEventListener(
						events[i],
						onMoveEvent as EventListener,
						{ passive: true }, // do not preventDefault on Move events
					);
				}
			}
		} else {
			for (let i = 0; i < events.length; i++) {
				if (activeEventList.indexOf(events[i]) !== -1) {
					pointerEventTarget.addEventListener(
						events[i],
						throttle(
							onMoveEvent as unknown as () => void,
							throttlingInterval,
						) as EventListener,
						{ passive: true }, // do not preventDefault on Move events
					);
				}
			}
		}
		// disable all gesture by default
		setTouchAction(pointerEventTarget as HTMLCanvasElement);

		// set a on change listener on pointerlock if supported
		if (device.hasPointerLockSupport) {
			globalThis.document.addEventListener(
				POINTERLOCKCHANGE,
				() => {
					// change the locked status accordingly
					locked =
						globalThis.document.pointerLockElement === _app.getParentElement();
					// emit the corresponding internal event
					emit(POINTERLOCKCHANGE, locked);
				},
				true,
			);
		}

		// all done !
		pointerInitialized = true;
	}
}

/**
 * @ignore
 */
function findActiveEvent(
	activeEventList: string[],
	eventTypes: string[],
): string | undefined {
	for (let i = 0; i < eventTypes.length; i++) {
		const event = activeEventList.indexOf(eventTypes[i]);
		if (event !== -1) {
			return eventTypes[i];
		}
	}
}

/**
 * @ignore
 */
function findAllActiveEvents(
	activeEventList: string[],
	eventTypes: string[],
): string[] {
	const events: string[] = [];
	for (let i = 0; i < eventTypes.length; i++) {
		const event = activeEventList.indexOf(eventTypes[i]);
		if (event !== -1) {
			events.push(eventTypes[i]);
		}
	}

	return events;
}

/**
 * @ignore
 */
function triggerEvent(
	handlers: PointerHandler,
	type: string | undefined,
	pointer: Pointer,
	pointerId: number | null,
): boolean {
	let callback;
	if (type && handlers.callbacks[type]) {
		handlers.pointerId = pointerId;
		for (
			let i = handlers.callbacks[type].length - 1;
			i >= 0 && (callback = handlers.callbacks[type][i]);
			i--
		) {
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
function dispatchEvent(normalizedEvents: Pointer[]): boolean {
	let handled = false;

	while (normalizedEvents.length > 0) {
		// keep a reference to the last item
		const pointer = normalizedEvents.pop()!;
		// and put it back into our cache
		T_POINTERS.push(pointer);

		// Do not fire older touch events (not required for PointerEvent type)
		if (
			pointer.isNormalized &&
			typeof pointer.event!.timeStamp !== "undefined"
		) {
			if (pointer.event!.timeStamp < lastTimeStamp) {
				continue;
			}
			lastTimeStamp = pointer.event!.timeStamp;
		}

		currentPointer.pos.set(pointer.gameWorldX, pointer.gameWorldY);
		currentPointer.setSize(pointer.width, pointer.height);

		// trigger a global event for pointer move
		if (POINTER_MOVE.includes(pointer.type)) {
			pointer.gameX = pointer.gameLocalX = pointer.gameScreenX;
			pointer.gameY = pointer.gameLocalY = pointer.gameScreenY;
			emit(POINTERMOVE, pointer);
		}

		// fetch valid candiates from the game world container
		let candidates = _app.world.broadphase.retrieve(
			currentPointer,
			(a: any, b: any) => _app.world._sortReverseZ(a, b),
			undefined,
		);

		// add the main game viewport to the list of candidates
		candidates = candidates.concat([_app.viewport]);

		for (
			let c = candidates.length, candidate;
			c--, (candidate = candidates[c]);
		) {
			if (
				eventHandlers.has(candidate) &&
				(candidate as any).isKinematic !== true
			) {
				const handlers = eventHandlers.get(candidate)!;
				const region = handlers.region;
				const ancestor = region.ancestor;
				const bounds = region.getBounds();

				if (region.isFloating === true) {
					pointer.gameX = pointer.gameLocalX = pointer.gameScreenX;
					pointer.gameY = pointer.gameLocalY = pointer.gameScreenY;
				} else {
					pointer.gameX = pointer.gameLocalX = pointer.gameWorldX;
					pointer.gameY = pointer.gameLocalY = pointer.gameWorldY;
				}

				// adjust gameLocalX to specify coordinates
				// within the region ancestor container
				if (typeof ancestor !== "undefined") {
					const parentBounds = ancestor.getBounds();
					pointer.gameLocalX = pointer.gameX - parentBounds.x;
					pointer.gameLocalY = pointer.gameY - parentBounds.y;
				}

				const eventInBounds = bounds.contains(pointer.gameX, pointer.gameY);

				switch (pointer.type) {
					case POINTER_MOVE[0]:
					case POINTER_MOVE[1]:
					case POINTER_MOVE[2]:
					case POINTER_MOVE[3]:
						// moved out of bounds: trigger the POINTER_LEAVE callbacks
						if (handlers.pointerId === pointer.pointerId && !eventInBounds) {
							if (
								triggerEvent(
									handlers,
									findActiveEvent(activeEventList, POINTER_LEAVE),
									pointer,
									null,
								)
							) {
								handled = true;
								break;
							}
						}
						// no pointer & moved inside of bounds: trigger the POINTER_ENTER callbacks
						else if (handlers.pointerId === null && eventInBounds) {
							if (
								triggerEvent(
									handlers,
									findActiveEvent(activeEventList, POINTER_ENTER),
									pointer,
									pointer.pointerId!,
								)
							) {
								handled = true;
								break;
							}
						}

						// trigger the POINTER_MOVE callbacks
						if (
							eventInBounds &&
							triggerEvent(handlers, pointer.type, pointer, pointer.pointerId!)
						) {
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
							if (
								triggerEvent(
									handlers,
									pointer.type,
									pointer,
									pointer.pointerId!,
								)
							) {
								handled = true;
								break;
							}
						}
						break;
				}
			}
			if (handled) {
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
function normalizeEvent(originalEvent: any): Pointer[] {
	let _pointer: Pointer;

	// PointerEvent or standard Mouse event
	if (device.touchEvent && originalEvent.changedTouches) {
		// iOS/Android Touch event
		for (let i = 0, l = originalEvent.changedTouches.length; i < l; i++) {
			const touchEvent = originalEvent.changedTouches[i];
			_pointer = T_POINTERS.pop()!;
			_pointer.setEvent(
				originalEvent,
				touchEvent.pageX,
				touchEvent.pageY,
				touchEvent.clientX,
				touchEvent.clientY,
				touchEvent.identifier,
			);
			normalizedEvents.push(_pointer);
		}
	} else {
		// Mouse or PointerEvent
		_pointer = T_POINTERS.pop()!;
		_pointer.setEvent(
			originalEvent,
			originalEvent.pageX,
			originalEvent.pageY,
			originalEvent.clientX,
			originalEvent.clientY,
			originalEvent.pointerId,
		);
		normalizedEvents.push(_pointer);
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
function onMoveEvent(e: Event): void {
	// dispatch mouse event to registered object
	dispatchEvent(normalizeEvent(e));
	// do not prevent default on moveEvent :
}

/**
 * mouse/touch/pointer event management (start/down, end/up)
 * @ignore
 */
function onPointerEvent(e: Event): void {
	// normalize eventTypes
	normalizeEvent(e);

	// remember/use the first "primary" normalized event for pointer.bind
	const button = normalizedEvents[0].button;

	// dispatch event to registered objects
	if (dispatchEvent(normalizedEvents) || e.type === "wheel") {
		// always preventDefault for wheel event (?legacy code/behavior?)
		if (preventDefault) {
			e.preventDefault();
		}
	}

	const keycode = pointer.bind[button];

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
 */
export let pointerEventTarget: EventTarget | null = null;

/**
 * Pointer information (current position and size)
 */
export const pointer: Pointer = new Pointer(0, 0, 1, 1);

/**
 * indicates if the pointer is currently locked
 */
export let locked: boolean = false;

/**
 * time interval for event throttling in milliseconds<br>
 * default value : "1000/me.timer.maxfps" ms<br>
 * set to 0 ms to disable the feature
 */
export let throttlingInterval: number | undefined;

/**
 * return true if there are pending pointer events in the queue
 * @returns true if there are pending events
 */
export function hasActiveEvents(): boolean {
	return normalizedEvents.length > 0;
}

/**
 * return true if there are register pointer events
 * @see {@link registerPointerEvent}
 * @returns true if there are pending events
 */
export function hasRegisteredEvents(): boolean {
	return eventHandlers.size > 0;
}

/**
 * Translate the specified x and y values from the global (absolute)
 * coordinate to local (viewport) relative coordinate.
 * @param x - the global x coordinate to be translated.
 * @param y - the global y coordinate to be translated.
 * @param v - an optional vector object where to set the translated coordinates
 * @returns A vector object with the corresponding translated coordinates
 * @example
 * onMouseEvent : function (pointer) {
 *    // convert the given into local (viewport) relative coordinates
 *    let pos = me.input.globalToLocal(pointer.clientX, pointer.clientY);
 *    // do something with pos !
 * };
 */
export function globalToLocal(x: number, y: number, v?: Vector2d): Vector2d {
	v = v || vector2dPool.get();
	const rect = device.getElementBounds(_app.renderer.getCanvas());
	const pixelRatio = globalThis.devicePixelRatio || 1;
	x -= rect.left + (globalThis.pageXOffset || 0);
	y -= rect.top + (globalThis.pageYOffset || 0);
	const scale = _app.renderer.scaleRatio;
	if (scale.x !== 1.0 || scale.y !== 1.0) {
		x /= scale.x;
		y /= scale.y;
	}
	return v.set(x * pixelRatio, y * pixelRatio);
}

/**
 * enable/disable all gestures on the given element.<br>
 * by default melonJS will disable browser handling of all panning and zooming gestures.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action}
 * @param element - the HTML element to configure
 * @param value - the touch-action CSS value
 */
export function setTouchAction(
	element: HTMLCanvasElement,
	value?: string,
): void {
	element.style["touch-action" as any] = value || "none";
}

/**
 * Associate a pointer event to a keycode<br>
 * Left button -- 0
 * Middle button -- 1
 * Right button -- 2
 * @param args - button and/or keyCode
 * @example
 * // enable the keyboard
 * me.input.bindKey(me.input.KEY.X, "shoot");
 * // map the left button click on the X key (default if the button is not specified)
 * me.input.bindPointer(me.input.KEY.X);
 * // map the right button click on the X key
 * me.input.bindPointer(me.input.pointer.RIGHT, me.input.KEY.X);
 */
export function bindPointer(...args: number[]): void {
	const button = args.length < 2 ? pointer.LEFT : args[0];
	const keyCode = args.length < 2 ? args[0] : args[1];

	// make sure the mouse is initialized
	enablePointerEvent();

	// throw an exception if no action is defined for the specified keycode
	if (!getBindingKey(keyCode)) {
		throw new Error(`no action defined for keycode ${keyCode}`);
	}
	// map the mouse button to the keycode
	pointer.bind[button] = keyCode;
}

/**
 * unbind the defined keycode
 * @param button - (accordingly to W3C values : 0,1,2 for left, middle and right buttons)
 * @example
 * me.input.unbindPointer(me.input.pointer.LEFT);
 */
export function unbindPointer(button?: number): void {
	// clear the event status
	pointer.bind[typeof button === "undefined" ? pointer.LEFT : button] = null;
}

/**
 * allows registration of event listeners on the object target. <br>
 * melonJS will pass a me.Pointer object to the defined callback.
 * @see Pointer
 * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events | W3C Pointer Event list}
 * @param eventType - The event type for which the object is registering <br>
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
 * @param region - a shape representing the region to register on
 * @param callback - methods to be called when the event occurs.
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
export function registerPointerEvent(
	eventType: string,
	region: any,
	callback: (pointer: Pointer) => boolean | void,
): void {
	// make sure the mouse/touch events are initialized
	enablePointerEvent();

	if (pointerEventList.indexOf(eventType) === -1) {
		throw new Error(`invalid event type : ${eventType}`);
	}

	if (typeof region === "undefined") {
		throw new Error(
			`registerPointerEvent: region for ${String(region)} event is undefined `,
		);
	}

	const eventTypes = findAllActiveEvents(
		activeEventList,
		pointerEventMap[eventType],
	);

	// register the event
	if (!eventHandlers.has(region)) {
		eventHandlers.set(region, {
			region: region,
			callbacks: {},
			pointerId: null,
		});
	}

	// allocate array if not defined
	const handlers = eventHandlers.get(region)!;
	for (let i = 0; i < eventTypes.length; i++) {
		const eventType = eventTypes[i];
		if (handlers.callbacks[eventType]) {
			handlers.callbacks[eventType].push(callback);
		} else {
			handlers.callbacks[eventType] = [callback];
		}
	}
}

/**
 * allows the removal of event listeners from the object target.
 * @see {@link http://www.w3.org/TR/pointerevents/#list-of-pointer-events|W3C Pointer Event list}
 * @param eventType - The event type for which the object was registered. See {@link input.registerPointerEvent}
 * @param region - the registered region to release for this event
 * @param callback - if specified unregister the event only for the specific callback
 * @example
 * // release the registered region on the 'pointerdown' event
 * me.input.releasePointerEvent('pointerdown', this);
 */
export function releasePointerEvent(
	eventType: string,
	region: any,
	callback?: (pointer: Pointer) => boolean | void,
): void {
	if (pointerEventList.indexOf(eventType) === -1) {
		throw new Error(`invalid event type : ${eventType}`);
	}

	// convert to supported event type if pointerEvent not natively supported
	const eventTypes = findAllActiveEvents(
		activeEventList,
		pointerEventMap[eventType],
	);

	const handlers = eventHandlers.get(region);
	if (typeof handlers !== "undefined") {
		for (let i = 0; i < eventTypes.length; i++) {
			const eventType = eventTypes[i];
			if (handlers.callbacks[eventType]) {
				if (typeof callback !== "undefined") {
					remove(handlers.callbacks[eventType], callback);
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
}

/**
 * allows the removal of all registered event listeners from the object target.
 * @param region - the registered region to release event from
 * @example
 * // release all registered event on the
 * me.input.releaseAllPointerEvents(this);
 */
export function releaseAllPointerEvents(region: any): void {
	if (eventHandlers.has(region)) {
		for (let i = 0; i < pointerEventList.length; i++) {
			releasePointerEvent(pointerEventList[i], region);
		}
	}
}

/**
 * request for the pointer to be locked on the parent DOM element.
 * (Must be called in a click event or an event that requires user interaction)
 * @returns return true if the request was successfully submitted
 * @example
 * // register on the pointer lock change event
 * event.on(event.POINTERLOCKCHANGE, (locked)=> {
 *     console.log("pointer lock: " + locked);
 * });
 * // request for pointer lock
 * me.input.requestPointerLock();
 */
export function requestPointerLock(): boolean {
	if (device.hasPointerLockSupport) {
		const element = _app.getParentElement();
		void element.requestPointerLock();
		return true;
	}
	return false;
}

/**
 * Initiates an exit from pointer lock state
 * @returns return true if the request was successfully submitted
 */
export function exitPointerLock(): boolean {
	if (device.hasPointerLockSupport) {
		globalThis.document.exitPointerLock();
		return true;
	}
	return false;
}
