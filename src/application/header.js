import * as device from "../system/device";
import CanvasRenderer from "../video/canvas/canvas_renderer";

/**
 * display information
 * @param {Application} game - the game application instance calling this function
 */
export function consoleHeader(app) {
    var renderType = typeof app.settings.renderer === "number" ? (app.renderer instanceof CanvasRenderer ? "CANVAS" : "WebGL" + app.renderer.WebGLVersion) : "Custom";
    var audioType = device.hasWebAudio ? "Web Audio" : "HTML5 Audio";
    var gpu_renderer = (typeof app.renderer.GPURenderer === "string") ? " (" + app.renderer.GPURenderer + ")" : "";

    // output video information in the console
    console.log(
        renderType + " renderer" + gpu_renderer + " | " +
        audioType + " | " +
        "pixel ratio " + device.devicePixelRatio + " | " +
        (device.platform.nodeJS ? "node.js" : device.platform.isMobile ? "mobile" : "desktop") + " | " +
        device.getScreenOrientation() + " | " +
        device.language
    );

    console.log( "resolution: " + "requested " + app.settings.width + "x" + app.settings.height +
        ", got " + app.renderer.getWidth() + "x" + app.renderer.getHeight()
    );
}
