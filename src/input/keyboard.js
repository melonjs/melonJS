import {preventDefault as preventDefaultAction} from "./input.js";
import * as event from "./../system/event.js";
import { isMobile } from "./../system/platform.js";

// corresponding actions
let _keyStatus = {};

// lock enable flag for keys
let _keyLock = {};
// actual lock status of each key
let _keyLocked = {};

// List of binded keys being held
let _keyRefs = {};

// whether default event should be prevented for a given keypress
let _preventDefaultForKeys = {};

// list of binded keys
let _keyBindings = {};

/**
 * key down event
 * @ignore
 */
let keyDownEvent = function (e, keyCode, mouseButton) {

    keyCode = keyCode || e.keyCode || e.button;
    let action = _keyBindings[keyCode];

    // publish a message for keydown event
    event.emit(event.KEYDOWN,
        action,
        keyCode,
        action ? !_keyLocked[action] : true
    );

    if (action) {
        if (!_keyLocked[action]) {
            let trigger = (typeof mouseButton !== "undefined") ? mouseButton : keyCode;
            if (!_keyRefs[action][trigger]) {
                _keyStatus[action]++;
                _keyRefs[action][trigger] = true;
            }
        }
        // prevent event propagation
        if (_preventDefaultForKeys[keyCode] && (typeof e.preventDefault === "function")) {
            // "fake" events generated through triggerKeyEvent do not have a preventDefault fn
            return e.preventDefault();
        }
        else {
            return true;
        }
    }

    return true;
};


/**
 * key up event
 * @ignore
 */
let keyUpEvent = function (e, keyCode, mouseButton) {
    keyCode = keyCode || e.keyCode || e.button;
    let action = _keyBindings[keyCode];

    // publish a message for keydown event
    event.emit(event.KEYUP, action, keyCode);

    if (action) {
        let trigger = (typeof mouseButton !== "undefined") ? mouseButton : keyCode;
        _keyRefs[action][trigger] = undefined;

        if (_keyStatus[action] > 0) {
            _keyStatus[action]--;
        }

        _keyLocked[action] = false;

        // prevent event propagation
        if (_preventDefaultForKeys[keyCode] && (typeof e.preventDefault === "function")) {
            // "fake" events generated through triggerKeyEvent do not have a preventDefault fn
            return e.preventDefault();
        }
        else {
            return true;
        }
    }

    return true;
};

/*
 * PUBLIC STUFF
 */

/**
  * the default target element for keyboard events (usually the window element in which the game is running)
  * @public
  * @type {EventTarget}
  * @name keyBoardEventTarget
  * @memberof input
  */
export let keyBoardEventTarget = null;

/**
 * standard keyboard constants
 * @public
 * @enum {number}
 * @namespace KEY
 * @memberof input
 */
