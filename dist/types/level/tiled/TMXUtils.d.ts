/**
 * decompress and decode zlib/gzip data
 * @ignore
 * @name decompress
 * @param {string} input - Base64 encoded and compressed data
 * @param {string} format - compressed data format ("gzip","zlib", "zstd")
 * @returns {Uint32Array} Decoded and decompress data
 */
export function decompress(data: any, format: string): Uint32Array;
/**
 * Decode a CSV encoded array into a binary array
 * @ignore
 * @name decodeCSV
 * @param  {string} input- -  CSV formatted data (only numbers, everything else will be converted to NaN)
 * @returns {number[]} Decoded data
 */
export function decodeCSV(input: any): number[];
/**
 * Decode a base64 encoded string into a byte array
 * @ignore
 * @name decodeBase64AsArray
 * @param {string} input - Base64 encoded data
 * @param {number} [bytes] - number of bytes per array entry
 * @returns {Uint32Array} Decoded data
 */
export function decodeBase64AsArray(input: string, bytes?: number | undefined): Uint32Array;
/**
 * Decode the given data
 * @ignore
 */
export function decode(data: any, encoding: any, compression: any): any;
/**
 * Normalize TMX format to Tiled JSON format
 * @ignore
 */
export function normalize(obj: any, item: any): void;
/**
 * Parse a XML TMX object and returns the corresponding javascript object
 * @ignore
 */
export function parse(xml: any): {
    text: string;
};
/**
 * Apply TMX Properties to the given object
 * @ignore
 */
export function applyTMXProperties(obj: any, data: any): void;
