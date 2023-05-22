/**
 * set the function used to inflate gzip/zlib data
 * @memberof TMXUtils
 * @param {Func} fn - inflate function
 */
export function setInflateFunction(fn: Func): void;
/**
 * Decode a encoded array into a binary array
 * @memberof TMXUtils
 * @param {string} data - data to be decoded
 * @param {string} [encoding="none"] - data encoding ("csv", "base64", "xml")
 * @returns {number[]} Decoded data
 */
export function decode(data: string, encoding?: string | undefined, compression: any): number[];
/**
 * Parse a XML TMX object and returns the corresponding javascript object
 * @memberof TMXUtils
 * @param {Document} xml - XML TMX object
 * @returns {object} Javascript object
 */
export function parse(xml: Document): object;
/**
 * Apply TMX Properties to the given object
 * @memberof TMXUtils
 * @param {object} obj - object to apply the properties to
 * @param {object} data - TMX data object
 * @returns {object} obj
 */
export function applyTMXProperties(obj: object, data: object): object;
