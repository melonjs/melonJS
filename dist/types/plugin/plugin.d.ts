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
export function patch(proto: object, name: string, fn: Function): void;
/**
 * Register a plugin.
 * @name register
 * @memberof plugin
 * @param {BasePlugin} plugin - Plugin object to instantiate and register
 * @param {string} [name=plugin.constructor.name] - a unique name for this plugin
 * @param {...*} [args] - all extra parameters will be passed to the plugin constructor
 * @example
 * // register a new plugin
 * me.plugin.register(TestPlugin, "testPlugin");
 * // the `testPlugin` class instance can also be accessed through me.plugin.cache
 * me.plugin.cache.testPlugin.myfunction ();
 */
export function register(plugin: BasePlugin, name?: string | undefined, ...args: any[]): void;
/**
 * returns the the plugin instance with the specified class type or registered name
 * @name get
 * @memberof plugin
 * @param {object|string} classType - the Class Object or registered name of the plugin to retreive
 * @returns {BasePlugin} a plugin instance or undefined
 */
export function get(classType: object | string): BasePlugin;
/**
 * @import Application from "./../application/application.js";
 */
/**
 * Contains all registered plugins.
 * @name cache
 * @memberof plugin
 */
export let cache: {};
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
export class BasePlugin {
    /**
     * @param {Application} [app] - a reference to the app/game that registered this plugin
     */
    constructor(app?: Application | undefined);
    /**
     * define the minimum required version of melonJS<br>
     * this can be overridden by the plugin
     * @type {string}
     * @default "__VERSION__"
     */
    version: string;
    /**
     * a reference to the app/game that registered this plugin
     * @type {Application}
     */
    app: Application;
}
/**
 * @class
 * @name Base
 * @memberof plugin
 * @deprecated since 15.1.6, see {@link plugin.BasePlugin}
 */
export class Base extends BasePlugin {
    constructor();
}
import type Application from "./../application/application.js";
