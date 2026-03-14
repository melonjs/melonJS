import { getExtension } from "../../utils/file.ts";
import { imgList } from "../cache.js";
import { parseCompressedImage } from "./compressed_textures/compressed_image.js";
import { fetchData } from "./fetchdata.js";

/**
 * try to load a single image source
 * @param {string} imgPath - the image path
 * @param {string} imgName - the image name (cache key)
 * @param {Object} settings - fetch settings
 * @returns {Promise} resolves on success, rejects on failure (so the next source can be tried)
 * @ignore
 */
function tryLoadSource(imgPath, imgName, settings) {
	const imgExt = getExtension(imgPath);

	switch (imgExt) {
		// Compressed textures
		case "dds":
		case "pvr":
		case "pkm":
		case "ktx":
		case "ktx2":
			return fetchData(imgPath, "arrayBuffer", settings).then((arrayBuffer) => {
				// parseCompressedImage will throw if the format is not supported
				imgList[imgName] = parseCompressedImage(arrayBuffer, imgExt);
			});

		// SVG file
		case "svg":
			return fetchData(imgPath, "text", settings).then((svgText) => {
				return new Promise((resolve, reject) => {
					const svgImage = new Image();
					svgImage.onload = function () {
						imgList[imgName] = svgImage;
						resolve();
					};
					svgImage.onerror = function (error) {
						reject(error);
					};
					svgImage.src =
						"data:image/svg+xml;charset=utf8," + encodeURIComponent(svgText);
				});
			});

		// default is regular images (jpg, png and friends)
		default:
			return fetchData(imgPath, "blob", settings).then((blob) => {
				return globalThis.createImageBitmap(blob).then((bitmap) => {
					imgList[imgName] = bitmap;
				});
			});
	}
}

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
 *     // compressed texture with fallback chain
 *     { name : 'image4', src : [
 *         'images/image4.astc.ktx',  // try ASTC first
 *         'images/image4.dds',       // then S3TC via DDS
 *         'images/image4.png'        // fallback to PNG
 *     ]}
 * ]);
 */
export function preloadImage(img, onload, onerror, settings) {
	if (typeof imgList[img.name] !== "undefined") {
		// already loaded
		return 0;
	}

	const sources = Array.isArray(img.src) ? img.src : [img.src];

	// try each source in order; stop at the first one that succeeds
	let chain = Promise.reject();
	for (const imgPath of sources) {
		chain = chain.catch(() => {
			return tryLoadSource(imgPath, img.name, settings);
		});
	}

	chain
		.then(() => {
			if (typeof onload === "function") {
				onload();
			}
		})
		.catch((error) => {
			if (typeof onerror === "function") {
				onerror(error);
			}
		});

	return 1;
}
