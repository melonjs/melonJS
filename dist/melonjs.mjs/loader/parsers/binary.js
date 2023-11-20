/*!
 * melonJS Game Engine - v15.15.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { binList } from '../cache.js';
import { nocache, withCredentials } from '../settings.js';

/**
 * parse/preload a Binary file
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
function preloadBinary(data, onload, onerror) {
    let httpReq = new XMLHttpRequest();

    // load our file
    httpReq.open("GET", data.src + nocache, true);
    httpReq.withCredentials = withCredentials;
    httpReq.responseType = "arraybuffer";
    httpReq.onerror = onerror;
    httpReq.onload = function () {
        let arrayBuffer = httpReq.response;
        if (arrayBuffer) {
            let byteArray = new Uint8Array(arrayBuffer);
            let buffer = [];
            for (let i = 0; i < byteArray.byteLength; i++) {
                buffer[i] = String.fromCharCode(byteArray[i]);
            }
            binList[data.name] = buffer.join("");
            if (typeof onload === "function") {
                // callback
                onload();
            }

        }
    };
    httpReq.send();

    return 1;
}

export { preloadBinary };
