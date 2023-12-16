import { binList } from "../cache.js";
import { crossOrigin } from "../settings.js";
import { fetchData } from "./fetchdata.js";

/**
 * parse/preload a Binary file
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
export function preloadBinary(data, onload, onerror) {

    fetchData(data.src, "arrayBuffer")
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

/**
 * parse/preload a Javascript files
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @ignore
 */
export function preloadJavascript(data, onload, onerror) {
    let script = document.createElement("script");

    script.src = data.src;
    script.type = "text/javascript";
    if (typeof (crossOrigin) === "string") {
        script.crossOrigin = crossOrigin;
    }
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

    document.getElementsByTagName("body")[0].appendChild(script);

    return 1;
}
