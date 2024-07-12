import { capitalize } from "./string.js";

/**
 * Known agent vendors
 */
const vendors = ["ms", "MS", "moz", "webkit", "o"];

/**
 * Get a vendor-prefixed property
 * @param name - Property name
 * @param [obj] - Object or element reference to access
 * @returns Value of property
 */
export function prefixed(
	name: string,
	obj?: Record<string, unknown> | undefined,
) {
	obj = obj || globalThis;
	if (name in obj) {
		return obj[name];
	}

	const uc_name = capitalize(name);

	let result;
	vendors.some((vendor) => {
		const name = vendor + uc_name;
		return (result = name in obj ? obj[name] : undefined);
	});
	return result;
}

/**
 * Set a vendor-prefixed property
 * @param name - Property name
 * @param value - Property value
 * @param [obj] - Object or element reference to access
 * @returns true if one of the vendor-prefixed property was found
 */
export function setPrefixed(
	name: string,
	value: unknown,
	obj?: Record<string, unknown> | undefined,
) {
	obj = obj || globalThis;
	if (name in obj) {
		obj[name] = value;
		return;
	}

	const uc_name = capitalize(name);

	vendors.some((vendor) => {
		const name = vendor + uc_name;
		if (name in obj) {
			obj[name] = value;
			return true;
		}
		return false;
	});

	return false;
}
