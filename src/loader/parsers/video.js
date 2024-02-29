import { videoList } from "../cache.js";
import { fetchData } from "./fetchdata.js";
import { hasVideoFormat } from "../../system/device.js";
import * as fileUtil from "../../utils/file.js";
import { isDataUrl } from "./../../utils/string.js";

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

    let videoElement = videoList[data.name] = globalThis.document.createElement("video");

    if (isDataUrl(data.src)) {
        const mimeType = data.src.match(/[^:]\w+\/[\w-+\d.]+(?=;|,)/)[0];
        if (!mimeType || videoElement.canPlayType(mimeType) === "") {
            throw new Error(`Invalid dataURL or Video file format not supported: ${mimeType}`);
        }
    } else {
        if (!hasVideoFormat(fileUtil.getExtension(data.src))) {
            throw new Error(`Video file format not supported: ${fileUtil.getExtension(data.src)}`);
        }
    }

    if (isDataUrl(data.src)) {
        fetchData(data.src, "blob", settings)
            .then(blob => {
                videoElement.src = globalThis.URL.createObjectURL(blob);
            })
            .catch(error => {
                if (typeof onerror === "function") {
                    onerror(error);
                }
            });
    } else {
        // just a url path
        videoElement.src = data.src;
    }

    videoElement.setAttribute("preload", data.stream === true ? "metadata" : "auto");
    videoElement.setAttribute("playsinline", "true");
    videoElement.setAttribute("disablePictureInPicture", "true");
    videoElement.setAttribute("controls", "false");
    videoElement.setAttribute("crossorigin", settings.crossOrigin);

    if (data.autoplay === true) {
        videoElement.setAttribute("autoplay", "true");
    }
    if (data.loop === true) {
        videoElement.setAttribute("loop", "true");
    }

    if (typeof onload === "function") {
        // some mobile browser (e.g. safari) won't emit the canplay event if autoplay is disabled
        if (data.stream === true || data.autoplay === false) {
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
        videoElement.onerror = () => {
            onerror();
        };
    }

    videoElement.load();

    return 1;
}
