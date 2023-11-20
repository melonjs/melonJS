/*!
 * melonJS Game Engine - v15.15.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { getExtension } from '../../utils/file.js';
import { ua } from '../../system/platform.js';
import level from '../../level/level.js';
import { parse } from '../../level/tiled/TMXUtils.js';
import { tmxList } from '../cache.js';
import { nocache, withCredentials } from '../settings.js';

/**
 * parse/preload a TMX file
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
function preloadTMX(tmxData, onload, onerror) {
    if (typeof tmxList[tmxData.name] !== "undefined") {
        // already loaded
        return 0;
    }

    /**
     * @ignore
     */
    function addToTMXList(data) {
        // set the TMX content
        tmxList[tmxData.name] = data;

        // add the tmx to the level manager
        if (tmxData.type === "tmx") {
            level.add(tmxData.type, tmxData.name);
        }
    }


    //if the data is in the tmxData object, don't get it via a XMLHTTPRequest
    if (tmxData.data) {
        addToTMXList(tmxData.data);
        if (typeof onload === "function") {
            onload();
        }
        return;
    }

    let xmlhttp = new XMLHttpRequest();
    // check the data format ('tmx', 'json')
    let format = getExtension(tmxData.src);

    if (xmlhttp.overrideMimeType) {
        if (format === "json") {
            xmlhttp.overrideMimeType("application/json");
        }
        else {
            xmlhttp.overrideMimeType("text/xml");
        }
    }

    xmlhttp.open("GET", tmxData.src + nocache, true);
    xmlhttp.withCredentials = withCredentials;
    // set the callbacks
    xmlhttp.ontimeout = onerror;
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState === 4) {
            // status = 0 when file protocol is used, or cross-domain origin,
            // (With Chrome use "--allow-file-access-from-files --disable-web-security")
            if ((xmlhttp.status === 200) || ((xmlhttp.status === 0) && xmlhttp.responseText)) {
                let result = null;

                // parse response
                switch (format) {
                    case "xml":
                    case "tmx":
                    case "tsx": {
                        // ie9 does not fully implement the responseXML
                        if (ua.match(/msie/i) || !xmlhttp.responseXML) {
                            if (globalThis.DOMParser) {
                                // manually create the XML DOM
                                result = (new DOMParser()).parseFromString(xmlhttp.responseText, "text/xml");
                            } else {
                                throw new Error("XML file format loading not supported, use the JSON file format instead");
                            }
                        }
                        else {
                            result = xmlhttp.responseXML;
                        }
                        // converts to a JS object
                        const data = parse(result);
                        switch (format) {
                            case "tmx":
                                result = data.map;
                                break;

                            case "tsx":
                                result = data.tilesets[0];
                                break;
                        }
                        break;
                    }
                    case "json":
                    case "tmj":
                    case "tsj":
                        result = JSON.parse(xmlhttp.responseText);
                        break;

                    default:
                        throw new Error("TMX file format " + format + " not supported !");
                }

                //set the TMX content
                addToTMXList(result);

                // fire the callback
                if (typeof onload === "function") {
                    onload();
                }
            }
            else if (typeof onerror === "function") {
                onerror(tmxData.name);
            }
        }
    };
    // send the request
    xmlhttp.send();

    return 1;
}

export { preloadTMX };
