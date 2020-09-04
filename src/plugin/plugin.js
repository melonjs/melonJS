import utils from "./../utils/utils.js";
import { version } from "./../index.js";
import "jay-extend";

/**
 * This namespace is a container for all registered plugins.
 * @see me.plugin.register
 * @namespace me.plugins
 * @memberOf me
 */
export var plugins = {};

/**
 * @namespace plugin
 * @memberOf me
 */
export var plugin = {

    /**
    * a base Object for plugin <br>
    * plugin must be installed using the register function
    * @see me.plugin
    * @class
    * @extends me.Object
    * @name plugin.Base
    * @memberOf me
    * @constructor
    */
    Base : window.Jay.extend({
        /** @ignore */
        init : function () {
            /**
             * define the minimum required version of melonJS<br>
             * this can be overridden by the plugin
             * @public
             * @type String
             * @default "__VERSION__"
             * @name me.plugin.Base#version
             */
            this.version = "__VERSION__";
        }
    }),

    /**
     * patch a melonJS function
     * @name patch
     * @memberOf me.plugin
     * @public
     * @function
     * @param {Object} proto target object
     * @param {String} name target function
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
        // reuse the logic behind me.Object.extend
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
     * @memberOf me.plugin
     * @see me.plugin.Base
     * @public
     * @function
     * @param {me.plugin.Base} plugin Plugin to instiantiate and register
     * @param {String} name
     * @param {} [arguments...] all extra parameters will be passed to the plugin constructor
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
