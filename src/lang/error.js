/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

/**
 * The built in Error object.
 * @external Error
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error|Error}
 */

/**
 * melonJS base class for exception handling.
 * @name Error
 * @memberOf me
 * @constructor
 * @param {String} msg Error message.
 */

/**
* First, grab the extend method from me.Object
* and attach it to Error object
*/
if (!Error.extend) {
    Error.extend = me.Object.extend;
}

me.Error = Error.extend({
    init : function (msg) {
        this.name = "me.Error";
        this.message = msg;
    }
});
