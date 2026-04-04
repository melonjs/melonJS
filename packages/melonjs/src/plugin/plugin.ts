import type Application from "./../application/application.ts";
import { game } from "../application/application.ts";
import { checkVersion } from "./../utils/utils.ts";
import { version } from "./../version.ts";

/**
 * Contains all registered plugins.
 */
export const cache: Record<string, BasePlugin> = {};

/**
 * @namespace plugin
 */

/**
 * a base Object class for plugin
 * (plugin must be installed using the register function)
 */
export class BasePlugin {
	/**
	 * define the minimum required version of melonJS
	 * this can be overridden by the plugin
	 */
	version: string;

	/**
	 * a reference to the app/game that registered this plugin
	 */
	app: Application;

	constructor(app: Application = game) {
		this.version = version;
		this.app = app;
	}
}

/**
 * patch a melonJS function
 * @param proto - target object
 * @param name - target function
 * @param fn - replacement function
 * @example
 * // redefine the app.update function with a new one
 * me.plugin.patch(app, "update", function () {
 *   // display something in the console
 *   console.log("duh");
 *   // call the original app.update function
 *   this._patched();
 * });
 */
export function patch(
	proto: Record<string, any>,
	name: string,
	fn: (...args: any[]) => any,
): void {
	// use the object prototype if possible
	if (typeof proto.prototype !== "undefined") {
		proto = proto.prototype;
	}
	// reuse the logic behind object extends
	if (typeof proto[name] === "function") {
		// save the original function
		const _parent = proto[name];
		// override the function with the new one
		Object.defineProperty(proto, name, {
			configurable: true,
			value: (function (_name: string, fn: (...args: any[]) => any) {
				return function (this: any, ...args: any[]) {
					this._patched = _parent;
					const ret = fn.apply(this, args);
					this._patched = null;
					return ret;
				};
			})(name, fn),
		});
	} else {
		throw new Error(`${name} is not an existing function`);
	}
}

/**
 * Register a plugin.
 * @param pluginClass - Plugin class to instantiate and register
 * @param name - a unique name for this plugin
 * @param args - all extra parameters will be passed to the plugin constructor
 * @example
 * // register a new plugin
 * me.plugin.register(TestPlugin, "testPlugin");
 * // the `testPlugin` class instance can also be accessed through me.plugin.cache
 * me.plugin.cache.testPlugin.myfunction ();
 */
export function register(
	pluginClass: new (...args: any[]) => BasePlugin,
	name?: string,
	...args: any[]
): void {
	// derive name from class if not provided
	const pluginName =
		name || pluginClass.name || pluginClass.toString().match(/ (\w+)/)![1];

	// ensure me.plugins[name] is not already "used"
	if (cache[pluginName]) {
		throw new Error(`plugin ${pluginName} already registered`);
	}

	// try to instantiate the plugin
	const instance = new pluginClass(...args);

	// inheritance check
	if (typeof instance === "undefined" || !(instance instanceof BasePlugin)) {
		throw new Error("Plugin should extend the BasePlugin Class !");
	}

	// compatibility testing
	if (checkVersion(instance.version, version) > 0) {
		throw new Error(
			`Plugin version mismatch, expected: ${instance.version}, got: ${version}`,
		);
	}

	// create a reference to the new plugin
	cache[pluginName] = instance;
}

/**
 * returns the plugin instance with the specified class type or registered name
 * @param classType - the Class Object or registered name of the plugin to retrieve
 * @returns a plugin instance or undefined
 */
export function get(
	classType: string | (new (...args: any[]) => BasePlugin),
): BasePlugin | undefined {
	for (const name in cache) {
		if (typeof classType === "string") {
			if (classType === name) {
				return cache[name];
			}
		} else if (cache[name] instanceof classType) {
			return cache[name];
		}
	}
}
