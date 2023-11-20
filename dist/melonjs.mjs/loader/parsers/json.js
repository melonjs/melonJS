/*!
 * melonJS Game Engine - v15.15.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { jsonList } from '../cache.js';
import { nocache, withCredentials } from '../settings.js';

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

    let xmlhttp = new XMLHttpRequest();

    if (xmlhttp.overrideMimeType) {
        xmlhttp.overrideMimeType("application/json");
    }

    xmlhttp.open("GET", data.src + nocache, true);
    xmlhttp.withCredentials = withCredentials;

    // set the callbacks
    xmlhttp.ontimeout = onerror;
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState === 4) {
            // status = 0 when file protocol is used, or cross-domain origin,
            // (With Chrome use "--allow-file-access-from-files --disable-web-security")
            if ((xmlhttp.status === 200) || ((xmlhttp.status === 0) && xmlhttp.responseText)) {
                // get the Texture Packer Atlas content
                jsonList[data.name] = JSON.parse(xmlhttp.responseText);
                if (typeof onload === "function") {
                    // fire the callback
                    onload();
                }
            }
            else if (typeof onerror === "function") {
                onerror(data.name);
            }
        }
    };
    // send the request
    xmlhttp.send();

    return 1;
}

export { preloadJSON };
