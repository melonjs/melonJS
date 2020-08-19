/**
 * @namespace me.input
 * @memberOf me
 */

/**
 * specify if melonJS should prevent all default browser action on registered events.
 * @public
 * @type Boolean
 * @default true
 * @name preventDefault
 * @memberOf me.input
 */
export var preventDefault = true;

export * from "./pointerevent.js";
export * from "./keyboard.js";
export * from "./gamepad.js";
