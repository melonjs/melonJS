/**
 * Compare two version strings
 * @public
 * @memberof utils
 * @name checkVersion
 * @param {string} v1 - First version string to compare
 * @param {string} v2 - second version string to compare
 * @returns {number} Return 0 if v1 == v2, or 1 if v1 is greater, or -1 if v2 is greater
 * @example
 * if (me.utils.checkVersion("7.0.0") > 0) {
 *     console.error(
 *         "melonJS is too old. Expected: 7.0.0, Got: 6.3.0"
 *     );
 * }
 */
export function checkVersion(v1: string, v2: string): number;
/**
 * parse the fragment (hash) from a URL and returns them into
 * @public
 * @memberof utils
 * @name getUriFragment
 * @param {string} [url=document.location] - an optional params string or URL containing fragment (hash) params to be parsed
 * @returns {object} an object representing the deserialized params string.
 * @property {boolean} [hitbox=false] draw the hitbox in the debug panel (if enabled)
 * @property {boolean} [velocity=false] draw the entities velocity in the debug panel (if enabled)
 * @property {boolean} [quadtree=false] draw the quadtree in the debug panel (if enabled)
 * @property {boolean} [webgl=false] force the renderer to WebGL
 * @property {boolean} [debug=false] display the debug panel (if preloaded)
 * @property {string} [debugToggleKey="s"] show/hide the debug panel (if preloaded)
 * @example
 * // http://www.example.com/index.html#debug&hitbox=true&mytag=value
 * let UriFragment = me.utils.getUriFragment();
 * console.log(UriFragment["mytag"]); //> "value"
 */
export function getUriFragment(url?: string | undefined): object;
/**
 * reset the GUID Base Name
 * the idea here being to have a unique ID
 * per level / object
 * @ignore
 */
export function resetGUID(base: any, index?: number): void;
/**
 * create and return a very simple GUID
 * Game Unique ID
 * @ignore
 */
export function createGUID(index?: number): string;
export * as agent from "./agent.js";
export * as array from "./array.js";
export * as file from "./file.js";
export * as string from "./string.js";
export * as _function from "./function.js";
export { _function as function };
