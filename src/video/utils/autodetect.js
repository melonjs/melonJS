import { isWebGLSupported } from "../../system/device";
import WebGLRenderer from "../webgl/webgl_renderer";
import CanvasRenderer from "../canvas/canvas_renderer";

/**
 * Auto-detect the best renderer to use
 * @ignore
 */
export function autoDetectRenderer(options) {
    try {
        if (isWebGLSupported(options)) {
            return new WebGLRenderer(options);
        }
    } catch (e) {
        console.log("Error creating WebGL renderer :" + e.message);
    }
    return new CanvasRenderer(options);
}
