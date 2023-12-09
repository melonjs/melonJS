import { binList } from "../cache.js";
import { crossOrigin, nocache, withCredentials } from "../settings.js";
import "whatwg-fetch";

/**
 * parse/preload a Binary file
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
export function preloadBinary(data, onload, onerror) {

    fetch(data.src + nocache, {
        method: 'GET',
        credentials: withCredentials ? 'include' : 'omit'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Network response was not ok ${response.statusText}`)
        }
        return response.arrayBuffer();
    })
    .then(arrayBuffer => {
        /* ===== This code is one way to do it, left it here just in case, since I don't know entire codebase, this might be the best way still =====
        let byteArray = new Uint8Array(arrayBuffer);
        let buffer = [];
        for (let i = 0; i < byteArray.byteLength; i++) {
            buffer[i] = String.fromCharCode(byteArray[i]);
        }
        binList[data.name] = buffer.join("");
        */

        // this method is native and might be slightly more efficient
        const decoder = new TextDecoder(); // the default for this is 'utf-8'
        binList[data.name] = decoder.decode(arrayBuffer);

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
    
    /* ===== This is the code that was here before changing to fetch =====
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
    */
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
