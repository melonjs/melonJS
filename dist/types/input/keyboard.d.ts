/**
 * enable keyboard event
 * @ignore
 */
export function initKeyboardEvent(): void;
/**
 * return the key press status of the specified action
 * @name isKeyPressed
 * @memberof input
 * @public
 * @param {string} action - user defined corresponding action
 * @returns {boolean} true if pressed
 * @example
 * if (me.input.isKeyPressed('left')) {
 *    //do something
 * }
 * else if (me.input.isKeyPressed('right')) {
 *    //do something else...
 * }
 */
export function isKeyPressed(action: string): boolean;
/**
 * return the key status of the specified action
 * @name keyStatus
 * @memberof input
 * @public
 * @param {string} action - user defined corresponding action
 * @returns {boolean} down (true) or up(false)
 */
export function keyStatus(action: string): boolean;
/**
 * trigger the specified key (simulated) event <br>
 * @name triggerKeyEvent
 * @memberof input
 * @public
 * @param {number} keycode - (See {@link input.KEY})
 * @param {boolean} [status=false] - true to trigger a key down event, or false for key up event
 * @param {number} [mouseButton] - the mouse button to trigger
 * @example
 * // trigger a key press
 * me.input.triggerKeyEvent(me.input.KEY.LEFT, true);
 */
export function triggerKeyEvent(keycode: number, status?: boolean | undefined, mouseButton?: number | undefined): void;
/**
 * associate a user defined action to a keycode
 * @name bindKey
 * @memberof input
 * @public
 * @param {number} keycode - (See {@link input.KEY})
 * @param {string} action - user defined corresponding action
 * @param {boolean} [lock=false] - cancel the keypress event once read
 * @param {boolean} [preventDefault=input.preventDefault] - prevent default browser action
 * @example
 * // enable the keyboard
 * me.input.bindKey(me.input.KEY.LEFT,  "left");
 * me.input.bindKey(me.input.KEY.RIGHT, "right");
 * me.input.bindKey(me.input.KEY.X,     "jump", true);
 * me.input.bindKey(me.input.KEY.F1,    "options", true, true);
 */
export function bindKey(keycode: number, action: string, lock?: boolean | undefined, preventDefault?: boolean | undefined): void;
/**
 * return the action associated with the given keycode
 * @name getBindingKey
 * @memberof input
 * @public
 * @param {number} keycode - (See {@link input.KEY})
 * @returns {string} user defined associated action
 */
export function getBindingKey(keycode: number): string;
/**
 * unlock a key manually
 * @name unlockKey
 * @memberof input
 * @public
 * @param {string} action - user defined corresponding action
 * @example
 * // Unlock jump when touching the ground
 * if (!this.falling && !this.jumping) {
 *     me.input.unlockKey("jump");
 * }
 */
export function unlockKey(action: string): void;
/**
 * unbind the defined keycode
 * @name unbindKey
 * @memberof input
 * @public
 * @param {number} keycode - (See {@link input.KEY})
 * @example
 * me.input.unbindKey(me.input.KEY.LEFT);
 */
export function unbindKey(keycode: number): void;
/**
 * the default target element for keyboard events (usually the window element in which the game is running)
 * @public
 * @type {EventTarget}
 * @name keyBoardEventTarget
 * @memberof input
 */
export let keyBoardEventTarget: EventTarget;
/**
 * *
 */
export type KEY = number;
export namespace KEY {
    const BACKSPACE: number;
    const TAB: number;
    const ENTER: number;
    const SHIFT: number;
    const CTRL: number;
    const ALT: number;
    const PAUSE: number;
    const CAPS_LOCK: number;
    const ESC: number;
    const SPACE: number;
    const PAGE_UP: number;
    const PAGE_DOWN: number;
    const END: number;
    const HOME: number;
    const LEFT: number;
    const UP: number;
    const RIGHT: number;
    const DOWN: number;
    const PRINT_SCREEN: number;
    const INSERT: number;
    const DELETE: number;
    const NUM0: number;
    const NUM1: number;
    const NUM2: number;
    const NUM3: number;
    const NUM4: number;
    const NUM5: number;
    const NUM6: number;
    const NUM7: number;
    const NUM8: number;
    const NUM9: number;
    const A: number;
    const B: number;
    const C: number;
    const D: number;
    const E: number;
    const F: number;
    const G: number;
    const H: number;
    const I: number;
    const J: number;
    const K: number;
    const L: number;
    const M: number;
    const N: number;
    const O: number;
    const P: number;
    const Q: number;
    const R: number;
    const S: number;
    const T: number;
    const U: number;
    const V: number;
    const W: number;
    const X: number;
    const Y: number;
    const Z: number;
    const WINDOW_KEY: number;
    const NUMPAD0: number;
    const NUMPAD1: number;
    const NUMPAD2: number;
    const NUMPAD3: number;
    const NUMPAD4: number;
    const NUMPAD5: number;
    const NUMPAD6: number;
    const NUMPAD7: number;
    const NUMPAD8: number;
    const NUMPAD9: number;
    const MULTIPLY: number;
    const ADD: number;
    const SUBSTRACT: number;
    const DECIMAL: number;
    const DIVIDE: number;
    const F1: number;
    const F2: number;
    const F3: number;
    const F4: number;
    const F5: number;
    const F6: number;
    const F7: number;
    const F8: number;
    const F9: number;
    const F10: number;
    const F11: number;
    const F12: number;
    const TILDE: number;
    const NUM_LOCK: number;
    const SCROLL_LOCK: number;
    const SEMICOLON: number;
    const PLUS: number;
    const COMMA: number;
    const MINUS: number;
    const PERIOD: number;
    const FORWAND_SLASH: number;
    const GRAVE_ACCENT: number;
    const OPEN_BRACKET: number;
    const BACK_SLASH: number;
    const CLOSE_BRACKET: number;
    const SINGLE_QUOTE: number;
}
