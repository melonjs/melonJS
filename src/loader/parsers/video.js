import { videoList } from "../cache.js";
import { fetchData } from "./fetchdata.js";
import { hasVideoFormat } from "../../system/device.js";
import * as fileUtil from "../../utils/file.js";
import { crossOrigin } from "../settings.js";
import { isDataUrl } from "./../../utils/string.js";

/**
 * parse/preload a Video file
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the asset is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
export function preloadVideo(data, onload, onerror) {

    if (typeof videoList[data.name] !== "undefined") {
        // Video already preloaded
        return 0;
    }

    if (!hasVideoFormat(fileUtil.getExtension(data.src))) {
        throw new Error(`Video file format not supported: ${fileUtil.getExtension(data.src)}`);
    }

    let videoElement = videoList[data.name] = document.createElement("video");

    if (isDataUrl(data.src)) {
        fetchData(data.src, "blob")
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
    videoElement.setAttribute("crossorigin", crossOrigin);

    if (data.autoplay === true) {
        videoElement.setAttribute("autoplay", "true");
    }
    if (data.loop === true) {
        videoElement.setAttribute("loop", "true");
    }

    if (typeof onload === "function") {
        if (data.stream === true) {
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
