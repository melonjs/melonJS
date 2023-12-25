import { imgList } from "../cache.js";
import { fetchData } from "./fetchdata.js";
import * as fileUtil from "./../../utils/file.js";

/**
 * parse/preload an image
 * @param {loader.Asset} img
 * @param {Function} [onload] - function to be called when the resource is loaded
 * @param {Function} [onerror] - function to be called in case of error
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
export function preloadImage(img, onload, onerror) {
    if (typeof imgList[img.name] !== "undefined") {
        // already loaded
        return 0;
    }

    // handle SVG file loading
    if (fileUtil.getExtension(img.src) === "svg") {
        // handle SVG file
        fetchData(img.src, "text")
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
    } else {
        // handle all other image files
        fetchData(img.src, "blob")
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
    }

    return 1;
}
