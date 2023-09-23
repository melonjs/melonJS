import { capitalize } from "./string.js";

/**
 * a collection of utility functons to ease porting between different user agents.
 * @namespace utils.agent
 */

/**
 * Known agent vendors
 * @ignore
 */
const vendors = [ "ms", "MS", "moz", "webkit", "o" ];

/**
 * Get a vendor-prefixed property
 * @public
 * @name prefixed
 * @param {string} name - Property name
 * @param {object} [obj=globalThis] - Object or element reference to access
 * @returns {string} Value of property
 * @memberof utils.agent
 */
export function prefixed(name, obj) {
    obj = obj || globalThis;
    if (name in obj) {
        return obj[name];
    }

    let uc_name = capitalize(name);

    let result;
    vendors.some((vendor) => {
        let name = vendor + uc_name;
        return (result = (name in obj) ? obj[name] : undefined);
    });
    return result;
}

/**
 * Set a vendor-prefixed property
 * @public
 * @name setPrefixed
 * @param {string} name - Property name
 * @param {string} value - Property value
 * @param {object} [obj=globalThis] - Object or element reference to access
 * @returns {boolean} true if one of the vendor-prefixed property was found
 * @memberof utils.agent
 */
export function setPrefixed(name, value, obj) {
    obj = obj || globalThis;
    if (name in obj) {
        obj[name] = value;
        return;
    }

    let uc_name = capitalize(name);

    vendors.some((vendor) => {
        let name = vendor + uc_name;
        if (name in obj) {
            obj[name] = value;
            return true;
        }
        return false;
    });

    return false;
}
