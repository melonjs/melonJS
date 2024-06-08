/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { imgList } from '../cache.js';
import { fetchData } from './fetchdata.js';
import { getExtension } from '../../utils/file.js';
import { parseCompressedImage } from './compressed_textures/compressed_image.js';

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
function preloadImage(img, onload, onerror, settings) {
    if (typeof imgList[img.name] !== "undefined") {
        // already loaded
        return 0;
    }

    let sources = Array.isArray(img.src) ? img.src : [img.src];
    let isFormatSupported = false;

    for (const imgPath of sources) {
        const imgExt = getExtension(imgPath);
        // loop will stop as soon as a first supported format is detected
        switch (imgExt) {
            // Compressed texture
            case "dds":
            case "pvr":
            case "pkm":
            case "ktx":
            case "ktx2":
                fetchData(imgPath, "arrayBuffer", settings)
                    .then(arrayBuffer => {
                        try {
                            imgList[img.name] = parseCompressedImage(arrayBuffer, imgExt);
                            isFormatSupported = true;
                            if (typeof onload === "function") {
                                // callback
                                onload();
                            }
                        } catch {
                            // parseCompressedImage will throw an error if a format is not supported or badly formatted
                        }
                    }).catch(error => {
                        if (typeof onerror === "function") {
                            // file cannot be loaded
                            onerror(error);
                        }
                    });
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
        "No supported Image file format found for " + img.name
    );
}

export { preloadImage };
