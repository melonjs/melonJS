/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org/
 *
 */
(function (api) {
    /*
     * PRIVATE STUFF
     */

    // Analog deadzone
    var deadzone = 0.1;

    // Match vendor and product codes for Firefox
    var vendorProductRE = /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i;

    // Match leading zeros
    var leadingZeroRE = /^0+/;

    /**
     * Firefox reports different ids for gamepads depending on the platform:
     * - Windows: vendor and product codes contain leading zeroes
     * - Mac: vendor and product codes are sparse (no leading zeroes)
     *
     * This function normalizes the id to support both formats
     * @ignore
     */
    function addMapping(id, mapping) {
        var expanded_id = id.replace(vendorProductRE, function (_, a, b) {
            return (
                "000".substr(a.length - 1) + a + "-" +
                "000".substr(b.length - 1) + b + "-"
            );
        });
        var sparse_id = id.replace(vendorProductRE, function (_, a, b) {
            return (
                a.replace(leadingZeroRE, "") + "-" +
                b.replace(leadingZeroRE, "") + "-"
            );
        });

        remap.set(expanded_id, mapping);
        remap.set(sparse_id, mapping);
    }

    // binding list
    var bindings = {};

    // mapping list
    var remap = new Map();

    /**
     * Default gamepad mappings
     * @ignore
     */
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
                "buttons" : [ 1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 12, 13]
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
        addMapping(value[0], value[1]);
    });

    /**
     * gamepad connected callback
     * @ignore
     */
    window.addEventListener("gamepadconnected", function (event) {
        me.event.publish(me.event.GAMEPAD_CONNECTED, [ event.gamepad ]);
    }, false);

    /**
     * gamepad disconnected callback
     * @ignore
     */
    window.addEventListener("gamepaddisconnected", function (event) {
        me.event.publish(me.event.GAMEPAD_DISCONNECTED, [ event.gamepad ]);
    }, false);

    /**
     * Update gamepad status
     * @ignore
     */
    api._updateGamepads = navigator.getGamepads ? function () {
        var gamepads = navigator.getGamepads();
        var mapping;
        var e = {};

        // Trigger button bindings
        Object.keys(bindings).forEach(function (index) {
            if (!gamepads[index]) {
                return;
            }

            if (gamepads[index].mapping !== "standard") {
                mapping = remap.get(gamepads[index].id);
            }

            Object.keys(bindings[index].buttons).forEach(function (button) {
                var last = bindings[index].buttons[button];

                // Remap buttons if necessary
                if (mapping) {
                    button = mapping.buttons[button];
                    if (button < 0) {
                        return;
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
     * Namespace for standard gamepad mapping constants
     * @public
     * @namespace GAMEPAD
     * @memberOf me.input
     */
    api.GAMEPAD = {
        /**
         * Standard gamepad mapping information for axes<br>
         * <ul>
         *   <li>Left control stick: <code>LX</code> (horizontal), <code>LY</code> (vertical)</li>
         *   <li>Right control stick: <code>RX</code> (horizontal), <code>RY</code> (vertical)</li>
         *   <li>Extras: <code>EXTRA_1</code>, <code>EXTRA_2</code>, <code>EXTRA_3</code>, <code>EXTRA_4</code></li>
         * </ul>
         * @public
         * @name AXES
         * @enum {Number}
         * @memberOf me.input.GAMEPAD
         * @see https://w3c.github.io/gamepad/#remapping
         */
        "AXES" : {
            "LX"        : 0,
            "LY"        : 1,
            "RX"        : 2,
            "RY"        : 3,
            "EXTRA_1"   : 4,
            "EXTRA_2"   : 5,
            "EXTRA_3"   : 6,
            "EXTRA_4"   : 7
        },

        /**
         * Standard gamepad mapping information for buttons<br>
         * <ul>
         *   <li>Face buttons: <code>FACE_1</code>, <code>FACE_2</code>, <code>FACE_3</code>, <code>FACE_4</code></li>
         *   <li>D-Pad: <code>UP</code>, <code>DOWN</code>, <code>LEFT</code>, <code>RIGHT</code></li>
         *   <li>Shoulder buttons: <code>L1</code>, <code>L2</code>, <code>R1</code>, <code>R2</code></li>
         *   <li>Analog stick (clicks): <code>L3</code>, <code>R3</code></li>
         *   <li>Navigation: <code>SELECT</code> (<code>BACK</code>), <code>START</code> (<code>FORWARD</code>), <code>HOME</code></li>
         *   <li>Extras: <code>EXTRA_1</code>, <code>EXTRA_2</code>, <code>EXTRA_3</code>, <code>EXTRA_4</code></li>
         * </ul>
         * @public
         * @name BUTTONS
         * @enum {Number}
         * @memberOf me.input.GAMEPAD
         * @see https://w3c.github.io/gamepad/#remapping
         */
        "BUTTONS" : {
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
            "HOME"      : 16,
            "EXTRA_1"   : 17,
            "EXTRA_2"   : 18,
            "EXTRA_3"   : 19,
            "EXTRA_4"   : 20
        }
    };

    /**
     * Associate a gamepad event to a keycode
     * @name bindGamepad
     * @memberOf me.input
     * @public
     * @function
     * @param {Number} index Gamepad index
     * @param {me.input.GAMEPAD.BUTTONS} button
     * @param {me.input.KEY} keyCode
     * @example
     * // enable the keyboard
     * me.input.bindKey(me.input.KEY.X, "shoot");
     * // map the lower face button on the first gamepad to the X key
     * me.input.bindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_1, me.input.KEY.X);
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
     * @param {me.input.GAMEPAD.BUTTONS} button
     * @example
     * me.input.unbindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_1);
     */
    api.unbindGamepad = function (index, button) {
        if (!bindings[index]) {
            throw new me.Error("no bindings for gamepad " + index);
        }
        bindings[index].buttons[button] = {};
    };

    /**
     * Set deadzone for analog gamepad inputs<br>
     * The default deadzone is 0.1 (10%) Analog values less than this will be ignored
     * @name setGamepadDeadzone
     * @memberOf me.input
     * @public
     * @function
     * @param {Number} value Deadzone value
     */
    api.setGamepadDeadzone = function (value) {
        deadzone = value;
    };

    /**
     * specify a custom mapping for a specific gamepad id<br>
     * see below for the default mapping : <br>
     * <center><img src="images/gamepad_diagram.png"/></center><br>
     * @name setGamepadMapping
     * @memberOf me.input
     * @public
     * @function
     * @param {String} id gamepad id string
     * @param {Object} mapping a hash table
     * @param {Number[]} mapping.axes standard analog control stick axis locations
     * @param {Number[]} mapping.buttons standard digital button locations
     * @param {Number[]} mapping.analog analog axis locations for buttons
     * @param {Function} normalize_fn a function that return a normalized value in range [-1.0..1.0], or 0.0 if the button or axis is unknown.
     */
    api.setGamepadMapping = function (id, mapping, normalize_fn) {
        addMapping(id, {
            axes : mapping.axes,
            buttons : mapping.buttons,
            normalize_fn : normalize_fn //?
            }
        );
    };

})(me.input);
