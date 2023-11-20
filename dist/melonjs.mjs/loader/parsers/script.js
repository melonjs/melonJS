/*!
 * melonJS Game Engine - v15.15.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * parse/preload a Javascript files
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
function preloadJavascript(data, onload, onerror) {
    let script = globalThis.document.createElement("script");

    script.src = data.src;
    script.type = "text/javascript";
    script.defer = true;

    if (typeof onload === "function") {
        script.onload = () => {
            // callback
            onload();
        };
    }

    if (typeof onerror === "function") {
        script.onerror = () => {
            // callback
            onerror(data.name);
        };
    }

    globalThis.document.getElementsByTagName("body")[0].appendChild(script);

    return 1;
}

export { preloadJavascript };
