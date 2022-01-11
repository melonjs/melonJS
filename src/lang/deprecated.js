/**
 * placeholder for all deprecated classes and corresponding alias for backward compatibility
 * @namespace deprecated
 * @memberof me
 */

/**
 * display a deprecation warning in the console
 * @public
 * @function
 * @memberof me.deprecated
 * @name warning
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
 * Backward compatibility for deprecated method or properties are automatically
 * applied when automatically generating an UMD bundle (which is the default since version 9.0).
 * @memberof me.deprecated
 * @function apply
 */
 export function apply() {
     ;
 };
