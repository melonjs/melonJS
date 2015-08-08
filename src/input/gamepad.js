/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org/
 *
 */
(function () {
    /*
     * PRIVATE STUFF
     */

    // Reference to base class
    var api = me.input;

    var bindings = {};

    var remap = new Map([
        // Firefox mappings
        [
            "45e-28e-Xbox 360 Wired Controller",
            {
                "axes" : [ 0, 1, 4, 2, 3, 5 ],
                "buttons" : [ 12, 13, 14, 15, 9, 8, 10, 11, 4, 5, 16, 0, 1, 3, 4 ]
            }
        ],
        [
            "54c-268-PLAYSTATION(R)3 Controller",
            {
                "axes" : [ 0, 1, 2, 3, 4, 5 ],
                "buttons" : [ 8, 10, 11, 9, 12, 15, 13, 14, 6, 7, 4, 5, 3, 1, 0, 2, 16 ]
            }
        ],
        [
            "2836-1-OUYA Game Controller",
            {
                "axes" : [ 0, -1, 1, -1, -1, 4, -1, 2, -1, 3, -1, 5 ],
                "buttons" : [ -1, -1, -1, 0, 2, 3, 1, 4, 5, 10, 11, 12, 13, 14, 15, 6, 7 ]
            }
        ],

        // Chrome mappings
        [
            "OUYA Game Controller (Vendor: 2836 Product: 0001)",
            {
                "axes" : [ 0, 1, 4, 2, 3, 5 ],
                "buttons" : [ 0, 2, 3, 1, 4, 5, 10, 11, 12, 13, 14, 15, 6, 7 ]
            }
        ]
    ]);

    /**
     * Update gamepad status
     * @ignore
     */
    api._updateGamepads = function () {
        var gamepads = navigator.getGamepads();
        var e = {};

        // Trigger bound keycodes
        Object.keys(bindings).forEach(function (index) {
            if (!gamepads[index]) {
                return;
            }

            gamepads[index].buttons.forEach(function (current, button) {
                // Remap buttons if necessary
                if (gamepads[index].mapping !== "standard") {
                    var mapping = remap.get(gamepads[index].id);
                    if (mapping) {
                        button = mapping.buttons[button];
                    }
                }

                // Get mapped button
                var last = bindings[index][button];
                if (!last) {
                    return;
                }

                // Edge detection
                if (!last.pressed && current.pressed) {
                    last.pressed = true;
                    api._keydown(e, last.keyCode, button + 256);
                }
                else if (last.pressed && !current.pressed) {
                    last.pressed = false;
                    api._keyup(e, last.keyCode, button + 256);
                }
            });
        });
    };

    /*
     * PUBLIC STUFF
     */

    /**
     * Standard gamepad mapping information<br>
     * Axes:<br>
     * <ul>
     *   <li>Left control stick: <code>LX</code>, <code>LY</code></li>
     *   <li>Right control stick: <code>RX</code>, <code>RY</code></li>
     *   <li>Left trigger: <code>LT</code></li>
     *   <li>Right trigger: <code>RT</code></li>
     * </ul>
     * Buttons:<br>
     * <ul>
     *   <li>Face buttons: <code>FACE_1</code>, <code>FACE_2</code>, <code>FACE_3</code>, <code>FACE_4</code></li>
     *   <li>D-Pad: <code>UP</code>, <code>DOWN</code>, <code>LEFT</code>, <code>RIGHT</code></li>
     *   <li>Shoulder buttons: <code>L1</code>, <code>L2</code>, <code>R1</code>, <code>R2</code></li>
     *   <li>Analog stick (clicks): <code>L3</code>, <code>R3</code></li>
     *   <li>Others: <code>SELECT</code> (<code>BACK</code>), <code>START</code> (<code>FORWARD</code>), <code>HOME</code></li>
     * </ul>
     * @public
     * @name GAMEPAD
     * @enum {Number}
     * @memberOf me.input
     * @see https://w3c.github.io/gamepad/#remapping
     */
    api.GAMEPAD = {
        // Axes
        "LX"        : 0,
        "LY"        : 1,
        "RX"        : 2,
        "RY"        : 3,
        "LT"        : 4,
        "RT"        : 5,

        // Buttons
        "FACE_1"    : 0,
        "FACE_2"    : 1,
        "FACE_3"    : 2,
        "FACE_4"    : 3,
        "L1"        : 4,
        "L2"        : 5,
        "R1"        : 6,
        "R2"        : 7,
        "SELECT"    : 8,
        "BACK"      : 8,
        "START"     : 9,
        "FORWARD"   : 9,
        "L3"        : 10,
        "R3"        : 11,
        "UP"        : 12,
        "DOWN"      : 13,
        "LEFT"      : 14,
        "RIGHT"     : 15,
        "HOME"      : 16
    };

    /**
     * Associate a gamepad event to a keycode
     * @name bindGamepad
     * @memberOf me.input
     * @public
     * @function
     * @param {Number} index Gamepad index
     * @param {me.input.GAMEPAD} button
     * @param {me.input.KEY} keyCode
     * @example
     * // enable the keyboard
     * me.input.bindKey(me.input.KEY.X, "shoot");
     * // map the lower face button on the first gamepad to the X key
     * me.input.bindGamepad(0, me.input.GAMEPAD.FACE_1, me.input.KEY.X);
     */
    api.bindGamepad = function (index, button, keyCode) {
        // Throw an exception if no action is defined for the specified keycode
        if (!api._KeyBinding[keyCode]) {
            throw new me.Error("no action defined for keycode " + keyCode);
        }

        // Allocate bindings if not defined
        if (!bindings[index]) {
            bindings[index] = {};
        }

        // Map the gamepad button to the keycode
        bindings[index][button] = {
            "keyCode" : keyCode,
            "pressed" : false
        };
    };

    /**
     * unbind the defined keycode
     * @name unbindGamepad
     * @memberOf me.input
     * @public
     * @function
     * @param {Number} index Gamepad index
     * @param {me.input.GAMEPAD} button
     * @example
     * me.input.unbindGamepad(0, me.input.GAMEPAD.FACE_1);
     */
    api.unbindGamepad = function (index, button) {
        if (!bindings[index]) {
            throw new me.Error("no bindings for gamepad " + index);
        }

        bindings[index][button] = {};
    };
})();
