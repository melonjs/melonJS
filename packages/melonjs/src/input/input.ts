/**
 * @namespace input
 */

/**
 * specify if melonJS should prevent all default browser action on registered events.
 * It also covers the keys the UI focus takes while a widget has it, and a
 * {@link UITextButton#bindKey} key.
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
 * events, such as the page scrolling with the arrow keys or Space. This is the
 * global default; {@link input.bindKey}'s `preventDefault` argument overrides
 * it per binding.
 *
 * Pointer listeners read it when they are registered, so call this before
 * creating the {@link Application} for it to apply to the engine's own
 * listeners. {@link input.bindKey} reads it when a key is bound. The keys the
 * UI focus takes while a widget has it, and a {@link UITextButton#bindKey}
 * key with no binding of its own, read it on each press.
 *
 * Leave it on for a game shown in a frame on a page that scrolls, such as a
 * game portal: with it off, those keys scroll the page as well.
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
