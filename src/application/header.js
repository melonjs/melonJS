import * as device from "../system/device";

/**
 * additional import for TypeScript
 * @import Application from "./application.js";
 */

/**
 * display information
 * @param {Application} app - the game application instance calling this function
 */
export function consoleHeader(app) {
    let renderType = app.renderer.type;
    let gpu_renderer = (typeof app.renderer.GPURenderer === "string") ? " (" + app.renderer.GPURenderer + ")" : "";
    let depthTesting = renderType.includes("WebGL") && app.renderer.depthTest === "z-buffer" ? "Depth Test | " : "";
    let audioType = device.hasWebAudio ? "Web Audio" : "HTML5 Audio";

    // output video information in the console
    console.log(
        renderType + " renderer" + gpu_renderer + " | " + depthTesting +
        audioType + " | " +
        "pixel ratio " + device.devicePixelRatio + " | " +
        (device.platform.nodeJS ? "node.js" : device.platform.isMobile ? "mobile" : "desktop") + " | " +
        device.getScreenOrientation() + " | " +
        device.language
    );

    console.log("resolution: " + "requested " + app.settings.width + "x" + app.settings.height +
        ", got " + app.renderer.width + "x" + app.renderer.height
    );
}
