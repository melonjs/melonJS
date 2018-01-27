/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 */

/**
 * The built in Array Object
 * @external Array
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array|Array}
 */


/**
 * A fake TypedArray object to be used for the TypedArray polyfills
 * @ignore
 */
me.TypedArray = function (a) {
    var i = 0;
    if (Array.isArray(a)) {
        this.concat(a.slice());
    }
    else if ((arguments.length === 1) && (typeof(a) === "number")) {
        for (i = 0; i < a; i++) {
            this.push(0);
        }
    }
    else {
        throw new me.Error(
            "TypedArray polyfill: Unsupported constructor arguments",
            arguments
        );
    }
};
me.TypedArray.prototype = Array.prototype;

/**
 * The set() method stores multiple values in the typed array, reading input values from a specified array.
 * @ignore
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/set|TypedArray.prototype.set}
 */
me.TypedArray.prototype.set = function (source, offset) {
    offset = offset || 0;

    if (source.length + offset > this.length) {
        throw new me.Error(
            "TypedArray pollyfill: Buffer overflow in set"
        );
    }

    for (var i = 0; i < source.length; i++, offset++) {
        this[offset] = source[i];
    }
};

/**
 * The built in Float32Array object.
 * @external Float32Array
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Float32Array|Float32Array}
 */
window.Float32Array = window.Float32Array || me.TypedArray;

/**
 * The built in Uint8Array object.
 * @external Uint8Array
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Uint8Array|Uint8Array}
 */
window.Uint8Array = window.Uint8Array || me.TypedArray;

/**
 * The built in Uint16Array object.
 * @external Uint16Array
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Uint16Array|Uint16Array}
 */
window.Uint16Array = window.Uint16Array || me.TypedArray;

/**
 * The built in Uint32Array object.
 * @external Uint32Array
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Uint32Array|Uint32Array}
 */
window.Uint32Array = window.Uint32Array || me.TypedArray;