export const KEY = {
    "BACKSPACE" : 8,
    /** @memberof input.KEY */
    "TAB" : 9,
    /** @memberof input.KEY */
    "ENTER" : 13,
    /** @memberof input.KEY */
    "SHIFT" : 16,
    /** @memberof input.KEY */
    "CTRL" : 17,
    /** @memberof input.KEY */
    "ALT" : 18,
    /** @memberof input.KEY */
    "PAUSE" : 19,
    /** @memberof input.KEY */
    "CAPS_LOCK" : 20,
    /** @memberof input.KEY */
    "ESC" : 27,
    /** @memberof input.KEY */
    "SPACE" : 32,
    /** @memberof input.KEY */
    "PAGE_UP" : 33,
    /** @memberof input.KEY */
    "PAGE_DOWN" : 34,
    /** @memberof input.KEY */
    "END" : 35,
    /** @memberof input.KEY */
    "HOME" : 36,
    /** @memberof input.KEY */
    "LEFT" : 37,
    /** @memberof input.KEY */
    "UP" : 38,
    /** @memberof input.KEY */
    "RIGHT" : 39,
    /** @memberof input.KEY */
    "DOWN" : 40,
    /** @memberof input.KEY */
    "PRINT_SCREEN" : 42,
    /** @memberof input.KEY */
    "INSERT" : 45,
    /** @memberof input.KEY */
    "DELETE" : 46,
    /** @memberof input.KEY */
    "NUM0" : 48,
    /** @memberof input.KEY */
    "NUM1" : 49,
    /** @memberof input.KEY */
    "NUM2" : 50,
    /** @memberof input.KEY */
    "NUM3" : 51,
    /** @memberof input.KEY */
    "NUM4" : 52,
    /** @memberof input.KEY */
    "NUM5" : 53,
    /** @memberof input.KEY */
    "NUM6" : 54,
    /** @memberof input.KEY */
    "NUM7" : 55,
    /** @memberof input.KEY */
    "NUM8" : 56,
    /** @memberof input.KEY */
    "NUM9" : 57,
    /** @memberof input.KEY */
    "A" : 65,
    /** @memberof input.KEY */
    "B" : 66,
    /** @memberof input.KEY */
    "C" : 67,
    /** @memberof input.KEY */
    "D" : 68,
    /** @memberof input.KEY */
    "E" : 69,
    /** @memberof input.KEY */
    "F" : 70,
    /** @memberof input.KEY */
    "G" : 71,
    /** @memberof input.KEY */
    "H" : 72,
    /** @memberof input.KEY */
    "I" : 73,
    /** @memberof input.KEY */
    "J" : 74,
    /** @memberof input.KEY */
    "K" : 75,
    /** @memberof input.KEY */
    "L" : 76,
    /** @memberof input.KEY */
    "M" : 77,
    /** @memberof input.KEY */
    "N" : 78,
    /** @memberof input.KEY */
    "O" : 79,
    /** @memberof input.KEY */
    "P" : 80,
    /** @memberof input.KEY */
    "Q" : 81,
    /** @memberof input.KEY */
    "R" : 82,
    /** @memberof input.KEY */
    "S" : 83,
    /** @memberof input.KEY */
    "T" : 84,
    /** @memberof input.KEY */
    "U" : 85,
    /** @memberof input.KEY */
    "V" : 86,
    /** @memberof input.KEY */
    "W" : 87,
    /** @memberof input.KEY */
    "X" : 88,
    /** @memberof input.KEY */
    "Y" : 89,
    /** @memberof input.KEY */
    "Z" : 90,
    /** @memberof input.KEY */
    "WINDOW_KEY" : 91,
    /** @memberof input.KEY */
    "NUMPAD0" : 96,
    /** @memberof input.KEY */
    "NUMPAD1" : 97,
    /** @memberof input.KEY */
    "NUMPAD2" : 98,
    /** @memberof input.KEY */
    "NUMPAD3" : 99,
    /** @memberof input.KEY */
    "NUMPAD4" : 100,
    /** @memberof input.KEY */
    "NUMPAD5" : 101,
    /** @memberof input.KEY */
    "NUMPAD6" : 102,
    /** @memberof input.KEY */
    "NUMPAD7" : 103,
    /** @memberof input.KEY */
    "NUMPAD8" : 104,
    /** @memberof input.KEY */
    "NUMPAD9" : 105,
    /** @memberof input.KEY */
    "MULTIPLY" : 106,
    /** @memberof input.KEY */
    "ADD" : 107,
    /** @memberof input.KEY */
    "SUBSTRACT" : 109,
    /** @memberof input.KEY */
    "DECIMAL" : 110,
    /** @memberof input.KEY */
    "DIVIDE" : 111,
    /** @memberof input.KEY */
    "F1" : 112,
    /** @memberof input.KEY */
    "F2" : 113,
    /** @memberof input.KEY */
    "F3" : 114,
    /** @memberof input.KEY */
    "F4" : 115,
    /** @memberof input.KEY */
    "F5" : 116,
    /** @memberof input.KEY */
    "F6" : 117,
    /** @memberof input.KEY */
    "F7" : 118,
    /** @memberof input.KEY */
    "F8" : 119,
    /** @memberof input.KEY */
    "F9" : 120,
    /** @memberof input.KEY */
    "F10" : 121,
    /** @memberof input.KEY */
    "F11" : 122,
    /** @memberof input.KEY */
    "F12" : 123,
    /** @memberof input.KEY */
    "TILDE" : 126,
    /** @memberof input.KEY */
    "NUM_LOCK" : 144,
    /** @memberof input.KEY */
    "SCROLL_LOCK" : 145,
    /** @memberof input.KEY */
    "SEMICOLON" : 186,
    /** @memberof input.KEY */
    "PLUS" : 187,
    /** @memberof input.KEY */
    "COMMA" : 188,
    /** @memberof input.KEY */
    "MINUS" : 189,
    /** @memberof input.KEY */
    "PERIOD" : 190,
    /** @memberof input.KEY */
    "FORWAND_SLASH" : 191,
    /** @memberof input.KEY */
    "GRAVE_ACCENT" : 192,
    /** @memberof input.KEY */
    "OPEN_BRACKET" : 219,
    /** @memberof input.KEY */
    "BACK_SLASH" : 220,
    /** @memberof input.KEY */
    "CLOSE_BRACKET" : 221,
    /** @memberof input.KEY */
    "SINGLE_QUOTE" : 222
};

