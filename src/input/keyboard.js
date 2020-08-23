import {preventDefault as preventDefaultAction} from "./input.js";
import event from "./../system/event.js";
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
    event.publish(event.KEYDOWN, [
        action,
        keyCode,
        action ? !_keyLocked[action] : true
    ]);

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
    event.publish(event.KEYUP, [ action, keyCode ]);

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
  * @type EventTarget
  * @name keyBoardEventTarget
  * @memberOf me.input
  */
 export var keyBoardEventTarget = null;

/**
 * standard keyboard constants
 * @public
 * @enum {number}
 * @namespace KEY
 * @memberOf me.input
 */
export var KEY = {
    /** @memberOf me.input.KEY */
    "BACKSPACE" : 8,
    /** @memberOf me.input.KEY */
    "TAB" : 9,
    /** @memberOf me.input.KEY */
    "ENTER" : 13,
    /** @memberOf me.input.KEY */
    "SHIFT" : 16,
    /** @memberOf me.input.KEY */
    "CTRL" : 17,
    /** @memberOf me.input.KEY */
    "ALT" : 18,
    /** @memberOf me.input.KEY */
    "PAUSE" : 19,
    /** @memberOf me.input.KEY */
    "CAPS_LOCK" : 20,
    /** @memberOf me.input.KEY */
    "ESC" : 27,
    /** @memberOf me.input.KEY */
    "SPACE" : 32,
    /** @memberOf me.input.KEY */
    "PAGE_UP" : 33,
    /** @memberOf me.input.KEY */
    "PAGE_DOWN" : 34,
    /** @memberOf me.input.KEY */
    "END" : 35,
    /** @memberOf me.input.KEY */
    "HOME" : 36,
    /** @memberOf me.input.KEY */
    "LEFT" : 37,
    /** @memberOf me.input.KEY */
    "UP" : 38,
    /** @memberOf me.input.KEY */
    "RIGHT" : 39,
    /** @memberOf me.input.KEY */
    "DOWN" : 40,
    /** @memberOf me.input.KEY */
    "PRINT_SCREEN" : 42,
    /** @memberOf me.input.KEY */
    "INSERT" : 45,
    /** @memberOf me.input.KEY */
    "DELETE" : 46,
    /** @memberOf me.input.KEY */
    "NUM0" : 48,
    /** @memberOf me.input.KEY */
    "NUM1" : 49,
    /** @memberOf me.input.KEY */
    "NUM2" : 50,
    /** @memberOf me.input.KEY */
    "NUM3" : 51,
    /** @memberOf me.input.KEY */
    "NUM4" : 52,
    /** @memberOf me.input.KEY */
    "NUM5" : 53,
    /** @memberOf me.input.KEY */
    "NUM6" : 54,
    /** @memberOf me.input.KEY */
    "NUM7" : 55,
    /** @memberOf me.input.KEY */
    "NUM8" : 56,
    /** @memberOf me.input.KEY */
    "NUM9" : 57,
    /** @memberOf me.input.KEY */
    "A" : 65,
    /** @memberOf me.input.KEY */
    "B" : 66,
    /** @memberOf me.input.KEY */
    "C" : 67,
    /** @memberOf me.input.KEY */
    "D" : 68,
    /** @memberOf me.input.KEY */
    "E" : 69,
    /** @memberOf me.input.KEY */
    "F" : 70,
    /** @memberOf me.input.KEY */
    "G" : 71,
    /** @memberOf me.input.KEY */
    "H" : 72,
    /** @memberOf me.input.KEY */
    "I" : 73,
    /** @memberOf me.input.KEY */
    "J" : 74,
    /** @memberOf me.input.KEY */
    "K" : 75,
    /** @memberOf me.input.KEY */
    "L" : 76,
    /** @memberOf me.input.KEY */
    "M" : 77,
    /** @memberOf me.input.KEY */
    "N" : 78,
    /** @memberOf me.input.KEY */
    "O" : 79,
    /** @memberOf me.input.KEY */
    "P" : 80,
    /** @memberOf me.input.KEY */
    "Q" : 81,
    /** @memberOf me.input.KEY */
    "R" : 82,
    /** @memberOf me.input.KEY */
    "S" : 83,
    /** @memberOf me.input.KEY */
    "T" : 84,
    /** @memberOf me.input.KEY */
    "U" : 85,
    /** @memberOf me.input.KEY */
    "V" : 86,
    /** @memberOf me.input.KEY */
    "W" : 87,
    /** @memberOf me.input.KEY */
    "X" : 88,
    /** @memberOf me.input.KEY */
    "Y" : 89,
    /** @memberOf me.input.KEY */
    "Z" : 90,
    /** @memberOf me.input.KEY */
    "WINDOW_KEY" : 91,
    /** @memberOf me.input.KEY */
    "NUMPAD0" : 96,
    /** @memberOf me.input.KEY */
    "NUMPAD1" : 97,
    /** @memberOf me.input.KEY */
    "NUMPAD2" : 98,
    /** @memberOf me.input.KEY */
    "NUMPAD3" : 99,
    /** @memberOf me.input.KEY */
    "NUMPAD4" : 100,
    /** @memberOf me.input.KEY */
    "NUMPAD5" : 101,
    /** @memberOf me.input.KEY */
    "NUMPAD6" : 102,
    /** @memberOf me.input.KEY */
    "NUMPAD7" : 103,
    /** @memberOf me.input.KEY */
    "NUMPAD8" : 104,
    /** @memberOf me.input.KEY */
    "NUMPAD9" : 105,
    /** @memberOf me.input.KEY */
    "MULTIPLY" : 106,
    /** @memberOf me.input.KEY */
    "ADD" : 107,
    /** @memberOf me.input.KEY */
    "SUBSTRACT" : 109,
    /** @memberOf me.input.KEY */
    "DECIMAL" : 110,
    /** @memberOf me.input.KEY */
    "DIVIDE" : 111,
    /** @memberOf me.input.KEY */
    "F1" : 112,
    /** @memberOf me.input.KEY */
    "F2" : 113,
    /** @memberOf me.input.KEY */
    "F3" : 114,
    /** @memberOf me.input.KEY */
    "F4" : 115,
    /** @memberOf me.input.KEY */
    "F5" : 116,
    /** @memberOf me.input.KEY */
    "F6" : 117,
    /** @memberOf me.input.KEY */
    "F7" : 118,
    /** @memberOf me.input.KEY */
    "F8" : 119,
    /** @memberOf me.input.KEY */
    "F9" : 120,
    /** @memberOf me.input.KEY */
    "F10" : 121,
    /** @memberOf me.input.KEY */
    "F11" : 122,
    /** @memberOf me.input.KEY */
    "F12" : 123,
    /** @memberOf me.input.KEY */
    "TILDE" : 126,
    /** @memberOf me.input.KEY */
    "NUM_LOCK" : 144,
    /** @memberOf me.input.KEY */
    "SCROLL_LOCK" : 145,
    /** @memberOf me.input.KEY */
    "SEMICOLON" : 186,
    /** @memberOf me.input.KEY */
    "PLUS" : 187,
    /** @memberOf me.input.KEY */
    "COMMA" : 188,
    /** @memberOf me.input.KEY */
    "MINUS" : 189,
    /** @memberOf me.input.KEY */
    "PERIOD" : 190,
    /** @memberOf me.input.KEY */
    "FORWAND_SLASH" : 191,
    /** @memberOf me.input.KEY */
    "GRAVE_ACCENT" : 192,
    /** @memberOf me.input.KEY */
    "OPEN_BRACKET" : 219,
    /** @memberOf me.input.KEY */
    "BACK_SLASH" : 220,
    /** @memberOf me.input.KEY */
    "CLOSE_BRACKET" : 221,
    /** @memberOf me.input.KEY */
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
 * @memberOf me.input
 * @public
 * @function
 * @param {String} action user defined corresponding action
 * @return {Boolean} true if pressed
 * @example
 * if (me.input.isKeyPressed('left'))
 * {
 *    //do something
 * }
 * else if (me.input.isKeyPressed('right'))
 * {
 *    //do something else...
 * }
 *
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
 * @memberOf me.input
 * @public
 * @function
 * @param {String} action user defined corresponding action
 * @return {Boolean} down (true) or up(false)
 */
export function keyStatus(action) {
    return (_keyStatus[action] > 0);
};


/**
 * trigger the specified key (simulated) event <br>
 * @name triggerKeyEvent
 * @memberOf me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @param {Boolean} [status=false] true to trigger a key down event, or false for key up event
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
 * @memberOf me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @param {String} action user defined corresponding action
 * @param {Boolean} [lock=false] cancel the keypress event once read
 * @param {Boolean} [preventDefault=me.input.preventDefault] prevent default browser action
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
 * @memberOf me.input
 * @public
 * @function
 * @param {me.input.KEY} keycode
 * @return {String} user defined associated action
 */
export function getBindingKey(keycode) {
    return _keyBindings[keycode];
};

/**
 * unlock a key manually
 * @name unlockKey
 * @memberOf me.input
 * @public
 * @function
 * @param {String} action user defined corresponding action
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
 * @memberOf me.input
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
