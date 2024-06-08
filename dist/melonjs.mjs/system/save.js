/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { once, BOOT } from './event.js';

/**
 * allow to access and manage the device localStorage
 * @example
 * // Initialize "score" and "lives" with default values
 * // This loads the properties from localStorage if they exist, else it sets the given defaults
 * me.save.add({ score : 0, lives : 3 });
 *
 * // Print all
 * // On first load, this prints { score : 0, lives : 3 }
 * // On further reloads, it prints { score : 31337, lives : 3, complexObject : ... }
 * // Because the following changes will be saved to localStorage
 * console.log(JSON.stringify(me.save));
 *
 * // Save score
 * me.save.score = 31337;
 *
 * // Also supports complex objects thanks to the JSON backend
 * me.save.add({ complexObject : {} })
 * me.save.complexObject = { a : "b", c : [ 1, 2, 3, "d" ], e : { f : [{}] } };
 *
 * // WARNING: Do not set any child properties of complex objects directly!
 * // Changes made that way will not save. Always set the entire object value at once.
 * // If you cannot live with this limitation, there's a workaround:
 * me.save.complexObject.c.push("foo"); // Modify a child property
 * me.save.complexObject = me.save.complexObject; // Save the entire object!
 *
 * // Remove "lives" from localStorage
 * me.save.remove("lives");
 * @namespace save
 */

// Variable to hold the object data
let data = {};

let hasLocalStorage = false;

try {
    // true if localStorage is supported
    hasLocalStorage = typeof globalThis !== "undefined" && typeof globalThis.localStorage !== "undefined";
} catch {
    // the above generates an exception when cookies are blocked
    hasLocalStorage = false;
}

/**
 * a function to check if the given key is a reserved word
 * @ignore
 */
function isReserved(key) {
    return (key === "add" || key === "remove");
}


// Initialize me.save on Boot event
once(BOOT, () => {
    // Load previous data if local Storage is supported
    if (hasLocalStorage === true) {
        let me_save_content = globalThis.localStorage.getItem("me.save");

        if (typeof me_save_content === "string" && me_save_content.length > 0) {
            let keys = JSON.parse(me_save_content) || [];
            keys.forEach((key) => {
                data[key] = JSON.parse(globalThis.localStorage.getItem("me.save." + key));
            });
        }
    }
});

let save = {

    /**
     * Add new keys to localStorage and set them to the given default values if they do not exist
     * @name add
     * @memberof save
     * @param {object} props - key and corresponding values
     * @example
     * // Initialize "score" and "lives" with default values
     * me.save.add({ score : 0, lives : 3 });
     * // get or set the value through me.save
     * me.save.score = 1000;
     */
    add(props) {
        let obj = save;

        Object.keys(props).forEach((key) => {
            if (isReserved(key)) {
                return;
            }

            (function (prop) {
                Object.defineProperty(obj, prop, {
                    configurable : true,
                    enumerable : true,
                    /**
                     * @ignore
                     */
                    get () {
                        return data[prop];
                    },
                    /**
                     * @ignore
                     */
                    set (value) {
                        data[prop] = value;
                        if (hasLocalStorage === true) {
                            globalThis.localStorage.setItem("me.save." + prop, JSON.stringify(value));
                        }
                    }
                });
            })(key);

            // Set default value for key
            if (!(key in data)) {
                obj[key] = props[key];
            }
        });

        // Save keys
        if (hasLocalStorage === true) {
            globalThis.localStorage.setItem("me.save", JSON.stringify(Object.keys(data)));
        }
    },

    /**
     * Remove a key from localStorage
     * @name remove
     * @memberof save
     * @param {string} key - key to be removed
     * @example
     * // Remove the "score" key from localStorage
     * me.save.remove("score");
     */
    remove (key) {
        if (!isReserved(key)) {
            if (typeof data[key] !== "undefined") {
                delete data[key];
                if (hasLocalStorage === true) {
                    globalThis.localStorage.removeItem("me.save." + key);
                    globalThis.localStorage.setItem("me.save", JSON.stringify(Object.keys(data)));
                }
            }
        }
    }
};

var save$1 = save;

export { save$1 as default };
