/*!
 * melonJS Game Engine - v15.15.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { imgList } from '../cache.js';
import { nocache } from '../settings.js';

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
function preloadImage(img, onload, onerror) {
    if (typeof imgList[img.name] !== "undefined") {
        // already loaded
        return 0;
    }

    // create new Image object and add to list
    imgList[img.name] = new Image();
    if (typeof onload === "function") {
        imgList[img.name].onload = onload;
    }
    if (typeof onerror === "function") {
        imgList[img.name].onerror = onerror;
    }
    imgList[img.name].src = img.src + nocache;

    return 1;
}

export { preloadImage };
