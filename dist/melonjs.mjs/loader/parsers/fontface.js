/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { fontList } from '../cache.js';
import { isDataUrl } from '../../utils/string.js';

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
function preloadFontFace(data, onload, onerror) {
    const fontFaceSet = typeof globalThis.document !== "undefined" ? globalThis.document.fonts : undefined;

    if (isDataUrl(data.src) === true) {
        // make sure it in the `url(data:[<mediatype>][;base64],<data>)` format as expected by FontFace
        if (!data.src.startsWith("url(")) {
            data.src = "url(" + data.src + ")";
        }
    }

    if (typeof fontFaceSet !== "undefined") {
        // create a new font face
        let font = new FontFace(data.name, data.src);
        // loading promise
        font.load().then(() => {
            // add the font to the cache
            fontList[data.name] = font;
            // add the font to the document
            fontFaceSet.add(font);
            // onloaded callback
            if (typeof onload === "function") {
                onload();
            }
        }, () => {
            // rejected
            if (typeof onerror === "function") {
                onerror(data.name);
            }
        });

    } else {
        if (typeof onerror === "function") {
            onerror(error);
        }
    }

    return 1;
}

export { preloadFontFace };
