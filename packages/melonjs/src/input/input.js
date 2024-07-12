/**
 * @namespace input
 */

/**
 * specify if melonJS should prevent all default browser action on registered events.
 * @public
 * @type {boolean}
 * @default true
 * @name preventDefault
 * @memberof input
 */
export let preventDefault = true;

export * from "./pointerevent.js";
export * from "./keyboard.js";
export * from "./gamepad.js";
