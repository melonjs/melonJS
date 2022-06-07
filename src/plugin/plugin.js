import utils from "./../utils/utils.js";
import { version } from "./../index.js";

/**
 * This namespace is a container for all registered plugins.
 * @see plugin.register
 * @namespace plugins
 */
export var plugins = {};


class BasePlugin {

    constructor() {
        /**
         * define the minimum required version of melonJS<br>
         * this can be overridden by the plugin
         * @public
         * @type {string}
         * @default "__VERSION__"
         * @name plugin.Base#version
         */
        this.version = "__VERSION__";
    }
}

/**
 * @namespace plugin
 */
export var plugin = {

    /**
     * a base Object for plugin <br>
     * plugin must be installed using the register function
     * @see plugin
     * @class
     * @name Base
     * @memberof plugin
     */
    Base : BasePlugin,

    /**
     * patch a melonJS function
     * @name patch
     * @memberof plugin
     * @public
     * @param {object} proto target object
     * @param {string} name target function
     * @param {Function} fn replacement function
     * @example
     * // redefine the me.game.update function with a new one
     * me.plugin.patch(me.game, "update", function () {
     *   // display something in the console
     *   console.log("duh");
     *   // call the original me.game.update function
     *   this._patched();
     * });
     */
    patch : function (proto, name, fn) {
        // use the object prototype if possible
        if (typeof proto.prototype !== "undefined") {
            proto = proto.prototype;
        }
        // reuse the logic behind object extends
        if (typeof(proto[name]) === "function") {
            // save the original function
            var _parent = proto[name];
            // override the function with the new one
            Object.defineProperty(proto, name, {
                "configurable" : true,
                "value" : (function (name, fn) {
                    return function () {
                        this._patched = _parent;
                        var ret = fn.apply(this, arguments);
                        this._patched = null;
                        return ret;
                    };
                })(name, fn)
            });
        }
        else {
            throw new Error(name + " is not an existing function");
        }
    },

    /**
     * Register a plugin.
     * @name register
     * @memberof plugin
     * @see Base
     * @public
     * @param {plugin.Base} pluginObj Plugin object to instantiate and register
     * @param {string} name
     * @param {object} [...arguments] all extra parameters will be passed to the plugin constructor
     * @example
     * // register a new plugin
     * me.plugin.register(TestPlugin, "testPlugin");
     * // the plugin then also become available
     * // under then me.plugins namespace
     * me.plugins.testPlugin.myfunction ();
     */
    register : function (pluginObj, name) {
        // ensure me.plugins[name] is not already "used"
        if (plugins[name]) {
            throw new Error("plugin " + name + " already registered");
        }

        // get extra arguments
        var _args = [];
        if (arguments.length > 2) {
            // store extra arguments if any
            _args = Array.prototype.slice.call(arguments, 1);
        }

        // try to instantiate the plugin
        _args[0] = pluginObj;
        var instance = new (pluginObj.bind.apply(pluginObj, _args))();

        // inheritance check
        if (typeof instance === "undefined" || !(instance instanceof plugin.Base)) {
            throw new Error("Plugin should extend the me.plugin.Base Class !");
        }

        // compatibility testing
        if (utils.checkVersion(instance.version) > 0) {
            throw new Error("Plugin version mismatch, expected: " + instance.version + ", got: " + version);
        }

        // create a reference to the new plugin
        plugins[name] = instance;
    }
};
