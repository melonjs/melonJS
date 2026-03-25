/**
 * @namespace input
 */

/**
 * specify if melonJS should prevent all default browser action on registered events.
 * @default true
 */
// eslint-disable-next-line prefer-const
export let preventDefault: boolean = true;

export * from "./gamepad.ts";
export * from "./key.ts";
export * from "./keyboard.ts";
export * from "./pointerevent.ts";
