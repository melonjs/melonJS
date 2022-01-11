import {preventDefault as preventDefaultAction} from "./input.js";
import * as event from "./../system/event.js";
import device from "./../system/device.js";

// corresponding actions
var _keyStatus = {};

// lock enable flag for keys
var _keyLock = {};
// actual lock status of each key
var _keyLocked = {};

// List of binded keys being held
var _keyRefs = {};

// whether default event should be prevented for a given keypress
var _preventDefaultForKeys = {};

// list of binded keys
var _keyBindings = {};

/**
 * key down event
 * @ignore
 */
var keyDownEvent = function (e, keyCode, mouseButton) {

    keyCode = keyCode || e.keyCode || e.button;
    var action = _keyBindings[keyCode];

    // publish a message for keydown event
    event.emit(event.KEYDOWN,
        action,
        keyCode,
        action ? !_keyLocked[action] : true
    );

    if (action) {
        if (!_keyLocked[action]) {
            var trigger = (typeof mouseButton !== "undefined") ? mouseButton : keyCode;
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
var keyUpEvent = function (e, keyCode, mouseButton) {
    keyCode = keyCode || e.keyCode || e.button;
    var action = _keyBindings[keyCode];

    // publish a message for keydown event
    event.emit(event.KEYUP, action, keyCode);

    if (action) {
        var trigger = (typeof mouseButton !== "undefined") ? mouseButton : keyCode;
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
  * @memberof me.input
  */
 export var keyBoardEventTarget = null;

/**
 * standard keyboard constants
 * @public
 * @enum {number}
 * @namespace KEY
 * @memberof me.input
 */
export var KEY = {
    /** @memberof me.input.KEY */
    "BACKSPACE" : 8,
    /** @memberof me.input.KEY */
    "TAB" : 9,
    /** @memberof me.input.KEY */
    "ENTER" : 13,
    /** @memberof me.input.KEY */
    "SHIFT" : 16,
    /** @memberof me.input.KEY */
    "CTRL" : 17,
    /** @memberof me.input.KEY */
    "ALT" : 18,
    /** @memberof me.input.KEY */
    "PAUSE" : 19,
    /** @memberof me.input.KEY */
    "CAPS_LOCK" : 20,
    /** @memberof me.input.KEY */
    "ESC" : 27,
    /** @memberof me.input.KEY */
    "SPACE" : 32,
    /** @memberof me.input.KEY */
    "PAGE_UP" : 33,
    /** @memberof me.input.KEY */
    "PAGE_DOWN" : 34,
    /** @memberof me.input.KEY */
    "END" : 35,
    /** @memberof me.input.KEY */
    "HOME" : 36,
    /** @memberof me.input.KEY */
    "LEFT" : 37,
    /** @memberof me.input.KEY */
    "UP" : 38,
    /** @memberof me.input.KEY */
    "RIGHT" : 39,
    /** @memberof me.input.KEY */
    "DOWN" : 40,
    /** @memberof me.input.KEY */
    "PRINT_SCREEN" : 42,
    /** @memberof me.input.KEY */
    "INSERT" : 45,
    /** @memberof me.input.KEY */
    "DELETE" : 46,
    /** @memberof me.input.KEY */
    "NUM0" : 48,
    /** @memberof me.input.KEY */
    "NUM1" : 49,
    /** @memberof me.input.KEY */
    "NUM2" : 50,
    /** @memberof me.input.KEY */
    "NUM3" : 51,
    /** @memberof me.input.KEY */
    "NUM4" : 52,
    /** @memberof me.input.KEY */
    "NUM5" : 53,
    /** @memberof me.input.KEY */
    "NUM6" : 54,
    /** @memberof me.input.KEY */
    "NUM7" : 55,
    /** @memberof me.input.KEY */
    "NUM8" : 56,
    /** @memberof me.input.KEY */
    "NUM9" : 57,
    /** @memberof me.input.KEY */
    "A" : 65,
    /** @memberof me.input.KEY */
    "B" : 66,
    /** @memberof me.input.KEY */
    "C" : 67,
    /** @memberof me.input.KEY */
    "D" : 68,
    /** @memberof me.input.KEY */
    "E" : 69,
    /** @memberof me.input.KEY */
    "F" : 70,
    /** @memberof me.input.KEY */
    "G" : 71,
    /** @memberof me.input.KEY */
    "H" : 72,
    /** @memberof me.input.KEY */
    "I" : 73,
    /** @memberof me.input.KEY */
    "J" : 74,
    /** @memberof me.input.KEY */
    "K" : 75,
    /** @memberof me.input.KEY */
    "L" : 76,
    /** @memberof me.input.KEY */
    "M" : 77,
    /** @memberof me.input.KEY */
    "N" : 78,
    /** @memberof me.input.KEY */
    "O" : 79,
    /** @memberof me.input.KEY */
    "P" : 80,
    /** @memberof me.input.KEY */
    "Q" : 81,
    /** @memberof me.input.KEY */
    "R" : 82,
    /** @memberof me.input.KEY */
    "S" : 83,
    /** @memberof me.input.KEY */
    "T" : 84,
    /** @memberof me.input.KEY */
    "U" : 85,
    /** @memberof me.input.KEY */
    "V" : 86,
    /** @memberof me.input.KEY */
    "W" : 87,
    /** @memberof me.input.KEY */
    "X" : 88,
    /** @memberof me.input.KEY */
    "Y" : 89,
    /** @memberof me.input.KEY */
    "Z" : 90,
    /** @memberof me.input.KEY */
    "WINDOW_KEY" : 91,
    /** @memberof me.input.KEY */
    "NUMPAD0" : 96,
    /** @memberof me.input.KEY */
    "NUMPAD1" : 97,
    /** @memberof me.input.KEY */
    "NUMPAD2" : 98,
    /** @memberof me.input.KEY */
    "NUMPAD3" : 99,
    /** @memberof me.input.KEY */
    "NUMPAD4" : 100,
    /** @memberof me.input.KEY */
    "NUMPAD5" : 101,
    /** @memberof me.input.KEY */
    "NUMPAD6" : 102,
    /** @memberof me.input.KEY */
    "NUMPAD7" : 103,
    /** @memberof me.input.KEY */
    "NUMPAD8" : 104,
    /** @memberof me.input.KEY */
    "NUMPAD9" : 105,
    /** @memberof me.input.KEY */
    "MULTIPLY" : 106,
    /** @memberof me.input.KEY */
    "ADD" : 107,
    /** @memberof me.input.KEY */
    "SUBSTRACT" : 109,
    /** @memberof me.input.KEY */
    "DECIMAL" : 110,
    /** @memberof me.input.KEY */
    "DIVIDE" : 111,
    /** @memberof me.input.KEY */
    "F1" : 112,
    /** @memberof me.input.KEY */
    "F2" : 113,
    /** @memberof me.input.KEY */
    "F3" : 114,
    /** @memberof me.input.KEY */
    "F4" : 115,
    /** @memberof me.input.KEY */
    "F5" : 116,
    /** @memberof me.input.KEY */
    "F6" : 117,
    /** @memberof me.input.KEY */
    "F7" : 118,
    /** @memberof me.input.KEY */
    "F8" : 119,
    /** @memberof me.input.KEY */
    "F9" : 120,
    /** @memberof me.input.KEY */
    "F10" : 121,
    /** @memberof me.input.KEY */
    "F11" : 122,
    /** @memberof me.input.KEY */
    "F12" : 123,
    /** @memberof me.input.KEY */
    "TILDE" : 126,
    /** @memberof me.input.KEY */
    "NUM_LOCK" : 144,
    /** @memberof me.input.KEY */
    "SCROLL_LOCK" : 145,
    /** @memberof me.input.KEY */
    "SEMICOLON" : 186,
    /** @memberof me.input.KEY */
    "PLUS" : 187,
    /** @memberof me.input.KEY */
    "COMMA" : 188,
    /** @memberof me.input.KEY */
    "MINUS" : 189,
    /** @memberof me.input.KEY */
    "PERIOD" : 190,
    /** @memberof me.input.KEY */
    "FORWAND_SLASH" : 191,
    /** @memberof me.input.KEY */
    "GRAVE_ACCENT" : 192,
    /** @memberof me.input.KEY */
    "OPEN_BRACKET" : 219,
    /** @memberof me.input.KEY */
    "BACK_SLASH" : 220,
    /** @memberof me.input.KEY */
    "CLOSE_BRACKET" : 221,
    /** @memberof me.input.KEY */
    "SINGLE_QUOTE" : 222
};

/**
 * enable keyboard event
 * @ignore
 */
export function initKeyboardEvent() {
    // make sure the keyboard is enable
    if (keyBoardEventTarget === null && device.isMobile === false) {
        keyBoardEventTarget = window;
        keyBoardEventTarget.addEventListener("keydown", keyDownEvent, false);
        keyBoardEventTarget.addEventListener("keyup", keyUpEvent, false);
    }
};

/**
 * return the key press status of the specified action
 * @name isKeyPressed
 * @memberof me.input
 * @public
 * @function
 * @param {string} action user defined corresponding action
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
};

/**
 * return the key status of the specified action
 * @name keyStatus
 * @memberof me.input
 * @public
 * @function
 * @param {string} action user defined corresponding action
 * @returns {boolean} down (true) or up(false)
 */
export function keyStatus(action) {
    return (_keyStatus[action] > 0);
};


/**
 * trigger the specified key (simulated) event <br>
 * @name triggerKeyEvent
 * @memberof me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @param {boolean} [status=false] true to trigger a key down event, or false for key up event
 * @param {number} [mouseButton] the mouse button to trigger
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
};


/**
 * associate a user defined action to a keycode
 * @name bindKey
 * @memberof me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @param {string} action user defined corresponding action
 * @param {boolean} [lock=false] cancel the keypress event once read
 * @param {boolean} [preventDefault=me.input.preventDefault] prevent default browser action
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
};

/**
 * return the action associated with the given keycode
 * @name getBindingKey
 * @memberof me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @returns {string} user defined associated action
 */
export function getBindingKey(keycode) {
    return _keyBindings[keycode];
};

/**
 * unlock a key manually
 * @name unlockKey
 * @memberof me.input
 * @public
 * @function
 * @param {string} action user defined corresponding action
 * @example
 * // Unlock jump when touching the ground
 * if (!this.falling && !this.jumping) {
 *     me.input.unlockKey("jump");
 * }
 */
export function unlockKey(action) {
    _keyLocked[action] = false;
};

/**
 * unbind the defined keycode
 * @name unbindKey
 * @memberof me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @example
 * me.input.unbindKey(me.input.KEY.LEFT);
 */
export function unbindKey(keycode) {
    // clear the event status
    var keybinding = _keyBindings[keycode];
    _keyStatus[keybinding] = 0;
    _keyLock[keybinding] = false;
    _keyRefs[keybinding] = {};
    // remove the key binding
    _keyBindings[keycode] = null;
    _preventDefaultForKeys[keycode] = null;
};
