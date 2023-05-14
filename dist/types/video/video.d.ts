/**
 * Initialize the "video" system (create a canvas based on the given arguments, and the related renderer). <br>
 * melonJS support various scaling mode, that can be enabled <u>once the scale option is set to <b>`auto`</b></u> : <br>
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
 *  - <i><b>`stretch`</b></i> : Canvas is resized to fit; content is scaled to screen aspect ratio
 * <center><img src="images/scale-stretch.png"/></center><br>
 * @memberof video
 * @param {number} width - The width of the canvas viewport
 * @param {number} height - The height of the canvas viewport
 * @param {object} [options] - The optional video/renderer parameters.<br> (see Renderer(s) documentation for further specific options)
 * @param {string|HTMLElement} [options.parent=document.body] - the DOM parent element to hold the canvas in the HTML file
 * @param {number|Renderer} [options.renderer=video.AUTO] - renderer to use (me.video.CANVAS, me.video.WEBGL, me.video.AUTO), or a custom renderer class
 * @param {number|string} [options.scale=1.0] - enable scaling of the canvas ('auto' for automatic scaling)
 * @param {string} [options.scaleMethod="fit"] - screen scaling modes ('fit','fill-min','fill-max','flex','flex-width','flex-height','stretch')
 * @param {boolean} [options.preferWebGL1=false] - if true the renderer will only use WebGL 1
 * @param {string} [options.powerPreference="default"] - a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
 * @param {boolean} [options.transparent=false] - whether to allow transparent pixels in the front buffer (screen).
 * @param {boolean} [options.antiAlias=false] - whether to enable or not video scaling interpolation
 * @param {boolean} [options.consoleHeader=true] - whether to display melonJS version and basic device information in the console
 * @returns {boolean} false if initialization failed (canvas not supported)
 * @example
 * // init the video with a 640x480 canvas
 * me.video.init(640, 480, {
 *     parent : "screen",
 *     renderer : me.video.AUTO,
 *     scale : "auto",
 *     scaleMethod : "fit"
 * });
 */
export function init(width: number, height: number, options?: {
    parent?: string | HTMLElement | undefined;
    renderer?: number | Renderer;
    scale?: string | number | undefined;
    scaleMethod?: string | undefined;
    preferWebGL1?: boolean | undefined;
    powerPreference?: string | undefined;
    transparent?: boolean | undefined;
    antiAlias?: boolean | undefined;
    consoleHeader?: boolean | undefined;
} | undefined): boolean;
/**
 * Create and return a new Canvas element
 * @memberof video
 * @param {number} width - width
 * @param {number} height - height
 * @param {boolean} [returnOffscreenCanvas=false] - will return an OffscreenCanvas if supported
 * @returns {HTMLCanvasElement|OffscreenCanvas}
 */
export function createCanvas(width: number, height: number, returnOffscreenCanvas?: boolean | undefined): HTMLCanvasElement | OffscreenCanvas;
/**
 * return a reference to the parent DOM element holding the main canvas
 * @memberof video
 * @returns {HTMLElement}
 */
export function getParent(): HTMLElement;
/**
 * A reference to the active Canvas or WebGL active renderer renderer
 * @memberof video
 * @type {CanvasRenderer|WebGLRenderer}
 */
export let renderer: CanvasRenderer | WebGLRenderer;
export { CANVAS, WEBGL, AUTO } from "../const";
