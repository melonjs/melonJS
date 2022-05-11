import device from "./../system/device.js";
import { requestPointerLock, exitPointerLock } from "./../input/input.js";
import { TextureAtlas } from "./../video/texture.js";
import Renderer from "./../video/renderer.js";
import { Draggable, DropTarget } from "./../renderable/dragndrop.js";

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
 * @memberof device
 * @deprecated since 10.3.0
 * @see input.requestPointerLock
 */
device.turnOnPointerLock = function () {
    warning("device.turnOnPointerLock()", "input.requestPointerLock()", "10.3.0");
    return requestPointerLock();
};

/**
 * @public
 * @type {Function}
 * @name turnOffPointerLock
 * @memberof device
 * @deprecated since 10.3.0
 * @see input.exitPointerLock
 */
device.turnOffPointerLock = function () {
    warning("device.turnOffPointerLock()", "input.exitPointerLock()", "10.3.0");
    return exitPointerLock();
};

/**
 * @public
 * @name Texture
 * @memberof Renderer#
 * @deprecated since 10.4.0
 * @see TextureAtlas
 */
Object.defineProperty(Renderer.prototype, "Texture", {
    /**
     * @ignore
     */
    get : function () {
        warning("me.video.renderer.Texture", "me.TextureAtlas", "10.4.0");
        return TextureAtlas;
    }
});


/**
 * @classdesc
 * Used to make a game entity draggable
 * @augments Entity
 * @deprecated since 10.5.0
 * @see Draggable
 */
export class DraggableEntity extends Draggable {
    /**
     * @param {number} x the x coordinates of the draggable object
     * @param {number} y the y coordinates of the draggable object
     * @param {object} settings Entity properties (see {@link Entity})
     */
    constructor(x, y, settings) {
        warning("DraggableEntity", "Draggable", "10.5.0");
        super(x, y, settings.width, settings.height);
    }
}

/**
 * @classdesc
 * Used to make a game entity a droptarget
 * @augments Entity
 * @deprecated since 10.5.0
 * @see DropTarget
 */
export class DroptargetEntity extends DropTarget {
    /**
     * @param {number} x the x coordinates of the draggable object
     * @param {number} y the y coordinates of the draggable object
     * @param {object} settings Entity properties (see {@link Entity})
     */
    constructor(x, y, settings) {
        warning("DroptargetEntity", "DropTarget", "10.5.0");
        super(x, y, settings.width, settings.height);
    }
}
