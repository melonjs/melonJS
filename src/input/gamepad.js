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

    var remap = new Map();

    [
        // Firefox mappings
        [
            "45e-28e-Xbox 360 Wired Controller",
            {
                "axes" : [ 0, 1, 3, 4, 2, 5 ],
                "buttons" : [ 11, 12, 13, 14, 8, 9, -1, -1, 5, 4, 6, 7, 0, 1, 2, 3, 10 ]
            }
        ],
        [
            "54c-268-PLAYSTATION(R)3 Controller",
            {
                "axes" : [ 0, 1, 2, 3, -1, -1 ],
                "buttons" : [ 14, 13, 15, 12, 10, 11, 8, 9, 0, 3, 1, 2, 4, 6, 7, 5, 16 ]
            }
        ],
        [
            "54c-5c4-Wireless Controller", // PS4 Controller
            {
                "axes" : [ 0, 1, 2, 3, -1, -1 ],
                "buttons" : [ 1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 13]
            }
        ],
        [
            "2836-1-OUYA Game Controller",
            {
                "axes" : [ 0, 3, 7, 9, 5, 11 ],
                "buttons" : [ 3, 6, 4, 5, 7, 8, 15, 16, -1, -1, 9, 10, 11, 12, 13, 14, -1 ]
            }
        ],

        // Chrome mappings
        [
            "OUYA Game Controller (Vendor: 2836 Product: 0001)",
            {
                "axes" : [ 0, 1, 3, 4, 2, 5 ],
                "buttons" : [ 0, 3, 1, 2, 4, 5, 12, 13, -1, -1, 6, 7, 8, 9, 10, 11, -1 ]
            }
        ]
    ].forEach(function (value) {
        remap.set(value[0], value[1]);
    });

    /**
     * Update gamepad status
     * @ignore
     */
    api._updateGamepads = navigator.getGamepads ? function () {
        var gamepads = navigator.getGamepads();
        var e = {};

        // Trigger button bindings
        Object.keys(bindings).forEach(function (index) {
            if (!gamepads[index]) {
                return;
            }

            var mapping = gamepads[index].mapping;

            Object.keys(bindings[index].buttons).forEach(function (button) {
                var last = bindings[index].buttons[button];

                // Remap buttons if necessary
                if (mapping !== "standard") {
                    var mapped = remap.get(gamepads[index].id);
                    if (mapped) {
                        button = mapped.buttons[button];
                        if (button < 0) {
                            return;
                        }
                    }
                }

                // Get mapped button
                var current = gamepads[index].buttons[button];

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
    } : function () {};

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
            bindings[index] = {
                "axes" : {},
                "buttons" : {}
            };
        }

        // Map the gamepad button to the keycode
        bindings[index].buttons[button] = {
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

        bindings[index].buttons[button] = {};
    };
})();
