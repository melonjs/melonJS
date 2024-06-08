/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { emit, WINDOW_ONRESIZE, WINDOW_ONORIENTATION_CHANGE, WINDOW_ONSCROLL, VIDEO_INIT } from '../system/event.js';
import { game, initialized } from '../index.js';
import { offscreenCanvas, screenOrientation } from '../system/device.js';
import { throttle } from '../utils/function.js';
import { ApplicationSettings } from '../application/settings.js';
export { AUTO, CANVAS, WEBGL } from '../const.js';

/**
 * A reference to the active Canvas or WebGL active renderer renderer
 * @memberof video
 * @type {CanvasRenderer|WebGLRenderer}
 */
let renderer = null;

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
function init(width, height, options) {
    // ensure melonjs has been properly initialized
    if (!initialized) {
        throw new Error("me.video.init() called before engine initialization.");
    }

    try {
        // initialize the default game Application with the given options
        game.init(width, height, Object.assign(ApplicationSettings, options || {}));
    } catch (e) {
        console.log(e.message);
        // me.video.init() historically returns false if failing at creating/using a HTML5 canvas
        return false;
    }

    // assign the default renderer
    renderer = game.renderer;

    //add a channel for the onresize/onorientationchange event
    globalThis.addEventListener(
        "resize",
        throttle(
            (e) => {
                emit(WINDOW_ONRESIZE, e);
            }, 100
        ), false
    );

    // Screen Orientation API
    globalThis.addEventListener(
        "orientationchange",
        (e) => {
            emit(WINDOW_ONORIENTATION_CHANGE, e);
        },
        false
    );

    // pre-fixed implementation on mozzila
    globalThis.addEventListener(
        "onmozorientationchange",
        (e) => {
            emit(WINDOW_ONORIENTATION_CHANGE, e);
        },
        false
    );

    if (screenOrientation === true) {
        globalThis.screen.orientation.onchange = function (e) {
            emit(WINDOW_ONORIENTATION_CHANGE, e);
        };
    }

    // Automatically update relative canvas position on scroll
    globalThis.addEventListener("scroll", throttle((e) => {
        emit(WINDOW_ONSCROLL, e);
    }, 100), false);

    // notify the video has been initialized
    emit(VIDEO_INIT, game.renderer);

    return true;
}

/**
 * Create and return a new Canvas element
 * @memberof video
 * @param {number} width - width
 * @param {number} height - height
 * @param {boolean} [returnOffscreenCanvas=false] - will return an OffscreenCanvas if supported
 * @returns {HTMLCanvasElement|OffscreenCanvas} a new Canvas element of the given size
 */
function createCanvas(width, height, returnOffscreenCanvas = false) {
    let _canvas;

    if (width === 0 || height === 0) {
        throw new Error("width or height was zero, Canvas could not be initialized !");
    }

    if (offscreenCanvas === true && returnOffscreenCanvas === true) {
        _canvas = new globalThis.OffscreenCanvas(0, 0);
        // stubbing style for compatibility,
        // as OffscreenCanvas is detached from the DOM
        if (typeof _canvas.style === "undefined") {
            _canvas.style = {};
        }
    } else {
        // "else" create a "standard" canvas
        _canvas = globalThis.document.createElement("canvas");
    }
    _canvas.width = width;
    _canvas.height = height;

    return _canvas;
}

/**
 * return a reference to the parent DOM element holding the main canvas
 * @memberof video
 * @returns {HTMLElement} the HTML parent element
 */
function getParent() {
    return game.getParentElement();
}

export { createCanvas, getParent, init, renderer };
