/**
 * load Images
 * @example
 * preloadImages([
 *     { name : 'image1', src : 'images/image1.png'},
 *     { name : 'image2', src : 'images/image2.png'},
 *     { name : 'image3', src : 'images/image3.png'},
 *     { name : 'image4', src : 'images/image4.png'}
 * ]);
 * @ignore
 */
export function preloadImage(img: any, onload: any, onerror: any): void;
/**
 * load a font face
 * @example
 * preloadFontFace(
 *     name: "'kenpixel'", type: "fontface",  src: "url('data/font/kenvector_future.woff2')"
 * ]);
 * @ignore
 */
export function preloadFontFace(data: any, onload: any, onerror: any): void;
/**
 * preload TMX files
 * @ignore
 */
export function preloadTMX(tmxData: any, onload: any, onerror: any): void;
/**
 * preload JSON files
 * @ignore
 */
export function preloadJSON(data: any, onload: any, onerror: any): void;
/**
 * preload Binary files
 * @ignore
 */
export function preloadBinary(data: any, onload: any, onerror: any): void;
/**
 * preload Binary files
 * @ignore
 */
export function preloadJavascript(data: any, onload: any, onerror: any): void;