/**
 * enable keyboard event
 * @ignore
 */
export function initKeyboardEvent() {
    // make sure the keyboard is enable
    if (keyBoardEventTarget === null && isMobile === false) {
        keyBoardEventTarget = globalThis;
        if (typeof keyBoardEventTarget.addEventListener === "function") {
            keyBoardEventTarget.addEventListener("keydown", keyDownEvent, false);
            keyBoardEventTarget.addEventListener("keyup", keyUpEvent, false);
        }
    }
}

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
export function isKeyPressed(action) {
    if (_keyStatus[action] && !_keyLocked[action]) {
        if (_keyLock[action]) {
            _keyLocked[action] = true;
        }
        return true;
    }
    return false;
}

/**
 * return the key status of the specified action
 * @name keyStatus
 * @memberof input
 * @public
 * @param {string} action - user defined corresponding action
 * @returns {boolean} down (true) or up(false)
 */
export function keyStatus(action) {
    return (_keyStatus[action] > 0);
}


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
export function triggerKeyEvent(keycode, status, mouseButton) {
    if (status === true) {
        keyDownEvent({}, keycode, mouseButton);
    }
    else {
        keyUpEvent({}, keycode, mouseButton);
    }
}


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
export function bindKey(keycode, action, lock, preventDefault = preventDefaultAction) {
    _keyBindings[keycode] = action;
    _preventDefaultForKeys[keycode] = preventDefault;

    _keyStatus[action] = 0;
    _keyLock[action] = lock ? lock : false;
    _keyLocked[action] = false;
    _keyRefs[action] = {};
}

/**
 * return the action associated with the given keycode
 * @name getBindingKey
 * @memberof input
 * @public
 * @param {number} keycode - (See {@link input.KEY})
 * @returns {string} user defined associated action
 */
export function getBindingKey(keycode) {
    return _keyBindings[keycode];
}

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
export function unlockKey(action) {
    _keyLocked[action] = false;
}

/**
 * unbind the defined keycode
 * @name unbindKey
 * @memberof input
 * @public
 * @param {number} keycode - (See {@link input.KEY})
 * @example
 * me.input.unbindKey(me.input.KEY.LEFT);
 */
export function unbindKey(keycode) {
    // clear the event status
    let keybinding = _keyBindings[keycode];
    _keyStatus[keybinding] = 0;
    _keyLock[keybinding] = false;
    _keyRefs[keybinding] = {};
    // remove the key binding
    _keyBindings[keycode] = null;
    _preventDefaultForKeys[keycode] = null;
}
