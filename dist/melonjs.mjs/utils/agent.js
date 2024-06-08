/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { capitalize } from './string.js';

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
function prefixed(name, obj) {
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
function setPrefixed(name, value, obj) {
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

export { prefixed, setPrefixed };
