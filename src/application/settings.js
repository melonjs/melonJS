/**
 * additional import for TypeScript
 * @import Renderer from "./../video/renderer.js";
 */

/**
 * Application & Renderer Settings definition.
 * @typedef {Object} ApplicationSettings
 * @property {string|HTMLElement} [parent=document.body] - the DOM parent element to hold the canvas in the HTML file
 * @property {HTMLCanvasElement} [canvas] - an existing canvas element to use as the renderer target (by default melonJS will create its own canvas based on given parameters)
 * @property {number|Renderer} [renderer=AUTO] - renderer to use (CANVAS, WEBGL, AUTO), or a custom renderer class
 * @property {number|string} [scale=1.0] - enable scaling of the canvas ('auto' for automatic scaling)
 * @property {"fit"|"fill-min"|"fill-max"|"flex"|"flex-width"|"flex-height"|"stretch"} [scaleMethod="fit"] - screen scaling modes : <br>
 *  - <i><b>`fit`</b></i> : Letterboxed; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-fit.png"/></center><br>
 *  - <i><b>`fill-min`</b></i> : Canvas is resized to fit minimum design resolution; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-fill-min.png"/></center><br>
 *  - <i><b>`fill-max`</b></i> : Canvas is resized to fit maximum design resolution; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-fill-max.png"/></center><br>
 *  - <i><b>`flex`</b><</i> : Canvas width & height is resized to fit; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-flex.png"/></center><br>
 *  - <i><b>`flex-width`</b></i> : Canvas width is resized to fit; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-flex-width.png"/></center><br>
 *  - <i><b>`flex-height`</b></i> : Canvas height is resized to fit; content is scaled to design aspect ratio <br>
 * <center><img src="images/scale-flex-height.png"/></center><br>
 *  - <i><b>`stretch`</b></i> : Canvas is resized to fit; content is scaled to screen aspect ratio <br>
 * <center><img src="images/scale-stretch.png"/></center>
 * @property {string|HTMLElement} [scaleTarget] - the HTML Element to be used as the reference target when using automatic scaling (by default melonJS will use the parent container of the div element containing the canvas)
 * @property {boolean} [preferWebGL1=false] - if true the renderer will only use WebGL 1
 * @property {"sorting"|"z-buffer"} [depthTest="sorting"] - ~Experimental~ the default method to sort object on the z axis in WebGL
 * @property {("default"|"high-performance"|"low-power")} [powerPreference="default"] - a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context. To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
 * @property {boolean} [transparent=false] - whether to allow transparent pixels in the front buffer (screen).
 * @property {boolean} [antiAlias=false] - whether to enable or not video scaling interpolation
 * @property {boolean} [consoleHeader=true] - whether to display melonJS version and basic device information in the console
 * @property {number} [zoomX=width] - The actual width of the canvas with scaling applied
 * @property {number} [zoomY=height] - The actual height of the canvas with scaling applied
 * @property {Compositor} [compositor] - a custom compositor class (WebGL only)
 * @property {string} [physic="builtin"] - the physic system to use (default: "builtin", or "none" to disable builtin physic)
 */
export const ApplicationSettings = {
    parent : undefined,
    canvas : undefined,
    renderer : 2, // AUTO
    autoScale : false,
    scale : 1.0,
    scaleMethod : "manual",
    scaleTarget : undefined,
    preferWebGL1 : false,
    depthTest: "sorting",
    powerPreference : "default",
    transparent : false,
    antiAlias : false,
    consoleHeader : true,
    premultipliedAlpha: true,
    blendMode : "normal",
    physic : "builtin",
    failIfMajorPerformanceCaveat : true,
    subPixel : false,
    verbose : false,
    legacy : false
};
