import * as fileUtil from "../utils/file.js";
import { ua } from "../system/platform.js";
import level from "../level/level.js";
import * as TMXUtils from "../level/tiled/TMXUtils.js";
import { isDataUrl } from "../utils/string.js";
import { imgList, tmxList, binList, jsonList } from "./cache.js";
import { crossOrigin, nocache, withCredentials } from "./settings.js";


/**
 * load Images
 * @example
 * preloadImages([
 *     { name : 'image1', src : 'images/image1.png'},
 *     { name : 'image2', src : 'images/image2.png'},
 *     { name : 'image3', src : 'images/image3.png'},
 *     { name : 'image4', src : 'images/image4.png'}
 * ]);
 * @ignore
 */
export function preloadImage(img, onload, onerror) {
    // create new Image object and add to list
    imgList[img.name] = new Image();
    if (typeof onload === "function") {
        imgList[img.name].onload = onload;
    }
    if (typeof onerror === "function") {
        imgList[img.name].onerror = onerror;
    }
    if (typeof (crossOrigin) === "string") {
        imgList[img.name].crossOrigin = crossOrigin;
    }
    imgList[img.name].src = img.src + nocache;
}

/**
 * load a font face
 * @example
 * preloadFontFace(
 *     name: "'kenpixel'", type: "fontface",  src: "url('data/font/kenvector_future.woff2')"
 * ]);
 * @ignore
 */
export function preloadFontFace(data, onload, onerror) {

    if (isDataUrl(data.src) === true) {
        // make sure it in the `url(data:[<mediatype>][;base64],<data>)` format as expected by FontFace
        if (!data.src.startsWith("url(")) {
            data.src = "url(" + data.src + ")";
        }
    }

    let font = new FontFace(data.name, data.src);

    // loading promise
    font.load().then(() => {
        // apply the font after the font has finished downloading
        document.fonts.add(font);
        document.body.style.fontFamily = data.name;
        if (typeof onload === "function") {
            // onloaded callback
            onload();
        }
    }, () => {
        if (typeof onerror === "function") {
            // rejected
            onerror(data.name);
        }
    });
}

/**
 * preload TMX files
 * @ignore
 */
export function preloadTMX(tmxData, onload, onerror) {
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
    let format = fileUtil.getExtension(tmxData.src);

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
                    case "tsx":
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
                        var data = TMXUtils.parse(result); // <= "Unexpected lexical declaration in case block" if using let
                        switch (format) {
                            case "tmx":
                                result = data.map;
                                break;

                            case "tsx":
                                result = data.tilesets[0];
                                break;
                        }

                        break;

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
}

/**
 * preload JSON files
 * @ignore
 */
export function preloadJSON(data, onload, onerror) {
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
}

/**
 * preload Binary files
 * @ignore
 */
export function preloadBinary(data, onload, onerror) {
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
}

/**
 * preload Binary files
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
}
