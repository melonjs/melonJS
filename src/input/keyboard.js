/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014, Olivier Biot, Jason Oster
 * http://www.melonjs.org/
 *
 */
(function () {
    /*
     * PRIVATE STUFF
     */

    // Reference to base class
    var obj = me.input;

    // list of binded keys
    obj._KeyBinding = {};

    // corresponding actions
    var keyStatus = {};

    // lock enable flag for keys
    var keyLock = {};
    // actual lock status of each key
    var keyLocked = {};

    // List of binded keys being held
    var keyRefs = {};

    // whether default event should be prevented for a given keypress
    var preventDefaultForKeys = {};

    // some useful flags
    var keyboardInitialized = false;

    /**
     * enable keyboard event
     * @ignore
     */
    obj._enableKeyboardEvent = function () {
        if (!keyboardInitialized) {
            window.addEventListener("keydown", obj._keydown, false);
            window.addEventListener("keyup", obj._keyup, false);
            keyboardInitialized = true;
        }
    };

    /**
     * key down event
     * @ignore
     */
    obj._keydown = function (e, keyCode, mouseButton) {

        keyCode = keyCode || e.keyCode || e.which;
        var action = obj._KeyBinding[keyCode];

        // publish a message for keydown event
        me.event.publish(me.event.KEYDOWN, [
            action,
            keyCode,
            action ? !keyLocked[action] : true
        ]);

        if (action) {
            if (!keyLocked[action]) {
                var trigger = mouseButton ? mouseButton : keyCode;
                if (!keyRefs[action][trigger]) {
                    keyStatus[action]++;
                    keyRefs[action][trigger] = true;
                }
            }
            // prevent event propagation
            if (preventDefaultForKeys[keyCode]) {
                return obj._preventDefault(e);
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
    obj._keyup = function (e, keyCode, mouseButton) {
        keyCode = keyCode || e.keyCode || e.which;
        var action = obj._KeyBinding[keyCode];

        // publish a message for keydown event
        me.event.publish(me.event.KEYUP, [ action, keyCode ]);

        if (action) {
            var trigger = mouseButton ? mouseButton : keyCode;
            keyRefs[action][trigger] = undefined;

            if (keyStatus[action] > 0) {
                keyStatus[action]--;
            }

            keyLocked[action] = false;

            // prevent event propagation
            if (preventDefaultForKeys[keyCode]) {
                return obj._preventDefault(e);
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
     * Almost all keyboard keys that have ASCII code, like:
     * LEFT, UP, RIGHT, DOWN, ENTER, SHIFT, CTRL, ALT, ESC, SPACE, TAB, BACKSPACE, PAUSE,
     * PAGE_UP, PAGE_DOWN, INSERT, DELETE, CAPS_LOCK, NUM_LOCK, SCROLL_LOCK, PRINT_SCREEN,
     * Keys [0..9], [A..Z], [NUMPAD0..NUMPAD9], [F1..F12]
     * @public
     * @enum {number}
     * @name KEY
     * @memberOf me.input
     */
    obj.KEY = {
        "BACKSPACE" : 8,
        "TAB" : 9,
        "ENTER" : 13,
        "SHIFT" : 16,
        "CTRL" : 17,
        "ALT" : 18,
        "PAUSE" : 19,
        "CAPS_LOCK" : 20,
        "ESC" : 27,
        "SPACE" : 32,
        "PAGE_UP" : 33,
        "PAGE_DOWN" : 34,
        "END" : 35,
        "HOME" : 36,
        "LEFT" : 37,
        "UP" : 38,
        "RIGHT" : 39,
        "DOWN" : 40,
        "PRINT_SCREEN" : 42,
        "INSERT" : 45,
        "DELETE" : 46,
        "NUM0" : 48,
        "NUM1" : 49,
        "NUM2" : 50,
        "NUM3" : 51,
        "NUM4" : 52,
        "NUM5" : 53,
        "NUM6" : 54,
        "NUM7" : 55,
        "NUM8" : 56,
        "NUM9" : 57,
        "A" : 65,
        "B" : 66,
        "C" : 67,
        "D" : 68,
        "E" : 69,
        "F" : 70,
        "G" : 71,
        "H" : 72,
        "I" : 73,
        "J" : 74,
        "K" : 75,
        "L" : 76,
        "M" : 77,
        "N" : 78,
        "O" : 79,
        "P" : 80,
        "Q" : 81,
        "R" : 82,
        "S" : 83,
        "T" : 84,
        "U" : 85,
        "V" : 86,
        "W" : 87,
        "X" : 88,
        "Y" : 89,
        "Z" : 90,
        "WINDOW_KEY" : 91,
        "NUMPAD0" : 96,
        "NUMPAD1" : 97,
        "NUMPAD2" : 98,
        "NUMPAD3" : 99,
        "NUMPAD4" : 100,
        "NUMPAD5" : 101,
        "NUMPAD6" : 102,
        "NUMPAD7" : 103,
        "NUMPAD8" : 104,
        "NUMPAD9" : 105,
        "MULTIPLY" : 106,
        "ADD" : 107,
        "SUBSTRACT" : 109,
        "DECIMAL" : 110,
        "DIVIDE" : 111,
        "F1" : 112,
        "F2" : 113,
        "F3" : 114,
        "F4" : 115,
        "F5" : 116,
        "F6" : 117,
        "F7" : 118,
        "F8" : 119,
        "F9" : 120,
        "F10" : 121,
        "F11" : 122,
        "F12" : 123,
        "NUM_LOCK" : 144,
        "SCROLL_LOCK" : 145,
        "SEMICOLON" : 186,
        "PLUS" : 187,
        "COMMA" : 188,
        "MINUS" : 189,
        "PERIOD" : 190,
        "FORWAND_SLASH" : 191,
        "GRAVE_ACCENT" : 192,
        "OPEN_BRACKET" : 219,
        "BACK_SLASH" : 220,
        "CLOSE_BRACKET" : 221,
        "SINGLE_QUOTE" : 222
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
    obj.isKeyPressed = function (action) {
        if (keyStatus[action] && !keyLocked[action]) {
            if (keyLock[action]) {
                keyLocked[action] = true;
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
    obj.keyStatus = function (action) {
        return (keyStatus[action] > 0);
    };


    /**
     * trigger the specified key (simulated) event <br>
     * @name triggerKeyEvent
     * @memberOf me.input
     * @public
     * @function
     * @param {me.input#KEY} keycode
     * @param {Boolean} true to trigger a key press, or false for key release
     * @example
     * // trigger a key press
     * me.input.triggerKeyEvent(me.input.KEY.LEFT, true);
     */

    obj.triggerKeyEvent = function (keycode, status) {
        if (status) {
            obj._keydown({}, keycode);
        }
        else {
            obj._keyup({}, keycode);
        }
    };


    /**
     * associate a user defined action to a keycode
     * @name bindKey
     * @memberOf me.input
     * @public
     * @function
     * @param {me.input#KEY} keycode
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
    obj.bindKey = function (keycode, action, lock, preventDefault) {
        // make sure the keyboard is enable
        obj._enableKeyboardEvent();

        if (typeof preventDefault !== "boolean") {
            preventDefault = obj.preventDefault;
        }

        obj._KeyBinding[keycode] = action;
        preventDefaultForKeys[keycode] = preventDefault;

        keyStatus[action] = 0;
        keyLock[action] = lock ? lock : false;
        keyLocked[action] = false;
        keyRefs[action] = {};
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
     * me.input.unlockKey("jump");
     * }
     */
    obj.unlockKey = function (action) {
        keyLocked[action] = false;
    };

    /**
     * unbind the defined keycode
     * @name unbindKey
     * @memberOf me.input
     * @public
     * @function
     * @param {me.input#KEY} keycode
     * @example
     * me.input.unbindKey(me.input.KEY.LEFT);
     */
    obj.unbindKey = function (keycode) {
        // clear the event status
        var keybinding = obj._KeyBinding[keycode];
        keyStatus[keybinding] = 0;
        keyLock[keybinding] = false;
        keyRefs[keybinding] = {};
        // remove the key binding
        obj._KeyBinding[keycode] = null;
        preventDefaultForKeys[keycode] = null;
    };
})();
