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
export function register(plugin: plugin.BasePlugin, name?: string | undefined, ...args: any[]): void;
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
     * define the minimum required version of melonJS<br>
     * this can be overridden by the plugin
     * @type {string}
     * @default "__VERSION__"
     */
    version: string;
}
/**
 * @class
 * @name Base
 * @memberof plugin
 * @deprecated since 15.1.6, see {@link plugin.BasePlugin}
 */
export class Base extends BasePlugin {
}
