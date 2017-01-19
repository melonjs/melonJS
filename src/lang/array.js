/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

/**
 * The built in Array Object
 * @external Array
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array|Array}
 */

/* eslint-disable no-extend-native */

/**
 * Remove the specified object from the Array<br>
 * @memberof! external:Array#
 * @alias remove
 * @param {Object} object to be removed
 */
Array.prototype.remove = function (obj) {
    var i = Array.prototype.indexOf.call(this, obj);
    if (i !== -1) {
        Array.prototype.splice.call(this, i, 1);
    }
    return this;
};

if (!Array.prototype.forEach) {
    /**
     * provide a replacement for browsers that don't
     * support Array.prototype.forEach (JS 1.6)
     * @ignore
     */
    Array.prototype.forEach = function (callback, scope) {
        for (var i = 0, j = this.length; j--; i++) {
            callback.call(scope || this, this[i], i, this);
        }
    };
}

if (!Array.isArray) {
    /**
     * provide a replacement for browsers that don't
     * natively support Array.isArray
     * @ignore
     */
    Array.isArray = function (vArg) {
        var isArray;
        isArray = vArg instanceof Array;
        return isArray;
    };
}

/**
 * return a random array element
 * @memberof! external:Array#
 * @alias random
 * @param {array} entry array to pick a element
 * @return {any} random member of array
 */
Array.prototype.random = function (entry) {
    return entry[(0).random(entry.length)];
};

/**
 * return a weighted random array element, favoring the earlier entries
 * @memberof! external:Array#
 * @alias weightedRandom
 * @param {array} entry array to pick a element
 * @return {any} random member of array
 */
Array.prototype.weightedRandom = function (entry) {
    return entry[(0).weightedRandom(entry.length)];
};

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
/* eslint-enable no-extend-native */
