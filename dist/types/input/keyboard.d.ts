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
    let BACKSPACE: number;
    let TAB: number;
    let ENTER: number;
    let SHIFT: number;
    let CTRL: number;
    let ALT: number;
    let PAUSE: number;
    let CAPS_LOCK: number;
    let ESC: number;
    let SPACE: number;
    let PAGE_UP: number;
    let PAGE_DOWN: number;
    let END: number;
    let HOME: number;
    let LEFT: number;
    let UP: number;
    let RIGHT: number;
    let DOWN: number;
    let PRINT_SCREEN: number;
    let INSERT: number;
    let DELETE: number;
    let NUM0: number;
    let NUM1: number;
    let NUM2: number;
    let NUM3: number;
    let NUM4: number;
    let NUM5: number;
    let NUM6: number;
    let NUM7: number;
    let NUM8: number;
    let NUM9: number;
    let A: number;
    let B: number;
    let C: number;
    let D: number;
    let E: number;
    let F: number;
    let G: number;
    let H: number;
    let I: number;
    let J: number;
    let K: number;
    let L: number;
    let M: number;
    let N: number;
    let O: number;
    let P: number;
    let Q: number;
    let R: number;
    let S: number;
    let T: number;
    let U: number;
    let V: number;
    let W: number;
    let X: number;
    let Y: number;
    let Z: number;
    let WINDOW_KEY: number;
    let NUMPAD0: number;
    let NUMPAD1: number;
    let NUMPAD2: number;
    let NUMPAD3: number;
    let NUMPAD4: number;
    let NUMPAD5: number;
    let NUMPAD6: number;
    let NUMPAD7: number;
    let NUMPAD8: number;
    let NUMPAD9: number;
    let MULTIPLY: number;
    let ADD: number;
    let SUBSTRACT: number;
    let DECIMAL: number;
    let DIVIDE: number;
    let F1: number;
    let F2: number;
    let F3: number;
    let F4: number;
    let F5: number;
    let F6: number;
    let F7: number;
    let F8: number;
    let F9: number;
    let F10: number;
    let F11: number;
    let F12: number;
    let TILDE: number;
    let NUM_LOCK: number;
    let SCROLL_LOCK: number;
    let SEMICOLON: number;
    let PLUS: number;
    let COMMA: number;
    let MINUS: number;
    let PERIOD: number;
    let FORWAND_SLASH: number;
    let GRAVE_ACCENT: number;
    let OPEN_BRACKET: number;
    let BACK_SLASH: number;
    let CLOSE_BRACKET: number;
    let SINGLE_QUOTE: number;
}
