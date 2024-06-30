/**
 * a collection of string utility functions
 */

/**
 * converts the first character of the given string to uppercase
 * @param str - the string to be capitalized
 * @returns the capitalized string
 */
export function capitalize(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * returns true if the given string contains a numeric integer or float value
 * @param str - the string to be tested
 * @returns true if string contains only digits
 */
export function isNumeric(str: string) {
	if (typeof str === "string") {
		str = str.trim();
	}
	return !Number.isNaN(str) && /^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(str);
}

/**
 * returns true if the given string contains a true or false
 * @param str - the string to be tested
 * @returns true if the string is either true or false
 */
export function isBoolean(str: string) {
	const trimmed = str.trim();
	return trimmed === "true" || trimmed === "false";
}

/**
 * convert a string to the corresponding hexadecimal value
 * @param str - the string to be converted
 * @returns the converted hexadecimal value
 */
export function toHex(str: string) {
	let res = "";
	let c = 0;
	while (c < str.length) {
		res += str.charCodeAt(c++).toString(16);
	}
	return res;
}

/**
 * returns true if the given string is a data url in the `data:[<mediatype>][;base64],<data>` format.
 * (this will not test the validity of the Data or Base64 encoding)
 * @param str - the string (url) to be tested
 * @returns true if the string is a data url
 */
export function isDataUrl(str: string) {
	return /^data:(.+);base64,(.+)$/.test(str);
}
