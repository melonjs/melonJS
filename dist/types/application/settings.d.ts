/**
 * Application & Renderer Settings definition.
 */
export type ApplicationSettings = {
    /**
     * - the DOM parent element to hold the canvas in the HTML file
     */
    parent?: string | HTMLElement | undefined;
    /**
     * - an existing canvas element to use as the renderer target (by default melonJS will create its own canvas based on given parameters)
     */
    canvas?: HTMLCanvasElement | undefined;
    /**
     * - renderer to use (CANVAS, WEBGL, AUTO), or a custom renderer class
     */
    renderer?: number | Renderer | undefined;
    /**
     * - enable scaling of the canvas ('auto' for automatic scaling)
     */
    scale?: string | number | undefined;
    /**
     * - screen scaling modes : <br>
     * - <i><b>`fit`</b></i> : Letterboxed; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-fit.png"/></center><br>
     * - <i><b>`fill-min`</b></i> : Canvas is resized to fit minimum design resolution; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-fill-min.png"/></center><br>
     * - <i><b>`fill-max`</b></i> : Canvas is resized to fit maximum design resolution; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-fill-max.png"/></center><br>
     * - <i><b>`flex`</b><</i> : Canvas width & height is resized to fit; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-flex.png"/></center><br>
     * - <i><b>`flex-width`</b></i> : Canvas width is resized to fit; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-flex-width.png"/></center><br>
     * - <i><b>`flex-height`</b></i> : Canvas height is resized to fit; content is scaled to design aspect ratio <br>
     * <center><img src="images/scale-flex-height.png"/></center><br>
     * - <i><b>`stretch`</b></i> : Canvas is resized to fit; content is scaled to screen aspect ratio <br>
     * <center><img src="images/scale-stretch.png"/></center>
     */
    scaleMethod?: "flex" | "fit" | "fill-min" | "fill-max" | "flex-width" | "flex-height" | "stretch" | undefined;
    /**
     * - the HTML Element to be used as the reference target when using automatic scaling (by default melonJS will use the parent container of the div element containing the canvas)
     */
    scaleTarget?: string | HTMLElement | undefined;
    /**
     * - if true the renderer will only use WebGL 1
     */
    preferWebGL1?: boolean | undefined;
    /**
     * - ~Experimental~ the default method to sort object on the z axis in WebGL
     */
    depthTest?: "sorting" | "z-buffer" | undefined;
    /**
     * - a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context. To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
     */
    powerPreference?: "default" | "high-performance" | "low-power" | undefined;
    /**
     * - whether to allow transparent pixels in the front buffer (screen).
     */
    transparent?: boolean | undefined;
    /**
     * - whether to enable or not video scaling interpolation
     */
    antiAlias?: boolean | undefined;
    /**
     * - whether to display melonJS version and basic device information in the console
     */
    consoleHeader?: boolean | undefined;
    /**
     * - The actual width of the canvas with scaling applied
     */
    zoomX?: number | undefined;
    /**
     * - The actual height of the canvas with scaling applied
     */
    zoomY?: number | undefined;
    /**
     * - a custom compositor class (WebGL only)
     */
    compositor?: any;
    /**
     * - the physic system to use (default: "builtin", or "none" to disable builtin physic)
     */
    physic?: string | undefined;
};
export namespace ApplicationSettings {
    let parent: undefined;
    let canvas: undefined;
    let renderer: number;
    let autoScale: boolean;
    let scale: number;
    let scaleMethod: string;
    let scaleTarget: undefined;
    let preferWebGL1: boolean;
    let depthTest: string;
    let powerPreference: string;
    let transparent: boolean;
    let antiAlias: boolean;
    let consoleHeader: boolean;
    let premultipliedAlpha: boolean;
    let blendMode: string;
    let physic: string;
    let failIfMajorPerformanceCaveat: boolean;
    let subPixel: boolean;
    let verbose: boolean;
    let legacy: boolean;
}
import type Renderer from "./../video/renderer.js";
