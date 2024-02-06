/*!
 * melonJS Game Engine - v16.1.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { jsonList } from '../cache.js';
import { fetchData } from './fetchdata.js';

/**
 * parse/preload a JSON files
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
function preloadJSON(data, onload, onerror) {
    if (typeof jsonList[data.name] !== "undefined") {
        // already loaded
        return 0;
    }

    fetchData(data.src, "json")
        .then(response => {
            jsonList[data.name] = response;
            if (typeof onload === "function") {
                // callback
                onload();
            }
        })
        .catch(error => {
            if (typeof onerror === "function") {
                onerror(error);
            }
        });

    return 1;
}

export { preloadJSON };
