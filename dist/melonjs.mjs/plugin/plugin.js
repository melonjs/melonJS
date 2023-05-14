/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { checkVersion } from '../utils/utils.js';
import { version } from '../index.js';

/**
 * Contains all registered plugins.
 * @name cache
 * @memberof plugin
 */
let cache = {};

/**
 * @namespace plugin
 */

/**
 * a base Object class for plugin
 * (plugin must be installed using the register function)
 * @class
 * @name BasePlugin
 * @memberof plugin
 */
class BasePlugin {

    constructor() {
        /**
         * define the minimum required version of melonJS<br>
         * this can be overridden by the plugin
         * @type {string}
         * @default "15.2.1"
         */
        this.version = "15.2.1";
    }
}


/**
 * @class
 * @name Base
 * @memberof plugin
 * @deprecated since 15.1.6, see {@link plugin.BasePlugin}
 */
class Base extends BasePlugin {}

/**
 * patch a melonJS function
 * @name patch
 * @memberof plugin
 * @param {object} proto - target object
 * @param {string} name - target function
 * @param {Function} fn - replacement function
 * @example
 * // redefine the me.game.update function with a new one
 * me.plugin.patch(me.game, "update", function () {
 *   // display something in the console
 *   console.log("duh");
 *   // call the original me.game.update function
 *   this._patched();
 * });
 */
function patch(proto, name, fn) {
    // use the object prototype if possible
    if (typeof proto.prototype !== "undefined") {
        proto = proto.prototype;
    }
    // reuse the logic behind object extends
    if (typeof(proto[name]) === "function") {
        // save the original function
        let _parent = proto[name];
        // override the function with the new one
        Object.defineProperty(proto, name, {
            "configurable" : true,
            "value" : (function (name, fn) {
                return function () {
                    this._patched = _parent;
                    let ret = fn.apply(this, arguments);
                    this._patched = null;
                    return ret;
                };
            })(name, fn)
        });
    }
    else {
        throw new Error(name + " is not an existing function");
    }
}

/**
 * Register a plugin.
 * @name register
 * @memberof plugin
 * @param {plugin.BasePlugin} plugin - Plugin object to instantiate and register
 * @param {string} [name=plugin.constructor.name] - a unique name for this plugin
 * @param {object} [...arguments] - all extra parameters will be passed to the plugin constructor
 * @example
 * // register a new plugin
 * me.plugin.register(TestPlugin, "testPlugin");
 * // the plugin then also become available
 * // under then me.plugins namespace
 * me.plugins.testPlugin.myfunction ();
 */
function register(plugin, name = plugin.toString().match(/ (\w+)/)[1]) {
    // ensure me.plugins[name] is not already "used"
    if (cache[name]) {
        throw new Error("plugin " + name + " already registered");
    }

    // get extra arguments
    let _args = [];
    if (arguments.length > 2) {
        // store extra arguments if any
        _args = Array.prototype.slice.call(arguments, 1);
    }

    // try to instantiate the plugin
    _args[0] = plugin;
    let instance = new (plugin.bind.apply(plugin, _args))();

    // inheritance check
    if (typeof instance === "undefined" || !(instance instanceof BasePlugin)) {
        throw new Error("Plugin should extend the BasePlugin Class !");
    }

    // compatibility testing
    if (checkVersion(instance.version, version) > 0) {
        throw new Error("Plugin version mismatch, expected: " + instance.version + ", got: " + version);
    }

    // create a reference to the new plugin
    cache[name] = instance;
}

export { Base, BasePlugin, cache, patch, register };
