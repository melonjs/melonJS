/**
 * @namespace input
 */

/**
 * specify if melonJS should prevent all default browser action on registered events.
 *
 * Read-only: this is a module binding, so `input.preventDefault = false` cannot
 * work — assigning to a module namespace property throws. Use
 * {@link input.setPreventDefault} instead.
 * @default true
 * @see input.setPreventDefault
 */
export let preventDefault: boolean = true;

/**
 * set whether melonJS should prevent the default browser action on registered
 * events. This is the global default; {@link input.bindKey}'s `preventDefault`
 * argument overrides it per binding.
 *
 * Pointer listeners read it when they are registered, so call this before
 * creating the {@link Application} for it to apply to the engine's own
 * listeners.
 * @param value - true to prevent default browser actions (the default)
 * @example
 * // let the browser handle scrolling, zooming and context menus itself
 * me.input.setPreventDefault(false);
 */
export function setPreventDefault(value: boolean) {
	preventDefault = value;
}

export * from "./gamepad.ts";
export * from "./key.ts";
export * from "./keyboard.ts";
export * from "./pointerevent.ts";
