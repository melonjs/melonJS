/**
 * placeholder for all deprecated classes and corresponding alias for backward compatibility
 * @namespace deprecated
 * @memberOf me
 */

/**
 * display a deprecation warning in the console
 * @public
 * @function
 * @memberOf me.deprecated
 * @name warning
 * @param {String} deprecated deprecated class,function or property name
 * @param {String} replacement the replacement class, function, or property name
 * @param {String} version the version since when the lass,function or property is deprecated
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
