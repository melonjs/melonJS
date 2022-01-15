import device from "./../system/device.js";
import { requestPointerLock, exitPointerLock } from "./../input/input.js";

/**
 * placeholder for all deprecated classes and corresponding alias for backward compatibility
 */

/**
 * display a deprecation warning in the console
 * @ignore
 * @param {string} deprecated deprecated class,function or property name
 * @param {string} replacement the replacement class, function, or property name
 * @param {string} version the version since when the lass,function or property is deprecated
 */
export function warning(deprecated, replacement, version) {
    var msg = "melonJS: %s is deprecated since version %s, please use %s";
    var stack = new Error().stack;

    if (console.groupCollapsed) {
        console.groupCollapsed(
            "%c" + msg,
            "font-weight:normal;color:yellow;",
            deprecated,
            version,
            replacement
        );
    } else {
        console.warn(
            msg,
            deprecated,
            version,
            replacement
        );
    }

    if (typeof stack !== "undefined") {
        console.warn(stack);
    }

    if (console.groupCollapsed) {
        console.groupEnd();
    }
};

/**
 * @public
 * @type {Function}
 * @name turnOnPointerLock
 * @memberof me.device
 * @deprecated since 10.3.0
 * @see me.input.requestPointerLock
 */
device.turnOnPointerLock = function () {
    warning("me.device.turnOnPointerLock()", "me.input.requestPointerLock()", "10.3.0");
    return requestPointerLock();
};

/**
 * @public
 * @type {Function}
 * @name turnOffPointerLock
 * @memberof me.device
 * @deprecated since 10.3.0
 * @see me.input.exitPointerLock
 */
device.turnOffPointerLock = function () {
    warning("me.device.turnOffPointerLock()", "me.input.exitPointerLock()", "10.3.0");
    return exitPointerLock();
};
