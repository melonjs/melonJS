import { imgList } from "../cache.js";
import { fetchData } from "./fetchdata.js";
import * as fileUtil from "./../../utils/file.js";
import * as event from "../../system/event.js";
import { parseDDS } from "./compressed_textures/parseDDS.js";
import { parseKTX } from "./compressed_textures/parseKTX.js";
import { parseKTX2 } from "./compressed_textures/parseKTX2.js";
import { parsePVR } from "./compressed_textures/parsePVR.js";
import { parsePKM } from "./compressed_textures/parsePKM.js";

let _renderer;

// gracefully capture a reference to the active renderer without adding more cyclic redundancy
event.once(event.VIDEO_INIT, (renderer) => {
    _renderer = renderer;
});

/**
 * parse/preload an image
 * @param {loader.Asset} img
 * @param {Function} [onload] - function to be called when the resource is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Object} [settings] - Additional settings to be passed when loading the asset
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 * @example
 * preloadImages([
 *     { name : 'image1', src : 'images/image1.png'},
 *     { name : 'image2', src : 'images/image2.png'},
 *     { name : 'image3', src : 'images/image3.png'},
 *     { name : 'image4', src : 'images/image4.png'}
 * ]);
 */
export function preloadImage(img, onload, onerror, settings) {
    if (typeof imgList[img.name] !== "undefined") {
        // already loaded
        return 0;
    }

    let sources = Array.isArray(img.src) ? img.src : [img.src];

    for (const imgPath of sources) {
        const imgExt = fileUtil.getExtension(imgPath);
        let isFormatSupported = false;

        // switch case will stop as soon as a first format is detected
        switch (imgExt) {
            // Compressed texture
            case "dds":
            case "pvr":
            case "pkm":
            case "ktx":
            case "ktx2":
                // check if the current renderer is WebGL
                if (_renderer.type.includes("WebGL")) {
                    fetchData(imgPath, "arrayBuffer", settings)
                        .then(arrayBuffer => {
                            let texture;
                            try {
                                const textureFormats = _renderer.getSupportedCompressedTextureFormats();
                                switch (imgExt) {
                                    // Compressed texture
                                    case "dds":
                                        texture = parseDDS(arrayBuffer, textureFormats);
                                        break;
                                    case "pvr":
                                        texture = parsePVR(arrayBuffer, textureFormats);
                                        break;
                                    case "pkm":
                                        texture = parsePKM(arrayBuffer, textureFormats);
                                        break;
                                    case "ktx":
                                        texture = parseKTX(arrayBuffer, textureFormats);
                                        break;
                                    case "ktx2":
                                        texture = parseKTX2(arrayBuffer, textureFormats);
                                        break;
                                }
                                texture.isCompressed = true;
                                imgList[img.name] = texture;
                                isFormatSupported = true;
                                if (typeof onload === "function") {
                                    // callback
                                    onload();
                                }
                            } catch (error) {
                                // if parse function throw an error;
                            }
                        })
                        .catch(error => {
                            if (typeof onerror === "function") {
                                // file cannot be loaded
                                onerror(error);
                            }
                        });
                }
                break;

            // SVG file
            case "svg":
                fetchData(imgPath, "text", settings)
                    .then(svgText => {
                        const svgImage = new Image();
                        svgImage.onload = function() {
                            imgList[img.name] = svgImage;
                            if (typeof onload === "function") {
                                // callback
                                onload();
                            }
                        };
                        svgImage.onerror = function(error) {
                            if (typeof onerror === "function") {
                                onerror(error);
                            }
                        };
                        svgImage.src = "data:image/svg+xml;charset=utf8," + encodeURIComponent(svgText);
                    })
                    .catch(error => {
                        if (typeof onerror === "function") {
                            onerror(error);
                        }
                    });
                isFormatSupported = true;
                break;

            // default is regular images (jpg, png and friends)
            default:
                fetchData(imgPath, "blob", settings)
                    .then(blob => {
                        globalThis.createImageBitmap(blob)
                            .then((bitmap) => {
                                imgList[img.name] = bitmap;
                                if (typeof onload === "function") {
                                    // callback
                                    onload();
                                }
                            });
                    })
                    .catch(error => {
                        if (typeof onerror === "function") {
                            onerror(error);
                        }
                    });
                isFormatSupported = true;
                break;
        }

        // exit the loop as soon as the first supported format is detected
        if (isFormatSupported === true) {
            return 1;
        }
    }

    // no compatible format was found
    throw new Error(
        "No suppported Image file format found for " + img.name
    );
}
