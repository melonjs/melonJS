/**
 * Get a vendor-prefixed property
 * @public
 * @name prefixed
 * @param {string} name - Property name
 * @param {object} [obj=globalThis] - Object or element reference to access
 * @returns {string} Value of property
 * @memberof utils.agent
 */
export function prefixed(name: string, obj?: object | undefined): string;
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
export function setPrefixed(name: string, value: string, obj?: object | undefined): boolean;
