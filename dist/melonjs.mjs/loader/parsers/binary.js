/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { binList } from '../cache.js';
import { fetchData } from './fetchdata.js';

/**
 * parse/preload a Binary file
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Object} [settings] - Additional settings to be passed when loading the asset
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
function preloadBinary(data, onload, onerror, settings) {

    fetchData(data.src, "arrayBuffer", settings)
        .then(response => {
            // this method is native and might be slightly more efficient
            const decoder = new TextDecoder(); // the default for this is 'utf-8'
            binList[data.name] = decoder.decode(response);

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

export { preloadBinary };
