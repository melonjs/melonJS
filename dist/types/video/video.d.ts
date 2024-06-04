/**
 * Initialize the "video" system (create a canvas based on the given arguments, and the related renderer). <br>
 * @memberof video
 * @param {number} width - The width of the canvas viewport
 * @param {number} height - The height of the canvas viewport
 * @param {ApplicationSettings} [options] - optional parameters for the renderer
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
export function init(width: number, height: number, options?: ApplicationSettings | undefined): boolean;
/**
 * Create and return a new Canvas element
 * @memberof video
 * @param {number} width - width
 * @param {number} height - height
 * @param {boolean} [returnOffscreenCanvas=false] - will return an OffscreenCanvas if supported
 * @returns {HTMLCanvasElement|OffscreenCanvas} a new Canvas element of the given size
 */
export function createCanvas(width: number, height: number, returnOffscreenCanvas?: boolean | undefined): HTMLCanvasElement | OffscreenCanvas;
/**
 * return a reference to the parent DOM element holding the main canvas
 * @memberof video
 * @returns {HTMLElement} the HTML parent element
 */
export function getParent(): HTMLElement;
/**
 * A reference to the active Canvas or WebGL active renderer renderer
 * @memberof video
 * @type {CanvasRenderer|WebGLRenderer}
 */
export let renderer: CanvasRenderer | WebGLRenderer;
import { ApplicationSettings } from "../application/settings.js";
