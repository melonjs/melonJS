/**
 * MelonJS Game Engine
 * (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

/**
 * The built in Array Object
 * @external Array
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array|Array}
 */

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
    return entry[Number.prototype.random(0, entry.length - 1)];
};

/**
 * return a weighted random array element, favoring the earlier entries
 * @memberof! external:Array#
 * @alias weightedRandom
 * @param {array} entry array to pick a element
 * @return {any} random member of array
 */
Array.prototype.weightedRandom = function (entry) {
    return entry[Number.prototype.weightedRandom(0, entry.length - 1)];
};

/**
 * Falls back to a regular array if Float32Array does not exist
 * @memberOf me
 */
me.Float32Array = typeof Float32Array !== "undefined" ? Float32Array : Array;