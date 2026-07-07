import { hasVideoFormat } from "../../system/device.js";
import * as fileUtil from "../../utils/file.ts";
import { isDataUrl } from "../../utils/string.ts";
import { videoList } from "../cache.js";
import { fetchData } from "./fetchdata.js";

/**
 * parse/preload a Video file
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the resource is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Object} [settings] - Additional settings to be passed when loading the asset
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
export function preloadVideo(data, onload, onerror, settings) {
	if (typeof videoList[data.name] !== "undefined") {
		// Video already preloaded
		return 0;
	}

	const videoElement = (videoList[data.name] =
		globalThis.document.createElement("video"));

	if (isDataUrl(data.src)) {
		const mimeMatch = data.src.match(/[^:]\w+\/[\w-+\d.]+(?=;|,)/);
		const mimeType = mimeMatch ? mimeMatch[0] : null;
		if (!mimeType || videoElement.canPlayType(mimeType) === "") {
			throw new Error(
				`Invalid dataURL or Video file format not supported: ${mimeType}`,
			);
		}
	} else {
		if (!hasVideoFormat(fileUtil.getExtension(data.src))) {
			throw new Error(
				`Video file format not supported: ${fileUtil.getExtension(data.src)}`,
			);
		}
	}

	if (isDataUrl(data.src)) {
		fetchData(data.src, "blob", settings)
			.then((blob) => {
				videoElement.src = globalThis.URL.createObjectURL(blob);
			})
			.catch((error) => {
				if (typeof onerror === "function") {
					onerror(error);
				}
			});
	} else {
		// just a url path
		videoElement.src = data.src;
	}

	videoElement.setAttribute(
		"preload",
		data.stream === true ? "metadata" : "auto",
	);
	videoElement.setAttribute("playsinline", "true");
	videoElement.setAttribute("disablePictureInPicture", "true");
	videoElement.setAttribute("controls", "false");
	// only stamp crossorigin when actually configured: per the HTML spec a
	// MISSING attribute means no CORS, but an INVALID value (e.g. the string
	// "undefined") maps to Anonymous — which force-enables CORS and breaks
	// cross-origin sources served without CORS headers. Note "" is a valid
	// value (anonymous), so guard on type, not truthiness.
	if (typeof settings.crossOrigin === "string") {
		videoElement.setAttribute("crossorigin", settings.crossOrigin);
	}

	if (data.autoplay === true) {
		videoElement.setAttribute("autoplay", "true");
	}
	if (data.loop === true) {
		videoElement.setAttribute("loop", "true");
	}

	if (typeof onload === "function") {
		// some mobile browsers (e.g. safari) won't emit the canplay event
		// unless the video actually plays — only wait for it when autoplay
		// was explicitly requested; everywhere else (including the common
		// case of autoplay simply omitted) loadedmetadata is the reliable
		// "preloaded" signal, otherwise preload hangs forever on
		// autoplay-restricted browsers. Streaming videos always use
		// loadedmetadata — their preload="metadata" never buffers to canplay.
		if (data.stream === true || data.autoplay !== true) {
			videoElement.onloadedmetadata = () => {
				if (typeof onload === "function") {
					onload();
				}
			};
		} else {
			videoElement.oncanplay = () => {
				if (typeof onload === "function") {
					onload();
				}
			};
		}
	}

	if (typeof onerror === "function") {
		videoElement.onerror = (error) => {
			onerror(error);
		};
	}

	videoElement.load();

	return 1;
}
