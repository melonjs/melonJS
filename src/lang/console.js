
/**
 * display a deprecation warning in the console
 * @param {string} deprecated - deprecated class,function or property name
 * @param {string} replacement - the replacement class, function, or property name
 * @param {string} version - the version since when the lass,function or property is deprecated
 */
export function warning(deprecated, replacement, version) {
    const msg = "melonJS: %s is deprecated since version %s, please use %s";
    let stack = new Error().stack;

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
}
