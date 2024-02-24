import { binList } from "../cache.js";
import { fetchData } from "./fetchdata.js";

/**
 * parse/preload a Binary file
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Object} [settings] - Additional settings to be passed when loading the asset
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
export function preloadBinary(data, onload, onerror, settings) {

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
