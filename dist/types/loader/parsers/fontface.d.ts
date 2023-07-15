/**
 * parse/preload a font face
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 * @example
 * preloadFontFace(
 *     name: "'kenpixel'", type: "fontface",  src: "url('data/font/kenvector_future.woff2')"
 * ]);
 */
export function preloadFontFace(data: loader.Asset, onload?: Function | undefined, onerror?: Function | undefined): number;
