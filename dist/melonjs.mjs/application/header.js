/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { devicePixelRatio, platform, getScreenOrientation, language, hasWebAudio } from '../system/device.js';

/**
 * additional import for TypeScript
 * @import Application from "./application.js";
 */

/**
 * display information
 * @param {Application} app - the game application instance calling this function
 */
function consoleHeader(app) {
    let renderType = app.renderer.type;
    let gpu_renderer = (typeof app.renderer.GPURenderer === "string") ? " (" + app.renderer.GPURenderer + ")" : "";
    let depthTesting = renderType.includes("WebGL") && app.renderer.depthTest === "z-buffer" ? "Depth Test | " : "";
    let audioType = hasWebAudio ? "Web Audio" : "HTML5 Audio";

    // output video information in the console
    console.log(
        renderType + " renderer" + gpu_renderer + " | " + depthTesting +
        audioType + " | " +
        "pixel ratio " + devicePixelRatio + " | " +
        (platform.nodeJS ? "node.js" : platform.isMobile ? "mobile" : "desktop") + " | " +
        getScreenOrientation() + " | " +
        language
    );

    console.log("resolution: " + "requested " + app.settings.width + "x" + app.settings.height +
        ", got " + app.renderer.width + "x" + app.renderer.height
    );
}

export { consoleHeader };
