/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org/
 *
 */
(function (api) {
    /*
     * PRIVATE STUFF
     */

    // Analog deadzone
    var deadzone = 0.1;

    /**
     * A function that returns a normalized value in range [-1.0..1.0], or 0.0 if the axis is unknown.
     * @callback me.input~normalize_fn
     * @param {Number} value The raw value read from the gamepad driver
     * @param {Number} axis The axis index from the standard mapping, or -1 if not an axis
     * @param {Number} button The button index from the standard mapping, or -1 if not a button
     */
    function defaultNormalizeFn(value) {
        return value;
    }

    /**
     * Normalize axis values for wired Xbox 360
     * @ignore
     */
    function wiredXbox360NormalizeFn(value, axis, button) {
        if (button === api.GAMEPAD.BUTTONS.L2 || button === api.GAMEPAD.BUTTONS.R2) {
            return (value + 1) / 2;
        }
        return value;
    }

    /**
     * Normalize axis values for OUYA
     * @ignore
     */
    function ouyaNormalizeFn(value, axis, button) {
        if (value > 0) {
            if (button === api.GAMEPAD.BUTTONS.L2) {
                // L2 is wonky; seems like the deadzone is around 20000
                // (That's over 15% of the total range!)
                value = Math.max(0, value - 20000) / 111070;
            }
            else {
                // Normalize [1..65536] => [0.0..0.5]
                value = (value - 1) / 131070;
            }
        }
        else {
            // Normalize [-65536..-1] => [0.5..1.0]
            value = (65536 + value) / 131070 + 0.5;
        }

        return value;
    }

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

        // Normalize optional parameters
        mapping.analog = mapping.analog || mapping.buttons.map(function () {
            return -1;
        });
        mapping.normalize_fn = mapping.normalize_fn || defaultNormalizeFn;

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
                "axes" : [ 0, 1, 3, 4 ],
                "buttons" : [ 11, 12, 13, 14, 8, 9, -1, -1, 5, 4, 6, 7, 0, 1, 2, 3, 10 ],
                "analog" : [ -1, -1, -1, -1, -1, -1, 2, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
                "normalize_fn" : wiredXbox360NormalizeFn
            }
        ],
        [
            "54c-268-PLAYSTATION(R)3 Controller",
            {
                "axes" : [ 0, 1, 2, 3 ],
                "buttons" : [ 14, 13, 15, 12, 10, 11, 8, 9, 0, 3, 1, 2, 4, 6, 7, 5, 16 ]
            }
        ],
        [
            "54c-5c4-Wireless Controller", // PS4 Controller
            {
                "axes" : [ 0, 1, 2, 3 ],
                "buttons" : [ 1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 12, 13 ]
            }
        ],
        [
            "2836-1-OUYA Game Controller",
            {
                "axes" : [ 0, 3, 7, 9 ],
                "buttons" : [ 3, 6, 4, 5, 7, 8, 15, 16, -1, -1, 9, 10, 11, 12, 13, 14, -1 ],
                "analog" : [ -1, -1, -1, -1, -1, -1, 5, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
                "normalize_fn" : ouyaNormalizeFn
            }
        ],

        // Chrome mappings
        [
            "OUYA Game Controller (Vendor: 2836 Product: 0001)",
            {
                "axes" : [ 0, 1, 3, 4 ],
                "buttons" : [ 0, 3, 1, 2, 4, 5, 12, 13, -1, -1, 6, 7, 8, 9, 10, 11, -1 ],
                "analog" : [ -1, -1, -1, -1, -1, -1, 2, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
                "normalize_fn" : ouyaNormalizeFn
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
        var e = {};

        // Trigger button bindings
        Object.keys(bindings).forEach(function (index) {
            var gamepad = gamepads[index];
            if (!gamepad) {
                return;
            }

            var mapping = null;
            if (gamepad.mapping !== "standard") {
                mapping = remap.get(gamepad.id);
            }

            var binding = bindings[index];

            // Iterate all buttons that have active bindings
            Object.keys(binding.buttons).forEach(function (button) {
                var last = binding.buttons[button];
                var mapped_button = button;
                var mapped_axis = -1;

                // Remap buttons if necessary
                if (mapping) {
                    mapped_button = mapping.buttons[button];
                    mapped_axis = mapping.analog[button];
                    if (mapped_button < 0 && mapped_axis < 0) {
                        // Button is not mapped
                        return;
                    }
                }

                // Get mapped button
                var current = gamepad.buttons[mapped_button] || {};

                // Remap an axis to an analog button
                if (mapping) {
                    if (mapped_axis >= 0) {
                        var value = mapping.normalize_fn(gamepad.axes[mapped_axis], -1, +button);

                        // Create a new object, because GamepadButton is read-only
                        current = {
                            "value" : value,
                            "pressed" : current.pressed || (Math.abs(value) >= deadzone)
                        };
                    }
                }

                me.event.publish(me.event.GAMEPAD_UPDATE, [ index, "buttons", +button, current ]);

                // Edge detection
                if (!last.pressed && current.pressed) {
                    api._keydown(e, last.keyCode, mapped_button + 256);
                }
                else if (last.pressed && !current.pressed) {
                    api._keyup(e, last.keyCode, mapped_button + 256);
                }

                // Update last button state
                last.value = current.value;
                last.pressed = current.pressed;
            });

            // Iterate all axes that have active bindings
            Object.keys(binding.axes).forEach(function (axis) {
                var last = binding.axes[axis];
                var mapped_axis = axis;

                // Remap buttons if necessary
                if (mapping) {
                    mapped_axis = mapping.axes[axis];
                    if (mapped_axis < 0) {
                        // axe is not mapped
                        return;
                    }
                }

                // retrieve the current value and normalize if necessary
                var value = gamepad.axes[mapped_axis];
                if (typeof(value) === "undefined") {
                    return;
                }
                if (mapping) {
                    value = mapping.normalize_fn(value, +axis, -1);
                }
                // normalize value into a [-1, 1] range value (treat 0 as positive)
                var range = Math.sign(value) || 1;
                if (!last[range]) {
                    return;
                }
                var pressed = (Math.abs(value) >= (deadzone + Math.abs(last[range].threshold)));

                me.event.publish(me.event.GAMEPAD_UPDATE, [ index, "axes", +axis, value ]);

                // Edge detection
                if (!last[range].pressed && pressed) {
                    api._keydown(e, last[range].keyCode, mapped_axis + 256);
                }
                else if ((last[range].pressed || (last[-range] && last[-range].pressed)) && !pressed) {
                    range = last[range].pressed ? range : -range;
                    api._keyup(e, last[range].keyCode, mapped_axis + 256);
                }

                // Update last axis state
                last[range].value = value;
                last[range].pressed = pressed;
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
            "R1"        : 5,
            "L2"        : 6,
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
     * @param {me.input.GAMEPAD.BUTTONS|Object} button id (deprecated) or definition as below
     * @param {String} button.type "buttons" or "axes"
     * @param {me.input.GAMEPAD.BUTTONS|me.input.GAMEPAD.AXES} button.code button or axis code id
     * @param {String} [button.threshold] value indicating when the axis should trigger the keycode (e.g. -0.5 or 0.5)
     * @param {me.input.KEY} keyCode
     * @example
     * // enable the keyboard
     * me.input.bindKey(me.input.KEY.X, "shoot");
     * ...
     * // map the lower face button on the first gamepad to the X key (deprecated use)
     * me.input.bindGamepad(0, me.input.GAMEPAD.BUTTONS.FACE_1, me.input.KEY.X);
     * // map the lower face button on the first gamepad to the X key
     * me.input.bindGamepad(0, {type:"buttons", code: me.input.GAMEPAD.BUTTONS.FACE_1}, me.input.KEY.X);
     * // map the left axis value on the first gamepad to the LEFT key
     * me.input.bindGamepad(0, {type:"axes", code: me.input.GAMEPAD.AXES.LX, threshold: -0.5}, me.input.KEY.LEFT);
     */
    api.bindGamepad = function (index, button, keyCode) {
        // Throw an exception if no action is defined for the specified keycode
        if (!api._KeyBinding[keyCode]) {
            throw new me.Error("no action defined for keycode " + keyCode);
        }

        // for backward compatiblity with 3.0.x
        if (typeof (button) !== "object") {
            button = {
                type : "buttons",
                code : button
            };
            console.warn("Deprecated: me.input.bindGamepad parameteres have changed");
        }

        // Allocate bindings if not defined
        if (!bindings[index]) {
            bindings[index] = {
                "axes" : {},
                "buttons" : {}
            };
        }

        var mapping = {
            "keyCode" : keyCode,
            "value" : 0,
            "pressed" : false,
            "threshold" : button.threshold // can be undefined
        };
        var binding = bindings[index][button.type];

        // Map the gamepad button or axis to the keycode
        if (button.type === "buttons") {
            // buttons are defined by a `gamePadButton` object
            binding[button.code] = mapping;
        } else if (button.type === "axes") {
            // normalize threshold into a value that can represent both side of the axis
            var range = (Math.sign(button.threshold) || 1);
            // axes are defined using a double []
            if (!binding[button.code]) {
                binding[button.code] = {};
            }
            binding[button.code][range] = mapping;
        }
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
     * @param {String} id Gamepad id string
     * @param {Object} mapping A hash table
     * @param {Number[]} mapping.axes Standard analog control stick axis locations
     * @param {Number[]} mapping.buttons Standard digital button locations
     * @param {Number[]} [mapping.analog] Analog axis locations for buttons
     * @param {me.input~normalize_fn} [mapping.normalize_fn] Axis normalization function
     * @example
     * // A weird controller that has its axis mappings reversed
     * me.input.setGamepadMapping("Generic USB Controller", {
     *   "axes" : [ 3, 2, 1, 0 ],
     *   "buttons" : [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ]
     * });
     *
     * // Mapping extra axes to analog buttons
     * me.input.setGamepadMapping("Generic Analog Controller", {
     *   "axes" : [ 0, 1, 2, 3 ],
     *   "buttons" : [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ],
     *
     *   // Raw axis 4 is mapped to GAMEPAD.BUTTONS.FACE_1
     *   // Raw axis 5 is mapped to GAMEPAD.BUTTONS.FACE_2
     *   // etc...
     *   // Also maps left and right triggers
     *   "analog" : [ 4, 5, 6, 7, -1, -1, 8, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
     *
     *   // Normalize the value of button L2: [-1.0..1.0] => [0.0..1.0]
     *   "normalize_fn" : function (value, axis, button) {
     *     return ((button === me.input.GAMEPAD.BUTTONS.L2) ? ((value + 1) / 2) : value) || 0;
     *   }
     * });
     */
    api.setGamepadMapping = addMapping;

})(me.input);
